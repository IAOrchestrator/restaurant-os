# DICCIONARIO DE TÉRMINOS - FASE 1 + FASE 2
## Congelado para evitar confusiones Pedido vs Comanda

> Objetivo: Que todo encaje con dinámica Fase 1 V2 sin contradicciones. Un término = un significado, nunca 2 vivos.

### 1. PRE-ORDEN / INTENT / PROVISIONAL #P-12
- Intención de compra cargada por cliente en app o por Admin manual.
- Vive 24hs, se borra cierre. Solo lo ve Admin.
- Tiene QR `qr_abc123` reconvertible.
- No es venta, no va a cocina, no ocupa mesa.
- Estado: `INTENT`

### 2. QR RECONVERTIBLE
- QR único vivo por cliente. Se borra anterior, nace nuevo, nunca 2 vivos, nunca error Caja.
- Puede ser `qr_abc123` (salón provisional) o `TA_QR_45` (llevar).
- Muere cuando se convierte en MESA OCUPADA CONFIRMADA o PEDIDO PAGADO.
- Regla Fase 1: un cliente = un QR vivo.

### 3. DEFINITIVO #12 / #L-45
- Cuando Recepción lee QR en puerta, #P-12 provisional pasa a #12 definitivo FIFO salón.
- Cuando Caja lee QR llevar, provisional pasa a #L-45 definitivo FIFO llevar.
- FIFO solo definitivo, no provisional.

### 4. PEDIDO = TAKEAWAY (para llevar)
- Definición congelada: **Pedido siempre es para llevar.**
- Flujo: Cliente -> Caja paga (fuera sistema) -> Caja marca PEDIDO_PAGADO -> Caja -> KDS/Barra -> Barra -> Cliente TV + cartel grande app.
- Regla Fase 1: **Pedido solo sale a cocina si PAGADO.** Si no se retira, informe NO_RETIRADO_PAGADO, se tira, culpa cliente.
- Objeto núcleo: `Order {type: TAKEAWAY, id: #L-45}`

### 5. MESA OCUPADA
- Cliente sentado en mesa física M5.
- No es pedido, es mesa ocupada.
- Se genera por OCUPO MESA (mozo o recepción) -> Caja confirma.
- Al confirmar, QR muere y pasa a ser M5. De ahí en adelante todo es M5, no QR.

### 6. COMANDA = DINE_IN (comanda de mesa ocupada)
- Definición congelada: **Comanda siempre es de mesa ocupada salón.**
- Flujo: Cliente en M5 pide a mozo -> Mozo -> KDS sectores -> KDS -> Mozo -> Cliente consume en mesa.
- Regla: **Comanda sale a cocina cuando mozo pide, sin esperar pago.** Distinto a pedido.
- Pre-orden pasa a comanda M5-01 CERRADA cuando mozo pide cocina, ya no se edita esa comanda.
- Agregados son nuevas comandas append-only: M5-02 +queso, M5-03 Sprite.
- Objeto núcleo: `Order {type: DINE_IN, id: M5-01}` Mismo núcleo genérico que pedido, distinto trigger.

### 7. OCUPO MESA
- Mensaje **REQUEST** no apertura directa.
- Mozo -> Caja: "OCUPO MESA M12 2 pax qr_abc123 o sin QR"
- Caja acepta siempre (lock central) -> OCUPADA CONFIRMADA -> broadcast a Recepción y mozos.
- No es ABRIR MESA directo (ese rompía Fase 1).

### 8. FAN-OUT KDS POR SECTOR
- Una comanda M5-01 con 1 Muzza + 2 Coca se parte por sector Tienda:
  - T-M5-01-PIZZAS: 1 Muzza
  - T-M5-01-BEBIDAS: 2 Coca
- Cada sector tiene KDS propio con cola FIFO.
- Batch: si 3 mesas piden Muzza en 2 min, KDS muestra "3x Muzza".

