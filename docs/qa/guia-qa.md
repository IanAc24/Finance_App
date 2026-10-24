# Guía de QA: cómo probar la app (y cómo repetirlo en otro proyecto)

Última corrida documentada: 24/10/2026 (proyecto `iampoorfornow`, corrida `20261024004258`).

Esta guía junta todo el sistema de pruebas automáticas: qué hay, cómo se corre, qué se encontró y cómo copiarlo a otro proyecto. Los detalles de cada parte están en:

- [`firebase-real.md`](firebase-real.md): la suite contra el Firebase real, paso a paso.
- [`revision-seguridad-firebase.md`](revision-seguridad-firebase.md): la revisión de seguridad de reglas y datos, con las reglas endurecidas propuestas.

---

## 1. El mapa: cinco capas de pruebas

| Capa | Qué prueba | Dónde | Comando (desde `finance-tracker/`) | Toca internet |
|---|---|---|---|---|
| 1. Unitarias | Lógica pura: fechas, quincenas, presupuestos, respaldos, traducciones… | `src/**/*.test.js` | `npm test` | No |
| 2. Dinero (QA) | Montos límite, entrada, teclado, formato, 100 × $0,10, monedas separadas, regresión aleatoria con semilla | `src/qa/` | `npx vitest run src/qa` (también entra en `npm test`) | No |
| 3. Navegador con Firebase falso | Registro, inicio y cierre de sesión, sesión expirada, recuperar contraseña, pantallas protegidas | `e2e/*.spec.js`, `e2e/support/` | `npm run e2e` | No (todo bloqueado) |
| 4. Firebase real: reglas | Una cuenta contra otra, sin sesión, rutas fuera de lo permitido, persistencia, monedas, huecos de validación | `qa-firebase/` | `npm run qa:firebase:rules` | Sí, al proyecto que digas |
| 5. Firebase real: navegador | Crear, editar, borrar y recargar; dos sesiones; cambio de cuenta; guardar 5 veces; sin internet; 100 × $0,10 | `e2e/firebase/` | `npm run qa:firebase:e2e` | Sí, al proyecto que digas |

`npm run qa:firebase` corre la 4 y la 5 juntas con el mismo id de corrida.

Además: revisión de seguridad estática (sin correr nada) en `revision-seguridad-firebase.md`, y sondas anónimas con `curl` (sección 6).

---

## 2. Requisitos

- Node.js 22.13 o más nuevo y `npm install` hecho en `finance-tracker/`.
- Microsoft Edge instalado. Playwright (`@playwright/test`, ya en `devDependencies`) maneja el Edge del sistema (`channel: 'msedge'`), así que **no descarga navegadores**.
- Para las capas 4 y 5: un proyecto de Firebase con Authentication (correo y contraseña) y Firestore, y el archivo `finance-tracker/.env.qa.local` (sección 4).
- No hace falta Java ni el emulador de Firebase (se decidió no instalarlos). Si algún día se instalan, las pruebas de reglas se pueden mover al emulador (ver sección 8).

---

## 3. Capas 1 a 3: sin internet, en cualquier momento

```
cd finance-tracker
npm test                      # capas 1 y 2 (unas 1.100 pruebas, segundos)
npm run lint
npm run build
npm run e2e                   # capa 3, escritorio y celular (unos 2 minutos)
npx playwright test --project=desktop   # solo escritorio
npm run e2e:headed            # viendo el navegador
```

**Regresión aleatoria del dinero:** la semilla y la cantidad se cambian con variables de entorno. La semilla sale en cada error, así que cualquier fallo se puede repetir exacto.

```
QA_SEED=123 QA_COUNT=3000 npx vitest run src/qa/seeded.qa.test.js
```

