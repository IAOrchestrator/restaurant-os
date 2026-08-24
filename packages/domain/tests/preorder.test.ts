import { describe, it, expect } from 'vitest';
import {
  PreOrder,
  PreOrderStatus,
  PreOrderDomainError,
} from '../src/preorder/entity';

describe('PreOrder aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    customerId: '550e8400-e29b-41d4-a716-446655440002',
  };

  it('creates with DRAFT status by default', () => {
    const result = PreOrder.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(PreOrderStatus.DRAFT);
      expect(result.value.items).toHaveLength(0);
    }
  });

  it('adds items in DRAFT status', () => {
    const preOrder = PreOrder.create(validProps).value!;
    const added = preOrder.addItem({ productId: 'prod-1', quantity: 2 });
    expect(added.success).toBe(true);
    if (added.success) {
      expect(added.value.items).toHaveLength(1);
      expect(added.value.items[0].quantity).toBe(2);
    }
  });

  it('fails to add item with non-positive quantity', () => {
    const preOrder = PreOrder.create(validProps).value!;
    const added = preOrder.addItem({ productId: 'prod-1', quantity: 0 });
    expect(added.success).toBe(false);
  });

  it('removes items in DRAFT status', () => {
    const preOrder = PreOrder.create(validProps).value!
      .addItem({ productId: 'prod-1', quantity: 2 }).value!;
    const removed = preOrder.removeItem('prod-1');
    expect(removed.success).toBe(true);
    if (removed.success) {
      expect(removed.value.items).toHaveLength(0);
    }
  });

  it('fails to remove non-existent item', () => {
    const preOrder = PreOrder.create(validProps).value!;
    const removed = preOrder.removeItem('non-existent');
    expect(removed.success).toBe(false);
  });

  it('transitions DRAFT → READY', () => {
    const preOrder = PreOrder.create(validProps).value!;
    const ready = preOrder.markReady();
    expect(ready.success).toBe(true);
    if (ready.success) {
      expect(ready.value.status).toBe(PreOrderStatus.READY);
    }
  });

  it('transitions READY → REVIEWING', () => {
    const preOrder = PreOrder.create(validProps).value!.markReady().value!;
    const reviewing = preOrder.startReview();
    expect(reviewing.success).toBe(true);
    if (reviewing.success) {
      expect(reviewing.value.status).toBe(PreOrderStatus.REVIEWING);
    }
  });

  it('transitions REVIEWING → CONFIRMED', () => {
    const preOrder = PreOrder.create(validProps).value!.markReady().value!.startReview().value!;
    const confirmed = preOrder.confirm();
    expect(confirmed.success).toBe(true);
    if (confirmed.success) {
      expect(confirmed.value.status).toBe(PreOrderStatus.CONFIRMED);
    }
  });

  it('allows cancel from DRAFT', () => {
    const preOrder = PreOrder.create(validProps).value!;
    const cancelled = preOrder.cancel();
    expect(cancelled.success).toBe(true);
    if (cancelled.success) {
      expect(cancelled.value.status).toBe(PreOrderStatus.CANCELLED);
    }
  });

  it('allows cancel from REVIEWING', () => {
    const preOrder = PreOrder.create(validProps).value!.markReady().value!.startReview().value!;
    const cancelled = preOrder.cancel();
    expect(cancelled.success).toBe(true);
  });

  it('fails invalid transitions', () => {
    const preOrder = PreOrder.create(validProps).value!;
    expect(preOrder.startReview().success).toBe(false);
    const cancelled = preOrder.cancel().value!;
    expect(cancelled.confirm().success).toBe(false);
  });

  it('fails to add items after READY', () => {
    const preOrder = PreOrder.create(validProps).value!.markReady().value!;
    const added = preOrder.addItem({ productId: 'prod-1', quantity: 1 });
    expect(added.success).toBe(false);
  });

  it('is immutable', () => {
    const preOrder = PreOrder.create(validProps).value!;
    preOrder.markReady();
    expect(preOrder.status).toBe(PreOrderStatus.DRAFT);
  });
});
