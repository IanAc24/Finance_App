# Pruebas automáticas contra el Firebase real

Esta suite prueba el backend REAL (Authentication + Firestore) con peticiones reales de un cliente que inicia sesión, igual que la app. No usa el emulador ni cuentas falsas. Todo está en `finance-tracker/`: `qa-firebase/` (pruebas de reglas y herramientas), `e2e/firebase/` (pruebas de navegador) y `vitest.firebase.config.js`.

Nada de esto corre con `npm test` ni con `npm run e2e`: esos comandos se comportan igual que antes.

## Qué hace

**A. Reglas (Vitest, SDK de Firebase en Node)** — `qa-firebase/rules.firebase.test.js`
- La cuenta A crea, lee, actualiza y borra su propio movimiento, ahorro, presupuesto, gasto fijo, categoría y un documento `meta` de prueba.
- La cuenta B no puede leer, listar, consultar, modificar ni borrar lo de A (`permission-denied`), y el documento de A queda igual (A lo vuelve a leer).
- Sin sesión no se puede leer ni escribir nada.
- Rutas fuera de lo permitido: `users/{uid}` en sí, colecciones no listadas, rutas más profundas, colecciones raíz, uid inventado, consultas `collectionGroup`.
- Persistencia: escribir, releer del servidor, actualizar, releer, borrar, releer (no existe), y releer desde otro cliente de la misma cuenta.
- Monedas y decimales: 100 documentos de 10 centavos USD suman exactamente 1000; ₡10.000 y $100 se guardan y leen por separado; el mismo id escrito dos veces deja un solo documento.
- **Huecos conocidos** (`KNOWN GAP`, usan `test.fails`): monto negativo, monto como texto, moneda desconocida, nota de 10.000 caracteres y campos extra. Hoy las reglas no validan, así que el servidor los acepta y esas pruebas salen en verde "por fallar". Cuando se publiquen las reglas endurecidas de `revision-seguridad-firebase.md` (sección "firestore.rules propuesto") se pondrán en rojo: quita `.fails` en ese momento. El resultado de cada sonda queda en el reporte (`knownGaps`).

**B. Navegador (Playwright, proyecto `firebase`, Edge)** — `e2e/firebase/*.spec.js`
- Inicia sesión (nunca crea cuenta) con la cuenta 1: agregar gasto, Historial, recargar, editar, recargar, borrar, recargar. Cada paso se confirma también en el servidor.
- Dos navegadores a la vez con las cuentas 1 y 2: cada una ve solo sus filas.
- Cerrar sesión de A e iniciar B en el mismo navegador: nada de A en Inicio, Historial ni Estadísticas. Luego se vuelve a A.
- Guardar 5 veces seguidas: una sola fila.
- Guardar sin internet y volver a conectar: la fila queda una sola vez.
- ₡10.000 y $100 en pantalla y en el servidor.
- 100 × $0,10 = $10,00 por la pantalla (100 escrituras). Si el tope `QA_MAX_WRITES` deja menos de 130 escrituras libres, usa 20 × $0,50 = $10,00 (20 escrituras). La decisión se imprime en la salida.
- 20 movimientos aleatorios (semilla fija por corrida) contra totales calculados aparte, en pantalla y en el servidor.
- La app se sirve con `VITE_DATA_BACKEND=cloud` y `VITE_ALLOW_SIGNUP=0`, sin `fakeAuth`. Solo se permiten `localhost`, `*.googleapis.com` y `*.firebaseapp.com`; cualquier otro host se bloquea y la prueba falla si hubo alguno.

## Límites de seguridad

- Si falta `.env.qa.local`, falta una variable, `QA_FIREBASE_ALLOW_PROJECT` no es **igual** al `projectId`, el proyecto empieza por `demo-` o hay menos de 2 cuentas, la suite se detiene al instante, sin tocar la red, y termina con código distinto de 0.
- Al empezar imprime el id del proyecto, el id de la corrida, las cuentas enmascaradas (`p***1@…`) y el tope de escrituras. Nunca imprime contraseñas ni tokens.
- Nunca crea ni borra cuentas de Authentication. Solo inicia sesión.
- Solo escribe bajo `users/{uid}/` del usuario que inició sesión. Cada documento lleva el prefijo `QA-<id de corrida>` (en `note`, en `name` o en el campo `qaTag`) e ids numéricos que empiezan por 9, para no chocar con los de la app. En `meta` solo se usa `meta/qa-<id>`: **nunca** `meta/profile` ni `meta/schedule`.
- Tope de escrituras por corrida: `QA_MAX_WRITES` (1000 por defecto; el plan gratuito da 20.000 al día para todo el proyecto). Una corrida completa usa unas 800 incluyendo la limpieza. Al terminar se imprime el total. Las pruebas que no caben en el tope se omiten con un mensaje.
- Limpieza al final (idempotente): borra solo (1) lo registrado en `e2e/results/firebase-manifest.json` que además tenga la etiqueta de la corrida, y (2) las transacciones, ahorros y gastos fijos cuya nota empiece por `QA-<id>`. Todo lo demás se deja intacto. El manifiesto no tiene contraseñas.
- Lo que la suite no etiqueta: al entrar por primera vez con una cuenta, la app pide aceptar el consentimiento y la pantalla de bienvenida (se omite la configuración). Eso puede escribir `meta/profile` de esa cuenta de prueba. Usa cuentas dedicadas a pruebas.
- Si algún día se publican las reglas endurecidas, las pruebas de `budgets` y `meta` (campo `qaTag` y documento `meta/qa-…`) y las de "campos extra" dejarán de pasar tal cual: habrá que adaptarlas a los campos permitidos.

