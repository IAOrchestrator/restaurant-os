import { Review, type ReviewId } from '@restaurant-os/domain';
import type { ReviewRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { ReviewMapper } from './mappers/review-mapper';

export class PrismaReviewRepository implements ReviewRepository {
  async findById(id: ReviewId): Promise<Review | null> {
    const prismaReview = await prisma.review.findUnique({ where: { id } });
    if (!prismaReview) return null;
    return ReviewMapper.toDomain(prismaReview);
  }

  async findByRestaurantId(restaurantId: string): Promise<Review[]> {
    const prismaReviews = await prisma.review.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaReviews
      .map((r) => ReviewMapper.toDomain(r))
      .filter((r): r is Review => r !== null);
  }

  async findByCustomerId(customerId: string): Promise<Review[]> {
    const prismaReviews = await prisma.review.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    return prismaReviews
      .map((r) => ReviewMapper.toDomain(r))
      .filter((r): r is Review => r !== null);
  }

  async save(review: Review): Promise<void> {
    const data = ReviewMapper.toPrisma(review);
    await prisma.review.upsert({
      where: { id: review.id },
      update: data,
      create: data,
    });
  }

  async delete(id: ReviewId): Promise<void> {
    await prisma.review.delete({ where: { id } });
  }
}
