# Ficha 006 · Publicar las reglas de Firestore del repo y comprobarlas con la suite real

Fecha: 24/10/2026 · Redactada por la sesión de Claude de Ian · Aprobada por: Ian (24/10/2026) · Rama sugerida: ninguna para publicar; los cambios de archivos van en `fix/publicar-reglas` (desde `PAT`)

## Objetivo
Las reglas publicadas en el proyecto `iampoorfornow` son las del 20/10 (ficha 001), más abiertas que `finance-tracker/firestore.rules`. Hay que publicar las del repo y confirmar con la suite de QA contra el Firebase real que quedan cerradas, sin romper la app.

## Decisiones ya tomadas (no se reabren aquí)
- Se publican las reglas **del repo** (`finance-tracker/firestore.rules`), no las endurecidas de `docs/qa/revision-seguridad-firebase.md`. Esas validan tipos y montos y necesitan probarse antes con datos reales: es otra ficha. Lo decidió Ian el 24/10.
- La suite de QA contra el Firebase real ya existe y está documentada en `docs/qa/guia-qa.md` y `docs/qa/firebase-real.md`. No se cambia en esta ficha.
- Furyan es quien publica en el proyecto real (decisión del 18/10: Furyan lleva la base de datos y hace los `push`).

## Qué dice la evidencia (corridas del 24/10 en `iampoorfornow`)
- Aislamiento entre cuentas: correcto. La cuenta 2 no puede leer, cambiar ni borrar nada de la cuenta 1. Sin sesión, todo da 403.
- Fallan 3 pruebas de reglas, todas por las reglas publicadas: con sesión, una cuenta puede escribir en (1) su propio documento `users/{uid}`, (2) una colección que la app no usa y (3) rutas más profundas (`transactions/{id}/sub/x`). Siempre dentro de su propio espacio.
- Última corrida antes de publicar: 36 pasaron, 3 fallaron (solo esas 3).
- Revisado en el código: la app solo usa `users/{uid}/{transactions|categories|budgets|recurring|savings|meta}/{id}` (`src/db/cloudStorage.js:54-56`; en `meta` solo `profile` y `schedule`). Las reglas del repo permiten exactamente eso, así que publicarlas no debería afectar a la app.

## Alcance

### Paso 0 · Requisitos (los hace Furyan, no Claude Code)
- Tener `finance-tracker/.env.local` (configuración web de Firebase) y `finance-tracker/.env.qa.local` (cuentas de prueba). Los dos están ignorados por git: **no se suben, no se pegan en chats y Claude Code no los abre ni los imprime**.
- Si no hay cuentas de prueba: Furyan corre `npm run qa:firebase:accounts -- --project iampoorfornow` (crea `pruebacorreo1..15@example.test` y guarda sus contraseñas solo en `.env.qa.local`). Claude Code **no** crea cuentas ni inicia sesión en el proyecto real: lo hace una persona.
- `npm install` hecho en `finance-tracker/` y Microsoft Edge instalado (Playwright lo usa; no descarga navegadores).

### Paso 1 · Prueba "antes"
Furyan corre, desde `finance-tracker/`:
```
npm run qa:firebase
```
Resultado esperado: 36 pasan, 3 fallan (las de "paths outside the allowlist"). Claude Code lee `finance-tracker/e2e/results/firebase-report.json` (no tiene secretos) y lo confirma.

### Paso 2 · Publicar las reglas (elige una forma)

**Forma A, la consola (recomendada, sin instalar nada):**
1. https://console.firebase.google.com → proyecto `iampoorfornow` → Firestore Database → Reglas.
2. Reemplazar todo por el contenido de `finance-tracker/firestore.rules`. Claude Code puede copiarlo al portapapeles:
   `Get-Content -Raw finance-tracker/firestore.rules | Set-Clipboard` (PowerShell).
3. Comprobar que empieza por `rules_version = '2';` y que la lista dice `['transactions', 'categories', 'budgets', 'recurring', 'savings', 'meta']`.
4. Publicar y esperar un minuto.

**Forma B, la línea de comandos (si Furyan prefiere dejarlo en el repo):**
1. Crear `finance-tracker/firebase.json` con solo esto (sin emuladores, sin hosting):
   ```json
   { "firestore": { "rules": "firestore.rules" } }
   ```
