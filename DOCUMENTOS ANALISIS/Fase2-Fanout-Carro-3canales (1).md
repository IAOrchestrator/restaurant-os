# FASE 2 - FAN-OUT KDS + CARRO GENÉRICO + 3 CANALES - CON DICCIONARIO CONGELADO
## Compatible 100% con FASE 1 V2 FINAL + SITUACIÓN 2 SALÓN 30 MESAS

> Este MD cierra: Productos genéricos (restaurant/heladería/pizzería) -> Carro Pre-Orden -> Deriva en Orden Mesa / Retiro / Delivery + Fan-out KDS por sector + Módulos aislados por cualidades

---

## 0. DICCIONARIO CONGELADO (base Fase 1)

- **PRE-ORDEN / INTENT #P-12**: Intención editable 24hs, solo Admin ve, QR `qr_abc123` único vivo, no va a cocina.
- **QR RECONVERTIBLE**: Un cliente = un QR vivo, se borra anterior nace nuevo, muere en OCUPADA CONFIRMADA o PEDIDO_PAGADO.
- **PEDIDO = TAKEAWAY**: Siempre para llevar. Sale a KDS solo si PAGADO. Si no retira, informe NO_RETIRADO_PAGADO.
- **MESA OCUPADA**: Cliente sentado M5, QR muere, pasa a ser M5.
- **COMANDA = DINE_IN**: Mesa ocupada, sale a KDS cuando Mozo pide cocina sin esperar pago. M5-01 CERRADA no editable, agregados M5-02 append-only.
- **OCUPO MESA**: REQUEST Mozo->Caja, Caja acepta siempre lock central, broadcast MESAS LIBRES a Recepción.
- **Cuenta informativa a celu**: Info, pago fuera sistema efectivo/posnet externo.
- **Certificación**: Cajero confirma posnet + Mozo confirma + Cajero certifica MESA LIBRE + MOZO LIBRE con timeout 5 min.

---

## 1. PRODUCTOS GENÉRICOS - Sirve restaurant, heladería, pizzería

Admin PC crea productos con categoría y sector KDS:

```json
Producto {
  id: "muzza",
  nombre: "Muzza",
  rubro: "pizzería/restaurant/heladería",
  categoria: "PIZZAS",
  sectorKDS: "PIZZAS",
  variantes: ["chica","grande","con borde"],
  agregados: ["queso extra","jamón","mostaza"],
  precioBase: 8000,
  precioAgregados: {queso:1000},
  tiempoPrep: 15,
  disponible: true
}

Producto {
  id: "kilo_helado",
  nombre: "Kilo Helado",
  categoria: "HELADOS",
  sectorKDS: "HELADOS",
  variantes: ["1/4","1/2","1kg"],
  agregados: ["cucuruchos","salsas"],
  tiempoPrep: 3
}

Producto {
  id: "coca",
  categoria: "BEBIDAS",
  sectorKDS: "BEBIDAS",
  tiempoPrep: 1
}
```

Admin define sectores Tienda: `["PIZZAS","BEBIDAS","HELADOS","CAFE"]`
Ofertas manuales solo Admin: "2x1 Muzza" aplica a carro genérico.

---

## 2. CARRO PRE-ORDEN GENÉRICO - INTENT 24hs

Cliente registrado Google Gmail auto o manual (datos quedan en base restaurant) arma carro en app cliente:

```
Carro PRE-ORDEN #P-12 qr_abc123 {
  items: [
    {producto: "muzza", variante: "grande", agregados: ["queso extra"], cant:1},
    {producto: "coca", cant:2}
  ],
  editable: true 24hs,
  estado: INTENT,
  QR vivo: qr_abc123
}
```

Carro es genérico, no sabe canal aún. Es intención Fase 1.
Si cierra local sin convertir, se borra (cleanup 24hs).

---

## 3. DERIVA CARRO EN 3 ÓRDENES - Mismo núcleo genérico

Núcleo Fase 1: `Order {type: TAKEAWAY | DINE_IN | DELIVERY, id, items[], sectorFanout}`

### A) Orden MESA / COMANDA DINE_IN (Salón 30 mesas 6 mozos)

```
Cliente con carro #P-12 entra -> se sienta M5 libre (MODO LIBRE) o Recepción asigna M5 (MODO DIRIGIDO)
Mozo 02 -> Caja: OCUPO MESA M5 2 pax qr_abc123
Caja: M5 OCUPADA CONFIRMADA (QR muere, pasa a M5) -> Recepción "29/30 libres" + Mozo 03 "M5 la tomó Mozo 02"
Mozo 02 toma carro y pide cocina: COMANDA M5-01 CERRADA [1 Muzza grande+queso + 2 Coca]
Fan-out: T-M5-01-PIZZAS 1 Muzza, T-M5-01-BEBIDAS 2 Coca
KDS PIZZAS -> Mozo: EN HORNO -> LISTO
KDS BEBIDAS -> Mozo: LISTO
Mozo entrega, cliente CONSUME
Cliente agrega: "mostaza" -> M5-02 append-only [mostaza] -> Fan-out PIZZAS
Cliente app: "Pedir cuenta" -> Mozo->Caja "M5 pide cuenta" -> Caja->Celu "M5 $9000 detalle M5-01+M5-02" info
Cliente paga en Caja fuera sistema
Cajero confirma posnet M5 $9000 + Mozo confirma M5 + Cajero certifica "Mesa 5 Mozo 02 pago OK"
Caja -> Recepción M5 LIBRE + MOZO LIBRE "30/30 libres" + guarda informe standby tiempos KDS
Recepción llama siguiente #13
```

