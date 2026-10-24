# QA independiente: ingresos, ahorros, metas y resumen anual

Rama `feat/ingresos-ahorros` (commits d082242, 03079f1, 3f7a543). No se hizo commit ni push. No se tocó `.env.local`, `.env.qa.local` ni la suite de Firebase real.

## 1. Resultados por comando

| Comando | Resultado |
|---|---|
| `npm test` (antes de agregar pruebas QA) | 52 archivos, 1270 pruebas, todas pasan |
| `npm test` (con `src/qa/savings.qa.test.js`) | 53 archivos, 1290 pruebas, todas pasan (también con `QA_SEED=99`) |
| `npm run lint` | pasa (mis dos primeros errores propios, `process` sin definir y una variable sin usar, ya están corregidos) |
| `npm run build` | pasa (solo el aviso conocido de chunk > 500 kB) |
| Playwright `desktop`, suite completa, línea base | 40 pasan, 1 falla (`workflows.spec.js` "full flow", ver bug 1) |
| Playwright `mobile`, suite completa, línea base | 38 pasan, 3 omitidas, 0 fallan |
| Playwright `desktop`, suite completa final (con mi spec y la corrección) | 55 pasan, 0 fallan |
| Playwright `mobile`, suite completa final | 51 pasan, 4 omitidas (las pruebas de tamaños fijos solo corren en desktop), 0 fallan |

Mi spec nuevo `e2e/qa-income-savings.spec.js` tiene 14 pruebas: 14/14 en desktop; en mobile 12 pasan, 1 omitida (la de tamaños) y la de "flujos existentes" falló una vez por la misma carrera del bug 1 (corregida y repetida 3 veces por proyecto: 18/18).

## 2. Errores confirmados (por gravedad)

No encontré ningún error de datos ni de contabilidad. Todo lo de abajo es de prueba flaky, de coherencia de visualización o decisiones de diseño.

### Bug 1 (prueba, media-baja): `workflows.spec.js` falla en desktop, carrera con el teclado
- Evidencia: línea base desktop, `e2e/workflows.spec.js:80`, esperaba `₡0` y recibió `₡4.500`. Repetido: falló 2 de 3 veces y 1 de 1. En mobile pasó.
- Causa: al abrir `/edit/:id` el texto del monto ya se ve, pero el `keydown` de la ventana (`AddExpenseScreen.jsx`, `useEffect` de las líneas ~165-183) se registra un instante después. Los 4 Backspace llegan antes y se pierden. Con 300 ms de espera pasa 3/3. Para una persona no es visible. No pude confirmar que ya existiera antes de la rama (el intento con un worktree del commit anterior falló por otra causa y lo deshice).
- Corrección hecha (pequeña): `e2e/workflows.spec.js` ahora reintenta el primer Backspace con `expect(...).toPass()` hasta que se acepta. Resultado: pasa en desktop y mobile, repetido 3 veces.

### Hallazgo 2 (baja-media, decisión de producto): colones con céntimos en Ahorros y Metas
- Pasos: Ahorros, CRC, Depositar `100,49`. Se guarda, pero el saldo se muestra `₡100` (`formatMoney` redondea colones a enteros). Una meta de `100,50` se muestra `₡101` aunque el saldo `₡100,50` también se muestra `₡101`, y la meta se alcanza con 100,50 exacto pero no con 100,49 (se vería igual).
- La pantalla Agregar no permite decimales en colones (el teclado ignora el punto), pero `MoveForm` y `GoalForm` sí los aceptan.
- Propuesta: en CRC rechazar decimales en los formularios de ahorro y meta, o mostrar los céntimos. Lo decide una persona.

### Hallazgo 3 (baja, decisión de contabilidad): movimientos con fecha pasada
- `MoveForm` permite fechas pasadas y solo exige que el saldo total alcance. Un retiro fechado en 2024 financiado por un depósito de 2025 se acepta y deja el cierre de 2024 en negativo (`src/qa/savings.qa.test.js`, última prueba). Además, borrar un depósito viejo puede dejar el saldo negativo (el comentario del código dice que es intencional).
- Propuesta: validar saldo cronológico o dejarlo documentado.

### Hallazgo 4 (baja, diseño): el resumen anual puede ocultar datos que sí existen
- `yearRecap` marca `historyAfterSavings` si algún movimiento de ahorro es anterior a la primera transacción de la moneda, y la pantalla oculta ingresos, gastos y sobrante de todo el año. Ejemplo: `e2e/results/artifacts/qa-recap-320x700-dark-full.png`, tarjeta Colones de 2026: dice "Incomplete data" aunque hay ingreso ₡800.000 y gasto ₡120.000 del año.
- Por lectura de `YearRecap.jsx` (no probado en el navegador): un año sin actividad pero con saldo arrastrado muestra "No data" y esconde apertura y cierre.

### Hallazgo 5 (baja, visual): la alcancía vuelve al 30% al cumplir todas las metas
- Con saldo ₡1.274.568 y todas las metas cumplidas, el nivel baja al relleno por defecto (`DEFAULT_FILL`, 0,3). Ver `qa-savings-data-768x1024-dark.png`. Es la regla actual de `pigFill`; avisar a Ian.

### Hallazgo 6 (muy baja, no verificado en el navegador)
- `IncomeScreen.jsx` guarda `remembered` a nivel de módulo (periodo, moneda, búsqueda). Si otra cuenta entra en la misma pestaña sin recargar, hereda esos filtros. No hay datos, solo filtros.

