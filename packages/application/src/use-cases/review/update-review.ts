import { Review } from '@restaurant-os/domain';
import type { ReviewRepository } from '../../ports/review-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface UpdateReviewInput {
  reviewId: string;
  rating?: number;
  comment?: string | null;
}

export class UpdateReviewUseCase {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: UpdateReviewInput): Promise<Result<Review, Error>> {
    const review = await this.reviewRepo.findById(input.reviewId);
    if (!review) {
      return err(new Error('Review not found'));
    }

    const updated = review.update({
      rating: input.rating,
      comment: input.comment,
    });

    if (!updated.success) {
      return err(updated.error);
    }

    await this.reviewRepo.save(updated.value);
    await this.eventPublisher.publish('REVIEW_UPDATED', {
      reviewId: updated.value.id,
      restaurantId: updated.value.restaurantId,
      rating: updated.value.rating,
    });

    return ok(updated.value);
  }
}