Estados: INTENT #P-12 -> OCUPADA M5 -> COMANDA M5-01 CERRADA append-only M5-02 -> CONSUMO -> CUENTA INFO -> PAGADA CERTIFICADA -> MESA LIBRE

### B) Orden RETIRO / PEDIDO TAKEAWAY

```
Cliente carro elige RETIRO -> va a Caja
Caja: paga fuera sistema -> marca PEDIDO_PAGADO #L-45 TA_QR_45 (QR reconvertido, anterior muerto)
Caja -> KDS PIZZAS/BEBIDAS: #L-45 PAGADO fan-out T-L-45-PIZZAS, T-L-45-BEBIDAS (solo después de pago Fase 1)
KDS -> Barra Retiro: LISTO
Barra -> Cliente: TV "#L-45 LISTO" + push + cartel grande app "RETIRAR EN BARRA - SE ENFRÍA"
Barra -> Caja: ENTREGADO o NO_RETIRADO_PAGADO informe standby se tira culpa cliente
```

Estados: INTENT -> DEFINITIVO #L-45 PAGADO -> KDS -> LISTO -> ENTREGADO

### C) Orden DELIVERY / PEDIDO DELIVERY

```
Cliente carro elige DELIVERY + dirección
Caja paga fuera -> PEDIDO_PAGADO #D-45 TA_QR_D45
Caja -> KDS después pago fan-out
KDS LISTO -> Repartidor (módulo aislado)
Repartidor -> Cliente casa
Barra no interviene
```

Cadena 4 pasos: CLIENTE <-> CAJA <-> KDS <-> REPARTIDOR <-> CLIENTE

---

## 4. FAN-OUT KDS POR SECTOR - TRIGGERS DISTINTOS SIN CONTRADICCIÓN

| Canal | Trigger KDS | Fase 1 |
|-------|-------------|--------|
| PEDIDO TAKEAWAY | Caja PAGADO -> KDS | Pedido solo sale si paga OK |
| COMANDA DINE_IN | Mozo pide cocina -> KDS sin esperar pago | No es pedido, es comanda mesa ocupada OK |
| PEDIDO DELIVERY | Caja PAGADO -> KDS | Igual que takeaway OK |

Fan-out: Una comanda M5-01 [Muzza+Coca] -> T-M5-01-PIZZAS + T-M5-01-BEBIDAS cada KDS cola FIFO.
Batch: 3x Muzza en 2 min = "3x Muzza" en KDS PIZZAS.
Sincronización: Si bebida lista 1min y pizza 15min, Mozo entrega parcial o espera completo según cualidad categoría MOZO (Admin define).

Regla modificación Fase 1:
- Antes EN PREPARACIÓN: editable
- Después EN PREPARACIÓN/LISTO: no se edita M5-01, se crea M5-02 append-only

---

## 5. MÓDULOS AISLADOS EN CELU + DASHBOARD PC + CLIENTE REGISTRO

**Cliente registro**: Google Gmail auto 1 click o manual, datos en base restaurant. Ve solo su carro, QR, cuenta info, cartel grande.

**Módulos personal celu aislados por categoría cualidades creada por Admin PC:**

```
Admin PC crea:
Categoría MOZO_01 cualidades: [OCUPO_MESA_SECTOR_M1-M5, COMANDA_DINE_IN_M1-M5, PEDIR_CUENTA_M1-M5, CONFIRMAR_PAGO_M1-M5, VER_SOLO_M1-M5]
Categoría MOZO_02: M6-M10 etc (6 mozos 5 mesas c/u para 30 mesas)
Categoría COCINA_PIZZAS: [VER_KDS_PIZZAS, MARCAR_EN_PREP, MARCAR_LISTO]
Categoría COCINA_BEBIDAS: [VER_KDS_BEBIDAS...]
Categoría CAJA: [VER_TODAS_MESAS_30, CONFIRMAR_PAGO_POSNET, CERTIFICAR_MESA_LIBRE_MOZO_LIBRE, VER_MESAS_LIBRES_BROADCAST]
Categoría RECEPCIÓN: [VER_COLA_P, VER_MESAS_LIBRES_CONTADOR, ASIGNAR_DIRIGIDO, CANCELAR_PASAR_LLEVAR]
Categoría BARRA_RETIRO: [VER_PEDIDOS_PAGADOS_L, MARCAR_LISTO_TV]
Categoría REPARTIDOR: [VER_DELIVERY_PAGADO_D, VER_DIRECCION, MARCAR_ENTREGADO]
Categoría DASHBOARD/ADMIN PC: [CREAR_PRODUCTOS, CREAR_CATEGORIAS, OFERTAS_MANUALES, VER_INFORMES_STANDBY]
```

Aislamiento: Mozo 1 app no ve Mozo 2, no ve Caja, no ve KDS HELADOS. Mensajes bidireccionales filtrados por cualidad, no broadcast total.

---

## 6. CADENAS BIDIRECCIONALES COMPLETAS 3 CANALES

**SALÓN 5 canales (con fan-out):**
```
CLIENTE <-> RECEPCIÓN (QR puerta, MESAS LIBRES 29/30)
RECEPCIÓN <-> MOZO (DIRIGIDO: te asigné M5 #12)
MOZO <-> CAJA (OCUPO MESA M5 qr_abc123 -> OCUPADA CONFIRMADA QR muere)
MOZO <-> KDS SECTOR (COMANDA M5-01 -> EN PREP -> LISTO fan-out PIZZAS/BEBIDAS)
KDS -> CAJA tiempos informe + CAJA <-> RECEPCIÓN MESA LIBRE + MOZO LIBRE -> CLIENTE siguiente #13
```

**RETIRO 3 canales:**
```
CLIENTE <-> CAJA (TA_QR_45 paga fuera)
CAJA <-> KDS (PAGADO -> fan-out)
KDS <-> BARRA RETIRO <-> CLIENTE TV + cartel grande
BARRA -> CAJA ENTREGADO / NO RETIRADO
```

**DELIVERY 4 canales:**
```
CLIENTE <-> CAJA (TA_QR_D45 paga + dirección)
CAJA <-> KDS (PAGADO fan-out)
KDS <-> REPARTIDOR (LISTO + dirección)
REPARTIDOR <-> CLIENTE (entrega casa)
```

**2 modos salón auto:**
- LIBRE 30/30 libres: cliente se sienta donde quiere, mozo OCUPO
- DIRIGIDO 10/30 libres: recepción asigna para balancear 6 mozos

---

## 7. ESTADOS FINALES CONSOLIDADOS

```
INTENT #P-12 qr_abc123 24hs editable (carro genérico)
 |
 +-- DINE_IN: OCUPO M5 -> QR muere -> COMANDA M5-01 CERRADA -> fan-out KDS -> CONSUMO -> M5-02 append -> CUENTA INFO celu -> PAGADA CERTIFICADA (Cajero posnet + Mozo confirma + timeout 5min) -> MESA LIBRE + MOZO LIBRE -> RECEPCIÓN 30/30 -> #13
 +-- TAKEAWAY: #L-45 PAGADO TA_QR_45 -> fan-out KDS después pago -> BARRA LISTO TV cartel grande -> ENTREGADO / NO RETIRADO informe
 +-- DELIVERY: #D-45 PAGADO + dirección -> fan-out KDS después pago -> REPARTIDOR LISTO -> ENTREGADO casa
```

---

## 8. CHECKLIST SIN CONTRADICCIONES FASE 1

- [x] QR reconvertible nunca 2 vivos, muere en OCUPADA o PAGADO
- [x] Pre-orders solo Admin, provisional #P solo Admin, definitivo FIFO puerta
- [x] Núcleo genérico Order type TAKEAWAY|DINE_IN|DELIVERY mismo objeto
- [x] Pedido TAKEAWAY/DELIVERY solo sale si PAGADO Fase 1 intacta, Comanda DINE_IN sale cuando mozo pide (no es pedido, es comanda)
- [x] OCUPO MESA REQUEST Caja acepta siempre lock central, no cuello 6 mozos
- [x] Módulos aislados celu por cualidades categoría creada por Admin PC, cliente registro Google auto/manual base restaurant
- [x] Fan-out KDS por sector con batch, append-only M5-02, modificación solo antes EN PREP
- [x] Pago fuera sistema, cuenta informativa celu
- [x] Doble confirmación pago con certificación Caja + timeout no deadlock, MESA LIBRE + MOZO LIBRE -> Recepción ve libres
- [x] 5 canales salón + 3 retiro + 4 delivery bidireccionales
- [x] Ofertas manuales Admin aplican a carro genérico, informe standby y cartel grande para 3 canales
- [x] Productos genéricos restaurant/heladería/pizzería mismo modelo, sector KDS Tienda define
- [x] Incidencia cambio opinión tiempo real reconversión QR MESA<->LLEVAR<->DELIVERY

**FASE 2 FAN-OUT + CARRO GENÉRICO + 3 CANALES CERRADA - Lista para KDS batch y dashboard**
