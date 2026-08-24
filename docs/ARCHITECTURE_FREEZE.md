# ARCHITECTURE_FREEZE.md
## CONGELAMIENTO ARQUITECTÓNICO DE RESTAURANT OS
**Fase 0 — Contrato Normativo para la Coordinación Integral**

---

## 1. INVARIANTES FUNDAMENTALES DEL DOMINIO

### A. Entidad `Table` (Mesa Física)
1. **Identidad Inmutable**: `table.id` es un UUID inmutable asignado en la creación. `table.number` es un atributo mutable de presentación/numeración física en el salón (entero positivo $> 0$).
2. **Capacidad Estricta**: `table.capacity` debe ser un entero positivo $> 0$.
3. **Exclusividad de Ocupación**: Una mesa en estado `OCCUPIED` o `ASSIGNED` **no** puede ser asignada ni ocupada por otra sesión simultáneamente.
4. **Ciclo de Vida Físico**:
   $$\text{AVAILABLE} \xrightarrow{\text{assign()}} \text{ASSIGNED} \xrightarrow{\text{occupy()}} \text{OCCUPIED} \xrightarrow{\text{release()}} \text{AVAILABLE}$$
   *Transición directa permitida*: $\text{AVAILABLE} \xrightarrow{\text{occupy()}} \text{OCCUPIED}$ (cuando Recepción sienta directamente sin reserva previa).

---

### B. Entidad `TableSession` (Eje Operativo Temporal)
1. **Identidad Persistente**: `tableSession.id` no cambia durante toda la vida de la estancia de los comensales, independientemente de cambios de mesa, rotación de mozos o altas/bajas de clientes.
2. **Mesa Activa Única**: En cualquier instante $t$, una `TableSession` activa tiene **exactamente una** mesa física asociada (`!a.releasedAt` en `tableAssignments`).
3. **Invariante de Cierre**: Una sesión en estado `CLOSED` es inmutable. No se le pueden agregar pedidos, comensales, pagos ni cambiar de mesa.
4. **Ciclo de Estados**:
   $$\text{ASSIGNED} \xrightarrow{\text{occupy()}} \text{OCCUPIED} \xrightarrow{\text{open()}} \text{OPEN} \xrightarrow{\text{requestClose()}} \text{CLOSING} \xrightarrow{\text{close()}} \text{CLOSED}$$

---

### C. Entidad `Account` (Cuenta de Facturación)
1. **Unicidad por Sesión**: Existe una relación $1:1$ operativa entre una `TableSession` activa y su `Account` principal (`tableSessionId`).
2. **No Negatividad**: `totalAmount \ge 0`, `paidAmount \ge 0`, `remainingAmount = \max(0, totalAmount - paidAmount)`.
3. **Invariante de Cierre Fiscal/POS**: Una `Account` **solo** puede transicionar a `CLOSED` si `isFullyPaid === true` ($paidAmount \ge totalAmount$).
4. **Ciclo de Estados**:
   $$\text{OPEN} \xrightarrow{\text{requestPayment()}} \text{REQUESTED} \xrightarrow{paidAmount \ge totalAmount} \text{PAID} \xrightarrow{\text{close()}} \text{CLOSED}$$

---

### D. Entidad `Order` (Dimensión Comercial del Pedido)
1. **Pertenencia a Sesión**: Toda orden pertenece obligatoriamente a una `TableSession` activa.
2. **Inmutabilidad Post-Confirmación**: Una vez en estado `CONFIRMED` o posterior, los ítems de la orden no pueden modificarse ni eliminarse directamente (requiere cancelación o nueva comanda complementaria).
3. **Ciclo Comercial**:
   $$\text{DRAFT} \xrightarrow{\text{confirm()}} \text{CONFIRMED} \xrightarrow{\text{sendToKitchen()}} \text{SENT\_TO\_KITCHEN} \xrightarrow{\text{startPreparing()}} \text{PREPARING} \xrightarrow{\text{markReady()}} \text{READY} \xrightarrow{\text{deliver()}} \text{DELIVERED}$$
   *Cancelación*: Permitida desde cualquier estado previo a `DELIVERED`.

---

