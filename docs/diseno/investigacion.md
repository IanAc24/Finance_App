# Investigación de diseño: dirección "amable y cercana"

Documento de investigación para el rediseño de POBRE, POR AHORA. No cambia código. Las decisiones de producto siguen siendo de las personas (ver `docs/decisiones.md`).

Nota de método: los patrones de la sección 1 vienen del conocimiento general de esas apps (uso público y material de sus sitios), no de capturas verificadas en esta sesión. La búsqueda web solo devolvió artículos genéricos, así que los enlaces son las páginas oficiales (comprobé que responden) y conviene que alguien abra cada app antes de copiar nada. Los contrastes de la sección 2 sí están calculados con la fórmula WCAG 2.x (luminancia relativa), no estimados.

---

## 1. Referencias

| App | Qué vale la pena tomar | Pantalla |
|---|---|---|
| Monzo (https://monzo.com/) | Lista de movimientos agrupada por día con icono de categoría en círculo y comercio como nombre; textos conversacionales y tranquilos al empezar. Resumen de "cuánto queda" arriba, sin tecnicismos. | Historial, Inicio |
| Cleo (https://www.meetcleo.com/) | Tono cercano y con humor ligero en los mensajes; resúmenes cortos en frases ("llevas X en comida") en vez de tablas. | Estados vacíos, Inicio |
| Emma (https://emma-app.com/) | Gasto por categoría con icono + color y barra de proporción simple; vista "a dónde se fue el dinero" en una sola pantalla. | Inicio, Estadísticas |
| YNAB (https://www.ynab.com/) | Idea de "darle un trabajo a cada colón": un solo número de lo disponible por categoría; barra de progreso con texto ("te quedan ₡X"), no solo color. | Presupuestos |
| Copilot Money (https://copilot.money/) | Jerarquía visual muy limpia: cifra grande, etiqueta pequeña, colores suaves por categoría con icono sobre círculo tintado. Animación breve al cambiar números. | Inicio, Historial |
| Nubank (https://www.nubank.com.br/) | Una sola cifra protagonista, controles grandes y espacio generoso; confirmaciones claras tras cada acción con texto corto. | Inicio, Agregar |
| Mercado Pago (https://www.mercadopago.com/) | Teclado numérico grande para montos y botón primario único abajo; pantalla de "listo" con icono de check y resumen de lo hecho. | Agregar, éxito |
| Wallet by BudgetBakers (https://budgetbakers.com/) | Selector de categoría como cuadrícula de iconos con color; ingreso rápido: monto primero, categoría con un toque, nota opcional. | Agregar |

Patrones concretos a adoptar:
- **Inicio:** una cifra grande ("Puedes gastar hoy") y una línea de contexto debajo; "a dónde va tu dinero" como lista corta de 3-5 categorías con icono, nombre, monto y barra fina (Emma, Copilot).
- **Agregar:** monto primero con teclado propio grande, categoría como cuadrícula de iconos, nota opcional al final (Mercado Pago, BudgetBakers).
- **Historial:** agrupado por día con cabecera de fecha y total del día; fila = círculo tintado con icono + nombre + meta pequeña + monto a la derecha (Monzo, Copilot).
- **Vacíos y éxito:** icono simple, una frase que tranquiliza y un solo botón; confirmación breve que se quita sola, sin pedir otro toque (Nubank, Cleo).

---

## 2. Paleta propuesta

Principios (del brief):
- Verde no significa "ahorraste" automáticamente y rojo no significa "gasto malo". El gasto normal **no es un error**.
- **Montos de gasto en `--text`** (color normal) y color solo para ingreso. El gasto se distingue con signo "−" y posición, no con color. Así no se grita en rojo cada compra. `--spending` queda solo para barras/gráficos (rosa-terracota tranquilo), nunca como único aviso.
- `--danger` solo para borrar, errores y "presupuesto pasado", y siempre acompañado de texto o icono.
- Cero es neutro: se pinta con `--muted`.
- La gravedad nunca va solo por color: texto ("Te pasaste ₡X") + icono.

### 2.1 Tokens

Tema oscuro (por defecto):

| Token | Valor |
|---|---|
| `--bg` | `#0e1517` |
| `--surface` | `#151e21` |
| `--surface-2` | `#1d282c` |
| `--border` | `#2a373c` |
| `--text` | `#e8eeee` |
| `--muted` | `#9aacb0` |
| `--accent` | `#4cc9b8` |
| `--accent-soft` | `#1e3939` (acento 16% sobre `--surface`; en CSS: `color-mix(in srgb, var(--accent) 16%, var(--surface))`) |
| `--on-accent` | `#052a26` |
| `--income` | `#7fd1a6` |
| `--spending` | `#e59a8f` (solo gráficos) |
| `--warning` | `#e6b566` |
| `--danger` | `#f0928a` |

Tema claro (arena):

| Token | Valor |
|---|---|
| `--bg` | `#f6f3ee` |
| `--surface` | `#fffefb` |
| `--surface-2` | `#efebe4` |
| `--border` | `#e0dad0` |
| `--text` | `#1c2a29` |
| `--muted` | `#586867` |
| `--accent` | `#0f766e` (sin cambio) |
| `--accent-soft` | `#e2eeea` (acento 12% sobre `--surface`) |
| `--on-accent` | `#ffffff` |
| `--income` | `#2b7550` |
| `--spending` | `#a8493f` (solo gráficos) |
| `--warning` | `#8f5a0c` |
| `--danger` | `#b0352c` |

Categorías (8, mismos nombres que hoy: `orange, blue, violet, lime, cyan, fuchsia, slate, sand`, así no cambian los datos guardados). El círculo del icono usa `--cat-X-soft: color-mix(in srgb, var(--cat-X) 14%, var(--surface))`.

| Nombre | Oscuro | Círculo suave (oscuro) | Claro | Círculo suave (claro) |
|---|---|---|---|---|
| orange (Comida) | `#e8a06b` | `#33302b` | `#a9531a` | `#f3e6dc` |
| blue (Transporte) | `#85b4e8` | `#25333d` | `#2b66b0` | `#e1e9f1` |
| violet (Servicios) | `#b6a3e8` | `#2c313d` | `#6b50b5` | `#eae6f1` |
| lime (Diversión) | `#aecb70` | `#2a362c` | `#566f1c` | `#e7eadc` |
| cyan | `#6fc8d8` | `#22363b` | `#14738a` | `#deebeb` |
| fuchsia | `#d99ee2` | `#30303c` | `#94409f` | `#f0e3ee` |
| slate (Sin categoría) | `#a3b0ba` | `#293236` | `#4f5d68` | `#e6e7e6` |
| sand | `#d4ba90` | `#303431` | `#7f6429` | `#ede8de` |

Notas: el acento oscuro baja un poco de saturación (`#2dd4bf` a `#4cc9b8`); el claro no cambia (ya es suave y pasa). Los colores de categoría pierden brillo (menos neón, sobre todo lime y cian) y son pasteles en oscuro / tonos tierra en claro.

### 2.2 Contraste WCAG (texto sobre `--bg` y `--surface`)

Mínimos: texto 4.5:1; texto grande (>= 24px, o 18.66px en negrita) e iconos 3:1.

Tema oscuro, propuesta:

| Color | Sobre `--bg` | Sobre `--surface` | Cumple |
|---|---|---|---|
| text | 15.72 | 14.44 | sí |
| muted | 7.82 | 7.18 | sí |
| accent | 9.10 | 8.35 | sí |
| income | 10.17 | 9.34 | sí |
| spending | 8.21 | 7.54 | sí |
| warning | 9.81 | 9.01 | sí |
| danger | 8.07 | 7.41 | sí |
| on-accent sobre accent | 7.58 | | sí |
| accent sobre accent-soft | 6.09 | | sí |
| muted sobre surface-2 | 6.39 | | sí |

Tema claro, propuesta:

| Color | Sobre `--bg` | Sobre `--surface` | Cumple |
|---|---|---|---|
| text | 13.43 | 14.74 | sí |
| muted | 5.28 | 5.80 | sí |
| accent | 4.95 | 5.43 | sí |
| income | 5.04 | 5.53 | sí |
| spending | 5.14 | 5.64 | sí |
| warning | 5.22 | 5.73 | sí |
| danger | 5.59 | 6.14 | sí |
| on-accent (blanco) sobre accent | 5.47 | | sí |
| accent sobre accent-soft | 4.60 | | sí (justo) |
| muted sobre surface-2 | 4.92 | | sí |
| accent sobre surface-2 | 4.61 | | sí (justo) |

Categorías (icono sobre su círculo suave, mínimo 3:1; sobre `--bg`/`--surface` entre paréntesis):

| Categoría | Oscuro: icono/círculo | (bg / surface) | Claro: icono/círculo | (bg / surface) |
|---|---|---|---|---|
| orange | 6.05 | 8.50 / 7.80 | 4.36 | 4.82 / 5.29 |
| blue | 5.98 | 8.51 / 7.82 | 4.72 | 5.23 / 5.74 |
| violet | 5.82 | 8.25 / 7.58 | 4.97 | 5.52 / 6.05 |
| lime | 6.96 | 10.17 / 9.34 | 4.67 | 5.15 / 5.65 |
| cyan | 6.59 | 9.60 / 8.82 | 4.47 | 4.93 / 5.41 |
| fuchsia | 6.16 | 8.73 / 8.02 | 4.85 | 5.43 / 5.96 |
| slate | 5.91 | 8.33 / 7.65 | 5.47 | 6.12 / 6.72 |
| sand | 6.76 | 9.86 / 9.06 | 4.58 | 5.05 / 5.54 |

Todo lo propuesto cumple (el más bajo: naranja claro 4.36 sobre su círculo, para un icono basta 3:1; todos los colores de categoría ya sirven también como texto sobre `--bg`/`--surface`).

### 2.3 Fallos en la paleta ACTUAL (`src/index.css`)

Tema oscuro: ningún fallo de texto (el más bajo es `--danger` 5.85 sobre `--bg`, 5.37 sobre `--surface`).

Tema claro, fallos de 4.5:1 como texto:

| Color | Sobre `--bg` | Sobre `--surface` | Resultado |
|---|---|---|---|
| `--income` `#15803d` | **4.49** | 5.02 | falla por 0.01 sobre `--bg` |
| `--cat-lime` `#4d7c0f` | **4.47** | 4.99 | falla sobre `--bg` |
| `--cat-sand` `#8a6d3b` | **4.34** | 4.85 | falla sobre `--bg` |

Iconos sobre su círculo suave (14%), actual claro: orange 4.21, blue 4.24, lime 4.17, sand 4.08, todos >= 3:1, así que como icono pasan. Los demás actuales claros pasan (accent 4.90, spending 4.88, muted 5.01, warning 5.41, danger 5.80). La propuesta de arriba corrige los tres fallos.

Otro punto: `--border` de ambos temas es decorativo (1.50:1 oscuro, 1.26:1 claro); el repo ya tiene `--control-border` para los campos, y debe seguir usándose para inputs y teclas (límite de 3:1 para controles).

---

## 3. Iconos de categoría

**Recomendación: Lucide** (https://lucide.dev, repositorio https://github.com/lucide-icons/lucide).
- Licencia: **ISC** (permisiva, tipo MIT). Los iconos heredados de Feather llevan **MIT** (Cole Bemis). Fuente: https://lucide.dev/license y https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE.
- Atribución: no hace falta mostrarla en la pantalla, pero hay que **conservar el aviso de copyright y el permiso** donde se copien los SVG. Propuesta: poner los SVG en un solo archivo (p. ej. `src/components/icons.jsx`) con un comentario arriba con el aviso "Icons from Lucide (ISC License, Copyright (c) Lucide Icons and Contributors; some icons MIT, Copyright (c) Cole Bemis)" y el enlace a la licencia, y listar la licencia en una pantalla de "Acerca de/Licencias" si existe (ya hay páginas legales).
- Estilo: trazo de 2px, 24x24, `stroke="currentColor"`, `fill="none"`, esquinas redondeadas: va bien con el tono amable. Se usan como SVG en línea (copiar el contenido de `icons/<nombre>.svg`), sin dependencia nueva.
- Alternativas válidas: Phosphor (MIT, https://phosphoricons.com, tiene variante "duotone") y Tabler (MIT, https://tabler.io/icons). Lucide gana por ser el más ligero y consistente al copiar uno a uno.

Nombres exactos (comprobé que existen en el repositorio de Lucide):

| Categoría de la app | Icono Lucide | Color |
|---|---|---|
| Comida (`food`) | `utensils` | orange |
| Transporte (`transport`) | `bus` | blue |
| Servicios (`bills`) | `receipt` | violet |
| Diversión (`fun`) | `party-popper` (o `gamepad-2`) | lime |
| Sin categoría (`uncategorized`) | `circle-dashed` | slate |
| Ingreso | `hand-coins` (alternativa `wallet`) | usa `--income` en el monto; círculo con `--accent-soft` |
| Ahorro | `piggy-bank` | usa `--accent` / `--accent-soft` |
| Presupuesto (extra) | `wallet` | |
| Ayuda o "no hay dato" (extra) | `circle-question-mark` (el nombre viejo `circle-help` ya no existe) | |

Regla para categorías personalizadas (el modelo no tiene campo de icono; agregarlo requiere migración, fuera de alcance):
1. Círculo con el color de la categoría (`--cat-X` en el icono/letra, `--cat-X-soft` de fondo).
2. Dentro, **la primera letra del nombre en mayúscula** (Poppins, peso 600), porque identifica mejor que un icono genérico y no engaña. Si el nombre empieza con emoji o símbolo, usar `tag`.
3. Una categoría con nombre vacío o no legible usa `tag`.
Así lo "propio" se ve distinto de lo integrado sin tocar la base de datos. Las integradas siguen identificándose por `key`, no por el nombre traducido.

Accesibilidad: el icono es decorativo (`aria-hidden="true"`); el nombre de la categoría siempre está en texto al lado.

---

## 4. Escala tipográfica

Poppins para cifras y títulos (display); `system-ui` para el cuerpo (ya instalada vía @fontsource, sin dependencias nuevas). Cifras con `font-variant-numeric: tabular-nums` para que las columnas alineen.

| Uso | Fuente | Tamaño | Peso | Interlineado |
|---|---|---|---|---|
| Cifra principal (hero) | Poppins | 44px (36px en pantallas < 360px) | 600 | 1.1 |
| Título de pantalla | Poppins | 24px | 600 | 1.25 |
| Título de sección | Poppins | 18px | 600 | 1.3 |
| Cuerpo | system-ui | 16px | 400 | 1.5 |
| Nombre en fila | system-ui | 16px | 500 | 1.35 |
| Meta de fila (fecha, categoría) | system-ui | 14px | 400, `--muted` | 1.35 |
| Etiquetas (campos, pills) | system-ui | 13px | 500 | 1.3 |
| Monto en fila | Poppins | 16px | 600, tabular | 1.2 |

Reglas:
- Mínimo 13px para cualquier texto; el cuerpo en 16px evita el zoom automático de iOS en los campos.
- **Símbolo de moneda y decimales en cifras grandes:** el símbolo (₡ / $) al 55% del tamaño, peso 500, color `--muted`, alineado a la línea base; los decimales (`,50`) al 55-60%, mismo peso y `--muted`. El entero domina. En colones, que casi nunca usan decimales, mostrarlos solo si existen.
- **Etiquetas en mayúsculas pequeñas:** recomiendo pasar a **minúsculas normales (oración)**, 13px, sin `letter-spacing`. Las mayúsculas espaciadas se leen como formulario o panel técnico, son más lentas de leer en español y suenan a grito; la oración es más cercana. Mantener mayúsculas solo en la marca del título.
- Usar números con separador local (es-CR: `₡12 500`, en: `₡12,500`) tal como ya lo hace la app.

---

## 5. Espaciado, radios, elevación y movimiento

**Espaciado (base 4/8):** `--space-1: 4px`, `-2: 8px`, `-3: 12px`, `-4: 16px`, `-5: 24px`, `-6: 32px`, `-7: 48px`. Margen lateral de pantalla 16px. Separación entre tarjetas 12-16px; padding de tarjeta 16px (20px la tarjeta hero). Objetivos táctiles de al menos 44x44px.

**Radios (3 valores):** `--radius-sm: 10px` (campos, pills, teclas), `--radius-md: 16px` (tarjetas, filas agrupadas), `--radius-full: 999px` (círculos de icono, botones tipo píldora, barras).

**Elevación por tema:**
- Oscuro: sin sombras (se pierden sobre fondo oscuro); se separa con capas (`--bg` < `--surface` < `--surface-2`) y un borde de 1px `--border`. Tarjeta hero con un brillo suave del acento (`--hero-glow`, ya existe).
- Claro: sombra muy suave `0 1px 2px rgba(28,42,41,.06), 0 4px 12px rgba(28,42,41,.05)` en tarjetas, y borde `--border`. Sin sombras más fuertes.
- Hoja inferior/modal: oscuro, `--surface-2` con borde; claro, `0 -8px 24px rgba(28,42,41,.12)`.

**Movimiento (amable y corto, siempre menos de 300ms):**
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` (la que ya existe; una sola curva).
- `--dur-fast: 120ms` (pulsación, cambio de color), `--dur-base: 200ms` (aparecer/desaparecer, barras que crecen), `--dur-slow: 280ms` (hojas, confirmación de guardado).
- Pulsación: `transform: scale(.97)` en 120ms. Entrada de elementos: fundido + subir 6px, 200ms. Barras de progreso: crecen en 280ms. Confirmación de guardado: el check aparece con escala 0.8 a 1 en 280ms.
- Solo animar `transform` y `opacity`; no `width/height/top`.
- **`prefers-reduced-motion: reduce`:** quitar transformaciones y recorridos; dejar solo cambios de opacidad de <= 120ms o ninguno; las barras y cifras saltan al valor final. La información nunca depende de la animación.

---

## 6. Textos (es-CR con "tú", y en inglés)

| Situación | Español | English |
|---|---|---|
| Inicio, usuario nuevo (título) | Empecemos con tu quincena | Let's start with your pay period |
| Inicio, usuario nuevo (texto) | Anota lo que ganas y lo que gastas, y aquí verás cuánto puedes gastar hoy. | Add what you earn and spend, and you'll see how much you can spend today. |
| Inicio, botón | Agregar mi primer movimiento | Add my first transaction |
| Historial, sin resultados (título) | No encontramos nada con ese filtro | Nothing matches that filter |
| Historial, sin resultados (texto) | Prueba con otra palabra o quita algún filtro. | Try another word or clear a filter. |
| Historial, botón | Quitar filtros | Clear filters |
| Historial, mes vacío (título) | Este mes todavía no tiene movimientos | No transactions this month yet |
| Historial, mes vacío (texto) | Cuando agregues uno, aparecerá aquí. | When you add one, it will show up here. |
| Estadísticas, pocos datos (título) | Aún falta un poco de información | We need a bit more data |
| Estadísticas, pocos datos (texto) | Con unos días más de movimientos te mostramos a dónde se va tu dinero. | After a few more days of entries, we'll show where your money goes. |
| Guardando | Guardando... | Saving... |
| Guardado | Gasto guardado | Expense saved |
| Guardado (ingreso / ahorro) | Ingreso guardado / Ahorro guardado | Income saved / Saving saved |
| Error al guardar | No pudimos guardar. Tus datos están a salvo; inténtalo otra vez. | We couldn't save that. Your data is safe; please try again. |
| Error, botón | Reintentar | Try again |
| Monto inválido | Escribe un monto mayor que cero (máximo ₡1.000.000.000). | Enter an amount above zero (maximum ₡1,000,000,000). |

Reglas de tono: frases cortas, sin culpa ("aún falta", no "error"/"incorrecto"), una sola acción por mensaje, nada de signos de exclamación en errores, confirmaciones que se quitan solas en ~2.5s sin bloquear. Mensaje de monto inválido: usar el símbolo de la moneda activa. Los errores usan icono + texto + `--danger`, nunca solo color. Las claves van en `translations.js` en ambos idiomas, como exige la prueba de traducciones. "Saving saved" se resuelve mejor con claves separadas por tipo (gasto/ingreso/ahorro) y texto natural en cada idioma.

---

## 7. Dirección recomendada

- **Calma antes que alerta:** bajar saturación general (acento a `#4cc9b8` en oscuro, claro igual) y reservar el rojo/ámbar para situaciones reales con texto e icono.
- **El gasto no es un error:** montos de gasto en `--text` con signo "−"; color solo para ingresos (`--income`), y `--spending` solo en gráficos. Cero siempre en `--muted`.
- **Una cifra protagonista:** "Puedes gastar hoy" en Poppins 44px con símbolo y decimales atenuados; todo lo demás en segundo plano.
- **Categorías con identidad:** círculo tintado (14%) con icono Lucide en SVG en línea; personalizadas con la primera letra, sin migración.
- **Etiquetas en minúsculas de oración,** cuerpo en 16px y mínimo 13px: más legible y menos "panel técnico".
- **Movimiento suave y corto:** una sola curva, 120/200/280ms, pulsación con escala .97, confirmación con check, y reglas claras para `prefers-reduced-motion`.
- **Vacíos que guían:** un icono, una frase tranquilizadora y un solo botón; confirmaciones breves, sin culpa.
- **Cumplir contraste:** corregir en tema claro `--income`, `--cat-lime` y `--cat-sand`; mantener 4.5:1 en texto y 3:1 en iconos; todo en `src/index.css` con comentarios en español. Aviso: tocar `src/features/`, `src/components/` e `index.css` es zona visual de Ian; hacerlo solo desde una ficha y en rama aparte.
