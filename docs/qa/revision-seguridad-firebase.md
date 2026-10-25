# Revisión de seguridad e integridad: Firebase (parte estática)

Revisión de solo lectura. No se ejecutó nada contra Firebase. Rutas relativas a `finance-tracker/` salvo que se indique. Todo lo marcado "sin confirmar" necesita el emulador o una prueba manual.

> **Estado al 25/10/2026:** las reglas endurecidas ya están en `finance-tracker/firestore.rules` (reescritas a partir del código, no copiadas del borrador de abajo), con pruebas sin red (`src/db/firestoreRules.test.js`) y contra el Firebase real (`qa-firebase/rules.firebase.test.js`). **Pendiente de publicar** en `iampoorfornow`: ficha 007. El borrador de abajo se conserva como historia; la sección "Diferencias entre el borrador y el código" dice qué cambió.

## Resumen

- **Aislamiento entre cuentas (pregunta 1): correcto.** Ninguna ruta permite que A lea o escriba `users/B`. No hay hallazgos críticos.
- **El hueco real es la validación:** las reglas no revisan tipos, montos, tamaños, monedas ni cantidad de documentos. Combinado con el registro abierto y sin App Check, un cliente malicioso puede agotar la cuota diaria compartida del plan Spark (20.000 escrituras para todo el proyecto) y puede dejar su propia cuenta inutilizable.
- Hay dos riesgos de sesión y de caché (otra pestaña con otra cuenta; datos de la cuenta anterior en IndexedDB) y un par de caminos de escritura (aviso de "guardado" sin confirmar, lotes no atómicos, posibles duplicados).

---

## Hallazgos por severidad

### Críticos
Ninguno confirmado.

### ALTA

#### A1. Las reglas no validan nada: cualquier cuenta puede llenar o romper su espacio, y gastar la cuota de todos
- Evidencia: `firestore.rules:12-15`
  ```
  match /users/{uid}/{list}/{item} {
    allow read, write: if isOwner(uid)
      && list in ['transactions', 'categories', 'budgets', 'recurring', 'savings', 'meta'];
  ```
  Es lo único que se comprueba: dueño y nombre de colección.
- Qué puede escribir un cliente con sesión (en su propio `users/{su uid}/…`), usando el SDK desde la consola del navegador o la API REST con su token:
  - Textos enormes en `note`, `name`, etc. (hasta 1 MiB por documento).
  - `amountCents` negativo, 0, decimal, `NaN`/`Infinity`, string, o por encima de `MAX_CENTS` (1e11).
  - Moneda distinta de `CRC`/`USD`, `type` o `direction` inventados, `date` que no es fecha, `paymentMethod` cualquiera.
  - Campos extra sin límite.
  - **Cualquier id de documento** (no solo numérico) y **cualquier id en `meta`** (no solo `profile` y `schedule`).
  - Un número ilimitado de documentos (solo lo frena la cuota).
- Impacto:
  1. **Costo / DoS de cuota compartida (el más grave):** la nota de `docs/datos-por-cuenta.md` dice que el plan Spark da 20.000 escrituras y 50.000 lecturas diarias para TODO el proyecto. Un script con una cuenta (o varias, el registro es abierto, ver A3) agota esas escrituras en minutos y nadie más puede guardar hasta el día siguiente. Las reglas no pueden limitar el número de documentos, solo su forma; el freno real es App Check, restringir la clave de API y alertas de presupuesto (ver "Mitigaciones fuera de las reglas").
  2. **Dejar su propia cuenta inutilizable al cargar:** `loadAll()` lee todo y convierte sin validar. Por ejemplo, un presupuesto sin `currency` hace que `src/db/cloudStorage.js:329` (`a.currency.localeCompare(b.currency)`) lance `TypeError`, `loadAll` falla y `TransactionsProvider.jsx:156-161` muestra la pantalla de error con "Reintentar" que nunca se arregla. Una fecha o moneda ajena en una transacción pasa tal cual (`toTransaction`, `cloudStorage.js:248-262`; solo se valida `amountCents`). Es autodaño (solo esa cuenta), pero también puede ocurrir por un bug del propio cliente: sin reglas no hay red de seguridad.
  3. Solo autodaño en lo demás: texto, números raros, etc., no cruzan a otras cuentas.
