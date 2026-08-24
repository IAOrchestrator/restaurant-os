# FASE 2 SITUACIÓN 2: SALÓN - 30 MESAS - 6 MOZOS - RECIÉN ABRE
## Compatible 100% con FASE 1 V2 FINAL - Sin contradicciones

> **Escenario:** Local recién abre, 30 mesas vacías, 6 mozos repartidos (5 mesas x mozo). Cliente entra con pre-orden QR o sin pre-orden. No podemos obligar a sentarse donde queremos.

> **Fix clave:** Mozo no abre mesa directo, manda OCUPO MESA a Caja, Caja acepta siempre y confirma, broadcast a Recepción. Caja es autoridad.

---

## 1. Problema a resolver - Asignación dirigida vs libre

**Si Recepción asigna dirigido:** Rompe realidad, cliente se sienta donde quiere igual.

**Si dejamos libre total:** Rompe sectores, Mozo 01 con 10 mesas, Mozo 06 con 0, Recepción pierde control de libres.

**Solución: 2 modos automáticos del local:**

### MODO LIBRE (Recién abre, 30/30 libres o 25/30 libres)
- Cliente se sienta donde quiere.
- Mozo manda OCUPO MESA a Caja, Caja confirma, avisa a Recepción.
- Recepción no asigna, solo ve contador MESAS LIBRES bajando.

### MODO DIRIGIDO (Local medio lleno, 15/30 libres o 5/30 libres)
- Recepción vuelve a asignar dirigido para balancear 6 mozos.
- Recepción lee QR puerta, asigna M5 sector Mozo 02, manda a Mozo 02.
- Si cliente se sienta donde quiere igual, Mozo manda OCUPO y Caja reasigna sector.

Cambio de modo automático por cantidad libres, no manual.

---

## 2. Cadena Bidireccional Completa Salón - 5 canales

> Recepción necesita saber en todo momento cuántas mesas libres hay, y esto es por mensaje bidireccional Mozo->Caja->Recepción.

### Canal 1: CLIENTE <-> RECEPCIÓN
- Cliente -> Recepción: Muestra QR `qr_abc123` con pre-orden (Muzza + 2 Coca) o sin QR (walk-in)
- Recepción -> Cliente: Si MODO DIRIGIDO: "Te asigné M5" + push app "M5 lista". Si MODO LIBRE: "Sentate donde quieras, mozo te atiende"
- Cliente -> Recepción: Desde app "Me paso a llevar" (incidencia cambio opinión)
- Recepción -> Cliente: "Ok, QR reconvertido a #L-45 llevar, pasa a caja llevar"

### Canal 2: RECEPCIÓN <-> MOZO
- Recepción -> Mozo: (solo MODO DIRIGIDO) "Mozo 02, te asigné M5 #12 2 pax pre-orden 1 Muzza"
- Mozo -> Recepción: "M5 ocupada confirmada" / "M5 cliente arrepentido, liberala"
- Mozo -> Recepción: (MODO LIBRE) No espera asignación, él inicia OCUPO

### Canal 3: MOZO <-> CAJA (OCUPO MESA) - Corazón del sistema
- Mozo -> Caja: **OCUPO MESA M12 - 2 pax - qr_abc123 (si tiene) / sin QR**
  ```json
  OcupoRequest {
    mesa: "M12",
    mozo: "Mozo_02",
    pax: 2,
    qr: "qr_abc123 o null",
    timestamp: "21:00:01"
  }
  ```
- Caja -> Mozo: **M12 OCUPADA CONFIRMADA** (Caja acepta siempre, es lock central, no valida)
  ```json
  OcupoConfirm {
    mesa: "M12",
    mozo: "Mozo_02",
    status: "OCUPADA_CONFIRMADA",
    preOrden: {id: "#12", items: ["1 Muzza"] } o null,
    mesasLibres: "29/30"
  }
  ```
- Mozo ahora puede tomar pedido y mandar a cocina (solo si cliente lo pide)
- Mozo -> Caja: "M12 pedido a cocina 1 Muzza" / "M12 pide cuenta"
- Caja -> Mozo: "M12 cuenta $15000, marco PAGADA?"