**Cómo funciona la capa 3 sin Firebase:** Vite arranca en el puerto 5300 con una configuración de Firebase **falsa** (`demo-qa`) y `VITE_DATA_BACKEND=local`. Las pruebas interceptan todas las llamadas a Google y responden con un Firebase Auth falso dentro de la prueba (`e2e/support/fakeAuth.js`). El código de inicio de sesión de la app corre igual que siempre. Cualquier petición a otro sitio se bloquea y hace fallar la prueba. Las 15 cuentas `pruebacorreo1..15@example.test` solo existen en ese Firebase falso; sus contraseñas se generan en memoria y no se escriben en ningún lado.

Resultados en `finance-tracker/e2e/results/` (ignorada por git): `results.json`, `html/`, `manifest.json` (cuenta → escenarios, sin contraseñas) y capturas de los fallos en `artifacts/`.

---

## 4. Capas 4 y 5: contra el Firebase real

### 4.1 Una sola vez: cuentas de prueba

Opción A, con un comando (lo corre una persona, no el asistente):

```
npm run qa:firebase:accounts -- --project iampoorfornow
```

- Crea `pruebacorreo1@example.test` … `pruebacorreo15@example.test` (`--count 2` para solo dos).
- Guarda las contraseñas solo en `.env.qa.local`, que git ignora. No las muestra en pantalla.
- Copia la configuración de Firebase desde `.env.local` y pone el candado `QA_FIREBASE_ALLOW_PROJECT`.
- Si una cuenta ya existe y su contraseña está guardada, solo comprueba que funciona. Nunca borra cuentas.
- Las cuentas aparecen en la consola de Firebase → Authentication → Usuarios.

Opción B, a mano: consola → Authentication → Users → Add user, y copiar `.env.qa.example` a `.env.qa.local` llenando los datos (detalles en `firebase-real.md`).

### 4.2 Cada vez que se quiera probar

```
npm run qa:firebase           # reglas + navegador
npm run qa:firebase:rules     # solo reglas (35 s)
npm run qa:firebase:e2e       # solo navegador (la prueba de 100 × $0,10 tarda varios minutos: es normal)
npm run qa:firebase:cleanup   # si una corrida se cortó a medias
```

### 4.3 Los candados (por qué es seguro correrlo en el proyecto real)

- No corre si falta `.env.qa.local`, si `QA_FIREBASE_ALLOW_PROJECT` no es exactamente el `projectId`, si el proyecto empieza por `demo-` o si hay menos de 2 cuentas. Se detiene sin tocar la red.
- Solo inicia sesión: nunca crea ni borra cuentas.
- Escribe solo en `users/{su propio uid}/`, con la etiqueta `QA-<id de corrida>` e ids que empiezan por 9.
- Tope de escrituras por corrida: `QA_MAX_WRITES` (400 por defecto). El plan gratuito da 20.000 al día para todo el proyecto.
- Al final borra solo lo que creó esa corrida (registrado en `e2e/results/firebase-manifest.json`). Las cuentas quedan.
- Nunca imprime contraseñas ni tokens; los correos salen enmascarados (`p***1@…`).
- Lo único que no se etiqueta: la primera vez que una cuenta entra, la app guarda su consentimiento y su perfil (`meta/profile`). Por eso se usan cuentas dedicadas a pruebas.

### 4.4 Dónde ver los resultados

En `finance-tracker/e2e/results/`:

- `firebase-rules.json`: cada prueba de reglas, pasa o falla.
- `firebase-e2e.json` y `html-firebase/`: las pruebas de navegador, con capturas y video de los fallos en `artifacts-firebase/`.
- `firebase-report.json`: resumen de la corrida (proyecto, id, escrituras, huecos conocidos, lo que no se pudo borrar).
- `firebase-manifest.json`: documentos creados y escrituras usadas.

**Cómo leer el resultado de Vitest:** "passed" pasó, "failed" es un problema real, y "expected fail" son los **huecos conocidos** (`KNOWN GAP`). Son pruebas marcadas para fallar mientras las reglas no validen los datos. Cuando se publiquen las reglas endurecidas, esas pruebas se pondrán en rojo: en ese momento hay que quitarles `.fails`, porque el hueco quedó cerrado.

