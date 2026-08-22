import { Review } from '@restaurant-os/domain';
import type { Review as PrismaReview } from '@restaurant-os/database';

export class ReviewMapper {
  static toDomain(prismaReview: PrismaReview): Review | null {
    const result = Review.create({
      id: prismaReview.id,
      restaurantId: prismaReview.restaurantId,
      customerId: prismaReview.customerId,
      rating: prismaReview.rating,
      comment: prismaReview.comment,
      createdAt: prismaReview.createdAt,
    });

    return result.success ? result.value : null;
  }

  static toPrisma(review: Review): Omit<PrismaReview, 'restaurant' | 'customer'> {
    return {
      id: review.id,
      restaurantId: review.restaurantId,
      customerId: review.customerId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
