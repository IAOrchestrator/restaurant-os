# RESTAURANT OS — AUDITORÍA ARQUITECTÓNICA PHASE 11
## Operational Roles & Workspaces + TableDevice/TableSession Correction

**Fecha:** 2026-08-21
**Auditor:** Kimi (análisis automatizado)
**Regla:** SIN MODIFICACIÓN DE CÓDIGO

---

## 1. ARQUITECTURA ACTUAL DETECTADA

### 1.1 Capas identificadas

| Capa | Estado | Notas |
|------|--------|-------|
| Domain (Identity) | ✅ Implementado | Actor (4 tipos), StaffRole (5 roles), Permission (40), ResourceScope (3) |
| Domain (Aggregates) | ✅ Implementado | 10 aggregates con máquinas de estado |
| Application (Use Cases) | ✅ Implementado | ~40 use cases con event publishing |
| Application (Auth) | ⚠️ Parcial | PermissionChecker + ResourceScoper existen pero NO integrados en rutas |
| Infrastructure (Persistence) | ✅ Implementado | 12 Prisma repositories + mappers |
| Infrastructure (Realtime) | ✅ Implementado | EventBroadcaster + SSE + heartbeat |
| Infrastructure (Auth) | ⚠️ Parcial | Fastify hooks existen pero solo verifican ROLE, no RESOURCE |
| API (Routes) | ⚠️ Parcial | 75+ endpoints, ~85% protegidos con preHandler |
| Frontend (Workspaces) | ⚠️ Parcial | 7 workspaces definidos, solo placeholder pages |
| Frontend (Hooks) | ⚠️ Parcial | useSse sin filtrado por tableSessionId |

### 1.2 Modelo de datos (Prisma)

```
Restaurant
├── Staff (1:N) → StaffRoleAssignment (múltiples roles)
├── Customer (1:N)
├── Table (1:N) → TableDevice (1:1)
├── TableSession (1:N) → Order (1:N), Account (1:1)
├── WaitlistEntry (1:N)
├── PreOrder (1:N)
├── KitchenOrder (1:N)
├── ServiceTask (1:N)
├── EventLog (1:N)
├── Review (1:N)
├── Category (1:N) → Product (1:N)
└── Payment (1:N)
```

### 1.3 Pipeline de eventos

```
Use Case → EventPublisher.publish()
              ↓
    PersistingEventPublisher
              ↓
    ┌─────────┴─────────┐
    ↓                   ↓
  PrismaEventLog    SseEventPublisher
  (persiste en DB)   ↓
                     EventBroadcaster
                     ↓
              ┌──────┴──────┐
              ↓    ↓    ↓   ↓
           Conn1 Conn2 Conn3 Conn4
         (filtro por restaurantId + eventType + tableSessionId)
```

---

## 2. QUÉ ESTÁ CORRECTAMENTE IMPLEMENTADO

| # | Componente | Veredicto |
|---|-----------|-----------|
| 2.1 | Actor con 4 tipos (CUSTOMER, STAFF, TABLE_DEVICE, SYSTEM) | ✅ CORRECTO |
| 2.2 | StaffRole enum con 5 roles | ✅ CORRECTO |
| 2.3 | StaffRoleAssignment para múltiples roles por staff | ✅ CORRECTO |
| 2.4 | Permission enum con 40 permisos (convención domain.action) | ✅ CORRECTO |
| 2.5 | ResourceScope (OWN, RESTAURANT, GLOBAL) | ✅ CORRECTO |
| 2.6 | ROLE_PERMISSIONS matrix completa | ✅ CORRECTO |
| 2.7 | EventBroadcaster con filtrado por restaurantId | ✅ CORRECTO |
| 2.8 | EventBroadcaster con filtrado por eventType | ✅ CORRECTO |
| 2.9 | EventBroadcaster con filtrado por tableSessionId | ✅ CORRECTO |
| 2.10 | broadcastToTableSession() | ✅ CORRECTO |
| 2.11 | Heartbeat SSE cada 30s | ✅ CORRECTO |
| 2.12 | Auto-cleanup de conexiones rotas | ✅ CORRECTO |
| 2.13 | TableDevice model en Prisma | ✅ CORRECTO |
| 2.14 | Order.tableSessionId en Prisma | ✅ CORRECTO |
| 2.15 | TableSession como aggregate con estados | ✅ CORRECTO |
| 2.16 | TableSession.changeWaiter() | ✅ CORRECTO |
| 2.17 | TableSession.close() | ✅ CORRECTO |
| 2.18 | PersistingEventPublisher (persiste + delega) | ✅ CORRECTO |
| 2.19 | 24 EventTypes aprobados | ✅ CORRECTO |
| 2.20 | 7 Workspaces definidos | ✅ CORRECTO |
| 2.21 | WorkspaceGuard con TABLE_DEVICE | ✅ CORRECTO |
| 2.22 | attachActor hook global en Fastify | ✅ CORRECTO |
| 2.23 | requirePermission preHandler | ✅ CORRECTO |
| 2.24 | requireAnyPermission preHandler | ✅ CORRECTO |
| 2.25 | Kitchen routes 100% protegidas | ✅ CORRECTO |
| 2.26 | Service routes 100% protegidas | ✅ CORRECTO |
| 2.27 | Table routes 100% protegidas | ✅ CORRECTO |
| 2.28 | TableSession routes 100% protegidas | ✅ CORRECTO |
| 2.29 | Review routes 100% protegidas | ✅ CORRECTO |

