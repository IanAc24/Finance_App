# Ficha 007 · Publicar las reglas endurecidas de Firestore y comprobarlas con la suite real

Fecha: 25/10/2026 · Redactada por la sesión de Claude de Ian · Aprobada por: Ian (25/10/2026) · Rama sugerida: ninguna para publicar; los archivos ya están en `ZOH` (commits de Claude Code, sin `push`)

## Objetivo
Que `finance-tracker/firestore.rules` valide en el servidor cada escritura (tipos, campos permitidos, listas cerradas, largos, montos y fechas), no solo "dueño y nombre de colección", y publicarlas en `iampoorfornow` sin romper la app.

## Decisiones ya tomadas (no se reabren aquí)
- Ian aprobó las reglas endurecidas el 25/10/2026. Esto reemplaza la nota de la ficha 006 ("las endurecidas son otra ficha"): el archivo `firestore.rules` del repo **ya es** la versión endurecida, así que publicar "las del repo" (006) y publicar las endurecidas (007) son ahora lo mismo. Se pueden publicar juntas, una sola vez.
- Furyan es quien publica en el proyecto real (decisión del 18/10).
- Las reglas se escribieron a partir del código (`src/db/cloudData.js` y `src/db/cloudStorage.js`), no del borrador de `docs/qa/revision-seguridad-firebase.md`. Las diferencias están en esa revisión (sección "Estado de las reglas").
- Claude Code no inicia sesión en Firebase, no corre `npm run qa:firebase*`, no abre `.env*.local` y no publica. Todo lo de abajo lo hace una persona.

## Qué cambió en el repo (ya hecho)
- `finance-tracker/firestore.rules`: un validador por colección. Valida el documento **resultante** (`request.resource.data`), así que las actualizaciones parciales de la app (`lastPeriod`, `categoryId`, `achievedAt`) siguen pasando. Leer y borrar: solo el dueño. Lo demás (`users/{uid}` en sí, colecciones ajenas, rutas más profundas, otros documentos de `meta`): denegado.
- `finance-tracker/src/db/cloudData.js`: los constructores de documentos se movieron tal cual desde `cloudStorage.js`, para que la app, las reglas y las pruebas usen las mismas formas.
- `finance-tracker/src/db/firestoreRules.test.js` (en `npm test`, sin red): falla si la app escribe un campo que las reglas no listan, si falta una colección, o si un límite de `src/lib` cambia y las reglas no.
- `finance-tracker/qa-firebase/rules.firebase.test.js`: los 5 `KNOWN GAP` ahora son expectativas normales; hay unos 60 casos "rechazado" y se repiten las operaciones de la app (ver "Prueba antes/después").

## Qué exigen las reglas (resumen)
| Colección | Campos exactos | Notas |
|---|---|---|
| `transactions/{id}` | `amountCents`, `currency`, `type`, `categoryId`, `note`, `date`, `paymentMethod` y `source` (opcional) | `source` solo en ingresos (`salary`, `freelance`, `gift`, `other`) |
| `savings/{id}` | `amountCents`, `currency`, `direction`, `note`, `date` | `direction`: `in` / `out` |
| `recurring/{id}` | `amountCents`, `currency`, `type`, `categoryId`, `note`, `schedule`, `lastPeriod` | `schedule`: `every` / `first` / `second`; `lastPeriod` null o `YYYY-MM-1`, `YYYY-MM-2` o una fecha |
| `categories/{id}` | `name`, `color` | nombre de 1 a 48 (el límite de la app es 24, ver riesgos); 8 colores |
| `budgets/{categoría}_{moneda}` | `categoryId`, `currency`, `amountCents` | el nombre del documento termina en la moneda del documento |
| `goals/{id}` | `name`, `targetCents`, `currency`, `createdAt`, `achievedAt` | nombre 1 a 40; `achievedAt` null hasta cumplirse |
| `meta/profile` | `name`, `incomeCents`, `currency`, `savingsGoalCents`, `onboardedAt` | nombre hasta 30; montos null o centavos válidos |
| `meta/schedule` | `entries` | lista de 1 a 200; se revisan la primera y la última entrada |

Comunes: `amountCents` y similares son enteros de 1 a 100.000.000.000 (el tope de 1.000.000.000 en colones o dólares, en centavos); moneda `CRC` o `USD`; fechas `YYYY-MM-DD` con año 2000 a 2100; `note` hasta 120 en las reglas (60 en la app); ids numéricos positivos; `categoryId` null o entero positivo; ningún campo de más ni de menos.

