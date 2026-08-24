import { describe, it, expect } from 'vitest';
import {
  CreateOrderUseCase,
  SendToKitchenUseCase,
  type OrderRepository,
  type PreOrderRepository,
  type KitchenOrderRepository,
  type TableSessionRepository,
  type TableRepository,
  type ProductRepository,
  type EventPublisher,
} from '../src';
import {
  Order,
  OrderStatus,
  KitchenOrder,
  Product,
  Table,
  TableSession,
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

class InMemoryEventPublisher implements EventPublisher {
  public events: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('Fase 2.2 — Fan-Out KDS por Sector & Batching', () => {
  const restaurantId = 'rest-001';
  const customerId = 'cust-001';
  const tableId = 'tbl-005';
  const sessionId = 'session-005';

  it('1. Define productos del menú con sectorKDS (PIZZAS, BEBIDAS, HELADOS, CAFE)', async () => {
    const prodMuzza = Product.create({
      id: 'prod-muzza',
      restaurantId,
      categoryId: 'cat-pizzas',
      name: 'Pizza Muzzarella',
      price: 8500,
      sectorKDS: 'PIZZAS',
    }).value;

    const prodCoca = Product.create({
      id: 'prod-coca',
      restaurantId,
      categoryId: 'cat-bebidas',
      name: 'Coca Cola 500ml',
      price: 2200,
      sectorKDS: 'BEBIDAS',
    }).value;

    const prodHelado = Product.create({
      id: 'prod-flan',
      restaurantId,
      categoryId: 'cat-postres',
      name: 'Flan con Dulce de Leche',
      price: 3500,
      sectorKDS: 'HELADOS',
    }).value;

    expect(prodMuzza.sectorKDS).toBe('PIZZAS');
    expect(prodCoca.sectorKDS).toBe('BEBIDAS');
    expect(prodHelado.sectorKDS).toBe('HELADOS');
  });

  it('2. Partición automática de comanda M5 en tickets independientes: T-M5-01-PIZZAS, T-M5-01-BEBIDAS y T-M5-01-HELADOS', async () => {
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const kitchenRepo = new InMemoryKitchenOrderRepo();
    const productRepo = new InMemoryProductRepo();
    const sessionRepo = new InMemorySessionRepo();
    const tableRepo = new InMemoryTableRepo();
    const publisher = new InMemoryEventPublisher();

    // Configurar Productos en Catálogo
    await productRepo.save(
      Product.create({
        id: 'prod-muzza',
        restaurantId,
        categoryId: 'cat-pizzas',
        name: 'Pizza Muzzarella',
        price: 8500,
        sectorKDS: 'PIZZAS',
      }).value,
    );
    await productRepo.save(
      Product.create({
        id: 'prod-coca',
        restaurantId,
        categoryId: 'cat-bebidas',
        name: 'Coca Cola 500ml',
        price: 2200,
        sectorKDS: 'BEBIDAS',
      }).value,
    );
    await productRepo.save(
      Product.create({
        id: 'prod-flan',
        restaurantId,
        categoryId: 'cat-postres',
        name: 'Flan Casero',
        price: 3500,
        sectorKDS: 'HELADOS',
      }).value,
    );

    // Configurar Mesa 5 y Sesión
    const table = Table.create({
      id: tableId,
      restaurantId,
      number: 5,
      capacity: 4,
    }).value;
    await tableRepo.save(table);

    const session = TableSession.create({
      id: sessionId,
      restaurantId,
      tableId,
    }).value;
    await sessionRepo.save(session);

    // Crear Comanda de Mesa 5 con 2 Muzzas, 2 Cocas y 1 Flan
    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const createRes = await createOrderUseCase.execute({
      id: 'order-m5-mix',
      restaurantId,
      tableSessionId: sessionId,
      customerId,
      type: 'DINE_IN',
      items: [
        { productId: 'prod-muzza', quantity: 2, unitPrice: 8500, notes: 'Bien crocante' },
        { productId: 'prod-coca', quantity: 2, unitPrice: 2200 },
        { productId: 'prod-flan', quantity: 1, unitPrice: 3500 },
      ],
    });

    expect(createRes.success).toBe(true);

    // Mozo envía a cocina con Fan-Out por Sector
    const sendUseCase = new SendToKitchenUseCase(
      orderRepo,
      publisher,
      kitchenRepo,
      sessionRepo,
      tableRepo,
      undefined,
      productRepo,
    );

    const sendRes = await sendUseCase.execute({
      orderId: 'order-m5-mix',
      actorType: ActorType.STAFF,
      actorId: 'mozo-01',
    });

    expect(sendRes.success).toBe(true);

    const kitchenOrder = await kitchenRepo.findByOrderId('order-m5-mix');
    expect(kitchenOrder).not.toBeNull();

    // Verificar metadata de tickets particionados
    const meta = JSON.parse(kitchenOrder!.notes || '{}');
    expect(meta.tickets).toBeDefined();
    expect(meta.tickets.length).toBe(3);

    const pizzaTicket = meta.tickets.find((t: any) => t.sector === 'PIZZAS');
    expect(pizzaTicket).toBeDefined();
    expect(pizzaTicket.ticketCode).toBe('T-M5-01-PIZZAS');
    expect(pizzaTicket.items[0].name).toBe('Pizza Muzzarella');
    expect(pizzaTicket.items[0].quantity).toBe(2);
    expect(pizzaTicket.items[0].notes).toBe('Bien crocante');

    const bebidaTicket = meta.tickets.find((t: any) => t.sector === 'BEBIDAS');
    expect(bebidaTicket).toBeDefined();
    expect(bebidaTicket.ticketCode).toBe('T-M5-01-BEBIDAS');
    expect(bebidaTicket.items[0].name).toBe('Coca Cola 500ml');
    expect(bebidaTicket.items[0].quantity).toBe(2);

    const heladoTicket = meta.tickets.find((t: any) => t.sector === 'HELADOS');
    expect(heladoTicket).toBeDefined();
    expect(heladoTicket.ticketCode).toBe('T-M5-01-HELADOS');
    expect(heladoTicket.items[0].name).toBe('Flan Casero');
    expect(heladoTicket.items[0].quantity).toBe(1);
  });

  it('3. Agrupación Batching en KDS: Si M5 pide 2 Muzzas y M2 pide 1 Muzza, el batch de PIZZAS suma 3x Muzzarella', async () => {
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const kitchenRepo = new InMemoryKitchenOrderRepo();
    const productRepo = new InMemoryProductRepo();
    const sessionRepo = new InMemorySessionRepo();
    const tableRepo = new InMemoryTableRepo();
    const publisher = new InMemoryEventPublisher();

    await productRepo.save(
      Product.create({
        id: 'prod-muzza',
        restaurantId,
        categoryId: 'cat-pizzas',
        name: 'Pizza Muzzarella',
        price: 8500,
        sectorKDS: 'PIZZAS',
      }).value,
    );

    // Mesa 5
    await tableRepo.save(Table.create({ id: 'tbl-005', restaurantId, number: 5, capacity: 4 }).value);
    await sessionRepo.save(TableSession.create({ id: 'sess-005', restaurantId, tableId: 'tbl-005' }).value);

    // Mesa 2
    await tableRepo.save(Table.create({ id: 'tbl-002', restaurantId, number: 2, capacity: 2 }).value);
    await sessionRepo.save(TableSession.create({ id: 'sess-002', restaurantId, tableId: 'tbl-002' }).value);

    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const sendUseCase = new SendToKitchenUseCase(
      orderRepo,
      publisher,
      kitchenRepo,
      sessionRepo,
      tableRepo,
      undefined,
      productRepo,
    );

    // Crear y enviar orden M5 (2x Muzza)
    await createOrderUseCase.execute({
      id: 'order-m5',
      restaurantId,
      tableSessionId: 'sess-005',
      type: 'DINE_IN',
      items: [{ productId: 'prod-muzza', quantity: 2, unitPrice: 8500 }],
    });
    await sendUseCase.execute({ orderId: 'order-m5' });

    // Crear y enviar orden M2 (1x Muzza)
    await createOrderUseCase.execute({
      id: 'order-m2',
      restaurantId,
      tableSessionId: 'sess-002',
      type: 'DINE_IN',
      items: [{ productId: 'prod-muzza', quantity: 1, unitPrice: 8500 }],
    });
    await sendUseCase.execute({ orderId: 'order-m2' });

    // Leer todas las órdenes de cocina activas y calcular batch de sector PIZZAS
    const activeKOs = await kitchenRepo.findByRestaurantId(restaurantId);
    expect(activeKOs.length).toBe(2);

    let totalMuzzaBatch = 0;
    for (const ko of activeKOs) {
      const meta = JSON.parse(ko.notes || '{}');
      const pizzaTicket = (meta.tickets || []).find((t: any) => t.sector === 'PIZZAS');
      if (pizzaTicket) {
        for (const it of pizzaTicket.items) {
          if (it.name === 'Pizza Muzzarella') {
            totalMuzzaBatch += it.quantity;
          }
        }
      }
    }

    expect(totalMuzzaBatch).toBe(3); // 2 de Mesa 5 + 1 de Mesa 2 = 3x Muzza en batch!
  });
});
