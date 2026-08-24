import { describe, it, expect } from 'vitest';
import {
  EventType,
  ActorType,
  type DomainEvent,
  Table,
  TableSession,
  TableSessionStatus,
  Order,
  Account,
  WaitlistEntry,
  ServiceTask,
  TableDevice,
  Review,
  PreOrder,
  KitchenOrder,
} from '@restaurant-os/domain';
import {
  CreateTableSessionUseCase,
  CloseTableSessionUseCase,
  ChangeWaiterUseCase,
  AddCustomerToSessionUseCase,
  RemoveCustomerFromSessionUseCase,
  CreateOrderUseCase,
  CancelOrderUseCase,
  JoinWaitlistUseCase,
  CallCustomerUseCase,
  ConfirmCustomerUseCase,
  SeatCustomerUseCase,
  CancelWaitlistUseCase,
  SelectTakeawayUseCase,
  CreateAccountUseCase,
  RequestPaymentUseCase,
  RegisterPaymentUseCase,
  AddOrderToAccountUseCase,
  CreateServiceTaskUseCase,
  RegisterTableDeviceUseCase,
  AssociateTableDeviceUseCase,
  DisassociateTableDeviceUseCase,
  CreateReviewUseCase,
  CreatePreOrderUseCase,
  ConfirmPreOrderUseCase,
  CancelPreOrderUseCase,
  CreateKitchenOrderUseCase,
  AssignKitchenOrderUseCase,
  MarkNearlyReadyUseCase,
  CompleteKitchenOrderUseCase,
  AssignTableUseCase,
  OccupyTableUseCase,
  type EventPublisher,
  type TableRepository,
  type TableSessionRepository,
  type OrderRepository,
  type PreOrderRepository,
  type AccountRepository,
  type WaitlistRepository,
  type ServiceTaskRepository,
  type TableDeviceRepository,
  type ReviewRepository,
  type KitchenOrderRepository,
} from '../src';

class MockDomainEventPublisher implements EventPublisher {
  public domainEvents: DomainEvent[] = [];
  public rawEvents: Array<{ type: string; payload: any }> = [];

  async publish(eventOrType: any, payload?: any): Promise<void> {
    if (typeof eventOrType === 'object' && eventOrType !== null && 'type' in eventOrType) {
      this.domainEvents.push(eventOrType);
    } else {
      this.rawEvents.push({ type: eventOrType, payload });
    }
  }
}

