# Auditoría: datos innecesarios y patrones oscuros

Fecha: 23/10/2026. Alcance: `finance-tracker` (rama ZOH, con cambios sin guardar de otros agentes). Auditoría de solo lectura. Marco: Ley 8968 de Costa Rica (finalidad, proporcionalidad: recoger solo lo necesario) y las categorías habituales de patrones oscuros.

Leyenda de zona: **[UI]** = zona de Ian (`src/features`, `src/components`, `src/index.css`, traducciones). **[BD]** = zona de Furyan (storage/migraciones; necesita una migración nueva, la 9).

## Resumen

- La app no tiene servidor, analítica ni cuentas: no sale ningún dato del aparato. Eso es lo más importante y está bien.
- Lo más serio en datos: "Borrar todos los datos" deja claves en `localStorage` y, para quien venga de la versión antigua, una copia completa de los movimientos. Además no hay ningún aviso de privacidad.
- Lo más serio en patrones: la casilla "Descargar primero un respaldo" viene marcada en el diálogo de borrar, y en "Repetir configuración" hay dos botones que dicen "Cancelar" con efectos distintos.
- No hay forzar continuidad, falsa urgencia, anuncios disfrazados, confirmshaming ni cuentas atrás.

---

## A. Minimización de datos

### Inventario de campos

| Dónde | Campo | Para qué se lee | ¿Funciona sin él? | ¿Opcional y marcado? | ¿Se exporta? | Veredicto |
|---|---|---|---|---|---|---|
| `transactions` | amount_cents, currency, type, date | todo el cálculo | no | requerido | respaldo + CSV | necesario |
| `transactions` | category_id | barras, presupuestos, filtros | sí (Sin categoría) | sí | respaldo + CSV | necesario |
| `transactions` | note | lista, búsqueda, sugerencias | sí | "Nota (opcional)" | respaldo + CSV | ver A3 |
| `transactions` | payment_method | filtro y total por método | sí (efectivo) | sí, con valor por defecto | respaldo + CSV | necesario (función visible) |
| `categories` | name, color | etiquetas | no | nombre requerido | respaldo | necesario |
| `budgets` | category_id, currency, amount_cents | barras de presupuesto | sí | "Sin límite" | respaldo | necesario |
| `recurring` | amount, currency, type, category, note, schedule | pendientes de Inicio | no | nota "(opcional)" | respaldo | necesario |
| `recurring` | last_period | decide si ya se confirmó | no | automático | respaldo | necesario |
| `savings` | amount, currency, direction, date, note | saldo de ahorros | no | nota opcional | respaldo | necesario |
| `quincena_config`, `quincena_manual` | modo y días de pago | cortes de quincena | no (hay valor por defecto) | sí | respaldo | necesario |
| `profile` | name | solo el saludo "Hola, X" (`HomeScreen.jsx:380`) y el campo de Ajustes | sí | "(opcional)" en bienvenida; en Ajustes **no** dice opcional | respaldo | proporcional pero ver A2 |
| `profile` | currency | moneda por defecto de formularios y de la meta | sí | sí | respaldo | necesario |
| `profile` | savings_goal_cents | "Puedes gastar hoy" (`quincena.js:52`) | sí | opcional | respaldo | necesario |
| `profile` | **income_cents** | **solo la bienvenida** (comparar al repetirla, `OnboardingScreen.jsx:235`); el mismo monto ya queda guardado como gasto fijo de tipo ingreso | sí | opcional | respaldo | **duplicado, ver A4** |
| `profile` | onboarded_at | decide si se muestra la bienvenida | sí | automático | no (se omite a propósito) | necesario |
| `localStorage` `lang`, `theme` | idioma y tema | sí | automático | no | sobrevive a "Borrar" (aceptable: preferencia de interfaz, no dato personal) |
| `localStorage` `lastCurrency`, `lastPaymentMethod`, `lastCategoryId` | valores por defecto del formulario Agregar | sí | automático | no | **sobreviven a "Borrar", ver A1** |
| `localStorage` `lastBackup` | fecha del último respaldo (aviso de Inicio) | sí | automático | no | **sobrevive a "Borrar", ver A1** |
| `localStorage` `rolloverSkip*` | sobrante omitido | sí | automático | no | se borra en "Borrar todos los datos" (`TransactionsProvider.jsx:257`): correcto |
| `localStorage` `finance-data`, `finance-data-imported` | importación única de la versión antigua | sí | automático | no | **sobreviven, ver A1** |
| Respaldo JSON | `exportedAt` (fecha y hora ISO) | **nunca se lee** al restaurar | sí | - | sí | ver A5 |

