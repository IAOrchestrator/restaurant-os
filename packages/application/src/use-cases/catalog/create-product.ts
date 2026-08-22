import { Product } from '@restaurant-os/domain';
import type { ProductRepository } from '../../ports/product-repository';
import type { CategoryRepository } from '../../ports/category-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CreateProductInput {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
}

export class CreateProductUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateProductInput): Promise<Result<Product, Error>> {
    const category = await this.categoryRepo.findById(input.categoryId);
    if (!category) {
      return err(new Error('Category not found'));
    }

    const productResult = Product.create({
      id: input.id,
      restaurantId: input.restaurantId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      imageUrl: input.imageUrl ?? null,
    });

    if (!productResult.success) {
      return err(productResult.error);
    }

    await this.productRepo.save(productResult.value);
    await this.eventPublisher.publish('PRODUCT_CREATED', {
      productId: productResult.value.id,
      restaurantId: productResult.value.restaurantId,
      categoryId: productResult.value.categoryId,
      name: productResult.value.name,
      price: productResult.value.price,
    });

    return ok(productResult.value);
  }
}
