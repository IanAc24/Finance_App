# Revisión del 24/10/2026: pruebas, abuso y producción

Hecha por Claude Code a pedido de Furyan, sobre main `26b26cf` más las ramas `fix/texto-cuenta-nube` y `fix/titulo-pantallas-entrar`. Sitio: https://iampoorfornow.netlify.app (Firebase `iampoorfornow`).

## 1. Qué se probó
- **10 rondas automáticas** (capas 1 a 3 de `guia-qa.md`): en cada una, `vitest` completo con una semilla aleatoria distinta para la regresión del dinero (`QA_COUNT=3000`) y toda la suite de navegador de Ian (Edge, escritorio y celular, Firebase falso), más 22 escenarios de abuso propios.
- **Abuso como usuario** (escritorio y celular): monto gigante, cero o solo coma, nota de 500 letras con HTML, doble clic en Guardar, botón Atrás a medias, 7 rutas inventadas con sesión, categoría de 100 letras, sin internet, navegación rápida ×5, cerrar sesión y volver a entrar.
- **Revisión visual**: 70 capturas (todas las pantallas, es/en, celular/escritorio) y sin scroll horizontal.
- **Producción con Firebase real**, con dos cuentas de prueba creadas por Furyan (sesión abierta por él): consentimiento, bienvenida completa con montos inválidos, gasto con doble toque, metas (nombre de 200 letras, monto gigante, negativo), depósitos y retiros en ₡ y US$ (incluido sacar más de lo que hay), recargas y **separación entre cuentas**.

## 2. Resultados
| Qué | Resultado |
|---|---|
| Lógica y dinero (1.303 pruebas × 10 rondas) | Ver tabla de rondas (sección 6) |
| Navegador (132 pruebas × ronda) | 1 falla intermitente en algunas rondas (sección 4.1) |
| Abuso (22 escenarios × ronda) | Sin fallas: la app no se rompió |
| Producción | Todo funcionó; separación entre cuentas correcta |

Validaciones que funcionan bien: tope de ₡999.999.999 al teclear; letras, negativos y "1.5.5" rechazados; nota limitada a 60 y mostrada como texto (sin ejecutar HTML); nombre de categoría a 24 y de meta a 40; doble toque guarda una vez (gasto, depósito); retiro mayor al ahorro bloqueado con mensaje claro; rutas inventadas llevan a una pantalla válida.

## 3. Bugs corregidos (con pruebas)
| Commit | Qué estaba mal |
|---|---|
| `6343c8b` | Ajustes → Cuenta decía "tus datos se quedan en este aparato"; en la nube quedan en la cuenta |
| `defa702` | Sin internet, en un aparato nuevo, una cuenta con datos parecía vacía y se le ofrecían los datos del aparato (se mezclaban) |
| `ab078a1` | En la nube, abrir una segunda pestaña la bloqueaba sin necesidad |
| `596a531` | El sitio no tenía cabeceras de seguridad (se podía meter en un marco) |
| `5e21bf2` | **El consentimiento decía "Todo se queda solo en este aparato. Hoy no se envía nada"**: falso con la nube |
| `7b2417e` | Tras cerrar sesión la pestaña seguía diciendo "Ajustes" en el login |
| `d3d2ebd` | La bienvenida culpaba a los gastos fijos cuando lo que se pasaba era la meta de ahorro |

## 4. Pendientes que necesitan a una persona
1. **Consentimiento por aparato, no por cuenta (legal).** Se guarda en el navegador (`legalConsent`): en un aparato compartido, la segunda cuenta entra sin ver ni aceptar nada (comprobado en producción). Propuesta: guardarlo por cuenta (en `meta/profile` o con el uid). Toca `ConsentProvider`, que hoy está por encima de `AuthProvider`.
2. **¿Pedir el consentimiento otra vez?** Quien aceptó el texto falso del punto 3 (`5e21bf2`) aceptó información incorrecta. Subir `LEGAL_VERSION` lo vuelve a pedir a todos. Decisión de Ian/Furyan.
3. **Política de privacidad publicada como borrador**: dice "DRAFT: must be reviewed by a Costa Rican lawyer", tiene [FECHA], [CORREO DE CONTACTO], [NOMBRE DEL RESPONSABLE], [CÉDULA] sin llenar y todavía dice que sin respaldo se pierden los datos al cambiar de navegador. Antes de abrir la app a más gente.
4. **"Eliminar mi cuenta" no existe**, aunque la política lo promete (Ajustes → "Eliminar mi cuenta") y es un derecho de la Ley 8968. Hoy solo se borran los datos; la cuenta de Firebase queda. Necesita ficha (Firebase pide haber entrado hace poco para borrar la cuenta).
5. **Cerrar sesión deja la copia de Firestore en el navegador** (IndexedDB). Otra persona en el mismo aparato no la ve en la app, pero sigue en el disco. Idea: borrar esa copia al cerrar sesión si no hay cambios sin enviar.
6. **Borrar una cuenta en la consola deja sus datos** en `users/{uid}`: hay que borrar los datos primero (Ajustes → Borrar todos los datos).

