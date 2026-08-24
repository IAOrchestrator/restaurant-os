import { describe, it, expect, beforeEach } from 'vitest';
import {
  SendToKitchenUseCase,
  OccupyTableUseCase,
  type OrderRepository,
  type KitchenOrderRepository,
  type TableSessionRepository,
  type TableRepository,
  type ProductRepository,
  type EventPublisher,
} from '../src';
import {
  Order,
  KitchenOrder,
  Product,
  PreOrder,
  Table,
  TableSession,
  type DomainEvent,
} from '@restaurant-os/domain';

class InMemoryOrderRepo implements OrderRepository {
  public orders = new Map<string, Order>();
  async findById(id: string) { return this.orders.get(id) || null; }
  async save(order: Order) { this.orders.set(order.id, order); }
  async findByRestaurantId(restaurantId: string) { return Array.from(this.orders.values()).filter(o => o.restaurantId === restaurantId); }
  async findByTableSessionId(sessionId: string) { return Array.from(this.orders.values()).filter(o => o.tableSessionId === sessionId); }
  async findByCustomerId(customerId: string) { return Array.from(this.orders.values()).filter(o => o.customerId === customerId); }
  async findActiveByTableSessionId(sessionId: string) { return Array.from(this.orders.values()).filter(o => o.tableSessionId === sessionId && o.status !== 'CANCELLED' && o.status !== 'DELIVERED'); }
}

class InMemoryKitchenOrderRepo implements KitchenOrderRepository {
  public orders = new Map<string, KitchenOrder>();
  async findById(id: string) { return this.orders.get(id) || null; }
  async save(order: KitchenOrder) { this.orders.set(order.id, order); }
  async findByRestaurantId(restaurantId: string) { return Array.from(this.orders.values()).filter(o => o.restaurantId === restaurantId); }
  async findByOrderId(orderId: string) { return Array.from(this.orders.values()).find(o => o.orderId === orderId) || null; }
}

class InMemoryTableRepo implements TableRepository {
  public tables = new Map<string, Table>();
  async findById(id: string) { return this.tables.get(id) || null; }
  async save(table: Table) { this.tables.set(table.id, table); }
  async findByRestaurantId(restaurantId: string) { return Array.from(this.tables.values()).filter(t => t.restaurantId === restaurantId); }
  async findByNumber(restaurantId: string, number: number) { return Array.from(this.tables.values()).find(t => t.restaurantId === restaurantId && t.number === number) || null; }
}

class InMemorySessionRepo implements TableSessionRepository {
  public sessions = new Map<string, TableSession>();
  async findById(id: string) { return this.sessions.get(id) || null; }
  async save(session: TableSession) { this.sessions.set(session.id, session); }
  async findByRestaurantId(restaurantId: string) { return Array.from(this.sessions.values()).filter(s => s.restaurantId === restaurantId); }
  async findActiveByTableId(tableId: string) { return Array.from(this.sessions.values()).find(s => s.tableId === tableId && s.status !== 'CLOSED') || null; }
  async findByWaiterId(waiterId: string) { return Array.from(this.sessions.values()).filter(s => s.currentWaiterId === waiterId); }
}

class InMemoryProductRepo implements ProductRepository {
  public products = new Map<string, Product>();
  async findById(id: string) { return this.products.get(id) || null; }
  async save(product: Product) { this.products.set(product.id, product); }
  async findByRestaurantId(restaurantId: string) { return Array.from(this.products.values()).filter(p => p.restaurantId === restaurantId); }
  async findByCategoryId(categoryId: string) { return Array.from(this.products.values()).filter(p => p.categoryId === categoryId); }
}

class MockEventBus implements EventPublisher {
  public publishedEvents: DomainEvent[] = [];
  async publish(event: DomainEvent) { this.publishedEvents.push(event); }
  async publishAll(events: DomainEvent[]) { this.publishedEvents.push(...events); }
}