No hay borrado lógico (soft delete), columnas de creación/modificación, identificadores de aparato, ubicación ni correo. Nada se pone en URLs: las rutas son fijas (`/add`, `/settings`) y el estado "repetir" viaja en el estado interno del router. El título de la página es siempre "I AM POOR FOR NOW".

### Hallazgos

**A1. "Borrar todos los datos" no borra todo lo que quedó guardado.** Severidad: **media**. Zona: [UI] (la mitad) y [UI] para la limpieza de claves; el vaciado físico de la base es [BD].
- Dónde: `TransactionsProvider.jsx:257` solo quita `rolloverSkip*`; `storage.js:177-205` (clave `finance-data`); `SettingsScreen.jsx:99`.
- Qué pasa: lo comprobé en el navegador. Después de cargar datos de ejemplo y pulsar "Borrar todos los datos" > "Borrar todo", en `localStorage` siguen `lastBackup`, `lastCurrency`, `lastPaymentMethod`, `lastCategoryId`, `lang`, `theme` y `finance-data-imported`. Además, quien venga de la versión antigua conserva `finance-data` con todos sus movimientos y notas: el comentario del código dice que "la copia vieja nunca se cambia, queda como respaldo", y el diálogo de borrado no lo menciona.
- Por qué: principio de finalidad y derecho de supresión; la persona cree que borró todo (el diálogo dice "Vas a borrar todo esto" y "No se puede deshacer") y quedan rastros. `lastCategoryId` y `lastBackup` son poco sensibles, pero `finance-data` sí es el historial completo.
- Arreglo: en `clearAllData` (`TransactionsProvider.jsx`) llamar `removePref` para `lastBackup`, `lastCurrency`, `lastPaymentMethod`, `lastCategoryId` y `finance-data`. Dejar `lang` y `theme` (preferencias de interfaz) y `finance-data-imported` (evita reimportar). Si se prefiere, añadir al texto: "También se borran las preferencias de captura y el respaldo antiguo de este navegador."
- Complemento [BD]: ver A6 (restos en el archivo SQLite).

**A2. No hay ningún aviso de privacidad ni de dónde viven los datos.** Severidad: **media** (Ley 8968 exige informar finalidad y tratamiento; en las "Abiertas" de `decisiones.md` ya figura "Privacidad: Ley 8968 y PRODHAB").
- Dónde: bienvenida (`obBasicsHint`: "Unos pocos datos y listo. Todo es opcional...") y Ajustes. Ninguna pantalla dice que los datos se guardan solo en este aparato, que nada se envía, ni para qué se usa el nombre.
- Arreglo [UI]: añadir una línea a `obBasicsHint` / junto al campo del nombre:
  - ES: "Tus datos se guardan solo en este aparato; la app no los envía a ningún servidor. El nombre solo sirve para saludarte."
  - EN: "Your data stays on this device; the app does not send it to any server. Your name is only used to greet you."
  - En Ajustes, bajo "Tu nombre", poner también "(opcional)": hoy `profileName` es "Tu nombre" sin la marca de opcional.
- Cuando entre Firebase/Google (decisión del 19/10) esto deja de ser cierto: ese cambio necesita un aviso con consentimiento explícito, finalidad, qué sube (movimientos, notas, perfil), dónde, y un botón para borrar también la copia en la nube. Anotarlo en la ficha de privacidad antes de construir.

**A3. Campos de texto libre sin guía.** Severidad: **baja**.
- Dónde: nota de movimiento (`AddExpenseScreen.jsx:353`), nota de gasto fijo (`RecurringScreen.jsx:135`), nota de ahorros (`SavingsScreen.jsx:160`), nombre del gasto en la bienvenida, nombre de categoría. Etiqueta actual: `note` = "Nota (opcional)" / "Note (optional)". Tope de 60 caracteres (bien).
- Qué pasa: una nota viaja a la lista, a las sugerencias, al CSV y al respaldo en texto plano. Nada avisa de no escribir números de cuenta, cédulas ni contraseñas. En gastos fijos y en ahorros la nota funciona como nombre, pero la etiqueta dice "(opcional)".
- Arreglo [UI]: texto de ayuda bajo el campo, p. ej. ES: "Una palabra o dos, como 'Almuerzo'. No escribas números de cuenta, cédulas ni contraseñas: esto aparece en tus archivos de respaldo y CSV." EN: "A word or two, like 'Lunch'. Do not type account numbers, ID numbers or passwords: this appears in your backup and CSV files." Añadir `autoComplete="off"` a los campos de nota y de nombre de gasto/categoría para que el navegador no los memorice. El nombre de perfil usa `autoComplete="given-name"`, que invita al navegador a rellenar el nombre real: es aceptable, pero `off` es más prudente porque el nombre es opcional.

