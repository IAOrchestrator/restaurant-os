import { Product } from '@restaurant-os/domain';
import type { ProductRepository } from '../../ports/product-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface UpdateProductInput {
  productId: string;
  name?: string;
  description?: string | null;
  price?: number;
  imageUrl?: string | null;
  categoryId?: string;
}

export class UpdateProductUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: UpdateProductInput): Promise<Result<Product, Error>> {
    const product = await this.productRepo.findById(input.productId);
    if (!product) {
      return err(new Error('Product not found'));
    }

    const updated = product.update({
      name: input.name,
      description: input.description,
      price: input.price,
      imageUrl: input.imageUrl,
      categoryId: input.categoryId,
    });

    if (!updated.success) {
      return err(updated.error);
    }

    await this.productRepo.save(updated.value);
    await this.eventPublisher.publish('PRODUCT_UPDATED', {
      productId: updated.value.id,
      restaurantId: updated.value.restaurantId,
      name: updated.value.name,
      price: updated.value.price,
    });

    return ok(updated.value);
  }
}
