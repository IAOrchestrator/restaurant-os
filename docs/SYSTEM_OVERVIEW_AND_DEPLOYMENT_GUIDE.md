# 🚀 Restaurant OS — Documento Técnico Integral & Guía de Despliegue

**Versión del Sistema:** `v0.1.0`  
**Arquitectura:** Clean Architecture / Hexagonal Monorepo (Turborepo + pnpm)  
**Stack Principal:** Node.js, TypeScript, Fastify, Prisma, PostgreSQL, React 19, Vite, Server-Sent Events (SSE).  
**Fecha de Actualización:** Agosto 2026  

---

## 📑 Tabla de Contenidos
1. [Resumen Ejecutivo & Arquitectura](#1-resumen-ejecutivo--arquitectura)
2. [Matriz de Funcionalidades Implementadas (Completas y Verificadas)](#2-matriz-de-funcionalidades-implementadas)
3. [Funcionalidades Faltantes & Roadmap de Producción (Fases D y E)](#3-funcionalidades-faltantes--roadmap-de-producción)
4. [Guía de Despliegue en Producción (GitHub + Supabase + Vercel + Backend)](#4-guía-de-despliegue-en-producción)
5. [Auditoría de Calidad y Tests](#5-auditoría-de-calidad-y-tests)

---

## 1. Resumen Ejecutivo & Arquitectura

Restaurant OS es un sistema operativo integral, modular y en tiempo real diseñado para establecimientos gastronómicos (restaurantes, pizzerías, cafeterías, bares, franquicias). 

El sistema sigue los principios de **Clean Architecture (Arquitectura Hexagonal)** con aislamiento estricto por capas:
- **`packages/domain`**: Entidades ricas, value objects, máquinas de estado inmutables, reglas de negocio y errores de dominio.
- **`packages/application`**: Casos de uso desacoplados, interfaces de puertos (repositories, event publishers) y scoping de recursos operacionales.
- **`packages/infrastructure`**: Implementaciones concretas con Prisma ORM, emisor de eventos SSE en memoria (`EventBroadcaster`), autenticación basada en roles (RBAC) y hooks de Fastify.
- **`packages/contracts`**: Esquemas de validación tipados de entrada/salida usando Zod.
- **`packages/database`**: Esquema Prisma, migraciones y seed de base de datos relacional.
- **`packages/config`**: Gestión centralizada de variables de entorno y configuración.
- **`apps/api`**: API REST rápida y ligera montada sobre Fastify, con soporte SSE para eventos en tiempo real.
- **`apps/web`**: Aplicación web React (Vite) con 7 workspaces interactivos especializados por rol operativo.

```mermaid
graph TD
  Web[apps/web - React Workspaces] -->|HTTP / SSE| API[apps/api - Fastify]
  API --> Application[packages/application - Use Cases]
  API --> Infrastructure[packages/infrastructure - Prisma & SSE]
  Application --> Domain[packages/domain - Core Entities & Rules]
  Infrastructure --> Domain
  Infrastructure --> Database[(PostgreSQL - Supabase / Local)]
  API --> Contracts[packages/contracts - Zod Schemas]
```

---

## 2. Matriz de Funcionalidades Implementadas

A continuación se detalla el estado actual de todas las capacidades operativas desarrolladas:

### 🛡️ A. Seguridad, Identidad & RBAC (Role-Based Access Control)
- **Multi-Actor Framework:** Soporte nativo para 3 tipos de actores:
  - `STAFF`: Personal del restaurante (Admin, Recepción, Mozo, Cocina, Caja).
  - `TABLE_DEVICE`: Dispositivos físicos / Tablets fijas en mesas.
  - `CUSTOMER`: Comensales con teléfonos móviles.
- **Matriz de Permisos Granulares:** 32 permisos específicos asignados por rol con validación en cada endpoint vía Fastify hooks (`requirePermission`).
- **Resource Scoping & Aislamiento Multi-Tenant:** Validación estricta de `restaurantId` y filtrado contextual (un mozo solo opera sus mesas o el salón asignado; una tablet solo opera su propia sesión).

---

### 🛎️ B. Recepción & Lista de Espera Virtual
- **Fila de Espera en Vivo:** Registro de clientes en espera con cantidad de comensales, teléfono y notas.
- **Gestión de Estados de Espera:** Flujo completo de transiciones (`WAITING` $\rightarrow$ `CALLED` $\rightarrow$ `SEATED` o `CANCELLED` / `TAKEAWAY`).
- **Llamador de Comensales:** Acción para notificar/llamar al cliente cuando su mesa está lista.
- **Plano de Salón en Tiempo Real:** Visualización gráfica de todas las mesas del restaurante con indicador de capacidad y estado por código de color:
  - 🟢 **AVAILABLE (Libre):** Botón para abrir sesión asignando mozo.
  - 🔴 **OCCUPIED (Ocupada):** Información del mozo asignado y comensales con botón para liberar mesa.
  - 🟡 **ASSIGNED (Asignada):** Mesa reservada o asignada en preparación.

---

### 🍽️ C. Gestión Multi-Mozo & Toma de Comandas
- **Terminales Concurrentes de Mozo:** Cada mozo (ej: Mateo, Lucas, Sofía) puede abrir su propia sesión en su terminal/teléfono móvil.
- **Filtro Inteligente de Mesas:**
  - `👤 Mis Mesas Asignadas`: Muestra únicamente las mesas a cargo del mozo activo.
  - `🌐 Todo el Salón`: Vista general de todas las mesas ocupadas del restaurante.
- **Traspaso Dinámico de Mesas:**
  - Botón **"🙋 Tomar esta Mesa"** para asistir a mesas no asignadas.
  - Menú desplegable **"Ceder Mesa a..."** para transferir la atención a otro mozo con registro histórico de asignaciones (`waiterAssignments`).
- **Toma de Comandas Digital:**
  - Navegación ágil por carta/menú con precios en tiempo real.
  - Selector de cantidades y aclaraciones particulares para cocina (ej: *"sin sal"*, *"término medio"*).
  - Envío directo a cocina con un solo clic con atribución de autoría al mozo.
- **Bandeja de Tareas de Servicio:** Notificaciones de llamado de comensales o avisos de platos listos para servir con botón de resolución rápida (`✓ Atendido`).

---

### 👨‍🍳 D. Cocina KDS (Kitchen Display System)
- **Tablero Kanban en Tiempo Real:** Visualización en vivo de pedidos divididos en columnas operativas:
  - 📥 **Pendiente:** Nuevos pedidos entrantes desde mozos o tablets.
  - 🔥 **En Preparación:** Platos tomados por cocineros para elaborar.
  - ⏳ **Casi Listo:** Alerta de aviso previo al mozo para acercarse a cocina.
  - 🚀 **Listo:** Platos terminados listos para ser llevados a la mesa.
  - ✅ **Completado:** Historial de comandas entregadas.
- **Detalle de Comanda:** Lista de ítems, notas especiales de cocción, mesa de origen y tiempo transcurrido con código de alerta visual por demoras.

---

### 📱 E. Tablets de Mesa & Auto-Pedido del Cliente (Self-Service)
- **Resolución Automática de Sesión:** La tablet identifica su mesa y vincula automáticamente la sesión activa (`GET /api/table-devices/:id/session`).
- **Carta Digital Interactiva:** Visualización del menú categorizado con descripciones y precios.
- **Auto-Comanda:** El comensal puede armar su pedido y enviarlo a cocina sin esperar al mozo.
- **Botones de Asistencia Rápida:**
  - 🙋 **Llamar al Mozo:** Dispara una alerta inmediata en la terminal de mozos (`ServiceTask`).
  - 🧾 **Pedir la Cuenta:** Notifica tanto al mozo como a caja para preparar el cobro.
- **Encuesta de Satisfacción & Reseñas:** Formulario para calificar el servicio (1 a 5 estrellas) y dejar comentarios guardados en el repositorio de reviews.

---

### 💵 F. Caja, Cobro & Cierre de Cuentas
- **Cuentas por Mesa:** Consolidación automática de todos los pedidos y consumos de la sesión.
- **Cálculo de Propinas:** Selector rápido de porcentajes de propina (10%, 15%, 20% o personalizado).
- **Múltiples Métodos de Pago:**
  - 💵 Efectivo (Cash)
  - 💳 Tarjeta de Débito / Crédito
  - 📱 Transferencia / QR
  - 👥 Pago Dividido (Split Bill entre comensales)
- **Cierre y Liberación:** Registro del pago en `Account`, emisión del evento de facturación y liberación automática de la mesa física en el salón.

---

### ⚡ G. Motor de Eventos en Tiempo Real (SSE) & Auditoría
- **EventLog Inmutable:** Registro secuencial de cada evento de dominio (`CUSTOMER_CALLED`, `TABLE_ASSIGNED`, `ORDER_SENT_TO_KITCHEN`, `ACCOUNT_CLOSED`, etc.).
- **Server-Sent Events (SSE):** Canal persistente `/api/events/stream` con reconexión automática y heartbeat para sincronizar todas las terminales sin recargar la página.

---

## 3. Funcionalidades Faltantes & Roadmap de Producción

Para llevar Restaurant OS a una versión comercial completa en producción (Fases D y E), se contemplan las siguientes extensiones modulares:

```mermaid
gantt
  title Roadmap hacia Versión de Producción (Fases D & E)
  dateFormat  YYYY-MM-DD
  section Fase D (Comercial & Hardware)
  Pasarela de Pagos (MercadoPago / Stripe) :d1, 2026-09-01, 14d
  Impresión Térmica ESC/POS (Comanderas) :d2, after d1, 10d
  Control de Stock & Escandallo (Recetas) :d3, after d2, 14d
  section Fase E (Escala & Fiscal)
  Facturación Fiscal Electrónica (AFIP/SAT/SII) :e1, 2026-10-01, 14d
  Notificaciones WhatsApp / SMS (Fila Virtual) :e2, after e1, 7d
  Dashboard de BI, Reportes & Métricas :e3, after e2, 10d
  Multi-Sucursal & Franquicias SaaS :e4, after e3, 14d
```

### 🔴 1. Integración de Pasarelas de Pago Digitales
- **Mercado Pago (Latam) & Stripe (Global):**
  - Generación de QR dinámico interoperable en la cuenta de mesa o tablet.
  - Webhooks para confirmación instantánea de pago y cierre automático de la cuenta.
  - Integración con terminales de cobro inteligentes (Point Smart / Clover).

### 🔴 2. Impresión Física de Tickets (ESC/POS)
- **Módulo de Comanderas Térmicas:**
  - Envío automático de comandas a impresoras térmicas de cocina (platos calientes), barra (tragos/bebidas) y postres mediante protocolo ESC/POS (vía red Ethernet/Wi-Fi o USB con agente local ligero).
  - Impresión de precuenta y ticket fiscal de control.

### 🔴 3. Control de Inventario, Recetas & Escandallo
- **Stock en Tiempo Real:** Descuento automático de insumos / materias primas al confirmar una orden de cocina (ej: 1 Pizza Margarita descuenta 200g de harina, 100g de mozzarella y 80g de tomate).
- **Alertas de Rotura de Stock:** Deshabilitación automática de platos en la carta digital si un ingrediente crítico se agota.
- **Gestión de Proveedores y Órdenes de Compra.**

### 🔴 4. Facturación Fiscal Electrónica
- **Conexión con Entes Tributarios Oficiales:**
  - 🇦🇷 AFIP / ARCA (Facturas A, B, C vía WebServices con CAE y código QR).
  - 🇲🇽 SAT (CFDI 4.0).
  - 🇨🇱 SII / 🇨🇴 DIAN según el país de despliegue.

### 🔴 5. Notificaciones Automáticas por WhatsApp / SMS
- **Aviso en Fila de Espera:** Envío automático de mensaje WhatsApp vía Twilio o Meta Cloud API: *"¡Hola Juan! Tu mesa para 4 personas en La Trattoria está lista. Acércate a recepción."*

### 🔴 6. Business Intelligence & Reportería Gerencial
- **Métricas Operativas:**
  - Facturación por turno (Almuerzo vs Cena), día y mes.
  - Platos más vendidos (Menú Engineering / Matriz BCG: Estrellas vs Perros).
  - Tiempos promedio de rotación de mesa y tiempo de despacho de cocina por estación.
  - Productividad y ventas generadas por mozo.

### 🔴 7. Multi-Sucursal & Arquitectura SaaS
- Selector de sucursal en barra superior para cadenas y franquicias gastronómicas.
- Panel de control corporativo para sincronizar cartas y precios centralizados.

---

## 4. Guía de Despliegue en Producción

Esta guía detalla cómo publicar Restaurant OS en **GitHub**, conectar la base de datos a **Supabase**, desplegar el Frontend en **Vercel** y hostear la API con soporte SSE.

---

### Paso 1: Subir el Código a GitHub

1. **Verificar el archivo `.gitignore` raíz:**
   Asegúrate de que contenga:
   ```gitignore
   node_modules
   dist
   .env
   .turbo
   *.log
   ```

2. **Inicializar y subir el repositorio:**
   Abre una terminal en la raíz del proyecto (`c:\Users\adrian\Documents\proyectos IA\restaurant-os`):
   ```bash
   git init
   git add .
   git commit -m "feat: Restaurant OS v0.1.0 complete Clean Architecture implementation"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/restaurant-os.git
   git push -u origin main
   ```

---

### Paso 2: Configurar la Base de Datos PostgreSQL en Supabase

1. Crea una cuenta gratuita en [supabase.com](https://supabase.com) y crea un nuevo proyecto (ej: `restaurant-os-prod`).
2. Ve a **Project Settings $\rightarrow$ Database**.
3. Copia las cadenas de conexión:
   - **Connection String (Direct - Puerto 5432):** Para ejecutar migraciones Prisma.
     ```
     postgresql://postgres:[TU_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
     ```
   - **Connection String (Transaction Pooler - Puerto 6543):** Para la API en producción.
     ```
     postgresql://postgres.[PROJECT_REF]:[TU_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```

4. **Ejecutar migraciones y sembrar datos en Supabase:**
   En tu terminal local o entorno de CI/CD:
   ```bash
   # Configura temporalmente la variable DATABASE_URL con la conexión directa de Supabase
   $env:DATABASE_URL="postgresql://postgres:[TU_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"

   # Ejecuta las migraciones de Prisma
   npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma

   # Ejecuta el seed de datos iniciales
   node packages/database/prisma/seed.js
   ```

---

### Paso 3: Desplegar el Backend API (Fastify + SSE)

> [!IMPORTANT]
> Fastify utiliza **Server-Sent Events (SSE)** con conexiones HTTP persistentes de larga duración. Por este motivo, el backend debe desplegarse en un servicio con soporte para WebSockets/Streaming continuo como **Railway**, **Render**, **Fly.io** o un **VPS (DigitalOcean / AWS EC2)**, mientras que el frontend estático va a **Vercel**.

#### Opción A: Despliegue en Railway (Recomendado - 1 Clic)
1. Conecta tu repositorio de GitHub en [Railway.app](https://railway.app).
2. Selecciona **Root Directory:** `/` o `apps/api`.
3. **Build Command:** `pnpm install && pnpm --filter @restaurant-os/api build` (o `npx turbo run build --filter=@restaurant-os/api...`).
4. **Start Command:** `node apps/api/dist/main.js` (o `pnpm --filter @restaurant-os/api start`).
5. **Variables de Entorno en Railway:**
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Cadena de conexión de Supabase en puerto 6543 o 5432)*
   - `CORS_ORIGIN`: `https://tu-frontend.vercel.app`
   - `JWT_SECRET`: `tu_clave_secreta_super_segura_2026`
6. Railway te otorgará una URL pública (ej: `https://api-production-xxxx.up.railway.app`).

---

### Paso 4: Desplegar el Frontend Web en Vercel

1. Inicia sesión en [Vercel](https://vercel.com) y haz clic en **Add New $\rightarrow$ Project**.
2. Importa tu repositorio de GitHub `restaurant-os`.
3. **Configuración del Proyecto en Vercel:**
   - **Framework Preset:** `Vite`
   - **Root Directory:** Haz clic en *Edit* y selecciona `apps/web`.
   - **Build Command:** `npm run build` (o `pnpm run build`)
   - **Output Directory:** `dist`
4. **Variables de Entorno (Environment Variables):**
   - `VITE_API_URL`: `https://api-production-xxxx.up.railway.app` *(la URL de tu backend desplegado en el Paso 3)*
5. **Configuración de Rutas SPA (`apps/web/vercel.json`):**
   Asegúrate de que exista el archivo `apps/web/vercel.json` para que el enrutador de React soporte recargas de página:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
6. Haz clic en **Deploy**. ¡Tu aplicación estará 100% online y accesible desde cualquier computadora, tablet o teléfono celular!

---

## 5. Auditoría de Calidad y Tests

El proyecto cuenta con una cobertura completa de pruebas unitarias y de integración que validan todas las reglas de negocio, transiciones de estado, permisos RBAC y casos de uso:

- **Suites de Prueba:** `31 test suites`
- **Total de Tests Automatizados:** `217 tests`
- **Tasa de Aprobación:** `100% PASS`
- **Validación de Tipos TypeScript:** `0 errores en tsc -b`

```
 ✓ packages/domain/tests/account.test.ts (13 tests)
 ✓ packages/domain/tests/waitlist.test.ts (15 tests)
 ✓ packages/domain/tests/order.test.ts (15 tests)
 ✓ packages/domain/tests/table-session.test.ts (12 tests)
 ✓ packages/domain/tests/event-log.test.ts (8 tests)
 ✓ packages/domain/tests/preorder.test.ts (13 tests)
 ✓ packages/domain/tests/kitchen-order.test.ts (8 tests)
 ✓ packages/infrastructure/tests/event-broadcaster.test.ts (6 tests)
 ✓ packages/infrastructure/tests/auth.test.ts (12 tests)
 ✓ packages/domain/tests/product.test.ts (13 tests)
 ✓ packages/domain/tests/review.test.ts (13 tests)
 ✓ packages/domain/tests/table.test.ts (10 tests)
 ✓ packages/domain/tests/service-task.test.ts (7 tests)
 ✓ packages/domain/tests/table-device.test.ts (5 tests)
 ✓ apps/api/tests/api-auth.test.ts (8 tests)
 ✓ packages/domain/tests/category.test.ts (10 tests)
 ✓ packages/application/tests/table-device-use-cases.test.ts (4 tests)
 ✓ packages/application/tests/session-customer-use-cases.test.ts (3 tests)
 ✓ packages/application/tests/application.test.ts (8 tests)
 ✓ packages/domain/tests/customer.test.ts (4 tests)
 ✓ packages/domain/tests/domain.test.ts (5 tests)
 ✓ packages/domain/tests/role-permissions.test.ts (5 tests)
 ✓ packages/contracts/tests/contracts.test.ts (3 tests)
 ✓ packages/domain/tests/actor.test.ts (4 tests)
 ✓ packages/domain/tests/resource-scope.test.ts (4 tests)
 ✓ packages/domain/tests/permission.test.ts (3 tests)
 ✓ apps/web/src/App.test.tsx (2 tests)

 Test Files  31 passed (31)
      Tests  217 passed (217)
```