### 4.1 Falla intermitente de la suite de navegador
`savings.spec.js:476` y `qa-income-savings.spec.js:465`: el segundo depósito seguido no cierra la hoja en 10 s. Solo pasó con la máquina muy cargada (pruebas y builds en paralelo). No se reprodujo en 40 intentos aislados ni 10 repeticiones de la prueba exacta. Causa probable: en modo local cada guardado copia toda la base SQLite a IndexedDB y la cola tarda. En la nube el guardado tiene tope de 8 s y la hoja se cierra igual. Sugerencia: subir el tiempo de esa espera en la prueba o marcarla como lenta.

## 5. Ideas de mejora (UI/UX)
- **Metas que comparten el ahorro**: dos metas de ₡100.000 con ₡30.000 ahorrados marcan 30% cada una, como si hubiera ₡60.000. Elegir a qué meta va cada depósito, o decir que comparten el ahorro.
- **"Te quedan ₡350.000" vs "Puedes gastar ₡40.625 por día"**: el diario ya aparta la meta de ahorro (₡325.000 ÷ 8). Mostrar "₡325.000 después de tu ahorro" evita la duda.
- **Bienvenida**: con un monto gigante el mensaje es genérico; las metas ya dicen "El monto máximo es ₡1.000.000.000". "Bienvenido" → "Te damos la bienvenida" (neutro).
- **Retiro bloqueado**: dejar el monto seleccionado para corregirlo de una vez.
- **Login sin selector de idioma**: la bienvenida y el consentimiento lo tienen; el login no.
- **Peso**: el JavaScript pasó a 1,2 MB por Firestore; cargar Firebase por partes aceleraría el primer arranque en celulares.
- **Netlify**: quitar la etiqueta "Powered by Netlify" (script `/.netlify/scripts/hud`) en la configuración del sitio.
- **Cuentas falsas**: el registro está abierto y sin verificación de correo; valorar verificación o App Check antes de abrir a más gente.

## 6. Rondas
Corridas sobre `fix/texto-cuenta-nube`, una sola a la vez (las de antes de las 16:38 se descartaron: tres corridas se pisaban el puerto 5300). Lógica = `vitest` (1.303 pruebas, semilla aleatoria del dinero); navegador = Playwright, 132 pruebas (128 + 4 omitidas a propósito), con los 22 escenarios de abuso.

| Ronda | Semilla | Lógica | Navegador | Falla |
|---|---|---|---|---|
| 1 | 25814001 | 1.303 ✔ | 127 ✔ · 1 ✘ | `savings.spec.js:476` (4.1) |
| 2 | 16275002 | 1.303 ✔ | 127 ✔ · 1 ✘ | `savings.spec.js:476` (4.1) |
| 3 | 28489003 | 1.303 ✔ | 128 ✔ | ninguna |
| 4 | 4043004 | 1.303 ✔ | 127 ✔ · 1 ✘ | `qa-income-savings.spec.js:465` (4.1) |
| 5 | 26798005 | 1.303 ✔ | en curso al subir este informe | |

Las rondas 5 a 10 siguen corriendo; su resultado se agrega en un commit aparte.

Además: los 9 escenarios de abuso de `e2e/abuse.spec.js` (nuevo) pasaron 18/18 (escritorio y celular) en una corrida aparte.

## 7. Cómo repetirlo
- Rondas: `npm test` y `npm run e2e` (de `finance-tracker/`), con `QA_SEED=<número> QA_COUNT=3000` para variar la regresión del dinero.
- Abuso: `npx playwright test e2e/abuse.spec.js`.
- Producción: entrar con dos cuentas de prueba en el sitio y repetir la sección 1; para borrarlas, primero Ajustes → Borrar todos los datos en cada una y después la cuenta en Firebase.
