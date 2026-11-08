# Importar extractos y clasificarlos deslizando

Fecha: 2026-11-08 · Estado: aprobado por John

## Objetivo

Subir el extracto de un banco, elegir un rango de fechas y repartir cada compra
deslizando una tarjeta: compartida (Marce debe la mitad), mía, o no registrar.
Así los gastos que John paga con su tarjeta o cuenta entran al balance sin
digitarlos uno por uno.

## Alcance

- Primera entrega: extracto de tarjeta de crédito **Davibank** en PDF.
- Segunda entrega: cuenta de ahorros **Bancolombia** en PDF, cuando exista un
  extracto de muestra. El lector se diseña para que agregar un banco sea agregar
  una función, sin tocar el resto.
- Fuera de alcance: Excel/CSV, capturas de pantalla, otros bancos, lectura en un
  servidor.

## Decisiones

| Tema | Decisión |
|---|---|
| Dónde se lee el PDF | En el navegador, con pdf.js (Mozilla) cargado desde cdnjs solo al abrir el importador. El PDF nunca sale del dispositivo. |
| Contraseña del PDF | Se pide al abrir si el PDF la tiene; no se guarda en ningún lado. |
| → derecha | Compartido: gasto `user:"shared"`, `paidBy:"B"`. Suma al balance (Marce debe la mitad según la división). |
| ← izquierda | Mío: gasto `user:"B"`. No afecta el balance; queda para ver en qué se gasta. |
| ↑ arriba | No registrar. |
| ↶ deshacer | Vuelve a la tarjeta anterior y borra su decisión. |
| Guardado | Nada se escribe hasta "Guardar" en el resumen; se guarda todo en un solo `persist`, así que el ↶ general de la app lo revierte. |
| Compras a cuotas | Valor completo en la fecha de compra. Intereses y cargos de la tarjeta se deciden como cualquier otra línea. |

## Flujo

1. **Registrar → 📥 Importar extracto.** El usuario elige un PDF.
2. **Lectura.** pdf.js extrae el texto con posiciones; se reconstruyen las filas por
   coordenada vertical y se detecta el banco por su texto (Davibank: "Extracto de
   tu tarjeta de crédito" / "DAVIbank").
3. **Control de lectura.** "Valor transacciones del periodo" del extracto debe ser
   igual a la suma de todas las filas de "Transacciones del periodo facturado"
   (incluida la del pago alterno) más las filas de "Transacciones de periodos
   anteriores" en una sola cuota (1/1). Verificado con el extracto de octubre 2026:
   49 filas del periodo + 1 fila anterior 1/1 = total del extracto. Si no cuadra, se
   muestra la diferencia y se puede seguir o cancelar.
4. **Rango de fechas.** Por defecto, el periodo facturado; editable con dos campos
   de fecha.
5. **Descarte automático** (visible como contador, con opción de verlas):
   - pagos, abonos y devoluciones de la sección "Tus pagos y abonos";
   - la línea de traslado del pago alterno ("KTAL PAGO ALTERNO"), que no es una compra;
   - filas de periodos anteriores a más de una cuota (por ejemplo un avance), que
     ya se facturaron cuando ocurrieron;
   - compras ya importadas antes (misma huella, ver abajo).

   Sí entran como tarjetas: las filas de periodos anteriores 1/1, los "Otros
   cargos" (por ejemplo el seguro de vida) y los intereses corrientes del periodo.
6. **Posible duplicado.** Si ya existe un movimiento registrado con el mismo valor
   y fecha a ±3 días, la tarjeta lo dice; el usuario decide.
7. **Mazo de tarjetas.** Cada tarjeta muestra comercio, fecha, valor, cuotas si
   aplica, categoría sugerida (editable con un toque) y, si existe, "la última vez:
   compartido/mío" para ese comercio. Gestos táctiles con arrastre, flechas del
   teclado (← → ↑, Retroceso para deshacer) y botones visibles. Contador "12 de 50"
   y totales en vivo.
8. **Resumen.** Compartido (total y lo que Marce debe), mío, descartado. Botones
   "Guardar" y "Salir sin guardar".

## Datos

Gasto importado (mismo formato que un gasto manual, más origen):

```js
{ id, type:"expense", user:"shared"|"B", paidBy:"B", registeredBy:"B",
  amount, date:"YYYY-MM-DD", description:"<comercio>", category,
  isRecurring:false, note:"Extracto Davibank sep–oct 2026",
  importKey:"davibank|2026-10-13|123456|60000" }
```

- `importKey` = banco | fecha | comprobante | valor. Evita reimportar cuando los
  rangos se cruzan.
- `d.importRules = { "<comercio normalizado>": {decision, category} }` guarda la
  última decisión por comercio para sugerirla después.
- Firebase elimina campos `null`; no se escriben.

## Componentes

| Unidad | Qué hace | Depende de |
|---|---|---|
| `loadPdfJs()` | Carga pdf.js una vez desde cdnjs | red |
| `pdfToLines(file, password)` | Texto del PDF agrupado en líneas ordenadas por página y altura | pdf.js |
| `parseDavibank(lines)` | Periodo, compras `{date, ref, desc, amount, cuotas}`, pagos, total declarado | ninguna |
| `detectBank(lines)` | Elige el lector | lectores |
| `suggestCategory(desc, d)` | Regla por comercio o última decisión guardada | `d.importRules`, `d.cats` |
| `findDuplicate(item, d)` | Movimiento existente con mismo valor y fecha ±3 días | `d.entries` |
| `renderImport()` / `renderSwipe()` | Pantallas de carga, rango, mazo y resumen | estado del importador |
| `doSaveImport()` | Un solo `persist` con gastos y reglas | `persist` |

Los lectores son funciones puras sobre líneas de texto, para probarlos sin
navegador ni PDF.

## Errores

- PDF con contraseña: pedirla; si es incorrecta, decirlo y pedirla de nuevo.
- Sin texto (escaneado) o banco no reconocido: mensaje claro, sin importar nada.
- pdf.js no carga (sin internet): mensaje y salir.
- Control de lectura no cuadra: mostrar diferencia; seguir es decisión del usuario.

## Pruebas

- Lector Davibank contra el extracto real de octubre 2026: número de compras,
  primeras/últimas filas, descripciones partidas en dos líneas, total igual a
  "Valor transacciones del periodo".
- Lógica de importKey, duplicados y rango de fechas con datos de prueba.
- Mazo: decisiones, deshacer, teclado, resumen y guardado en la copia aislada con
  `fetch` simulado (nunca en Firebase real).
- Celular a 360 y 430 px y modo oscuro, sin desbordamiento horizontal.
