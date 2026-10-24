# Auditoría de UI y prueba de "romper" (solo lectura)

Fecha: 2026-10-23. Rama: `feat/rediseno-amable`. App en `http://localhost:5179` (servidor propio, ya detenido).
Navegador integrado (Chromium), tamaños 375x812, 768x1024, 1280x800 y 320x640/700; tema oscuro y claro; español e inglés.
No se editó ningún archivo existente. Los datos de prueba se borraron al final con "Borrar todos los datos".

Cómo leer la severidad: **alta** = pierde contenido, duplica datos o confunde con dinero; **media** = se nota y molesta; **baja** = pulido.

---

## 1. Hallazgos por pantalla

Referencias de código aproximadas (`finance-tracker/src/...`). `css` = `index.css`.

| Pantalla | Tamaño / tema | Problema | Sev. | Arreglo sugerido |
|---|---|---|---|---|
| Consentimiento | 1280 oscuro | Pantalla clara y bien jerarquizada, pero los 4 enlaces a documentos van muy separados (lista de 4 líneas con mucho aire) y el botón "Aceptar y continuar" queda fuera de la primera vista en 800 px de alto. | baja | Compactar `.legal-links` (css:1759) y fijar el botón abajo. |
| Bienvenida (5 pasos) | todos | Buen ritmo y textos claros. En el paso 5 "Terminar" y "Terminar sin meta" pesan casi igual y "Saltar este paso" ocupa un botón entero en cada paso: dos botones apilados a ancho completo compiten con el principal. | baja | Volver "Saltar este paso" un enlace de texto (como "Omitir la configuración"). `OnboardingScreen.jsx`. |
| Bienvenida | 375 oscuro | Al cambiar de paso el título `h1` recibe foco y se dibuja un recuadro turquesa rectangular alrededor de "Bienvenido" (se ve con ratón/tocar). | baja | Ya existe `.ob-title:focus:not(:focus-visible)` (css:1573); revisar por qué no aplica al foco programático. |
| Bienvenida (repetir) | 375 | "Cancelar" lleva a Inicio (`/`), no a Ajustes de donde se vino. | baja | `navigate(-1)` o a `/settings`. |
| Inicio vacío | 375/1280 | Correcto: estado vacío con dos botones. En escritorio con pendientes: "Agregar gasto" queda debajo de la tarjeta de pendientes; no es lo primero que se ve. | baja | Subir los dos CTA o fijarlos en móvil. |
| Inicio con datos | 375 oscuro | Jerarquía buena: "Puedes gastar hoy" enorme, luego "Te queda esta quincena". Pero con dos monedas aparecen dos tarjetas hero completas apiladas (página de ~2300 px) y "Agregar gasto/ingreso" queda al final; el aviso de respaldo empuja la tarjeta principal hacia abajo. | media | Mostrar la 2.ª moneda colapsada o con pills CRC/USD; mover el aviso de respaldo debajo del hero. `HomeScreen.jsx:505-509`. |
| Inicio | 375 oscuro | "Te queda esta quincena" en negativo sale en blanco, mientras en el resto de la app los negativos van en rojo (`.spending`). | media | Aplicar `.spending` a `.left-amount` cuando es negativo (css:525). |
| Inicio | 375 | Enlaces del aviso de respaldo ("Ir al respaldo", "Ahora no") miden 74x17 y 53x18 px: objetivos táctiles muy chicos. | media | `min-height:44px; display:inline-flex`. |
| Agregar | 375 oscuro | Teclado numérico propio, claro y grande; botón Guardar fijo abajo con pista "Escribe el monto para poder guardar". Bien. | - | Mantener. |
| Agregar | 375 | Tras guardar **no hay confirmación**: navega a Inicio sin aviso ni resaltado del movimiento nuevo, y no hay "Agregar otro". Solo cambió una cifra. (`AddExpenseScreen.jsx:232` `navigate('/')`.) | alta | Aviso breve ("Guardado · ₡X") con acción "Agregar otro" o botón secundario "Guardar y agregar otro". |
| Agregar | 375 | Doble envío: con clics reales en el mismo punto solo se creó 1 movimiento (la 1.ª pulsación navega). Pero 3 `click()` en la misma tarea crearon **3 movimientos idénticos**: la guarda `saving` (estado) no se actualiza entre eventos síncronos. | media | Guarda con `useRef` en `handleSave` (`AddExpenseScreen.jsx:178-181`). |
| Agregar | todos | La categoría arranca preseleccionada (recuerda la última) y la moneda también (`lastCurrency`). En la prueba, tras un gasto en USD todos los siguientes arrancaron en USD sin que se notara (16 gastos se guardaron en dólares). | media | Resaltar la moneda activa en el monto (`$`/`₡` ya está) o pedir elegir moneda tras cambiar de pantalla; al menos mostrar "USD" junto al monto. |
| Agregar | 375/1280 | Tope de monto silencioso: al llegar a ₡1.000.000.000 (o con "000" que lo superaría) la tecla simplemente no hace nada, sin aviso. | baja | Mensaje "Máximo ₡1.000.000.000" o vibración/estado de la tecla. |
| Agregar | 1280 | El botón Guardar fijo tapa parcialmente el campo Fecha en la primera vista (alto 800); la columna derecha no cabe. | baja | Reducir padding del `.save-bar` o dejar el guardar fuera de la columna en escritorio (css:868). |
| Agregar | 375 | Barra superior fija (52 px) + barra de Guardar fija (83 px) = 135 px permanentes. Con teclado virtual (~300 px) en un teléfono de 640 px quedan ~200 px de contenido. No se pudo probar con teclado real. Sin `scroll-padding-bottom` (css:868-878). | media | `scroll-padding-bottom` y ocultar el `.save-bar` mientras un input tiene foco, o usar `visualViewport`. |
| Agregar | 375 | Teclado físico funciona sin foco (digitos y Backspace). Orden de Tab: 12 paradas por el teclado numérico antes de llegar a Categoría. | baja | Dejar el teclado fuera del orden de Tab (`tabIndex=-1`) o agrupar con `role="group"`. |
| Agregar / Editar | 375 | Campo de nota con 60 y categoría nueva con 24 caracteres: el límite corta sin avisar (sin contador). | baja | Contador "12/60" visible cerca del tope. |
| Agregar "+ Otra" | 375 | Al elegir "+ Otra" aparece el campo pero no hay forma de cancelar salvo elegir otra categoría; la pill queda activa. | baja | Texto de ayuda o botón "×". |
| Aviso "marcar pagado" | 375 | Buen texto, pero el foco inicial está en "No, dejarlo aparte" y el botón destacado (turquesa) es "Sí, marcarlo": el foco no coincide con la acción principal; "No, dejarlo aparte" parte en 2 líneas y queda más alto que el otro botón. | baja | Texto más corto ("No") o igualar alturas. `DialogProvider`. |
| Editar | 375 | No hay "Cancelar" ni enlace "‹ Atrás": solo se sale por las pestañas. "Repetir hoy" y "Eliminar" quedan bajo la barra fija. | media | Agregar `back-link` como en Categorías/Presupuestos. |
| Editar | 375 | Las sugerencias de nota (píldora punteada, p. ej. "Quincena pasada" mientras se edita "cena") se parecen a un botón desactivado y aparecen por coincidencia parcial. | baja | Estilo sólido o etiqueta "Sugerencias". css:809-815. |
| Eliminar movimiento | 375/800 | El diálogo dice "¿Eliminar este movimiento?" sin mostrar cuál (monto, nota). Al cerrar con Esc el foco no vuelve al botón "Eliminar" (queda en `main`). | media | Incluir monto/nota en el mensaje; restaurar foco al disparador. |
| Historial | 375 | Orden: mes, búsqueda, "Filtros", tres tarjetas (saldo, método, datos) y recién después la lista. En un mes con muchos movimientos hay que bajar ~1,5 pantallas para ver el primero. | media | Lista primero en móvil, o resumen en una sola tarjeta compacta. |
| Historial | 375 | Filtros: las filas "Todo / Gasto / Ingreso" y "Todo / Efectivo / Tarjeta / SINPE" no tienen etiqueta (solo Categoría la tiene); el botón "Filtros" no indica cuántos filtros hay activos ni cuándo se aplican. | media | Etiquetas "Tipo" y "Método"; "Filtros (2)". `HistoryScreen.jsx`. |
| Historial | 375 | "Gastado por método · Quincena" siempre muestra la quincena de HOY, aunque estés viendo agosto: en un mes vacío sigue mostrando ₡/$ de octubre. Engañoso. | alta | Calcular por el mes mostrado o quitar la tarjeta cuando no coincide. `HistoryScreen.jsx:66-69, 245-249`. |
| Historial | 375 | Mes vacío: el mensaje "No hay movimientos este mes" aparece al final, debajo de las tarjetas y del botón "Exportar este mes (CSV)" (que sigue ofreciéndose sin datos). Con búsqueda sin resultados pasa igual ("Exportar resultados (CSV)"). | media | Mensaje arriba; ocultar exportar si no hay filas. |
| Historial | 375 | Filas de altura distinta: con nota 39 px, sin nota 21 px (objetivo táctil de 21 px). Sin nota el método de pago no se muestra (solo fecha/nada) y "Efectivo" nunca se muestra. | media | `min-height:44px` en `.row-link`; mostrar el método siempre o nunca. `TransactionItem.jsx:20-50`. |
| Historial | 1280 | Mes y búsqueda en una columna estrecha (~400 px) centrada sobre dos columnas anchas (1120 px): anchos de bloque distintos. | baja | Alinear al ancho de las columnas. |
| Estadísticas | 375 | "Quincenas anteriores" incluye la quincena **actual** (16/10 – 31/10). | media | Excluirla o renombrar "Quincenas". `StatisticsScreen.jsx:37-47`. |
| Estadísticas | 375 | "Movimientos" no cambia con Semana/Mes/Año (siempre los 8 últimos) y mezcla movimientos futuros (05/11) sin marcarlos, aunque el gráfico y "Mayor gasto" los excluyen. | media | Filtrar por el periodo y marcar "Próximo". `StatisticsScreen.jsx:53-56`. |
| Estadísticas | 375 | Gráfico de barras sin valores ni etiquetas por barra: una sola barra grande aplasta a las demás (todas parecen cero); solo se lee "Mayor gasto". Meses abreviados con longitud irregular ("sept" 4 letras vs "ago"). | media | Etiqueta de valor sobre la barra tocada; abreviaturas fijas de 3 letras. `BarChart.jsx`. |
| Estadísticas | 375 | Los selectores Semana/Mes/Año y CRC/USD son dos filas de pills centradas; en Presupuestos y Ahorros la fila CRC/USD va alineada a la izquierda. | baja | Un único patrón de alineación. |
| Ajustes | 375 | Orden: Idioma, Tema, Nombre, Quincena, Configuración inicial, Administrar, Datos, Privacidad. Las funciones que más se usan (Ahorros, Gastos fijos, Categorías, Presupuestos) quedan enterradas bajo ajustes que se tocan una vez; son botones grandes sin descripción. | media | Subir "Administrar" y darle subtítulos; bajar idioma/tema. |
| Ajustes | 375/1280 | La tarjeta "Cómo se corta la quincena" repite el texto ("El 15 y el 30 de cada mes" como subtítulo y como píldora activa). Dos botones "Guardar" distintos (nombre y quincena) con estado desactivado punteado: no se distingue "sin cambios" de "roto". | baja | Quitar el subtítulo; texto "Sin cambios". |
| Ajustes | 375 | En "Mis días de pago" los campos arrancan con 5 y 20 aunque la quincena vigente es 15 y 30 (`QuincenaSetting.jsx:59`): valores sin relación con el dato real. | media | Precargar 15 y 30 (los vigentes). |
| Ajustes | 375 | Nada en el menú superior queda activo en Ajustes (solo el engranaje con borde): se pierde el "dónde estoy". | baja | Mantener `aria-current` y estilo visible en el engranaje. |
| Ajustes | 1280 | Dos acciones destructivas en rojo contorno: "Borrar todos los datos" y "Retirar consentimiento", más "Descargar respaldo" en turquesa relleno: tres acentos grandes en una pantalla de ajustes. | baja | Bajar énfasis de "Descargar respaldo" salvo cuando toca respaldar. |
| Borrar todo | 375 | Muy buen diálogo: resume cuántos datos se pierden, avisa que no se deshace y ofrece descargar antes. Foco en "Cancelar". | - | Mantener (y copiar el nivel de detalle al diálogo de eliminar movimiento). |
| Categorías | 375 | No hay botón "Agregar categoría": solo se crean desde "+ Otra" al guardar un gasto. Las predeterminadas no son editables y la edición tiene "Mover sus movimientos a (1)" (el "(1)" no se entiende). Los círculos de color no tienen texto (sí `aria-label`). | media | Botón "Nueva categoría"; aclarar el "(1)". `CategoriesScreen.jsx`. |
| Presupuestos | 375 | Los campos muestran dígitos crudos ("999999999") sin separadores; el resto de la app muestra "₡999.999.999". Sin símbolo de moneda. "Guardado" es un texto chico y gris debajo del botón. Botón Guardar siempre activo. | media | Formatear al salir del campo; mostrar ₡/$ y confirmación más visible. `BudgetsScreen.jsx`. |
| Gastos fijos | 375 | Lista mezcla ingresos ("Salario") con título "Gastos fijos" y botón "Agregar gasto fijo". Etiqueta del botón con peso 400 en Gastos fijos vs 600 en el resto. Categoría por `<select>` nativo (Agregar usa pills) y monto sin teclado numérico propio. | media | Renombrar "Pagos fijos"; unificar selector de categoría y entrada de monto. `RecurringScreen.jsx`. |
| Ahorros | 375 | Sin enlace "‹ Ajustes" (las demás subpantallas de Ajustes sí lo tienen) y sin pestaña activa. Muestra a la vez los dos avisos ámbar ("no tienes tanta plata..." y "no tienes tanto en ahorros") aunque solo aplique uno según la acción; el aviso queda pegado a la etiqueta siguiente. "$0.00" vs "₡0" (decimales distintos). | media | Agregar `back-link`; mostrar el aviso solo de la acción elegida; margen bajo `.field-note`. `SavingsScreen.jsx`. |
| Páginas legales | 375 | Borrador visible: placeholders `[FECHA]`, `[NOMBRE DEL RESPONSABLE]`, `[CÉDULA]`, `[DIRECCIÓN]`, `[CORREO DE CONTACTO]` y la línea "English version: politica-de-privacidad.en.md" (nombre de archivo, no enlace). El título es `h1` dentro de la tarjeta, no el `.screen-title` centrado del resto. | alta (antes de publicar) | Completar datos y reemplazar el nombre de archivo por un enlace o quitarlo. `LegalText.jsx`, `LegalScreen.jsx`. |
| Global | 375 | `<title>` es siempre "I AM POOR FOR NOW"; al cambiar de ruta el foco se queda en `body`; solo hay un `h1` y las tarjetas usan `<p class="label">` (sin `h2`); el `nav` no tiene `aria-label`. | media | `document.title` por ruta, mover foco a `main`/`h1`, `h2` en tarjetas. `App.jsx`, `ScrollToTop.jsx`. |
| Global | 1280/375 | Foco visible: contorno turquesa de 2 px en todos los controles probados con Tab. Bien. Hover/active definidos solo en `@media (hover:hover)` y `:active` (css:1342-1410). | - | Mantener. |
| Tema | 375 claro | Contraste medido con `getComputedStyle`. Oscuro: todo >= 6,2:1. Claro: píldoras inactivas 4,58:1 (justo), y el verde de ingresos sobre la tarjeta 4,49:1 ("+₡999.999.999" 16 px/600, bajo 4,5). | baja | Oscurecer `--income` un punto en claro. |
| Inglés | 375 | Todo coherente; "Quincena" no se traduce (decisión de producto). El menú cabe justo (351/351 px). Formato de dinero idéntico al español. | baja | Vigilar el menú si se alargan los textos. |

