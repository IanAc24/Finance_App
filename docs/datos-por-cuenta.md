# Datos por cuenta (Firestore)

Desde el 23/10/2026 cada cuenta guarda sus datos en Firestore, en `users/{uid}/…`. Una cuenta no puede leer ni escribir los datos de otra: lo impiden las reglas de seguridad, que se aplican en los servidores de Google, no en la app.

## Cómo funciona
- `src/db/cloudStorage.js` tiene las mismas operaciones que `storage.js` (SQLite). `TransactionsProvider` usa `src/db/dataStore.js`, que elige la nube o la base local. Las pantallas no cambiaron.
- **Sin internet:** Firestore guarda una copia en el navegador (IndexedDB, compartida entre pestañas). La app abre y guarda sin conexión; los cambios se envían al volver la red. Un guardado espera como máximo 1 segundo la respuesta de Google; si Google lo rechaza más tarde, la app avisa y vuelve a mostrar lo que de verdad quedó guardado.
- **Ids:** cada registro nuevo lleva un id hecho en el aparato (milisegundo × 1000 + azar, `src/lib/ids.js`). Crecen con el tiempo y no chocan entre aparatos. El límite de ids del respaldo subió a 8·10^15; los respaldos viejos siguen restaurando.
- **Montos** en céntimos enteros, igual que en SQLite.
- **Trabajos grandes** (restaurar, pasar datos del aparato, borrar todo) se parten en lotes de 450 escrituras. Cada escritura nombra su documento: repetirlos sobrescribe, no duplica.

## Datos que ya estaban en un aparato
La base local (SQLite) de antes de las cuentas no es de nadie. La primera cuenta **sin datos propios** que entra en ese aparato ve: "Este aparato tiene datos guardados de antes de usar cuentas" con lo que hay, y elige:
- **Pasarlos a mi cuenta:** se suben con sus mismos ids; ninguna otra cuenta vuelve a ser preguntada.
- **Cancelar:** esa cuenta empieza vacía y no se le pregunta otra vez; otra cuenta sin datos sí puede ser preguntada.
La base local nunca se borra ni se cambia por esto.

## Reglas de seguridad
Están en `finance-tracker/firestore.rules`. Para publicarlas: consola de Firebase → Firestore Database → Reglas → pegar el archivo → Publicar. Las reglas publicadas el 20/10 (ficha 001) ya separan las cuentas; las del archivo además limitan las colecciones a las que usa la app.

Pendiente: validar en las reglas tipos y límites (montos, nota de 60, etc.) con pruebas en el emulador de Firebase (necesita Java y `firebase-tools`).

## Volver atrás
`VITE_DATA_BACKEND=local` en `.env.local` y volver a compilar: la app usa otra vez la única base SQLite del aparato (todas las cuentas la comparten). Los datos en Firestore no se tocan.

## Límites conocidos
- Solo web. Android necesita la ficha 001 (app Android, SHA-1, `google-services.json`).
- Plan Spark (gratis): 50.000 lecturas y 20.000 escrituras por día para todo el proyecto. Abrir la app lee todos los documentos de la cuenta; con mucha gente o muchos movimientos hará falta el plan Blaze o leer solo lo nuevo.
- Dos aparatos que editan lo mismo sin internet: gana el último cambio de cada documento.
- Los cambios hechos en otro aparato se ven al volver a abrir la app (no en vivo).
- Antes de abrir la app a más personas: privacidad (Ley 8968, PRODHAB), porque son finanzas personales en la nube.
- El JavaScript de la app pasó a 1,2 MB (366 KB comprimido) por Firestore; conviene cargarlo por partes más adelante.
