import { Review } from '@restaurant-os/domain';
import type { ReviewRepository } from '../../ports/review-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CreateReviewInput {
  id: string;
  restaurantId: string;
  customerId: string;
  rating: number;
  comment?: string | null;
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
    await this.eventPublisher.publish('REVIEW_CREATED', {
      reviewId: reviewResult.value.id,
      restaurantId: reviewResult.value.restaurantId,
      customerId: reviewResult.value.customerId,
      rating: reviewResult.value.rating,
    });

    return ok(reviewResult.value);
  }
}