---

## 3. QUÉ ESTÁ INCOMPLETO

| # | Componente | Estado | Impacto |
|---|-----------|--------|---------|
| 3.1 | **ResourceScoper NO instanciado en main.ts** | ❌ No integrado | CRITICAL |
| 3.2 | **PermissionChecker NO instanciado en main.ts** | ❌ No integrado | CRITICAL |
| 3.3 | **PreOrder routes 0% protegidas** | ❌ Sin preHandler | CRITICAL |
| 3.4 | **Orders routes 75% protegidas** (2 rutas sin protección) | ⚠️ Parcial | HIGH |
| 3.5 | **Waitlist routes 88% protegidas** (1 ruta sin protección) | ⚠️ Parcial | HIGH |
| 3.6 | **Billing routes 86% protegidas** (1 ruta sin protección) | ⚠️ Parcial | HIGH |
| 3.7 | **Catalog routes 89% protegidas** (1 ruta sin protección) | ⚠️ Parcial | MEDIUM |
| 3.8 | **useSse NO filtra por tableSessionId** | ❌ Faltante | HIGH |
| 3.9 | **EventLog NO tiene campo tableSessionId** | ❌ Faltante | HIGH |
| 3.10 | **TableSession NO tiene changeTable()** | ❌ Faltante | CRITICAL |
| 3.11 | **TableSession NO tiene addCustomer()** | ❌ Faltante | HIGH |
| 3.12 | **TableSession NO tiene removeCustomer()** | ❌ Faltante | HIGH |
| 3.13 | **EventType faltante: CUSTOMER_REMOVED_FROM_TABLE** | ❌ Faltante | HIGH |
| 3.14 | **EventType faltante: TABLE_CHANGED** | ❌ Faltante | HIGH |
| 3.15 | **Customer entity es solo scaffold** | ⚠️ Vacío | MEDIUM |
| 3.16 | **Table domain entity NO tiene relación con TableDevice** | ⚠️ Parcial | MEDIUM |
| 3.17 | **Order domain entity NO tiene tableId** (solo tableSessionId) | ⚠️ Parcial | MEDIUM |
| 3.18 | **Frontend workspace pages son solo placeholders** | ⚠️ Vacío | LOW |
| 3.19 | **PROJECT_MEMORY.md menciona Mercado Pago como next step** | ⚠️ Inconsistente | LOW |

---

## 4. PROBLEMAS ARQUITECTÓNICOS

### 4.1 CRITICAL: Autorización contextual NO implementada

**Problema:** `requirePermission()` solo verifica si el actor TIENE el permiso. NO verifica si el actor tiene acceso al RECURSO ESPECÍFICO.

**Ejemplo del problema:**
```
Customer A (id: cust-1)
  → TableSession #847
  → GET /api/orders/1002 (Order de Customer B)
  → requirePermission(ORDERS_READ) → ✅ PASS
  → PERO Customer A NO debería ver Order #1002
```

