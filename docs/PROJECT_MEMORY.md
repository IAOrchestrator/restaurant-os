# PROJECT MEMORY

## 1. PROJECT IDENTITY

**Name:** Restaurant OS

**Description:** Sistema operativo modular para la operación integral de establecimientos gastronómicos.

**Objective:** Construir una base técnica sólida, modular y preparada para soportar restaurantes, pizzerías, cafeterías, heladerías, bares y otros establecimientos configurables.

**Current Scope:** Phase 1 — Foundation. Estructura, arquitectura, configuración, esquema de base de datos, API mínima, frontend mínimo, tests, documentación.

## 2. CURRENT STATUS

**CURRENT PHASE:** Phase 12 — Modular Architecture & Production Hardening (Phases 1, 2, 3 & 4 Completed & Verified)
- Documento técnico y guía de despliegue disponible en `docs/SYSTEM_OVERVIEW_AND_DEPLOYMENT_GUIDE.md`.
- Auditoría técnica disponible en `docs/auditado22082026.md`.
- **Phase 1 (Seguridad Criptográfica & JWT)**: `JwtService` en `@restaurant-os/infrastructure`, middleware Fastify `extractTokenPayload` / `extractActor`, endpoints `/api/auth/*` (`staff-login`, `device-auth`, `customer-session-token`, `me`), sincronización automática de tokens en frontend (`useContextState`, `useApi`).
- **Phase 2 (Handshake SSE Protegido & Streaming Contextual)**: `EventBroadcaster` con aislamiento estricto multi-tenant y multi-sesión, handshake SSE con validación JWT vía header `Authorization` o `?token=<JWT>`, hook `useSse` con token inyectado.
- **Phase 3 (Modularización de Workspaces & Registro Central)**: Registro central `WORKSPACES_REGISTRY` con barrel exports desacoplados por workspace, validación de permisos en UI, renderizado dinámico en `App.tsx`.
- **Phase 4 (Test E2E Multi-Dispositivo & Preparación para Producción)**: Test de integración E2E del ciclo de vida multi-actor completo (`apps/api/tests/e2e-multi-actor-flow.test.ts`), plantilla de variables de entorno `.env.example`, 238 tests pasando al 100% en 36 suites, build de producción `vite build` verificado.

**CURRENT VERSION:** 0.2.0

**LAST UPDATED:** 2026-08-22 (Phase 1-4 Modular Architecture Hardening & E2E Concurrency Flow Verified)

## 3. CURRENT DEVELOPMENT PHASE

Phase 12 Completion — Ready for Staging / Cloud Deployment (Supabase + Railway / Vercel).

Se completó con éxito la implementación modular en 4 fases: seguridad con tokens JWT firmados criptográficamente, streaming en tiempo real SSE autenticado y contextual, workspaces frontend modularizados con registro desacoplado, suite de pruebas E2E multi-actor concurrente y configuración completa para despliegue en la nube.

## 4. IMPLEMENTED

