import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type CategoryId = string;

export class Category extends Entity<CategoryId> {
  private constructor(
    id: CategoryId,
    public readonly restaurantId: string,
    public readonly name: string,
    public readonly description: string | null,
    public readonly sortOrder: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: CategoryId;
    restaurantId: string;
    name: string;
    description?: string | null;
    sortOrder?: number;
    createdAt?: Date;
  }): Result<Category, CategoryDomainError> {
    if (!props.name || props.name.trim().length === 0) {
      return err(new CategoryDomainError('Category name is required'));
    }
    if (props.name.trim().length > 100) {
      return err(new CategoryDomainError('Category name must be at most 100 characters'));
    }

    const now = props.createdAt ?? new Date();
    return ok(
      new Category(
        props.id,
        props.restaurantId,
        props.name.trim(),
        props.description ?? null,
        props.sortOrder ?? 0,
        true,
        now,
        now,
      ),
    );
  }

  update(props: {
    name?: string;
    description?: string | null;
    sortOrder?: number;
  }): Result<Category, CategoryDomainError> {
    if (props.name !== undefined) {
      if (props.name.trim().length === 0) {
        return err(new CategoryDomainError('Category name is required'));
      }
      if (props.name.trim().length > 100) {
        return err(new CategoryDomainError('Category name must be at most 100 characters'));
      }
    }

    return ok(
      new Category(
        this.id,
        this.restaurantId,
        props.name !== undefined ? props.name.trim() : this.name,
        props.description !== undefined ? props.description : this.description,
        props.sortOrder !== undefined ? props.sortOrder : this.sortOrder,
        this.isActive,
        this.createdAt,
        new Date(),
      ),
    );
  }

  deactivate(): Category {
    return new Category(
      this.id,
      this.restaurantId,
      this.name,
      this.description,
      this.sortOrder,
      false,
      this.createdAt,
      new Date(),
    );
  }

  activate(): Category {
    return new Category(
      this.id,
      this.restaurantId,
      this.name,
      this.description,
      this.sortOrder,
      true,
      this.createdAt,
      new Date(),
    );
  }
}

export class CategoryDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CategoryDomainError';
  }
}
