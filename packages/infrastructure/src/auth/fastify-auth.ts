import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Actor, ActorType, Permission } from '@restaurant-os/domain';
import type { PermissionChecker, ResourceScoper } from '@restaurant-os/application';
import { JwtService, type TokenPayload } from './jwt-service';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor;
    tokenPayload?: TokenPayload;
    permissionChecker?: PermissionChecker;
    resourceScoper?: ResourceScoper;
  }
  interface FastifyInstance {
    permissionChecker?: PermissionChecker;
    resourceScoper?: ResourceScoper;
    jwtService?: JwtService;
  }
}

export interface AuthOptions {
  permissionChecker: PermissionChecker;
  resourceScoper: ResourceScoper;
  jwtService?: JwtService;
}

let globalAuthOptions: AuthOptions | null = null;
const defaultJwtService = new JwtService();

function parseHeaders(
  request: FastifyRequest | { headers?: Record<string, string | string[] | undefined> } | Record<string, any>,
): Record<string, string | undefined> {
  const raw = (request && 'headers' in request && request.headers) ? request.headers : (request || {});
  const headers: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : (v as string | undefined);
  }
  return headers;
}

// Extract verified TokenPayload from Authorization Bearer header
export function extractTokenPayload(
  request: FastifyRequest | { headers?: Record<string, string | string[] | undefined> } | Record<string, any>,
  jwtService: JwtService = globalAuthOptions?.jwtService || defaultJwtService,
): TokenPayload | undefined {
  const headers = parseHeaders(request);
  const authHeader = headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const verified = jwtService.verify(token);
    if (verified.success) {
      return verified.value;
    }
  }
  return undefined;
}

// Extract Actor from request (Bearer Token verified or fallback headers)
export function extractActor(
  request: FastifyRequest | { headers?: Record<string, string | string[] | undefined> } | Record<string, any>,
  jwtService: JwtService = globalAuthOptions?.jwtService || defaultJwtService,
): Actor {
  // 1. Check for Bearer token in Authorization header
  const tokenPayload = extractTokenPayload(request, jwtService);
  if (tokenPayload) {
    if (tokenPayload.type === 'STAFF') {
      return Actor.staff(tokenPayload.sub, tokenPayload.restaurantId ?? 'unknown');
    }
    if (tokenPayload.type === 'TABLE_DEVICE') {
      return Actor.tableDevice(tokenPayload.sub, tokenPayload.restaurantId ?? 'unknown');
    }
    if (tokenPayload.type === 'CUSTOMER') {
      return Actor.customer(tokenPayload.sub, tokenPayload.restaurantId);
    }
    return Actor.system();
  }

  // 2. Fallback to developer / test headers
  const headers = parseHeaders(request);
  const actorType = headers['x-actor-type'] || (headers['x-actor-id'] ? 'CUSTOMER' : 'CUSTOMER');
  const actorId = headers['x-actor-id'] || (actorType === ActorType.CUSTOMER ? 'anonymous' : 'system');
  const restaurantId = headers['x-restaurant-id'] || null;

  if (actorType === ActorType.CUSTOMER) {
    return Actor.customer(actorId, restaurantId);
  }
  if (actorType === ActorType.STAFF) {
    return Actor.staff(actorId, restaurantId ?? 'unknown');
  }
  if (actorType === ActorType.TABLE_DEVICE) {
    return Actor.tableDevice(actorId, restaurantId ?? 'unknown');
  }
  return Actor.system();
}

// Setup auth on Fastify instance
export function setupAuth(app: FastifyInstance, options: AuthOptions) {
  globalAuthOptions = options;
  app.permissionChecker = options.permissionChecker;
  app.resourceScoper = options.resourceScoper;
  app.jwtService = options.jwtService || defaultJwtService;

  app.addHook('onRequest', async (request: FastifyRequest) => {
    request.actor = extractActor(request, app.jwtService);
    request.tokenPayload = extractTokenPayload(request, app.jwtService);
    request.permissionChecker = options.permissionChecker;
    request.resourceScoper = options.resourceScoper;
  });
}

// PreHandler that attaches actor to request (standalone)
export function attachActor(request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void) {
  request.actor = extractActor(request);
  request.tokenPayload = extractTokenPayload(request);
  if (globalAuthOptions) {
    request.permissionChecker = globalAuthOptions.permissionChecker;
    request.resourceScoper = globalAuthOptions.resourceScoper;
  }
  done();
}

// Factory for permission-based preHandlers
export function requirePermission(permission: Permission) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.actor) {
      request.actor = extractActor(request);
      request.tokenPayload = extractTokenPayload(request);
    }
    const checker = request.permissionChecker || globalAuthOptions?.permissionChecker;
    if (!checker) {
      return reply.status(500).send({ error: 'Permission checker not configured' });
    }
    const hasPermission = await checker.hasPermission(request.actor, permission);
    if (!hasPermission) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Forbidden: requires permission ${permission}`,
      });
    }
  };
}

// Factory for requiring any of multiple permissions
export function requireAnyPermission(...permissions: Permission[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.actor) {
      request.actor = extractActor(request);
      request.tokenPayload = extractTokenPayload(request);
    }
    const checker = request.permissionChecker || globalAuthOptions?.permissionChecker;
    if (!checker) {
      return reply.status(500).send({ error: 'Permission checker not configured' });
    }
    const hasAny = await checker.hasAnyPermission(request.actor, permissions);
    if (!hasAny) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Forbidden: requires any of [${permissions.join(', ')}]`,
      });
    }
  };
}

// Middleware to enforce cross-restaurant isolation
export function validateRestaurantAccess() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.actor) {
      request.actor = extractActor(request);
      request.tokenPayload = extractTokenPayload(request);
    }

    if (request.actor.isSystem()) {
      return;
    }

    const query = request.query as Record<string, unknown> | undefined;
    const params = request.params as Record<string, unknown> | undefined;
    const body = request.body as Record<string, unknown> | undefined;

    const requestedRestaurantId =
      (query?.restaurantId as string | undefined) ||
      (params?.restaurantId as string | undefined) ||
      (body?.restaurantId as string | undefined);

    if (requestedRestaurantId && request.actor.restaurantId) {
      if (request.actor.restaurantId !== requestedRestaurantId) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Access denied to other restaurant data: current=${request.actor.restaurantId}, requested=${requestedRestaurantId}`,
        });
      }
    }
  };
}

// Middleware to enforce contextual resource access
export function requireResourceAccess(resourceType: string, idParamName: string = 'id') {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!request.actor) {
      request.actor = extractActor(request);
      request.tokenPayload = extractTokenPayload(request);
    }

    if (request.actor.isSystem()) {
      return;
    }

    const scoper = request.resourceScoper || globalAuthOptions?.resourceScoper;
    if (!scoper) {
      return; // Scoper not configured; rely on permission check
    }

    const params = request.params as Record<string, unknown> | undefined;
    const resourceId = params?.[idParamName] as string | undefined;

    const scope = await scoper.getScope(request.actor, resourceType);

    if (scope.isGlobal()) {
      return;
    }

    if (scope.isOwn() && resourceId && scope.resourceIds !== null) {
      if (!scope.canAccess(resourceId)) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Forbidden: no access to ${resourceType} ${resourceId}`,
        });
      }
    }
  };
}