- Estado: **reglas endurecidas en `firestore.rules`, pendiente de publicar (ficha 007)**; la lectura defensiva sigue pendiente.
- Arreglo: reglas endurecidas completas más abajo (sección "firestore.rules propuesto", ahora en el archivo), más lectura defensiva:
  ```js
  // cloudStorage.js: en toTransaction / toSavingsMove / toRecurring / toBudget
  const CURRENCIES = ['CRC', 'USD']
  const okDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
  // transacción: if (!CURRENCIES.includes(data.currency) || !['income','expense'].includes(data.type) || !okDate(data.date)) return null
  // presupuesto: if (!CURRENCIES.includes(data.currency) || !Number.isInteger(data.categoryId)) return null
  // categoría: if (typeof data.name !== 'string' || !data.name || !Number.isFinite(Number(snapshot.id))) return null
  ```
  y que `toCategory` pase por `rows()` que ya filtra `null` (hoy devuelve siempre un objeto).

#### A2. Cuota diaria: restaurar o subir datos grandes puede agotar el proyecto entero
- Evidencia: `src/lib/backup.js:57` `MAX_RECORDS = 200_000` por lista; `cloudStorage.js:107` lotes de 450; `restoreAll` (394-414) borra todo lo actual y escribe todo lo del respaldo; `uploadLocalData` (418-423) igual.
- Impacto: un respaldo legítimo de miles de movimientos, o uno hostil (hasta 5×200.000 registros, 20 MB), son decenas de miles de escrituras: una sola restauración puede superar las 20.000 diarias del Spark y dejar a todos sin guardar; además, al agotarse a mitad, el restore queda **a medias** (ver M4).
- Arreglo: bajar `MAX_RECORDS` para el destino nube (por ejemplo 5.000 en total por restauración) y avisar el número de escrituras antes de confirmar; en el borrado previo usar solo lo que difiere (ya se omite lo que se conserva con `keep`, bien). Pasar a Blaze con tope de presupuesto antes de abrir a más gente.

#### A3. Registro abierto, sin verificación de correo y sin App Check
- Evidencia: `src/lib/firebase.js:43-47` (`isSignUpAllowed`: abierto salvo `VITE_ALLOW_SIGNUP=0`); `docs/despliegue-netlify.md:6`; no hay `sendEmailVerification` en ningún archivo ni se revisa `user.emailVerified` (`AuthGate.jsx:62-72` solo mira `status`); no hay App Check (`firebase.js` no lo importa).
- Impacto: cualquiera crea cuentas ilimitadas con correos ajenos o inventados, y cada una es un cupo para A1/A2. Quien se registra con el correo de otra persona la "ocupa" (esa persona vería "email en uso" al intentar registrarse, aunque podría recuperar la cuenta con "olvidé mi contraseña", lo que le daría el control).
- Arreglo (no es código de la app): activar Firebase App Check (reCAPTCHA Enterprise/v3) y exigirlo en Firestore y Authentication; restringir la clave de API por referer (dominio de Netlify) y por API (Identity Toolkit, Firestore); alertas de presupuesto/cuota. Si se mantiene el registro abierto, exigir verificación de correo: `sendEmailVerification(user)` tras registrar y en las reglas añadir `&& request.auth.token.email_verified == true` (y una pantalla "verifica tu correo"). Mientras tanto, `VITE_ALLOW_SIGNUP=0` y crear las cuentas a mano en la consola.

### MEDIA

#### M1. Cambio de cuenta desde otra pestaña: el proveedor no se vuelve a montar (sin confirmar en la práctica)
- Evidencia: `App.jsx:125-131` monta `AuthGate > TransactionsProvider` en la ruta `*`; `TransactionsProvider.jsx:167-169` ejecuta la carga una sola vez (`[]`, comentario "AuthGate mounts a new provider for each one"). `AuthGate` solo cambia al ir a `/login` (status `unauthenticated`). `AuthProvider.jsx:30-36` hace `setSession` en cada cambio de `onAuthStateChanged`. Firebase Auth sincroniza la sesión entre pestañas del mismo navegador (persistencia IndexedDB por defecto).
- Escenario: pestaña 1 con cuenta A abierta; en pestaña 2 se cierra sesión y se entra con B. En la pestaña 1 el listener recibe `user` = B directamente, `status` pasa de `authenticated` a `authenticated` (sin pasar por `unauthenticated`), el proveedor no se remonta: sigue en pantalla el estado de A, y `cloudStorage.uid` (módulo, `cloudStorage.js:42`) sigue siendo A.
- Impacto: las lecturas en memoria muestran datos de A bajo la sesión B (misma persona/navegador, no es fuga entre usuarios remotos). Las escrituras van a `users/A/…` con token de B y **las reglas las rechazan** (`permission-denied`): se confirma que las reglas cubren el uid manipulado. Pero el usuario ve "guardado" (1 s) y luego el aviso de error.
- Arreglo: montar el proveedor con clave por uid: `<TransactionsProvider key={user.uid}>` (en `App.jsx`, dentro de `AuthGate`, leyendo `useAuth().user.uid`), o un efecto en `TransactionsProvider` que dependa de `uid`. Probar con el emulador/dos pestañas.

