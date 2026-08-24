# FASE 1 V2 FINAL CONGELADA - Núcleo Genérico Gastronómico

> **Estado:** CONGELADA DEFINITIVA - Sin contradicciones - Sin TTL 2hs - QR reconvertible - Recepción solo puerta - Admin ve pre-orders - Doble vía

> **Aplica a:** Pizzería, heladería, cafetería, parrilla, hamburguesería, cualquier negocio gastronómico. Luego se acopla Fase Tienda.

---

## 1. Principios Base Finales

1.  **Pre-orden no es reserva.** Borrador libre todo el día.
2.  **Sin TTL 2hs.** Pre-orden vive hasta 24hs o cierre de local. Limpieza automática a cierre. Cliente puede armar 10am y venir 22hs.
3.  **QR reconvertible, se borra anterior.** Cuando pasa de SALON a LLEVAR, se borra QR anterior, nace nuevo. Nunca 2 QR vivos, nunca se puede equivocar Caja.
4.  **Pre-orders solo las ve Admin, no Recepción.** Recepción solo ve clientes en puerta y acomoda secuencial por lectura QR. Admin ve dashboard pre-orders para anticipar stock/compras.
5.  **Módulos doble vía.** Todo cambio en un módulo avisa al otro por app: Recepción cancela -> avisa app cliente, Cliente pasa a llevar desde app -> avisa Recepción.
6.  **Ofertas manual Admin, no automático.** Admin pone a criterio "Hoy empuja salón" o "Hoy empuja llevar". No hay flapping automático.
7.  **Pedido solo sale si paga.** Caja marca PEDIDO_PAGO -> va a barra cocina. Si cliente pagó y no retira, se tira, se jode cliente. App muestra cartel grande para retirar.

---

## 2. Núcleo Genérico vs Fase Tienda

**Núcleo (Fase 1) no sabe qué vende:**

- `QrSession`, `Canales SALON | RETIRO | DELIVERY`, `Waitlist FIFO secuencial`, `TakeAway FIFO`, `Delivery FIFO`, `Recepción solo puerta`, `Caja convierte`, `Pantalla TV + Push`, `Informe standby`

**Tienda (se acopla después):**

```json
Tienda {
  tipoNegocio: "PIZZERIA | HELADERIA | CAFETERIA",
  menu: [{id, nombre, precio, sectorCocina, prepTime}],
  holdTime: {PIZZERIA: "15min", HELADERIA: "3min", CAFE: "10min"},
  sectoresCocina: ["PIZZAS", "HELADOS", "CAFE"]
}
```

Núcleo crea `TakeAway #L-45` vacío, Tienda inyecta items. Núcleo solo ve `items[]`.

---

## 3. Intención - Raíz

Cliente entra a app cualquier hora del día desde domicilio o puerta.

- Elige productos (IDs de Tienda)
- Guarda -> Crea `QrSession INTENT`

```json
QrSession {
  id: "qr_abc123",
  secret: "sec_xyz_regenerable",
  status: "INTENT",
  intencion: "INDEFINIDA | SALON | RETIRO | DELIVERY",
  cargaAt: "2026-08-23T10:23:00",
  cliente: {id, nombre, tel, tieneApp, consentPromo},
  pax: 2, // solo SALON
  itemsBorrador: [{id: "item_01", cantidad: 1}],
  origen: "APP | MANUAL_CAJA"
}
```

- No es reserva, no bloquea, no penaliza si no viene.
- Limpieza automática 24hs / cierre local.

---

## 4. Módulo Ofertas - Manual Admin

Admin publica desde dashboard:

```json
Anuncio {
  tipo: "DIRIGIR_A_SALON | DIRIGIR_A_RETIRO",
  mensaje: "Hoy salón vacío: Coca gratis en salón",
  activo: true
}
```

- Si salón vacío: Admin publica "Mesa inmediata + extra" -> dirige a SALON
- Si salón explotado: "Retiro inmediato + extra" -> dirige a RETIRO
- Cliente ve banner en app, elige libremente.
- No automático, no flapping.

---

## 5. Elección de Canal - 3 Canales desde Misma Intención

Desde misma `qr_abc123`:

**SALON:** Botón "Quiero mesa en salón" -> Pre-Waitlist provisional #P-12 -> Recepción no lo ve aún (solo Admin). Solo cuando se acerca.

**RETIRO:** Botón "Quiero para llevar" -> Cola Retiro #L-45 + nuevo QR `TA_QR_45`

**DELIVERY:** Botón "Delivery" -> Cola Delivery #D-20 + dirección

**Conversión:** Cliente SALON #P-12 ve mucha espera -> app "Pasar a Llevar" -> Se borra `qr_abc123` #P-12, nace `TA_QR_45` #L-45. Nunca 2 QR vivos.

---

## 6. Recepción - Solo Puerta Secuencial + Cadena por App

**Recepción NO ve pre-orders.** Solo Admin ve pre-orders.