**A4. `profile.income_cents` es un dato duplicado.** Severidad: **baja**. Zona: [BD] para quitarlo; [UI] para dejarlo de usar.
- Dónde: migración 7 (`migrations.js`), `storage.js:88-93`, `backup.js:44`. El ingreso por pago ya se guarda como gasto fijo de tipo ingreso (`planIncome`); la columna solo sirve para detectar "lo que escribiste antes" al repetir la bienvenida.
- Arreglo: no urgente. Si se quiere minimizar, migración 9 que elimine la columna y que `planIncome` compare contra el gasto fijo existente; mientras tanto se puede dejar. Decisión de producto de Furyan.

**A5. `exportedAt` del respaldo nunca se lee.** Severidad: **baja**. Zona: [UI] (`backup.js` es lógica, no base).
- Dónde: `backup.js:30`. Se escribe fecha y hora exactas y no se usa al restaurar. Aporta trazabilidad al archivo, pero es un dato escrito sin lectura.
- Arreglo: quitarlo, o dejarlo solo con la fecha (`YYYY-MM-DD`). El formato sigue en versión 1: restaurar ignora el campo, no se rompe nada. Anotar la decisión.

**A6. Restos del archivo SQLite tras borrar.** Severidad: **baja/media**. Zona: [BD].
- Dónde: `database.js` (base `no-encryption`, sin `VACUUM` ni `PRAGMA secure_delete`); `storage.js` `clearAll`/`DELETE`. En SQLite, `DELETE` deja las páginas libres con el contenido viejo hasta que se reutilizan; el archivo completo se guarda en IndexedDB (`jeepSqliteStore`). Quien abra los datos del navegador podría recuperar fragmentos de lo "borrado".
- Arreglo: tras `clearAll` ejecutar `PRAGMA secure_delete = ON` (al abrir la conexión) o `VACUUM` y luego `persist()`. No pude comprobar si realmente quedan fragmentos; es una limitación conocida de SQLite, sin verificar aquí.

**A7. Archivos descargados.** Severidad: **baja** (sin hallazgo grave).
- Nombres: `i-am-poor-for-now-backup-AAAA-MM-DD.json`, `...-before-clear-...`, `...-before-restore-...`, `i-am-poor-for-now-AAAA-MM.csv`, `...-search.csv`, `...-all.csv`. No incluyen el nombre de la persona ni importes: bien.
- El respaldo incluye el nombre, ingreso y meta de ahorro en JSON sin cifrar. Es lo que hace falta para restaurar, pero nada lo advierte. Sugerencia [UI]: bajo "Descargar respaldo", una línea: "El archivo no está cifrado: guárdalo en un lugar privado."
- El CSV exporta 7 columnas, todas visibles en pantalla; correcto.

---

## B. Patrones oscuros

### Hallazgos

**B1. Casilla "Descargar primero un respaldo de mis datos actuales" viene marcada en el diálogo de borrar (y en el de restaurar).** Severidad: **media**. Zona: [UI].
- Dónde: `SettingsScreen.jsx:183` (`defaultChecked: true`, borrar) y `:156` (restaurar). Texto: "Descargar primero un respaldo de mis datos actuales" / "First download a backup of my current data".
- Qué pasa: al elegir "Borrar todos los datos", la persona que quiere borrar su información acaba, por defecto, con un archivo nuevo que contiene toda esa información (incluido el nombre) en su carpeta de Descargas. Es una casilla premarcada que favorece a la app (retención del dato) y contradice la intención declarada. Reconozco el motivo protector (evitar pérdidas accidentales: en restaurar es un buen valor por defecto porque se reemplazan datos que sí se quieren conservar).
- Arreglo: en **borrar**, dejar la casilla sin marcar (`defaultChecked: false`) y cambiar el texto a algo que no empuje: ES "Guardar una copia de mis datos antes de borrar (se descarga un archivo en este aparato)". EN "Save a copy of my data before deleting (a file is downloaded to this device)". Mantenerla marcada en restaurar. Si Ian prefiere el valor protector, que al menos el diálogo diga "se descargará un archivo con todos tus datos".