**Causa raíz:**
- `PermissionChecker.hasPermission()` solo verifica ROLE → PERMISSION
- NO verifica: ACTOR + RESOURCE + RESOURCE SCOPE + TABLE SESSION
- `ResourceScoper` existe pero NUNCA se usa en las rutas
- `OperationalResourceScoper.getScope()` devuelve un scope pero NO se compara con el resourceId de la request

**Impacto:** Fuga de información entre clientes. Customer A puede leer orders de Customer B si conoce el ID.

**Fix requerido:**
1. Integrar ResourceScoper en main.ts
2. Crear middleware `requireResourceAccess(resourceType, paramName)`
3. En cada ruta con `:id`, verificar que el actor puede acceder a ESE recurso específico
4. Para CUSTOMER: verificar que el resource pertenece a su TableSession
5. Para TABLE_DEVICE: verificar que el resource pertenece a su TableSession
6. For WAITER: verificar que el resource pertenece a sus TableSessions asignadas

---

### 4.2 CRITICAL: TableSession NO soporta cambio de mesa

**Problema:** `TableSession` NO tiene método `changeTable()`.

**Escenario roto:**
```
ANTES: Table 12 ↔ TableSession #847 ↔ Ana
Operación: Cambiar mesa
DESPUÉS: Table 15 ↔ TableSession #847 ↔ Ana
Resultado actual: ❌ NO SOPORTADO
```

**Causa raíz:**
- TableSession entity solo tiene `occupy()`, `open()`, `close()`, `changeWaiter()`
- NO tiene `changeTable(newTableId)`
- Table entity tiene `assign()` y `occupy()` pero NO `reassignSession()`

**Impacto:** Operación fundamental de restaurante (cambio de mesa) NO funciona.

**Fix requerido:**
1. Agregar `changeTable(newTableId)` a TableSession entity
2. Agregar validación: newTable debe estar AVAILABLE
3. Liberar Table anterior (AVAILABLE)
4. Ocupar nueva Table (OCCUPIED)
5. Emitir evento TABLE_CHANGED
6. Actualizar SSE subscriptions (tableSessionId sigue igual, pero tableId cambia)

---

### 4.3 CRITICAL: PreOrder routes completamente desprotegidas

**Problema:** 0% de las rutas de PreOrder tienen preHandler.

**Rutas afectadas:**
- POST /api/preorders
- GET /api/preorders
- GET /api/preorders/:id
- PATCH /api/preorders/:id/confirm
- PATCH /api/preorders/:id/cancel

**Impacto:** Cualquier actor puede crear, leer, confirmar o cancelar preorders de cualquier restaurante.

**Fix requerido:** Agregar preHandler a todas las rutas de preorders.

---

### 4.4 HIGH: EventLog NO traza tableSessionId

**Problema:** `EventLog` entity NO tiene campo `tableSessionId`.

**Impacto:**
- NO se puede filtrar eventos por TableSession
- NO se puede reconstruir el historial de una sesión
- El audit trail es incompleto
- SSE broadcast por tableSessionId funciona en conexiones pero los eventos NO incluyen el dato

**Fix requerido:**
1. Agregar `tableSessionId` a EventLog entity
2. Agregar `tableSessionId` a Prisma schema
3. Modificar PersistingEventPublisher para extraer tableSessionId del payload
4. Actualizar EventLogRepository para buscar por tableSessionId

---

### 4.5 HIGH: useSse NO conecta por tableSessionId

**Problema:** El hook `useSse` en frontend NO pasa `tableSessionId` como parámetro.

**Código actual:**
```typescript
const { restaurantId, eventTypes } = request.query as { ... };
// tableSessionId NUNCA se pasa
```

**Impacto:**
- Customer workspace recibe TODOS los eventos del restaurante
- Table workspace recibe TODOS los eventos del restaurante
- Fuga de información entre mesas
- Sobrecarga de red innecesaria

**Fix requerido:**
1. Agregar `tableSessionId` como parámetro opcional en useSse
2. Pasar `tableSessionId` desde el workspace al hook
3. El workspace debe conocer su tableSessionId activa

---

### 4.6 HIGH: Eventos faltantes para operaciones clave

**Eventos que NO existen:**

