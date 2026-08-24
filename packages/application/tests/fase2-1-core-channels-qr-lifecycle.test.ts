import { describe, it, expect } from 'vitest';
import {
  CreateOrderUseCase,
  SendToKitchenUseCase,
  type OrderRepository,
  type PreOrderRepository,
  type KitchenOrderRepository,
  type TableSessionRepository,
  type TableRepository,
  type EventPublisher,
} from '../src';
import {
  Order,
  OrderStatus,
  OrderType,
  PreOrder,
  PreOrderStatus,
  KitchenOrder,
  Table,
  TableSession,
  EventType,
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
  public preOrders = new Map<string, PreOrder>();
  async findById(id: string) { return this.preOrders.get(id) ?? null; }
  async findByRestaurantId(restaurantId: string) {
    return Array.from(this.preOrders.values()).filter((p) => p.restaurantId === restaurantId);
  }
  async findByCustomerId(customerId: string) {
    return Array.from(this.preOrders.values()).filter((p) => p.customerId === customerId);
  }
  async save(preOrder: PreOrder) { this.preOrders.set(preOrder.id, preOrder); }
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

class InMemoryEventPublisher implements EventPublisher {
  public events: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('Fase 2.1 — Núcleo de Canales y QR Vivo Único', () => {
  const restaurantId = 'rest-001';
  const customerId = 'cust-001';
  const sessionId = 'session-001';

  it('1. Pre-orden #P-12 (qr_abc123) editable en INTENT/DRAFT', async () => {
    const preOrderRepo = new InMemoryPreOrderRepo();
    const created = PreOrder.create({
      id: 'pre-12',
      restaurantId,
      customerId,
      items: [{ productId: 'prod-muzza', quantity: 1 }],
    });

    expect(created.success).toBe(true);
    const preOrder = created.value;
    expect(preOrder.status).toBe(PreOrderStatus.DRAFT);
    await preOrderRepo.save(preOrder);

    const retrieved = await preOrderRepo.findById('pre-12');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.items.length).toBe(1);
  });

  it('2. Al convertir #P-12 a M5 en salón (DINE_IN), el QR previo muere atómicamente y la comanda sale a cocina sin pago', async () => {
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const kitchenRepo = new InMemoryKitchenOrderRepo();
    const sessionRepo = new InMemorySessionRepo();
    const tableRepo = new InMemoryTableRepo();
    const publisher = new InMemoryEventPublisher();

    // Crear Pre-Order
    const preOrder = PreOrder.create({
      id: 'pre-12',
      restaurantId,
      customerId,
      items: [{ productId: 'prod-muzza', quantity: 1 }],
    }).value;
    await preOrderRepo.save(preOrder);

    // Crear Comanda de Salón vinculada a pre-orden
    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const createRes = await createOrderUseCase.execute({
      id: 'order-m5-01',
      restaurantId,
      tableSessionId: sessionId,
      customerId,
      preOrderId: 'pre-12',
      type: 'DINE_IN',
      items: [{ productId: 'prod-muzza', quantity: 1, unitPrice: 8000 }],
    });

    expect(createRes.success).toBe(true);
    const order = createRes.value;
    expect(order.type).toBe('DINE_IN');
    expect(order.status).toBe(OrderStatus.CONFIRMED);

    // Verificar que el PreOrder anterior murió (status CONFIRMED/CONSUMED)
    const updatedPre = await preOrderRepo.findById('pre-12');
    expect(updatedPre?.status).toBe(PreOrderStatus.CONFIRMED);

    // Mozo envía a cocina: DINE_IN comanda se despacha de inmediato a cocina sin esperar pago
    const sendUseCase = new SendToKitchenUseCase(orderRepo, publisher, kitchenRepo, sessionRepo, tableRepo);
    const sendRes = await sendUseCase.execute({
      orderId: order.id,
      actorType: ActorType.STAFF,
      actorId: 'mozo-01',
    });

    expect(sendRes.success).toBe(true);
    expect(sendRes.value.status).toBe(OrderStatus.SENT_TO_KITCHEN);
    const kitchenOrder = await kitchenRepo.findByOrderId(order.id);
    expect(kitchenOrder).not.toBeNull();
  });

  it('3. PEDIDO TAKEAWAY / DELIVERY no puede enviarse a KDS sin estar PAGADO previamente', async () => {
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const kitchenRepo = new InMemoryKitchenOrderRepo();
    const publisher = new InMemoryEventPublisher();

    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const createRes = await createOrderUseCase.execute({
      id: 'order-takeaway-45',
      restaurantId,
      tableSessionId: sessionId,
      customerId,
      type: 'TAKEAWAY',
      items: [{ productId: 'prod-muzza', quantity: 1, unitPrice: 8000 }],
    });

    expect(createRes.success).toBe(true);
    const takeawayOrder = createRes.value;
    expect(takeawayOrder.type).toBe('TAKEAWAY');
    expect(takeawayOrder.isPaid).toBe(false);

    // Intentar enviar a cocina antes de pagar: DEBE SER RECHAZADO
    const sendUseCase = new SendToKitchenUseCase(orderRepo, publisher, kitchenRepo);
    const sendRes = await sendUseCase.execute({
      orderId: takeawayOrder.id,
    });

    expect(sendRes.success).toBe(false);
    expect(sendRes.error?.message).toContain('PAGADO');

    // KDS no debe contener esta orden
    const kitchenOrder = await kitchenRepo.findByOrderId(takeawayOrder.id);
    expect(kitchenOrder).toBeNull();
  });

  it('4. PEDIDO TAKEAWAY tras recibir pago (isPaymentTriggered) se despacha con éxito a KDS', async () => {
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const kitchenRepo = new InMemoryKitchenOrderRepo();
    const publisher = new InMemoryEventPublisher();

    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const createRes = await createOrderUseCase.execute({
      id: 'order-takeaway-45',
      restaurantId,
      tableSessionId: sessionId,
      customerId,
      type: 'TAKEAWAY',
      items: [{ productId: 'prod-muzza', quantity: 1, unitPrice: 8000 }],
    });

    const takeawayOrder = createRes.value;

    // Caja registra el pago -> dispara el envío a KDS
    const sendUseCase = new SendToKitchenUseCase(orderRepo, publisher, kitchenRepo);
    const sendRes = await sendUseCase.execute({
      orderId: takeawayOrder.id,
      isPaymentTriggered: true,
      actorType: ActorType.STAFF,
      actorId: 'caja-01',
    });

    expect(sendRes.success).toBe(true);
    expect(sendRes.value.status).toBe(OrderStatus.SENT_TO_KITCHEN);
    expect(sendRes.value.isPaid).toBe(true);

    const kitchenOrder = await kitchenRepo.findByOrderId(takeawayOrder.id);
    expect(kitchenOrder).not.toBeNull();
  });
});
