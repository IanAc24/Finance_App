# Pendientes

Última actualización: 20/10/2026. Fuente de los hallazgos: revisión del 15/10 (hecha en Chromium de escritorio; **nada probado en un Android real**).

## Listos para construir (falta redactar la ficha)
| # | Tarea | Notas |
|---|---|---|
| 1 | Candado anti doble toque con `useRef` en las 8 pantallas que guardan (Inicio, Agregar, Gastos fijos, Ajustes, Categorías, Presupuestos, Ahorros, Bienvenida) y pruebas de regresión | Confirmado en pruebas: 5 toques seguidos crearon 5 movimientos. **Zona de Ian**: rama aparte y avisarle |
| 2 | Margen superior seguro (`--safe-area-inset-top`) en la barra superior | Solo se vio el margen inferior en el CSS. Verificar en el teléfono |
| 3 | Objetivos táctiles de 48 px (filas de movimientos, "‹ Ajustes", botones de presupuestos, enlace al respaldo) | Zona de Ian |
| 4 | Restaurar un respaldo con cero registros válidos: bloquear o avisar con más fuerza | |
| 5 | Guardar un borrador del monto mientras se escribe | |
| 6 | Pruebas de pantallas (componentes) y CI que corra `test`, `lint` y `build` en cada PR | |

## Con ficha lista
| Ficha | Tarea | Falta |
|---|---|---|
| 001 | Firebase: prueba de humo en un Android real | Proyecto Firebase listo (20/10). Falta: registrar la app Android `cr.iampoorfornow` con su SHA-1 de depuración, descargar `google-services.json` (fuera del repo), confirmar las cuentas de Google de Ian y Furyan, y tener Android Studio y un celular con depuración USB |
| 006 | Publicar las reglas de Firestore del repo en `iampoorfornow` y comprobarlas con `npm run qa:firebase` (antes: 36 pasan, 3 fallan; después: todas) | Lo hace Furyan: publicar (consola o `firebase-tools` con su login) y correr la suite antes y después. Superada en parte por la 007 (el archivo ya trae las reglas endurecidas): se publican juntas |
| 007 | Publicar las reglas **endurecidas** (validan campos, tipos, montos, fechas y largos) y comprobarlas con `npm run qa:firebase` (después: 0 fallos, 0 `KNOWN GAP`) | Lo hace Furyan: correr la suite antes, publicar desde la consola, correr después, probar el uso diario en la app. Reglas y pruebas listas en `ZOH` (25/10); no se pudieron ejecutar ahí (sin emulador) |

## Necesitan investigación o decisión antes de construir
| # | Tema | Qué falta |
|---|---|---|
| A | **Firebase** | Decidido. El proyecto Firebase `iampoorfornow` ya existe (20/10). La **ficha 001** (prueba de humo en un Android real) espera la app Android con su SHA-1, `google-services.json`, las cuentas de Google, Android Studio y un celular con depuración USB; después reglas con pruebas, capa de datos con interruptor, botón de Google. Ver `docs/plan-base-de-datos-firebase.md` |
| B | Inicializar Android (`capacitor.config`, `appId`, `npx cap add android`, emulador) | Decidir el nombre en Play Store (`appId` decidido: `cr.iampoorfornow`) |
| C | Descarga del respaldo y del CSV en Android (hoy un enlace `blob:` con `download`, sin verificar en el WebView) | Probar en dispositivo; probablemente plugin de archivos y Share |
| D | Botón Atrás de Android (Agregar con monto a medias) | Probar en dispositivo |
| E | Letra grande del sistema y teclado abierto | Probar en dispositivo |
| F | Meta de ahorro: campo en Ajustes y/o botón "Apartar ahora" | Decidir |
| G | Validación de mercado (entrevistas, preventa) | Sin avances registrados desde el 12/10 |

## Hecho
- App web completa en `ZOH` (9 pantallas, es/en, claro/oscuro, quincenas flexibles, respaldos, 687 pruebas).
- Revisión de la ronda Android (15/10) con pruebas de abuso: respaldos dañados, HTML en notas, montos y fechas extremos, rutas inválidas, dos pestañas.
- "Puedes gastar hoy" aparta la meta de ahorro (19/10, 8 pruebas nuevas, 695 en total). Aplicado en `PAT` el 20/10.