describe('Fase 2.5 — QR Visual & Scanner Lifecycle Integration Tests', () => {
  let orderRepo: InMemoryOrderRepo;
  let kitchenOrderRepo: InMemoryKitchenOrderRepo;
  let tableRepo: InMemoryTableRepo;
  let sessionRepo: InMemorySessionRepo;
  let productRepo: InMemoryProductRepo;
  let eventBus: MockEventBus;
  let sendToKitchenUseCase: SendToKitchenUseCase;
  let occupyTableUseCase: OccupyTableUseCase;

  const restaurantId = 'a0000000-0000-0000-0000-000000000001';
  const waiterId = 'w0000000-0000-0000-0000-000000000001';
  const customerId = 'c0000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    orderRepo = new InMemoryOrderRepo();
    kitchenOrderRepo = new InMemoryKitchenOrderRepo();
    tableRepo = new InMemoryTableRepo();
    sessionRepo = new InMemorySessionRepo();
    productRepo = new InMemoryProductRepo();
    eventBus = new MockEventBus();

    sendToKitchenUseCase = new SendToKitchenUseCase(
      orderRepo,
      eventBus,
      kitchenOrderRepo,
      sessionRepo,
      tableRepo,
      undefined,
      productRepo,
    );

    occupyTableUseCase = new OccupyTableUseCase(
      tableRepo,
      sessionRepo,
      eventBus,
    );

    // Setup Table 5
    const table5 = Table.create({
      id: 'tbl-5',
      restaurantId,
      number: 5,
      capacity: 4,
    }).value;
    await tableRepo.save(table5);

    // Setup Products
    const prodMuzza = Product.create({
      id: 'prod-muzza',
      restaurantId,
      categoryId: 'cat-pizzas',
      name: 'Pizza Muzzarella',
      price: 12000,
      sectorKDS: 'PIZZAS',
    }).value;
    await productRepo.save(prodMuzza);
  });

  it('1. Cliente genera Pre-Orden #P-12: Posee QR Vivo único que transiciona a CONFIRMED/CONSUMED al sentarse en mesa', async () => {
    let preOrder = PreOrder.create({
      id: 'pre-12',
      restaurantId,
      customerId,
      items: [{ productId: 'prod-muzza', quantity: 2 }],
    }).value;

    expect(preOrder.status).toBe('DRAFT');

    // Customer confirms / is seated
    const confirmResult = preOrder.confirm();
    expect(confirmResult.success).toBe(true);
    preOrder = confirmResult.value;
    expect(preOrder.status).toBe('CONFIRMED');

    // Trying to re-confirm fails (QR is dead/consumed)
    const secondConfirm = preOrder.confirm();
    expect(secondConfirm.success).toBe(false);
  });

  it('2. Recepción escanea QR #P-12: Ejecuta OccupyTable ocupando Mesa 5 e invalidando estado previo', async () => {
    // Create initial table session
    const session = TableSession.create({
      id: 'sess-5',
      restaurantId,
      tableId: 'tbl-5',
      initialWaiterId: waiterId,
      customerIds: [customerId],
    }).value;
    await sessionRepo.save(session);

    const res = await occupyTableUseCase.execute({
      tableId: 'tbl-5',
      sessionId: 'sess-5',
    });

    expect(res.success).toBe(true);
    const updatedTable = await tableRepo.findById('tbl-5');
    expect(updatedTable?.status).toBe('OCCUPIED');

    const activeSession = await sessionRepo.findActiveByTableId('tbl-5');
    expect(activeSession).toBeDefined();
    expect(activeSession?.customerIds).toContain(customerId);
  });

  it('3. Caja escanea QR #L-45 (Takeaway) tras pago: Despacha automáticamente a Cocina KDS con ticket independiente', async () => {
    const takeawayOrder = Order.create({
      id: 'ord-takeaway-45',
      restaurantId,
      tableSessionId: 'sess-takeaway',
      customerId,
      type: 'TAKEAWAY',
      isPaid: true, // Marked paid in Cashier
      items: [
        {
          productId: 'prod-muzza',
          quantity: 1,
          unitPrice: 12000,
        },
      ],
    }).value;
    await orderRepo.save(takeawayOrder);

    const dispatchRes = await sendToKitchenUseCase.execute({
      orderId: 'ord-takeaway-45',
      isPaymentTriggered: true,
    });

    expect(dispatchRes.success).toBe(true);
    expect(dispatchRes.value.status).toBe('SENT_TO_KITCHEN');
    expect(eventBus.publishedEvents.some((e) => e.type === 'ORDER_SENT_TO_KITCHEN')).toBe(true);
  });
});