### E. Entidad `KitchenOrder` (Dimensión Productiva en KDS)
1. **Unicidad por Orden**: Existe una relación $1:1$ estricta con `Order` garantizada por `orderId @unique` en PostgreSQL.
2. **Trazabilidad Temporal**: Registra `receivedAt`, `startedAt`, `nearlyReadyAt`, `readyAt`, `completedAt`.
3. **Ciclo de Producción**:
   $$\text{RECEIVED} \xrightarrow{\text{start()}} \text{STARTED} \xrightarrow{\text{markNearlyReady()}} \text{NEARLY\_READY} \xrightarrow{\text{markReady()}} \text{READY} \xrightarrow{\text{complete()}} \text{COMPLETED}$$

---

## 2. MATRIZ DE OWNERSHIP DE AGREGADOS Y CASOS DE USO

| Agregado Raíz | Entidades Hijas / Value Objects | Casos de Uso con Permiso de Mutación | Repositorio Encargado |
| :--- | :--- | :--- | :--- |
| **`Table`** | N/A | `CreateTableUseCase`, `CreateTableSessionUseCase`, `ChangeSessionTableUseCase`, `CloseTableSessionUseCase`, `CloseAccountUseCase` | `TableRepository` |
| **`TableSession`** | `TableAssignment[]`, `WaiterAssignment[]`, `customerIds[]` | `CreateTableSessionUseCase`, `ChangeSessionTableUseCase`, `ChangeWaiterUseCase`, `AddCustomerToSessionUseCase`, `RemoveCustomerFromSessionUseCase`, `CloseTableSessionUseCase`, `CloseAccountUseCase` | `TableSessionRepository` |
| **`Order`** | `OrderItem[]` | `CreateOrderUseCase`, `SendToKitchenUseCase`, `StartKitchenOrderUseCase`, `MarkKitchenOrderReadyUseCase`, `DeliverOrderUseCase`, `CancelOrderUseCase` | `OrderRepository` |
| **`KitchenOrder`**| N/A | `SendToKitchenUseCase` (creación), `StartKitchenOrderUseCase`, `MarkNearlyReadyUseCase`, `MarkKitchenOrderReadyUseCase`, `CompleteKitchenOrderUseCase`, `AssignKitchenOrderUseCase` | `KitchenOrderRepository` |
| **`Account`** | `Payment[]` | `CreateAccountUseCase`, `AddOrderToAccountUseCase`, `RequestPaymentUseCase`, `RegisterPaymentUseCase`, `CloseAccountUseCase` | `AccountRepository` |

---

## 3. RELACIÓN `Account` ↔ `TableSession` ↔ `Order`: TOTAL DERIVADO VS MATERIALIZADO

### Análisis de la Realidad en Código:
* En `schema.prisma`:
  - `TableSession` tiene `orders Order[]` y `accounts Account[]`.
  - `Order` tiene `tableSessionId String` y un campo `items Json`.
  - `Account` tiene `totalAmount Decimal @default(0)` y `payments Payment[]`.

### Decisión Arquitectónica Normativa:
1. **La Verdad Comercial reside en las Órdenes**: El valor real adeudado por una sesión es la suma de los subtotales de todas las órdenes no canceladas:
   $$\text{TotalTeórico}(\text{Session}) = \sum_{o \in \text{Orders}, o.status \neq \text{CANCELLED}} o.totalAmount$$
2. **`Account.totalAmount` se mantiene Materializado para POS/Caja**:
   - Por razones de auditoría contable y velocidad de consulta en terminales POS, `Account.totalAmount` almacena el balance actual.
   - **Regla de Sincronización Automática**: Todo caso de uso que confirme una comanda (`CreateOrderUseCase` / `SendToKitchenUseCase`) o agregue ítems debe sincronizar automáticamente el `totalAmount` en la `Account` activa de la sesión dentro de la misma transacción.
   - Al invocar `RequestPaymentUseCase` o `CloseAccountUseCase`, el caso de uso valida que el balance coincida con la sumatoria real de órdenes no canceladas.

---

## 4. MODELO DEFINITIVO DE SINCRONIZACIÓN `Order` ↔ `KitchenOrder`

