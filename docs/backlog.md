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
| 001 | Firebase: prueba de humo en un Android real | Furyan: crear el proyecto de Firebase (`appId` ya decidido: `cr.iampoorfornow`), confirmar las cuentas de Google |

## Necesitan investigación o decisión antes de construir
| # | Tema | Qué falta |
|---|---|---|
| A | **Firebase** | Decidido. Hay que hacer la **ficha 001** (prueba de humo en un Android real); después reglas con pruebas, capa de datos con interruptor, botón de Google. Ver `docs/plan-base-de-datos-firebase.md` |
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
