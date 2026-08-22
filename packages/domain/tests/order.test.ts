import { describe, it, expect } from 'vitest';
import {
  Order,
  OrderStatus,
  OrderDomainError,
} from '../src/order/entity';

describe('Order aggregate', () => {
  const validProps = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    restaurantId: '550e8400-e29b-41d4-a716-446655440001',
    tableSessionId: '550e8400-e29b-41d4-a716-446655440002',
  };

  const sampleItem = { productId: 'prod-1', quantity: 2, unitPrice: 10 };

  it('creates with DRAFT status by default', () => {
    const result = Order.create(validProps);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(OrderStatus.DRAFT);
      expect(result.value.totalAmount).toBe(0);
    }
  });

  it('adds items and calculates total', () => {
    const order = Order.create(validProps).value!;
    const added = order.addItem(sampleItem);
    expect(added.success).toBe(true);
    if (added.success) {
      expect(added.value.items).toHaveLength(1);
      expect(added.value.totalAmount).toBe(20);
    }
  });

  it('fails to add item with negative unitPrice', () => {
    const order = Order.create(validProps).value!;
    const added = order.addItem({ productId: 'prod-1', quantity: 1, unitPrice: -5 });
    expect(added.success).toBe(false);
  });

  it('removes items and recalculates total', () => {
    const order = Order.create(validProps).value!
      .addItem(sampleItem).value!
      .addItem({ productId: 'prod-2', quantity: 1, unitPrice: 5 }).value!;
    const removed = order.removeItem('prod-1');
    expect(removed.success).toBe(true);
    if (removed.success) {
      expect(removed.value.totalAmount).toBe(5);
    }
  });

  it('fails to confirm empty order', () => {
    const order = Order.create(validProps).value!;
    const confirmed = order.confirm();
    expect(confirmed.success).toBe(false);
  });

  it('confirms order with items', () => {
    const order = Order.create(validProps).value!.addItem(sampleItem).value!;
    const confirmed = order.confirm();
    expect(confirmed.success).toBe(true);
    if (confirmed.success) {
      expect(confirmed.value.status).toBe(OrderStatus.CONFIRMED);
    }
  });

  it('transitions CONFIRMED → SENT_TO_KITCHEN', () => {
    const order = Order.create(validProps).value!.addItem(sampleItem).value!.confirm().value!;
    const sent = order.sendToKitchen();
    expect(sent.success).toBe(true);
    if (sent.success) {
      expect(sent.value.status).toBe(OrderStatus.SENT_TO_KITCHEN);
    }
  });

  it('transitions SENT_TO_KITCHEN → PREPARING', () => {
    const order = Order.create(validProps).value!.addItem(sampleItem).value!.confirm().value!.sendToKitchen().value!;
    const preparing = order.startPreparing();
    expect(preparing.success).toBe(true);
    if (preparing.success) {
      expect(preparing.value.status).toBe(OrderStatus.PREPARING);
    }
  });

  it('transitions PREPARING → READY', () => {
    const order = Order.create(validProps).value!.addItem(sampleItem).value!.confirm().value!.sendToKitchen().value!.startPreparing().value!;
    const ready = order.markReady();
    expect(ready.success).toBe(true);
    if (ready.success) {
      expect(ready.value.status).toBe(OrderStatus.READY);
    }
  });

  it('transitions READY → DELIVERED', () => {
    const order = Order.create(validProps).value!.addItem(sampleItem).value!.confirm().value!.sendToKitchen().value!.startPreparing().value!.markReady().value!;
    const delivered = order.deliver();
    expect(delivered.success).toBe(true);
    if (delivered.success) {
      expect(delivered.value.status).toBe(OrderStatus.DELIVERED);
    }
  });

  it('allows cancel from DRAFT', () => {
    const order = Order.create(validProps).value!;
    const cancelled = order.cancel();
    expect(cancelled.success).toBe(true);
    if (cancelled.success) {
      expect(cancelled.value.status).toBe(OrderStatus.CANCELLED);
    }
  });

  it('allows cancel from CONFIRMED', () => {
    const order = Order.create(validProps).value!.addItem(sampleItem).value!.confirm().value!;
    const cancelled = order.cancel();
    expect(cancelled.success).toBe(true);
  });

  it('fails to cancel DELIVERED order', () => {
    const order = Order.create(validProps).value!.addItem(sampleItem).value!.confirm().value!.sendToKitchen().value!.startPreparing().value!.markReady().value!.deliver().value!;
    const cancelled = order.cancel();
    expect(cancelled.success).toBe(false);
  });

  it('fails invalid transitions', () => {
    const order = Order.create(validProps).value!;
    expect(order.sendToKitchen().success).toBe(false);
    expect(order.startPreparing().success).toBe(false);
    expect(order.markReady().success).toBe(false);
    expect(order.deliver().success).toBe(false);
  });

  it('is immutable', () => {
    const order = Order.create(validProps).value!;
    order.confirm();
    expect(order.status).toBe(OrderStatus.DRAFT);
  });
});