| Evento | Escenario | Severidad |
|--------|-----------|-----------|
| CUSTOMER_REMOVED_FROM_TABLE | Cliente se va de la mesa antes de cerrar cuenta | HIGH |
| TABLE_CHANGED | Cambio de mesa | HIGH |
| CUSTOMER_JOINED_TABLE | Cliente se suma a mesa existente | MEDIUM |
| ORDER_CANCELLED | Cliente/mozo cancela ítem | MEDIUM |
| SERVICE_TASK_CREATED | Mozo crea tarea de servicio | LOW |
| KITCHEN_ORDER_ASSIGNED | Chef asignado a orden | LOW |

---

### 4.7 HIGH: Customer entity es scaffold vacío

**Problema:** `packages/domain/src/customer/index.ts` solo exporta `MODULE_NAME = 'customer'`.

**Impacto:**
- NO hay Customer aggregate
- NO hay Customer domain rules
- NO hay Customer repository
- Customer se maneja solo como string ID en otras entidades
- NO se puede validar que un Customer pertenece a una TableSession

**Fix requerido:**
1. Crear Customer entity con validaciones
2. Crear CustomerRepository port
3. Implementar PrismaCustomerRepository
4. Agregar relación Customer ↔ TableSession

---

### 4.8 MEDIUM: Order domain entity NO tiene tableId

**Problema:** Order entity tiene `tableSessionId` pero NO `tableId`.

**Impacto:**
- Para obtener la mesa de una orden hay que hacer: Order → TableSession → Table
- Esto es correcto conceptualmente pero puede impactar performance
- Kitchen necesita saber la mesa rápidamente para entregar

**Veredicto:** Aceptable si se mantiene la relación indirecta, pero documentar.

---

### 4.9 MEDIUM: Table entity NO conoce TableDevice

**Problema:** Table domain entity NO tiene referencia a TableDevice.

**Impacto:**
- NO se puede validar que una mesa tiene dispositivo asociado
- NO se puede obtener el device desde el dominio de Table

**Veredicto:** Bajo impacto si TableDevice se maneja como entidad separada.

---

### 4.10 LOW: PROJECT_MEMORY.md inconsistencia

**Problema:** El documento menciona "Integrar pasarela de pagos (Mercado Pago)" como next step, pero la decisión arquitectónica actual es DEFERRED.

**Fix:** Actualizar PROJECT_MEMORY.md para reflejar la decisión correcta.

---

## 5. PROBLEMAS DE AUTORIZACIÓN

### 5.1 Matriz de autorización actual (simplificada)

```
                    PERMISSION CHECK    RESOURCE CHECK    TABLE SESSION CHECK
                    ─────────────────    ──────────────    ───────────────────
CUSTOMER            ✅ Sí               ❌ No              ❌ No
TABLE_DEVICE        ✅ Sí               ❌ No              ❌ No
WAITER              ✅ Sí               ❌ No              ❌ No
KITCHEN             ✅ Sí               ❌ No              ❌ No
CASHIER             ✅ Sí               ❌ No              ❌ No
RECEPTIONIST        ✅ Sí               ❌ No              ❌ No
ADMIN               ✅ Sí               ❌ No              ❌ No
```

**Conclusión:** Solo se verifica PERMISSION. NO se verifica RESOURCE ni TABLE SESSION.

### 5.2 Ejemplo de ataque posible

```
Attacker (conocimiento de IDs):
  → Actor: Customer (id: fake-cust)
  → Headers: x-actor-type: CUSTOMER
  → GET /api/orders/1001 (Order de otra mesa)
  → requirePermission(ORDERS_READ) → ✅ PASS
  → Result: Accede a order ajena
```

### 5.3 Ejemplo de ataque cross-restaurant

```
Attacker:
  → Actor: Staff (id: staff-1, restaurant-1)
  → GET /api/orders?restaurantId=restaurant-2
  → Lista orders de otro restaurante
  → requirePermission(ORDERS_READ) → ✅ PASS
  → Result: Fuga de información cross-restaurant
```

---

## 6. PROBLEMAS DE AISLAMIENTO

### 6.1 Cross-restaurant isolation

**Estado:** ❌ NO IMPLEMENTADO

**Problema:** Ninguna ruta verifica que el actor pertenece al restaurantId de la request.

**Rutas afectadas:** TODAS las rutas que usan `restaurantId` como query param.

**Fix:** Agregar validación en preHandler: `request.actor.restaurantId === request.query.restaurantId`

### 6.2 Cross-table-session isolation