## Crear las cuentas de prueba

1. Consola de Firebase del proyecto de prueba, **Authentication > Users > Add user**.
2. Crea al menos dos usuarios, por ejemplo `pruebacorreo1@example.test` y `pruebacorreo2@example.test`, con una contraseña de 14 o más caracteres. Puedes usar un dominio tuyo (`pruebacorreo1@tudominio.com`) o `example.test`: ese dominio **no puede recibir correo**, pero no importa porque la consola crea el usuario sin verificar nada y la suite solo inicia sesión.
3. Hasta 15 cuentas (`QA_ACCOUNT_1` a `QA_ACCOUNT_15`); las pruebas actuales usan la 1 y la 2.
4. Se recomienda un proyecto de Firebase separado para pruebas, con las mismas reglas que producción.

## Configurar `.env.qa.local`

```
cd finance-tracker
copy .env.qa.example .env.qa.local
```

Rellena (sin comillas):

- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`: Configuración del proyecto > Tus apps > Web.
- `QA_FIREBASE_ALLOW_PROJECT`: el mismo `projectId`, escrito igual. Es el candado.
- `QA_MAX_WRITES` (opcional) y `QA_RUN_ID` (opcional, 3 a 30 letras, números o `-`).
- `QA_ACCOUNT_1_EMAIL`, `QA_ACCOUNT_1_PASSWORD`, `QA_ACCOUNT_2_EMAIL`, `QA_ACCOUNT_2_PASSWORD`, y las demás si quieres.

`.env.qa.local` queda fuera de git por la regla `*.local` (se comprueba con `git check-ignore -v .env.qa.local`). No lo subas ni lo pegues en chats.

## Comandos (desde `finance-tracker/`)

```
npm run qa:firebase:rules     # solo las reglas (rápido)
npm run qa:firebase:e2e       # solo el navegador
npm run qa:firebase           # ambos, con un mismo id de corrida
npm run qa:firebase:cleanup   # quita lo que dejó una corrida cortada
npx playwright test --list --project=firebase   # lista los tests sin ejecutarlos
```

Los tres primeros comprueban el candado antes de hacer nada. El navegador necesita Edge instalado y el puerto 5301 libre.

## Dónde quedan los resultados

En `finance-tracker/e2e/results/` (ignorada por git):

- `firebase-report.json`: id de corrida, proyecto, pasa/falla por prueba, escrituras usadas, huecos conocidos y documentos que no se pudieron borrar. Sin secretos.
- `firebase-manifest.json`: documentos creados en la corrida y contador de escrituras.
- `firebase-rules.json` y `firebase-e2e.json`: salidas crudas de Vitest y Playwright.
- `html-firebase/`: reporte HTML de Playwright; `artifacts-firebase/`: capturas de pantalla de las pruebas que fallan (pueden mostrar correos de las cuentas de prueba; no las compartas sin revisar).

Si empiezas otra corrida y la anterior dejó documentos, su manifiesto se guarda como `firebase-manifest.stale-<id>.json`. Para limpiarlos, renómbralo a `firebase-manifest.json` y ejecuta `npm run qa:firebase:cleanup`.

## Limpieza final

La suite borra sus propios documentos. Las **cuentas** las borra una persona: Consola de Firebase > Authentication > Users > menú de la fila > Delete account. La suite nunca lo hace. Los datos que la app guarde por su cuenta al entrar (por ejemplo `meta/profile`) quedan en esas cuentas de prueba hasta que se borren.

## Crear las cuentas de prueba con un comando

En vez de crearlas a mano en la consola, una persona puede correr:

```
npm run qa:firebase:accounts -- --project iampoorfornow
```

- Crea `pruebacorreo1@example.test` … `pruebacorreo15@example.test` en ese proyecto (`--count 2` para solo dos).
- Genera contraseñas largas y las guarda solo en `.env.qa.local` (ignorado por git); no las muestra.
- Si una cuenta ya existe y su contraseña está en `.env.qa.local`, solo comprueba que funciona; nunca borra cuentas.
- No corre si `--project` no es igual al proyecto configurado.
- Las cuentas aparecen en la consola de Firebase → Authentication → Usuarios. Para borrarlas, se hace a mano en la consola.
