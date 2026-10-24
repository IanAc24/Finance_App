# Investigación: ¿hay que cifrar los datos de la app? ¿Cómo?

Creado: 23/10/2026. Estado: **propuesta para decidir; no se cambió código.** Para Ian y Furyan, sin experiencia previa en cifrado.
Marcas: **[VERIFICADO]** = leído en la fuente citada. **[SIN VERIFICAR]** = viene de memoria o de una fuente secundaria. **[OPINIÓN]** = criterio de Claude.

## Resumen en cinco líneas
1. **En la web, SQLite no se puede cifrar con las herramientas actuales** (jeep-sqlite no soporta cifrado). Se podría cifrar a mano con Web Crypto, pero protege poco y cuesta mucho. **[OPINIÓN] Hoy no vale la pena** para dos personas de prueba.
2. **En Android sí hay cifrado de base de datos** (SQLCipher, ya incluido en el plugin) y además Android cifra el almacenamiento del teléfono por defecto. Activarlo es barato **si se hace antes de publicar**; después implica migrar datos.
3. **Firebase ya cifra en tránsito (TLS) y en reposo.** La protección real entre personas son las **reglas de seguridad de Firestore**, no el cifrado. Hay que escribirlas y probarlas bien.
4. **Cifrado de extremo a extremo (E2E) en la nube: demasiado para ahora.** Pierde búsquedas en el servidor y obliga a manejar recuperación de claves.
5. **Nunca guardar contraseñas propias.** Si se cambia el login de Google, usar Firebase Authentication con correo y contraseña.

---

## 0. Qué hay hoy en el repo (confirmado)
- `finance-tracker/src/db/database.js` abre la base con `createConnection(DB_NAME, false, 'no-encryption', 1, false)`: **sin cifrado, a propósito o por defecto**. En web usa `initWebStore()` y `saveToStore()` para volcar la base completa a IndexedDB.
- `finance-tracker/src/db/storage.js` es la costura: solo `TransactionsProvider.jsx` lo importa. Los montos van en centavos enteros.
- Las preferencias van en `localStorage` (`src/lib/prefs.js`), sin cifrar. Conviene revisar que ahí no haya datos sensibles (solo preferencias de pantalla).
- `package.json`: `@capacitor-community/sqlite` ^8.1.1, `jeep-sqlite` ^2.8.0, Capacitor 8. **No existe `android/` todavía.**
- Decisiones vigentes (`docs/decisiones.md`): Firebase (Auth + Firestore), cada persona ve solo lo suyo, login con Google de un toque, Ley 8968 abierta.

## 0.1 Qué datos son y qué tan graves son
Montos, fechas, categorías, notas libres (hasta 60 caracteres), medio de pago, ingreso, meta de ahorro y nombre opcional. **No hay** números de tarjeta, cuentas bancarias ni cédulas. Es información financiera personal: sensible, pero no del tipo que permite robar dinero directamente. Las **notas libres** son el riesgo mayor, porque la gente escribe cosas ("préstamo a Juan", "médico").