| Component | Status |
|-----------|--------|
| Monorepo (Turborepo + pnpm) | scaffolded, configured |
| Clean Architecture layers | scaffolded, configured |
| Domain modules (16) | scaffolded |
| Prisma schema | implemented |
| Database enums | implemented |
| API health endpoint | implemented, tested |
| API version endpoint | implemented, tested |
| Frontend React app | implemented, tested |
| Zod contracts | implemented |
| Shared UI package | scaffolded |
| Config package | implemented |
| Application ports | implemented |
| Infrastructure stubs | implemented |
| EventLog model | implemented (schema) |
| Documentation (ADR, Architecture, Domain) | implemented |
| PROJECT_MEMORY.md | implemented |
| Tests (compilation, imports, enums, startup) | implemented |
| EventLog domain aggregate | implemented |
| EventLog repository (Prisma) | implemented |
| PersistingEventPublisher | implemented |
| Notification module scaffolding | implemented |
| Event API routes (4 endpoints) | implemented |
| EventLog domain tests | implemented |
| KitchenOrder domain aggregate | implemented |
| KitchenOrder repository (Prisma) | implemented |
| Kitchen API routes (7 endpoints) | implemented |
| ServiceTask domain aggregate | implemented |
| ServiceTask repository (Prisma) | implemented |
| Service API routes (6 endpoints) | implemented |
| Kitchen + Service domain tests | implemented |
| EventBroadcaster (SSE) | implemented |
| Real-time event streaming (/api/events/stream) | implemented |
| Connection filtering (restaurantId, eventType) | implemented |
| Heartbeat keep-alive | implemented |
| EventBroadcaster tests | implemented |
| Actor (Customer/Staff/TableDevice/System) | implemented |
| StaffRole (5 roles, multiple per staff) | implemented |
| Permission enum (32 permissions) | implemented |
| ResourceScope (OWN/RESTAURANT/GLOBAL) | implemented |
| RoleBasedPermissionChecker | implemented |
| OperationalResourceScoper | implemented |
| Fastify auth hooks (attachActor, requirePermission) | implemented |
| All operational routes protected with preHandler | implemented |
| Frontend workspaces (7 workspaces) | implemented |
| useSse hook with workspace filtering | implemented |
| TableDevice model (Prisma) | implemented |
| TableSession as shared operational context | implemented |
| SSE filtering by tableSessionId | implemented |
| ActorType.TABLE_DEVICE | implemented |
| Multi-Waiter concurrent terminals & handover | implemented |
| Table floorplan live assignment & release | implemented |
| One-click waitlist seating transition | implemented |
| Dual HTTP POST/PATCH route aliases | implemented |
| Staff API route (/api/staff) | implemented |
| Complete database seed (7 staff, 8 tables, 4 devices, 16 dishes) | implemented |
| Modern Dark Glassmorphism UX/UI Redesign (7 Workspaces) | implemented (Tailwind CSS, HSL Tokens, Plus Jakarta Sans, JetBrains Mono, Lucide Icons) |
| 238 automated unit, integration & E2E tests (36 suites) | implemented (100% passing) |

## 5. IN PROGRESS

Ninguno. El sistema frontend, backend y UX/UI está 100% operativo y probado.

## 6. PENDING (Roadmap a Producción)

- Integrar pasarela de pagos digitales (Mercado Pago / Stripe / QR interoperable)
- Integrar impresión física de comandas y tickets térmicos (ESC/POS)
- Módulo de control de inventario, stock y escandallo de recetas
- Facturación fiscal electrónica oficial (AFIP / SAT / SII / DIAN)
- Notificaciones automáticas por WhatsApp / SMS para fila de espera
- Dashboard analítico gerencial y reportes de rentabilidad
- Multi-sucursal y arquitectura SaaS para franquicias

## 7. DOMAIN MODEL

Entidades principales:

- Restaurant
- Staff (ADMIN, RECEPTIONIST, WAITER, KITCHEN, CASHIER)
- Customer
- Table
- TableSession
- WaitlistEntry
- PreOrder
- Order
- Account
- Payment
- Catalog
- Review
- EventLog

Relaciones: ver `docs/domain/domain-model.md`

## 8. STATE MACHINES

### Waitlist
```
PREPARED → WAITING → CALLED → CUSTOMER_CONFIRMED → WAITING_FOR_SEATING → SEATED

Alternativas:
WAITING → CANCELLED
WAITING → TAKEAWAY
CALLED → CANCELLED
CALLED → EXPIRED
CALLED → NO_SHOW
```

### Table
```
AVAILABLE → ASSIGNED → OCCUPIED
```
Liberación: cuando TableSession pasa a CLOSED.

### TableSession
```
ASSIGNED → OCCUPIED → OPEN → CLOSING → CLOSED
```

### PreOrder
```
DRAFT → READY → REVIEWING → CONFIRMED
DRAFT → CANCELLED
```

### Order
```
DRAFT → CONFIRMED → SENT_TO_KITCHEN → PREPARING → READY → DELIVERED
DRAFT → CANCELLED
```

### Account
```
OPEN → REQUESTED → PAID → CLOSED
```

## 9. BUSINESS RULES (CONFIRMED)

