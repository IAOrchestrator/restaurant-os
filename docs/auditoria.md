# RESTAURANT OS — PHASE 12
# ARQUITECTURA MODULAR POR AGENTES / WORKSPACES FÍSICOS
# MODO: ANÁLISIS ARQUITECTÓNICO — NO MODIFICAR CÓDIGO

## CONTEXTO

El sistema Restaurant OS fue auditado recientemente y se detectó que el repositorio actual NO contiene realmente varias de las implementaciones que habían sido afirmadas anteriormente.

Por lo tanto:

- NO asumir que funcionalidades declaradas previamente están implementadas.
- NO inventar archivos, entidades, endpoints, tests ni módulos.
- El código real del repositorio es la única fuente de verdad.
- En esta fase NO debes modificar código.
- Primero debes analizar y diseñar la arquitectura objetivo.

El objetivo ahora es evolucionar Restaurant OS desde un sistema conceptualmente centralizado hacia una arquitectura modular por AGENTES/WORKSPACES OPERACIONALES.

## CONCEPTO FUNDAMENTAL

Restaurant OS NO debe ser una única aplicación monolítica visual donde todos los roles utilizan la misma interfaz.

Debe existir un CORE central común y, sobre él, distintos módulos operacionales especializados.

Cada agente tendrá su propio workspace adaptado al trabajo que realiza y al dispositivo físico que utiliza.

Ejemplo:

CUSTOMER
    ↓
Customer Workspace
    ↓
celular del cliente

TABLE DEVICE
    ↓
Table Workspace
    ↓
tablet/dispositivo fijo de la mesa

RECEPTION
    ↓
Reception Workspace
    ↓
tablet/celular de recepción

WAITER
    ↓
Waiter Workspace
    ↓
celular/tablet del mozo

KITCHEN
    ↓
Kitchen Workspace / KDS
    ↓
tablet/pantalla de cocina

CASHIER
    ↓
Cashier Workspace
    ↓
tablet/PC/celular de caja

ADMIN
    ↓
Admin Workspace
    ↓
PC/tablet administrativa

## IMPORTANTE

Estos NO deben ser simplemente "pantallas diferentes" dentro de la misma aplicación.

Queremos estudiar si deben convertirse conceptualmente en módulos independientes, cada uno con:

- contexto operacional propio
- permisos propios
- navegación propia
- componentes UI propios
- eventos que consume
- eventos que produce
- acciones permitidas
- modelo de interacción propio
- restricciones de dispositivo
- contexto de sesión
- aislamiento de datos

Pero todos deben compartir el mismo CORE de Restaurant OS.

---

# OBJETIVO DE ESTA FASE

Antes de escribir código quiero que analices profundamente la arquitectura y respondas:

¿CUÁL ES LA MEJOR FORMA DE ESTRUCTURAR RESTAURANT OS COMO UNA PLATAFORMA CENTRAL CON MÓDULOS OPERACIONALES POR AGENTE?

No quiero todavía implementación.

Quiero arquitectura.

---

# 1. SEPARAR CORE DE WORKSPACES

Define claramente qué pertenece al CORE y qué pertenece a cada Workspace.

Analiza como mínimo:

CORE

- Identity
- Authentication
- Authorization
- ResourceScoper
- Restaurant
- Table
- TableSession
- Customer
- TableDevice
- Order
- Account
- Payment
- KitchenOrder
- ServiceTask
- Waitlist
- Event
- EventLog
- EventBroadcaster
- permisos
- roles
- reglas de dominio
- casos de uso
- persistencia
- seguridad multi-tenant

WORKSPACES

- Customer
- Table
- Reception
- Waiter
- Kitchen
- Cashier
- Admin

Determina qué responsabilidades pertenecen exclusivamente al CORE y cuáles deben vivir en cada módulo.

---

# 2. DEFINIR CADA AGENTE COMO MÓDULO

Para cada Workspace analiza:

### CUSTOMER

Debe poder:

- consultar menú
- crear pedido
- modificar pedido propio
- cancelar ítems permitidos
- solicitar mozo
- solicitar cuenta
- consultar estado de pedidos
- consultar cuenta
- recibir eventos de SU contexto

Pero NO debe:

- ver otras mesas
- ver otros customers
- acceder a datos administrativos
- acceder directamente a cocina
- acceder a otros restaurantes

Determina su contexto mínimo.

---

### TABLE

Table Device es un ACTOR TÉCNICO.

No es Customer.

Debe:

- identificarse como dispositivo de una mesa
- resolver la TableSession activa
- mostrar el estado operacional de la mesa
- compartir información permitida con los customers de esa sesión
- recibir eventos de esa TableSession
- emitir acciones permitidas para el dispositivo

Analiza qué diferencia existe entre:

CUSTOMER
vs
TABLE_DEVICE

y cómo debe reflejarse arquitectónicamente.

---

### RECEPTION

Debe concentrarse en:

- mesas
- asignación de mesas
- cambio de mesa
- waitlist
- llegada de clientes
- apertura/cierre operacional de sesiones
- asignación de mozos
- visualización del estado general del salón

NO debería tener acceso irrestricto a:

- cocina interna
- datos privados de customers que no necesita
- administración completa
- analytics administrativos

Define su modelo de contexto.

---

### WAITER

Debe ser un módulo diseñado específicamente para movilidad.

El mozo normalmente estará caminando por el salón con un celular/tablet.

Debe poder:

- ver mesas asignadas
- ver TableSessions asignadas
- tomar pedidos
- modificar pedidos según permisos
- enviar pedidos a cocina
- recibir ORDER_READY
- entregar pedidos
- crear/completar ServiceTasks
- solicitar/cerrar determinadas operaciones de mesa
- cambiar waiter cuando corresponda y tenga autorización

Analiza cómo representar:

WAITER → ASSIGNED TABLE SESSIONS

y cómo evitar que pueda operar sobre mesas no asignadas.

---

### KITCHEN

Debe ser un módulo especializado KDS.

No necesita conocer toda la información del restaurante.

Debe recibir solamente la información necesaria para:

- órdenes pendientes
- órdenes en preparación
- órdenes listas
- prioridades
- tiempos
- retrasos
- estaciones
- asignaciones

Analiza qué eventos consume y qué eventos produce.

---

### CASHIER

Debe concentrarse en:

- Accounts
- Payments
- cierre de cuentas
- estado de pago

Debe registrar pagos manuales/externos.

IMPORTANTE:

NO implementar Mercado Pago.
NO implementar Stripe.
NO implementar gateways.
NO implementar webhooks de pagos externos.

Payments externos quedan DEFERRED.

---

### ADMIN

Debe ser el único workspace con visión administrativa amplia.

Debe poder administrar:

- restaurant
- staff
- roles
- permisos
- catálogo
- configuración
- dispositivos
- analytics
- auditoría

Pero incluso ADMIN debe respetar el aislamiento multi-tenant.

---

# 3. DEFINIR EL CONTEXTO DE CADA AGENTE

Construye una matriz:

| Agent | Identity | Restaurant | TableSession | Resource Scope | Device |
|---|---|---|---|---|---|

Explica exactamente qué contexto posee cada uno.

Especial atención:

CUSTOMER
TABLE_DEVICE
WAITER
RECEPTION
KITCHEN
CASHIER
ADMIN

No asumir que todos necesitan el mismo contexto.

---

# 4. MODELO DE CONTEXTO OPERACIONAL

Quiero que analices si debemos tener algo conceptualmente similar a:

AgentContext

{
  actorId
  actorType
  restaurantId
  workspace
  tableSessionId?
  assignedTableSessionIds?
  permissions
  deviceId?
}

Pero NO lo implementes todavía.

Determina:

- qué campos son obligatorios
- cuáles son opcionales
- cuáles deben venir del token
- cuáles deben resolverse en backend
- cuáles jamás deben confiarse al cliente

---

# 5. ARQUITECTURA DE DISPOSITIVOS

Analiza los dispositivos reales.

Ejemplo:

