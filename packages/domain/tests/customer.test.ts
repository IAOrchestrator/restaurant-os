import { describe, it, expect } from 'vitest';
import { Customer, CustomerDomainError } from '../src/customer';

describe('Customer aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'John Doe',
    phone: '+123456789',
    email: 'john@example.com',
  };

  it('creates a customer successfully', () => {
    const result = Customer.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.id).toBe(validProps.id);
      expect(result.value.name).toBe(validProps.name);
      expect(result.value.phone).toBe(validProps.phone);
      expect(result.value.email).toBe(validProps.email);
    }
  });

  it('creates an anonymous/minimal customer without optional fields', () => {
    const result = Customer.create({ id: 'cust-anon-1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.id).toBe('cust-anon-1');
      expect(result.value.name).toBeNull();
      expect(result.value.email).toBeNull();
    }
  });

  it('fails with invalid email format', () => {
    const result = Customer.create({
      id: 'cust-1',
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(CustomerDomainError);
    }
  });

  it('updates profile and validates email', () => {
    const customer = Customer.create(validProps).value!;
    const updated = customer.updateProfile({
      name: 'Jane Doe',
      email: 'jane@example.com',
    });

    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.name).toBe('Jane Doe');
      expect(updated.value.email).toBe('jane@example.com');
      expect(updated.value.phone).toBe(validProps.phone);
    }

    const invalidUpdate = customer.updateProfile({ email: 'bad-email' });
    expect(invalidUpdate.success).toBe(false);
  });
});
