import { describe, it, expect } from 'vitest';
import { ServiceTask, ServiceTaskStatus, ServiceTaskType, ServiceDomainError } from '../src/service';

describe('ServiceTask', () => {
  it('should create a service task', () => {
    const result = ServiceTask.create({
      id: 'st-1',
      restaurantId: 'rest-1',
      type: ServiceTaskType.TAKE_ORDER,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.status).toBe(ServiceTaskStatus.PENDING);
      expect(result.value.type).toBe(ServiceTaskType.TAKE_ORDER);
    }
  });

  it('should transition from PENDING to COMPLETED', () => {
    const created = ServiceTask.create({ id: 'st-1', restaurantId: 'rest-1', type: ServiceTaskType.SERVE_FOOD });
    expect(created.success).toBe(true);
    if (!created.success) return;

    let task = created.value;
    task = task.assign('waiter-1').value!;
    task = task.start().value!;
    task = task.complete().value!;

    expect(task.status).toBe(ServiceTaskStatus.COMPLETED);
    expect(task.responseTimeMs).not.toBeNull();
    expect(task.completionTimeMs).not.toBeNull();
  });

  it('should reject invalid transitions', () => {
    const created = ServiceTask.create({ id: 'st-1', restaurantId: 'rest-1', type: ServiceTaskType.CLEAN_TABLE });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const complete = created.value.complete();
    expect(complete.success).toBe(false);
  });

  it('should support cancellation', () => {
    const created = ServiceTask.create({ id: 'st-1', restaurantId: 'rest-1', type: ServiceTaskType.CHECK_ACCOUNT });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const cancelled = created.value.cancel();
    expect(cancelled.success).toBe(true);
    if (cancelled.success) {
      expect(cancelled.value.status).toBe(ServiceTaskStatus.CANCELLED);
    }
  });

  it('should track service times', () => {
    const created = ServiceTask.create({ id: 'st-1', restaurantId: 'rest-1', type: ServiceTaskType.DELIVER_ORDER });
    expect(created.success).toBe(true);
    if (!created.success) return;

    let task = created.value;
    task = task.assign('waiter-1').value!;
    task = task.start().value!;
    task = task.complete().value!;

    expect(task.totalServiceTimeMs).not.toBeNull();
    expect(task.totalServiceTimeMs! >= 0).toBe(true);
  });

  it('should reject empty restaurantId', () => {
    const result = ServiceTask.create({ id: 'st-1', restaurantId: '', type: ServiceTaskType.TAKE_ORDER });
    expect(result.success).toBe(false);
  });

  it('should support all task types', () => {
    const types = Object.values(ServiceTaskType);
    expect(types).toHaveLength(6);
    expect(types).toContain(ServiceTaskType.TAKE_ORDER);
    expect(types).toContain(ServiceTaskType.CUSTOMER_REQUEST);
  });
});
