import type { Review, ReviewId } from '@restaurant-os/domain';

export interface ReviewRepository {
  findById(id: ReviewId): Promise<Review | null>;
  findByRestaurantId(restaurantId: string): Promise<Review[]>;
  findByCustomerId(customerId: string): Promise<Review[]>;
  save(review: Review): Promise<void>;
  delete(id: ReviewId): Promise<void>;
}
