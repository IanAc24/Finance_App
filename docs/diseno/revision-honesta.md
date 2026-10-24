# Revisión honesta del rediseño "amable y cercano"

Fecha: 2026-10-23. Rama `feat/rediseno-amable` (HEAD `c283484`). Solo lectura sobre el código. Servidor propio en el puerto 5190 (ya detenido).
Método: navegador integrado, datos reales cargados (nombre, CRC, 15 y 30, ingreso, gasto fijo, meta de ahorro, datos de ejemplo, un gasto de $25, presupuestos Comida ₡16.000 y Servicios ₡40.000). Tamaños 375x667 (principal), 320x568, 768x1024 y 1280x720. Oscuro y claro. Todo en español.
Capturas en `Updates/screens/review-before/` (nombres entre paréntesis). Las del 1280 y 768 se guardan reducidas (800x450 y 768x1024) por el panel del navegador.

Qué NO repito: `qa-rediseno.md` ya lista 23 hallazgos de detalle (botón "+" que tapa cifras, "Omitir" igual que "Confirmar", etc.). Aquí solo hay lo que sigue estropeando los criterios de aceptación después de esos arreglos o que el QA no cubrió.

---

## 1. Veredicto por pantalla

**Inicio.** Parece pensada, no plantilla: la tarjeta con acento y la cifra grande dan un centro claro, y la barra de días de la quincena es una buena idea. Pero hay demasiado texto alrededor de la cifra (7 líneas en la tarjeta a 375) y la misma información sale dos veces (leyenda de la barra y lista "En qué se fue tu dinero" repiten categoría y %). La cifra "₡2.766" no se puede reconciliar de un vistazo con "Te quedan ₡174.900". La página mide 2606 px a 375 (casi 4 pantallas). Ver mejora 1. (`home-375-dark`, `home-375-dark-scroll1`, `home-375-dark-usd`, `home-1280-dark`)

**Agregar.** Lo mejor de la app: a 375x667 cabe todo (monto, categoría, nota, fecha, teclado y Guardar) sin desplazarse, en oscuro y claro, y a 1280x720 también (el hallazgo 3 del QA ya está resuelto). El monto de ~40 px es correcto, sin llegar a "grande". Falla en lo pequeño: a 320x568 no se ve Guardar, "Otra" queda fuera de la fila y el chip dice "C.."; Editar a 375x667 deja el teclado y Guardar bajo el pliegue. La categoría aparece dos veces (chip dentro de la tarjeta del monto y cuadrícula). Ver mejora 3. (`add-375-dark`, `add-375-dark-usd-filled`, `add-1280-light`, `add-320-light`, `add-320-light-scrolled`, `edit-375-light`)

**Historial.** La lista en sí cumple la referencia: fechas en negrita, iconos grandes, sin tarjetas, monto a la derecha con signo y símbolo. Es fácil comparar importes. Lo que la estropea es lo que hay encima: resumen, chips y la tarjeta "Gastado por método" (con filas en ₡0 / $0.00) empujan la primera transacción a y≈524 de 667 a 375, y a 320x568 no se ve ninguna. Ver mejora 2. (`history-375-dark`, `history-375-dark-list`, `history-320-light`, `history-1280-light`, `history-empty-search-375-light`)

**Estadísticas.** Correcta y limpia, pero la más "de plantilla": el gráfico de barras solo etiqueta la mayor (no se comparan importes), "Tus quincenas" muestra un número grande a la derecha sin decir si es neto, y filas con "₡0 · ₡0" que no aportan. A 1280 en claro la barra máxima es un rojo ladrillo pesado. (`stats-375-dark`, `stats-1280-light`)

**Ajustes y subpantallas** (Ahorros, Gastos fijos, Presupuestos, Categorías, Legal). Coherentes y tranquilas: lista con iconos tintados, tarjetas ligeras, estados de presupuesto con texto + color ("93% del presupuesto", "Te pasaste por ₡5.000"), toast "Guardado" bien resuelto. Lo único que desentona es la cabecera: el título va centrado aquí y a la izquierda en Historial (mejora 5). (`settings-375-dark`, `settings-375-light`, `budgets-375-dark`, `toast-budgets-375-dark`, `savings-375-light`, `recurring-375-light`, `legal-375-light`)