### Canal 4: CAJA <-> RECEPCIÓN (Contador MESAS LIBRES)
- Caja -> Recepción: **"M12 OCUPADA por Mozo 02 - MESAS LIBRES: 29/30"** (viene de OCUPO)
- Caja -> Recepción: **"M12 PAGADA -> MESA LIBRE - MESAS LIBRES: 30/30"** (cuando marca PAGADA fuera del sistema)
- Caja -> Recepción: **"M5 LIBRE por arrepentido Mozo 02 - MESAS LIBRES: 30/30"**
- Recepción solo necesita ver en su app: `MESAS LIBRES: 29/30` en grande, siempre actualizado por Caja.

### Canal 5: RECEPCIÓN <-> CLIENTE (cierre loop)
- Recepción ve por Caja 29/30 libres -> Cliente en puerta: "Tenemos mesa inmediata, mostrá QR"
- Recepción ve 0/30 libres -> Cliente en puerta: "Salón lleno, espera #13 20 min o llevar inmediato #L-45"
- Recepción llama por app: "#13 tu mesa lista"

---

## 3. Flujo Completo Recién Abre 30 Vacías - 6 Mozos

**10:00 abre, 30/30 libres, MODO LIBRE automático**

1. Cliente 1 entra con `qr_abc123` pre-orden 2 pax, no va a Recepción, se sienta M12 (sector Mozo 03 pero lo vio Mozo 02)
2. Mozo 02 app: OCUPO MESA M12 2 pax qr_abc123
3. Caja: recibe, borra QR viejo si había otro? No, es primer QR, registra M12 OCUPADA, ve pre-orden 1 Muzza, responde OCUPADA CONFIRMADA + broadcast: Recepción "29/30 libres", Mozo 03 "M12 la tomó Mozo 02"
4. Mozo 02 toma pedido, manda a cocina (si cliente quiere ya)
5. Cliente 2 entra sin QR, se sienta M5, Mozo 01: OCUPO M5 3 pax sin QR -> Caja: OCUPADA CONFIRMADA 28/30 libres
6. Sigue hasta 20 mesas ocupadas por OCUPO, 10 libres, Recepción nunca asignó manual, solo vio contador bajar 30->10

**11:00, 10/30 libres, pasa a MODO DIRIGIDO automático**

7. Cliente 21 entra con QR, muestra a Recepción, Recepción lee QR, ve 10 libres, asigna dirigido M20 sector Mozo 05 para balancear
8. Recepción -> Mozo 05: "Te asigné M20 #21"
9. Mozo 05 confirma, cliente se sienta M20
10. Si Cliente 21 se sienta en M21 donde quiere y no M20, Mozo 05 manda OCUPO M21, Caja confirma M21, libera M20, avisa Recepción "M20 libre de nuevo, M21 ocupada, 9/30 libres". No hay doble asignación porque Caja es lock.

---

## 4. Retiro - Cadena 3 Pasos (para comparar)

```
CLIENTE <-> CAJA <-> BARRA RETIRO <-> CLIENTE
```
- Cliente -> Caja: TA_QR_45 #L-45 paga (pago fuera del sistema, Caja marca PAGADO)
- Caja -> Barra: #L-45 PAGADO 1 Muzza
- Barra -> Cliente: TV "#L-45 LISTO" + push + cartel grande app "RETIRAR EN BARRA - SE ENFRÍA"
- Barra -> Caja: ENTREGADO o NO_RETIRADO_PAGADO -> informe standby

---

## 5. Incidencias Fase 1 - Cambio Opinión Tiempo Real - Con Reconversión QR

**Todas con QR reconvertible: se borra anterior, nace nuevo, nunca 2 vivos, nunca error Caja.**

**Incidencia A: Salón -> Llevar en puerta antes/durante llamada**
- #P-12 en puerta esperando M5, ve espera, app "Pasar a llevar"
- Evento CLIENTE_QUIERE_LLEVAR -> Recepción app botón " #12 quiere llevar ¿Convertir y pasar a #13? SI"
- Recepción presiona CANCELAR SALON / PASAR A LLEVAR -> `qr_abc123` borrado, nace `TA_QR_45` #L-45, #12 liberado, pasa auto a #13, Caja ve #L-45 nuevo