**Estado:** ❌ NO IMPLEMENTADO

**Problema:** Ninguna ruta verifica que el actor tiene acceso al tableSessionId del recurso.

**Rutas afectadas:** TODAS las rutas que operan sobre recursos vinculados a TableSession.

**Fix:** Agregar ResourceScoper verification en cada ruta con `:id`.

### 6.3 Cross-customer isolation

**Estado:** ❌ NO IMPLEMENTADO

**Problema:** Customer puede acceder a recursos de otros customers.

**Fix:** Verificar que el resource pertenece a la TableSession del Customer.

---

## 7. PROBLEMAS DE TABLE SESSION

### 7.1 Capacidades faltantes

| Capacidad | Estado | Impacto |
|-----------|--------|---------|
| changeTable() | ❌ NO EXISTE | CRITICAL |
| addCustomer() | ❌ NO EXISTE | HIGH |
| removeCustomer() | ❌ NO EXISTE | HIGH |
| getCustomers() | ❌ NO EXISTE | MEDIUM |
| getOrders() | ❌ NO EXISTE | MEDIUM |
| getAccount() | ❌ NO EXISTE | MEDIUM |
| getServiceTasks() | ❌ NO EXISTE | LOW |

### 7.2 Ciclo de vida completo

```
[CREATED] → TableSession.create()
    ↓
[OPEN] → TableSession.open()
    ↓ (customer added)
[ACTIVE] → Customers, Orders, Service
    ↓ (change table)
[ACTIVE] → Same session, new table ✅ (NO SOPORTADO)
    ↓ (change waiter)
[ACTIVE] → Same session, new waiter ✅ (SOPORTADO)
    ↓ (account paid)
[CLOSED] → TableSession.close()
    ↓
[ARCHIVED] → Table released ✅ (SOPORTADO)
```

**Falla:** changeTable() NO existe.

---

## 8. PROBLEMAS DE TABLE DEVICE

### 8.1 Estado actual

| Aspecto | Estado |
|---------|--------|
| Modelo Prisma | ✅ Existe |
| Domain entity | ❌ NO existe |
| Repository | ❌ NO existe |
| API routes | ❌ NO existen |
| Asociación a TableSession | ⚠️ Implícita (por Table) |
| Autorización | ⚠️ ActorType existe pero NO se usa en rutas |

### 8.2 Flujo esperado vs actual

**Esperado:**
```
TableDevice T12
    ↓ (detecta)
Table 12
    ↓ (busca)
TableSession #847 (ACTIVE)
    ↓ (muestra)
TABLE_WORKSPACE con contexto de #847
```

**Actual:**
```
TableDevice T12
    ↓ (NO hay lógica de detección)
???
    ↓
TABLE_WORKSPACE vacío (placeholder)
```

### 8.3 API faltante para TableDevice

| Endpoint | Propósito |
|----------|-----------|
| GET /api/table-devices/:id/session | Obtener TableSession activa del device |
| POST /api/table-devices/:id/associate | Asociar device a mesa |
| DELETE /api/table-devices/:id/associate | Desasociar device de mesa |

---

## 9. PROBLEMAS DE SSE / REAL TIME

### 9.1 Filtrado funciona pero eventos NO incluyen tableSessionId

**Problema:** `PersistingEventPublisher.publish()` extrae `restaurantId` y `aggregateId` del payload, pero NO extrae `tableSessionId`.

**Código actual:**
```typescript
const restaurantId = (payload.restaurantId as string) || 'system';
const aggregateId = (payload.aggregateId as string) || ...;
// tableSessionId NUNCA se extrae
```

**Impacto:** Aunque el EventBroadcaster puede filtrar por tableSessionId, los eventos NUNCA lo incluyen, por lo que el filtro NUNCA coincide.

### 9.2 Workspace event types incompletos

**TABLE_WORKSPACE** debería recibir:
- ORDER_UPDATED, ORDER_READY, ORDER_DELIVERED
- TABLE_SESSION_CHANGED
- ACCOUNT_REQUESTED, PAYMENT_REGISTERED
- SERVICE_TASK_ASSIGNED (si es para esa mesa)

**CUSTOMER_WORKSPACE** debería recibir:
- ORDER_UPDATED (solo sus orders)
- ORDER_READY
- CUSTOMER_CALLED, CUSTOMER_CONFIRMED
- PAYMENT_REGISTERED
- TABLE_SESSION_CHANGED (si le afecta)