```text
┌────────────────────────────┐                     ┌────────────────────────────┐
│      DIMENSIÓN COMERCIAL   │                     │    DIMENSIÓN PRODUCTIVA    │
│           (`Order`)        │                     │      (`KitchenOrder`)      │
├────────────────────────────┤                     ├────────────────────────────┤
│ DRAFT                      │                     │ (No existe)                │
│                            │                     │                            │
│ CONFIRMED                  │                     │ (No existe)                │
│                            │                     │                            │
│ SENT_TO_KITCHEN  ──────────┼──(SendToKitchen)───►│ RECEIVED                   │
│                            │                     │                            │
│ PREPARING        ◄─────────┼──(StartCooking)─────┤ STARTED / NEARLY_READY     │
│                            │                     │                            │
│ READY            ◄─────────┼──(MarkReady)────────┤ READY                      │
│                            │                     │                            │
│ DELIVERED        ──────────┼──(DeliverOrder)────►│ COMPLETED                  │
└────────────────────────────┘                     └────────────────────────────┘
```

### Garantías Transaccionales:
* **`SendToKitchenUseCase`**: Ejecuta `order.sendToKitchen()` y crea `KitchenOrder.create({ orderId: order.id })`. Idempotencia garantizada por `@unique([orderId])`.
* **`StartKitchenOrderUseCase`**: Ejecuta `kitchenOrder.start()` y `order.startPreparing()` en la misma transacción.
* **`MarkKitchenOrderReadyUseCase`**: Ejecuta `kitchenOrder.markReady()` y `order.markReady()` en la misma transacción.
* **`DeliverOrderUseCase`**: Ejecuta `order.deliver()` y `kitchenOrder.complete()` en la misma transacción.

---

## 5. CONTRATO DEFINITIVO DE `DomainEvent`

### A. Tipado Estricto de Eventos (`EventType`)
Queda terminantemente prohibido el tipo libre `string` en `type`. Los eventos permitidos son exclusivamente:

```typescript
export enum EventType {
  // Mesas y Sesiones
  TABLE_ASSIGNED = 'TABLE_ASSIGNED',
  TABLE_RELEASED = 'TABLE_RELEASED',
  TABLE_CHANGED = 'TABLE_CHANGED',
  TABLE_CLOSED = 'TABLE_CLOSED',
  WAITER_CHANGED = 'WAITER_CHANGED',
  CUSTOMER_SEATED = 'CUSTOMER_SEATED',
  CUSTOMER_REMOVED = 'CUSTOMER_REMOVED',

  // Comandas y Cocina
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  ORDER_SENT_TO_KITCHEN = 'ORDER_SENT_TO_KITCHEN',
  KITCHEN_ORDER_STARTED = 'KITCHEN_ORDER_STARTED',
  KITCHEN_ORDER_NEARLY_READY = 'KITCHEN_ORDER_NEARLY_READY',
  ORDER_READY = 'ORDER_READY',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // Caja y Facturación
  PAYMENT_REGISTERED = 'PAYMENT_REGISTERED',
  ACCOUNT_REQUESTED = 'ACCOUNT_REQUESTED',
  ACCOUNT_CLOSED = 'ACCOUNT_CLOSED',

  // Tareas de Servicio
  SERVICE_TASK_CREATED = 'SERVICE_TASK_CREATED',
  SERVICE_TASK_COMPLETED = 'SERVICE_TASK_COMPLETED',

  // Inventario y Stock
  STOCK_DEDUCTED = 'STOCK_DEDUCTED',
  STOCK_ALERT_TRIGGERED = 'STOCK_ALERT_TRIGGERED',
}
```

### B. Estructura Canónica de `DomainEvent<T>`

```typescript
export interface DomainEvent<T = Record<string, unknown>> {
  readonly id: string;                         // UUID v4 único del evento
  readonly type: EventType;                    // Enum estricto EventType
  readonly restaurantId: string;               // Multi-tenant boundary (OBLIGATORIO)
  readonly aggregateType: string;              // 'TableSession' | 'Order' | 'Account' | etc.
  readonly aggregateId: string;                // ID de la entidad raíz modificada
  readonly tableSessionId?: string | null;     // Contexto de sesión operativa
  readonly tableId?: string | null;            // UUID inmutable de la mesa física
  readonly tableNumber?: number | null;        // Número visible de mesa (1, 2, 3...)
  readonly actorType: 'STAFF' | 'CUSTOMER' | 'TABLE_DEVICE' | 'SYSTEM';
  readonly actorId?: string | null;            // ID del actor que originó la acción
  readonly timestamp: string;                  // ISO 8601 UTC
  readonly payload: T;                         // Payload fuertemente tipado
}
```