### Confirmación y doble envío (pregunta específica)

- Confirmación tras guardar: **no hay** (sin aviso, sin "Agregar otro"). Estado dicho solo por la cifra de Inicio y su región `aria-live` ("Ya no queda para hoy" cuando aplica).
- Doble envío: 3 clics reales rápidos sobre Guardar -> 1 movimiento (el primero navega). 3 `click()` síncronos -> 3 movimientos. Riesgo real solo en dispositivos lentos o dobles toques muy rápidos; arreglo barato con `useRef`.
- Barra de Guardar y teclado móvil: en 375x812 sin teclado virtual los campos Nota y Fecha quedan por encima de la barra (la barra empieza en y=676; Nota termina en 506, Fecha en 639). Con teclado virtual real **no se pudo probar** (ver sección 5).

---

## 2. Prueba de "romper" (peor caso realista)

Datos usados: categoría `ABCDEFGHIJKLMNOPQRSTUVWX` (24), nota de 60 `N`, nombre de perfil de 30 caracteres, montos ₡1, ₡999.999.999, ₡1.000.000.000, US$123.456.789, 20 movimientos en un día, mes sin datos (agosto), gasto futuro (05/11), ambas monedas, 320 px, texto 1,5x y claro/oscuro.

### Roto (Broken)