**Bienvenida, consentimiento, diálogo.** Funcionales y sobrios; la bienvenida es la parte menos "amable": formulario plano, `<select>` nativo en gastos fijos, ₡ diminuto y apagado junto a la cifra del paso 4. El diálogo de "datos de ejemplo" flota sin título y con dos botones de ancho desigual (el primario se parte en dos líneas). Aceptable. (`consent-375-dark`, `welcome-375-dark`, `dialog-375-dark`)

**Claro vs oscuro.** El oscuro es suave y pastel; el claro usa los mismos nombres de categoría con colores mucho más saturados y oscuros (naranja óxido, azul real, morado, oliva) con texto blanco. Parecen dos apps. Ver mejora 4. (`home-375-light`, `home-768-light`)

**Escritorio (1280) y tableta (768).** Escritorio: Inicio en dos columnas funciona; Agregar deja ~40 % de la altura vacía bajo el formulario. 768: es el diseño de móvil en una columna de 448 px con barra de pestañas inferior estirada; sin errores, pero poco "diseñado" para esa anchura. (`home-1280-light`, `home-1280-dark`, `home-768-light`)

**Movimiento.** Observado: toast con entrada suave (visto a mitad de la animación y luego completo), cambio de tema con transición (en un fotograma intermedio el pill "English" quedó oscuro sobre fondo claro; luego asienta), pantalla "Abriendo tus datos..." al recargar. No puedo juzgar curvas ni duración a ojo con capturas; en el CSS hay `prefers-reduced-motion` en todos los bloques de animación (líneas 1276, 1322, 2492, 2553, 2726...). Nada me pareció distractor.

---

## 2. Las cinco mejoras visuales restantes, por impacto

### 1. Inicio: una tarjeta resumen con una sola historia (hoy tiene tres y una repetición)

**Qué está mal.** A 375 la tarjeta de Inicio (`home-375-dark`, alto 448 px) apila: etiqueta, cifra `₡2.766`, "Incluye apartar ₡3.334 al día... Sin la meta: ₡6.100.", "Te quedan ₡174.900 de esta quincena · 9 días", "Ya descontamos tus pagos pendientes: ₡120.000", Ingresos/Gastado, una barra de progreso ("30% del ingreso gastado") y además la barra segmentada con leyenda. Dos barras con significados distintos una sobre otra. Y la leyenda ("Comida 20% · Transporte 4% · Servicios 60% · Diversión 16%") se repite una pantalla más abajo en "En qué se fue tu dinero" con "20% de lo gastado" por fila (`home-375-dark-scroll1`). Aritmética que el usuario no ve: 174.900 − 120.000 = 54.900; /9 días = 6.100; − 3.334 = 2.766. El usuario ve dos cifras de "queda" (2.766 y 174.900) y la segunda no es la base de la primera. En escritorio los dos "Confirmar" son botones rellenos del mismo peso que "Agregar" y compiten con la tarjeta (`home-1280-dark`).

**Por qué importa.** Criterio de Inicio: entender lo importante sin explorar. Hoy la cifra principal exige leer cuatro líneas para confiar en ella, y el total de página (2606 px) hace que "Pendientes" y "Recientes" queden a 3 pantallas.

**Cambio concreto.**
- `HomeScreen.jsx` (tarjeta `hs-summary`, ~línea 579 y componente que la pinta cerca de la 280): dejar solo etiqueta + cifra + UNA línea de contexto: "₡174.900 libres · 9 días" (la base real de la cifra: `queda − pendientes`, es decir mostrar 54.900 o rotular "tras pagos pendientes"). Mover "Incluye apartar...", "Sin la meta..." y "Ya descontamos..." a un bloque plegable ("Cómo se calcula") con `<details>`/botón de texto de 14 px; claves nuevas en `translations.js` (es y en).
- Quitar la barra "30% del ingreso gastado" o fundirla: dejar solo la barra segmentada + leyenda (es la referencia del dueño) y debajo la línea Ingresos / Gastado.
- En la lista "En qué se fue tu dinero" (`CategoryBars.jsx`) quitar el "% de lo gastado" cuando ya está en la leyenda; dejar nombre, monto y barra; mantener el texto de presupuesto ("93% del presupuesto", "Te pasaste por ₡5.000").
- `index.css`: bajar `.summary.hs-summary` a un padding menor (hoy 448 px de alto) y en `@media (min-width: 900px)` poner "Confirmar" de Pendientes como `btn secondary` de 40 px salvo cuando es el único pendiente.