**B2. En "Repetir configuración inicial" hay dos botones "Cancelar" con efectos distintos.** Severidad: **media**. Zona: [UI].
- Dónde: `OnboardingScreen.jsx:291-292` (`confirmLabel: repeatingOnboarding ? t('cancel') : t('obSkipAll')`, `danger: true`) con el botón de cancelar por defecto del diálogo, que también dice "Cancelar" (`DialogProvider.jsx:92`). Mensaje: "Si omites ahora, no se guarda lo que escribiste. Puedes hacer la configuración después en Ajustes."
- Qué pasa: el diálogo muestra "Cancelar" en gris (seguir editando) y "Cancelar" en rojo (descartar todo y salir). Es una pregunta confusa: no se sabe cuál conserva lo escrito. El enlace del pie del paso también dice "Cancelar" en ese modo (`:654`).
- Arreglo: ES `confirmLabel` = "Descartar y salir" y `cancelLabel` = "Seguir editando"; EN "Discard and leave" / "Keep editing". Mensaje del modo repetido: "Si sales ahora, no se guarda lo que escribiste." (hoy dice "omites", que no existe en ese modo). Pasar `cancelLabel` en la llamada a `confirm`. Añadir las claves a `es` y `en` de `translations.js`.

**B3. Aviso de respaldo en Inicio sin forma de descartarlo.** Severidad: **baja**. Zona: [UI].
- Dónde: `HomeScreen.jsx:407-414`, texto: "Hace tiempo que no descargas un respaldo. Si borras los datos del navegador o cambias de teléfono, pierdes todo." / "...you lose everything."
- Qué pasa: aparece en cada visita a Inicio (a los 7 días del primer movimiento si nunca se hizo respaldo; luego cada 14) hasta que se descarga un archivo. No se puede cerrar ni posponer. Es nagging suave: la única salida es la acción que la app quiere, descargar un respaldo. El tono es de pérdida ("pierdes todo"), no de culpa, y el aviso sí es una advertencia real, por eso no es grave.
- Arreglo: añadir un botón "Ahora no" / "Not now" que guarde la fecha de hoy en una preferencia (`remindLater`) y calle el aviso 14 días. Mantener la redacción informativa; opcionalmente cambiar "pierdes todo" por "pierdes tus movimientos". La preferencia nueva debe borrarse en "Borrar todos los datos" (ver A1).

**B4. Asimetría en la bienvenida: omitir todo es un enlace de texto.** Severidad: **baja**. Zona: [UI].
- Dónde: `OnboardingScreen.jsx:645-655`; captura: "Siguiente" es un botón grande turquesa, "Saltar este paso" es un botón secundario, y "Omitir la configuración" es un enlace pequeño bajo la tarjeta. Es visible (no escondido), está en cada paso y el texto es claro, y la bienvenida dice "Todo es opcional".
- Valoración: patrón leve de acción asimétrica. Mitigado porque omitir un paso es un botón completo y saltar todo es una acción poco frecuente.
- Arreglo opcional: darle a "Omitir la configuración" el mismo estilo `btn secondary` en el paso 1 (donde la decisión de entrar o no se toma). No urgente.

**B5. "Omitir la configuración" no avisa si no hay nada escrito, y al omitir se guarda la fecha.** Severidad: nada (bueno). Si no se escribió nada, omite sin diálogo; si se escribió algo, pide confirmación. Es correcto.

**B6. Salida de datos: sin obstrucción.** Hallazgo positivo, relevante: exportar CSV y respaldo y "Borrar todos los datos" están en Ajustes > Datos, a un toque, sin pedir motivo ni contraseña, y "Borrar todos los datos" aparece cuando hay datos. Los dos botones de exportar no se deshabilitan salvo que no haya movimientos. Roach motel: **nada encontrado**. Observación menor: no hay una forma de borrar solo el perfil (nombre, meta) sin "Borrar todos los datos"; el nombre se borra vaciando el campo y guardando, lo cual funciona.

**B7. Diálogos de borrar y restaurar.** Hallazgo positivo: botón de cancelar con el foco inicial (`data-autofocus`), botón destructivo en rojo, Esc = cancelar, el diálogo de borrado lista cuántos registros se pierden y dice "No se puede deshacer". Borrar un movimiento, categoría, gasto fijo o movimiento de ahorros también pide confirmación. Destructive sin confirmación: **nada encontrado**.