describe('Canonical DomainEvent<T> Standardization (Step 2.1)', () => {
  const REST_ID = '550e8400-e29b-41d4-a716-446655440001';

  it('CreateTableSessionUseCase publishes canonical TABLE_ASSIGNED event', async () => {
    const publisher = new MockDomainEventPublisher();
    const table = Table.create({ id: 't-1', restaurantId: REST_ID, number: 5, capacity: 4 }).value!;
    const tableRepo: TableRepository = {
      findById: async () => table,
      findByNumber: async () => table,
      findByRestaurantId: async () => [table],
      save: async () => {},
    };
    const sessionRepo: TableSessionRepository = {
      findById: async () => null,
      findActiveByTableId: async () => null,
      findByRestaurantId: async () => [],
      save: async () => {},
    };

    const useCase = new CreateTableSessionUseCase(tableRepo, sessionRepo, publisher);
    const res = await useCase.execute({
      id: 'session-1',
      restaurantId: REST_ID,
      tableId: 't-1',
      initialWaiterId: 'waiter-1',
      actorType: ActorType.STAFF,
      actorId: 'host-1',
    });

    expect(res.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(1);
    expect(publisher.rawEvents).toHaveLength(0);

    const event = publisher.domainEvents[0];
    expect(event.type).toBe(EventType.TABLE_ASSIGNED);
    expect(event.restaurantId).toBe(REST_ID);
    expect(event.aggregateType).toBe('TableSession');
    expect(event.aggregateId).toBe('session-1');
    expect(event.tableId).toBe('t-1');
    expect(event.tableNumber).toBe(5);
    expect(event.actorType).toBe(ActorType.STAFF);
    expect(event.actorId).toBe('host-1');
    expect(event.payload.waiterId).toBe('waiter-1');
  });

  it('CloseTableSessionUseCase publishes canonical TABLE_CLOSED and TABLE_RELEASED events', async () => {
    const publisher = new MockDomainEventPublisher();
    const table = Table.create({ id: 't-1', restaurantId: REST_ID, number: 5, capacity: 4 }).value!.occupy().value!;
    const session = TableSession.create({ id: 'session-1', restaurantId: REST_ID, tableId: 't-1' }).value!.occupy().value!.open().value!;

    const tableRepo: TableRepository = {
      findById: async () => table,
      findByNumber: async () => table,
      findByRestaurantId: async () => [table],
      save: async () => {},
    };
    const sessionRepo: TableSessionRepository = {
      findById: async () => session,
      findActiveByTableId: async () => session,
      findByRestaurantId: async () => [session],
      save: async () => {},
    };

    const useCase = new CloseTableSessionUseCase(tableRepo, sessionRepo, publisher);
    const res = await useCase.execute({ sessionId: 'session-1', actorType: ActorType.STAFF, actorId: 'waiter-1' });

    expect(res.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(2);
    expect(publisher.rawEvents).toHaveLength(0);

    expect(publisher.domainEvents[0].type).toBe(EventType.TABLE_CLOSED);
    expect(publisher.domainEvents[0].aggregateType).toBe('TableSession');
    expect(publisher.domainEvents[0].aggregateId).toBe('session-1');

    expect(publisher.domainEvents[1].type).toBe(EventType.TABLE_RELEASED);
    expect(publisher.domainEvents[1].aggregateType).toBe('Table');
    expect(publisher.domainEvents[1].aggregateId).toBe('t-1');
  });

  it('CreateOrderUseCase publishes canonical ORDER_CONFIRMED event', async () => {
    const publisher = new MockDomainEventPublisher();
    const orderRepo: OrderRepository = {
      findById: async () => null,
      findByTableSessionId: async () => [],
      findByRestaurantId: async () => [],
      save: async () => {},
    };
    const preOrderRepo: PreOrderRepository = {
      findById: async () => null,
      findByCustomerId: async () => null,
      findByRestaurantId: async () => [],
      save: async () => {},
    };

    const useCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const res = await useCase.execute({
      id: 'order-1',
      restaurantId: REST_ID,
      tableSessionId: 'session-1',
      customerId: 'cust-1',
      items: [{ productId: 'p1', quantity: 2, unitPrice: 20 }],
    });

    expect(res.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(1);
    expect(publisher.rawEvents).toHaveLength(0);

    const event = publisher.domainEvents[0];
    expect(event.type).toBe(EventType.ORDER_CONFIRMED);
    expect(event.restaurantId).toBe(REST_ID);
    expect(event.aggregateType).toBe('Order');
    expect(event.aggregateId).toBe('order-1');
    expect(event.tableSessionId).toBe('session-1');
    expect(event.actorType).toBe(ActorType.CUSTOMER);
    expect(event.actorId).toBe('cust-1');
    expect(event.payload.totalAmount).toBe(40);
  });

  it('JoinWaitlistUseCase and CallCustomerUseCase publish canonical DomainEvents', async () => {
    const publisher = new MockDomainEventPublisher();
    let storedEntry: WaitlistEntry | null = null;
    const waitlistRepo: WaitlistRepository = {
      findById: async () => storedEntry,
      findActiveByCustomerId: async () => storedEntry,
      findByRestaurantId: async () => (storedEntry ? [storedEntry] : []),
      save: async (e) => { storedEntry = e; },
    };

    const joinUseCase = new JoinWaitlistUseCase(waitlistRepo, publisher);
    const joinRes = await joinUseCase.execute({
      id: 'w-1',
      restaurantId: REST_ID,
      customerId: 'cust-99',
      partySize: 3,
    });

    expect(joinRes.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(1);
    expect(publisher.domainEvents[0].type).toBe(EventType.CUSTOMER_JOINED_WAITLIST);
    expect(publisher.domainEvents[0].aggregateType).toBe('WaitlistEntry');
    expect(publisher.domainEvents[0].actorType).toBe(ActorType.CUSTOMER);

    const callUseCase = new CallCustomerUseCase(waitlistRepo, publisher);
    const callRes = await callUseCase.execute({ entryId: 'w-1', actorType: ActorType.STAFF, actorId: 'host-2' });

    expect(callRes.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(2);
    expect(publisher.domainEvents[1].type).toBe(EventType.CUSTOMER_CALLED);
    expect(publisher.domainEvents[1].actorType).toBe(ActorType.STAFF);
    expect(publisher.domainEvents[1].actorId).toBe('host-2');
  });

  it('RegisterPaymentUseCase and RequestPaymentUseCase publish canonical DomainEvents', async () => {
    const publisher = new MockDomainEventPublisher();
    let storedAccount = Account.create({ id: 'acc-1', restaurantId: REST_ID, tableSessionId: 'session-1' }).value!.addOrderAmount(100).value!;
    const accountRepo: AccountRepository = {
      findById: async () => storedAccount,
      findByTableSessionId: async () => storedAccount,
      findByRestaurantId: async () => [storedAccount],
      save: async (a) => { storedAccount = a; },
    };

    const requestUseCase = new RequestPaymentUseCase(accountRepo, publisher);
    const reqRes = await requestUseCase.execute({ accountId: 'acc-1' });
    expect(reqRes.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(1);
    expect(publisher.domainEvents[0].type).toBe(EventType.ACCOUNT_REQUESTED);

    const payUseCase = new RegisterPaymentUseCase(accountRepo, publisher);
    const payRes = await payUseCase.execute({
      accountId: 'acc-1',
      paymentId: 'pay-1',
      amount: 100,
      method: 'cash',
    });
    expect(payRes.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(2);
    expect(publisher.domainEvents[1].type).toBe(EventType.PAYMENT_REGISTERED);
    expect(publisher.domainEvents[1].payload.isFullyPaid).toBe(true);
  });

  it('CreateServiceTaskUseCase publishes canonical SERVICE_TASK_CREATED DomainEvent', async () => {
    const publisher = new MockDomainEventPublisher();
    const taskRepo: ServiceTaskRepository = {
      findById: async () => null,
      findByTableSessionId: async () => [],
      findByRestaurantId: async () => [],
      save: async () => {},
    };

    const useCase = new CreateServiceTaskUseCase(taskRepo, publisher);
    const res = await useCase.execute({
      id: 'task-1',
      restaurantId: REST_ID,
      tableSessionId: 'session-1',
      type: 'CALL_WAITER',
      notes: 'Need napkins',
    });

    expect(res.success).toBe(true);
    expect(publisher.domainEvents).toHaveLength(1);
    expect(publisher.domainEvents[0].type).toBe(EventType.SERVICE_TASK_CREATED);
    expect(publisher.domainEvents[0].aggregateType).toBe('ServiceTask');
    expect(publisher.domainEvents[0].tableSessionId).toBe('session-1');
  });

  it('TableDevice use cases publish canonical DomainEvents', async () => {
    const publisher = new MockDomainEventPublisher();
    let storedDevice: TableDevice | null = null;
    const deviceRepo: TableDeviceRepository = {
      findById: async () => storedDevice,
      findByTableId: async () => null,
      findByRestaurantId: async () => (storedDevice ? [storedDevice] : []),
      save: async (d) => { storedDevice = d; },
    };
    const table = Table.create({ id: 't-10', restaurantId: REST_ID, number: 10, capacity: 4 }).value!;
    const tableRepo: TableRepository = {
      findById: async () => table,
      findByNumber: async () => table,
      findByRestaurantId: async () => [table],
      save: async () => {},
    };

    const registerUseCase = new RegisterTableDeviceUseCase(deviceRepo, publisher);
    await registerUseCase.execute({ id: 'dev-1', restaurantId: REST_ID, name: 'Tablet 10' });
    expect(publisher.domainEvents).toHaveLength(1);
    expect(publisher.domainEvents[0].type).toBe(EventType.TABLE_DEVICE_REGISTERED);

    const assocUseCase = new AssociateTableDeviceUseCase(deviceRepo, tableRepo, publisher);
    await assocUseCase.execute({ deviceId: 'dev-1', tableId: 't-10' });
    expect(publisher.domainEvents).toHaveLength(2);
    expect(publisher.domainEvents[1].type).toBe(EventType.TABLE_DEVICE_ASSOCIATED);
    expect(publisher.domainEvents[1].tableId).toBe('t-10');
    expect(publisher.domainEvents[1].tableNumber).toBe(10);
  });
});