**Incidencia B: Salón asignado M12 -> Cliente decide llevar desde mesa**
- M12 ocupada por Mozo 02, cliente dice "mejor me lo llevo"
- Mozo -> Caja: "M12 arrepentido pasa a llevar"
- Caja: borra QR salón, crea TA_QR_46 #L-46, marca M12 LIBRE por arrepentido, avisa Recepción "M12 LIBRE 11/30 libres", cliente va a caja llevar con nuevo QR

**Incidencia C: Llevar #L-45 pagado -> Decide sentarse salón**
- Cliente en caja llevar con #L-45 pagado, ve que se liberó mesa, "me siento"
- Caja: reconvierte TA_QR_45 borrado, nace qr_abc123 #P-12 salón, manda a cola salón, avisa Recepción "Nuevo #12 para mesa", avisa Barra "Cancelar #L-45"

Todo doble vía, mensaje va y viene.

---

## 6. Pago Fuera del Sistema

Como definiste: pagos por ahora solo fuera del sistema (efectivo, posnet externo MercadoPago, etc). Sistema no procesa plata.

- Caja ve "M12 $15000 (pre-orden 1 Muzza + 2 Coca agregadas Mozo 02)"
- Cliente paga fuera
- Caja presiona en app `M12 PAGADA` -> dispara `MESA LIBRE` + informe
- Si es llevar: `TA_QR_45 PAGADO` -> dispara a barra

No integración pagos Fase 2.

---

## 7. Estados Finales Salón

```
INTENT qr_abc123 (vive 24hs) -> Pre-Waitlist #P-12 (solo Admin)
    |
    v (cliente puerta muestra QR)
DEFINITIVO #12 (Recepción lee QR, FIFO)
    |
    +-- MODO LIBRE (30 vacías): Mozo OCUPO M12 -> Caja CONFIRMA -> 29/30 libres -> Recepción ve 29/30
    +-- MODO DIRIGIDO (10 libres): Recepción asigna M5 -> Mozo confirma -> Caja CONFIRMA -> 9/30 libres
    |
OCUPADA M12 {mozo, pax, pre-orden o sin pre-orden}
    |
    |-> Pedido a cocina (Mozo -> Caja -> Cocina)
    |-> Cuenta pedida
    |-> PAGADA (Caja marca, pago fuera sistema) -> MESA LIBRE -> Recepción ve +1 libre -> llama siguiente #13
    |-> ARREPENTIDO (Mozo -> Caja -> Recepción LIBRE) antes de cocina
```

---

## 8. Checklist Sin Contradicciones con Fase 1

- [x] QR reconvertible, se borra anterior, nunca 2 vivos, nunca error Caja
- [x] Pre-orders solo Admin, Recepción solo puerta + contador MESAS LIBRES por Caja
- [x] Mozo no abre mesa directo, manda OCUPO MESA a Caja, Caja acepta siempre y confirma (lock central, no cuello)
- [x] Caja autoridad MESA LIBRE, Mozo solo arrepentido antes cocina
- [x] 5 canales bidireccionales salón: CLIENTE<->RECEPCIÓN<->MOZO<->CAJA<->RECEPCIÓN<->CLIENTE
- [x] 3 canales retiro: CLIENTE<->CAJA<->BARRA<->CLIENTE con cartel grande app + TV
- [x] 2 modos auto: LIBRE 30 vacías (mozo ocupa), DIRIGIDO 10 libres (recepción asigna)
- [x] 6 mozos pueden mandar OCUPO simultáneo, Caja acepta auto 0.5 seg cada uno, no cuello
- [x] Pago fuera sistema, solo marca PAGADA
- [x] Cambio opinión tiempo real con reconversión QR + botón CANCELAR y pasa auto siguiente

**FASE 2 SITUACIÓN 2 SALÓN 30 MESAS CERRADA - Lista para MD Situación 2 fan-out cocina por sector + KDS**