**Falta:** Diferenciación entre "todos los eventos de la mesa" vs "solo los eventos del customer".

---

## 10. PROBLEMAS DE WORKSPACES

### 10.1 Frontend es puramente estructural

| Workspace | Estado | Contenido |
|-----------|--------|-----------|
| customer | ⚠️ Placeholder | Solo texto "Workspace: customer" |
| table | ⚠️ Placeholder | Solo texto "Table Workspace" |
| reception | ⚠️ Placeholder | Solo texto "Workspace: reception" |
| waiter | ⚠️ Placeholder | Solo texto "Workspace: waiter" |
| kitchen | ⚠️ Placeholder | Solo texto "Workspace: kitchen" |
| cashier | ⚠️ Placeholder | Solo texto "Workspace: cashier" |
| admin | ⚠️ Placeholder | Solo texto "Workspace: admin" |

### 10.2 WorkspaceGuard es demasiado simple

**Problema:** Solo verifica `actorType` contra un mapa estático. NO verifica:
- Si el actor tiene permisos para ese workspace
- Si el actor pertenece al restaurante correcto
- Si el workspace está habilitado para ese restaurante

---

## 11. PERMISOS FALTANTES

| Permiso | Razón | Severidad |
|---------|-------|-----------|
| `orders.cancel` | Cancelar ítem de orden | HIGH |
| `customers.read` | Ver datos de customer | MEDIUM |
| `customers.manage` | Gestionar customers | MEDIUM |
| `table_devices.read` | Ver dispositivos de mesa | MEDIUM |
| `table_devices.manage` | Gestionar dispositivos | MEDIUM |
| `events.create` | Crear eventos manuales | LOW |
| `reviews.update` | Modificar review propio | LOW |
| `analytics.export` | Exportar datos | LOW |

---

## 12. PERMISOS EXCESIVOS

| Permiso | Asignado a | Problema | Fix |
|---------|-----------|----------|-----|
| `customer.manage` | RECEPTIONIST | Receptionist puede gestionar customers globalmente | Limitar a customers de su restaurante + contexto |
| `table_sessions.manage` | WAITER | Waiter puede cerrar cualquier sesión | Limitar a sesiones asignadas |
| `accounts.close` | CASHIER | Cashier puede cerrar cuenta sin pago completo | Agregar validación de dominio |

---

## 13. EVENTOS FALTANTES

| Evento | Escenario | Emisor | Receptores | Severidad |
|--------|-----------|--------|------------|-----------|
| CUSTOMER_REMOVED_FROM_TABLE | Cliente abandona mesa | TableSession | Customer, TableDevice, Waiter | HIGH |
| TABLE_CHANGED | Cambio de mesa | TableSession | Customer, TableDevice, Waiter, Reception | HIGH |
| CUSTOMER_JOINED_TABLE | Nuevo cliente a mesa existente | TableSession | Customer, TableDevice, Waiter | MEDIUM |
| ORDER_CANCELLED | Cancelación de ítem | Order | Customer, TableDevice, Kitchen, Waiter | MEDIUM |
| ACCOUNT_UPDATED | Modificación de cuenta | Account | Customer, TableDevice, Cashier | MEDIUM |
| SERVICE_TASK_COMPLETED | Tarea de servicio finalizada | ServiceTask | Waiter, Reception | LOW |
| STAFF_ASSIGNED | Staff asignado a rol | Staff | Admin | LOW |

---

## 14. MATRIZ OPERACIONAL PROPUESTA

### 14.1 Matriz de acciones por actor