Cliente:
celular personal

Mozo:
celular/tablet

Recepción:
tablet

Cocina:
tablet/KDS

Caja:
PC/tablet

Mesa:
TableDevice

Admin:
PC

Determina si conviene:

A) una sola PWA con workspaces
B) varias PWAs
C) una aplicación base + módulos
D) frontend monorepo con módulos independientes
E) combinación de las anteriores

Quiero una recomendación arquitectónica fundamentada.

NO elijas simplemente la opción más fácil de programar.

Elegí la que mejor preserve:

- seguridad
- mantenimiento
- independencia de módulos
- evolución futura
- experiencia móvil
- aislamiento
- realtime
- despliegue
- escalabilidad

---

# 6. EVENT-DRIVEN ARCHITECTURE

Analiza el sistema como:

CORE
 ↓
DOMAIN EVENTS
 ↓
EVENT BUS / EVENT BROADCASTER
 ↓
WORKSPACES

Cada workspace debería recibir solamente los eventos relevantes.

Construye una matriz:

| Event | Customer | Table | Reception | Waiter | Kitchen | Cashier | Admin |
|---|---|---|---|---|---|---|---|

Incluye como mínimo:

- CUSTOMER_JOINED_TABLE
- CUSTOMER_REMOVED_FROM_TABLE
- TABLE_CHANGED
- ORDER_CREATED
- ORDER_UPDATED
- ORDER_CONFIRMED
- ORDER_SENT_TO_KITCHEN
- ORDER_STARTED
- ORDER_READY
- ORDER_DELIVERED
- ORDER_CANCELLED
- SERVICE_TASK_CREATED
- SERVICE_TASK_ASSIGNED
- SERVICE_TASK_COMPLETED
- ACCOUNT_REQUESTED
- ACCOUNT_UPDATED
- PAYMENT_REGISTERED
- ACCOUNT_CLOSED
- TABLE_SESSION_CHANGED

Si consideras que faltan eventos, proponelos.

---

# 7. TABLESESSION COMO CONTEXTO TEMPORAL

Analiza profundamente este concepto:

TableSession es el aggregate root temporal que representa la actividad de una mesa.

Una TableSession puede contener:

- múltiples Customers
- Orders
- Account
- ServiceTasks
- Waiter assignment

La TableSession puede cambiar de mesa.

Ejemplo:

TABLE 12
 ↓
SESSION #847
 ↓
CUSTOMERS
ORDERS
ACCOUNT

Cambio:

TABLE 12 → TABLE 15

Debe continuar siendo:

SESSION #847

NO crear una nueva sesión.

NO perder:

- orders
- account
- customers
- historial
- contexto

Analiza las implicancias de esto para cada Workspace.

---

# 8. CUSTOMER VS TABLEDEVICE

Quiero una definición arquitectónica inequívoca.

CUSTOMER:

persona.

TABLE_DEVICE:

dispositivo técnico.

Ejemplo:

Mesa 12
 ↓
TableDevice T12
 ↓
TableSession #847
 ↓
Customer A
Customer B
Customer C

El TableDevice NO debe convertirse en Customer.

El Customer puede cambiar de dispositivo.

El TableDevice puede seguir siendo el mismo aunque cambien los clientes.

Analiza este desacoplamiento.

---

# 9. SEGURIDAD

La seguridad debe ser transversal a todos los Workspaces.

Regla absoluta:

EL CLIENTE NUNCA DEFINE SU PROPIO CONTEXTO DE AUTORIZACIÓN.

No confiar en:

x-restaurant-id
x-actor-id
x-table-session-id
x-role

La identidad debe provenir de autenticación verificable.

Luego:

Actor
 ↓
Authentication
 ↓
ActorContext
 ↓
Permission
 ↓
ResourceScoper
 ↓
Resource
 ↓
Use Case

Analiza esta cadena.

También analiza:

CUSTOMER → solo su sesión
TABLE_DEVICE → solo su mesa/sesión activa
WAITER → solo sesiones asignadas
RECEPTION → contexto del restaurante
KITCHEN → recursos de cocina del restaurante
CASHIER → billing del restaurante
ADMIN → administración del restaurante

