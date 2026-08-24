import { describe, it, expect } from 'vitest';
import {
  CreateOrderUseCase,
  SendToKitchenUseCase,
  MarkOrderReadyUseCase,
  DeliverOrderUseCase,
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

class InMemoryEventPublisher implements EventPublisher {
  public events: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('Fase 2.4 — TV Barra Retiro #L-45 LISTO + Repartidor Delivery #D-45', () => {
  const restaurantId = 'rest-001';
  const customerId = 'cust-99';

  it('1. Pedido TAKEAWAY #L-45: Paga fuera -> Pasa a KDS -> Cocina marca LISTO -> Barra TV muestra #L-45 LISTO -> Entregado', async () => {
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const kitchenRepo = new InMemoryKitchenOrderRepo();
    const productRepo = new InMemoryProductRepo();
    const publisher = new InMemoryEventPublisher();

    await productRepo.save(
      Product.create({
        id: 'prod-fugazzeta',
        restaurantId,
        categoryId: 'cat-pizzas',
        name: 'Pizza Fugazzeta Rellena',
        price: 9800,
        sectorKDS: 'PIZZAS',
      }).value,
    );

    // 1. Crear Pedido TAKEAWAY (con shortcode 45)
    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const orderRes = await createOrderUseCase.execute({
      id: 'ord-takeaway-45',
      restaurantId,
      customerId,
      type: 'TAKEAWAY',
      items: [{ productId: 'prod-fugazzeta', quantity: 1, unitPrice: 9800 }],
    });
    expect(orderRes.success).toBe(true);

    // 2. Cliente paga en Caja
    const paidOrder = orderRes.value.markAsPaid().value;
    await orderRepo.save(paidOrder);

    // 3. Despacho a Cocina (Fan-out por sector)
    const sendUseCase = new SendToKitchenUseCase(
      orderRepo,
      publisher,
      kitchenRepo,
      undefined,
      undefined,
      undefined,
      productRepo,
    );

    const sendRes = await sendUseCase.execute({
      orderId: 'ord-takeaway-45',
      actorType: ActorType.STAFF,
      actorId: 'caja-01',
    });
    expect(sendRes.success).toBe(true);

    const kitchenOrder = await kitchenRepo.findByOrderId('ord-takeaway-45');
    expect(kitchenOrder).not.toBeNull();
    const meta = JSON.parse(kitchenOrder!.notes || '{}');
    expect(meta.tickets[0].ticketCode).toBe('T-L-45-01-PIZZAS');

    // 4. Cocina finaliza preparación y marca LISTO (READY)
    const markReadyUseCase = new MarkOrderReadyUseCase(orderRepo, publisher);
    const readyRes = await markReadyUseCase.execute({ orderId: 'ord-takeaway-45' });
    expect(readyRes.success).toBe(true);
    expect(readyRes.value.status).toBe(OrderStatus.READY);

    // 5. Operador de Barra Retiro entrega el pedido al cliente (#L-45)
    const deliverUseCase = new DeliverOrderUseCase(orderRepo, publisher, kitchenRepo);
    const deliverRes = await deliverUseCase.execute({
      orderId: 'ord-takeaway-45',
      actorType: ActorType.STAFF,
      actorId: 'barra-01',
    });
    expect(deliverRes.success).toBe(true);
    expect(deliverRes.value.status).toBe(OrderStatus.DELIVERED);
  });

  it('2. Pedido DELIVERY #D-45: Paga con dirección -> Cocina -> Repartidor toma pedido -> Entrega en destino', async () => {
    const orderRepo = new InMemoryOrderRepo();
    const preOrderRepo = new InMemoryPreOrderRepo();
    const kitchenRepo = new InMemoryKitchenOrderRepo();
    const productRepo = new InMemoryProductRepo();
    const publisher = new InMemoryEventPublisher();

    await productRepo.save(
      Product.create({
        id: 'prod-empanadas',
        restaurantId,
        categoryId: 'cat-pizzas',
        name: 'Docena Empanadas',
        price: 12000,
        sectorKDS: 'PIZZAS',
      }).value,
    );

    // 1. Crear Pedido DELIVERY
    const createOrderUseCase = new CreateOrderUseCase(orderRepo, preOrderRepo, publisher);
    const orderRes = await createOrderUseCase.execute({
      id: 'ord-delivery-45',
      restaurantId,
      customerId,
      type: 'DELIVERY',
      items: [{ productId: 'prod-empanadas', quantity: 1, unitPrice: 12000 }],
    });
    expect(orderRes.success).toBe(true);

    // 2. Pago aprobado en delivery
    const paidOrder = orderRes.value.markAsPaid().value;
    await orderRepo.save(paidOrder);

    // 3. Envío a Cocina
    const sendUseCase = new SendToKitchenUseCase(
      orderRepo,
      publisher,
      kitchenRepo,
      undefined,
      undefined,
      undefined,
      productRepo,
    );
    const sendRes = await sendUseCase.execute({ orderId: 'ord-delivery-45' });
    expect(sendRes.success).toBe(true);

    const kitchenOrder = await kitchenRepo.findByOrderId('ord-delivery-45');
    const meta = JSON.parse(kitchenOrder!.notes || '{}');
    expect(meta.tickets[0].ticketCode).toBe('T-D-45-01-PIZZAS');

    // 4. Cocina marca LISTO
    const markReadyUseCase = new MarkOrderReadyUseCase(orderRepo, publisher);
    await markReadyUseCase.execute({ orderId: 'ord-delivery-45' });

    // 5. Repartidor confirma entrega en domicilio
    const deliverUseCase = new DeliverOrderUseCase(orderRepo, publisher, kitchenRepo);
    const deliverRes = await deliverUseCase.execute({
      orderId: 'ord-delivery-45',
      actorType: ActorType.STAFF,
      actorId: 'repartidor-01',
    });
    expect(deliverRes.success).toBe(true);
    expect(deliverRes.value.status).toBe(OrderStatus.DELIVERED);
  });
});