| Acción | Customer | Table | Reception | Waiter | Kitchen | Cashier | Admin |
|--------|----------|-------|-----------|--------|---------|---------|-------|
| **Menú** |
| Ver menú | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Pedidos** |
| Crear pedido | ✅ (own) | ✅ (shared) | ❌ | ✅ (assigned) | ❌ | ❌ | ✅ |
| Modificar pedido | ✅ (own) | ✅ (shared) | ❌ | ✅ (assigned) | ❌ | ❌ | ✅ |
| Cancelar ítem | ✅ (own) | ✅ (shared) | ❌ | ✅ (assigned) | ❌ | ❌ | ✅ |
| Confirmar pedido | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Enviar a cocina | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Cocina** |
| Iniciar preparación | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Marcar casi listo | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Marcar listo | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Completar | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Entrega** |
| Entregar pedido | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Servicio** |
| Solicitar mozo | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Crear tarea servicio | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Completar tarea | ❌ | ❌ | ❌ | ✅ (own) | ❌ | ❌ | ✅ |
| **Cuenta** |
| Solicitar cuenta | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Ver cuenta | ✅ (shared) | ✅ (shared) | ❌ | ✅ (assigned) | ❌ | ✅ | ✅ |
| Registrar pago | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Cerrar cuenta | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Mesas** |
| Asignar mesa | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Cambiar mesa | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Liberar mesa | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Waitlist** |
| Agregar a cola | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Llamar cliente | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Confirmar cliente | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Sesiones** |
| Cambiar mozo | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Cerrar sesión | ❌ | ❌ | ❌ | ✅ (assigned) | ❌ | ❌ | ✅ |
| **Catálogo** |
| Gestionar catálogo | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Staff** |
| Gestionar staff | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Analytics** |
| Ver analytics | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Leyenda:**
- ✅ = Permitido
- ❌ = No permitido
- (own) = Solo recursos propios (OWN scope)
- (shared) = Recursos compartidos de la TableSession
- (assigned) = Recursos asignados al actor

---

## 15. RIESGOS FUTUROS

### 15.1 CRITICAL: Escalabilidad del EventBroadcaster

**Riesgo:** EventBroadcaster mantiene todas las conexiones en memoria (Map). En un restaurante con 50 mesas × 5 actores por mesa = 250 conexiones SSE. Con 100 restaurantes = 25,000 conexiones.

**Mitigación:**
- Considerar Redis Pub/Sub para distribuir eventos entre instancias
- Implementar TTL en conexiones inactivas
- Monitorear memory usage

### 15.2 HIGH: JWT Authentication

**Riesgo:** Actualmente la autenticación es por headers planos (`x-actor-type`, `x-actor-id`). Cualquiera puede suplantar cualquier actor.

**Mitigación:**
- Implementar JWT con firma
- Validar token en attachActor
- Refresh tokens para sesiones largas

### 15.3 HIGH: Data consistency en cambio de mesa

**Riesgo:** Si se implementa changeTable() sin transacción, puede quedar la TableSession en estado inconsistente (Table anterior liberada pero nueva no ocupada).

**Mitigación:**
- Usar transacciones Prisma
- Implementar saga pattern si hay múltiples pasos
- Rollback automático en fallo

### 15.4 MEDIUM: Frontend sin autorización

**Riesgo:** El frontend solo muestra/oculta UI basado en WorkspaceGuard. Un usuario técnico puede modificar el frontend y acceder a rutas protegidas.

**Mitigación:**
- SIEMPRE validar en backend (ya se hace parcialmente)
- Agregar Content Security Policy
- No exponer datos sensibles en responses 403

### 15.5 LOW: Prisma schema migrations

**Riesgo:** Cambios en schema (TableDevice, StaffRoleAssignment) requieren migraciones. Si no se manejan correctamente, puede haber data loss.

**Mitigación:**
- Usar Prisma Migrate
- Backup antes de migrar
- Test en staging

---

## 16. RECOMENDACIONES PRIORIZADAS

### Fase A: CRITICAL (Seguridad + Core)

| # | Recomendación | Archivos afectados | Esfuerzo |
|---|--------------|-------------------|----------|
| A1 | **Integrar ResourceScoper en rutas** | `main.ts`, `fastify-auth.ts`, todas las routes | 2-3 días |
| A2 | **Implementar requireResourceAccess middleware** | `fastify-auth.ts`, todas las routes con `:id` | 2 días |
| A3 | **Agregar cross-restaurant validation** | `fastify-auth.ts`, todas las routes | 1 día |
| A4 | **Proteger PreOrder routes (0% → 100%)** | `preorders.ts` | 30 min |
| A5 | **Completar protección de rutas faltantes** | `orders.ts`, `waitlist.ts`, `billing.ts`, `catalog.ts` | 1 hora |

### Fase B: HIGH (Funcionalidad operacional)

