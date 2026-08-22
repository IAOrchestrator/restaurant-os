import { describe, it, expect } from 'vitest';
import { KitchenOrder, KitchenOrderStatus, KitchenDomainError } from '../src/kitchen';

describe('KitchenOrder', () => {
  it('should create a kitchen order', () => {
    const result = KitchenOrder.create({
      id: 'ko-1',
      restaurantId: 'rest-1',
      orderId: 'order-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(KitchenOrderStatus.RECEIVED);
      expect(result.value.priority).toBe(0);
    }
  });

  it('should transition from RECEIVED to STARTED', () => {
    const created = KitchenOrder.create({ id: 'ko-1', restaurantId: 'rest-1', orderId: 'order-1' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const started = created.value.start();
    expect(started.success).toBe(true);
    if (started.success) {
      expect(started.value.status).toBe(KitchenOrderStatus.STARTED);
      expect(started.value.startedAt).not.toBeNull();
    }
  });

  it('should transition through all states', () => {
    const created = KitchenOrder.create({ id: 'ko-1', restaurantId: 'rest-1', orderId: 'order-1' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    let order = created.value;
    order = order.start().value!;
    order = order.markNearlyReady().value!;
    order = order.markReady().value!;
    order = order.complete().value!;

    expect(order.status).toBe(KitchenOrderStatus.COMPLETED);
    expect(order.completedAt).not.toBeNull();
  });

  it('should reject invalid transitions', () => {
    const created = KitchenOrder.create({ id: 'ko-1', restaurantId: 'rest-1', orderId: 'order-1' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const ready = created.value.markReady();
    expect(ready.success).toBe(false);
    if (!ready.success) {
      expect(ready.error).toBeInstanceOf(KitchenDomainError);
    }
  });

  it('should track preparation time', () => {
    const created = KitchenOrder.create({ id: 'ko-1', restaurantId: 'rest-1', orderId: 'order-1' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    let order = created.value;
    order = order.start().value!;
    order = order.markReady().value!;

    expect(order.preparationTimeMs).not.toBeNull();
    expect(order.preparationTimeMs! >= 0).toBe(true);
  });

  it('should support priority changes', () => {
    const created = KitchenOrder.create({ id: 'ko-1', restaurantId: 'rest-1', orderId: 'order-1' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const updated = created.value.setPriority(5);
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.value.priority).toBe(5);
    }
  });

  it('should support assignment', () => {
    const created = KitchenOrder.create({ id: 'ko-1', restaurantId: 'rest-1', orderId: 'order-1' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const assigned = created.value.assign('staff-1');
    expect(assigned.success).toBe(true);
    if (assigned.success) {
      expect(assigned.value.assignedTo).toBe('staff-1');
    }
  });

  it('should reject negative priority', () => {
    const created = KitchenOrder.create({ id: 'ko-1', restaurantId: 'rest-1', orderId: 'order-1' });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = created.value.setPriority(-1);
    expect(result.success).toBe(false);
  });
});
