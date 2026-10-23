# QA independiente del rediseño "amable y cercano"

Fecha: 2026-10-23. Rama `feat/rediseno-amable` (commits `7b9e967`, `6d368a0`). Solo lectura: no se editó ningún archivo existente.
Navegador integrado (Chromium), servidor propio en el puerto 5185 (ya detenido). Tamaños: 1280x720 (el panel real mide 720 de alto), 1024x768, 900x800, 768x1024, 375x812, 375x667, 320x700. Tema oscuro y claro. Todo en español (el inglés no se recorrió).
Al terminar: datos borrados con "Borrar todos los datos" y luego "Retirar consentimiento", viewport en desktop, servidor detenido, puerto 5185 sin escucha.

Severidad: **alta** = confunde con dinero, pierde o duplica datos; **media** = se nota y molesta; **baja** = pulido.

Resultado general: no hay scroll horizontal en ninguna pantalla a 320 (`scrollWidth == innerWidth` en Inicio, Agregar, Editar, Historial, Estadísticas, Ajustes, Categorías, Presupuestos, Gastos fijos, Ahorros, Legal, Consentimiento, Bienvenida; la tabla legal desplaza dentro de su propio contenedor). Ninguna cifra se partió dentro del número (₡1.000.080.100 y ₡1.000.000.000 caben en una línea a 320). Cero errores de consola. Ningún control interactivo mide menos de 40 px. Contraste medido (canvas + fórmula WCAG): oscuro todo >= 5,24; claro todo >= 4,6.

---

## 1. Problemas, del peor al menor

1. **Inicio, 320/375/1280, ambos temas: "Omitir" un pendiente se ve igual que "Confirmar" ("✓ Listo") y no se puede deshacer.**
   Evidencia: con Salario y Alquiler pendientes, "Confirmar" en Salario y "Omitir" en Alquiler dejaron ambas filas con el texto idéntico `✓ Listo` (sin dinero registrado en Alquiler). Nadie sabe si el alquiler se pagó o se saltó; omitir tampoco pide confirmación ni da aviso.
   Severidad: **alta** (confunde con dinero).
   Arreglo: `HomeScreen.jsx:615-618` (lista `handled`): distinguir por estado: confirmado "✓ Registrado" y omitido "Omitido" (texto, no solo icono), con "Deshacer" o al menos un toast "Omitido: Alquiler". Requiere que `handled` sepa si fue confirmado u omitido.

2. **Historial, todos los tamaños: el total del día es un neto sin etiqueta y se lee como "gastado".**
   Evidencia: el día de hoy con Salario +₡450.000 y gastos por ₡1.000.023.400 mostró en la cabecera `−₡999.573.400` (= neto). Antes de agregar el ingreso mostraba `−₡1.000.023.400`; el número cambió sin que el gasto cambiara. El comentario de `HistoryScreen.jsx:316` dice "net of the day" (decisión de código), pero la pantalla no lo dice.
   Severidad: **media** (cifra de dinero ambigua).
   Arreglo: `HistoryScreen.jsx:317-325`: mostrar solo "gastado del día" (gastos, sin signo ambiguo) y, si hay ingresos, una segunda cifra "+₡X" en verde; o etiquetar ("Neto"). Mantener una cifra por moneda.

3. **Agregar, 1280x720 y 1280x800: el botón "Guardar" queda fuera de la primera pantalla.**
   Evidencia: `.save-bar` pasa a `position: static` desde 900 px; en 1280x720 su `top` = 848 px (documento de 988 px, viewport 720). Hay que desplazarse para guardar un gasto, mientras bajo el teclado numérico (columna izquierda) sobra espacio. Antes (auditoría) el botón era fijo.
   Severidad: **media**.
   Arreglo: `index.css:3138-3146`: en >= 900 px dejar la barra `sticky; bottom: 0` solo bajo la columna del teclado, o mover "Guardar" a la columna izquierda bajo el teclado (el comentario dice que lo quitaron porque tapaba la columna derecha; con `width` de la columna izquierda ya no taparía).

