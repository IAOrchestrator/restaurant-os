import { Entity } from '../shared/entity';
import { Result, ok, err } from '../shared/result';

export type CustomerId = string;

export class Customer extends Entity<CustomerId> {
  private constructor(
    id: CustomerId,
    private _name: string | null,
    private _phone: string | null,
    private _email: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {
    super(id);
  }

  static create(props: {
    id: CustomerId;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): Result<Customer, CustomerDomainError> {
    if (!props.id || props.id.trim().length === 0) {
      return err(new CustomerDomainError('Customer ID is required'));
    }

    if (props.email && !Customer.isValidEmail(props.email)) {
      return err(new CustomerDomainError(`Invalid email format: ${props.email}`));
    }

    const now = new Date();

    return ok(
      new Customer(
        props.id,
        props.name ?? null,
        props.phone ?? null,
        props.email ?? null,
        props.createdAt ?? now,
        props.updatedAt ?? now,
      ),
    );
  }

  get name(): string | null {
    return this._name;
  }

  get phone(): string | null {
    return this._phone;
  }

  get email(): string | null {
    return this._email;
  }

  updateProfile(props: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  }): Result<Customer, CustomerDomainError> {
    if (props.email !== undefined && props.email !== null && !Customer.isValidEmail(props.email)) {
      return err(new CustomerDomainError(`Invalid email format: ${props.email}`));
    }

    return ok(
      new Customer(
        this.id,
        props.name !== undefined ? props.name : this._name,
        props.phone !== undefined ? props.phone : this._phone,
        props.email !== undefined ? props.email : this._email,
        this.createdAt,
        new Date(),
      ),
    );
  }

  private static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

export class CustomerDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomerDomainError';
  }
}