1. **Monto hero partido por la mitad**. Dato: gasto de ₡1.000.000.000 + otros (saldo −₡1.000.005.000). Dónde: Inicio, tarjeta principal, 375 px. Resultado: el signo queda solo en una línea y el número se parte a mitad ("₡1.000.005.00" / "0") en 3 líneas. Causa: `overflow-wrap: anywhere` en `.card.hero .balance` (css:496-499). Arreglo: `white-space: nowrap` + reducir `font-size` por longitud (o `text-wrap: balance`), sin `anywhere`.
2. **Signo menos separado del número**. Dato: gastado ₡1.000.255.142 o US$123.628.039 en 320 px (y US$ en Estadísticas a 375). Dónde: Inicio "Te queda esta quincena"/"Gastado", Historial resumen, Estadísticas "Quincenas anteriores", cabecera del día en Historial. Resultado: "−" arriba y "₡1.000.255.142" abajo; la cabecera de día se parte en 2 líneas con el total en 2 columnas. Arreglo: envolver el monto en `<span style="white-space:nowrap">` (formato `formatMoney` ya une signo y cifra, el salto lo hace el contenedor).
3. **Doble envío posible** (3 movimientos idénticos con clics síncronos). Dónde: Agregar. Arreglo: `useRef` como guarda en `handleSave`.
4. **Gastado por método ignora el mes elegido** (muestra octubre dentro de agosto vacío). Dato: mes sin movimientos. Dónde: Historial. Arreglo: calcular con el rango del mes visible.

