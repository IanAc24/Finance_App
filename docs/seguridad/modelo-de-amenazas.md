# Modelo de amenazas (versión corta)

Revisado el 25/10/2026. Complementa [`SECURITY.md`](../../SECURITY.md) y la [revisión de seguridad de Firebase](../qa/revision-seguridad-firebase.md). Se revisa cada 6 meses y después de un incidente.

## Qué hay que proteger

| Activo | Clase | Dónde está |
|---|---|---|
| Correo de la cuenta | Dato personal | Firebase Authentication |
| Movimientos, categorías, presupuestos, gastos fijos, ahorros, metas | Confidencial | Firestore `users/{uid}/...` (o SQLite local con `VITE_DATA_BACKEND=local`) |
| Archivos de respaldo JSON | Confidencial | El dispositivo del usuario |
| Código de la app y configuración web de Firebase | Público | Repositorio y `dist/` (la configuración viaja en el cliente a propósito) |
| Cuota gratuita de Firestore (compartida por todo el proyecto) | Disponibilidad | Plan Spark |
| Llaves privadas, `.env*.local` | Secreto | Solo en los equipos de Ian y Jason y en variables de Netlify |

No hay servidor propio ni funciones de IA. Las reglas de Firestore son la única autorización del lado del servidor.

## Fronteras de confianza

1. **Navegador ↔ Firebase Authentication:** el navegador no es de fiar; Firebase emite y valida el token.
2. **Navegador ↔ Firestore:** todo lo que escribe un cliente es no confiable; solo las reglas lo frenan.
3. **Archivo de respaldo ↔ app:** un JSON que trae el usuario (límite 20 MB) se valida antes de aplicarlo (`inspectBackup`).
4. **Parámetros de la URL ↔ pantallas:** por ejemplo el año del resumen; se validan y se redirige si están fuera de rango.
5. **Netlify ↔ navegador:** Netlify sirve archivos estáticos; los encabezados (`public/_headers`) limitan lo que el navegador permite hacer.

## Amenazas realistas (STRIDE)

| Amenaza | Tipo | Control actual | Hueco |
|---|---|---|---|
| Una cuenta lee o escribe datos de otra | Divulgación / Manipulación | Reglas por dueño (`users/{uid}`), pruebas con el emulador | Ninguno conocido; mantener las pruebas negativas |
| Cliente alterado escribe datos inválidos (montos raros, textos enormes, ids ajenos) | Manipulación | Validación en el cliente | Las reglas no validan forma: **reglas endurecidas pendientes (ficha 007)** |
| XSS (inyección de script) | Manipulación / Divulgación | React escapa por defecto; sin `dangerouslySetInnerHTML`; CSP sin `unsafe-eval` | `style-src 'unsafe-inline'` hace falta por los estilos en línea de React |
| Clickjacking (la app dentro de un iframe ajeno) | Manipulación | `frame-ancestors 'none'` y `X-Frame-Options: DENY` | Ninguno si los encabezados están desplegados |
| Llaves o secretos filtrados | Divulgación | `*.local` en `.gitignore`; la configuración web de Firebase se asume pública; revisión de cambios | Falta activar secret scanning y push protection en GitHub |
| Archivo de respaldo malicioso o enorme | Manipulación / Denegación | `inspectBackup`: tope de 20 MB, formato y límites por lista | Una restauración grande gasta mucha cuota (hallazgo A2 de la revisión) |
| Toma de una cuenta (contraseña robada o reutilizada) | Suplantación | Firebase Authentication, protección contra enumeración de correos | Sin MFA (requiere Identity Platform); sin verificación de correo |
| Abuso de la cuota gratuita (cuentas masivas, escrituras en bucle) | Denegación | Ninguno fuerte; se puede cerrar el registro con `VITE_ALLOW_SIGNUP=0` | Falta App Check, restringir la clave de API por dominio y reglas endurecidas |
| Pérdida de datos (borrado, mala restauración, fallo del servicio) | Denegación | Respaldos JSON del usuario, caché local de Firestore | Los respaldos son manuales; la restauración en la nube no es atómica |
| Cuenta de GitHub, Netlify o Google comprometida | Suplantación | Subida manual de `dist/`; `main` no se toca directo | Falta 2FA obligatorio y protección de rama en `main` (acción de los dueños) |
| Dependencia vulnerable | Manipulación | `package-lock.json`, `npm audit` | 4 altas en `@grpc/grpc-js` vía `firebase` (solo Node, no entra al navegador); arreglo = actualizar `firebase`, requiere aprobación |
| Fórmulas en CSV exportado | Manipulación | `csv.js` escapa celdas que empiezan con `=`, `+`, `-`, `@` | Ninguno conocido |
| Datos de una cuenta anterior en el mismo navegador | Divulgación | Caché de Firestore por sesión | Revisar la limpieza al cerrar sesión (ver revisión de seguridad) |

## Fuera de alcance

El dispositivo o navegador del usuario (malware, extensiones), ataques físicos y fallos de Google, Firebase o Netlify.

## Pendientes de los dueños

Activar el reporte privado de vulnerabilidades, secret scanning, push protection, protección de rama en `main` y 2FA; activar App Check y restringir la clave de API por dominio; publicar las reglas endurecidas (ficha 007); decidir la actualización de `firebase`.