4. **El botón redondo "+" tapa cifras y texto en casi todas las pantallas de móvil.**
   Evidencia: cubre el monto "₡19.900" de la primera categoría en Inicio (375, 812), el total del día "−₡1.000.023.400" en Historial (320), "$12…" en Estadísticas (375), texto de la política legal ("...se queda en el") y aparece también en Ajustes, Legal, Ahorros, Presupuestos, Gastos fijos, Categorías y en el estado vacío de Inicio, donde ya hay dos botones de agregar. Se oculta solo con diálogo abierto o >= 900 px.
   Severidad: **media**.
   Arreglo: `AddFab.jsx` / `App.jsx:70`: mostrarlo solo en Inicio, Historial y Estadísticas, ocultarlo en Ajustes y subpantallas, Legal y Agregar/Editar, y no en el estado vacío de Inicio; opcional: esconderlo al bajar y mostrarlo al subir (`index.css:2452-2480`). Hoy el relleno inferior (`main:has(+ .add-fab)`, `index.css:2488`) solo evita tapar lo último.

5. **Historial, 320 y 375: la tarjeta de resumen del mes queda desalineada.**
   Evidencia (captura 320): las etiquetas "Gastado" quedan a la derecha de su columna y no sobre su cifra ("Gastado" x=73 vs "−₡111.100" x=58); "Ingresos" y "Gastado" suben y bajan en alturas distintas por moneda. Causa: `.hist-fig` con `align-items: flex-end` dentro de `.hist-line` con `flex-wrap` (`index.css:2894-2902`).
   Severidad: **media**.
   Arreglo: a <= 400 px hacer `.hist-line` una rejilla: nombre de moneda en una fila y debajo dos columnas con `text-align: left` para etiqueta y cifra.

6. **Agregar, 320: las etiquetas de categoría se parten en medio de la palabra.**
   Evidencia: "Transpor/te" y "Diversió/n" (columna de 61 px, `overflow-wrap: anywhere`, 13 px). Dos palabras de las cuatro categorías por defecto salen mal en el teléfono más chico.
   Severidad: **media**.
   Arreglo: `index.css:2641-2651` (`.cat-tile-label`): `overflow-wrap: break-word; hyphens: auto` o bajar a 12 px o 3 columnas bajo 340 px; dejar `anywhere` solo para nombres largos sin espacios.

7. **Inicio: la oferta "Sobró de la quincena anterior" queda enterrada y "Pasar a ahorros" no confirma nada.**
   Evidencia: en 375 la tarjeta aparece después de "En qué se fue tu dinero" y antes de Pendientes (a ~1100 px de la parte alta). Al pulsar "Pasar a ahorros" (₡69.000) la tarjeta desapareció sin toast ni mensaje; el único rastro es "Ahorros ₡69.000" al final de la página.
   Severidad: **media** (la propuesta pide "feedback tranquilizador").
   Arreglo: `HomeScreen.jsx:402-430` y `moveLeftover` (~:111): `toast.show({ message: ... })` con el monto y destino; subir `offersCard` justo bajo el hero.

8. **Ahorros, 375: se muestran a la vez los dos avisos de falta de fondos (hallazgo de la auditoría, sigue abierto).**
   Evidencia: con ₡5000 escrito aparecen "No tienes tanta plata disponible... Disponible: ₡0" y "No tienes tanto en ahorros. Ahorrado: ₡0"; el segundo queda pegado a la etiqueta "Nota (opcional)" sin margen. Ninguno lleva icono.
   Severidad: **media**.
   Arreglo: `SavingsScreen.jsx`: mostrar un aviso por vez (según el botón enfocado) o ambos como lista con margen inferior; botones "Pasar"/"Sacar" desactivados con la razón al lado.

9. **Editar: el diálogo "¿Eliminar este movimiento?" no dice cuál (abierto de la auditoría).**
   Evidencia: texto exacto `¿Eliminar este movimiento?` sin monto, nota ni fecha. Sí devuelve el foco a "Eliminar" al cerrar (mejoró).
   Severidad: **media**.
   Arreglo: `EditScreen`/`DialogProvider`: añadir una línea "Supermercado · −₡6.400 · 23/10" (copiar el nivel de detalle del diálogo de borrar todo).

10. **Barra de "Guardar" en 375x667: la fila inferior del teclado (000, 0, ⌫) queda bajo la barra.**
    Evidencia: teclas `top 516 / bottom 570`; barra `top 560, alto 107` (incluye la pista de 40 px). Se tapan ~10 px (18 %) de las teclas al abrir Agregar. A 320x700 igual (se ve cortada).
    Severidad: **baja/media**.
    Arreglo: `index.css:906-916`: ocultar la pista "Escribe el monto para poder guardar" y ponerla como `aria-describedby`, o compactar el teclado (alto de tecla 48 px) en alturas < 700.