---

# 10. SSE

SSE NO debe ser un canal global.

Analiza:

GET /api/sse

vs

GET /api/sse?tableSessionId=...

Pero recuerda:

el parámetro enviado por el cliente NO es suficiente para autorizar.

Debe existir:

actor autenticado
 ↓
resource authorization
 ↓
subscription

Determina cómo debería funcionar el handshake.

---

# 11. FRONTEND / MONOREPO

Analiza cómo organizar:

apps/
packages/

sin escribir código.

Una posible estructura conceptual podría ser:

apps/
  api/
  customer/
  table/
  reception/
  waiter/
  kitchen/
  cashier/
  admin/

o:

apps/
  web/

packages/
  workspace-customer/
  workspace-table/
  workspace-reception/
  workspace-waiter/
  workspace-kitchen/
  workspace-cashier/
  workspace-admin/

o alguna combinación.

Quiero que determines cuál es mejor y POR QUÉ.

---

# 12. NO DUPLICAR EL CORE

Los Workspaces NO deben duplicar:

- reglas de negocio
- permisos
- entidades
- acceso directo a Prisma
- autorización
- EventLog

El CORE debe seguir siendo la autoridad.

Workspace:

UI + interacción + adaptación operacional.

CORE:

verdad + reglas + seguridad + persistencia.

---

# 13. FLUJOS OPERACIONALES

Diseña conceptualmente estos flujos:

### FLUJO A
Customer escanea QR de mesa.

### FLUJO B
Customer se une a una TableSession existente.

### FLUJO C
Customer crea pedido.

### FLUJO D
Waiter recibe pedido.

### FLUJO E
Waiter confirma y envía a cocina.

### FLUJO F
Kitchen prepara.

### FLUJO G
Kitchen marca READY.

### FLUJO H
Waiter entrega.

### FLUJO I
Customer solicita cuenta.

### FLUJO J
Cashier registra pago.

### FLUJO K
Reception cambia mesa.

### FLUJO L
Customer abandona mesa pero la TableSession continúa.

En cada flujo indicar:

ACTOR
WORKSPACE
USE CASE
AGGREGATE
EVENT
DESTINATARIOS

---

# 14. RESULTADO ESPERADO

NO escribir código.

NO crear archivos.

NO afirmar que algo está implementado.

Quiero un documento arquitectónico que determine:

1. Arquitectura recomendada.
2. Separación CORE / WORKSPACES.
3. Responsabilidad de cada Workspace.
4. Contexto de cada Actor.
5. Modelo de dispositivos.
6. Modelo TableSession.
7. Modelo Customer/TableDevice.
8. Modelo de autorización.
9. Modelo SSE.
10. Modelo de eventos.
11. Organización del monorepo.
12. Flujos operacionales.
13. Dependencias entre módulos.
14. Qué debe permanecer centralizado.
15. Qué puede evolucionar independientemente.
16. Riesgos arquitectónicos.
17. Orden recomendado de implementación.

## REGLA FINAL

NO programes todavía.

NO modifiques el repositorio.

NO supongas que las afirmaciones de auditorías anteriores son ciertas.

Primero analiza el código REAL existente y luego compara:

ESTADO ACTUAL
vs
ARQUITECTURA OBJETIVO

Finalmente presenta:

### A. LO QUE EXISTE REALMENTE
### B. LO QUE FALTA
### C. ARQUITECTURA OBJETIVO
### D. DECISIONES ARQUITECTÓNICAS
### E. ORDEN DE IMPLEMENTACIÓN
### F. RIESGOS
### G. PREGUNTAS QUE DEBEMOS RESOLVER ANTES DE PROGRAMAR

La prioridad absoluta sigue siendo:

SEGURIDAD
→ AISLAMIENTO
→ CORE
→ CONTEXTO DE AGENTES
→ EVENTOS
→ WORKSPACES
→ UI

No avanzar a UI simplemente porque los workspaces sean visualmente atractivos.