=== FICHA 005: Login con correo y contraseña (web) y sitio de pruebas en Netlify ===
Objetivo: una persona con cuenta entra a la app web con correo y contraseña, conserva la sesión al recargar, puede salir y recuperar su contraseña, y la app no muestra nada hasta entrar. Funciona en localhost y en Netlify.

Ya decidido: Firebase Authentication con correo y contraseña reemplaza a "Continuar con Google". Solo web hoy. Los datos siguen en SQLite local: NO toques storage.js ni uses Firestore. Furyan ya habilitó el método en la consola y creó finance-tracker/.env.local con VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID y VITE_ALLOW_SIGNUP. Nunca pidas ni imprimas esos valores; nada de eso entra al repo ni al historial.

MÓDULOS
- src/lib/firebase.js: init perezoso de firebase/app y firebase/auth con las variables VITE_FIREBASE_*. Si faltan, mensaje de configuración claro (no pantalla en blanco).
- src/context/AuthProvider.jsx y hook useAuth(): status ('loading' | 'authenticated' | 'unauthenticated'), user, signIn, signUp, signOut, resetPassword. Usa onAuthStateChanged.
- src/lib/authErrors.js: mapa de códigos de error de Firebase a claves de translations.js. Lógica pura con su *.test.js.
- src/features/auth/: LoginScreen, SignUpScreen, ResetPasswordScreen y AuthGate (ruta protegida).

COMPORTAMIENTO
- Públicas: /login, /recuperar y /registro (esta solo si VITE_ALLOW_SIGNUP === "1"; si no, ni la ruta ni el enlace existen). Todo lo demás protegido.
- Sin sesión: redirige a /login guardando el destino y vuelve ahí al entrar. Con sesión, /login y /registro llevan a /. Mientras status sea 'loading', pantalla de carga (sin parpadeo del login).
- TransactionsProvider y la base local se montan SOLO con sesión. Si moverlo rompe pruebas o la inicialización, detente y repórtalo.
- Formularios: etiqueta visible, type="email", autocomplete (email / current-password / new-password), mostrar/ocultar contraseña, validación en cliente (correo válido; contraseña de 8 o más en registro; confirmación igual), botón deshabilitado y candado useRef contra el doble envío, errores con aria-live y foco al primer error, objetivos táctiles de 48 px, margen seguro.
- Mensajes: contraseña incorrecta y correo inexistente muestran EL MISMO mensaje genérico; además mensajes propios para correo ya registrado, demasiados intentos, sin conexión y error desconocido. Nunca mostrar error.message crudo. Recuperar contraseña muestra siempre "Si el correo está registrado, te enviamos un enlace", exista o no; sin continueUrl personalizado. No registrar correos ni contraseñas en consola.
- Ajustes: fila "Cuenta" con el correo y botón "Cerrar sesión" (cambio mínimo). Al cerrar sesión NO se borran los datos locales.
- Textos por t() en es y en (la prueba de paridad debe pasar). Estilos en src/index.css con comentarios CSS en español, con las variables de tema claro y oscuro existentes.
- Crea .env.example con los nombres de las variables sin valores; verifica que .env.local esté en .gitignore.

NETLIFY
- public/_redirects con: /* /index.html 200
- Documenta en docs/ el despliegue: npm run build y arrastrar dist/ a Netlify Drop, o npx netlify-cli deploy --prod --dir=dist. Las variables VITE_* se leen de .env.local al compilar. No conectes el repo de Ian a Netlify.

DEPENDENCIAS: solo "firebase" (importa solo firebase/app y firebase/auth). Confirma los nombres de la API contra los tipos del paquete instalado, no de memoria. Nada más; netlify-cli no se instala como dependencia.

FUERA DE ALCANCE: Google, Android/Capacitor, Firestore, migrar datos, verificación de correo, MFA, cambiar correo o contraseña dentro de la app, aislamiento de datos por cuenta, CI.

ORDEN DE COMMITS (si el tiempo aprieta se corta donde esté en verde):
1) firebase.js, AuthProvider, AuthGate, LoginScreen, textos, estilos y "Cerrar sesión" en Ajustes. 2) Recuperar contraseña. 3) Registro con VITE_ALLOW_SIGNUP. 4) _redirects, .env.example y documento de despliegue.

PRUEBAS (sin red, con firebase/auth simulado): authErrors y validadores; AuthGate (carga, sin sesión, con sesión, destino guardado); formularios (validación, doble envío, mensajes). npm test, npm run lint y npm run build deben pasar desde finance-tracker/.

CRITERIOS DE ACEPTACIÓN (los manuales los comprueba Furyan; tú dime cuáles no pudiste verificar):
- Sin sesión, cualquier ruta lleva a /login y no se monta la base local.
- Registro, entrada, recarga con sesión, cierre de sesión y regreso a /login.
- Contraseña incorrecta y correo inexistente: mismo mensaje.
- Recuperar contraseña llega a un correo real; mensaje neutro.
- Doble toque en "Entrar" no envía dos veces.
- es/en, claro/oscuro, ~400 px sin scroll horizontal.
- Con sesión y sin internet la app abre y los datos locales siguen ahí (no verificado; anota el resultado).
- En Netlify: entrar funciona, y un movimiento guardado sobrevive a una recarga (incluye que el .wasm de SQLite cargue).
- Ni .env.local ni claves en archivos ni en el historial; sin variables, mensaje de configuración claro.

RIESGOS PARA REPORTAR (no los resuelvas por tu cuenta): entrar no aísla datos (dos cuentas en el mismo navegador ven los mismos datos locales); esta ficha toca la zona de Ian (src/features/, src/index.css, Ajustes): anótalo en el informe.
=== FIN DE LA FICHA ===