**Cómo verificar.** A 375x667, la tarjeta mide <= 320 px y se ve completa con la barra segmentada en la primera pantalla sin tener que desplazarse; la altura total de Inicio baja de 2606 a <= 2100 (`document.documentElement.scrollHeight`); una persona nueva puede decir en 5 s "puedo gastar ₡X hoy". Pruebas: `HomeScreen`/`CategoryBars` si hay textos asertados; `translations.test.js` exige las claves nuevas en ambos idiomas.

### 2. Historial: la lista debe empezar arriba, no bajo una tarjeta de métodos con ceros

**Qué está mal.** A 375x667 (`history-375-dark`): título (y≈75), chips + búsqueda (y≈125), dos líneas de resumen por moneda (y≈167-188), tarjeta "Gastado por método" de 217 px (y 210 a 427; Tarjeta y SINPE muestran `₡0 / $0.00`), recién entonces "Hoy" (y≈458) y la primera fila (y≈524, cortada por la barra inferior). A 320x568 (`history-320-light`) no se ve ni una transacción. La tarjeta solo aparece en el mes actual sin filtros (`HistoryScreen.jsx:97`), es decir, siempre en el uso normal. Además "Colones + ₡250.000 − ₡106.100" no dice que es el mes, mientras Inicio muestra ₡75.100 para la quincena.

**Por qué importa.** Criterio de Historial: ubicar una transacción y comparar importes de un vistazo. Lo que hace buena la pantalla (lista limpia) queda debajo del pliegue.

**Cambio concreto.**
- `HistoryScreen.jsx:220-250`: no pintar la tarjeta `showMethods` en la pantalla por defecto. Opciones en orden de preferencia: (a) moverla a Estadísticas; (b) plegarla en una fila de una línea tipo "Por método: Efectivo ₡75.100 · $34.99" y un botón "Ver detalle" que la abre; (c) como mínimo, ocultar los métodos con total 0 en todas las monedas (`methodTotals.filter(...)`) y quitar la tarjeta si queda uno solo.
- `HistoryScreen.jsx:208-215` (`hist-sum`): rotular "Octubre" o "Este mes" y mostrar el gasto con el mismo estilo `Figure` que Inicio.
- `index.css` `.hist-sum`/`.hist-title`: reducir el margen vertical entre chips y resumen (hoy ~20 px sobra).

**Cómo verificar.** A 375x667 se ven la cabecera "Hoy" y >= 3 filas sin desplazarse; a 320x568 >= 2 filas; el borrado de la tarjeta no rompe `HistoryScreen.test` (si los hay) y el total del mes sigue siendo igual al de Estadísticas.

### 3. Agregar y Editar: que "completar sin desplazarse" valga también en 320 y en Editar

**Qué está mal.** (a) Editar a 375x667 (`edit-375-light`): el enlace "‹ Historial" y el `h1` visible "Editar movimiento" suman ~80 px; el teclado queda en y≥448 y Guardar fuera de pantalla. En Agregar nuevo el `h1` es `sr-only` (`AddExpenseScreen.jsx:370`), así que la solución ya existe y no se aplicó a Editar. (b) Agregar a 320x568 (`add-320-light`, `add-320-light-scrolled`): `scrollHeight` 659 > 568; Guardar queda en top 555 / bottom 599, detrás de la barra de pestañas; la fila de categorías muestra 4 de 5 (el botón "Otra" está en x=304 y desborda, sin pista de desplazamiento) y el chip de categoría de la tarjeta del monto se trunca a "C..". (c) La categoría aparece dos veces: chip "Comida" en la tarjeta del monto y cuadrícula de iconos justo debajo; es ruido en el espacio más escaso. (d) A 1280x720 (`add-1280-light`) el formulario ocupa solo la franja superior y "Más opciones" flota sobre el teclado, desconectado de lo que abre.

**Por qué importa.** Criterio 1: entender el formulario y completarlo sin desplazarse innecesario. A 375x667 en Agregar se cumple; en Editar y en 320 no.

**Cambio concreto.**
- Editar: `AddExpenseScreen.jsx:370` usar `sr-only` también al editar y poner "‹ Historial" como botón de icono dentro de la barra superior de la pantalla (o dejarlo en la misma fila que el selector Gasto/Ingreso), ahorrando ~80 px.
- `index.css` (barra de guardado `.save-bar` y teclado `.keypad`, ~líneas 906-916 y 2641-2651): `@media (max-height: 640px)` reducir alto de tecla de 48 a 40 px y quitar la pista "Escribe el monto..." (se pasa a `aria-describedby`); `@media (max-width: 340px)` la fila de categorías pasa a `grid-template-columns: repeat(5, minmax(0, 1fr))` con etiqueta de 11 px o a 2 filas, y el chip de categoría de la tarjeta del monto muestra solo el icono (ocultar `.chip-label`).
- Quitar la duplicación: el chip dentro de la tarjeta del monto debe quedar como "categoría seleccionada" solo cuando el usuario ya eligió una (o sustituir el chip por el selector de método de pago a ancho completo).
- Escritorio: en `@media (min-width: 900px)` mover "Más opciones" a la columna izquierda bajo las categorías y limitar la columna izquierda con `align-self: start` para que el teclado no flote a la derecha vacío; opcional.

**Cómo verificar.** 375x667 Editar: Guardar visible sin desplazar (`getBoundingClientRect().bottom <= innerHeight - 56`). 320x568 Agregar: los 5 destinos de categoría visibles y Guardar sobre la barra de pestañas. `translations.test.js` y el test de Agregar siguen verdes.

### 4. Claro y oscuro deben ser la misma app: aligerar los colores de categoría del tema claro

**Qué está mal.** Oscuro: pastel suave (`--cat-orange: #e8a06b`, `--cat-blue: #85b4e8`, `--cat-violet: #b6a3e8`, `--cat-lime: #aecb70`, `index.css:39-42`) con etiqueta oscura. Claro: `--cat-orange: #a9531a`, `--cat-blue: #2b66b0`, `--cat-violet: #6b50b5`, `--cat-lime: #566f1c` (`index.css:106-109`) con etiqueta blanca. En la barra segmentada de Inicio (`home-375-light`, `home-768-light`) el resultado es un bloque morado muy oscuro de 60 % y un naranja óxido que no son "colores suaves y apagados"; en Estadísticas la barra máxima es un rojo ladrillo (`stats-1280-light`). El tema claro lo usa la mayoría de la gente de día; es la primera impresión de "profesional".

**Por qué importa.** Criterio "una sola app coherente": el dueño eligió suave y cercano; el claro grita más que el oscuro en las zonas de más peso visual (la tarjeta principal).

**Cambio concreto.**
- `index.css`, bloque del tema claro (líneas ~100-113): separar los tokens de relleno de barras de los tokens de texto/icono. Añadir `--seg-orange/blue/violet/lime/...` con tonos medios pastel (p. ej. `#e9a679`, `#8fb6e6`, `#b8a6e6`, `#b4cc7a`) y `--on-seg` oscuro (`#1d2a2e`) para las etiquetas dentro del segmento, como ya hace el oscuro. Usar `--seg-*` solo en `.spend-bar span`, `.legend-dot` y las barras finas de `CategoryBars`; dejar `--cat-*` oscuros para texto sobre fondo claro.
- Verificar contraste de las etiquetas (12 px bold) >= 4,5:1 y del borde de cada segmento contra `--surface-2` >= 3:1 (usar un borde de 1 px `color-mix` si no llega).
- `--spending` del claro (`#a8493f`) en las barras del gráfico de Estadísticas: usar `--spending-dim` tipo pastel como en oscuro.

**Cómo verificar.** Captura de Inicio en claro y oscuro lado a lado: mismo carácter (pastel, texto oscuro en segmentos). Script de contraste (el QA ya midió con canvas + WCAG) debe seguir >= 4,5 para texto y >= 3 para segmentos. `npm test` no cambia.

### 5. Una sola cabecera de pantalla (título, regreso y "Agregar")

**Qué está mal.** Tres lenguajes de título conviven: Inicio = saludo + fecha de 22 px a la izquierda con botón "Agregar +" (`home-375-dark`); Historial = "Historial" a la izquierda, 24 px (`hist-title`, `history-375-dark`); Estadísticas, Ajustes y todas las subpantallas = `.screen-title` centrado (`index.css:466-473`; `stats-375-dark`, `settings-375-dark`). En subpantallas hay además un enlace "‹ Ajustes" arriba y el título centrado debajo (`budgets-375-dark`), con 60 px de cabecera antes del contenido. En Inicio hay dos "Agregar" visibles a la vez: el botón del encabezado y el "+" de la barra inferior. Y el botón "Agregar" de la barra de pestañas tiene su etiqueta 4 px más abajo (top 651 vs 647) que las demás (medido).

**Por qué importa.** "Cada pantalla pertenece a una app coherente y pulida": el salto izquierda/centro al navegar entre pestañas se nota sin buscarlo, y el doble "Agregar" resta prioridad a la acción principal.

**Cambio concreto.**
- Decidir una regla: título a la izquierda, 24 px, `font-display`, en todas las pantallas raíz y de ajustes (cambiar `.screen-title` a `text-align: start` y su `+ .sub` también, `index.css:466-478`; quitar el centrado en `StatisticsScreen.jsx:64,74` y en las subpantallas de `features/settings/*`).
- Subpantallas: unir el "‹ Ajustes" y el título en una sola fila (`.sub-head { display:flex; align-items:center; gap }`) para ahorrar ~40 px.
- Inicio: quitar el botón "Agregar +" del encabezado cuando se muestra la barra de pestañas (< 900 px); dejarlo en escritorio (`@media (min-width: 900px)`), donde no hay FAB. Conservar el del estado vacío.
- `TabBar.jsx` / `index.css:2758`: alinear la etiqueta de "Agregar" a la misma línea base que las otras (padding-top del botón central, no `margin-top`).

**Cómo verificar.** Recorrer las 5 pestañas a 375: `getBoundingClientRect().left` del `h1` igual en todas; en Inicio a 375 solo un control de "Agregar" visible; etiquetas de la barra con el mismo `top`. Pruebas de textos no cambian.

---

## 3. Menores (no los arreglaría ahora)