---

## 6. METADATOS OBLIGATORIOS VS OPCIONALES POR EVENTO

| Evento | `restaurantId` | `tableSessionId` | `tableId` | `tableNumber` | `aggregateId` | `actorType` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `TABLE_ASSIGNED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `TableSession.id` | **OBLIGATORIO** |
| `TABLE_RELEASED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `Table.id` | **OBLIGATORIO** |
| `TABLE_CHANGED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** (`newTableId`) | **OBLIGATORIO** (`newTableNumber`) | `TableSession.id` | **OBLIGATORIO** |
| `TABLE_CLOSED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `TableSession.id` | **OBLIGATORIO** |
| `WAITER_CHANGED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `TableSession.id` | **OBLIGATORIO** |
| `CUSTOMER_SEATED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `TableSession.id` | **OBLIGATORIO** |
| `CUSTOMER_REMOVED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `TableSession.id` | **OBLIGATORIO** |
| `ORDER_CONFIRMED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `Order.id` | **OBLIGATORIO** |
| `ORDER_SENT_TO_KITCHEN`| **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `Order.id` | **OBLIGATORIO** |
| `KITCHEN_ORDER_STARTED`| **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `KitchenOrder.id` | **OBLIGATORIO** |
| `ORDER_READY` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `Order.id` | **OBLIGATORIO** |
| `ORDER_DELIVERED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `Order.id` | **OBLIGATORIO** |
| `SERVICE_TASK_CREATED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `ServiceTask.id` | **OBLIGATORIO** |
| `PAYMENT_REGISTERED` | **OBLIGATORIO** | **OBLIGATORIO** | Opcional | Opcional | `Account.id` | **OBLIGATORIO** |
| `ACCOUNT_CLOSED` | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | **OBLIGATORIO** | `Account.id` | **OBLIGATORIO** |
| `STOCK_DEDUCTED` | **OBLIGATORIO** | Opcional | Opcional | Opcional | `RawMaterial.id` | **OBLIGATORIO** |

---

## 7. IDENTIDAD (`tableId`) VS PRESENTACIÓN (`tableNumber`)

* **`tableId` (UUID)**: 
  - Clave primaria e inmutable de la entidad `Table` en base de datos.
  - Utilizado en claves foráneas, tokens de tablet (`TableDevice.tableId`), uniones relacionales y autorización.
* **`tableNumber` (Entero)**:
  - Etiqueta humana visible en el salón (ej: Mesa 1, Mesa 14, Mesa 27).
  - Puede ser reconfigurada administrativamente sin alterar las sesiones históricas ni los dispositivos vinculados.
  - **Regla**: Todo evento y notificación que deba mostrarse a mozos, cocineros o comensales transporta `tableNumber` como metadato resuelto desde el agregado `Table` al momento de emitir el evento.

---

## 8. FRONTERA: BD COMO SOURCE OF TRUTH VS SSE COMO PROPAGACIÓN