## Requisitos (los hace Furyan)
- `finance-tracker/.env.local` y `finance-tracker/.env.qa.local` presentes (ignorados por git; no se suben ni se pegan en chats).
- Ficha 006 hecha, o hecha en esta misma sesión (los pasos de abajo la incluyen).
- `npm install` hecho y Microsoft Edge instalado.
- Escrituras: la suite agrega unas 90 por corrida y ahora usa unas 890 de las 1000 (`QA_MAX_WRITES`). No correr `npm run qa:firebase` más de dos veces el mismo día (20.000 al día para todo el proyecto).

## Pasos

### Paso 1 · Corrida "antes"
Con las reglas viejas publicadas, desde `finance-tracker/`:
```
npm run qa:firebase
```
Resultado esperado: fallan las pruebas nuevas de "invalid documents are refused" (las reglas viejas aceptan todo) y quizá las de 006 (rutas fuera de lo permitido) si 006 aún no se publicó. Es normal: sirve para comparar. Anotar el id de corrida y los números del resumen.

### Paso 2 · Publicar
1. https://console.firebase.google.com → proyecto `iampoorfornow` → Firestore Database → Reglas.
2. Reemplazar todo por el contenido de `finance-tracker/firestore.rules` (en PowerShell: `Get-Content -Raw finance-tracker/firestore.rules | Set-Clipboard`).
3. Comprobar antes de publicar: la primera línea es `rules_version = '2';`, la consola no marca errores de sintaxis (si los marca, **no publicar**; avisar a Ian con el texto del error), y entre las rutas están `transactions`, `categories`, `budgets`, `recurring`, `savings`, `goals`, `meta/profile` y `meta/schedule`.
4. Publicar y esperar un minuto.

### Paso 3 · Corrida "después"
1. `npm run qa:firebase` otra vez.
2. Esperado: **0 fallos**, 0 `KNOWN GAP` (`knownGaps` vacío en `finance-tracker/e2e/results/firebase-report.json`), `leftoverDocuments` vacío, escrituras bajo el tope.
3. Si falla alguna prueba de "the operations of the app pass the rules" o de "the largest amount…", **la regla es más estricta que la app**: no es un fallo de la prueba. Ir al paso de reversa y avisar con el nombre de la prueba.
4. Si falla "60 emoji…": `size()` cuenta distinto a lo supuesto; avisar (no es grave: ya hay margen de 2x).

### Paso 4 · Uso diario en la app (cuenta normal, no la de pruebas)
Entrar, y con cada operación recargar la página para ver que quedó guardada:
- Agregar, editar y borrar un gasto.
- Ingreso con parte a ahorros (dos documentos en un lote).
- Ahorro: depositar y retirar.
- Meta de ahorro: crear, alcanzarla con un depósito (se marca como lograda), borrarla.
- Presupuesto: poner y quitar.
- Gasto fijo: agregar y confirmar el del periodo; omitir otro; editar uno.
- Categoría: crear, renombrar, borrar una con movimientos (se mueven a otra).
- Respaldo: descargar y restaurar.
- Cuenta nueva: la bienvenida completa (nombre, ingreso, gastos fijos, horario de quincena) y también "omitir".
- Ajustes: cambiar el nombre y el horario de quincena.
Cualquier "no se pudo guardar" o "permission-denied" en la consola del navegador = reversa.

### Paso 5 · Reversa
En la consola: Firestore Database → Reglas → Historial (o "Rules history"), elegir la versión anterior y publicarla. Avisar a Ian con: la operación que falló, el código del error y, si se puede, la ruta y el documento (sin datos personales).

### Paso 6 · Dejar constancia
- `docs/decisiones.md`: fila nueva en **Vigentes**: "25/10 · Reglas de Firestore endurecidas (validan campos, tipos, montos, fechas y largos) publicadas en `iampoorfornow`. Comprobado con `npm run qa:firebase`" — Quién: Furyan.
- `docs/qa/guia-qa.md`, sección 5: la corrida "después" (id, pasaron, fallaron).
- `docs/qa/revision-seguridad-firebase.md`: cambiar "pendiente de publicar" por "publicadas" con la fecha.
- `docs/datos-por-cuenta.md`, sección "Reglas de seguridad".
- Ficha 006: marcarla hecha con la misma corrida.

