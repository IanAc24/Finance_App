# Auditoría de código y documentos

Fecha: 23/10/2026 · Rama: `ZOH` · Hecha con revisión automática (grep y scripts), sin probar en Android.

Estado de cada punto: **Hecho** (ya aplicado en `ZOH`, sin commit todavía), **Pendiente Ian**, **Pendiente Furyan**.

## Código

### Eliminado o unificado (Hecho)
- Regla CSS `.safe-day` sin uso (sobra del bloque "disponible por día" que ya no existe).
- `public/logo.svg`: copia exacta de `favicon.svg`, nadie la usaba.
- `parseBackup` en `src/lib/backup.js`: solo la usaba su prueba; las pruebas ahora pasan por `inspectBackup`.
- `isPositiveAmount`: solo devolvía `isValidAmount`; se usa `isValidAmount` directo.
- Límites de texto (nota 60, categoría 24, nombre 30): estaban definidos dos veces y escritos a mano en cinco pantallas. Ahora salen de `src/lib/limits.js`.
- CSS: `.pill`, `.row-meta`, `.field select` y `.due-actions` estaban declarados dos veces; quedan en un solo bloque. `.text-link` se dejó igual.

### Pendiente Furyan (su zona)
- `src/lib/closure.js` y su prueba: las reglas de cierre de quincena no las usa la app. Su comentario dice "migración v7 pendiente", pero la v7 terminó siendo `profile`. Decidir si se conserva para después o se borra.
- `src/db/storage.js` (unas 150 líneas): importación única de los datos de la primera versión (localStorage). Se puede quitar si ya nadie tiene datos de esa versión.
- Comentarios con etiquetas internas ("case L1", "L2", "L4", "L5") en `quincena.js` y `AddExpenseScreen.jsx`: reemplazar por la regla en palabras.

### Pendiente (mejoras opcionales)
- Duplicados de lógica:
  - El signo "−/+" delante de montos está repetido en cinco lugares (`HomeScreen`, `HistoryScreen`, `TransactionItem`, `RecurringRow`, `SavingsScreen`). Se podría unificar en un componente.
  - `ymd` en `quincenaSchedule.js` es igual a `todayString` en `dates.js`. No se puede importar directo por una dependencia circular.
  - `toCents` en `backup.js` no devuelve centavos (redondea a dos decimales). Además, `storage.js` tiene otro `toCents` distinto. Renombrar y compartir un `roundMoney`.
- Exportaciones que solo existen para las pruebas o que nadie importa: `MIN_YEAR`, `MAX_YEAR`, `FIRST_BACKUP_DAYS`, `LOAD_TIMEOUT_MS`, entre otras. Se les puede quitar el `export`.
- `src/Header.jsx` está suelto en `src/` y repite el bloque de marca de `AppBar`.

### Revisado y limpio
Sin `console.log`, sin código comentado, sin TODO, sin props ni estado sin usar y sin dependencias sobrantes. Los paquetes de Capacitor se quedan para la versión Android.

## Documentos

### README (Hecho)
Se actualizó:
- Versión de la base: era 6, ahora 8.
- Pantalla de bienvenida y perfil, modo "Me pagaron" y meta de ahorro en "Puedes gastar hoy".
- La línea del Roadmap "Safe to spend per day".
- Las listas del respaldo y de las preferencias.
- La bitácora hasta 0.23.
- La estructura de carpetas, ahora por carpeta.

### Pendiente
- Números que ya se desactualizaron en varios documentos: cantidad de pruebas (687 contra 695) y versión de la base. Mejor quitarlos del texto: `npm test` y `migrations.js` dan el dato real.
- `CLAUDE.md` dice "ZOH no se edita ni se le hace push", pero en la práctica Ian trabaja, mezcla y hace push en `ZOH`. También dice que solo Ian cambia el README, y por eso el README se quedó atrás. Ajustar la regla entre los dos.
- Requisito de Node: README y `CLAUDE.md` piden 22.13; las dependencias piden 22.12. Mejor agregar `engines` en `package.json`.
- `package.json` dice 0.22.0 y la bitácora ya va en 0.23. La versión la fija Ian.
- Las fechas escritas a mano ("Última actualización") en `backlog.md`, `decisiones.md` y el plan de Firebase se desactualizan. Git ya guarda las fechas.
- Ya corregido en la rama de Furyan `docs/estado-colchon-y-appid`, que aún no está en `main`: el appId "por decidir", la meta de ahorro "falta aplicar en PAT" y la ficha 001 marcada como borrador.

### Repositorio
No hay archivos de compilación, `node_modules`, `.env` ni archivos del editor en git. Sugerencia: agregar un `.gitignore` en la raíz (hoy solo hay uno dentro de `finance-tracker/`).

## Otros documentos de esta ronda
- `docs/legal/`: borradores de privacidad, términos, reembolsos y cookies (revisión de abogado pendiente).
- `docs/auditoria-datos-y-patrones.md`: datos innecesarios y patrones oscuros.
- `docs/investigacion-cifrado.md`: opciones de cifrado y recomendación por fases.
