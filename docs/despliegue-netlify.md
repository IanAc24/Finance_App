# Despliegue de prueba en Netlify (ficha 005)

Sitio de pruebas de la app web con login de correo y contraseña. Los datos siguen en SQLite local de cada navegador: Netlify solo sirve los archivos.

## Antes de compilar
1. En `finance-tracker/`, copia `.env.example` como `.env.local` y llena los valores de la consola de Firebase (Configuración del proyecto → Tus apps → app web). `.env.local` no se sube: el patrón `*.local` del `.gitignore` lo excluye.
2. `VITE_ALLOW_SIGNUP=1` muestra `/registro`; vacío o cualquier otro valor lo oculta.
3. Las variables `VITE_*` se leen **al compilar** y quedan dentro de `dist/`. Si cambias una, vuelve a compilar y a subir. (La clave web de Firebase no es secreta, pero igual no entra al repo.)

## Compilar
```
cd finance-tracker
npm run build
```
Sale la carpeta `finance-tracker/dist/`. Incluye `_redirects` (copiado de `public/`) y `assets/sql-wasm.wasm`.

## Subir (elige una)
- **Netlify Drop:** abre https://app.netlify.com/drop y arrastra la carpeta `dist/`.
- **Línea de comandos** (no se instala en el proyecto; `npx` la baja al momento):
  ```
  npx netlify-cli deploy --prod --dir=dist
  ```
  La primera vez pide iniciar sesión en Netlify y elegir o crear el sitio.

**No conectes el repo de Ian a Netlify** (nada de despliegue automático desde GitHub). Siempre se sube `dist/` a mano.

## Después de subir
1. En Firebase: Authentication → Configuración → **Dominios autorizados** → agrega el dominio del sitio (por ejemplo `algo.netlify.app`). Sin eso, entrar falla en Netlify.
2. Comprueba a mano:
   - Cualquier ruta (por ejemplo `/history`) sin sesión lleva a `/login`; al recargar una ruta no sale "Page not found" (eso lo resuelve `_redirects`).
   - Entrar, recargar con sesión, cerrar sesión y volver a `/login`.
   - Guardar un movimiento y recargar: sigue ahí (confirma que el `.wasm` de SQLite carga; en la pestaña Red debe responder `assets/sql-wasm.wasm` con 200).
   - Recuperar contraseña con un correo real: llega el enlace y el mensaje es neutro.

## Riesgos conocidos
- Entrar **no aísla los datos**: dos cuentas en el mismo navegador ven los mismos datos locales.
- El correo de recuperación sale en el idioma por defecto de Firebase (se puede cambiar en la consola: Authentication → Plantillas).