11. **Inicio/Presupuestos: "100% del presupuesto" aparece con 99,5 % usado.**
    Evidencia: Comida ₡19.900 de ₡20.000 → "100% del presupuesto" (ámbar). Suena a "ya se acabó" cuando faltan ₡100.
    Severidad: **baja/media**.
    Arreglo: `CategoryBars.jsx:96`: `Math.floor(ratio * 100)` (y mostrar "99%"); reservar "100%" para >= 1.

12. **Accesibilidad global (abierto de la auditoría).**
    - `document.title` siempre "I AM POOR FOR NOW" en todas las rutas.
    - `<nav>` sin `aria-label`; el engranaje no queda con `aria-current="page"` en subpantallas de Ajustes (`/savings`, `/settings/*`, `/legal/*`): ninguna pestaña activa.
    - Los botones "Confirmar"/"Omitir" de cada pendiente no dicen de cuál son (nombre accesible solo "Confirmar").
    - Agregar: 16 paradas de Tab por el teclado numérico antes de llegar a Categoría; la tecla decimal se anuncia como ".".
    Severidad: **media** (títulos y nav), **baja** (resto).
    Arreglo: `App.jsx`/`ScrollToTop.jsx` (título por ruta y foco al `h1`), `aria-label` en `nav`, `aria-label={`${t('confirm')} ${item.note}`}` en `HomeScreen.jsx:596-610`, `tabIndex={-1}` o `role="group"` con etiqueta en `.keypad`.

13. **Páginas legales: borrador visible (sigue abierto; no es del rediseño pero se ve).**
    Evidencia: `[FECHA]`, `[NOMBRE DEL RESPONSABLE]`, `[CÉDULA]`, `[DIRECCIÓN]`, `[CORREO DE CONTACTO]` y "English version: politica-de-privacidad.en.md" (nombre de archivo en `<code>`, no enlace).
    Severidad: **alta antes de publicar**, baja hoy.
    Arreglo: completar los datos o quitar la línea "English version" en `LegalText.jsx`.

14. **Categorías (abierto de la auditoría).** Sin botón "Nueva categoría" (solo se crean desde "Otra" al guardar un gasto); el campo "Mover sus movimientos a (2)" no se entiende (el "(2)" es el número de movimientos).
    Severidad: **media**. Arreglo: `CategoriesScreen.jsx`: botón "Nueva categoría"; texto "Mover sus 2 movimientos a".

15. **Toast "Gasto guardado"/"Ingreso guardado", 320 y 375: el mensaje se parte en dos líneas.**
    Evidencia: ancho 288 px (320) y 343 px (375) con "Gasto/guardado" en 2 líneas porque la acción "Agregar otro" (no se parte) y la X de 44 px dejan poco sitio. El aviso es opaco (`rgb(29,40,44)` oscuro, `surface-2` claro), legible, `aria-live="polite"` (en la región `.toast-region`), dura 4 s, se pausa con foco/ratón, no tapa el "+" (queda 12 px más arriba). Tapa parcialmente el título de la tarjeta de debajo (transitorio).
    Severidad: **baja**.
    Arreglo: `index.css` `.toast-action` (`padding: 0 var(--space-2)`, quitar `gap` o reducir el ancho de la X a 36 px) o `.toast-message { white-space: nowrap }` con `max-width`; subir `TOAST_MS` (`ToastProvider.jsx:8`) a ~5000 mientras haya acción.

16. **Presupuestos/Ahorros/Gastos fijos: entradas de monto como texto crudo y selector nativo (abierto).**
    Evidencia: Presupuestos muestra `20000`, `3000`, `100000` sin separadores en los campos (`inputmode=decimal`, sin `maxlength`); Ahorros "Monto" sin símbolo de moneda; Gastos fijos y filtro de Historial usan `<select>` nativo para categoría mientras Agregar usa cuadrícula de iconos.
    Severidad: **baja**.
    Arreglo: formatear al salir del campo, mostrar símbolo ₡/$ y `maxLength`; unificar el selector de categoría.

17. **Formatos de dinero mezclados (abierto).** Colones `₡1.000.000.000` (punto de miles, sin decimales) y dólares `$1,250.00` (coma de miles, 2 decimales) conviven en la misma tarjeta ("−₡1.000.111.100" y "−$22.49" en Historial). Teclado USD muestra `$1,250` y "−$1,250.00" después.
    Severidad: **baja** (decisión de producto, `lib/money.js`).