- Una mesa física puede tener múltiples TableSessions a lo largo del tiempo.
- Una TableSession puede tener múltiples Orders.
- Un PreOrder no es automáticamente una Order de cocina.
- Cocina solamente recibe Orders confirmadas.
- Una moza puede ser reemplazada sin cerrar la TableSession.
- El cambio de moza debe conservar historial.
- La mesa se libera cuando se cierra la TableSession.
- Un cliente puede cancelar su espera.
- El sistema puede cancelar una espera por falta de respuesta.
- Un cliente puede cambiar a modalidad Takeaway cuando el flujo lo permita.
- El pago inicialmente se registra pero no se procesa dentro del sistema.
- Una TableSession tiene exactamente una Account.
- Account solo puede cerrarse cuando está PAID.
- Se permiten múltiples pagos parciales hasta cubrir el total.

## 10. EVENT MODEL

Eventos aprobados:

CUSTOMER_JOINED_WAITLIST
CUSTOMER_CALLED
CUSTOMER_CONFIRMED
CUSTOMER_CANCELLED_WAIT
CUSTOMER_SELECTED_TAKEAWAY
TABLE_ASSIGNED
CUSTOMER_SEATED
WAITER_ASSIGNED
WAITER_CHANGED
PREORDER_CREATED
PREORDER_UPDATED
ORDER_CONFIRMED
ORDER_SENT_TO_KITCHEN
KITCHEN_RECEIVED
KITCHEN_STARTED
ORDER_NEARLY_READY
ORDER_READY
ORDER_DELIVERED
ADDITIONAL_ORDER_CREATED
CUSTOMER_ADDED_TO_TABLE
ACCOUNT_REQUESTED
PAYMENT_REGISTERED
TABLE_CLOSED
TABLE_RELEASED
REVIEW_CREATED

## 11. MODULES

| Module | Status | Dependencies | Implemented | Pending |
|--------|--------|-------------|-------------|---------|
| FOUNDATION | implemented | none | structure, config, tests | — |
| IDENTITY | scaffolded | FOUNDATION | — | domain logic |
| RESTAURANT | scaffolded | FOUNDATION | schema | domain logic, API |
| STAFF | scaffolded | RESTAURANT | schema | domain logic, API |
| CUSTOMER | scaffolded | FOUNDATION | schema | domain logic, API |
| TABLE | scaffolded | RESTAURANT | schema | domain logic, API |
| TABLE_SESSION | scaffolded | TABLE, CUSTOMER, STAFF | schema | domain logic, API |
| WAITLIST | implemented | RESTAURANT, CUSTOMER | schema, domain aggregate, repository port, API routes | tests de integración |
| CATALOG | implemented | RESTAURANT | schema, domain aggregates (Category + Product), repository ports, API routes | tests de integración |
| PREORDER | implemented | RESTAURANT, CUSTOMER | schema, domain aggregate, repository port, API routes | tests de integración |
| ORDER | implemented | TABLE_SESSION, CATALOG | schema, domain aggregate, repository port, API routes | tests de integración |
| SERVICE | implemented | TABLE_SESSION, STAFF | schema, domain aggregate, repository, API routes | integration tests |
| IDENTITY | implemented | ALL | Actor (Customer/Staff/TableDevice/System) | JWT integration |
| AUTH | implemented | ALL | Permission (32), StaffRole (5), ResourceScope, RoleBasedPermissionChecker, Fastify hooks | integration tests |
| TABLE_DEVICE | implemented | TABLE, TABLE_SESSION | schema, domain concept, SSE filtering | device registration API |
| REALTIME | implemented | ALL | EventBroadcaster, SseEventPublisher, SSE routes, heartbeat | load testing |
| KITCHEN | implemented | ORDER | schema, domain aggregate, repository, API routes | integration tests |
| BILLING | implemented | TABLE_SESSION, ACCOUNT | schema, domain aggregate, repository port, API routes | tests de integración |
| NOTIFICATION | scaffolded | multiple | — | abstraction, implementation |
| REVIEW | implemented | RESTAURANT, CUSTOMER | schema, domain aggregate, repository port, API routes | tests de integración |
| EVENT | scaffolded | multiple | schema (EventLog) | publisher, consumers |
| ANALYTICS | scaffolded | multiple | module structure, approved metrics list | metrics implementation, aggregations |
| EVENT | implemented | multiple | EventLog aggregate, Prisma repository, PersistingEventPublisher, API routes | integration tests |
| NOTIFICATION | scaffolded | multiple | abstraction (NotificationService, NotificationChannel), InMemoryChannel, MultiChannelService | real channels (push, SMS, email) |