#### M2. Datos de la cuenta anterior quedan en el navegador (caché persistente) y el texto de "cerrar sesión" es inexacto
- Evidencia: `firebase.js:78-87` `persistentLocalCache` (IndexedDB) sin `terminate()`/`clearIndexedDbPersistence()` en `signOut` (`firebase.js:113-115`); `AccountBar.jsx` solo llama `signOut()`; `translations.js:377` y `:823` ("Tus datos se quedan guardados en este aparato").
- Análisis de caché con cambio de usuario (basado en el comportamiento conocido del SDK, sin confirmar con el emulador): la caché de documentos remotos es compartida por todos los usuarios del origen, pero las consultas se resuelven por ruta. `getDocsFromCache(users/B/transactions)` solo devuelve documentos bajo `users/B/...`, así que B **no ve** los datos de A por la app. Las colas de escrituras pendientes son por usuario.
- Impacto: en un aparato compartido, los datos financieros de A siguen en IndexedDB legibles con las herramientas del navegador después de cerrar sesión (y las escrituras pendientes de A se enviarían cuando A vuelva a entrar). Además el texto promete lo contrario de "cerrar sesión limpia".
- Arreglo: al cerrar sesión, `await terminate(getCloudDb())` seguido de `clearIndexedDbPersistence(db)` (hay que terminar antes de limpiar) y poner `firestore = null` para volver a inicializar al siguiente login; avisar si hay escrituras pendientes (`waitForPendingWrites` con límite) para no perderlas. Cambiar el texto (`signOutHint`) a la verdad.

#### M3. "Guardado" se muestra antes de que el servidor confirme (por diseño, 1 s) y el aviso de rechazo se puede perder
- Evidencia: `cloudStorage.js:61-102` `commitBatch`: a los `WRITE_WAIT_MS = 1000` hace `resolve()` aunque Google no haya respondido; solo si el rechazo llega antes de 1 s se lanza el error. `AddExpenseScreen.jsx:266-276` muestra `toast.show(... toastExpenseSaved)` justo después de `await addTransaction`.
- Verificado: el comportamiento descrito en la documentación coincide con el código. Si Google rechaza después (sin internet y luego rechazo, o `permission-denied`), `onCloudWriteError` llama a los oyentes, y `TransactionsProvider.jsx:173-186` recarga con `loadAll()` y muestra `saveError`.
- Problemas:
  1. El oyente solo existe mientras el proveedor esté montado (`errorListeners` es un `Set` de módulo; el efecto se limpia al desmontar). Si el usuario cierra sesión o navega a `/login` antes del rechazo, el error se pierde en silencio y el dato nunca se guardó (se pierde el movimiento sin aviso).
  2. Varios rechazos seguidos abren varios `alert` y varias recargas.
  3. Con lotes múltiples (`Promise.all(batches.map(commitBatch))`, línea 125) un rechazo temprano de un lote rechaza el conjunto mientras los demás siguen su curso: estado parcial (ver M4).
- Arreglo: en `signOut`, antes de cerrar, `await waitForPendingWrites(db)` con un tope de tiempo y, si hay error, avisar; dejar un oyente global (no atado al proveedor) que al menos encole el aviso para la próxima pantalla; agrupar los avisos (un `alert` a la vez).

#### M4. Trabajos grandes no son atómicos (restaurar, subir datos del aparato, borrar todo)
- Evidencia: `cloudStorage.js:104-127` (lotes de 450), `394-414` (`restoreAll`: `deleteEverything` + `writeState` repartidos entre lotes), `493-501` (`clearAll`).
- Impacto: si falla un lote a la mitad (cuota agotada, regla que rechaza un documento inválido, red), queda mezclado: parte de lo viejo borrado y parte de lo nuevo escrito. Un solo documento que las reglas endurecidas rechacen en un respaldo viejo hará fallar su lote (y los siguientes sí se aplican). No hay forma de "deshacer".
- Arreglo: escribir primero (set) y borrar al final, de modo que un fallo deje de más, no de menos; antes de restaurar ofrecer descargar un respaldo del estado actual; en el emulador probar un respaldo con un registro inválido. Los respaldos ya se limpian con `inspectBackup`, así que los documentos suelen pasar las reglas propuestas (ver pruebas E12-E13).

#### M5. Posibles duplicados con ids nuevos al reintentar
- Evidencia: cada operación llama `newId()` dentro de la función de guardado (`cloudStorage.js:426, 434-438, 547, 556, 571-572`), de modo que repetir la operación crea otro documento (los ids no se reutilizan entre intentos). El candado `onceAtATime` (`lib/onceAtATime.js`) evita el doble toque mientras la promesa está pendiente, pero no un reintento tras un error.
- Caminos concretos:
  1. `AddExpenseScreen.jsx:259-267`: `confirmRecurring(match, tx)` y luego `addSavingsMove(move)` son dos lotes distintos. Si el segundo falla (rechazo dentro de 1 s), se muestra el error de guardado, y al reintentar el movimiento ya confirmado puede guardarse otra vez como transacción nueva (id distinto). Sin confirmar: depende de si `findMatchingDue` vuelve a emparejar tras `lastPeriod` actualizado en el estado (el estado ya se actualizó); en el peor caso entra por `addIncomeWithSavings` y duplica el ingreso.
  2. Dos aparatos sin internet confirmando el mismo gasto fijo: cada uno crea su transacción con id propio y las dos sobreviven (el `update` de `lastPeriod` no tiene condición previa). Es el límite conocido de "gana el último cambio".
  3. `loadSampleData` crea documentos nuevos cada vez que se pulsa (por diseño).
- Arreglo: generar el id una vez por intento de formulario (guardarlo en un `useRef` al abrir el formulario y pasarlo a `addTransaction`) para que el reintento sobrescriba el mismo documento; para `confirmRecurring` + ahorro, un solo lote (`insertIncomeWithSavings` ya lo hace para ingreso+ahorro; extender `confirmRecurring` para aceptar `move`).

#### M6. Sin cabeceras de seguridad ni configuración de Netlify
- Evidencia: no existe `netlify.toml` ni `_headers`; solo `public/_redirects` con `/* /index.html 200`.
- Impacto: sin CSP, sin `X-Frame-Options`/`frame-ancestors` (clickjacking de la pantalla de login), sin `Referrer-Policy` ni `X-Content-Type-Options`. La app no tiene `dangerouslySetInnerHTML` revisado aquí (sin confirmar fuera del alcance), pero una CSP limitaría el daño de cualquier XSS futuro.
- Arreglo: `public/_headers`:
  ```
  /*
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    X-Frame-Options: DENY
    Permissions-Policy: camera=(), microphone=(), geolocation=()
    Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src https://*.firebaseapp.com https://accounts.google.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; frame-ancestors 'none'
  ```
  (Ajustar con el emulador/consola: sql.js y Firebase Auth necesitan `wasm-unsafe-eval` y los dominios de Google; probar en un sitio de prueba antes de publicar. Sin confirmar la lista exacta.)

### BAJA

#### B1. Contraseñas: la regla de 8 caracteres solo está en el cliente
- `authForm.js:152` `MIN_PASSWORD_LENGTH = 8`, aplicada en `validateSignUp` (173-181). Quien llame directamente a la API de Identity Toolkit con la clave pública puede crear la cuenta con la política del servidor (6 por defecto). Sin complejidad ni comprobación de contraseñas filtradas. Arreglo: activar la política de contraseñas en la consola de Firebase Authentication (mínimo 8, y opcional mayúscula/número).

#### B2. Enumeración de correos
- Inicio de sesión: **bien**. `authErrors.js:91-97` unifica `invalid-credential`, `wrong-password`, `user-not-found`, `user-disabled` en `authWrongCredentials`.
- Recuperar contraseña: **bien**. `authForm.js:240-247` `requestReset` siempre responde `RESET_SENT` salvo red/`too-many-requests` (las diferencias de esos dos casos no revelan la cuenta).
- Registro: `authErrors.js:99` `auth/email-already-in-use` -> `authEmailInUse`: revela que el correo ya existe (inherente a un registro abierto). Activar "Email enumeration protection" en la consola (sin confirmar si está activa) lo reduce en la API pero no en `createUser`.