## Riesgos
- **Documentos viejos con formas que las reglas rechazan.** Las reglas no revisan lo que ya está guardado ni lo que se lee, solo lo que se escribe. El problema aparece cuando la app **reescribe** un documento viejo:
  - La app reescribe documentos completos al editar un movimiento, un ahorro, una categoría, una meta o un presupuesto (`set`), y al restaurar un respaldo o subir los datos del aparato (todos los documentos). Un campo viejo de más, una nota de más de 120 caracteres o una fecha fuera de 2000 a 2100 harían que esa escritura se rechace.
  - Actualizaciones parciales (`lastPeriod`, `categoryId` al borrar una categoría, `achievedAt`) se evalúan sobre el documento completo: si el documento viejo ya no cumple (por ejemplo, un gasto fijo sin `lastPeriod`), esa actualización también se rechaza.
  - Qué se sabe: todas las versiones de `cloudStorage.js` escribieron siempre todos los campos (`paymentMethod` y `lastPeriod` desde el primer commit; `source` y `goals` se agregaron después y son opcionales o nuevos). Los textos largos no podían entrar por la app (límites de 60, 24, 30 y 40). Los montos son enteros en centavos, así que colones con decimales no son un problema. Por eso no se espera ningún rechazo, pero **no se ha podido comprobar con datos reales** de cuentas existentes.
  - Qué hacer si pasa: una sola cuenta afectada → restaurar su respaldo (los respaldos pasan por `inspectBackup` y se reescriben completos y limpios) o corregir el documento en la consola. Varias → reversa y avisar.
- **`size()` y los emoji.** No se sabe si `size()` cuenta caracteres o unidades UTF-16. Por eso las notas y los nombres de categoría tienen el doble del límite de la app (120 y 48): ningún emoji que la app acepta se rechaza. El costo: un cliente que no sea la app puede guardar una nota de hasta 120. Los nombres de meta (40) y de perfil (30) la app los corta en unidades UTF-16, así que son exactos.
- **Lo que las reglas no pueden hacer:** limitar cuántos documentos hay; revisar fechas imposibles como `2026-02-31` (solo formato y año); comprobar que el nombre de un presupuesto lleve el mismo número de categoría que su campo `categoryId` (solo la moneda); revisar todas las entradas del horario de quincena (se revisan la primera y la última; el límite de 1 MiB por documento acota el resto). Siguen siendo necesarios App Check y las restricciones de la clave (ver la revisión).
- **Las reglas no se pudieron ejecutar** donde se escribieron (sin emulador ni Java, y sin tocar el Firebase real). El archivo solo se verificó con la prueba sin red `firestoreRules.test.js` (que compara texto, no ejecuta). Si la consola marca un error de sintaxis al pegarlas, no se publican.
- **Usar cuentas de prueba para la suite:** escribe y restaura `meta/profile` y `meta/schedule` de la cuenta 1 (los lee antes y los deja como estaban; si algo falla a medias, la limpieza borra el que tenga la etiqueta de la corrida).

## Fuera de alcance
- App Check, verificación de correo, restricciones de la clave, alertas de presupuesto (ver la revisión de seguridad).
- Cambiar la app o sus pantallas (zona visual de Ian).
- Instalar Java o el emulador de Firestore.

## Archivos que se espera tocar (los hace Furyan)
- `docs/decisiones.md`, `docs/qa/guia-qa.md`, `docs/qa/revision-seguridad-firebase.md`, `docs/datos-por-cuenta.md`, fichas 006 y 007: constancia.
- Ningún archivo de `src/`.

## Criterios de aceptación
- [ ] Reglas publicadas; el historial de la consola muestra la versión nueva y empieza por `rules_version = '2';`.
- [ ] Corrida "después": 0 fallos, `knownGaps` vacío, `leftoverDocuments` vacío, escrituras bajo el tope.
- [ ] Todo el uso diario del Paso 4 funciona con una cuenta normal, también después de recargar.
- [ ] `npm test`, `npm run lint` y `npm run build` pasan.
- [ ] Ningún archivo `.env*.local` en git.

## Pruebas que incluye
- Sin red (`npm test`): `src/db/firestoreRules.test.js`.
- Contra el Firebase real (`npm run qa:firebase:rules`, dentro de `qa:firebase`): `qa-firebase/rules.firebase.test.js`, con documentos aceptados construidos por las funciones de la app, ~60 casos rechazados (por colección: monto 0, negativo, decimal, sobre el tope y texto; moneda; tipo; enumeraciones; fecha; notas y nombres largos; campos de más y de menos; nombres de documento; presupuestos; `meta`), actualizaciones parciales aceptadas y rechazadas, y las operaciones de la app en lote.

## Informe de entrega (lo llena quien publique)
- Corrida "antes" (id, pasaron, fallaron):
- Corrida "después" (id, pasaron, fallaron, huecos conocidos, escrituras):
- Uso diario del Paso 4 (qué se probó, qué falló):
- Lo que no pudo verificar:
- Decisiones que necesitan a una persona:
