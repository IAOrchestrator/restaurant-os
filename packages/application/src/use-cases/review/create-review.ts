import {
  Review,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { ReviewRepository } from '../../ports/review-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CreateReviewInput {
  id: string;
  restaurantId: string;
  customerId: string;
  rating: number;
  comment?: string | null;
  actorType?: ActorType;
  actorId?: string | null;
}

export class CreateReviewUseCase {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateReviewInput): Promise<Result<Review, Error>> {
    const reviewResult = Review.create({
      id: input.id,
      restaurantId: input.restaurantId,
      customerId: input.customerId,
      rating: input.rating,
      comment: input.comment ?? null,
    });

    if (!reviewResult.success) {
      return err(reviewResult.error);
    }

    await this.reviewRepo.save(reviewResult.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.REVIEW_CREATED,
        restaurantId: reviewResult.value.restaurantId,
        aggregateType: 'Review',
        aggregateId: reviewResult.value.id,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? input.customerId,
        payload: {
          reviewId: reviewResult.value.id,
          restaurantId: reviewResult.value.restaurantId,
          customerId: reviewResult.value.customerId,
          rating: reviewResult.value.rating,
        },
      }),
    );

    return ok(reviewResult.value);
  }
}
