import { describe, it, expect } from 'vitest';
import {
  Review,
  ReviewDomainError,
} from '../src/review/entity';

describe('Review aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    customerId: '550e8400-e29b-41d4-a716-446655440002',
    rating: 4,
  };

  it('creates with valid rating', () => {
    const result = Review.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.rating).toBe(4);
      expect(result.value.comment).toBeNull();
    }
  });

  it('creates with comment', () => {
    const result = Review.create({ ...validProps, comment: 'Great food!' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.comment).toBe('Great food!');
    }
  });

  it('trims comment on creation', () => {
    const result = Review.create({ ...validProps, comment: '  Amazing!  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.comment).toBe('Amazing!');
    }
  });

  it('fails with rating below 1', () => {
    const result = Review.create({ ...validProps, rating: 0 });
    expect(result.success).toBe(false);
  });

  it('fails with rating above 5', () => {
    const result = Review.create({ ...validProps, rating: 6 });
    expect(result.success).toBe(false);
  });

  it('fails with non-integer rating', () => {
    const result = Review.create({ ...validProps, rating: 3.5 });
    expect(result.success).toBe(false);
  });

  it('fails with comment too long', () => {
    const result = Review.create({ ...validProps, comment: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('updates rating', () => {
    const review = Review.create(validProps).value!;
    const updated = review.update({ rating: 5 });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.rating).toBe(5);
    }
  });

  it('updates comment', () => {
    const review = Review.create(validProps).value!;
    const updated = review.update({ comment: 'Updated comment' });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.comment).toBe('Updated comment');
    }
  });

  it('updates comment to null', () => {
    const review = Review.create({ ...validProps, comment: 'Original' }).value!;
    const updated = review.update({ comment: null });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.comment).toBeNull();
    }
  });

  it('fails to update with invalid rating', () => {
    const review = Review.create(validProps).value!;
    const updated = review.update({ rating: 0 });
    expect(updated.success).toBe(false);
  });

  it('fails to update with comment too long', () => {
    const review = Review.create(validProps).value!;
    const updated = review.update({ comment: 'a'.repeat(2001) });
    expect(updated.success).toBe(false);
  });

  it('is immutable', () => {
    const review = Review.create(validProps).value!;
    review.update({ rating: 5 });
    expect(review.rating).toBe(4);
  });
});