---

## 5. Qué se encontró (24/10/2026)

### 5.1 Lo que funciona bien (probado en el proyecto real)

- **Aislamiento entre cuentas:** la cuenta 2 no pudo leer, listar, cambiar ni borrar nada de la cuenta 1, y los datos de la cuenta 1 quedaron iguales.
- **Sin sesión no hay acceso:** lectura, escritura y consultas de todas las rutas devuelven 403, también con `curl` sin iniciar sesión.
- **Sin enumeración de correos:** "recuperar contraseña" responde igual para un correo que no existe, e iniciar sesión da un error genérico.
- **Dinero:** 100 × $0,10 = $10,00 exacto; colones y dólares nunca se suman; los montos sobreviven guardado, carga, respaldo y CSV sin cambiar un centavo.
- **Navegador (real):** crear, editar, borrar y recargar; dos sesiones a la vez, cada una con lo suyo; cambiar de cuenta sin que queden datos de la anterior; guardar 5 veces seguidas deja una sola fila.

### 5.2 Problemas encontrados

| # | Gravedad | Problema | Estado |
|---|---|---|---|
| 1 | Alta | Las reglas publicadas en la consola son las del 20/10, más abiertas que `finance-tracker/firestore.rules`. Una cuenta puede escribir en su documento `users/{uid}`, en colecciones que la app no usa y en rutas más profundas (3 pruebas fallaron). Nunca en los datos de otra cuenta. | Pendiente: publicar las reglas (sección 7) |
| 2 | Alta | Las reglas no validan los datos: se aceptan montos negativos, montos como texto, moneda "EUR", notas de 10.000 caracteres y campos extra (5 huecos conocidos). Un presupuesto sin moneda puede impedir que esa cuenta abra la app. | Pendiente: reglas endurecidas de `revision-seguridad-firebase.md` |
| 3 | Media | Registro abierto sin verificación de correo ni App Check: cualquiera puede crear cuentas y gastar la cuota compartida. | Pendiente (configuración en la consola) |
| 4 | Media | Cambiar de cuenta en otra pestaña: la pestaña abierta podría seguir mostrando la cuenta anterior (`TransactionsProvider` sin `key={user.uid}`). | Pendiente |
| 5 | Media | El aviso "guardado" sale al segundo aunque Google no haya confirmado; un rechazo tardío después de cerrar sesión se pierde. | Pendiente |
| 6 | Media | Navegador real: "guardar sin internet y volver a conectar" y "₡10.000 y $100 por separado" fallaron en la corrida del 24/10. | En análisis: capturas en `e2e/results/artifacts-firebase/` |
| 7 | Baja | Un porcentaje exacto de .5 se redondeaba hacia abajo (14,5 % mostraba 14 %). | **Corregido** (commit `fdf99a0`) |
| 8 | Baja | Un presupuesto de ₡1.000.000.000 al que le falta un céntimo mostraba 100 %. | **Corregido** (commit `fdf99a0`) |
| 9 | Baja | En un aparato nuevo, abrir un enlace directo (por ejemplo /history) sin sesión y pasar la bienvenida lleva a Inicio en vez de al enlace. | Pendiente (marcado como fallo esperado en `e2e/auth.spec.js`) |

---

## 6. Sondas rápidas sin iniciar sesión (cualquier proyecto)

Con la clave web y el id del proyecto (son públicos), desde una terminal bash. Todas deben dar 403, y ninguna crea nada:

```
P=<projectId>
B="https://firestore.googleapis.com/v1/projects/$P/databases/(default)/documents"
curl -s -o /dev/null -w "%{http_code}\n" "$B/users/alguien/transactions"
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H "Content-Type: application/json" \
  -d '{"fields":{"q":{"stringValue":"sonda"}}}' "$B/cualquier/cosa"
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" \
  -d '{"structuredQuery":{"from":[{"collectionId":"transactions","allDescendants":true}],"limit":1}}' "$B:runQuery"
```

