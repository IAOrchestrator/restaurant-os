import { describe, it, expect, beforeEach } from 'vitest';
import {
  Table,
  TableSession,
  WaitlistEntry,
  KitchenOrder,
  Account,
  ServiceTask,
} from '@restaurant-os/domain';
import {
  GetLiveOperationsUseCase,
  TableRepository,
  TableSessionRepository,
  WaitlistRepository,
  KitchenOrderRepository,
  AccountRepository,
  ServiceTaskRepository,
} from '../src';

class MockTableRepo implements TableRepository {
  async findById() { return null; }
  async findByNumber() { return null; }
  async findByRestaurantId() {
    return [
      new Table({ id: 't1', restaurantId: 'r1', number: 1, capacity: 4 }),
      new Table({ id: 't2', restaurantId: 'r1', number: 2, capacity: 2 }),
    ];
  }
  async save() {}
  async delete() {}
}

class MockSessionRepo implements TableSessionRepository {
  async findById() { return null; }
  async findByTableId() { return null; }
  async findByRestaurantId() {
    const sessionResult = TableSession.create({
      id: 's1',
      restaurantId: 'r1',
      tableId: 't1',
      initialWaiterId: 'w1',
      openedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    });
    return sessionResult.success ? [sessionResult.value] : [];
  }
  async save() {}
  async delete() {}
}

class MockWaitlistRepo implements WaitlistRepository {
  async findById() { return null; }
  async findByRestaurantId() {
    const res = WaitlistEntry.create({
      id: 'wl-1',
      restaurantId: 'r1',
      customerId: 'c1',
      partySize: 2,
    });
    return res.success ? [res.value] : [];
  }
  async save() {}
  async delete() {}
}

class MockKitchenRepo implements KitchenOrderRepository {
  async findById() { return null; }
  async findByOrderId() { return null; }
  async findByRestaurantId() {
    const res = KitchenOrder.create({
      id: 'k1',
      restaurantId: 'r1',
      orderId: 'o1',
    });
    return res.success ? [res.value] : [];
  }
  async save() {}
  async delete() {}
}

class MockAccountRepo implements AccountRepository {
  async findById() { return null; }
  async findByTableSessionId() { return null; }
  async findByRestaurantId() {
    const accResult = Account.create({
      id: 'acc-1',
      restaurantId: 'r1',
      tableSessionId: 's1',
    });
    if (!accResult.success) return [];
    const acc = accResult.value;
    const paidAccResult = acc.registerPayment({
      id: 'p1',
      amount: 5000,
      method: 'CARD',
      registeredAt: new Date(),
    });
    return [paidAccResult.success ? paidAccResult.value : acc];
  }
  async save() {}
  async delete() {}
}

class MockTaskRepo implements ServiceTaskRepository {
  async findById() { return null; }
  async findByRestaurantId() {
    const res = ServiceTask.create({
      id: 'st-1',
      restaurantId: 'r1',
      type: 'CALL_WAITER',
    });
    return res.success ? [res.value] : [];
  }
  async save() {}
  async delete() {}
}

describe('GetLiveOperationsUseCase', () => {
  it('aggregates live metrics across salon, kitchen, waiters and financials', async () => {
    const useCase = new GetLiveOperationsUseCase(
      new MockTableRepo(),
      new MockSessionRepo(),
      new MockWaitlistRepo(),
      new MockKitchenRepo(),
      new MockAccountRepo(),
      new MockTaskRepo(),
    );

    const report = await useCase.execute('r1');

    expect(report.salon.totalTables).toBe(2);
    expect(report.salon.occupiedTables).toBe(1);
    expect(report.salon.occupancyRate).toBe(50);
    expect(report.salon.waitingCustomers).toBe(1);
    expect(report.salon.avgTableDurationMinutes).toBeGreaterThanOrEqual(29);

    expect(report.kitchen.pendingOrdersCount).toBe(1);
    expect(report.waiters.pendingServiceTasksCount).toBe(1);
    expect(report.financials.paymentMethodsBreakdown.card).toBe(5000);
  });
});
