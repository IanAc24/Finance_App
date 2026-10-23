# Plan de base de datos: Firebase (modo sin internet y mismos datos en web y celular)

Creado: 19/10/2026. Actualizado: 19/10/2026 (23:00). Estado: **decidido; falta la prueba de concepto (ficha 001). Todavía no se reescribe la capa de datos.** Lo marcado [OPINIÓN] es de Claude, no un dato. Lo marcado [SIN VERIFICAR] no se comprobó.

## Decisiones (Furyan, 19/10)
1. **Firebase se queda** (Auth + Firestore). Supabase queda descartado.
2. **Los mismos datos en la web y en el celular.**
3. **Cada persona solo ve lo suyo**: Ian no ve los datos de Furyan ni al revés. Pensado para producción.
4. **Sin pantalla de usuario y contraseña.** La identidad es **Google de un toque**: un botón "Continuar con Google" la primera vez en cada aparato (en Android usa la cuenta del teléfono). La sesión queda guardada en el aparato.

Por qué hace falta identificar a la persona: para que dos aparatos muestren lo mismo y aun así los datos no se mezclen con los de otra persona, la app tiene que saber quién es. La alternativa descartada fue una cuenta anónima con código de vinculación (probablemente exige servidor, Cloud Functions, que no está en el plan gratuito [SIN VERIFICAR el detalle]) y la de "cada aparato por separado" (no comparte datos).

## Lo que ya tiene la app
- Ya funciona sin internet: guarda todo en SQLite local (IndexedDB en la web). Falta la sincronización entre aparatos y la copia en la nube.
- Toda la persistencia pasa por ~25 operaciones de `src/db/storage.js`; solo `TransactionsProvider.jsx` las usa. Es la costura para cambiar de base de datos.
- La app carga todos los datos en memoria y calcula en JavaScript.

## Lo verificado (documentación, 19/10)
- **Firestore sin internet:** guarda las escrituras en una cola y las sincroniza al volver; si dos cambios chocan, gana el último por documento ([docs](https://firebase.google.com/docs/firestore/manage-data/enable-offline)). En web la persistencia hay que activarla.
- **Las transacciones de Firestore fallan sin internet** ([docs](https://firebase.google.com/docs/firestore/manage-data/transactions)). Las operaciones de varios pasos se harían con escrituras en lote.
- **Plugin nativo `@capacitor-firebase/firestore`** ([guía](https://capawesome.io/blog/capacitor-firebase-cloud-firestore-guide/), [ficha](https://capawesome.io/docs/sdks/capacitor/firebase/cloud-firestore/)): en Android e iOS usa la caché del SDK nativo, no el IndexedDB del WebView; 100 MB por defecto; las escrituras sin conexión sobreviven al cierre de la app; admite escrituras en lote y escuchas en vivo. En web usa el SDK web de Firebase. La versión 8.x va con Capacitor 8. Es **no oficial** (de Capawesome); su licencia no se pudo confirmar. La guía no menciona transacciones.
- **Login con Google:** en un WebView de Android es poco fiable; se usa el plugin nativo `@capacitor-firebase/authentication`, que guarda la sesión en el aparato y la devuelve incluso sin internet ([guía](https://capawesome.io/blog/capacitor-firebase-authentication-guide/)). Pide `google-services.json` en `android/app/` y el SHA-1 de la app registrado en la consola de Firebase (y el de Play después de publicar).
- **Un usuario solo ve lo suyo:** reglas de seguridad sobre `users/{userId}/{document=**}` con `rules_version = '2'` ([docs](https://firebase.google.com/docs/firestore/security/rules-structure)). La condición `request.auth != null && request.auth.uid == userId` es el patrón habitual, pero no se pudo leer en esa página: [SIN VERIFICAR].
- **Costos:** plan Spark sin tarjeta. Firestore: 1 GiB, 10 GiB/mes de salida, 50.000 lecturas, 20.000 escrituras y 20.000 borrados por día. Sin Cloud Functions, Storage ni Cloud Run ([precios](https://firebase.google.com/pricing)). Con dos personas no debería alcanzarse; no se midió.

## Lo que falta verificar (lo cubre la ficha 001)
1. Que el Firestore nativo use la sesión del plugin de Auth nativo (para que las reglas vean al usuario) y que en web ocurra lo mismo con el SDK web. [SIN VERIFICAR]
2. Escribir sin internet en el teléfono, reconectar y ver el dato en la web.
3. Que la sesión y la caché sobrevivan al cierre de la app y a reiniciar el teléfono.
4. Si Android puede borrar la caché y qué pasa con lo no sincronizado.
5. Cuántas lecturas gasta abrir la app (carga todo) con la caché activa.
6. Licencia y mantenimiento del plugin.
7. Transacciones/lotes sin internet con el plugin.
8. Privacidad al subir finanzas personales a la nube: Ley 8968 y PRODHAB, antes de abrir a más personas.

## Diseño propuesto [OPINIÓN, no aprobado; lo cierra la ficha de la capa de datos]
- Mantener la interfaz de `storage.js` y escribir `storage.firebase.js` detrás de ella, con un interruptor para volver a SQLite mientras se prueba. `TransactionsProvider` y las pantallas casi no cambian.
- Una sola API para web y Android: el plugin de Firestore (en web usa el SDK web).
- Datos por persona: `users/{uid}/transactions`, `categories`, `budgets`, `recurring`, `savings`, `settings` (quincena y perfil). Ids de texto; montos en centavos enteros.
- **Contra duplicados por doble toque o reintentos:** ids deterministas para lo que no debe repetirse (por ejemplo, confirmar un gasto fijo en un periodo: `rec_{id}_{periodo}`; presupuesto por categoría y moneda), de modo que repetir la escritura la sobrescribe, incluso sin internet.
- Operaciones de varios pasos con escrituras en lote; las reglas de seguridad validan tipos y límites (nota 60, categoría 24, nombre 30, monto máximo).
- **Datos que ya existen en cada aparato:** importarlos una sola vez, desde un aparato y con confirmación explícita de la persona ("Subir mis datos de este aparato"). Riesgo: si web y celular tienen datos locales distintos y los dos se suben, hay duplicados; la ficha debe decidir cómo evitarlo.
- Dos aparatos que editan lo mismo sin internet: gana el último cambio por documento. Aceptable para movimientos (cada uno es un documento); hay que cuidar los documentos únicos (perfil, configuración de quincena).

## Qué pasa con el trabajo de Supabase
Existe solo en una rama local de una sesión de Claude (`db/supabase-esquema`) y en `supabase.zip`; **no está en este repo** ni se aplica. Se aprovechan sus reglas de integridad probadas (52 pruebas) como especificación de las reglas de seguridad de Firestore y sus pruebas con el emulador.

## Orden de trabajo
1. **Ficha 001: prueba de humo en un Android real** (`docs/traspasos/001-firebase-prueba-de-humo.md`). Si falla algún punto de la lista, se vuelve a esta decisión con datos.
2. Ficha 002: reglas de seguridad y sus pruebas con el emulador.
3. Ficha 003: `storage.firebase.js` con el interruptor, y la importación de datos locales.
4. Ficha 004: botón "Continuar con Google" y estado de sesión (toca la zona de Ian: coordinar).