```text
┌────────────────────────────────────────────────────────────────────────┐
│               POSTGRESQL + DOMAIN USE CASES (SOURCE OF TRUTH)          │
│ • La única fuente de verdad sobre si una mesa está libre u ocupada.   │
│ • La única fuente de verdad sobre el saldo de una cuenta o comanda.   │
│ • Las mutaciones son ACID. Si la BD falla, el cambio no ocurrió.      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Tras COMMIT exitoso)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               EVENT ENGINE + SSE (MECANISMO DE PROPAGACIÓN)            │
│ • Canal efímero, asíncrono y de baja latencia (< 50ms).                │
│ • Notifica a las terminales conectadas que el estado ha cambiado.      │
│ • NUNCA almacena estado autoritativo en memoria volatil.               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Llega mensaje SSE)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND WORKSPACES (PROYECCIÓN REACTIVA)            │
│ • Los workspaces actualizan su estado local inmediatamente al recibir  │
│   el evento tipado.                                                    │
│ • Si la conexión se pierde, NO inventan estado: solicitan un snapshot  │
│   autoritativo a la API al reconectarse.                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 9. ESTRATEGIA DE RECONEXIÓN Y RESILIENCIA DE DISPOSITIVOS

1. **Snapshot HTTP al Montar**: Cada workspace ejecuta una carga inicial autoritativa (`GET /api/...`).
2. **Reconexión Transparente**: Al reabrirse el canal SSE (`es.onopen` tras reconexión), el hook `useSse` dispara automáticamente la recarga de snapshot para cubrir cualquier evento emitido durante la desconexión.
3. **Manejo de `TABLE_CHANGED` en Tablets**:
   - `TableDevice #12` (Mesa vieja): Recibe `TABLE_CHANGED` con `oldTableId === this.tableId` ➔ Resetea estado y muestra *"Mesa Disponible"*.
   - `TableDevice #27` (Mesa nueva): Recibe `TABLE_CHANGED` con `newTableId === this.tableId` ➔ Invoca `GET /api/table-devices/:id/session` y proyecta la comanda y cuenta de la sesión transferida.

---

## 10. CLASIFICACIÓN DE OPERACIONES: `prisma.$transaction`

### Requieren Transacción ACID (`prisma.$transaction`):
1. **`ChangeSessionTableUseCase`**:
   - `oldTable.release()` + `newTable.occupy()` + `session.changeTable()` $\implies$ 3 mutaciones atómicas.
2. **`CloseAccountUseCase`** (con cierre unificado):
   - `account.close()` + `session.close()` + `table.release()` $\implies$ 3 mutaciones atómicas.
3. **`CreateTableSessionUseCase`**:
   - `table.occupy()` + `session.create()` + `account.create()` $\implies$ 3 mutaciones atómicas.
4. **`SendToKitchenUseCase`**:
   - `order.sendToKitchen()` + `kitchenOrder.create()` + `deductStockRecipe()` $\implies$ mutación comercial + productiva + stock.
5. **`MarkKitchenOrderReadyUseCase`**:
   - `kitchenOrder.markReady()` + `order.markReady()` $\implies$ 2 mutaciones sincronizadas.
6. **`DeliverOrderUseCase`**:
   - `order.deliver()` + `kitchenOrder.complete()` $\implies$ 2 mutaciones sincronizadas.

### NO Requieren Transacción (1 sola entidad o idempotente):
* `AddCustomerToSessionUseCase` (Solo `TableSession`).
* `RemoveCustomerFromSessionUseCase` (Solo `TableSession`).
* `ChangeWaiterUseCase` (Solo `TableSession`).
* `RegisterPaymentUseCase` (Solo `Account` + `Payment`).
* `CreateServiceTaskUseCase` (Solo `ServiceTask`).
* `CreateReviewUseCase` (Solo `Review`).

---

## 11. ESTRATEGIA DE IDEMPOTENCIA

1. **Idempotencia en Cocina (`KitchenOrder`)**:
   - Respaldada por `@unique([orderId])` en Prisma. Si `SendToKitchenUseCase` se ejecuta dos veces para el mismo `orderId`, la base de datos rechaza la duplicación y el caso de uso devuelve la instancia existente.
2. **Idempotencia en Pagos (`Payment`)**:
   - Cada pago transporta un `paymentId: UUID`. Si se reintenta el mismo `paymentId`, se rechaza como duplicado.
3. **Idempotencia en Eventos (`EventLog.id`)**:
   - Cada `DomainEvent` posee un UUID inmutable. Si el cliente recibe un evento con un `id` ya procesado en su búfer local, lo descarta.

---

## 12. MATRIZ DE INVARIANTES ➔ CASOS DE USO ➔ ENTIDADES ➔ EVENTOS ➔ PRUEBAS