---

## 7. Para cerrar los problemas 1 y 2 (publicar reglas)

1. Consola de Firebase → Firestore Database → Reglas.
2. Pegar `finance-tracker/firestore.rules` (cierra el problema 1) o, mejor, las reglas endurecidas de `revision-seguridad-firebase.md` (cierran el 1 y el 2).
3. Publicar.
4. Correr `npm run qa:firebase:rules`. Las 3 pruebas de rutas deben pasar. Con las reglas endurecidas, los 5 huecos conocidos se ponen en rojo: quitarles `.fails` y adaptar las pruebas que usan el campo extra `qaTag` (lo avisa `firebase-real.md`).

Antes de publicar las endurecidas conviene probarlas con datos reales de una cuenta, porque documentos viejos con otra forma podrían dejar de poder actualizarse.

---

## 8. Cómo repetir esto en otro proyecto

Lo que se lleva tal cual (no depende de esta app):

- `qa-firebase/lib/env.js`: lectura de `.env.qa.local`, candado del proyecto, tope de escrituras, enmascarado de correos.
- `qa-firebase/lib/tracker.js` y `lib/sdk.js`: registro de lo creado y limpieza solo de lo etiquetado.
- `qa-firebase/create-accounts.js`: crear cuentas de prueba y guardar las contraseñas fuera de git.
- `e2e/support/fakeAuth.js`: Firebase Auth falso para pruebas de navegador sin internet.
- `e2e/support/fixtures.js`: bloqueo de toda la red salvo lo permitido, y falla si algo se escapa.
- `src/qa/seed.js`: generador aleatorio con semilla.
- `playwright.config.js`: proyectos escritorio, celular y `firebase`, con Edge del sistema.

Lo que hay que adaptar:

1. Rutas y nombres de colecciones (`users/{uid}/transactions…`) en `rules.firebase.test.js` y `e2e/firebase/fb.js`.
2. Los ayudantes de pantalla de `e2e/support/app.js` (consentimiento, bienvenida, agregar, historial), según los botones y textos de la otra app.
3. Las expectativas de dinero (`src/qa/*`), según cómo guarde y muestre los montos esa app.
4. Las variables `VITE_*` de configuración.

Pasos en un proyecto nuevo:

1. `npm install -D @playwright/test` (y Edge instalado).
2. Copiar los archivos de la lista, ajustar los 4 puntos.
3. Agregar los scripts `e2e`, `qa:firebase:*` del `package.json` de este proyecto.
4. Agregar `e2e/results/`, `test-results/`, `playwright-report/` al `.gitignore`, y confirmar que `*.local` está ignorado (`git check-ignore -v .env.qa.local`).
5. Correr primero las capas sin internet, luego las sondas anónimas, y al final la suite real con un proyecto de prueba (recomendado) o con cuentas dedicadas.

**Si se instalan Java y `firebase-tools`:** el emulador permite probar reglas sin tocar el proyecto real y probar las reglas endurecidas antes de publicarlas. Faltaría un `firebase.json` con los emuladores de Auth y Firestore y un interruptor en `src/lib/firebase.js` (por ejemplo `VITE_USE_EMULATORS=1`) que llame a `connectAuthEmulator` y `connectFirestoreEmulator`.

---

## 9. Lista para cada corrida

- [ ] `npm test`, `npm run lint`, `npm run build` en verde.
- [ ] `npm run e2e` en verde (el fallo esperado del enlace directo es normal).
- [ ] `.env.qa.local` existe, está ignorado y tiene el candado correcto.
- [ ] `npm run qa:firebase` terminado; revisar `firebase-report.json`.
- [ ] Que el contador de escrituras quede bajo el tope, y que la limpieza no deje documentos.
- [ ] Anotar aquí la fecha, el id de corrida y los cambios en la tabla de la sección 5.2.
- [ ] Nunca subir `.env.local` ni `.env.qa.local`, ni pegar sus valores en chats o reportes.