### 9. KDS SECTOR
- Pantalla cocina por sector: PIZZAS, BEBIDAS, HELADOS, CAFE.
- Estados: EN PREPARACIÓN -> LISTO.
- Bidireccional: KDS -> Mozo LISTO, KDS -> Caja tiempos para informe.

### 10. CONSUMO
- Cliente comiendo en mesa ocupada.
- Puede consumir o irse antes sin consumir (arrepentido antes cocina = mesa libre sin informe consumo).

### 11. CUENTA INFORMATIVA A CELU
- Cliente app: "Pedir cuenta"
- Mozo -> Caja: "M5 pide cuenta"
- Caja -> Celu cliente: "M5-01 $8000 + M5-02 $1000 = $9000" Solo info, no pago en celu.

### 12. PAGO FUERA SISTEMA
- Pagos por ahora solo fuera (efectivo, posnet externo MercadoPago).
- Cliente paga en Caja física.
- Sistema no procesa plata, solo marca PAGADA.

### 13. CONFIRMACIÓN PAGO + CERTIFICACIÓN + MESA LIBRE + MOZO LIBRE
- Cajero confirma pago posnet M5 $9000
- Mozo confirma pago M5
- Cajero certifica: "Mesa 5 Mozo 02 pago OK" -> dispara MESA LIBRE + MOZO LIBRE
- Si mozo no confirma en 5 min, Caja libera igual por timeout, no deadlock.
- Caja -> Recepción: "M5 LIBRE 30/30 libres" -> Recepción llama siguiente #13.
- Caja guarda informe standby con tiempos KDS.

### 14. RECEPCIÓN
- Solo ve puerta secuencial por QR (Fase 1). En MODO LIBRE 30 vacías, lectura QR la hace mozo en OCUPO, sigue siendo puerta secuencial.
- Solo necesita saber MESAS LIBRES en tiempo real por mensaje Caja->Recepción.
- 2 modos auto: LIBRE (30 vacías, cliente se sienta donde quiere) / DIRIGIDO (10 libres, recepción asigna para balancear 6 mozos).

### 15. CAJA
- Autoridad central, acepta siempre, lock de mesas.
- Recibe OCUPO MESA, confirma, avisa libres a Recepción.
- Recibe pago fuera sistema, certifica MESA LIBRE + MOZO LIBRE.
- Guarda informe standby.

### 16. BARRA RETIRO
- Solo para pedidos TAKEAWAY pagados.
- Recibe de Caja #L-45 PAGADO -> cocina -> marca LISTO -> TV + cartel grande app "RETIRAR EN BARRA - SE ENFRÍA" -> Cliente retira -> ENTREGADO.

### 17. MODOS LOCAL
- MODO LIBRE: 30/30 o 25/30 libres, cliente se sienta donde quiere, mozos mandan OCUPO, recepción no asigna.
- MODO DIRIGIDO: 15/30 o 5/30 libres, recepción asigna dirigido para balancear sectores 5 mesas x mozo.

### 18. INCIDENCIA CAMBIO OPINIÓN TIEMPO REAL
- Siempre con QR reconvertible: se borra anterior nace nuevo.
- Salón -> Llevar: Mozo "M12 arrepentido pasa a llevar" -> Caja borra M12, crea TA_QR_46, M12 LIBRE.
- Llevar -> Salón: Caja borra TA_QR_45, crea #P-12 salón.

### 19. OFERTAS MANUALES ADMIN
- Solo Admin carga ofertas (Fase 1).
- Aplican a pedido y a comanda.
- Caja ve precio con oferta en cuenta informativa.

### 20. INFORME STANDBY + CARTEL GRANDE
- Fase 1: Si pedido no retirado pagado, se tira, informe NO RETIRADO, culpa cliente, cartel grande app.
- Salón: Si comanda lista y mozo no entrega, informe tiempos KDS. Cartel grande salón: push "Tu Muzza lista, te la lleva mozo".

---
**Con este diccionario, Fase 1 + Fase 2 salón 30 mesas + fan-out KDS encaja sin contradicciones ni cuellos.**
