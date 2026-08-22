import { Product } from '@restaurant-os/domain';
import type { ProductRepository } from '../../ports/product-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface ChangeProductAvailabilityInput {
  productId: string;
  available: boolean;
}

export class ChangeProductAvailabilityUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: ChangeProductAvailabilityInput): Promise<Result<Product, Error>> {
    const product = await this.productRepo.findById(input.productId);
    if (!product) {
      return err(new Error('Product not found'));
    }

    const updated = product.setAvailability(input.available);

    await this.productRepo.save(updated);
    await this.eventPublisher.publish('PRODUCT_UPDATED', {
      productId: updated.id,
      restaurantId: updated.restaurantId,
      name: updated.name,
      isAvailable: updated.isAvailable,
    });

    return ok(updated);
  }
}
