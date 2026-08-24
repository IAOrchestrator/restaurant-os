import { describe, it, expect } from 'vitest';
import {
  CreateOrderUseCase,
  SendToKitchenUseCase,
  CloseTableSessionUseCase,
  CreateTableSessionUseCase,
  RegisterPaymentUseCase,
  CloseAccountUseCase,
  AddOrderToAccountUseCase,
  CreateAccountUseCase,
  type OrderRepository,
  type PreOrderRepository,
  type KitchenOrderRepository,
  type TableSessionRepository,
  type TableRepository,
  type ProductRepository,
  type AccountRepository,
  type EventPublisher,
} from '../src';
import {
  Order,
  KitchenOrder,
  Product,
  Table,
  TableSession,
  BillingAccount,
  ActorType,
  type DomainEvent,
} from '@restaurant-os/domain';

class InMemoryOrderRepo implements OrderRepository {
  public orders = new Map<string, Order>();
  async findById(id: string) { return this.orders.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.orders.values()).filter((o) => o.restaurantId === restaurantId);
  }
  async findByTableSessionId(sessionId: string) {
    return Array.from(this.orders.values()).filter((o) => o.tableSessionId === sessionId);
  }
  async save(order: Order) { this.orders.set(order.id, order); }
  async delete(id: string) { this.orders.delete(id); }
}

class InMemoryPreOrderRepo implements PreOrderRepository {
  public preOrders = new Map<string, any>();
  async findById(id: string) { return this.preOrders.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.preOrders.values()).filter((p) => p.restaurantId === restaurantId);
  }
  async findByCustomerId(customerId: string) {
    return Array.from(this.preOrders.values()).filter((p) => p.customerId === customerId);
  }
  async save(preOrder: any) { this.preOrders.set(preOrder.id, preOrder); }
  async delete(id: string) { this.preOrders.delete(id); }
}

class InMemoryKitchenOrderRepo implements KitchenOrderRepository {
  public kitchenOrders = new Map<string, KitchenOrder>();
  async findById(id: string) { return this.kitchenOrders.get(id) ?? null; }
  async findByOrderId(orderId: string) {
    return Array.from(this.kitchenOrders.values()).find((k) => k.orderId === orderId) ?? null;
  }
  async findByRestaurantId(restaurantId: string, status?: string) {
    return Array.from(this.kitchenOrders.values()).filter(
      (k) => k.restaurantId === restaurantId && (!status || k.status === status),
    );
  }
  async findByAssignedTo(staffId: string) {
    return Array.from(this.kitchenOrders.values()).filter((k) => k.assignedTo === staffId);
  }
  async save(ko: KitchenOrder) { this.kitchenOrders.set(ko.id, ko); }
  async delete(id: string) { this.kitchenOrders.delete(id); }
}

class InMemoryProductRepo implements ProductRepository {
  public products = new Map<string, Product>();
  async findById(id: string) { return this.products.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.products.values()).filter((p) => p.restaurantId === restaurantId);
  }
  async findByCategoryId(categoryId: string) {
    return Array.from(this.products.values()).filter((p) => p.categoryId === categoryId);
  }
  async save(product: Product) { this.products.set(product.id, product); }
  async delete(id: string) { this.products.delete(id); }
}

class InMemoryTableRepo implements TableRepository {
  public tables = new Map<string, Table>();
  async findById(id: string) { return this.tables.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.tables.values()).filter((t) => t.restaurantId === restaurantId);
  }
  async save(table: Table) { this.tables.set(table.id, table); }
  async delete(id: string) { this.tables.delete(id); }
}

class InMemorySessionRepo implements TableSessionRepository {
  public sessions = new Map<string, TableSession>();
  async findById(id: string) { return this.sessions.get(id) ?? null; }
  async findActiveByTableId(tableId: string) {
    return Array.from(this.sessions.values()).find((s) => s.tableId === tableId && s.status !== 'CLOSED') ?? null;
  }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.sessions.values()).filter((s) => s.restaurantId === restaurantId);
  }
  async save(session: TableSession) { this.sessions.set(session.id, session); }
}