2. Furyan inicia sesión **él mismo** en su navegador: `npx firebase-tools@latest login`. Claude Code no inicia sesión ni maneja la cuenta de Google.
3. Revisar qué se va a publicar: `npx firebase-tools@latest deploy --only firestore:rules --project iampoorfornow --dry-run`. Si dice que compila bien, publicar sin `--dry-run`.
4. Esto no agrega `firebase-tools` como dependencia (se usa con `npx`). Si Furyan quiere dejarlo instalado, es una decisión aparte.

### Paso 3 · Prueba "después"
1. Furyan corre otra vez `npm run qa:firebase`.
2. Resultado esperado: **todas pasan**, más los 5 "expected fail" (los huecos de validación `KNOWN GAP`, que solo se cierran con las reglas endurecidas). Las 3 de "paths outside the allowlist" ahora pasan.
3. Furyan entra a la app con su cuenta normal y agrega y borra un gasto para confirmar el uso diario.

### Paso 4 · Dejar constancia
- `docs/decisiones.md`: fila nueva en **Vigentes**, por ejemplo "24/10 · Reglas de Firestore del repo publicadas en `iampoorfornow` (solo colecciones de la app). Comprobado con `npm run qa:firebase`" — Quién: Furyan.
- `docs/qa/guia-qa.md`, sección 5: anotar la corrida "después" (id de corrida, pasaron, fallaron) y cambiar el estado del problema 1 de la tabla 5.2 a **Corregido**.
- `docs/datos-por-cuenta.md`, sección "Reglas de seguridad": decir que las publicadas ya son las del archivo.
- Si se usó la forma B: subir `finance-tracker/firebase.json` en el mismo commit.

## Fuera de alcance
- Las reglas endurecidas (validación de tipos, montos, monedas y largos). Van en otra ficha, con prueba previa sobre datos reales.
- Cambiar la suite de QA, la app o sus pantallas (zona visual de Ian).
- App Check, verificación de correo y restricciones de la clave web (son ajustes de la consola; quedan anotados en `docs/qa/revision-seguridad-firebase.md`).
- Instalar Java o el emulador.

## Archivos que se espera tocar
- `docs/decisiones.md`, `docs/qa/guia-qa.md`, `docs/datos-por-cuenta.md`: constancia.
- `finance-tracker/firebase.json`: solo con la forma B.
- Ningún archivo de `src/`.

## Criterios de aceptación
- [ ] Corrida "antes": 3 fallos, solo los de rutas fuera de lo permitido.
- [ ] Reglas del repo publicadas en `iampoorfornow`; en la consola, el historial de reglas muestra la nueva versión.
- [ ] Corrida "después": 0 fallos (los 5 `KNOWN GAP` siguen como "expected fail"), `leftoverDocuments` vacío en el reporte y escrituras bajo el tope.
- [ ] La app funciona con una cuenta normal: entrar, agregar, editar y borrar un gasto, recargar.
- [ ] `npm test`, `npm run lint` y `npm run build` pasan.
- [ ] Ningún archivo `.env*.local` en git (`git status` limpio de ellos).

## Pruebas que debe incluir
- No hay pruebas nuevas: se usan las existentes de `finance-tracker/qa-firebase/rules.firebase.test.js` (reglas) y `finance-tracker/e2e/firebase/*.spec.js` (navegador), que ya cubren el caso de regresión (las 3 rutas).

## Riesgos y preguntas abiertas
- **Si algo de la app deja de funcionar después de publicar** (por ejemplo "permission-denied" al guardar): volver a la versión anterior desde el historial de la pestaña Reglas de la consola, avisar a Ian y anotar la ruta exacta que falló. Según el código no debería pasar.
- La suite escribe en el proyecto real: hasta 1000 escrituras por corrida (`QA_MAX_WRITES`), de 20.000 al día del plan gratuito; borra solo lo que crea (etiqueta `QA-<id de corrida>`). No correrla muchas veces seguidas el mismo día.
- Claude Code no debe: crear cuentas, iniciar sesión en Firebase, abrir o mostrar `.env.local` / `.env.qa.local`, ni publicar las reglas endurecidas.

## Informe de entrega (lo llena Claude Code)
- Qué cambió y en qué commits:
- Resultado de test / lint / build:
- Corrida "antes" (id, pasaron, fallaron):
- Corrida "después" (id, pasaron, fallaron, huecos conocidos, escrituras):
- Forma de publicación usada (A consola / B línea de comandos):
- Lo que no pudo verificar:
- Decisiones que necesitan a una persona:
