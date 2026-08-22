import { Category } from '@restaurant-os/domain';
import type { CategoryRepository } from '../../ports/category-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface UpdateCategoryInput {
  categoryId: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
}

export class UpdateCategoryUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: UpdateCategoryInput): Promise<Result<Category, Error>> {
    const category = await this.categoryRepo.findById(input.categoryId);
    if (!category) {
      return err(new Error('Category not found'));
    }

    const updated = category.update({
      name: input.name,
      description: input.description,
      sortOrder: input.sortOrder,
    });

    if (!updated.success) {
      return err(updated.error);
    }

    await this.categoryRepo.save(updated.value);
    await this.eventPublisher.publish('CATEGORY_UPDATED', {
      categoryId: updated.value.id,
      restaurantId: updated.value.restaurantId,
      name: updated.value.name,
    });

    return ok(updated.value);
  }
}
