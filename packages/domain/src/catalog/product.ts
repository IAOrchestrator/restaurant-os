import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type ProductId = string;

export class Product extends Entity<ProductId> {
  private constructor(
    id: ProductId,
    public readonly restaurantId: string,
    public readonly categoryId: string,
    public readonly name: string,
    public readonly description: string | null,
    private _price: number,
    public readonly imageUrl: string | null,
    private _isAvailable: boolean,
    public readonly sectorKDS: string = 'PIZZAS',
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {
    super(id);
  }

  static create(props: {
    id: ProductId;
    restaurantId: string;
    categoryId: string;
    name: string;
    description?: string | null;
    price: number;
    imageUrl?: string | null;
    isAvailable?: boolean;
    sectorKDS?: string;
    createdAt?: Date;
  }): Result<Product, ProductDomainError> {
    if (!props.name || props.name.trim().length === 0) {
      return err(new ProductDomainError('Product name is required'));
    }
    if (props.name.trim().length > 150) {
      return err(new ProductDomainError('Product name must be at most 150 characters'));
    }
    if (props.price < 0) {
      return err(new ProductDomainError('Product price cannot be negative'));
    }

    const now = props.createdAt ?? new Date();
    return ok(
      new Product(
        props.id,
        props.restaurantId,
        props.categoryId,
        props.name.trim(),
        props.description ?? null,
        props.price,
        props.imageUrl ?? null,
        props.isAvailable ?? true,
        props.sectorKDS ?? 'PIZZAS',
        now,
        now,
      ),
    );
  }

  get price(): number {
    return this._price;
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  update(props: {
    name?: string;
    description?: string | null;
    price?: number;
    imageUrl?: string | null;
    categoryId?: string;
    sectorKDS?: string;
  }): Result<Product, ProductDomainError> {
    if (props.name !== undefined) {
      if (props.name.trim().length === 0) {
        return err(new ProductDomainError('Product name is required'));
      }
      if (props.name.trim().length > 150) {
        return err(new ProductDomainError('Product name must be at most 150 characters'));
      }
    }
    if (props.price !== undefined && props.price < 0) {
      return err(new ProductDomainError('Product price cannot be negative'));
    }

    return ok(
      new Product(
        this.id,
        this.restaurantId,
        props.categoryId ?? this.categoryId,
        props.name !== undefined ? props.name.trim() : this.name,
        props.description !== undefined ? props.description : this.description,
        props.price !== undefined ? props.price : this._price,
        props.imageUrl !== undefined ? props.imageUrl : this.imageUrl,
        this._isAvailable,
        props.sectorKDS !== undefined ? props.sectorKDS : this.sectorKDS,
        this.createdAt,
        new Date(),
      ),
    );
  }

  setAvailability(available: boolean): Product {
    return new Product(
      this.id,
      this.restaurantId,
      this.categoryId,
      this.name,
      this.description,
      this._price,
      this.imageUrl,
      available,
      this.sectorKDS,
      this.createdAt,
      new Date(),
    );
  }

  changePrice(newPrice: number): Result<Product, ProductDomainError> {
    if (newPrice < 0) {
      return err(new ProductDomainError('Product price cannot be negative'));
    }
    return ok(
      new Product(
        this.id,
        this.restaurantId,
        this.categoryId,
        this.name,
        this.description,
        newPrice,
        this.imageUrl,
        this._isAvailable,
        this.sectorKDS,
        this.createdAt,
        new Date(),
      ),
    );
  }
}

export class ProductDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductDomainError';
  }
}