## 12. ARCHITECTURE

- Monorepo: Turborepo + pnpm workspaces
- Modular Monolith
- Clean Architecture (Domain → Application → Infrastructure)
- TypeScript strict
- Backend: Node.js + Fastify
- Frontend: React + Vite (NO Next.js)
- Database: PostgreSQL
- ORM: Prisma (centralized in `@restaurant-os/database`)
- Validation: Zod
- Testing: Vitest
- Package Manager: pnpm

## 13. ARCHITECTURE DECISIONS

### ADR-001: Modular Monolith instead of Microservices
- Status: Accepted
- Reason: Strong domain cohesion and rapid iteration during initial development.
- Reference: `docs/decisions/ADR-001-monolith-modular.md`

## 14. DATABASE MODEL

Entidades principales (PostgreSQL + Prisma):

- Restaurant, Staff, Customer, Table, TableSession, WaitlistEntry, PreOrder, Order, Account, Payment, EventLog, Review

Relaciones importantes:
- Restaurant centraliza casi todas las entidades (multi-tenant ready)
- TableSession vincula Table, Order, Account
- Customer vincula WaitlistEntry, PreOrder, Order, Review

Decisiones:
- UUID para todos los IDs públicos
- JSONB para payload de EventLog
- Índices en: restaurantId, status, createdAt, aggregateId, eventType
- No usar IDs incrementales como identificadores públicos
- Schema Prisma centralizado en `@restaurant-os/database` para evitar duplicación y dependencias circulares

## 15. API CONTRACTS

Endpoints implementados:

| Method | Route | Purpose | Module | Status |
|--------|-------|---------|--------|--------|
| GET | /health | Health check | Foundation | implemented |
| GET | /version | API version | Foundation | implemented |
| POST | /api/tables | Create table | Table | implemented |
| GET | /api/tables | List tables by restaurant | Table | implemented |
| GET | /api/tables/:id | Get table by id | Table | implemented |
| PATCH | /api/tables/:id/assign | Assign table | Table | implemented |
| PATCH | /api/tables/:id/occupy | Occupy table | Table | implemented |
| POST | /api/table-sessions | Create session | TableSession | implemented |
| GET | /api/table-sessions | List sessions by restaurant | TableSession | implemented |
| GET | /api/table-sessions/:id | Get session by id | TableSession | implemented |
| PATCH | /api/table-sessions/:id/close | Close session | TableSession | implemented |
| PATCH | /api/table-sessions/:id/change-waiter | Change waiter | TableSession | implemented |
| POST | /api/waitlist | Join waitlist | Waitlist | implemented |
| GET | /api/waitlist | List waitlist by restaurant | Waitlist | implemented |
| GET | /api/waitlist/:id | Get entry by id | Waitlist | implemented |
| PATCH | /api/waitlist/:id/call | Call customer | Waitlist | implemented |
| PATCH | /api/waitlist/:id/confirm | Confirm customer | Waitlist | implemented |
| PATCH | /api/waitlist/:id/cancel | Cancel wait | Waitlist | implemented |
| PATCH | /api/waitlist/:id/takeaway | Select takeaway | Waitlist | implemented |
| PATCH | /api/waitlist/:id/seat | Seat customer | Waitlist | implemented |
| POST | /api/preorders | Create pre-order | PreOrder | implemented |
| GET | /api/preorders | List pre-orders by restaurant | PreOrder | implemented |
| GET | /api/preorders/:id | Get pre-order by id | PreOrder | implemented |
| PATCH | /api/preorders/:id/confirm | Confirm pre-order | PreOrder | implemented |
| PATCH | /api/preorders/:id/cancel | Cancel pre-order | PreOrder | implemented |
| POST | /api/orders | Create order | Order | implemented |
| GET | /api/orders | List orders by restaurant | Order | implemented |
| GET | /api/orders/:id | Get order by id | Order | implemented |
| PATCH | /api/orders/:id/send-to-kitchen | Send to kitchen | Order | implemented |
| PATCH | /api/orders/:id/start-preparing | Start preparing | Order | implemented |
| PATCH | /api/orders/:id/ready | Mark ready | Order | implemented |
| PATCH | /api/orders/:id/deliver | Deliver order | Order | implemented |
| PATCH | /api/orders/:id/cancel | Cancel order | Order | implemented |
| POST | /api/billing/accounts | Create account | Billing | implemented |
| GET | /api/billing/accounts | List accounts by restaurant | Billing | implemented |
| GET | /api/billing/accounts/:id | Get account by id | Billing | implemented |
| POST | /api/billing/accounts/:id/orders | Add order to account | Billing | implemented |
| PATCH | /api/billing/accounts/:id/request-payment | Request payment | Billing | implemented |
| POST | /api/billing/accounts/:id/payments | Register payment | Billing | implemented |
| PATCH | /api/billing/accounts/:id/close | Close account | Billing | implemented |
| POST | /api/catalog/categories | Create category | Catalog | implemented |
| GET | /api/catalog/categories | List categories by restaurant | Catalog | implemented |
| GET | /api/catalog/categories/:id | Get category by id | Catalog | implemented |
| PATCH | /api/catalog/categories/:id | Update category | Catalog | implemented |
| POST | /api/catalog/products | Create product | Catalog | implemented |
| GET | /api/catalog/products | List products by restaurant | Catalog | implemented |
| GET | /api/catalog/products/:id | Get product by id | Catalog | implemented |
| PATCH | /api/catalog/products/:id | Update product | Catalog | implemented |
| PATCH | /api/catalog/products/:id/availability | Change availability | Catalog | implemented |
| POST | /api/reviews | Create review | Review | implemented |
| GET | /api/reviews | List reviews by restaurant or customer | Review | implemented |
| GET | /api/reviews/:id | Get review by id | Review | implemented |
| PATCH | /api/reviews/:id | Update review | Review | implemented |
| POST | /api/events | Create event log | Event | implemented |
| GET | /api/events | List events by restaurant | Event | implemented |
| GET | /api/events/:id | Get event by id | Event | implemented |
| GET | /api/events/aggregate/:aggregateId | List events by aggregate | Event | implemented |
| POST | /api/kitchen/orders | Create kitchen order | Kitchen | implemented |
| GET | /api/kitchen/orders | List kitchen orders | Kitchen | implemented |
| GET | /api/kitchen/orders/:id | Get kitchen order | Kitchen | implemented |
| PATCH | /api/kitchen/orders/:id/start | Start preparing | Kitchen | implemented |
| PATCH | /api/kitchen/orders/:id/nearly-ready | Mark nearly ready | Kitchen | implemented |
| PATCH | /api/kitchen/orders/:id/ready | Mark ready | Kitchen | implemented |
| PATCH | /api/kitchen/orders/:id/complete | Complete kitchen order | Kitchen | implemented |
| PATCH | /api/kitchen/orders/:id/assign | Assign to staff | Kitchen | implemented |
| POST | /api/service/tasks | Create service task | Service | implemented |
| GET | /api/service/tasks | List service tasks | Service | implemented |
| GET | /api/service/tasks/:id | Get service task | Service | implemented |
| PATCH | /api/service/tasks/:id/assign | Assign task | Service | implemented |
| PATCH | /api/service/tasks/:id/start | Start task | Service | implemented |
| PATCH | /api/service/tasks/:id/complete | Complete task | Service | implemented |
| PATCH | /api/service/tasks/:id/cancel | Cancel task | Service | implemented |
| GET | /api/events/stream | SSE stream (real-time events) | Realtime | implemented |
| GET | /api/events/stream/stats | SSE connection stats | Realtime | implemented |

Rutas futuras (scaffolded, no funcionales):
/api/restaurants, /api/customers, /api/waitlist, /api/tables, /api/table-sessions, /api/catalog, /api/preorders, /api/orders, /api/kitchen, /api/service, /api/billing, /api/reviews

Contratos detallados: `packages/contracts`

## 16. INTEGRATIONS

Payments: Not integrated.
Mercado Pago: Not integrated.
Notifications: Internal abstraction only (InMemoryEventPublisher).
External APIs: None.

## 17. ANALYTICS

Métricas aprobadas pero NO implementadas:

- tiempo de espera
- tiempo de convocatoria
- tiempo hasta sentarse
- tiempo de respuesta de moza
- tiempo de cocina
- tiempo de entrega
- tiempo de ocupación de mesa
- tiempo de cobro
- rotación de mesas

## 18. OPEN QUESTIONS

### OQ-001 — Multi-tenancy model
Question: ¿Un Restaurant puede tener múltiples sucursales como entidades separadas o como configuración dentro del mismo Restaurant?
Why it matters: Afecta el diseño del schema de Restaurant y la autorización.
Status: OPEN

### OQ-002 — Kitchen display integration
Question: ¿La cocina se integrará con pantallas externas (KDS) o será solo una vista web?
Why it matters: Afecta la arquitectura de notificaciones y el modelo de eventos de cocina.
Status: OPEN

### OQ-003 — Payment processing scope
Question: ¿El sistema eventualmente procesará pagos o solo registrará pagos externos?
Why it matters: Afecta la complejidad del módulo Billing y las integraciones necesarias.
Status: OPEN

### OQ-004 — Real-time updates
Question: ¿Se usará WebSockets, Server-Sent Events, o polling para actualizaciones en tiempo real (cola, cocina, mesas)?
Why it matters: Afecta la infraestructura y el diseño del frontend.
Status: RESOLVED — Server-Sent Events (SSE) seleccionado por simplicidad, compatibilidad con HTTP/ proxies, y unidireccionalidad adecuada para notificaciones push. TableSessionId filtering added for workspace-specific delivery.
Date: 2026-08-21

## 19. KNOWN PROBLEMS

### KP-001
Problem: Prisma client import in infrastructure package referenced non-existent package.
Impact: Compilation would fail.
Resolution: Created `@restaurant-os/database` package as single source of truth for Prisma schema and client. Moved schema from apps/api to packages/database. All consumers now import from `@restaurant-os/database`.
Status: RESOLVED
Date: 2026-08-20

## 20. REJECTED DECISIONS

Decision: Microservices
Status: REJECTED
Reason: Unnecessary complexity during initial development.
Date: 2026-08-20

Decision: Next.js for frontend
Status: REJECTED
Reason: Phase 1 requires a minimal SPA; Next.js adds unnecessary complexity. Re-evaluate for future phases if SSR/SSG needed.
Date: 2026-08-20

Decision: Redux global state
Status: REJECTED
Reason: Unnecessary for Phase 1. Use React context or local state until proven otherwise.
Date: 2026-08-20

## 21. DEVELOPMENT HISTORY

Phase 0 — Project Setup & Requirements
Status: Completed
Date: 2026-08-20

Phase 1 — Foundation
Status: Completed
Date: 2026-08-20

Phase 2 — Table & TableSession Domain
Status: Completed
Date: 2026-08-20
Notes: Aggregates con máquinas de estado, repositorios Prisma, use cases, API routes, tests de dominio.

Phase 3 — Waitlist Domain
Status: Completed
Date: 2026-08-20
Notes: WaitlistEntry aggregate con máquina de estados completa (10 estados), 6 use cases, repositorio Prisma, 9 endpoints API, tests de dominio.

Phase 4 — Order & PreOrder Domain
Status: Completed
Date: 2026-08-20
Notes: PreOrder aggregate (5 estados), Order aggregate (7 estados), 10 use cases, repositorios Prisma, 14 endpoints API, tests de dominio. Reglas: PreOrder NO es automáticamente Order, cocina solo recibe Orders confirmadas.

Phase 5 — Billing Domain
Status: Completed
Date: 2026-08-20
Notes: Account aggregate (4 estados), Payment record, 5 use cases, repositorio Prisma, 8 endpoints API, tests de dominio. Reglas: una TableSession tiene una Account, múltiples pagos parciales permitidos, sistema NO procesa pagos.

Phase 6 — Catalog Domain
Status: Completed
Date: 2026-08-20
Notes: Category aggregate, Product aggregate, 5 use cases, repositorios Prisma, 10 endpoints API, tests de dominio. Reglas: precio no negativo, producto disponible/no disponible, categorías ordenables.