## 3. Contabilidad (pruebas en `src/qa/savings.qa.test.js`, centavos enteros, 20 pruebas, semilla `QA_SEED`)
- Depósitos y retiros nunca son ingreso ni gasto: `getTotals`, `buildReport` (ingreso y gasto idénticos con y sin ahorros; "a ahorros" y "de ahorros" aparte), `quincenaFigures`, `getQuincenaHistory`, `incomeSummary`, `yearRecap`. Bien.
- El sobrante estimado (`periodSurplus`, `surplus`) no se suma al cierre de ahorros. Bien.
- Años: 31 dic vs 1 ene, apertura de N+1 igual al cierre de N, tres años seguidos, ambas monedas sin mezclarse, año sin movimientos arrastra la apertura. Bien.
- Metas: se alcanza exacto en el objetivo y no un centavo antes (también con 500,05 + 500,05); retiro posterior conserva `achievedAt`; un reintento con el mismo id no cuenta doble; meta de otra moneda no se alcanza. Bien.
- Retiro mayor al saldo se rechaza por centavos; exacto se permite. Bien.
- Secuencia aleatoria con semilla (600 pasos, 2023-2026, dos monedas): saldo = suma, nunca negativo, cierres anuales encadenados. Bien.

## 4. Navegador (`e2e/qa-income-savings.spec.js`)
Todo pasó salvo lo ya dicho:
- Ingresos en CRC y USD con fuentes, editar y borrar; cero, centavo (USD), ₡1.000.000.000 aceptado y el dígito extra se ignora; persisten tras recargar y tras cerrar sesión y volver a entrar.
- Doble envío: dos clics síncronos en Guardar de Agregar ingreso dan 1 registro; tres clics síncronos y `requestSubmit` doble en la hoja de depósito dan 1 registro.
- Metas: un centavo antes no se alcanza, exacto sí, retiro de más se rechaza en el formulario, retiro del saldo exacto funciona y la meta sigue alcanzada; no se vuelve a celebrar tras recargar ni tras un depósito posterior ni tras cerrar sesión y volver.
- Animación después de la escritura: con CPU a 1/6 (CDP) los eventos fueron: moneda y fila a 543 ms del clic (mismo instante), ráfaga y aviso a 1194 ms. Ninguna moneda antes de que la fila exista; el aviso llega después de la moneda. Un solo `.coin` y una sola ráfaga. Limitación: el modo local escribe muy rápido, así que no pude retener la escritura; el orden se comprobó por marcas de tiempo, no con una escritura realmente colgada. La comprobación "sin moneda mientras la hoja sigue abierta" solo se aplica si la hoja seguía abierta en ese instante (no registré si lo estaba).
- Movimiento reducido: 0 monedas, 0 ráfagas, 0 animaciones corriendo, el resumen muestra valores finales (`₡300`, `₡0`, `₡300`).
- Sin errores de consola ni `pageerror` en Ingresos, Ahorros y Resumen, ni en los flujos de gastos existentes (agregar, editar, borrar, Historial, Estadísticas, Ajustes, Inicio).
- Totales: Historial muestra los mismos ingreso/gasto antes y después de ahorrar (`+₡100.000`, `−₡30.000`); el reporte muestra ingreso, gasto y "a ahorros ₡20.000 / de ahorros ₡5.000" separados. En Inicio cambia la cifra diaria (₡8.750 a ₡6.875) porque los ahorros restan lo disponible: es la regla anterior de la quincena, no un error.
- Aislamiento: dos contextos con dos cuentas a la vez no ven ingresos, ahorros ni metas del otro.

## 5. Tamaños y temas
1440x900, 1024x768, 768x1024, 390x844 y 320x700, oscuro y claro, en Inicio, Ingresos (vacío y con datos), Ahorros (vacío, con datos, USD vacío), hoja de depósito, diálogo de meta y resumen: 144 capturas en `finance-tracker/e2e/results/artifacts/qa-*.png`. Comprobación automática en todas: sin scroll horizontal (`scrollWidth <= innerWidth`), nada fuera de la ventana (los chips de periodo son una fila con scroll horizontal a propósito), sin texto cortado sin elipsis, alcancía sin tocar el saldo, barra inferior sin tapar el último contenido: 0 problemas. Vistas a ojo: `qa-savings-data-320x700-dark-full.png`, `qa-savings-data-390x844-light-full.png`, `qa-savings-data-768x1024-dark.png`, `qa-savings-data-1024x768-light.png`, `qa-savings-empty-390x844-light.png`, `qa-deposit-sheet-320x700-dark.png`, `qa-goal-dialog-320x700-dark.png`, `qa-recap-320x700-dark-full.png`, `qa-income-data-320x700-dark-full.png`, `qa-income-empty-320x700-light.png`, `qa-home-320x700-dark-full.png`. Sin problemas, salvo que a 320 px los nombres largos de meta y de nota se acortan con "..." (esperado). En las capturas de página completa la barra inferior sale a media página: es un efecto de la captura.

## 6. Reglas de Firestore
`finance-tracker/firestore.rules`: frente al commit 93a309f el único cambio es agregar `'goals'` a la lista permitida de cada cuenta. Nada más cambió.

## 7. Cambios que hice
- `finance-tracker/e2e/workflows.spec.js`: carrera con el teclado (bug 1).
- Archivos nuevos: `finance-tracker/src/qa/savings.qa.test.js`, `finance-tracker/e2e/qa-income-savings.spec.js`, este informe. No toqué código de `src/`.

## 8. No pude verificar
- Firestore real, reglas reales y reintentos sin conexión (el modo local no ejerce `'pending'` ni 8 s de espera). Retiro duplicado desde dos dispositivos con la nube.
- Interfaz en español, Android, lector de pantalla.
- Que el bug 1 ya existiera antes de la rama.
- La carrera de Backspace solo se observó en pruebas automáticas.