| Invariante | Caso de Uso | Entidades Involucradas | Transacción ACID | Eventos Emitidos | Test de Verificación |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **INV-01**: Una mesa ocupada no puede asignarse a otra sesión | `CreateTableSessionUseCase` | `Table`, `TableSession`, `Account` | ✅ Sí | `TABLE_ASSIGNED` | `table-session.test.ts` |
| **INV-02**: El cambio de mesa conserva el ID de sesión y libera la anterior | `ChangeSessionTableUseCase` | `Table` (vieja), `Table` (nueva), `TableSession` | ✅ Sí | `TABLE_CHANGED` | `change-table-e2e.test.ts` |
| **INV-03**: La cuenta solo cierra si está 100% saldada, liberando salón | `CloseAccountUseCase` | `Account`, `TableSession`, `Table` | ✅ Sí | `ACCOUNT_CLOSED`, `TABLE_RELEASED` | `billing-close-flow.test.ts` |
| **INV-04**: Cocina READY sincroniza inmediatamente Order READY | `MarkKitchenOrderReadyUseCase` | `KitchenOrder`, `Order` | ✅ Sí | `ORDER_READY` | `kitchen-order-sync.test.ts` |
| **INV-05**: Entrega de comanda completa la orden de cocina | `DeliverOrderUseCase` | `Order`, `KitchenOrder` | ✅ Sí | `ORDER_DELIVERED` | `deliver-order-sync.test.ts` |
| **INV-06**: Quitar un comensal no cierra la sesión activa | `RemoveCustomerFromSessionUseCase` | `TableSession` | ❌ No | `CUSTOMER_REMOVED` | `session-customer-use-cases.test.ts` |
| **INV-07**: El mozo solo opera sobre sesiones autorizadas | `OperationalResourceScoper` | `Staff`, `TableSession` | N/A | N/A | `api-auth.test.ts` |
| **INV-08**: Aislamiento total multi-tenant | `validateRestaurantAccess` + `EventBroadcaster` | `Restaurant` | N/A | Todos los eventos | `sse-auth.test.ts` |

---

## 13. LISTA DE ARCHIVOS INSPECCIONADOS

1. `packages/database/prisma/schema.prisma`
2. `packages/domain/src/table/entity.ts`
3. `packages/domain/src/table-session/entity.ts`
4. `packages/domain/src/order/entity.ts`
5. `packages/domain/src/kitchen/entity.ts`
6. `packages/domain/src/billing/entity.ts`
7. `packages/domain/src/identity/actor.ts`
8. `packages/domain/src/staff/index.ts`
9. `packages/application/src/use-cases/table-session/create-table-session.ts`
10. `packages/application/src/use-cases/table-session/change-table.ts`
11. `packages/application/src/use-cases/table-session/change-waiter.ts`
12. `packages/application/src/use-cases/table-session/close-table-session.ts`
13. `packages/application/src/use-cases/table-session/add-customer.ts`
14. `packages/application/src/use-cases/table-session/remove-customer.ts`
15. `packages/application/src/use-cases/order/create-order.ts`
16. `packages/application/src/use-cases/order/send-to-kitchen.ts`
17. `packages/application/src/use-cases/order/deliver-order.ts`
18. `packages/application/src/use-cases/kitchen/create-kitchen-order.ts`
19. `packages/application/src/use-cases/kitchen/start-kitchen-order.ts`
20. `packages/application/src/use-cases/kitchen/mark-kitchen-order-ready.ts`
21. `packages/application/src/use-cases/kitchen/complete-kitchen-order.ts`
22. `packages/application/src/use-cases/billing/add-order-to-account.ts`
23. `packages/application/src/use-cases/billing/register-payment.ts`
24. `packages/application/src/use-cases/billing/close-account.ts`
25. `packages/application/src/use-cases/table-device/get-table-device-session.ts`
26. `packages/infrastructure/src/realtime/event-broadcaster.ts`
27. `packages/infrastructure/src/messaging/persisting-event-publisher.ts`
28. `packages/infrastructure/src/auth/fastify-auth.ts`
29. `apps/api/src/routes/tables.ts`
30. `apps/api/src/routes/table-sessions.ts`
31. `apps/api/src/routes/table-devices.ts`
32. `apps/api/src/routes/orders.ts`
33. `apps/api/src/routes/kitchen.ts`
34. `apps/api/src/routes/billing.ts`
35. `apps/api/src/routes/sse.ts`
36. `apps/web/src/workspaces/reception/reception-page.tsx`
37. `apps/web/src/workspaces/waiter/waiter-page.tsx`
38. `apps/web/src/workspaces/kitchen/kitchen-page.tsx`
39. `apps/web/src/workspaces/cashier/cashier-page.tsx`
40. `apps/web/src/workspaces/table/table-page.tsx`
41. `apps/web/src/workspaces/customer/customer-page.tsx`
42. `apps/web/src/hooks/useSse.ts`

