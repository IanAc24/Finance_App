# Ficha 001 · Firebase: prueba de humo en un Android real

Fecha: 19/10/2026 · Redactada por: sesión de Claude · Aprobada por: Furyan (20/10/2026) · Rama sugerida: `feat/firebase-prueba-de-humo` (desde `PAT`)
**Estado: Listo para arrancar cuando estén los pendientes.**

## Objetivo
Comprobar, antes de reescribir la capa de datos, que Firebase cumple lo que se necesita en un teléfono Android real: entrar con Google, guardar sin internet, sincronizar al volver y ver lo mismo en la web, cada persona solo con lo suyo.

## Decisiones ya tomadas (no se reabren aquí)
- Firebase (Auth + Firestore). Los mismos datos en web y celular; cada persona solo ve lo suyo; sin formulario de usuario y contraseña: Google de un toque (Furyan, 19/10). Ver `docs/plan-base-de-datos-firebase.md`.

## Lo que hace Furyan antes (Claude Code no puede)
**HECHO (20/10):**
- Proyecto Firebase `iampoorfornow` creado en plan Spark (sin tarjeta).
- **Authentication → Google** habilitado.
- **Firestore** (default) en modo producción: nam5, edición Standard, modo nativo.
- Reglas de la sección "Reglas de prueba" publicadas.
- App web registrada (configuración guardada fuera del repo).
- **`appId` decidido: `cr.iampoorfornow`** (Furyan, 19/10). Cambiarlo después obliga a registrar la app de nuevo en Firebase; tras publicar en Play no se puede cambiar.

**PENDIENTE:**
1. Registrar la app Android `cr.iampoorfornow` con su SHA-1 de depuración.
2. Descargar `google-services.json` (va en `android/app/`, **no se sube al repo**).
3. **Confirmar que Ian y Furyan entran con su cuenta de Google**; con eso se prueban las reglas con dos personas.

## Alcance
- Inicializar Capacitor en Android: `capacitor.config` con nombre "I AM POOR FOR NOW" y el `appId` decidido, `npx cap add android`.
- Instalar `firebase`, `@capacitor-firebase/authentication` y `@capacitor-firebase/firestore` (únicas dependencias nuevas autorizadas) y configurar lo que piden: `google-services.json` en `android/app/`, `rgcfaIncludeGoogle = true`.
- Una **página de prueba oculta** (ruta `/dev/firebase`, solo con `VITE_FIREBASE_SMOKE=1`) con: botón de entrar con Google, mostrar el usuario, botón "Guardar un dato de prueba", y la lista de datos del usuario en vivo con una marca "pendiente de sincronizar". No se toca ninguna pantalla existente.
- Configuración de Firebase por variables de entorno (`.env.local`, fuera del repo).
- Documentar en `docs/` los pasos exactos para correrlo en un teléfono.

## Fuera de alcance
- No se toca `storage.js`, `TransactionsProvider` ni las pantallas de Ian.
- No se migra ningún dato ni se cambia la base local.
- No hay botón de entrar en las pantallas reales todavía.
- No se sube `.env.local`, claves ni nada que no sea público.

## Reglas de prueba (Firestore)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
Los datos de prueba van en `users/{uid}/smoke/{id}`.

## Criterios de aceptación (se comprueban a mano en el teléfono y en la web)
- [ ] Entrar con Google funciona en el teléfono y en la web con la misma cuenta; la sesión sigue después de cerrar la app y reiniciar el teléfono.
- [ ] Con internet: un dato guardado en el teléfono aparece en la web (y al revés).
- [ ] **Modo avión:** se guarda un dato, aparece como "pendiente", se cierra la app, se abre, sigue ahí; al reconectar se sincroniza y aparece en la web.
- [ ] Con la cuenta de Ian, no se ve ni se puede leer ni escribir nada en `users/{uid de Furyan}` (probado en el emulador de reglas o a mano en la consola).
- [ ] Un lote de dos escrituras guardado sin internet queda completo o no queda (todo o nada).
- [ ] Se anota cuántas lecturas y escrituras marcó la consola de Firebase tras la sesión de prueba.
- [ ] `npm test`, `npm run lint` y `npm run build` pasan; sin la variable `VITE_FIREBASE_SMOKE` la página de prueba no existe.

## Pruebas que debe incluir
- Pruebas unitarias de lo que se pueda aislar (por ejemplo, la construcción de rutas `users/{uid}/...`). Lo demás es una lista de comprobación manual en `docs/`.

## Riesgos y preguntas abiertas (Claude Code consulta, no supone)
- Que el Firestore nativo no use la sesión del plugin de Auth: si pasa, se documenta y se detiene.
- Licencia y mantenimiento del plugin de Firestore: anotar lo que se encuentre.
- Si el emulador de Android no sirve para el inicio de sesión con Google, se prueba en el teléfono de Furyan.
- El SHA-1 de Play (después de publicar) es distinto del de depuración.

## Informe de entrega (lo llena Claude Code)
- Qué cambió y en qué commits:
- Resultado de test / lint / build:
- Lo que no pudo verificar:
- Decisiones que necesitan a una persona:
