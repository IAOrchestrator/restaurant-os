import { describe, it, expect } from 'vitest';
import {
  Category,
  CategoryDomainError,
} from '../src/catalog/category';

describe('Category aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Main Courses',
  };

  it('creates with active status by default', () => {
    const result = Category.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.name).toBe('Main Courses');
      expect(result.value.isActive).toBe(true);
      expect(result.value.sortOrder).toBe(0);
    }
  });

  it('fails to create with empty name', () => {
    const result = Category.create({ ...validProps, name: '' });
    expect(result.success).toBe(false);
  });

  it('fails to create with name too long', () => {
    const result = Category.create({ ...validProps, name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('trims name on creation', () => {
    const result = Category.create({ ...validProps, name: '  Drinks  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.name).toBe('Drinks');
    }
  });

  it('updates name', () => {
    const category = Category.create(validProps).value!;
    const updated = category.update({ name: 'New Name' });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.name).toBe('New Name');
    }
  });

  it('fails to update with empty name', () => {
    const category = Category.create(validProps).value!;
    const updated = category.update({ name: '' });
    expect(updated.success).toBe(false);
  });

  it('updates sortOrder', () => {
    const category = Category.create(validProps).value!;
    const updated = category.update({ sortOrder: 5 });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.sortOrder).toBe(5);
    }
  });

  it('deactivates', () => {
    const category = Category.create(validProps).value!;
    const deactivated = category.deactivate();
    expect(deactivated.isActive).toBe(false);
  });

  it('activates', () => {
    const category = Category.create(validProps).value!.deactivate();
    const activated = category.activate();
    expect(activated.isActive).toBe(true);
  });

  it('is immutable', () => {
    const category = Category.create(validProps).value!;
    category.deactivate();
    expect(category.isActive).toBe(true);
  });
});
