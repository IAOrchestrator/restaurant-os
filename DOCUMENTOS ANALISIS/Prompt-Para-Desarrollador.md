# PROMPT PARA DESARROLLADOR - COMPARAR Y ADAPTAR A LÓGICA CONGELADA FASE 1+2

Hola, te paso 4 documentos congelados de la lógica que debe adoptar el sistema. Necesito que compares lo que ya tenés desarrollado con esta lógica y me digas si se puede adaptar a lo nuestro sin rehacer todo.

## DOCUMENTOS ADJUNTOS (leer en orden):
1. `fase1-v2-final-congelada.md` - Núcleo genérico, QR reconvertible, pre-orders, pedido solo si paga, 3 canales bidireccionales base
2. `fase2-situacion2-salon-30-mesas.md` - Situación 2 salón 30 mesas 6 mozos, modos LIBRE/DIRIGIDO, OCUPO MESA REQUEST, MESA LIBRE + MOZO LIBRE
3. `diccionario-terminos.md` - Diccionario para no confundir Pedido vs Comanda, QR vivo, estados
4. `fase2-fanout-carro-3canales.md` - Producto genérico, carro pre-orden, deriva en 3 órdenes, fan-out KDS por sector, módulos aislados por cualidades

## LÓGICA QUE DEBE ADOPTAR (resumen para comparación rápida):

### A) DICCIONARIO OBLIGATORIO:
- PRE-ORDEN / INTENT #P-12 = intención editable 24hs, QR único vivo `qr_abc123`, no va a cocina, solo Admin
- QR RECONVERTIBLE = un cliente = un QR vivo, se borra anterior nace nuevo, muere en OCUPADA CONFIRMADA o PEDIDO_PAGADO, nunca 2 vivos
- PEDIDO = siempre TAKEAWAY para llevar. Regla: solo sale a cocina si PAGADO (fuera sistema efectivo/posnet)
- MESA OCUPADA = cliente sentado M5, QR muere y pasa a ser M5
- COMANDA = siempre DINE_IN mesa ocupada, sale a cocina cuando mozo pide, sin esperar pago. M5-01 CERRADA no editable, agregados M5-02 append-only
- OCUPO MESA = REQUEST Mozo->Caja, Caja acepta siempre (lock central), broadcast MESAS LIBRES a Recepción. No es ABRIR MESA directo
- Cuenta a celu = solo informativa, pago fuera sistema
- Certificación = Cajero confirma posnet + Mozo confirma + Cajero certifica MESA LIBRE + MOZO LIBRE con timeout 5 min (no deadlock)

### B) PRODUCTOS Y CARRO GENÉRICO (restaurant/heladería/pizzería):
Producto genérico Admin PC crea: id, nombre, categoria, sectorKDS (PIZZAS/BEBIDAS/HELADOS/CAFE), variantes, agregados (queso extra, mostaza), precio, tiempo prep.
Carro PRE-ORDEN genérico = [1 Muzza grande+queso + 2 Coca] editable 24hs estado INTENT con QR vivo.
Mismo carro deriva en 3 tipos mismo núcleo `Order {type: TAKEAWAY|DINE_IN|DELIVERY}`:
- DINE_IN M5-01: OCUPO M5 -> QR muere -> fan-out KDS PIZZAS/BEBIDAS -> consumo -> cuenta info -> pago fuera -> mesa libre
- TAKEAWAY #L-45: paga fuera -> PAGADO -> fan-out después pago -> Barra Retiro TV "L-45 LISTO" + cartel grande
- DELIVERY #D-45: paga + dirección -> fan-out después pago -> Repartidor módulo aislado -> casa

### C) FAN-OUT KDS POR SECTOR:
Una comanda M5-01 con Muzza+Coca se parte: T-M5-01-PIZZAS 1 Muzza, T-M5-01-BEBIDAS 2 Coca. Cada sector KDS cola FIFO. Batch 3x Muzza. Modificación solo antes de EN PREPARACIÓN, después append-only M5-02.

### D) MÓDULOS AISLADOS EN CELU + CATEGORÍAS CUALIDADES (Admin PC crea):
- Mozo 1 app: solo M1-M5, OCUPO, COMANDA, CUENTA, CONFIRMA PAGO. No ve Mozo 2, Caja, KDS completo
- Cocina PIZZAS KDS: solo T-*-PIZZAS, EN PREP/LISTO
- Caja: ve 30 mesas, pagos, certifica libre, broadcast libres a Recepción
- Recepción: solo cola #P y contador MESAS LIBRES 29/30, asigna DIRIGIDO, cancela/pasa a llevar
- Barra Retiro: solo #L PAGADO -> LISTO TV
- Repartidor: solo #D + dirección
- Dashboard/Admin PC: crea productos, categorías, cualidades, ofertas manuales, ve informes standby
- Cliente: registro Google Gmail auto o manual datos en base restaurant, carro, QR, cuenta info, cartel grande

### E) 2 MODOS SALÓN AUTO:
- MODO LIBRE 30/30 libres: cliente se sienta donde quiere, mozo manda OCUPO
- MODO DIRIGIDO 10/30 libres: recepción asigna para balancear 6 mozos (5 mesas c/u)

### F) CADENAS BIDIRECCIONALES:
Salón 5 canales: CLIENTE<->RECEPCIÓN<->MOZO<->CAJA<->KDS<->RECEPCIÓN mesa libre + mozo libre
Retiro 3 canales: CLIENTE<->CAJA<->KDS<->BARRA<->CLIENTE
Delivery 4 canales: CLIENTE<->CAJA<->KDS<->REPARTIDOR<->CLIENTE

## LO QUE NECESITO QUE HAGAS:

1. **Comparar** tu código actual con esta lógica. Listar qué coincide y qué no.
2. **Detectar contradicciones** con tu implementación: ¿tu OCUPO MESA es directo o REQUEST a Caja? ¿tu QR muere o quedan 2 vivos? ¿tu pedido sale sin pagar? ¿tus módulos ven todo o están aislados por cualidades?
3. **Adaptabilidad**: ¿Se puede adaptar lo ya desarrollado a esta lógica sin rehacer de cero? ¿Qué refactor mínimo? Ejemplo: cambiar ABRIR MESA directo por OCUPO REQUEST + Caja lock, separar Order type TAKEAWAY vs DINE_IN, agregar timeout certificación, aislar módulos por categoría.
4. **Entregable**: Tabla de gaps y plan de adaptación por fases, estimado.
5. **Confirmar** que entendés diferencia PEDIDO (llevar pagado->KDS) vs COMANDA (mesa mozo->KDS sin pagar) y QR reconvertible nunca 2 vivos.

## ARCHIVOS PARA REVISAR:
Adjunto 4 MD. Base tu análisis en fase2-fanout-carro-3canales.md que ya consolida todo.

Gracias.