class InMemoryAccountRepo implements AccountRepository {
  public accounts = new Map<string, BillingAccount>();
  async findById(id: string) { return this.accounts.get(id) ?? null; }
  async findByTableSessionId(sessionId: string) {
    return Array.from(this.accounts.values()).find((a) => a.tableSessionId === sessionId) ?? null;
  }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.accounts.values()).filter((a) => a.restaurantId === restaurantId);
  }
  async save(account: BillingAccount) { this.accounts.set(account.id, account); }
  async delete(id: string) { this.accounts.delete(id); }
}

class InMemoryEventPublisher implements EventPublisher {
  public events: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('Fase 2.3 — Salón 30 Mesas y Lock Central de Caja', () => {
  const restaurantId = 'rest-salon-30';

  it('1. Inicializa y gestiona el plano completo de 30 mesas del salón', async () => {
    const tableRepo = new InMemoryTableRepo();

    // Crear 30 mesas
    for (let i = 1; i <= 30; i++) {
      const table = Table.create({
        id: `tbl-${i}`,
        restaurantId,
        number: i,
        capacity: i % 2 === 0 ? 4 : 2,
      }).value;
      await tableRepo.save(table);
    }

    const allTables = await tableRepo.findByRestaurantId(restaurantId);
    expect(allTables.length).toBe(30);
    expect(allTables.filter((t) => t.status === 'AVAILABLE').length).toBe(30);
  });

  it('2. El Mozo PUEDE liberar/cancelar una mesa si NO HUBO consumición (el cliente se retira)', async () => {
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const orderRepo = new InMemoryOrderRepo();
    const publisher = new InMemoryEventPublisher();

    const table = Table.create({ id: 'tbl-5', restaurantId, number: 5, capacity: 4 }).value;
    await tableRepo.save(table);

    const createSessionUseCase = new CreateTableSessionUseCase(tableRepo, sessionRepo, publisher);
    const sessionRes = await createSessionUseCase.execute({
      tableId: 'tbl-5',
      restaurantId,
      initialWaiterId: 'waiter-mateo',
    });
    expect(sessionRes.success).toBe(true);

    // Mesa ocupada
    const occupiedTable = await tableRepo.findById('tbl-5');
    expect(occupiedTable?.status).toBe('OCCUPIED');

    // Mozo decide liberar porque el comensal se retiró sin consumir
    const closeSessionUseCase = new CloseTableSessionUseCase(tableRepo, sessionRepo, publisher, orderRepo);
    const closeRes = await closeSessionUseCase.execute({
      sessionId: sessionRes.value.id,
      actorType: ActorType.STAFF,
      actorId: 'waiter-mateo',
      onlyIfNoConsumption: true,
    });

    expect(closeRes.success).toBe(true);
    expect(closeRes.value.status).toBe('CLOSED');

    const releasedTable = await tableRepo.findById('tbl-5');
    expect(releasedTable?.status).toBe('AVAILABLE');
  });

  it('3. El Mozo NO PUEDE liberar mesa si posee consumición registrada: el cobro y cierre debe realizarse desde Caja', async () => {
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const productRepo = new InMemoryProductRepo();
    const publisher = new InMemoryEventPublisher();

    const table = Table.create({ id: 'tbl-5', restaurantId, number: 5, capacity: 4 }).value;
    await tableRepo.save(table);

    await productRepo.save(
      Product.create({
        id: 'prod-muzza',
        restaurantId,
        categoryId: 'cat-pizzas',
        name: 'Pizza Muzzarella',
        price: 8500,
      }).value,
    );

    const createSessionUseCase = new CreateTableSessionUseCase(tableRepo, sessionRepo, publisher);
    const sessionRes = await createSessionUseCase.execute({
      tableId: 'tbl-5',
      restaurantId,
      initialWaiterId: 'waiter-mateo',
    });

    // Registrar comanda con consumo en la mesa
    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    await createOrderUseCase.execute({
      id: 'order-m5-01',
      restaurantId,
      tableSessionId: sessionRes.value.id,
      type: 'DINE_IN',
      items: [{ productId: 'prod-muzza', quantity: 1, unitPrice: 8500 }],
    });

    // Mozo intenta liberar directamente -> Debe ser rechazado
    const closeSessionUseCase = new CloseTableSessionUseCase(tableRepo, sessionRepo, publisher, orderRepo);
    const closeRes = await closeSessionUseCase.execute({
      sessionId: sessionRes.value.id,
      actorType: ActorType.STAFF,
      actorId: 'waiter-mateo',
      onlyIfNoConsumption: true,
    });

    expect(closeRes.success).toBe(false);
    expect(closeRes.error?.message).toContain('No se puede liberar la mesa: posee pedidos registrados');

    // La mesa permanece ocupada
    const currentTable = await tableRepo.findById('tbl-5');
    expect(currentTable?.status).not.toBe('AVAILABLE');
  });

  it('4. Lock Central de Caja: Al registrar el cobro total en Caja, se cierra la cuenta y se libera la mesa (MESAS_LIBRES: 30/30)', async () => {
    const tableRepo = new InMemoryTableRepo();
    const sessionRepo = new InMemorySessionRepo();
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const accountRepo = new InMemoryAccountRepo();
    const publisher = new InMemoryEventPublisher();

    const table = Table.create({ id: 'tbl-5', restaurantId, number: 5, capacity: 4 }).value;
    await tableRepo.save(table);

    const createSessionUseCase = new CreateTableSessionUseCase(tableRepo, sessionRepo, publisher);
    const sessionRes = await createSessionUseCase.execute({
      tableId: 'tbl-5',
      restaurantId,
      initialWaiterId: 'waiter-mateo',
    });

    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const ordRes = await createOrderUseCase.execute({
      id: 'order-m5-01',
      restaurantId,
      tableSessionId: sessionRes.value.id,
      type: 'DINE_IN',
      items: [{ productId: 'prod-muzza', quantity: 2, unitPrice: 8500 }],
    });

    // Crear cuenta en Caja y vincular comanda
    const createAccUseCase = new CreateAccountUseCase(accountRepo, publisher);
    const accRes = await createAccUseCase.execute({
      restaurantId,
      tableSessionId: sessionRes.value.id,
    });

    const addOrderUseCase = new AddOrderToAccountUseCase(accountRepo, orderRepo, publisher);
    await addOrderUseCase.execute({
      accountId: accRes.value.id,
      orderId: ordRes.value.id,
    });

    // Registrar pago completo en Caja ($17,000)
    const payUseCase = new RegisterPaymentUseCase(accountRepo, publisher);
    const payRes = await payUseCase.execute({
      accountId: accRes.value.id,
      amount: 17000,
      method: 'CASH',
    });
    expect(payRes.success).toBe(true);

    // Caja cierra cuenta
    const closeAccUseCase = new CloseAccountUseCase(accountRepo, publisher);
    const closeAccRes = await closeAccUseCase.execute({ accountId: accRes.value.id });
    expect(closeAccRes.success).toBe(true);

    // Caja libera la mesa
    const closeSessionUseCase = new CloseTableSessionUseCase(tableRepo, sessionRepo, publisher, orderRepo);
    const closeSessionRes = await closeSessionUseCase.execute({
      sessionId: sessionRes.value.id,
      actorType: ActorType.STAFF,
      actorId: 'cajero-01',
      onlyIfNoConsumption: false, // Caja tiene permiso de cierre
    });
    expect(closeSessionRes.success).toBe(true);

    const freedTable = await tableRepo.findById('tbl-5');
    expect(freedTable?.status).toBe('AVAILABLE');
  });
});
