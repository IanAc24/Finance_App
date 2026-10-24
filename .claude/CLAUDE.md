# I AM POOR FOR NOW (en español: POBRE, POR AHORA)

App de finanzas personales para Costa Rica: movimientos, quincenas (periodo de pago), ahorros, presupuestos y gastos fijos, en colones y dólares, en español e inglés. Todo el código está en `finance-tracker/`.

## Antes de empezar cualquier tarea
1. Lee `docs/decisiones.md` (qué está decidido y qué está abierto) y `docs/backlog.md`.
2. Si la tarea tiene ficha en `docs/traspasos/`, hazla tal cual. Si no hay ficha y la tarea no es trivial, pide una: el diseño y la investigación se hacen en otra sesión de Claude, no aquí.
3. `git fetch` y revisa en qué rama estás. No empieces con cambios sin guardar de otra cosa.

## Cómo se reparte el trabajo
- **Sesiones de Claude (claude.ai):** investigan, comparan opciones, proponen, hacen preguntas, revisan y redactan las fichas. No dependen del repo.
- **Claude Code (tú):** construyes lo que dice la ficha, con pruebas, sin errores y bien organizado. No decides producto, base de datos ni librerías nuevas por tu cuenta: si la ficha no lo cubre, pregunta o déjalo anotado en el informe.
- **Personas:** Ian lleva lo visual y el diseño web. Furyan lleva la base de datos y los datos, y es quien decide y hace los `push`.

## Ramas (importante)
- `ZOH` es la rama de Ian. **No se edita ni se le hace push.** Si trae cambios nuevos, se mezcla en `PAT` (`git merge origin/ZOH`).
- `PAT` es la rama de trabajo de Furyan. Crea `feat/...` o `fix/...` a partir de ella, una por ficha.
- `main` no se toca.
- Nunca hagas `push`, `force push`, `reset --hard` ni borres ramas: deja los commits listos y avisa.
- Si un cambio toca pantallas o estilos (`src/features/`, `src/components/`, `src/index.css`), es la zona visual de Ian: hazlo solo si la ficha lo dice, en una rama aparte, y anótalo en el informe para que él lo vea.

## Comandos (desde `finance-tracker/`)
Requiere Node.js 22.13 o más nuevo (no versiones impares como 23).
```
npm install
npm run dev        # servidor local, http://localhost:5173
npm test           # vitest, ~695 pruebas
npm run lint
npm run build
```
**Puerta de calidad:** antes de dar una tarea por terminada, `npm test`, `npm run lint` y `npm run build` deben pasar. Si una falla, repórtalo; no la desactives ni la borres para que pase.

## Cómo está armado
- React 19 + Vite 8 + react-router. Pantallas en `src/features/`, piezas en `src/components/`, lógica pura en `src/lib/` (cada archivo con su `*.test.js`).
- **Todo lo que se guarda pasa por `src/db/storage.js`** (SQLite en el navegador con `@capacitor-community/sqlite` y `jeep-sqlite`; en web persiste en IndexedDB). Solo `src/context/TransactionsProvider.jsx` lo importa. Esa es la costura para cambiar de base de datos: se respeta su interfaz.
- Migraciones en `src/db/migrations.js`: **nunca edites una que ya salió**, agrega una nueva (la versión actual es 8). Cada migración se prueba partiendo de una base en la versión anterior con datos reales.
- Los nombres internos `quincena`, `quincena-db` y `app:'quincena'` (en los respaldos) **no se renombran**: los respaldos viejos deben seguir restaurando.
- Estilos como los hace Ian: todos en `src/index.css`, con comentarios en español.
- Dinero: en la base va en **centavos enteros**; en la app son montos decimales (`storage.js` convierte). Tope `MAX_AMOUNT` = 1.000.000.000. Fechas: texto `YYYY-MM-DD`.
- Textos: todo va por `t('clave')` con `es` y `en` en `src/lib/translations.js`. Una prueba exige las mismas claves en ambos idiomas, que no haya claves sin usar ni texto fijo en pantallas.
- Límites: nota 60, nombre de categoría 24, nombre de perfil 30.
- Solo una pestaña puede usar los datos a la vez.
- Capacitor está en las dependencias, pero **todavía no existe `android/` ni `capacitor.config`**. Android no se ha probado.

## Reglas de trabajo
- Código JS, sus comentarios y los mensajes de commit en inglés (como el resto del repo); documentos y comentarios del CSS en español.
- Commits pequeños, uno por tema, en imperativo ("Add...", "Fix..."). Cada commit dice qué había, qué cambió y por qué mejora. Cada cambio de lógica lleva su prueba.
- **Sin líneas de crédito a Claude** (`Co-Authored-By`, `Claude-Session` ni similares) en commits ni en descripciones de PR.
- Antes de implementar, avisa en una línea de cualquier riesgo real: pérdida de datos, migración que se rompe, error de dinero.
- Ian fija el número de versión (0.N) y mantiene el README; no los cambies.
- Sin secretos en el repo (`.env.local` no se sube). Credenciales de cualquier servicio, por variables de entorno.
- No agregues dependencias sin que la ficha lo diga.
- Si algo no está claro, pregunta en vez de suponer. Si algo falla, dilo.

## Al terminar una tarea
Deja un informe corto (en la respuesta y, si la ficha lo pide, en `docs/traspasos/`) con: qué cambiaste, archivos tocados, resultado de `test`/`lint`/`build`, qué no pudiste verificar y qué decisión necesita una persona. Actualiza `docs/decisiones.md` solo si se tomó una decisión nueva.