Recepción solo ve clientes en puerta, acomoda secuencial por lectura QR.

**Cadena de proceso por app:**

1. Cliente se acerca puerta -> Muestra QR `qr_abc123`
2. Recepción lee QR -> Asigna lugar definitivo FIFO secuencial #12 (sin reserva) -> `WAITLIST_DEFINITIVO #12`
3. Recepción llama por app: " #12 tu mesa está lista" (push + pantalla recepción)

Si cliente decide otra cosa, cambia situación en Recepción por doble vía:

- **Cliente decide PARA LLEVAR antes de la llamada:** Desde app presiona "Pasar a llevar" -> Evento `CLIENTE_QUIERE_LLEVAR` -> Recepción ve en su app " #12 quiere llevar -> ¿Convertir?" -> Presiona botón CANCELAR SALON / PASAR A LLEVAR -> `qr_abc123` se borra, nace `TA_QR_45` #L-45, #12 se libera, automáticamente pasa al siguiente #13 -> LLAMANDO. Cadena sigue.

- **Cliente decide PARA LLEVAR durante la llamada:** Mismo flujo, Recepción presiona CANCELAR y pasa auto al siguiente.

- **Cliente no está por algún motivo:** Recepción presiona NO PRESENTE -> #12 -> NO_SHOW -> automáticamente pasa a #13.

- **Cliente está presente:** Recepción asigna MESA LIBRE relacionada con mozo: #12 -> ASIGNADO_MESA {M5, Mozo_02}

Todo por app, cadena automática.

---

## 7. ETAPA 2 - Situación 1: RETIRO / PARA LLEVAR - Sin Mozos - Doble Vía

### 7.1 Flujo ingreso -> caja -> barra

**Sub-caso A: Decide llevar desde app**

- Cliente ya tiene `TA_QR_45` #L-45 (porque se reconvirtió, se borró anterior)
- Va a mostrador llevar, muestra `TA_QR_45`
- Caja escanea -> ve `TakeAway #L-45 PENDIENTE_PAGO`
- Puede agregar item antes de pagar
- Cobra -> `PEDIDO_PAGO` -> evento `TAKEAWAY_PAYMENT_APPROVED`

**Sub-caso B: Decide llevar en mostrador sin cambiar en app**

- Cliente muestra QR viejo `qr_abc123` SALON en caja llevar
- Caja escanea -> sistema detecta "QR SALON en Caja Llevar"
- **Reconversión automática:** Se borra `qr_abc123`, nace `TA_QR_45` #L-45, libera lugar salón
- Caja cobra. Nunca se puede equivocar porque solo queda 1 QR válido.

**Caja única:** Mismo cajero puede convertir con botón "Convertir a Llevar".

### 7.2 Sin mozos, directo Caja -> Barra Llevar

- No hay mozos en llevar
- Caja cobra -> pasa a KDS columna LLEVAR: `Order {type: LLEVAR, #L-45, EN_COCINA}`

### 7.3 Pago obligatorio

Pedido solo sale a barra cocina si o si cliente paga. `PEDIDO_PAGO` es gatillo.

### 7.4 Llamado pantalla + push + cartel grande

- **Pantalla obligatoria:** TV llevar "#L-45 LISTO - Retirar en barra"
- **Push celular:** Si tiene app, push "Tu #L-45 listo"
- **Cartel grande en app:** Si pagó, app muestra banner gigante " #L-45 LISTO - RETIRAR EN BARRA - SE ENFRÍA" (doble vía)
- **Si no tiene celular/app:** Solo ve pantalla.

Si cliente pagó y no retira y se tira/se enfría, se jode cliente. Pérdida cliente, no local. Informe registra `NO_RETIRADO_PAGADO`.

### 7.5 Entrega y cierre + informe standby

1. Cliente ve pantalla / push / cartel grande
2. Retira en barra llevar
3. Barra presiona ENTREGADO
4. **Antes de cerrar, guarda informe standby:**

```json
InformeTakeAway {
  takeAwayId: "TA-45",
  numeroLlevar: "#L-45",
  qrOrigen: "qr_abc123 reconvertido -> TA_QR_45 | MANUAL_CAJA",
  cliente: "nombre si app, ANONIMO si sin app",
  tieneApp: true,
  cargaAt: "10:23 armó pre-orden",
  acercoAt: "21:15 mostró QR puerta",
  cajaAt: "21:15 pidió en caja",
  pagoAt: "21:17 pagó $15.000",
  cocinaStartAt: "21:17 EN_COCINA",
  listoAt: "21:32 LISTO",
  entregaAt: "21:35 ENTREGADO | NO_RETIRADO_PAGADO",
  tiempoEsperaTotal: "20 min",
  items: [{id, cantidad}],
  gastoTotal: 15000,
  canalOrigen: "SALON_RECONVERTIDO_A_LLEVAR | LLEVAR_DIRECTO",
  tipoNegocio: "PIZZERIA | HELADERIA | GENERICO",
  holdTime: "15min | 3min",
  pantallaLlamado: true,
  pushCelular: true,
  cartelGrandeApp: true
}
```