18. **Inicio "Recientes": un gasto futuro va primero y sin año.**
    Evidencia: gasto de 05/03/2028 se muestra arriba como "Próximo · 05/03" (sin "2028"); el aviso al crearlo dice "Esta fecha es más de 3 días en el futuro" para una fecha a 2 años. El "Próximo" en ámbar sí se dice con palabras (bien).
    Severidad: **baja**.
    Arreglo: ordenar "Recientes" por fecha <= hoy y poner los próximos en su propio bloque; agregar el año cuando sea distinto del actual; mensaje "Esta fecha está lejos (05/03/2028)".

19. **Cabecera, 768 a 1024 px: la barra ocupa dos filas (113-125 px) aunque sobra ancho.**
    Evidencia: `header` 113 px a 768, 125 px a 900 y 1024; a 1280 una sola fila (81 px). La parte pegada (nav) sí queda en 65 px (el `top: -60px` funciona). En el tablet "I AM POOR FOR NOW" + menú caben en una fila.
    Severidad: **baja**. Arreglo: bajar el punto en que el menú pasa a la fila del logo (a ~720 px en vez de ~1100).

20. **Historial 320: la cabecera del día se parte ("Hoy · / vie 23/10") con los totales en columna.**
    Evidencia: `.day-head` ancho 254 px; título en 2 líneas y totales de dos monedas apilados. Sin partir cifras. `index.css:2931-2955`.
    Severidad: **baja**. Arreglo: título `white-space: nowrap` abreviado a "Hoy" y la fecha en el `sub`; los totales debajo.

21. **Estadísticas (abierto parcial).** El gráfico sigue sin valores por barra (una barra enorme aplasta a las demás: con ₡1.000.000.000 todas parecen 0); "Movimientos" no sigue el periodo (Semana/Mes/Año) y lista un gasto de 2028 en "Año 2026" aunque ya dice "Próximo"; las cifras del desglose por quincena miden 12 px (`+₡250.000 · −₡1.000.080.100`).
    Severidad: **baja/media**. Arreglo: etiqueta de valor al tocar una barra; filtrar `Movimientos` por periodo; 13-14 px en el desglose.

22. **Nombre largo: en Inicio a 320 el nombre de 24 letras y el subtítulo se truncan ("ABCDEF…", "100% de l…").** Aceptable, pero pierde "de lo gastado". `index.css` `.row-name`/`.row-meta` en CategoryBars. Severidad: **baja**. Arreglo: mostrar el subtítulo en una segunda línea completa o usar `line-clamp: 2` en el nombre.

23. **Detalles de consistencia menores.**
    - "Cómo se corta la quincena" repite "El 15 y el 30 de cada mes" como subtítulo y como píldora activa (sigue).
    - Sin resultados en Historial: dos botones "Quitar filtros" (barra y tarjeta).
    - "Cancelar" de "Repetir configuración inicial" va a Inicio, no a Ajustes.
    - "Gastos fijos" lista también ingresos (Salario).
    - Sin `:active` en `.back-link`, `.toast-action`, `.text-link`, filas de Ajustes y botones de mes (`index.css` tiene `:active` solo en btn, pill, key, tx-row, cat-tile, date-tile, fab).
    - La tira de fechas se corta a la izquierda sin degradado ("ar 0" en 375/320) y no avisa que se desliza.
    - "Repetir hoy" abre Agregar con el monto pero el título sigue "Agregar gasto" (no dice "Repetir").
    - "Borrar todo" parte en dos líneas a 320 (diálogo de borrar todo).
    Severidad: **baja**.

---

## 2. Hallazgos de la auditoría anterior (`auditoria-ui.md`)

**Corregidos (verificados):**
- Sin confirmación al guardar: ahora "Guardando…" y toast "Gasto guardado / Ingreso guardado" con "Agregar otro" (confirmado en 320, 375, oscuro y claro).
- Doble envío: triple clic real en Guardar creó 1 solo movimiento (Historial: una fila ₡5.000).
- "Gastado por método" mostraba la quincena de hoy en cualquier mes: en Julio ya no aparece; en mayo vacío tampoco.
- Mes vacío: mensaje arriba ("No hay movimientos en mayo", icono de calendario) y sin botón de exportar.
- Búsqueda sin resultados: estado claro con "Quitar filtros".
- Filtros con etiquetas "Tipo" y "Método de pago", botón con `aria-expanded`.
- Editar y Ahorros con enlace "‹ Historial" / "‹ Ajustes".
- Monto hero partido y "−" separado del número: no se repite (Inicio, Historial, Estadísticas a 320).
- Objetivos táctiles chicos (aviso de respaldo, filas sin nota): ningún control < 40 px.
- Contraste claro (píldoras 4,92, ingreso 4,69, ámbar 4,86): todo >= 4,5.
- Etiquetas de sección como `h2` (Ajustes, Agregar, Legal, Consentimiento) y `h1` único por pantalla.
- "Quincenas anteriores" renombrado a "Tus quincenas" con etiqueta "Esta quincena".
- Futuros marcados "Próximo" con palabra y color.
- Ajustes con "Administrar" arriba. Recuadro del `h1` al avanzar en la bienvenida: con ratón real no aparece (`outline: none`, `:focus-visible` falso); solo con modalidad teclado, que es correcto.
- Presupuestos: confirmación con toast "Guardado".
- Dinero: gasto en color normal con "−", ingreso verde con "+", cero apagado sin signo, colones y dólares nunca sumados (resumen de Historial, Inicio y Estadísticas por moneda).