| # | Recomendación | Archivos afectados | Esfuerzo |
|---|--------------|-------------------|----------|
| B1 | **Agregar TableSession.changeTable()** | `table-session/entity.ts`, `tables/entity.ts`, use cases | 1 día |
| B2 | **Agregar TableSession.addCustomer()/removeCustomer()** | `table-session/entity.ts` | 4 horas |
| B3 | **Agregar eventos faltantes** | `event/entity.ts`, use cases | 2 horas |
| B4 | **Agregar tableSessionId a EventLog** | `event/entity.ts`, `schema.prisma`, `PersistingEventPublisher` | 3 horas |
| B5 | **Actualizar useSse para filtrar por tableSessionId** | `useSse.ts`, workspace pages | 2 horas |
| B6 | **Implementar Customer entity** | `customer/entity.ts`, repository, use cases | 1 día |

### Fase C: MEDIUM (Calidad + Completitud)

| # | Recomendación | Archivos afectados | Esfuerzo |
|---|--------------|-------------------|----------|
| C1 | **Agregar API routes para TableDevice** | `table-device.ts` (nuevo) | 4 horas |
| C2 | **Implementar frontend workspace pages** | 7 archivos de workspace | 3-5 días |
| C3 | **Agregar permisos faltantes** | `permission.ts`, `role-permissions.ts` | 1 hora |
| C4 | **Actualizar PROJECT_MEMORY.md** | `PROJECT_MEMORY.md` | 30 min |
| C5 | **Agregar tests de integración para autorización** | Nuevos test files | 2 días |

### Fase D: LOW (Polish + Futuro)

| # | Recomendación | Archivos afectados | Esfuerzo |
|---|--------------|-------------------|----------|
| D1 | **Implementar JWT authentication** | `fastify-auth.ts`, `main.ts` | 2 días |
| D2 | **Evaluar Redis para EventBroadcaster** | `event-broadcaster.ts` | 1 día |
| D3 | **Agregar rate limiting** | `main.ts` | 2 horas |
| D4 | **Documentar API con OpenAPI** | Nuevo archivo | 1 día |

---

## 17. RESUMEN EJECUTIVO

### Estado general: ⚠️ ARQUITECTURA FUNCIONAL PERO INSEGURA

| Dimensión | Calificación | Notas |
|-----------|-------------|-------|
| **Domain Model** | 8/10 | Completo, bien estructurado, faltan algunos métodos |
| **Application Layer** | 7/10 | Use cases bien implementados, auth parcialmente integrado |
| **Infrastructure** | 8/10 | SSE funciona, persistencia correcta, auth hooks existen |
| **API Security** | 4/10 | ~85% rutas protegidas, PERO sin verificación de recurso |
| **Authorization** | 3/10 | Permission check existe, resource check NO implementado |
| **TableSession Context** | 6/10 | Concepto correcto, faltan métodos clave (changeTable) |
| **TableDevice** | 4/10 | Modelo existe, sin lógica operacional ni API |
| **SSE/Realtime** | 7/10 | Filtrado funciona, eventos NO incluyen tableSessionId |
| **Frontend** | 2/10 | Estructura existe, contenido vacío |
| **Tests** | 6/10 | Domain tests buenos, faltan tests de integración |

### Hallazgos por severidad

| Severidad | Cantidad |
|-----------|----------|
| CRITICAL | 4 |
| HIGH | 8 |
| MEDIUM | 6 |
| LOW | 4 |
| **TOTAL** | **22** |

### Decisión recomendada

**NO continuar con nuevas funcionalidades** hasta resolver Fase A (CRITICAL).

La arquitectura tiene buenos cimientos pero **la autorización contextual es el cuello de botella** que bloquea la operación segura multi-actor.

---

## 18. INCONSISTENCIA DOCUMENTAL

### PROJECT_MEMORY.md menciona:
> "Integrar pasarela de pagos (Mercado Pago) y pulir el sistema"

### Decisión arquitectónica actual:
> "NO implementar Mercado Pago. Billing solamente registra pagos externos/manuales. Payment processing queda DEFERRED / FUTURO."

**Fix:** Actualizar PROJECT_MEMORY.md para reflejar la decisión correcta y priorizar la seguridad antes que la integración de pagos.

---

*Fin del informe de auditoría.*
*NO se modificó código.*
*Solo análisis y recomendaciones.*