### Feo (Ugly)

1. Texto 1,5x (simulado con `font-size` en línea; zoom real del navegador no estuvo disponible): en 375 px el nombre de marca choca con el botón de Ajustes, "Historial" queda cortado en el menú (scroll interno 421/351) y la barra de Guardar crece a 127 px. Arreglo: el menú con `flex-wrap` y ocultar `.brand-name` bajo cierto ancho útil.
2. Fuentes en `px` (301 usos de `px`, 2 de `rem`): al poner `html{font-size:200%}` **nada cambió** (solo `body` heredó 32 px). La app ignora el tamaño de letra del navegador/sistema. Arreglo: pasar `font-size` a `rem` (css:229 base `16px` -> `1rem`).
3. Nombre de categoría de 24 letras seguidas: en listas (Inicio, Estadísticas, Presupuestos, Categorías) el punto de color queda solo en una línea y el nombre debajo, a 2 líneas. En Agregar el botón es una píldora de ~241 px (cabe a 320 px, no a 1,5x: sale del tarjeta). Arreglo: `.dot` con `display:inline-block; vertical-align:middle` y el nombre con `overflow-wrap:anywhere` dentro de un `span` junto al punto; en pills `max-width:100%; overflow-wrap:anywhere`.
4. Nota de 60 letras sin espacios: ocupa 5 líneas en lista (Inicio/Historial), empujando monto y categoría. Arreglo: `-webkit-line-clamp: 2` en `.row-name`.
5. Monto de US$123.456.789,00 y +₡999.999.999 en lista a 320 px: caben pero la fila se aprieta ("Diversión · Tarjeta" parte en 2 líneas). Aceptable, pero sin margen.
6. Totales que superan el tope: dos movimientos suman ₡1.000.255.142 y la app los muestra sin problema, aunque `MAX_AMOUNT` es 1.000.000.000. "100% del ingreso gastado" aparece cuando el gasto supera el ingreso (se recorta a 100%).
7. Estadísticas con una barra enorme y el resto planas (todo parece cero). Arreglo: escala logarítmica o etiquetas de valor.
8. "Gasto futuro" (05/11) aparece en "Recientes" de Inicio y "Movimientos" de Estadísticas con solo la fecha, mezclado con lo de hoy. Arreglo: etiqueta "Próximo" o excluirlo.
9. Vista oscura de la tarjeta de hero con ₡0 en gris apagado cuando "no queda para hoy": legible (7:1) pero parece desactivado, no alarma.