- Escritorio 1280: Agregar deja ~40 % vacío bajo el formulario (parte de la mejora 3 si se quiere); Historial en columna de 640 px con mucho margen lateral. Aceptable.
- 768: columna única de 448 px y barra de pestañas estirada a 768; se podría usar la composición de escritorio desde 700 px, pero hoy no está roto.
- Bienvenida: `<select>` nativo para categoría, ₡ pequeño y tenue junto a la cifra grande (26,8 px frente a 48,75 px, intencionado pero poco legible en el paso 4), puntos de progreso recortados arriba a 375 (primera captura del paso 2).
- Diálogo de "datos de ejemplo": sin título y botones de ancho desigual; el primario se parte en dos líneas (`dialog-375-dark`). No hay toast ni mensaje tras cargar los datos (la lista cambia sola).
- Estadísticas: etiqueta de valor por barra, desglose "₡0 · ₡0" en quincenas vacías y cifra neta sin rótulo; ya estaba en QA (#21).
- Gastos de USD: el bloque de dólares en Inicio usa la tarjeta compacta, correcto, pero repite "Colones / Dólares" en títulos (`En qué se fue tu dinero · Colones`); se podría quitar el sufijo cuando solo hay una moneda con datos.
- Legal: placeholders `[FECHA]`, `[NOMBRE DEL RESPONSABLE]`, `[CÉDULA]` y la nota "BORRADOR" siguen visibles (`legal-375-light`). Antes de publicar.
- Transición de tema: un fotograma intermedio con colores cruzados (pill oscuro sobre fondo claro). Si molesta, `transition` solo en `background-color` con la misma duración en todos los elementos.
- Texto de 12-13 px: 7 elementos de 12 px y 11 de 13 px solo en Inicio (leyenda, ayudas); legible, pero al límite en claro.

## 4. No pude comprobar

- Inglés: no recorrí la app en inglés (textos más largos pueden romper chips y botones).
- Android real, notch/áreas seguras, teclado nativo en campos de texto y comportamiento táctil (mis clics son de ratón).
- Calidad de las animaciones (curvas, duración, jank): solo vi fotogramas sueltos; tampoco probé `prefers-reduced-motion`.
- Pantalla de "pendientes confirmados/omitidos" (el hallazgo 1 del QA): no la volví a ejercitar, así que no sé si sigue igual.
- Categorías y Presupuestos en USD, Historial con "mes vacío" real y con muchos movimientos (500+), nombres de 24 letras en 320, importes de mil millones tras este cambio.
- Modo oscuro de Estadísticas a 1280, Agregar en oscuro a 1280 y Editar en oscuro (solo claro en esas combinaciones).
- Rendimiento y accesibilidad con lector de pantalla; no usé herramientas de auditoría.

## 5. Capturas (Updates/screens/review-before/)

consent-375-dark, welcome-375-dark, dialog-375-dark, add-375-dark, add-375-dark-usd-filled, home-375-dark, home-375-dark-scroll1, home-375-dark-usd, home-375-dark-recent, history-375-dark, history-375-dark-list, history-375-dark-bottom, stats-375-dark, settings-375-dark, budgets-375-dark, toast-budgets-375-dark, settings-375-light, home-375-light, savings-375-light, recurring-375-light, legal-375-light, edit-375-light, history-empty-search-375-light, add-320-light, add-320-light-scrolled, history-320-light, home-768-light, home-1280-light, add-1280-light, history-1280-light, stats-1280-light, home-1280-dark, settings-1280-dark-scrolled (todas `.jpg`).

---

## 6. Después de los cambios

Fecha: 2026-10-23. Mismos datos que la revisión (Ana, CRC, 15 y 30, salario, alquiler de ₡120.000, meta de ₡30.000, datos de ejemplo, un gasto de $25, presupuestos Comida ₡16.000 y Servicios ₡40.000), servidor propio en el puerto 5191. Capturas en `Updates/screens/review-after/` con los mismos nombres que las de `review-before/` (no se repitieron las de consentimiento, bienvenida y diálogo, que no cambiaron, ni `add-320-light-scrolled`, que ya no hace falta porque no hay scroll). Sin commit; `npm test` 813 pruebas, `npm run lint` y `npm run build` pasan. No se tocó ningún cálculo de dinero.

### Medidas antes / después

| Medida | Antes | Después |
|---|---|---|
| 1. Tarjeta resumen de Inicio a 375 (alto) | 448 px | 307 px |
| 1. Alto total de Inicio a 375 | 2606 px | 2417 px |
| 2. Primera fila de Historial a 375x667 (top) | y 524 (cortada) | y 259 |
| 2. Filas visibles en Historial a 320x568 | 0 | 3 (259, 323, 387; la barra empieza en 512) |
| 3. Editar a 375x667: Guardar | fuera de pantalla | top 522, bottom 566 (barra en 611), sin scroll para llegar al teclado |
| 3. Agregar a 320x568: scrollHeight / Guardar | 659 / bottom 599 (bajo la barra) | 568 / bottom 506 (barra en 512) |
| 3. Agregar a 320: categorías visibles | 4 de 5 ("Otra" cortada) | 5 de 5 |
| 5. Left del título en las 4 pestañas a 375 | centrado en Estadísticas y Ajustes | 16 px en las cuatro, `text-align: start` |
| 5. Etiquetas de la barra de pestañas (top) | "Agregar" 4 px más abajo | 647 en las cinco |
| 5. Controles "Agregar" en Inicio a 375 | 2 | 1 (el "+" de la barra; el botón del encabezado solo desde 900 px) |

### Qué se cumple

1. **Inicio.** La tarjeta dice una cosa: "Puedes gastar hoy", la cifra, UNA línea de contexto ("Te quedan ₡174.900 de esta quincena · 9 días") y el botón "Cómo se calcula" (`aria-expanded`). Abierto muestra los valores que ya existían: te queda ₡174.900, pagos pendientes −₡120.000, apartado para la meta −₡30.000, disponible ₡24.900, por día (9 días) ₡2.766; se puede reconciliar. Se quitó la barra "% del ingreso gastado"; la barra segmentada y su leyenda siguen en la tarjeta y las filas de "En qué se fue tu dinero" ya no repiten el % (mantienen monto, barra y estado de presupuesto). Estadísticas conserva el %. En 900 px o más "Confirmar" es secundario. Cumplido en lo esencial: la cifra, su contexto, ingresos/gastado y el reparto se ven en la primera pantalla (card y barra completas a 375x667). **No se cumple el objetivo numérico del alto total (<= 2100):** quedó en 2417 (-7 %), porque el resto de la página (bloque de dólares de 452 px, pendientes de 301 px, recientes de 449 px) no se tocó.
2. **Historial.** "Gastado por método" ya no es una tarjeta fija: es un botón de texto en la fila del título que abre la tarjeta (con aria-expanded), solo aparece si se usó más de un método, y nunca lista métodos o monedas en ₡0 / $0.00. El resumen lleva rótulo ("Octubre · Colones"). Primera fila en y 259 a 375x667 (objetivo < 400) y 3 filas a 320x568 (objetivo >= 1). Con la tarjeta abierta la primera fila baja a y 424: es una elección de la persona.
3. **Agregar y Editar.** Editar: la flecha de regreso va en la misma fila que Gasto/Ingreso y la moneda, y el `h1` es solo para lectores de pantalla, como en Agregar. "Más opciones" pasó a un botón redondo de 44 px con icono dentro de la tarjeta del monto (con nombre en `aria-label` y `title`, y con texto desde 900 px), lo que quita una fila. El chip de categoría repetido se quitó (la elegida ya se marca en la fila de iconos); el campo de categoría nueva ocupa su propia fila. A 320 las 5 casillas de categoría caben (57 px, texto de 11 px) y, con altura <= 640 px, se oculta la barra de la marca arriba en esta pantalla para que quepa Guardar. Cumplido.
4. **Claro / oscuro.** Tokens `--seg-*` (relleno pastel, ocho colores, en ambos temas), `--on-seg` oscuro en los dos temas (antes definido blanco en claro) y `--seg-edge` (aro de 1 px, solo en claro). Contraste del texto dentro de los segmentos en claro >= 6,9:1 (calculado); el aro se calculó contra la tarjeta para llegar a ~3:1. Además `--spending` / `--spending-dim` del claro pasaron a un terracota suave (3,31:1 contra la tarjeta), así la barra máxima de Estadísticas ya no es ladrillo. A ojo, `home-375-light` y `home-375-dark` tienen ahora el mismo carácter. Cumplido.
5. **Cabecera.** `.screen-title` y `.hist-title` alineados a la izquierda con el mismo tamaño (clamp 22-24 px); solo bienvenida y consentimiento (`.ob-title`) siguen centrados. Nueva pieza `SubHeader` (flecha + título en una fila) en Ahorros, Gastos fijos, Categorías y Presupuestos (ahorra ~40 px). El botón "Agregar +" del encabezado de Inicio solo se ve desde 900 px; el "+" de la barra de pestañas queda como única acción en celular. La etiqueta "Agregar" quedó alineada (el icono redondo ocupa lo mismo que los demás). Cumplido, salvo lo de Legal (abajo).

### Archivos tocados

`src/features/expenses/HomeScreen.jsx`, `HistoryScreen.jsx`, `AddExpenseScreen.jsx`; `src/components/CategoryBars.jsx`, `SpendBar.jsx`, `SubHeader.jsx` (nuevo); `src/features/settings/{Budgets,Categories,Recurring,Savings}Screen.jsx`; `src/lib/categories.js` (+ `categoryFill`), `categories.test.js` (2 pruebas nuevas), `translations.js` (5 claves nuevas, 2 retiradas: `pendingNote`, `ofIncomeSpent`); `src/index.css`. Zona visual de Ian: todo lo anterior, salvo `src/lib/`.

### Lo que queda (menor)

- Alto total de Inicio 2417 px: los pendientes (Confirmar/Omitir bajo cada fila) y los recientes ocupan casi dos pantallas; se podría poner los botones en la misma fila a >= 360 px o mostrar 3 recientes. Es decisión de producto.
- Editar ya no muestra un título visible ("Editar movimiento" es solo para lectores); la flecha y los valores precargados lo dejan claro, pero es un cambio de lenguaje que Ian debe aprobar. Lo mismo con "Más opciones" como icono en celular (hay punto de aviso y `title`).
- A 320x568 Agregar oculta la barra de la marca (solo en esa altura) y queda con 6 px de holgura sobre la barra de pestañas; un teclado en pantalla sigue tapando.
- Legal sigue con "‹ Ajustes" como enlace de texto en su propia fila (el título viene del documento); y la bienvenida, el diálogo de datos de ejemplo y los marcadores `[FECHA]` quedan como estaban.
- Escritorio 1280: Agregar sigue dejando ~40 % vacío bajo el formulario; 768 sigue siendo la columna móvil.
- El segmento de 4 % (Transporte) no lleva % dentro (está en la leyenda); en claro el aro oscuro se ve cortado en los extremos redondeados de la barra.
- No comprobado: inglés, Android real, `prefers-reduced-motion` (el giro de la flecha de "Cómo se calcula" usa solo transform, 120 ms, y está dentro de `no-preference`).