**B8. Casillas premarcadas.** Salvo B1, no hay ninguna. El monto "a ahorros" al registrar un ingreso es un campo vacío ("Pasar a ahorros (opcional)"), no una casilla premarcada. Los valores por defecto del formulario Agregar (moneda, método de pago "Efectivo", última categoría) son comodidad local y no favorecen a la app.

**B9. Confirmshaming.** Nada encontrado. Revisados: "Sí, marcarlo" / "No, dejarlo aparte", "Terminar sin meta", "Omitir", "Saltar este paso", "Cancelar", "Borrar todo". Ninguno culpa a la persona. "Terminar sin meta" es neutral. (Ver B2 por la ambigüedad de "Cancelar", que es un problema distinto.)

**B10. Falsa urgencia, forzar continuidad, anuncios disfrazados, preguntas con doble negación.** Nada encontrado. No hay cuentas atrás, ni suscripción, ni anuncios, ni textos del tipo "no quiero no recibir...". "Todavía no has hecho ningún respaldo." es informativo.

**B11. Misdirection.** Nada grave. Dos puntos de lenguaje a vigilar, sin acción requerida: "Sin día fijo" (modo manual de quincena) está explicado en la bienvenida; y el sobrante de la quincena ofrece "¿Pasarlo a ahorros?" con los dos botones del mismo peso (Pasar / Omitir), lo cual es correcto. Asegurarse de que "Omitir" nunca se vuelva más pequeño que "Pasar a ahorros".

**B12. Valores por defecto en la bienvenida.** Nada encontrado: moneda CRC por defecto (razonable, uso en Costa Rica), "El 15 y el 30" por defecto con la instrucción "no cambies nada" si aplica. Todo opcional y reversible.

**B13. Cuenta de Google futura.** Aún no existe. Cuando se construya, evitar: botón "Continuar con Google" prominente frente a "Seguir sin cuenta" como enlace; que el uso sin cuenta (solo local) sea una opción visible de igual peso, porque la decisión del 19/10 fija "sin formulario de login, pero con Google". Dejarlo anotado.

---

## Lo que no pude comprobar

- **Pantallas Agregar, Inicio, Historial, Estadísticas, Categorías, Gastos fijos, Ahorros, Presupuestos en el navegador.** Vi en vivo solo la bienvenida (paso 1) y Ajustes con sus diálogos de ejemplo y de borrado. Después de borrar, la app se quedó en "Abriendo tus datos…" y luego en "Abrir tus datos está tardando demasiado" al recargar (puede deberse a que otros agentes editan el código y recargan Vite, o al bloqueo de una sola pestaña; no lo investigué más). El resto lo audité leyendo el código y `translations.js`.
- Si tras "Borrar todos los datos" quedan restos físicos en el IndexedDB (A6): solo razonado, no medido.
- No descargué archivos para inspeccionar su contenido (el JSON del respaldo se revisó en el código de `backup.js`).
- Android/Capacitor: no existe todavía.
- Los textos nuevos propuestos están sin revisar con la regla de la prueba de claves (las mismas claves en `es` y `en`, sin claves sin usar).

## Orden de arreglos a hacer ahora

1. **B1** [UI]: casilla del respaldo sin marcar al borrar, y texto que diga que se descarga un archivo.
2. **A1** [UI]: en `clearAllData`, quitar `lastBackup`, `lastCurrency`, `lastPaymentMethod`, `lastCategoryId` y `finance-data`; ajustar el diálogo.
3. **B2** [UI]: etiquetas "Descartar y salir" / "Seguir editando" en la repetición de la bienvenida.
4. **A2** [UI]: aviso de que los datos se quedan en el aparato y para qué sirve el nombre; "(opcional)" en el campo de Ajustes. Abrir la ficha de privacidad para el momento de Firebase.
5. **A3** [UI]: ayuda bajo los campos de nota y `autoComplete="off"`.
6. **B3** [UI]: botón "Ahora no" en el aviso de respaldo.
7. **A5** [UI/lógica]: quitar `exportedAt` o dejar solo la fecha.
8. **A6** [BD, Furyan]: `secure_delete` o `VACUUM` tras `clearAll`.
9. **A4** [BD, Furyan]: decidir si se elimina `profile.income_cents` (migración 9). Sin urgencia.
10. **B4** [UI]: igualar el estilo de "Omitir la configuración" (opcional).
