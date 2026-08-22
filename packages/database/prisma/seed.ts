import { PrismaClient, StaffRole } from '@prisma/client';

const prisma = new PrismaClient();

const RESTAURANT_ID = 'a0000000-0000-0000-0000-000000000001';
const ADMIN_ID = 'f0000000-0000-0000-0000-000000000002';
const RECEPTIONIST_ID = 'f0000000-0000-0000-0000-000000000001';
const WAITER_ID = 'e0000000-0000-0000-0000-000000000001';
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
  console.log('🍕 Sembrando datos para Pizzería Tradicional en Restaurant OS...');

  // 1. Crear Restaurante
  const restaurant = await prisma.restaurant.upsert({
    where: { id: RESTAURANT_ID },
    create: {
      id: RESTAURANT_ID,
      name: 'Pizzería Los Maestros Tradicional',
    },
    update: {
      name: 'Pizzería Los Maestros Tradicional',
    },
  });
  console.log(`✅ Restaurante: ${restaurant.name} (${restaurant.id})`);

  // 2. Crear Personal (Staff)
  const staffMembers: Array<{ id: string; name: string; email: string; roles: StaffRole[] }> = [
    { id: ADMIN_ID, name: 'Carlos Rossi (Admin)', email: 'admin@pizzeria.com', roles: [StaffRole.ADMIN] },
    { id: RECEPTIONIST_ID, name: 'Valeria Gómez (Host)', email: 'recepcion@pizzeria.com', roles: [StaffRole.RECEPTIONIST] },
    { id: WAITER_ID, name: 'Mateo Silva (Mozo)', email: 'mozo1@pizzeria.com', roles: [StaffRole.WAITER] },
    { id: KITCHEN_ID, name: 'Maestro Pizzero Antonio', email: 'cocina@pizzeria.com', roles: [StaffRole.KITCHEN] },
    { id: CASHIER_ID, name: 'Lucía Pérez (Cajera)', email: 'caja@pizzeria.com', roles: [StaffRole.CASHIER] },
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

  // 5. Categorías de Menú para Pizzería Tradicional
  const categories = [
    { id: 'cat-pizzas', name: '🍕 Pizzas al Horno de Barro', sortOrder: 1 },
    { id: 'cat-empanadas', name: '🥟 Empanadas Criollas Artesanales', sortOrder: 2 },
    { id: 'cat-faina-entradas', name: '🥖 Fainá & Entradas', sortOrder: 3 },
    { id: 'cat-bebidas', name: '🍻 Cervezas & Bebidas', sortOrder: 4 },
    { id: 'cat-postres', name: '🍮 Postres Tradicionales', sortOrder: 5 },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        restaurantId: RESTAURANT_ID,
        name: c.name,
        sortOrder: c.sortOrder,
      },
      update: {
        name: c.name,
        sortOrder: c.sortOrder,
      },
    });
  }

  // 6. Platos y Bebidas de Pizzería Tradicional
  const products = [
    // Pizzas
    { id: 'p-muzzarella', categoryId: 'cat-pizzas', name: 'Pizza Muzzarella Clásica', price: 9500, description: 'Masa al molde dorada, salsa de tomate casera, abundante mozzarella, orégano y aceitunas verdes.' },
    { id: 'p-fugazzeta', categoryId: 'cat-pizzas', name: 'Pizza Fugazzeta Rellena Especial', price: 11800, description: 'Doble masa rellena con 500g de mozzarella, cubierta de cebolla caramelizada, orégano y toque de oliva.' },
    { id: 'p-napolitana', categoryId: 'cat-pizzas', name: 'Pizza Napolitana Tradicional', price: 10500, description: 'Mozzarella fundida, rodajas de tomate natural fresco, ajo picado aromatizado, albahaca y orégano.' },
    { id: 'p-calabresa', categoryId: 'cat-pizzas', name: 'Pizza Calabresa Artesanal', price: 11200, description: 'Mozzarella seleccionada, rodajas de longaniza calabresa seca de campo y morrón asado en tiras.' },
    { id: 'p-jamon-morron', categoryId: 'cat-pizzas', name: 'Pizza Especial de Jamón y Morrones', price: 11500, description: 'Salsa suave de tomate, mozzarella, fetas de jamón cocido natural y morrones rojos asados.' },
    { id: 'p-cuatro-quesos', categoryId: 'cat-pizzas', name: 'Pizza Cuatro Quesos', price: 12000, description: 'Mozzarella, queso azul roquefort suave, provolone hilado y parmesano reggiano rallado.' },

    // Empanadas
    { id: 'p-emp-carne', categoryId: 'cat-empanadas', name: 'Empanada de Carne a Cuchillo', price: 1600, description: 'Carne vacuna cortada a cuchillo, cebolla de verdeo, huevo duro y especias criollas.' },
    { id: 'p-emp-jyq', categoryId: 'cat-empanadas', name: 'Empanada de Jamón y Queso', price: 1500, description: 'Jamón cocido de primera calidad y queso mozzarella fundido.' },
    { id: 'p-emp-pollo', categoryId: 'cat-empanadas', name: 'Empanada de Pollo al Verdeo', price: 1500, description: 'Pollo desmenuzado con cebolla de verdeo tiernizada y toque de crema.' },
    { id: 'p-emp-cebolla', categoryId: 'cat-empanadas', name: 'Empanada de Cebolla y Queso (Fugazzeta)', price: 1500, description: 'Queso mozzarella con cebolla salteada y pimienta blanca.' },

    // Fainá & Entradas
    { id: 'p-faina-clasica', categoryId: 'cat-faina-entradas', name: 'Fainá Dorada Tradicional', price: 1800, description: 'Harina de garbanzos tradicional, pimienta negra molida y crocante en horno de barro.' },
    { id: 'p-faina-rellena', categoryId: 'cat-faina-entradas', name: 'Fainá Rellena con Jamón y Muzzarella', price: 2800, description: 'Porción generosa de fainá con centro relleno de queso mozzarella derretido y jamón.' },
    { id: 'p-bastones-muzza', categoryId: 'cat-faina-entradas', name: 'Bastones de Muzzarella Rebozados (6u)', price: 4200, description: 'Bastones crocantes rebozados en panko servidos con salsa fileto para dipear.' },

    // Bebidas
    { id: 'p-quilmes-1l', categoryId: 'cat-bebidas', name: 'Cerveza Quilmes Clásica (1 Litro)', price: 3800, description: 'Botella de litro servida bien helada.' },
    { id: 'p-patagonia-730', categoryId: 'cat-bebidas', name: 'Cerveza Patagonia Bohemian Pilsener (730ml)', price: 4900, description: 'Cerveza rubia aromática con maltas especiales.' },
    { id: 'p-coca-500', categoryId: 'cat-bebidas', name: 'Coca Cola Original (500ml)', price: 1500, description: 'Botella individual fría con vaso y limón opcional.' },
    { id: 'p-coca-15l', categoryId: 'cat-bebidas', name: 'Coca Cola / Sprite (1.5 Litros)', price: 3200, description: 'Gaseosa tamaño familiar ideal para compartir.' },
    { id: 'p-agua-500', categoryId: 'cat-bebidas', name: 'Agua Mineral de Manantial (500ml)', price: 1200, description: 'Con o sin gas.' },

    // Postres
    { id: 'p-flan-casero', categoryId: 'cat-postres', name: 'Flan Casero Tradicional', price: 2900, description: 'Elaborado con 8 huevos, acompañado de generoso dulce de leche colonial y crema chantilly.' },
    { id: 'p-tiramisu', categoryId: 'cat-postres', name: 'Tiramisú Artesanal', price: 3200, description: 'Vainillas al café espresso, licor y crema de queso mascarpone.' },
    { id: 'p-almendrado', categoryId: 'cat-postres', name: 'Postre Almendrado con Charme de Chocolate', price: 2800, description: 'Helado almendrado bañado con salsa tibia de chocolate artesanal.' },
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
  console.log(`✅ Catálogo de Pizzería cargado (${categories.length} categorías, ${products.length} platos)`);

  // 7. Materias Primas / Insumos (Stock BOM)
  const rawMaterials = [
    { id: 'mat-harina', name: 'Harina 000 de Fuerza', unit: 'KG', currentStock: 50.0, minStockAlert: 10.0, unitCost: 600 },
    { id: 'mat-muzzarella', name: 'Queso Muzzarella en Barra', unit: 'KG', currentStock: 30.0, minStockAlert: 6.0, unitCost: 6500 },
    { id: 'mat-tomate', name: 'Tomate Triturado p/ Salsa', unit: 'L', currentStock: 25.0, minStockAlert: 5.0, unitCost: 1200 },
    { id: 'mat-cebolla', name: 'Cebolla Seleccionada', unit: 'KG', currentStock: 20.0, minStockAlert: 4.0, unitCost: 800 },
    { id: 'mat-jamon', name: 'Jamón Cocido Feteado', unit: 'KG', currentStock: 12.0, minStockAlert: 3.0, unitCost: 7200 },
    { id: 'mat-aceitunas', name: 'Aceitunas Verdes Descarozadas', unit: 'KG', currentStock: 8.0, minStockAlert: 2.0, unitCost: 4500 },
    { id: 'mat-calabresa', name: 'Longaniza Calabresa de Campo', unit: 'KG', currentStock: 7.0, minStockAlert: 2.0, unitCost: 9000 },
    { id: 'mat-tapas-emp', name: 'Tapas de Empanadas Hoja', unit: 'UNIT', currentStock: 120.0, minStockAlert: 30.0, unitCost: 90 },
    { id: 'mat-carne', name: 'Carne Vacuna para Relleno', unit: 'KG', currentStock: 15.0, minStockAlert: 4.0, unitCost: 5800 },
    { id: 'mat-coca-500', name: 'Botella Coca Cola 500ml', unit: 'UNIT', currentStock: 48.0, minStockAlert: 12.0, unitCost: 750 },
    { id: 'mat-quilmes-1l', name: 'Botella Cerveza Quilmes 1L', unit: 'UNIT', currentStock: 36.0, minStockAlert: 8.0, unitCost: 2100 },
  ];

  for (const m of rawMaterials) {
    await prisma.rawMaterial.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        restaurantId: RESTAURANT_ID,
        name: m.name,
        unit: m.unit as any,
        currentStock: m.currentStock,
        minStockAlert: m.minStockAlert,
        unitCost: m.unitCost,
      },
      update: {
        name: m.name,
        currentStock: m.currentStock,
        minStockAlert: m.minStockAlert,
        unitCost: m.unitCost,
      },
    });
  }
  console.log(`✅ Insumos de stock registrados (${rawMaterials.length} materias primas)`);

  // 8. Escandallos (Recetas BOM)
  const recipes = [
    // Pizza Muzzarella: 250g harina, 250g muzza, 100ml salsa, 30g aceitunas
    {
      productId: 'p-muzzarella',
      items: [
        { rawMaterialId: 'mat-harina', quantity: 0.25 },
        { rawMaterialId: 'mat-muzzarella', quantity: 0.25 },
        { rawMaterialId: 'mat-tomate', quantity: 0.10 },
        { rawMaterialId: 'mat-aceitunas', quantity: 0.03 },
      ],
    },
    // Pizza Fugazzeta: 250g harina, 350g muzza, 200g cebolla
    {
      productId: 'p-fugazzeta',
      items: [
        { rawMaterialId: 'mat-harina', quantity: 0.25 },
        { rawMaterialId: 'mat-muzzarella', quantity: 0.35 },
        { rawMaterialId: 'mat-cebolla', quantity: 0.20 },
      ],
    },
    // Empanada de Carne: 1 tapa, 60g carne, 20g cebolla
    {
      productId: 'p-emp-carne',
      items: [
        { rawMaterialId: 'mat-tapas-emp', quantity: 1.0 },
        { rawMaterialId: 'mat-carne', quantity: 0.06 },
        { rawMaterialId: 'mat-cebolla', quantity: 0.02 },
      ],
    },
    // Coca Cola 500ml: 1 unidad
    {
      productId: 'p-coca-500',
      items: [
        { rawMaterialId: 'mat-coca-500', quantity: 1.0 },
      ],
    },
  ];

  for (const r of recipes) {
    await prisma.recipeItem.deleteMany({ where: { productId: r.productId } });
    for (const item of r.items) {
      await prisma.recipeItem.create({
        data: {
          id: `${r.productId}-${item.rawMaterialId}`,
          productId: r.productId,
          rawMaterialId: item.rawMaterialId,
          quantity: item.quantity,
        },
      });
    }
  }
  console.log(`✅ Escandallos / Recetas configuradas (${recipes.length} productos con deducción automática)`);

  console.log('🎉 ¡Base de datos de Pizzería Tradicional sembrada exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