### Frágil (Fragile)

1. 20 movimientos en el mismo día: Historial los agrupa bien, pero no hay paginación ni colapso del día (la lista de un mes de 28 movimientos mide ~2000 px). Con cientos, pesado. Arreglo: "Ver más" por día o virtualizar.
2. Moneda por defecto = la última usada: un solo gasto en USD hace que los siguientes salgan en USD sin aviso (ya pasó en la prueba).
3. USD con formato `en-US` fijo (`$1,234.50`, `lib/money.js:84-97`) y colones con `de-DE` (`₡1.234`): en una interfaz en español se mezclan coma y punto con significados opuestos (`$123,639,739.00` junto a `₡1.000.005.000`). En Historial se ven los dos en la misma tarjeta. Arreglo: usar el `locale` de ajustes para ambos y un solo estilo de decimales.
4. Menú superior a 320 px: cabe justo (304/304 px) con "Inicio, Agregar, Estadísticas, Historial"; cualquier texto más largo (inglés con zoom, "Statistics") lo desborda. Ya tiene `overflow-x: auto` (css:356-372) pero sin indicio de que se desliza.
5. Objetivos táctiles: filas del historial sin nota miden 21 px de alto; enlaces del aviso de respaldo 17-18 px; "‹ Ajustes" 13 px de letra.
6. Presupuestos: campos sin `maxLength`; el validador atrapó 20 dígitos ("Escribe un monto válido") pero solo al guardar.
7. Zoom del navegador real y reducción de movimiento no se pudieron emular (ver sección 5); el CSS sí define `prefers-reduced-motion` (css:1394, 1440, 1514, 1560).
8. Teclado virtual del teléfono: ver sección 5.

