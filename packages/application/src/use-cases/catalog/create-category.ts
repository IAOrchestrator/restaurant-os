import { Category } from '@restaurant-os/domain';
import type { CategoryRepository } from '../../ports/category-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface CreateCategoryInput {
  id: string;
  restaurantId: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export class CreateCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateCategoryInput): Promise<Result<Category, Error>> {
    const categoryResult = Category.create({
      id: input.id,
      restaurantId: input.restaurantId,
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
    });

    if (!categoryResult.success) {
      return err(categoryResult.error);
    }

    await this.categoryRepo.save(categoryResult.value);
    await this.eventPublisher.publish('CATEGORY_CREATED', {
      categoryId: categoryResult.value.id,
      restaurantId: categoryResult.value.restaurantId,
      name: categoryResult.value.name,
    });

    return ok(categoryResult.value);
  }
}
