import { FastifyInstance } from 'fastify';
import {
  requirePermission,
  requireAnyPermission,
  validateRestaurantAccess,
  requireResourceAccess,
} from '@restaurant-os/infrastructure';
import { Permission } from '@restaurant-os/domain';
import { randomUUID } from 'crypto';
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  ReviewResponseSchema,
} from '@restaurant-os/contracts';
import {
  CreateReviewUseCase,
  UpdateReviewUseCase,
  type ReviewRepository,
  type EventPublisher,
} from '@restaurant-os/application';

export interface ReviewRoutesOptions {
  reviewRepo: ReviewRepository;
  eventPublisher: EventPublisher;
}

export async function reviewRoutes(app: FastifyInstance, opts: ReviewRoutesOptions) {
  const createUseCase = new CreateReviewUseCase(opts.reviewRepo, opts.eventPublisher);
  const updateUseCase = new UpdateReviewUseCase(opts.reviewRepo, opts.eventPublisher);

  // POST /api/reviews
  app.post(
    '/',
    {
      preHandler: [
        requireAnyPermission(Permission.REVIEWS_CREATE, Permission.REVIEWS_MANAGE),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const parsed = CreateReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await createUseCase.execute({
        id: parsed.data.id ?? randomUUID(),
        restaurantId: parsed.data.restaurantId,
        customerId: parsed.data.customerId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return reply.status(201).send(
        ReviewResponseSchema.parse({
          id: result.value.id,
          restaurantId: result.value.restaurantId,
          customerId: result.value.customerId,
          rating: result.value.rating,
          comment: result.value.comment,
          createdAt: result.value.createdAt.toISOString(),
          updatedAt: result.value.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/reviews?restaurantId=...&customerId=...
  app.get(
    '/',
    {
      preHandler: [
        requirePermission(Permission.REVIEWS_READ),
        validateRestaurantAccess(),
      ],
    },
    async (request, reply) => {
      const { restaurantId, customerId } = request.query as {
        restaurantId?: string;
        customerId?: string;
      };

      if (!restaurantId && !customerId) {
        return reply.status(400).send({ error: 'restaurantId or customerId query param is required' });
      }

      let reviews;
      if (restaurantId) {
        reviews = await opts.reviewRepo.findByRestaurantId(restaurantId);
      } else {
        reviews = await opts.reviewRepo.findByCustomerId(customerId!);
      }

      return reviews.map((r) =>
        ReviewResponseSchema.parse({
          id: r.id,
          restaurantId: r.restaurantId,
          customerId: r.customerId,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }),
      );
    },
  );

  // GET /api/reviews/:id
  app.get(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.REVIEWS_READ),
        requireResourceAccess('review'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const review = await opts.reviewRepo.findById(id);
      if (!review) {
        return reply.status(404).send({ error: 'Review not found' });
      }
      return ReviewResponseSchema.parse({
        id: review.id,
        restaurantId: review.restaurantId,
        customerId: review.customerId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
      });
    },
  );

  // PATCH /api/reviews/:id
  app.patch(
    '/:id',
    {
      preHandler: [
        requirePermission(Permission.REVIEWS_MANAGE),
        requireResourceAccess('review'),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = UpdateReviewSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.format() });
      }

      const result = await updateUseCase.execute({
        reviewId: id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error.message });
      }

      return ReviewResponseSchema.parse({
        id: result.value.id,
        restaurantId: result.value.restaurantId,
        customerId: result.value.customerId,
        rating: result.value.rating,
        comment: result.value.comment,
        createdAt: result.value.createdAt.toISOString(),
        updatedAt: result.value.updatedAt.toISOString(),
      });
    },
  );
}