#### B3. Sesión y rutas protegidas: correcto
- `AuthGate.jsx:62-72`: sin sesión redirige a `/login` y no monta `TransactionsProvider` (así que no se lee nada). `PublicOnly` redirige con `safeRedirect` (`authForm.js:254-261`) que rechaza `//`, `\` y rutas de auth (sin redirección abierta). Persistencia por defecto de Firebase (sin `setPersistence`): la sesión sobrevive recargas y cierres. `/recuperar` es pública (correcto).

#### B4. Otros menores
- Datos "de antes de las cuentas": `lib/deviceData.js:28-32` ofrece los datos locales SQLite a la primera cuenta sin datos del aparato; en un aparato compartido otra persona con una cuenta nueva puede quedarse con ellos (documentado como decisión; solo `deviceDataOwner` en localStorage lo impide después).
- Preferencias (`lastCategoryId`, `lastCurrency`, fechas de respaldo) no van por cuenta (`prefs.js`); fuga mínima entre cuentas del mismo aparato.
- No hay forma de borrar la cuenta ni exportar desde el servidor desde la app (`deleteUser` no se usa); relevante para Ley 8968 antes de abrir a más personas. `clearAll` deja `meta/profile` y `meta/schedule` (no los borra), coherente con la app.
- `console.warn('auth', code)` y `'cloud read'` solo registran códigos, no correos: bien (`useAuthForm.js:314`).

---

## Respuestas a las preguntas

### 1. Autorización
- `request.auth.uid` es la única clave (`firestore.rules:8-10`).
- `match /users/{uid}/{list}/{item}` casa exactamente 4 segmentos tras `documents`. Por tanto:
  - `users/{uid}` (documento) no tiene regla específica -> cae en el `match /{document=**}` con `if false`.
  - Subcolecciones más profundas (`users/uid/transactions/x/sub/y`) no casan -> denegadas.
  - Consultas de grupo de colección (`collectionGroup('transactions')`) no tienen regla `/{path=**}/transactions/{id}` -> denegadas.
  - Listas fuera de la lista blanca (`users/uid/otra/x`) -> denegadas.
  - `meta`: cualquier id de documento está permitido (no solo `profile`/`schedule`): propio, pero amplía la superficie (se corrige en las reglas propuestas).
- El uid del cliente (`cloudStorage.js:42-47` `setCloudUser`, `userPath` 49-52) es una variable de módulo; si se manipula a otro uid (consola, o el caso M1), las rutas apuntan a `users/B/...` y las reglas lo rechazan porque `request.auth.uid` sale del token firmado, no del cliente. Conclusión: aunque el cliente esté comprometido, las reglas frenan el acceso cruzado. A y B comparten el mismo almacén de caché, pero las consultas se resuelven por ruta (ver M2).
- Conclusión: no hay camino de A hacia `users/B` en las reglas actuales (sin confirmar con el emulador: ver pruebas E1-E8).

### 2. Validación
Ver A1 y las reglas propuestas. Campos reales que escribe `cloudStorage.js`:
- `transactions/{id}`: `amountCents`, `currency`, `type`, `categoryId` (entero o null), `note`, `date`, `paymentMethod` (`transactionData`, 177-187).
- `categories/{id}`: `name`, `color` (351, 459).
- `budgets/{categoryId_currency}`: `categoryId`, `currency`, `amountCents` (354-358, 508).
- `recurring/{id}`: `amountCents`, `currency`, `type`, `categoryId`, `note`, `schedule`, `lastPeriod` (`recurringData` + `lastPeriod`, 198-207, 361-364).
- `savings/{id}`: `amountCents`, `currency`, `direction`, `note`, `date` (209-217).
- `meta/profile`: `name`, `incomeCents`, `currency`, `savingsGoalCents`, `onboardedAt` (219-227).
- `meta/schedule`: `entries` (lista de `{from, mode, day1, day2}`; 369-371).
- Actualizaciones parciales (`update`, líneas 487-488, 527, 541, 550): en las reglas, `request.resource.data` es el documento resultante tras la mezcla, así que validar el documento completo funciona para `update` también.

### 3. Manejo de sesión
- Cerrar sesión: `AccountBar` -> `signOut()` -> `onAuthStateChanged(null)` -> `status 'unauthenticated'` -> `AuthGate` redirige y **desmonta** `TransactionsProvider` (se pierde el estado React, se limpia solo por desmontaje; no hay limpieza explícita). `cloudStorage.uid` **no** se pone a `null` al cerrar sesión (`setDataUser(uid)` solo se llama al montar, `TransactionsProvider.jsx:118`); mientras no hay proveedor nadie lee, y el próximo montaje llama `setDataUser(nuevoUid)` antes de `loadAll()` (línea 118-127). Orden correcto en el flujo normal.
- Cambio sin pasar por `/login` (otra pestaña): ver M1.
- Caché: ver M2.

### 4. Escrituras
Ver M3 y M5. Resumen: el aviso de "guardado" aparece antes de la confirmación del servidor si pasa más de 1 s; el rechazo tardío lo cubre un aviso y recarga, salvo que el proveedor ya no esté montado. Ids: `newId()` (`lib/ids.js:12-18`) es monótono en el aparato; no se repiten dentro de un aparato; el riesgo de duplicado está en reintentos que regeneran el id (M5).

### 5. Flujos de autenticación
Ver B1-B3 y A3. Verificación de correo: no se exige. Persistencia: por defecto de Firebase.

### 6. Secretos
- La configuración web de Firebase (`apiKey`, `authDomain`, `projectId`, `appId`) es pública por diseño: se incrusta en el bundle (`firebase.js:21-37`); su seguridad depende de las reglas, App Check y las restricciones de la clave, no de ocultarla. `docs/despliegue-netlify.md:8` lo dice.
- `.env.local` está excluido por `*.local` en `finance-tracker/.gitignore:13` (comprobado con `git check-ignore`); en el repo solo está `.env.example` con valores vacíos. Una búsqueda de `AIza` en `finance-tracker/` (sin `node_modules`) y en `dist/` no encontró claves. No se vio ninguna credencial de servicio ni token en el repo (búsqueda superficial; sin confirmar el historial de git completo: ejecutar `git log -S AIza --all`).
- `index.html` sin scripts de terceros ni claves.

### 7. Qué solo se prueba con el emulador
Ver lista abajo. El repo no tiene `firebase.json` ni `.firebaserc` (se comprobó), hace falta crearlos y tener Java + `firebase-tools` (lo dice `docs/datos-por-cuenta.md`).

---

## Mitigaciones fuera de las reglas (consola de Firebase / Google Cloud)
1. App Check (reCAPTCHA) exigido en Firestore y Auth.
2. Restringir la clave de API por dominio (referer) y por servicios.
3. Alertas de presupuesto y de cuota; plan Blaze con tope antes de abrir a más personas.
4. Política de contraseñas y "Email enumeration protection" en Authentication.
5. Dominios autorizados limitados al sitio real.

---

## firestore.rules propuesto

> **Borrador. La versión vigente es `finance-tracker/firestore.rules` (25/10/2026, pendiente de publicar, ficha 007).**

### Diferencias entre el borrador y el código (encontradas al escribir las reglas)
- Faltaba la colección `goals` (metas de ahorro: `name`, `targetCents`, `currency`, `createdAt`, `achievedAt`); el borrador la rechazaba.
- `transactions` puede llevar `source` (solo ingresos: `salary`, `freelance`, `gift`, `other`); el borrador lo habría rechazado como campo extra.
- `categoryId` de movimientos y gastos fijos: la app guarda `null` o un entero positivo (los respaldos ponen `null` a lo desconocido; `0` nunca se guarda). El borrador aceptaba también `0`.
- Presupuestos: `categoryId` positivo (el borrador aceptaba 0); y la condición `id == string(categoryId) + '_' + currency` se cambió por "el nombre termina en la moneda del documento" porque `string()` no se pudo probar sin emulador.
- `note` y nombre de categoría: el borrador usaba 60 y 24 con `size()`; la app cuenta caracteres y `size()` puede contar unidades UTF-16, así que las reglas aceptan el doble (120 y 48). Meta de ahorro (40) y nombre de perfil (30) son exactos porque la app los corta en unidades UTF-16.
- Fechas: el borrador solo revisaba la forma `^[0-9]{4}-…`; ahora mes 01-12, día 01-31 y año 2000-2100 (como `isValidDate`). `lastPeriod` igual, con `YYYY-MM-1`/`YYYY-MM-2` o la fecha de inicio.
- `meta/schedule`: el borrador solo contaba entradas; ahora revisa la primera y la última (`from`, `mode`, `day1`, `day2`).
- Montos: `validCents` pide entero de 1 a 100.000.000.000; los perfiles aceptan `null` en ingreso y meta de ahorro.
- Las pruebas reales usaban `qaTag` en presupuestos y `meta/qa-<id>`: ya no caben en las reglas; ahora usan el prefijo del id y `meta/profile`/`meta/schedule` con restauración.

Pensado para coincidir con lo que escribe `cloudStorage.js` hoy. `MAX_CENTS = 100000000000` (1e9 × 100). Validan el documento resultante (sirve para `set` y para `update` parcial). `categoryId` puede ser 0 (marcador de "sin categoría") o un entero positivo, o null.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ---- Dueño ----
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    // ---- Validaciones pequeñas ----
    function isCents(v) {
      return v is int && v >= 1 && v <= 100000000000;   // MAX_CENTS
    }
    function isCentsOrNull(v) {
      return v == null || isCents(v);
    }
    function isCurrency(v) {
      return v in ['CRC', 'USD'];
    }
    function isNote(v) {
      return v is string && v.size() <= 60;               // MAX_NOTE_LENGTH
    }
    function isDay(v) {
      return v is string && v.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
    }
    function isCategoryId(v) {
      return v == null || (v is int && v >= 0 && v <= 8000000000000000);   // MAX_ID
    }
    function isNumericId(id) {
      return id.matches('^[0-9]{1,16}$');
    }

    // ---- Datos de cada colección ----
    function validTransaction(d) {
      return d.keys().hasOnly(['amountCents', 'currency', 'type', 'categoryId', 'note', 'date', 'paymentMethod'])
        && d.keys().hasAll(['amountCents', 'currency', 'type', 'categoryId', 'note', 'date', 'paymentMethod'])
        && isCents(d.amountCents)
        && isCurrency(d.currency)
        && d.type in ['income', 'expense']
        && isCategoryId(d.categoryId)
        && isNote(d.note)
        && isDay(d.date)
        && d.paymentMethod in ['cash', 'card', 'sinpe'];
    }

    function validCategory(d) {
      return d.keys().hasOnly(['name', 'color'])
        && d.keys().hasAll(['name', 'color'])
        && d.name is string && d.name.size() >= 1 && d.name.size() <= 24   // MAX_CATEGORY_NAME_LENGTH
        && d.color in ['orange', 'blue', 'violet', 'lime', 'fuchsia', 'slate', 'sand', 'cyan'];
    }

    function validBudget(d) {
      return d.keys().hasOnly(['categoryId', 'currency', 'amountCents'])
        && d.keys().hasAll(['categoryId', 'currency', 'amountCents'])
        && d.categoryId is int && d.categoryId >= 0
        && isCurrency(d.currency)
        && isCents(d.amountCents);
    }

    function validRecurring(d) {
      return d.keys().hasOnly(['amountCents', 'currency', 'type', 'categoryId', 'note', 'schedule', 'lastPeriod'])
        && d.keys().hasAll(['amountCents', 'currency', 'type', 'categoryId', 'note', 'schedule', 'lastPeriod'])
        && isCents(d.amountCents)
        && isCurrency(d.currency)
        && d.type in ['income', 'expense']
        && isCategoryId(d.categoryId)
        && isNote(d.note)
        && d.schedule in ['every', 'first', 'second']
        && (d.lastPeriod == null
            || (d.lastPeriod is string && d.lastPeriod.matches('^[0-9]{4}-[0-9]{2}-([12]|[0-9]{2})$')));
    }

    function validSavings(d) {
      return d.keys().hasOnly(['amountCents', 'currency', 'direction', 'note', 'date'])
        && d.keys().hasAll(['amountCents', 'currency', 'direction', 'note', 'date'])
        && isCents(d.amountCents)
        && isCurrency(d.currency)
        && d.direction in ['in', 'out']
        && isNote(d.note)
        && isDay(d.date);
    }

    function validProfile(d) {
      return d.keys().hasOnly(['name', 'incomeCents', 'currency', 'savingsGoalCents', 'onboardedAt'])
        && d.keys().hasAll(['name', 'incomeCents', 'currency', 'savingsGoalCents', 'onboardedAt'])
        && d.name is string && d.name.size() <= 30                          // MAX_PROFILE_NAME_LENGTH
        && isCentsOrNull(d.incomeCents)
        && isCurrency(d.currency)
        && isCentsOrNull(d.savingsGoalCents)
        && (d.onboardedAt == null || isDay(d.onboardedAt));
    }

    function validSchedule(d) {
      return d.keys().hasOnly(['entries'])
        && d.entries is list
        && d.entries.size() >= 1
        && d.entries.size() <= 200;
    }

    // ---- Rutas: users/{uid}/<colección>/{id} ----
    match /users/{uid}/transactions/{id} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid) && isNumericId(id) && validTransaction(request.resource.data);
    }

    match /users/{uid}/categories/{id} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid) && isNumericId(id) && validCategory(request.resource.data);
    }

    // el id es categoría_moneda, por ejemplo 7_CRC
    match /users/{uid}/budgets/{id} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid)
        && id.matches('^[0-9]{1,16}_(CRC|USD)$')
        && validBudget(request.resource.data)
        && id == string(request.resource.data.categoryId) + '_' + request.resource.data.currency;
    }

    match /users/{uid}/recurring/{id} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid) && isNumericId(id) && validRecurring(request.resource.data);
    }

    match /users/{uid}/savings/{id} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid) && isNumericId(id) && validSavings(request.resource.data);
    }

    match /users/{uid}/meta/profile {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid) && validProfile(request.resource.data);
    }

    match /users/{uid}/meta/schedule {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid) && validSchedule(request.resource.data);
    }

    // todo lo demás, para todos: no
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Notas de la propuesta:
- Regla de la verificación de correo (opcional, si se activa `sendEmailVerification`): añadir `&& request.auth.token.email_verified == true` en `isOwner`.
- `string(request.resource.data.categoryId)` está permitido en reglas para enteros; si el emulador lo rechazara, quitar esa última condición del presupuesto (sin confirmar).
- Riesgo de compatibilidad (probar antes de publicar): documentos antiguos que no cumplan la forma exacta fallarán al **actualizarse** (no al leerse). Por ejemplo, transacciones sin `paymentMethod` o recurrentes sin `lastPeriod` escritos por versiones previas. `writeState` y las funciones actuales siempre escriben todos los campos, pero hay que sembrar el emulador con una exportación real de las cuentas de prueba (prueba E13).
- Las reglas **no** limitan el número de documentos ni las lecturas (A1/A2).

---

## Pruebas para el emulador (`@firebase/rules-unit-testing`, Firestore emulator)

Preparación: `firebase.json` con `{"firestore":{"rules":"finance-tracker/firestore.rules"},"emulators":{"firestore":{"port":8080}}}` y `.firebaserc`; Java + `firebase-tools`. Contextos: `alice = authenticatedContext('alice')`, `bob`, `anon = unauthenticatedContext()`.

Aislamiento y rutas
- E1. `anon` no puede leer ni escribir `users/alice/transactions/1`.
- E2. `bob` no puede leer, crear, actualizar ni borrar `users/alice/<cada colección>/…` ni listar `users/alice/transactions`.
- E3. `alice` sí puede leer/escribir/borrar su `users/alice/transactions/1` (documento válido).
- E4. `alice` no puede leer ni escribir el documento `users/alice` (raíz) ni `users/bob`.
- E5. `alice` no puede escribir en una subcolección más profunda (`users/alice/transactions/1/sub/x`) ni en una colección no permitida (`users/alice/otra/1`).
- E6. `collectionGroup('transactions')` de `alice` es rechazado.
- E7. `alice` no puede escribir `meta/otro` (solo `profile` y `schedule`).
- E8. Ningún acceso a `/otra/x` (raíz) ni `/users` (listar).

Validación (cada una debe fallar con `assertFails`, y una versión válida con `assertSucceeds`)
- E9. `amountCents`: `0`, `-5`, `1.5`, `NaN`, `'100'`, `100000000001` (MAX_CENTS + 1), `null`.
- E10. `currency: 'EUR'`; `type: 'transfer'`; `direction: 'x'`; `paymentMethod: 'bitcoin'`; `schedule: 'weekly'`; `color: 'rojo'`.
- E11. `note` de 61 caracteres (y 60 pasa); nombre de categoría de 25 (24 pasa; vacío falla); nombre de perfil de 31 (30 pasa); `date: '2026-1-5'` y `'hola'`; campo extra (`admin: true`); campo faltante; id no numérico (`abc`); id de presupuesto que no coincide con su `categoryId_currency`.
- E12. Operaciones reales de la app: `update` parcial de `recurring` con solo `lastPeriod` (válido y con valor malo), `update` de `categoryId` al borrar una categoría, borrado de un presupuesto, `set` de `meta/profile` con `incomeCents: null`, `onboardedAt: null`.
- E13. Compatibilidad: sembrar (con `withSecurityRulesDisabled`) una exportación real de datos de pruebas escrita por versiones anteriores, y comprobar que `update`/`set` normales de la app siguen pasando; probar `restoreAll`/`uploadLocalData` con un respaldo cargado por `inspectBackup` (debe pasar) y con un respaldo con un registro inválido (debe fallar solo ese lote).

Sesión y escrituras (con la app contra el emulador, no solo reglas)
- E14. Iniciar sesión como A, cargar datos, cerrar sesión y entrar como B en la misma ventana: B ve solo `users/B`; comprobar el contenido de IndexedDB (`firestore/…`) tras cerrar sesión (M2) y tras el arreglo con `clearIndexedDbPersistence`.
- E15. Dos pestañas: A en la 1, cambiar a B en la 2; en la 1 comprobar qué datos se muestran, a qué ruta escribe y que las reglas devuelven `permission-denied` (M1).
- E16. Escritura rechazada: con una regla que devuelve `false`, guardar un movimiento en línea (rechazo antes de 1 s: error inmediato, sin toast de éxito) y con la red cortada y luego restaurada (toast de éxito, luego aviso `saveError` y recarga); repetir cerrando sesión antes del rechazo (M3).
- E17. Cuota: restaurar un respaldo de >20.000 registros en el emulador y observar el fallo a medias (M4/A2); medir el número de escrituras.
- E18. Duplicados: provocar el fallo del segundo lote en `confirmRecurring` + `addSavingsMove` y reintentar; confirmar si aparece un segundo documento (M5).
- E19. Lectura defensiva: con las reglas desactivadas, sembrar un presupuesto sin `currency`, una transacción con moneda `EUR`, y una categoría con id no numérico; comprobar que la app carga (hoy: pantalla de error por `localeCompare`, `cloudStorage.js:329`).
- E20. `request.auth.token.email_verified` (si se adopta): cuenta sin verificar no puede escribir.