Informe queda en standby para reportes/promos futuras. No se borra.

Una vez guardado, `TakeAway #L-45` CERRADO definitivo.

---

## 8. Confirmación MESA LIBRE (Regla para Situación 2 Salón)

- **Mozo solo puede liberar si cliente se arrepiente antes de transferir pedido a cocina:** Mozo app "CLIENTE ARREPENTIDO" -> libera M5.
- **Si mozo ya transfirió a cocina y entregó:** Solo Caja puede decir MESA LIBRE cuando cobra.
- **Caja es autoridad:** Cobra -> marca MESA LIBRE M5 en app.
- **Si Caja se olvida:** Mozo manda aviso por app "M5 lista para liberar ¿confirmás?" -> Caja confirma.
- Todo por app, doble vía.

---

## 9. Estados Finales Fase 1

```
INTENT (vive 24hs, limpieza cierre)
  |
  |-> Pre-Waitlist SALON #P-12 (solo ve Admin)
  |-> Cola RETIRO #L-45 (reconversión borra anterior)
  |-> Cola DELIVERY #D-20
  |
  | (cliente se acerca puerta, muestra QR)
  |
DEFINITIVO #12 / #L-45 / #D-20 (FIFO secuencial por lectura QR, solo ve Recepción)
  |
  |-> LLAMANDO por app (cadena)
  |   |-> CLIENTE_QUIERE_LLEVAR (antes/durante) -> CANCELAR SALON -> reconversión -> pasa a #13 auto
  |   |-> NO PRESENTE -> NO_SHOW -> pasa a #13 auto
  |   |-> PRESENTE -> ASIGNADO_MESA {M5, Mozo_02} (va a Situación 2 Salón)
  |
  |-> PENDIENTE_PAGO (retiro/delivery)
  |   |-> PAGADO -> EN_COCINA -> LISTO (pantalla + push + cartel grande) -> ENTREGADO -> INFORME -> CERRADO
  |   |-> PAGADO -> LISTO -> NO_RETIRADO_PAGADO (se tira, culpa cliente) -> INFORME -> CERRADO
```

---

## 10. Diagrama Final

```
[Cliente App cualquier hora / cualquier rubro]
    |
    v
[INTENCIÓN qr_abc123 - cargaAt 10:23 - NO ES RESERVA - Vive 24hs]
    |
    +--- [Ofertas Manual Admin] "Empuja salón/llevar" (no auto)
    |      Solo ve Admin + Cliente en app
    |
    ---------------------------------
    |               |               |
SALON #P-12    RETIRO #L-45    DELIVERY #D-20
Solo Admin     Solo Admin       Solo Admin
    |
    v
[Cliente se acerca puerta -> Muestra QR]
[Recepción lee QR -> Asigna #12 definitivo FIFO]
[Recepción solo ve puerta secuencial]
    |
    v
[LLAMANDO por app - Cadena]
Si quiere llevar: QR se reconvierte, se borra anterior,
Recepción presiona CANCELAR SALON / PASAR A LLEVAR -> pasa auto a #13
Si no está: NO PRESENTE -> pasa auto a #13
Si está: ASIGNADO_MESA M5 Mozo_02 -> va a Situación 2
    |
    v (si LLEVAR)
[Caja Mostrador lee TA_QR_45 (único válido, nunca error)]
[Caja cobra -> PEDIDO_PAGO obligatorio]
    |
    v
[Barra Llevar KDS EN_COCINA]
    |
    v
[Pantalla TV #L-45 LISTO + Push + Cartel grande app RETIRAR]
    |
    v
[ENTREGADO o NO_RETIRADO_PAGADO (se tira, culpa cliente)]
[Guarda INFORME standby]
[CERRADO]
```

---

## 11. Checklist Congelada

- [x] Sin TTL 2hs, vive 24hs/cierre, limpieza automática
- [x] QR reconvertible, se borra anterior, nunca 2 vivos, nunca error Caja
- [x] Pre-orders solo Admin, Recepción solo puerta secuencial por QR
- [x] Cadena Recepción por app: llama -> si quiere llevar antes/durante cancela con botón y pasa auto a siguiente
- [x] Módulos doble vía en funciones
- [x] Ofertas manual Admin, no automático, no flapping
- [x] Pedido solo sale si paga, si se tira/enfría culpa cliente, cartel grande app + pantalla + push
- [x] Núcleo genérico independiente, aplica heladería/pizzería/cafetería, Tienda se acopla después
- [x] Informe standby completo antes de cerrar
- [x] Mesa libre confirma Caja (si pagó) o Mozo (solo si arrepentido antes cocina), si Caja se olvida Mozo avisa por app

**FASE 1 V2 FINAL CONGELADA - Lista para FASE 2 SITUACIÓN 2: INGRESO A SALÓN (Mesa por sector + Mozo + Caja libera MESA LIBRE + Fan-out cocina batches)**