**Ley 8968 (Costa Rica):** según un resumen de terceros, el artículo 10 pide a quien administra una base de datos medidas técnicas y organizativas para evitar acceso no autorizado, pérdida o alteración ([resumen Kiteworks](https://www.kiteworks.com/sites/default/files/resources/Kiteworks-brief-Supports-Protection-of-Persons-Against-the-Processing-of-Their-Personal-Data-Law-Law-No-8968-es.pdf)). **[SIN VERIFICAR]**: no se encontró el texto oficial; hay que leerlo en el SCIJ (pgrweb.go.cr) o preguntar a PRODHAB. La ley no dice "cifre con AES"; pide medidas **adecuadas**, y lo que cuenta como adecuado depende del riesgo. **[OPINIÓN]** No soy abogado: con dos usuarios de prueba el riesgo legal es bajo, pero antes de abrir la app a más gente conviene una consulta legal.

---

## 1. Datos guardados en el aparato

### 1a. Web (IndexedDB con jeep-sqlite)

**Hecho:** el README del plugin dice que el cifrado con SQLCipher es solo para nativo (Android/iOS) y que en web no se soportan la base cifrada ni `setEncryptionSecret` **[VERIFICADO]** ([README del plugin](https://github.com/capacitor-community/sqlite/blob/master/README.md)). La base web son archivos de sql.js guardados en IndexedDB sin cifrar.

**Opciones**

| Opción | Qué es | Esfuerzo | Riesgos |
|---|---|---|---|
| A. No cifrar | Dejar como está | Ninguno | Cualquiera con acceso al perfil del navegador puede leer la base |
| B. Cifrar el volcado con Web Crypto | Antes de `saveToStore`, cifrar los bytes de la base con AES-GCM; al abrir, descifrar. Clave derivada de un PIN/frase con PBKDF2 | **Grande** | Hay que "pelear" con jeep-sqlite (guarda solo en su propia tienda); pantalla de PIN; si se olvida el PIN, datos perdidos; más código que probar |
| C. Cifrar solo campos sensibles (notas) | Cifrar el texto de las notas antes de guardarlas en SQLite | Medio | La base queda en claro salvo las notas; hay que descifrar al listar; las búsquedas por nota dejan de funcionar |
| D. Confiar en el cifrado del sistema | BitLocker, FileVault o cifrado de disco del equipo | Ninguno (lo hace el usuario) | Fuera de nuestro control |

**Cómo sería la opción B (técnico, simple):** Web Crypto API, AES-GCM de 256 bits, un IV (valor aleatorio) distinto por cada guardado, y la clave derivada con PBKDF2-HMAC-SHA256. OWASP recomienda **600.000 iteraciones** para PBKDF2-SHA256, o Argon2id como alternativa (no viene en Web Crypto) **[VERIFICADO]** ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)). La sal (salt) se genera al azar, se guarda junto a los datos y no es secreta ([MDN deriveKey](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)). Web Crypto solo funciona en contexto seguro (HTTPS o localhost) **[VERIFICADO]** (misma página MDN).

**Qué protege y qué no**

| Amenaza | ¿Protege el cifrado con PIN? |
|---|---|
| Otra persona usa tu computador, abre el navegador (sesión abierta, app cerrada o bloqueada con PIN) | Sí, si no conoce el PIN |
| Disco robado o copia del perfil del navegador | Sí, si el PIN es razonable (un PIN de 4 dígitos se rompe en segundos aunque se use PBKDF2: solo hay 10.000 combinaciones) |
| Malware o extensión del navegador con acceso a la página mientras la app está abierta | **No.** Si la app ya descifró los datos en memoria, el código malicioso los ve igual |
| Un error nuestro (XSS) en la propia app | **No**, mismo motivo |
| Que alguien mire la pantalla | No |

**Dónde vive la clave**
- **Con PIN:** la clave se deriva del PIN cada vez; no se guarda. Se puede guardar una `CryptoKey` **no extraíble** en IndexedDB para no pedir el PIN en cada visita, pero entonces quien copie el perfil del navegador también puede usar esa clave sin PIN en ese mismo navegador (protege menos; solo evita que se lea el archivo "a mano") **[SIN VERIFICAR el detalle de cada navegador; es el comportamiento documentado de claves no extraíbles, no de seguridad contra copia de perfil]**.
- **Sin PIN:** la clave tiene que guardarse en el mismo navegador junto a los datos. Eso es como cerrar con llave y dejar la llave en la cerradura: solo oculta los datos de miradas casuales. **[OPINIÓN]** No vale el esfuerzo.
- **PIN olvidado:** los datos locales no se pueden recuperar. Con Firebase activo se podrían bajar de nuevo desde la nube; sin Firebase, solo desde un respaldo. Esto es una razón más para hacer el cifrado local después de la sincronización, o junto a ella.

**Recomendación 1a:** **A (no cifrar) por ahora**, mostrando en los ajustes un aviso honesto ("en la web, los datos se guardan sin cifrar en este navegador"). Si en el futuro se pide más protección, hacer **B** con PIN real, no sin PIN. **Esfuerzo: grande. Toca:** `database.js` (abrir/guardar), una pantalla nueva de PIN (zona visual de Ian), y `backup.js` si el formato cambia.

### 1b. Android nativo

**Hecho:** SQLCipher se activa con `androidIsEncryption: true` en la sección `CapacitorSQLite` de `capacitor.config.ts`, y el secreto se maneja con `setEncryptionSecret` / `changeEncryptionSecret` **[VERIFICADO]** ([README](https://github.com/capacitor-community/sqlite/blob/master/README.md)). Hay que abrir la conexión con modo `'secret'` (en vez de `'no-encryption'`, que es lo que usa hoy `database.js` en la llamada a `createConnection`). **[SIN VERIFICAR]** los nombres exactos de los modos ('encryption', 'secret', 'newsecret'); confirmar en `docs/API.md` del plugin.

**Dónde se guarda el secreto:** el README no lo explica ni menciona el Android Keystore **[VERIFICADO que no lo dice]**. Otras fuentes dicen que el plugin guarda el secreto en preferencias cifradas, **[SIN VERIFICAR]**. **Pendiente de la ficha:** leer el código Android del plugin para ver si usa el Keystore (respaldado por hardware) o preferencias comunes. Si no usa Keystore, una alternativa es generar la clave en el Keystore con otro plugin y pasarla al plugin de SQLite (más trabajo).

**Rendimiento y licencia**
- SQLCipher añade un costo pequeño en CPU; para una app con miles de filas (no millones) es imperceptible. **[OPINIÓN, sin medir]**. Medirlo en la prueba de la ficha 001.
- El plugin ya usa SQLCipher en iOS y Android aunque no se active el cifrado (según la lectura del README y una fuente secundaria) **[SIN VERIFICAR del todo]**. La edición "community" de SQLCipher tiene licencia tipo BSD **[SIN VERIFICAR]**; el README avisa que SQLCipher está sujeto a regulaciones de exportación de EE. UU. y puede requerir un reporte anual de autoclasificación ([README](https://github.com/capacitor-community/sqlite/blob/master/README.md)) **[VERIFICADO]**. Para una app de pocas personas no es un problema práctico; revisar antes de publicar en Play Store.
- Importante: **cambiar de "sin cifrar" a "cifrada" después** requiere migrar la base (exportar y reimportar). Por eso conviene decidirlo **antes** de la primera instalación real en Android, cuando aún no hay datos que migrar.

**Cifrado propio de Android:** los dispositivos que salen con Android 10 o superior están obligados a usar cifrado por archivos (FBE); los datos de cada app quedan cifrados con claves ligadas al bloqueo de pantalla y respaldadas por el Keystore **[VERIFICADO]** ([Android Open Source Project](https://source.android.com/docs/security/features/encryption/file-based)). Protege contra un teléfono perdido o robado y apagado/bloqueado. **No protege** si el teléfono está desbloqueado, tiene root o malware con permisos, ni protege contra otra app con la misma sesión (cada app está aislada, eso sí).

| Opción | Esfuerzo | Protege contra | Riesgos |
|---|---|---|---|
| A. Solo el cifrado de Android | Ninguno | Teléfono robado bloqueado | Teléfonos viejos o sin bloqueo de pantalla no cifran bien |
| B. SQLCipher con secreto del plugin | Pequeño-medio | A + extracción de archivos (copias de seguridad ADB, root) | Si se borra el secreto del Keystore (p. ej. reinstalar) se pierde la base: depender de la nube o de los respaldos |
| C. SQLCipher + frase del usuario | Grande | Lo anterior + otra persona con el teléfono desbloqueado | Olvido de frase = pérdida de datos |

**Recomendación 1b:** **B**, activado desde el primer build de Android (ver Fase 2). Puede esperar si Android sigue siendo solo de prueba, pero hay que decidirlo antes de que haya datos reales. **Toca:** `capacitor.config` (nuevo), `database.js` (modo de conexión y secreto), un test que compruebe que la base abierta es cifrada si hay prueba en dispositivo. `storage.js` y `TransactionsProvider` no cambian.

---

## 2. Respaldos y CSV

**Respaldo JSON con contraseña**
- Idea: el usuario pone una contraseña al exportar; se deriva una clave (PBKDF2) y se cifra el JSON con AES-GCM. El archivo guarda `{formato, sal, iv, datos}`. Al restaurar, se pide la contraseña.
- Esfuerzo: **medio.** Toca `src/lib/backup.js` (+ su `.test.js`) y las pantallas de exportar/restaurar (zona de Ian). **Importante:** el formato actual lleva `app:'quincena'` y los respaldos viejos deben seguir restaurando; el cifrado debe ser **opcional** y detectarse por un campo nuevo (`encrypted: true`), sin romper los respaldos sin cifrar.
- Experiencia: opcional ("Proteger con contraseña"), pedir la contraseña dos veces, avisar claramente.
- **Contraseña perdida = respaldo perdido.** No hay recuperación; hay que advertirlo en pantalla.
- Qué protege: el archivo que queda en Descargas, un correo o la nube de archivos personal (Drive, WhatsApp). Es lo más útil de todo, porque los respaldos suelen terminar en lugares poco controlados.

**CSV:** se entiende en Excel y Hojas de cálculo, así que no puede estar cifrado de forma útil. Solución: avisar ("este archivo no está protegido") antes de exportar, y no incluir datos que no hagan falta. Un ZIP con contraseña es posible pero el cifrado clásico de ZIP es débil y Excel no lo abre directo **[SIN VERIFICAR]**; no vale la pena.

**Recomendación 2:** hacer respaldo con contraseña **opcional** (medio) cuando haya tiempo; mientras tanto, solo el aviso en la pantalla de exportar (pequeño).

---

## 3. En tránsito (HTTPS/TLS)
- Los SDK de Firebase hablan con Google solo por HTTPS/TLS. La documentación de Google lo confirma para Datastore/Firestore: "TLS protege los datos mientras viajan por Internet" **[VERIFICADO]** ([Google Cloud, cifrado en reposo/tránsito](https://docs.cloud.google.com/firestore/docs/cmek)).
- Lo que sí debemos hacer nosotros: **alojar la web solo por HTTPS** (Firebase Hosting lo da por defecto **[SIN VERIFICAR en esta ronda]**), y en Android no permitir tráfico HTTP sin cifrar (Capacitor lo hace por defecto con `https` como esquema; confirmar en la config cuando exista).
- Web Crypto también exige HTTPS, otra razón.
- Esfuerzo: **pequeño**, casi todo ya viene hecho. Toca: configuración de hosting, no código.

## 4. En la nube (Firestore)
- **Cifrado en reposo:** Google cifra todo en Firestore por defecto, sin hacer nada **[VERIFICADO]** ([Google Cloud, Firestore CMEK](https://docs.cloud.google.com/firestore/docs/cmek)). Existe CMEK (claves propias en Cloud KMS) para requisitos de cumplimiento; **overkill** aquí.
- **Lo que de verdad separa a Ian de Furyan: las reglas de seguridad.** Un ejemplo básico "requiere sesión" (`request.auth != null`) deja a **cualquier usuario con sesión leer y escribir todo** y Google lo marca como no apto para producción; el modo "permitir todo" es peligroso **[VERIFICADO]** ([reglas, empezar](https://firebase.google.com/docs/firestore/security/get-started)). Lo correcto es limitar por ruta: `users/{userId}/...` con la condición `request.auth.uid == userId` ([estructura de reglas](https://firebase.google.com/docs/firestore/security/rules-structure)); el patrón es habitual pero no se pudo leer textual en las páginas consultadas **[SIN VERIFICAR el texto exacto]**.
  - Hay que **probar las reglas** con el emulador de Firebase (casos: sin sesión, otro usuario, el dueño). Esfuerzo: **medio**. Es la tarea de seguridad más importante del plan.
  - Los clientes de servidor (Admin SDK) saltan las reglas; la app no los usa **[VERIFICADO]** (misma página).
  - Al desplegar con la CLI se sobrescriben las reglas que estén en la consola: guardar las reglas en el repo (`firestore.rules`).
- **¿Cifrado E2E encima (el servidor nunca ve el contenido)?**

| Pros | Contras |
|---|---|
| Ni Google ni un error de reglas expone el contenido | No se puede filtrar, sumar ni ordenar en el servidor (aquí no importa mucho: la app ya carga todo y calcula en JS) |
| Fuerte ante filtraciones de la nube | **Recuperación de claves:** si el usuario pierde la frase, pierde **todo**, incluso en la nube |
| | **Varios aparatos:** hay que compartir la clave entre web y teléfono (frase en cada aparato, o clave envuelta guardada en la nube) |
| | Con Google de un toque no hay contraseña de la que derivar la clave: habría que pedir una frase extra (se acaba el "un toque") |
| | Más código, más pruebas, más que puede salir mal con datos de dinero |

**Recomendación 4:** **no hacer E2E ahora.** Con reglas bien escritas y cifrado en reposo y tránsito de Google, es una protección razonable para dos personas. **[OPINIÓN]** Reconsiderar solo si se abre al público y hay un requisito legal o de confianza claro. Si se llega a hacer, cifrar solo los **campos de texto libre** (notas, nombre) y dejar los números en claro sería un compromiso, pero igual trae el problema de la clave.

## 5. Login propio
- Si se abandona Google de un toque por un login "propio" (correo y contraseña): **la app nunca debe guardar ni procesar contraseñas por su cuenta** (ni en SQLite, ni en Firestore, ni hash casero). Usar **Firebase Authentication** con correo y contraseña: el SDK manda la contraseña a Firebase y el servicio se encarga de guardarla con hash ([registro con correo](https://firebase.google.com/docs/auth/web/password-auth)). Firebase usa una variante de scrypt para eso **[parcialmente verificado]**: la referencia del Admin SDK la describe como "scrypt modificado", pero no se encontró documentación oficial de los detalles internos ([referencia Admin SDK](https://firebase.google.com/docs/reference/admin/dotnet/class/firebase-admin/auth/hash/scrypt)).
- Lo básico que ofrece Firebase **[VERIFICADO]** (misma guía de contraseña): política de contraseña configurable en la consola (largo y tipos de carácter), límite de registros por IP y protección contra enumeración de correos (conviene activarla).
- **Verificación de correo y restablecer contraseña:** `sendEmailVerification(usuario)` y `sendPasswordResetEmail(auth, correo)` existen en el SDK web, con plantillas editables en la consola ([búsqueda; fuente secundaria] **[SIN VERIFICAR en la documentación oficial directa]**). Pendiente: confirmar que se pueden poner en español y qué dominio de remitente usan (los correos pueden caer en spam).
- Cambiar de Google a correo/contraseña **no cambia** la forma de las reglas (`uid` sigue igual). Se puede ofrecer **ambos** métodos. Contraseñas débiles son un riesgo nuevo que Google de un toque no tenía; por eso, la verificación del correo y MFA opcional valen la pena **[OPINIÓN]**.
- Esfuerzo: **medio**. Toca: nueva pantalla de login y el proveedor de sesión (zona visual de Ian), nada en `storage.js` salvo recibir el `uid`.

---

## 6. Recomendación por fases

| Fase | Cuándo | Qué hacer | Esfuerzo | Toca |
|---|---|---|---|---|
| 0 | **Ahora (solo local)** | No cifrar la base web. Avisar en Ajustes y al exportar CSV ("sin cifrar"). Revisar que `localStorage` solo tenga preferencias. Escribir la política de datos en una página corta | Pequeño | Textos en `translations.js`, pantalla de exportar (Ian) |
| 0b | Ahora, opcional | Respaldo JSON con contraseña, opcional y retrocompatible | Medio | `src/lib/backup.js` y su test; pantallas de respaldo |
| 1 | **Antes del primer build real de Android** | Activar SQLCipher (`androidIsEncryption`) y abrir la base con secreto; confirmar dónde guarda el secreto el plugin (Keystore o no); medir rendimiento | Medio (incluye prueba en teléfono real) | `capacitor.config` (nuevo), `database.js` |
| 2 | **Al activar Firebase** | Reglas `users/{uid}` guardadas en el repo, probadas con el emulador; HTTPS en hosting; protección de enumeración si hay correo y contraseña; no dejar nunca reglas de prueba | Medio | `firestore.rules`, `storage.firebase.js` (el interruptor detrás de `storage.js`), sin cambios en `TransactionsProvider` |
| 3 | Si hay login propio | Firebase Auth con correo y contraseña, verificación de correo, restablecer contraseña | Medio | Pantalla de login, proveedor de sesión |
| 4 | Antes de abrir a más personas | Revisión legal de la Ley 8968 / PRODHAB; aviso de privacidad; plan para borrar la cuenta y los datos | Medio (más legal que técnico) | Documentos; función "borrar mis datos" |
| Después, solo si hace falta | PIN en web (opción 1aB), E2E en la nube (4) | Grande | `database.js`, sync, UI |

**Overkill para una app de dos personas hoy:** cifrado E2E en la nube; CMEK; PIN con PBKDF2 en la web; frase propia para SQLCipher; auditorías. **[OPINIÓN]**

**Lo que sí es importante aunque parezca poco:** reglas de Firestore bien escritas y probadas; no dejar `.env.local` ni claves en el repo (ya está en las reglas del equipo); y decidir el cifrado local de Android **antes** de tener datos reales.

## Preguntas abiertas para decidir
1. ¿La app en Android se usará con datos reales ya, o solo de prueba por ahora? (Si es real, la Fase 1 sube de prioridad.)
2. ¿Ofrecemos respaldo con contraseña (Fase 0b) o basta el aviso?
3. ¿Se mantiene Google de un toque? (Evita el problema de contraseñas propias, pero sin contraseña no hay clave para E2E.)
4. ¿Quién lee la Ley 8968 y consulta a PRODHAB, y cuándo?

## Fuentes
- README del plugin SQLite: https://github.com/capacitor-community/sqlite/blob/master/README.md
- Android, cifrado por archivos: https://source.android.com/docs/security/features/encryption/file-based
- Firestore, cifrado en reposo y CMEK: https://docs.cloud.google.com/firestore/docs/cmek
- Reglas de Firestore, empezar: https://firebase.google.com/docs/firestore/security/get-started
- Estructura de reglas: https://firebase.google.com/docs/firestore/security/rules-structure
- Firebase Auth con contraseña: https://firebase.google.com/docs/auth/web/password-auth
- MDN, SubtleCrypto.deriveKey: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
- OWASP, almacenamiento de contraseñas: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Referencia de scrypt de Firebase (Admin SDK): https://firebase.google.com/docs/reference/admin/dotnet/class/firebase-admin/auth/hash/scrypt
- Resumen de la Ley 8968 (tercero, no oficial): https://www.kiteworks.com/sites/default/files/resources/Kiteworks-brief-Supports-Protection-of-Persons-Against-the-Processing-of-Their-Personal-Data-Law-Law-No-8968-es.pdf
