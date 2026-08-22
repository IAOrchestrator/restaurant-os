import { describe, it, expect } from 'vitest';
import {
  Product,
  ProductDomainError,
} from '../src/catalog/product';

describe('Product aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    categoryId: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Margherita Pizza',
    price: 12.5,
  };

  it('creates with available status by default', () => {
    const result = Product.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.name).toBe('Margherita Pizza');
      expect(result.value.price).toBe(12.5);
      expect(result.value.isAvailable).toBe(true);
    }
  });

  it('fails to create with empty name', () => {
    const result = Product.create({ ...validProps, name: '' });
    expect(result.success).toBe(false);
  });

  it('fails to create with name too long', () => {
    const result = Product.create({ ...validProps, name: 'a'.repeat(151) });
    expect(result.success).toBe(false);
  });

  it('fails to create with negative price', () => {
    const result = Product.create({ ...validProps, price: -5 });
    expect(result.success).toBe(false);
  });

  it('allows zero price', () => {
    const result = Product.create({ ...validProps, price: 0 });
    expect(result.success).toBe(true);
  });

  it('trims name on creation', () => {
    const result = Product.create({ ...validProps, name: '  Burger  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.name).toBe('Burger');
    }
  });

  it('updates price', () => {
    const product = Product.create(validProps).value!;
    const updated = product.update({ price: 15 });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.price).toBe(15);
    }
  });

  it('fails to update with negative price', () => {
    const product = Product.create(validProps).value!;
    const updated = product.update({ price: -1 });
    expect(updated.success).toBe(false);
  });

  it('changes availability', () => {
    const product = Product.create(validProps).value!;
    const unavailable = product.setAvailability(false);
    expect(unavailable.isAvailable).toBe(false);
  });

  it('changes price directly', () => {
    const product = Product.create(validProps).value!;
    const updated = product.changePrice(20);
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.price).toBe(20);
    }
  });

  it('fails to change price to negative', () => {
    const product = Product.create(validProps).value!;
    const updated = product.changePrice(-5);
    expect(updated.success).toBe(false);
  });

  it('updates category', () => {
    const product = Product.create(validProps).value!;
    const updated = product.update({ categoryId: 'new-cat-id' });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.categoryId).toBe('new-cat-id');
    }
  });

  it('is immutable', () => {
    const product = Product.create(validProps).value!;
    product.setAvailability(false);
    expect(product.isAvailable).toBe(true);
  });
});