Phase 7 — Review Domain + Analytics Scaffolding
Status: Completed
Date: 2026-08-20
Notes: Review aggregate (rating 1-5, comment), 2 use cases, repositorio Prisma, 4 endpoints API, tests de dominio. Analytics module scaffolded with approved metrics list.

Phase 8 — Event System + Notifications
Status: Completed
Date: 2026-08-20
Notes: EventLog aggregate (24 tipos de eventos), 4 use cases, PrismaEventLogRepository, PersistingEventPublisher (persiste + delega), InMemoryNotificationChannel, MultiChannelNotificationService, 4 endpoints API (/api/events), tests de dominio. Notification module scaffolded con abstracción de canales.

Phase 9 — Kitchen + Service Domains
Status: Completed
Date: 2026-08-20
Notes: KitchenOrder aggregate (5 estados: RECEIVED→STARTED→NEARLY_READY→READY→COMPLETED), 6 use cases, PrismaKitchenOrderRepository, 7 endpoints API (/api/kitchen). ServiceTask aggregate (6 tipos, 5 estados: PENDING→ASSIGNED→IN_PROGRESS→COMPLETED/CANCELLED), 5 use cases, PrismaServiceTaskRepository, 6 endpoints API (/api/service). Métricas de tiempo: preparationTimeMs, totalKitchenTimeMs, responseTimeMs, completionTimeMs, totalServiceTimeMs.

Phase 10 — Real-time Updates
Status: Completed
Date: 2026-08-20
Notes: EventBroadcaster con SSE (Server-Sent Events), endpoint /api/events/stream con filtrado por restaurantId y eventType, heartbeat cada 30s, endpoint /api/events/stream/stats para monitoreo. SseEventPublisher integrado con PersistingEventPublisher para broadcast automático de todos los eventos del sistema. 6 tests de infraestructura para EventBroadcaster.

Phase 12 — Modular Architecture & Production Hardening
- Auditoría técnica completa disponible en docs/auditado22082026.md
Status: Completed
Date: 2026-08-22
Notes:
- Phase 1 (Criptografía & JWT): JwtService, Fastify Auth middleware, REST endpoints /api/auth/*, token handling en cliente.
- Phase 2 (SSE Handshake): EventBroadcaster multi-tenant & session isolation, token validation en /api/events/stream, streaming contextual.
- Phase 3 (Workspaces Modularization): Registro central WORKSPACES_REGISTRY, barrel exports por workspace, renderizado dinámico en App.tsx.
- Phase 4 (E2E Multi-Device Suite & Cloud Readiness): Suite E2E e2e-multi-actor-flow.test.ts (flujo completo Recepción → Comensal → Mozo → Cocina → Mozo → Caja → Liberación de Mesa), .env.example para Supabase/Railway/Vercel, 238 tests pasando 100%.

## 22. NEXT DEVELOPMENT STEP
 
**Fases de la Auditoría 12 Completadas con Éxito (100%):**
- **Fase 1 (Seguridad Criptográfica & JWT)**: Tokens firmados HMAC-SHA256 con contexto tipado para Staff, TableDevice y Customer.
- **Fase 2 (Handshake SSE & Streaming Contextual)**: SSE protegido con token handshake y filtrado multi-sesión.
- **Fase 3 (Modularización de Workspaces Frontend)**: WORKSPACES_REGISTRY y separación desacoplada de workspaces.
- **Fase 4 (Test E2E Multi-Actor & Preparación para Producción)**: Test de integración E2E automatizado y validación de variables de entorno.

**Próximos Pasos para Despliegue en la Nube:**
1. **Paso 1: Supabase Database Setup** (Crear proyecto en Supabase y ejecutar `pnpm --filter @restaurant-os/database prisma migrate deploy` usando `DIRECT_URL`).
2. **Paso 2: Backend Deployment en Railway / Render** (Conectar repositorio, configurar variables de entorno de `.env.example` y desplegar `apps/api`).
3. **Paso 3: Frontend Deployment en Vercel** (Configurar `VITE_API_URL` apuntando a la API en Railway y desplegar `apps/web`).
4. **Paso 4: Seed Data & Prueba en Producción en Vivo** (Ejecutar seed de datos demo y validar la interacción multi-dispositivo en tiempo real).


