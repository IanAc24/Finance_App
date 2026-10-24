# Política de cookies y almacenamiento: POBRE, POR AHORA (I AM POOR FOR NOW)

Versión 1.0 · [FECHA]

> BORRADOR: debe revisarlo un abogado costarricense antes de publicarse

English version: change the language to English in Settings (Ajustes).

## 1. Resumen corto

- La app no usa cookies.
- La app no usa rastreo, análisis de uso, anuncios ni servicios de terceros.
- Solo guarda en tu aparato lo necesario para funcionar: tus datos y tus preferencias.
- No hay banner de cookies porque hoy no hace falta (sección 6).

## 2. Qué NO usamos

- Cookies de ningún tipo (propias o de terceros).
- Google Analytics ni herramientas parecidas.
- Píxeles de anuncios o de redes sociales.
- Letras o scripts descargados de otros sitios (las letras están incluidas en la app).

## 3. Qué guarda la app en tu navegador

En el navegador, la app guarda lo siguiente. En Android guardará cosas equivalentes dentro de la app.

### Base de datos (IndexedDB)

| Qué | Contenido | Por qué es necesario |
|---|---|---|
| Base de datos de la app (IndexedDB, creada por la librería jeep-sqlite; contiene la base SQLite "quincena") | Todos tus datos: perfil, movimientos, categorías, presupuestos, gastos fijos, ahorros y calendario de quincena | Sin ella la app no puede guardar nada de lo que escribes |

### Preferencias (localStorage)

| Clave | Qué guarda | Por qué es necesario |
|---|---|---|
| `lang` | Idioma (`es` o `en`) | Mostrar la app en tu idioma |
| `theme` | Tema (`dark` o `light`) | Mostrar el tema que elegiste |
| `lastCurrency` | Última moneda usada | Proponerla al agregar un movimiento |
| `lastPaymentMethod` | Último medio de pago usado | Proponerlo al agregar un movimiento |
| `lastCategoryId` | Última categoría de gasto usada | Proponerla al agregar un gasto |
| `lastBackup` | Fecha del último respaldo descargado | Avisarte cuándo toca hacer un respaldo |
| `backupReminderSnoozedUntil` | Fecha hasta la que pediste no ver el aviso de respaldo ("Ahora no", 14 días) | No mostrarte el aviso de nuevo antes de esa fecha |
| `rolloverSkipped.CRC` y `rolloverSkipped.USD` | Quincena en la que omitiste la oferta de pasar el sobrante a ahorros | No volver a ofrecértelo en esa quincena |
| `finance-data` (solo versiones antiguas) | Datos de versiones viejas de la app, que ya se copiaron a la base de datos | Poder pasar tus datos antiguos a la versión nueva |
| `finance-data-imported` | Marca que dice que esa copia ya se hizo | Que no se copie dos veces |

Estas preferencias no te identifican y no salen de tu aparato. Las claves `finance-data` y `finance-data-imported` pueden no existir si nunca usaste una versión antigua.

## 4. Por qué son estrictamente necesarios

Todo lo de la sección 3 es necesario para darte el servicio que pides: guardar tus datos y mostrarte la app como la dejaste. No se usa para medirte ni para ofrecerte publicidad, y no se comparte con nadie.

## 5. Cómo borrarlos

- Tus datos: Ajustes > "Borrar todos los datos". Esto vacía la base de datos y quita las preferencias de la sección 3, salvo el idioma, el tema y el registro de tu consentimiento.
- Todo (datos y preferencias), en el navegador: abre la configuración del sitio y elige borrar los datos del sitio (en Chrome: candado junto a la dirección > Configuración del sitio > Borrar datos). También sirve borrar "cookies y datos de sitios" en el historial.
- En Android: desinstala la app, o ve a Ajustes del teléfono > Apps > la app > Almacenamiento > Borrar datos.
- Importante: borrar esto elimina también tus datos financieros. Descarga antes un respaldo si quieres conservarlos.

## 6. ¿Hace falta un banner de consentimiento?

- Hoy no. En Costa Rica no hay una ley especial de cookies. La regla viene de la Ley 8968 cuando se tratan datos que identifican a una persona. El almacenamiento de arriba es necesario para que la app funcione, no identifica a nadie fuera de tu aparato, y no sale de él. [SIN VERIFICAR: el abogado debe confirmar esta conclusión.]
- Antes de agregar análisis de uso, anuncios o cualquier almacenamiento que no sea estrictamente necesario, agregaremos un banner donde puedas aceptar o rechazar, con "rechazar" tan fácil como "aceptar", y no activaremos nada antes de tu respuesta.

## 7. Cambios futuros

Cuando se active la sincronización en la nube (aún no activa), el inicio de sesión guardará en tu aparato una sesión (un identificador de sesión) para mantenerte conectado. Eso será estrictamente necesario y lo agregaremos a esta lista. Los datos pasarán a la nube según la política de privacidad, sección 13.

## 8. Contacto

[CORREO DE CONTACTO] · [DIRECCIÓN]

## Datos que el equipo debe completar

- [FECHA]
- [CORREO DE CONTACTO]
- [DIRECCIÓN]
- Confirmar con DevTools (pestaña Application) el nombre exacto de la base IndexedDB antes de publicar