---

## 14. DECISIONES CONFIRMADAS

1. **`Account` se cierra transaccionalmente con `TableSession` y `Table`**: Al recibir el cobro completo en Caja, el sistema ejecuta la liberación en Postgres y emite `ACCOUNT_CLOSED` y `TABLE_RELEASED`.
2. **`Order` y `KitchenOrder` se sincronizan en transacciones duales**: Cocina actualiza `Order` a `READY` inmediatamente.
3. **Contrato de Evento Cerrado**: No se admiten strings arbitrarios en el enum `EventType`. Todos los eventos de mesa transportan obligatoriamente `restaurantId`, `tableSessionId`, `tableId` y `tableNumber`.
4. **Idempotencia de Cocina**: Respaldada por la restricción física `@unique([orderId])` en Prisma.
5. **Eliminación Total del Polling**: Los intervalos `setInterval(fetchData, ...)` se erradican en favor de actualización reactiva por SSE.

---

## 15. HIPÓTESIS PENDIENTES DE VERIFICACIÓN / DECISIÓN

* **Hipótesis H-01 (Múltiples Cuentas por Sesión)**: El schema de Prisma define `tableSession TableSession` con `accounts Account[]` (relación 1 a muchos). Sin embargo, en el 100% de los casos de uso actuales, solo se utiliza una única `Account` por sesión (cuenta global de la mesa).  
  * *Decisión congelada*: Se mantiene 1 `Account` activa por `TableSession` para esta fase sin alterar la compatibilidad del schema.
* **Hipótesis H-02 (Cierre de Mesa con Cuenta en Cero)**: Si una mesa se ocupa por error y no tuvo consumos ($0), ¿puede Recepción cerrarla directamente?  
  * *Decisión congelada*: `CloseTableSessionUseCase` permite cerrar la sesión directamente si no hay saldo pendiente adeudado.

---

## 16. RIESGOS DESCUBIERTOS Y MITIGACIONES

1. **Riesgo de Bloqueo Concurrente en Postgres**: Al envolver múltiples tablas en `prisma.$transaction`, dos transacciones simultáneas que toquen las mismas mesas en orden inverso podrían generar deadlocks.  
   * *Mitigación*: Orden de bloqueo determinista en `ChangeSessionTableUseCase` (primero bloquear y liberar `oldTable`, luego ocupar `newTable`, luego actualizar `session`).
2. **Riesgo de Eventos Huérfanos por Fallo de Red**: Si un cliente se desconecta en el milisegundo en que ocurre `ORDER_READY`.  
   * *Mitigación*: Al reconectarse el SSE, se dispara una recarga de snapshot HTTP inmediata.

---

## 17. PROPUESTA DE ORDEN PARA LA FASE 1

Una vez aprobado este documento, la **Fase 1** se ejecutará en el siguiente orden estricto:

1. **Paso 1.1**: Implementar `DomainEvent<T>` tipado estricto en `@restaurant-os/domain` con enum `EventType` consolidado.
2. **Paso 1.2**: Implementar transaccionalidad `prisma.$transaction` en `ChangeSessionTableUseCase`.
3. **Paso 1.3**: Sincronizar transaccionalmente `Order` y `KitchenOrder` en `SendToKitchenUseCase`, `MarkKitchenOrderReadyUseCase` y `DeliverOrderUseCase`.
4. **Paso 1.4**: Unificar transaccionalmente `CloseAccountUseCase` con `TableSession.close()` y `Table.release()`.
5. **Paso 1.5**: Ejecutar suite de pruebas de regresión (`vitest run`).