---

## 3. Las 10 inconsistencias entre pantallas más importantes

1. **Formato de dinero**: colones `₡1.000.000` (sin decimales, punto de miles) vs dólares `$1,000,000.00` (coma de miles, 2 decimales), `lib/money.js:84-97`. Se ve lado a lado en Historial e Inicio.
2. **Volver atrás**: Categorías, Presupuestos, Gastos fijos y Legal tienen "‹ Ajustes"; Ahorros y Editar movimiento no tienen ninguno; Bienvenida (repetir) tiene "Cancelar" que lleva a Inicio.
3. **Entrada de montos**: Agregar usa teclado propio; Gastos fijos, Presupuestos, Ahorros y Bienvenida usan campo de texto; los de Presupuestos muestran dígitos crudos.
4. **Elección de categoría**: pills en Agregar vs `<select>` nativo en Gastos fijos, Bienvenida e Historial (filtro).
5. **Botones "Guardar"**: relleno turquesa fijo en Agregar, punteado/desactivado en Ajustes y Gastos fijos, siempre activo en Presupuestos; confirmación distinta (navegar a Inicio, texto "Guardado" chico, ninguna).
6. **Títulos**: `.screen-title` centrado en casi todas; `h1` dentro de la tarjeta en Legal; "Editar movimiento" y "Agregar gasto" cambian de título pero comparten barra.
7. **Fila de movimiento**: con nota (título = nota, meta = categoría · método) vs sin nota (título = categoría, meta = solo fecha/nada, "Efectivo" nunca aparece); alto 39 vs 21 px.
8. **Color del negativo**: rojo en listas y "Gastado"; blanco en "Te queda esta quincena"; sin color en "Saldo" de Historial.
9. **Selector de moneda**: pills centradas (Estadísticas), a la izquierda (Presupuestos, Ahorros, Agregar), y en Inicio dos tarjetas completas.
10. **Etiquetas de sección**: Historial/Estadísticas/Ajustes usan `<p class="label">` en mayúsculas pequeñas; algunos grupos de pills (Filtros de tipo y método) no tienen etiqueta.