**Siguen abiertos:** título de documento fijo; `nav` sin `aria-label`; sin pestaña activa en subpantallas de Ajustes; foco no se mueve al `h1` al cambiar de ruta (el foco se queda en un tile de categoría tras ir a Agregar); 16 paradas de Tab en el teclado; "Cancelar" de la bienvenida a Inicio; "Gastos fijos" con ingresos; Categorías sin "Nueva"; "(2)" confuso; diálogo de eliminar sin detalle; avisos dobles en Ahorros; Presupuestos con dígitos crudos y selector nativo en otras pantallas; formatos de dinero mezclados; legal con borrador; gráfico sin valores; "Movimientos" sin filtro por periodo; moneda y categoría recordadas en silencio (la moneda USD se quedó tras un gasto; ahora el botón USD se ve activo, mejora parcial).

**No se pudo comprobar si se corrigió:** días de pago precargados (5 y 20 vs 15 y 30; no se abrió "Mis días de pago"), `rem` en tamaño de letra, zoom 1,5x.

---

## 3. Lo que funciona bien

- Inicio: "Puedes gastar hoy" dominante, "Ya no queda para hoy" en ámbar con palabras, "Te pasaste por ₡X", tres preguntas claras; estado vacío acogedor ("Empecemos con tu quincena"); paso a una columna en móvil y dos en escritorio.
- Presupuestos en palabras y color: "100% del presupuesto" (ámbar) y "Te pasaste por ₡200" (rojo), barra + texto, nunca solo color.
- Agregar: monto arriba con tamaño que se reduce solo (₡1.000.000.000 cabe a 320), teclado, cuadrícula de iconos, tira de fechas con hoy visible, advertencia de fecha lejana, categoría nueva con límite 24 y nota 60 con `maxLength`; el botón Guardar se desactiva con la razón escrita.
- Filas con icono, nombre truncado con elipsis, monto a la derecha sin partirse; cifras de 12 caracteres a 320 sin desbordar.
- Diálogos nativos `<dialog>`: foco inicial en "Cancelar", Esc cierra y devuelve el foco, entrada suave; diálogo de "Borrar todo" con resumen exacto (21 movimientos, 3 presupuestos...).
- Paridad oscuro/claro: mismas jerarquías, claro cálido (arena) sin pérdidas de contraste.
- Movimiento: duraciones de 120/200/280 ms, `:active` con escala 0,97 en botones, pills, teclas, filas, categorías, fechas y "+"; toast sube 8 px en 200 ms; no retrasan nada; `prefers-reduced-motion` cubierto en CSS (toast pasa a solo opacidad).
- Consola limpia y sin errores en todas las pantallas.

---

## 4. Lo que no se pudo probar

- `prefers-reduced-motion`, teclado virtual real del teléfono, zoom del navegador, `font-size` del sistema, hover y toque real, lector de pantalla.
- Inglés (no se cambió el idioma), días de pago personalizados y "Sin día fijo", exportar CSV, descargar y restaurar respaldo, pestañas simultáneas, Android/Capacitor.
- El estado "mes con gasto pero sin ingreso" en Inicio, USD como moneda principal del onboarding, y tablets en pantallas distintas de Historial (solo se midió la barra en 768/900/1024).
- Los screenshots llegaban con un paso de retraso (varias capturas mostraban el estado anterior); los hechos se confirmaron con `getBoundingClientRect`, `getComputedStyle` y texto del DOM.
- El tamaño real del panel es 1280x720; los 800 de alto se razonaron con la posición medida del botón (848 px).
