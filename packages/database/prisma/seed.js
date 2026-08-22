const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';
const ADMIN_ID = 'f0000000-0000-0000-0000-000000000002';
const RECEPTIONIST_ID = 'f0000000-0000-0000-0000-000000000001';
const WAITER_ID = 'e0000000-0000-0000-0000-000000000001';
const WAITER_2_ID = 'e0000000-0000-0000-0000-000000000002';
const WAITER_3_ID = 'e0000000-0000-0000-0000-000000000003';
const KITCHEN_ID = 'c0000000-0000-0000-0000-000000000002';
const CASHIER_ID = 'c0000000-0000-0000-0000-000000000003';

const TABLE_1_ID = 'b0000000-0000-0000-0000-000000000001';
const TABLE_2_ID = 'b0000000-0000-0000-0000-000000000002';
const TABLE_3_ID = 'b0000000-0000-0000-0000-000000000003';
const TABLE_4_ID = 'b0000000-0000-0000-0000-000000000004';
const TABLE_5_ID = 'b0000000-0000-0000-0000-000000000005';
const TABLE_6_ID = 'b0000000-0000-0000-0000-000000000006';
const TABLE_7_ID = 'b0000000-0000-0000-0000-000000000007';
const TABLE_8_ID = 'b0000000-0000-0000-0000-000000000008';

const DEVICE_1_ID = '90000000-0000-0000-0000-000000000001';
const DEVICE_2_ID = '90000000-0000-0000-0000-000000000002';
const DEVICE_3_ID = '90000000-0000-0000-0000-000000000003';
const DEVICE_4_ID = '90000000-0000-0000-0000-000000000004';

