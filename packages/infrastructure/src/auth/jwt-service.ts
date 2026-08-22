import { createHmac, timingSafeEqual } from 'crypto';
import { StaffRole } from '@restaurant-os/domain';
import { Result, ok, err } from '@restaurant-os/domain';

export type ActorTokenType = 'STAFF' | 'TABLE_DEVICE' | 'CUSTOMER' | 'SYSTEM';

export interface BaseTokenPayload {
  sub: string;
  type: ActorTokenType;
  restaurantId: string | null;
  iat?: number;
  exp?: number;
}

export interface StaffTokenPayload extends BaseTokenPayload {
  type: 'STAFF';
  restaurantId: string;
  roles: StaffRole[];
  name?: string;
  email?: string;
}

export interface TableDeviceTokenPayload extends BaseTokenPayload {
  type: 'TABLE_DEVICE';
  restaurantId: string;
  tableId: string | null;
  name?: string;
}

export interface CustomerTokenPayload extends BaseTokenPayload {
  type: 'CUSTOMER';
  restaurantId: string | null;
  tableSessionId: string | null;
  name?: string;
}

export type TokenPayload = StaffTokenPayload | TableDeviceTokenPayload | CustomerTokenPayload | BaseTokenPayload;

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export class JwtService {
  constructor(private readonly secret: string = process.env.JWT_SECRET || 'restaurant_os_jwt_secret_key_2026') {}

  sign(payload: TokenPayload, expiresInSeconds: number = 86400 * 7): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(fullPayload));
    const signature = this.createSignature(`${headerEncoded}.${payloadEncoded}`);

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  verify(token: string): Result<TokenPayload, Error> {
    if (!token || typeof token !== 'string') {
      return err(new Error('Token is missing or not a string'));
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return err(new Error('Invalid token structure'));
    }

    const [headerEncoded, payloadEncoded, signatureProvided] = parts;
    const expectedSignature = this.createSignature(`${headerEncoded}.${payloadEncoded}`);

    try {
      const isSignatureValid = timingSafeEqual(
        Buffer.from(signatureProvided),
        Buffer.from(expectedSignature),
      );
      if (!isSignatureValid) {
        return err(new Error('Invalid token signature'));
      }
    } catch {
      return err(new Error('Signature verification failed'));
    }

    try {
      const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as TokenPayload;
      const now = Math.floor(Date.now() / 1000);

      if (payload.exp && payload.exp < now) {
        return err(new Error('Token has expired'));
      }

      return ok(payload);
    } catch {
      return err(new Error('Invalid token payload JSON'));
    }
  }

  private createSignature(data: string): string {
    const hmac = createHmac('sha256', this.secret);
    hmac.update(data);
    return base64UrlEncode(hmac.digest('base64'));
  }
}