Extra: "Quincenas anteriores" incluye la actual; "Gastos fijos" incluye ingresos; la barra superior es la misma en Ajustes pero ninguna pestaña queda activa.

---

## 4. Lo que funciona bien y debe conservarse

- Inicio: "Puedes gastar hoy" como cifra dominante, mensaje de apoyo en texto ("Ya no queda para hoy"), no solo en color, y el progreso de la quincena (días) arriba.
- Teclado numérico propio en Agregar: grande, con "000", Guardar fijo abajo y pista de por qué está desactivado; también acepta el teclado físico.
- Aviso "¿Marcar como pagado?" al registrar un gasto que coincide con un gasto fijo: evita duplicados y explica la decisión.
- Diálogo de "Borrar todos los datos" (resumen de lo que se pierde, no se puede deshacer, descarga previa opcional, foco en Cancelar).
- Estados vacíos claros y consistentes (Inicio, Estadísticas, Historial) con acción directa.
- Contraste en oscuro (>= 6:1) y casi todo en claro (>= 4,58:1); foco visible turquesa de 2 px; enlace "Saltar al contenido"; `overflow-wrap` evita desbordes horizontales: no hubo scroll horizontal en ninguna pantalla a 320 px.
- Validación con mensajes en español claros ("Escribe un monto válido, como 1.500 o 12,50"; días de pago 1 a 31).
- Menú superior sticky legible en móvil; la pestaña activa es evidente; inglés y español cubiertos con las mismas claves.
- Límites de texto aplicados con `maxLength` (nota 60, categoría 24, perfil 30) y cortes con `overflow-wrap`.
- Tema claro y oscuro coherentes; hover solo con `@media (hover: hover)`; `prefers-reduced-motion` respetado en CSS.

---

## 5. Lo que no se pudo probar

- **Teclado virtual real** del teléfono (no hay emulación): no se verificó si la barra de Guardar y la barra superior tapan los campos Nota/Fecha. Solo se midieron posiciones sin teclado.
- **Zoom real del navegador** (Ctrl +) y tamaño de letra del sistema: se simuló multiplicando `font-size` en línea (1,5x) y `html{font-size:200%}`; ninguno reemplaza al zoom real.
- **Reducción de movimiento** (`prefers-reduced-motion`): no hay emulación; solo se revisó el CSS.
- **Hover real** y `:active` táctil: solo CSS revisado; los clics fueron del navegador, no táctiles.
- **Lector de pantalla**: solo se inspeccionó DOM (roles, regiones `aria-live`, encabezados).
- **Android/Capacitor** (no existe todavía) y varias pestañas a la vez (el app solo permite una).
- **"Sin día fijo"** y días de pago personalizados guardados (solo se vio el formulario y su validación); "Restaurar respaldo" y exportaciones CSV (no se descargó nada); la pantalla de consentimiento en móvil (solo en 1280).
- El tema del sistema (`prefers-color-scheme`) y orientación horizontal.
- La captura de pantalla del navegador llegó con un paso de retraso; los hallazgos de layout se confirmaron con `getBoundingClientRect` y texto del DOM.