async function main() {
  console.log('🌱 Sembrando datos para Restaurant OS...');

  // 1. Crear Restaurante
  const restaurant = await prisma.restaurant.upsert({
    where: { id: RESTAURANT_ID },
    create: {
      id: RESTAURANT_ID,
      name: 'La Trattoria Italiana',
    },
    update: {
      name: 'La Trattoria Italiana',
    },
  });
  console.log(`✅ Restaurante: ${restaurant.name} (${restaurant.id})`);

  // 2. Crear Personal (Staff)
  const staffMembers = [
    { id: ADMIN_ID, name: 'Carlos Rossi (Admin)', email: 'admin@trattoria.com', roles: ['ADMIN'] },
    { id: RECEPTIONIST_ID, name: 'Valeria Gómez (Host)', email: 'recepcion@trattoria.com', roles: ['RECEPTIONIST'] },
    { id: WAITER_ID, name: 'Mateo Silva (Mozo 1)', email: 'mozo1@trattoria.com', roles: ['WAITER'] },
    { id: WAITER_2_ID, name: 'Lucas Benítez (Mozo 2)', email: 'mozo2@trattoria.com', roles: ['WAITER'] },
    { id: WAITER_3_ID, name: 'Sofía Díaz (Moza 3)', email: 'mozo3@trattoria.com', roles: ['WAITER'] },
    { id: KITCHEN_ID, name: 'Chef Giovanni (Cocina)', email: 'cocina@trattoria.com', roles: ['KITCHEN'] },
    { id: CASHIER_ID, name: 'Lucía Pérez (Cajera)', email: 'caja@trattoria.com', roles: ['CASHIER'] },
  ];

  for (const s of staffMembers) {
    await prisma.staff.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        restaurantId: RESTAURANT_ID,
        name: s.name,
        email: s.email,
        active: true,
      },
      update: {
        name: s.name,
        email: s.email,
      },
    });

    for (const role of s.roles) {
      await prisma.staffRoleAssignment.upsert({
        where: {
          staffId_role: {
            staffId: s.id,
            role,
          },
        },
        create: {
          staffId: s.id,
          role,
        },
        update: {},
      });
    }
  }
  console.log(`✅ Personal y roles configurados (${staffMembers.length} usuarios)`);

  // 3. Crear Mesas
  const tables = [
    { id: TABLE_1_ID, number: 1, capacity: 2 },
    { id: TABLE_2_ID, number: 2, capacity: 4 },
    { id: TABLE_3_ID, number: 3, capacity: 4 },
    { id: TABLE_4_ID, number: 4, capacity: 6 },
    { id: TABLE_5_ID, number: 5, capacity: 2 },
    { id: TABLE_6_ID, number: 6, capacity: 4 },
    { id: TABLE_7_ID, number: 7, capacity: 8 },
    { id: TABLE_8_ID, number: 8, capacity: 4 },
  ];

  for (const t of tables) {
    await prisma.table.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        restaurantId: RESTAURANT_ID,
        number: t.number,
        capacity: t.capacity,
        status: 'AVAILABLE',
      },
      update: {
        number: t.number,
        capacity: t.capacity,
      },
    });
  }
  console.log(`✅ Mesas creadas (${tables.length} mesas)`);

  // 4. Crear Tablets (TableDevices)
  const devices = [
    { id: DEVICE_1_ID, name: 'Tablet Mesa 1', tableId: TABLE_1_ID },
    { id: DEVICE_2_ID, name: 'Tablet Mesa 2', tableId: TABLE_2_ID },
    { id: DEVICE_3_ID, name: 'Tablet Mesa 3', tableId: TABLE_3_ID },
    { id: DEVICE_4_ID, name: 'Tablet Mesa 4', tableId: TABLE_4_ID },
  ];

  for (const d of devices) {
    await prisma.tableDevice.upsert({
      where: { id: d.id },
      create: {
        id: d.id,
        restaurantId: RESTAURANT_ID,
        name: d.name,
        tableId: d.tableId,
        active: true,
      },
      update: {
        name: d.name,
        tableId: d.tableId,
        active: true,
      },
    });
  }
  console.log(`✅ Tablets de mesa creadas (${devices.length} dispositivos)`);

  // 5. Categorías de Menú
  const categories = [
    { id: 'cat-entradas', name: '🥖 Entradas & Antipasti', sortOrder: 1 },
    { id: 'cat-pastas', name: '🍝 Pastas Caseras', sortOrder: 2 },
    { id: 'cat-pizzas', name: '🍕 Pizzas al Horno', sortOrder: 3 },
    { id: 'cat-postres', name: '🍰 Postres Tradicionales', sortOrder: 4 },
    { id: 'cat-bebidas', name: '🍷 Bebidas & Vinos', sortOrder: 5 },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        restaurantId: RESTAURANT_ID,
        name: c.name,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      update: {
        name: c.name,
        sortOrder: c.sortOrder,
        isActive: true,
      },
    });
  }

  // 6. Platos y Bebidas
  const products = [
    { id: 'p-bruschetta', categoryId: 'cat-entradas', name: 'Bruschetta al Pomodoro', price: 1200, description: 'Pan casero tostado con tomate fresco, albahaca y aceite de oliva virgen extra.' },
    { id: 'p-carpaccio', categoryId: 'cat-entradas', name: 'Carpaccio di Manzo', price: 2400, description: 'Finas láminas de lomo con rúcula, alcaparras y lascas de queso parmesano.' },
    { id: 'p-tabla-quesos', categoryId: 'cat-entradas', name: 'Tabla de Quesos Italianos', price: 3100, description: 'Selección de gorgonzola, pecorino romano, fontina y frutos secos.' },

    { id: 'p-fettuccine', categoryId: 'cat-pastas', name: 'Fettuccine Alfredo', price: 3800, description: 'Cremosa salsa de manteca y parmesano con pimienta negra molida fresca.' },
    { id: 'p-ravioli', categoryId: 'cat-pastas', name: 'Ravioli de Ricotta y Espinaca', price: 4200, description: 'Ravioles artesanales con salsa rosa de tomate y crema al vino blanco.' },
    { id: 'p-lasagna', categoryId: 'cat-pastas', name: 'Lasagna alla Bolognese', price: 4600, description: 'Capas de pasta casera, ragú clásico boloñesa, bechamel y queso gratinado.' },

    { id: 'p-margherita', categoryId: 'cat-pizzas', name: 'Pizza Margherita', price: 3500, description: 'Masa madre tradicional, salsa de tomates italianos, mozzarella fior di latte y albahaca.' },
    { id: 'p-4quesos', categoryId: 'cat-pizzas', name: 'Pizza Quattro Formaggi', price: 4100, description: 'Mozzarella, gorgonzola, parmesano reggiano y provolone curado.' },
    { id: 'p-diavola', categoryId: 'cat-pizzas', name: 'Pizza Diavola Piccante', price: 4300, description: 'Salamín picante italiano, aceite de chiles y mozzarella hilada.' },

    { id: 'p-tiramisu', categoryId: 'cat-postres', name: 'Tiramisú Tradizionale', price: 1800, description: 'Vainillas embebidas en espresso y licor amaretto con suave crema mascarpone y cacao.' },
    { id: 'p-pannacotta', categoryId: 'cat-postres', name: 'Panna Cotta de Frutos Rojos', price: 1600, description: 'Suave crema cocida con reducción de frambuesas y moras silvestres.' },
    { id: 'p-cannoli', categoryId: 'cat-postres', name: 'Cannoli Siciliani', price: 1700, description: 'Masa crujiente rellena de crema dulce de ricotta, chips de chocolate y pistachos.' },

    { id: 'p-limonada', categoryId: 'cat-bebidas', name: 'Limonada con Menta y Jengibre', price: 900, description: 'Jugo natural de limones recién exprimidos con hierbabuena.' },
    { id: 'p-aperol', categoryId: 'cat-bebidas', name: 'Aperol Spritz', price: 2200, description: 'Aperol, vino espumante Prosecco, soda y rodaja de naranja fresca.' },
    { id: 'p-malbec', categoryId: 'cat-bebidas', name: 'Vino Malbec Reserva (Copa)', price: 1900, description: 'Vino tinto crianza en barrica de roble con notas de frutos rojos y vainilla.' },
    { id: 'p-agua', categoryId: 'cat-bebidas', name: 'Agua Mineral Natural (500ml)', price: 600, description: 'Agua mineral de manantial con o sin gas.' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        restaurantId: RESTAURANT_ID,
        categoryId: p.categoryId,
        name: p.name,
        price: p.price,
        description: p.description,
        isAvailable: true,
      },
      update: {
        name: p.name,
        price: p.price,
        description: p.description,
        isAvailable: true,
      },
    });
  }
  console.log(`✅ Catálogo cargado (${categories.length} categorías, ${products.length} platos y bebidas)`);

  // 7. Abrir Sesión en Mesa 1
  await prisma.tableSession.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    create: {
      id: 'c0000000-0000-0000-0000-000000000001',
      restaurantId: RESTAURANT_ID,
      tableId: TABLE_1_ID,
      status: 'OPEN',
      openedAt: new Date(),
      waiterAssignments: JSON.stringify([
        { waiterId: WAITER_ID, assignedAt: new Date().toISOString() },
      ]),
    },
    update: {
      status: 'OPEN',
      tableId: TABLE_1_ID,
    },
  });

  await prisma.table.update({
    where: { id: TABLE_1_ID },
    data: { status: 'OCCUPIED' },
  });

  // 8. Crear Orden y KitchenOrder de prueba para Cocina KDS
  await prisma.order.upsert({
    where: { id: 'order-demo-001' },
    create: {
      id: 'order-demo-001',
      restaurantId: RESTAURANT_ID,
      tableSessionId: 'c0000000-0000-0000-0000-000000000001',
      status: 'SENT_TO_KITCHEN',
      items: [
        { productId: 'p-bruschetta', name: 'Bruschetta al Pomodoro', unitPrice: 1200, quantity: 2, notes: 'Bien tostado' },
        { productId: 'p-lasagna', name: 'Lasagna alla Bolognese', unitPrice: 4600, quantity: 1, notes: 'Extra queso' },
        { productId: 'p-aperol', name: 'Aperol Spritz', unitPrice: 2200, quantity: 2 },
      ],
    },
    update: {},
  });

  await prisma.kitchenOrder.upsert({
    where: { id: 'ko-demo-001' },
    create: {
      id: 'ko-demo-001',
      orderId: 'order-demo-001',
      restaurantId: RESTAURANT_ID,
      status: 'RECEIVED',
      priority: 0,
      receivedAt: new Date(),
      notes: 'Mesa 1 comanda inicial',
    },
    update: {},
  });

  // 9. Crear Cuenta para Mesa 1 en Caja
  await prisma.account.upsert({
    where: { id: 'acc-demo-001' },
    create: {
      id: 'acc-demo-001',
      restaurantId: RESTAURANT_ID,
      tableSessionId: 'c0000000-0000-0000-0000-000000000001',
      status: 'OPEN',
      totalAmount: 11400,
    },
    update: {},
  });

  console.log('🎉 ¡Base de datos poblada exitosamente para Restaurant OS!');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
