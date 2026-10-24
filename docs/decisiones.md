# Registro de decisiones

Última actualización: 24/10/2026. Una línea por decisión. Lo que está en **Abierto** no se construye hasta que una persona decida.

## Vigentes
| Fecha | Decisión | Quién |
|---|---|---|
| 15/10 | El nombre es **I AM POOR FOR NOW** (ES: **POBRE, POR AHORA**). "Quincena" deja de ser el nombre de la app | Furyan |
| 15/10 | El foco de la ronda actual es **Android**. El objetivo es que ningún usuario pueda romper la app | Furyan |
| 18/10 | Reparto: **Ian** lleva lo visual y el diseño web; **Furyan** lleva la base de datos | ambos |
| 18/10 | Por ahora solo Ian y Furyan prueban la app | Furyan |
| 19/10 | La rama de Ian (`ZOH`) no se edita. Se trabaja en `PAT` con `ZOH` mezclada | Furyan |
| 19/10 | "Puedes gastar hoy" aparta primero la meta de ahorro por quincena (monto fijo del perfil). Implementado en la rama `feat/colchon-ahorro` (commit `1a31e44`); aplicado en `PAT` el 20/10 | Furyan (propuesta de Claude) |
| 19/10 | **Firebase se queda** como base de datos (Auth + Firestore); Supabase queda descartado | Furyan |
| 19/10 | **Los mismos datos en la web y en el celular, y cada persona solo ve los suyos** (Ian no ve los de Furyan ni al revés); pensado para producción | Furyan |
| 19/10 | **Sin pantalla de usuario y contraseña.** Identidad: **Google de un toque** ("Continuar con Google"); la sesión queda guardada en el aparato | Furyan (opción propuesta por Claude) |
| 19/10 | El `appId` de Android es **`cr.iampoorfornow`** (sin nombre de persona) | Furyan (opción propuesta por Claude) |
| 19/10 | Sesiones de Claude = investigación, propuestas, preguntas y fichas. Claude Code = construir con calidad a partir de las fichas | Furyan |
| 20/10 | Proyecto Firebase `iampoorfornow` creado: plan Spark; Authentication con Google habilitado; Firestore (default) en nam5, edición Standard, modo nativo, modo producción, con las reglas de la ficha 001 publicadas (por usuario, sobre `users/{uid}`); app web registrada. Configuración guardada fuera del repo. Sin probar aún con usuarios reales ni en dispositivo | Furyan |
| 23/10 | Web: entrar con **correo y contraseña** (Firebase Authentication), ficha 005; reemplaza a "Google de un toque" (19/10). El **registro está abierto** para quien no tiene cuenta; `VITE_ALLOW_SIGNUP=0` lo apaga | Furyan |
| 23/10 | **Los datos de cada cuenta van en Firestore** (`users/{uid}/…`): solo esa cuenta los ve, en cualquier navegador, y la app funciona sin internet (copia en el navegador). Los datos que ya había en un aparato se ofrecen a la primera cuenta sin datos, con confirmación. `VITE_DATA_BACKEND=local` vuelve a la base local. Ver `docs/datos-por-cuenta.md` | Furyan |
| 24/10 | En inglés el periodo se llama "pay period"; en español sigue "quincena". Los nombres internos no cambian | Ian |

## En cambio
| Fecha | Tema | Estado |
|---|---|---|
| 19/10 | Base de datos: de Supabase a **Firebase** por el modo sin internet y los mismos datos en varios aparatos | Decidido. El proyecto Firebase `iampoorfornow` ya existe (20/10). Siguiente paso: **ficha 001**, prueba de humo en un Android real (`docs/traspasos/001-firebase-prueba-de-humo.md`); espera la app Android con su SHA-1, `google-services.json`, las cuentas de Google, Android Studio y un celular con depuración USB. En la web los datos ya van en Firestore por cuenta (23/10); Android sigue pendiente de esa ficha |
| 18/10 | Supabase solo con internet, sin login | **Superado.** El esquema y sus 52 pruebas existen solo en una rama local de una sesión de Claude (`db/supabase-esquema`); no está en este repo. Sirve de referencia de reglas |
| 18/10 | "No hace falta login" | **Cambiado el 19/10:** no hay formulario de login, pero sí una cuenta de Google, porque hace falta saber quién es cada persona |

## Abiertas
- Ficha 001: confirmar que Ian y Furyan entran con su cuenta de Google.
- Privacidad: Ley 8968 y PRODHAB antes de abrir la app a más personas.
- ¿Quién usa iOS? Hoy solo hay `@capacitor/android`.
- Nombre en Play Store.
- ¿Se agrega un campo en Ajustes para cambiar la meta de ahorro? Hoy solo se cambia repitiendo la configuración inicial.
- ¿Botón "Apartar ahora" que mueva el dinero a Ahorros? (propuesto, sin decidir)
