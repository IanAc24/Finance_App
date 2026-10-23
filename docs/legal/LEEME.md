# Documentos legales: LEEME

Redactados el 23/10/2026. **BORRADOR: debe revisarlo un abogado costarricense antes de publicarse.** Esto no es asesoría legal.

## Documentos

| Documento | Español | English |
|---|---|---|
| Política de privacidad | `politica-de-privacidad.es.md` | `politica-de-privacidad.en.md` |
| Términos y condiciones | `terminos-y-condiciones.es.md` | `terminos-y-condiciones.en.md` |
| Política de reembolsos | `politica-de-reembolsos.es.md` | `politica-de-reembolsos.en.md` |
| Política de cookies y almacenamiento | `politica-de-cookies.es.md` | `politica-de-cookies.en.md` |

El español es el texto principal. El inglés tiene la misma estructura de secciones.

## Datos que el equipo debe completar

- [FECHA] (en todos)
- [NOMBRE DEL RESPONSABLE], [CÉDULA], [DIRECCIÓN], [CORREO DE CONTACTO] (privacidad y términos; correo y dirección en todos)
- [PROVEEDOR DE ALOJAMIENTO]: quién sirve la versión web (privacidad). Su registro de visitas (IP) es un dato técnico que hay que declarar
- [URL DEL HISTORIAL DE VERSIONES] (privacidad y términos)
- [URL PARA ELIMINAR CUENTA] y [UBICACIÓN DEL SERVIDOR]: solo al activar la nube
- [PLAZO DE REEMBOLSO] (reembolsos)
- Confirmar con DevTools el nombre exacto de la base IndexedDB (cookies)
- Revisar la página de Google Play el día de publicar (reembolsos)

## Notas para el equipo

### (a) ¿Hay que inscribir la base de datos en la PRODHAB?

**Hoy: no, en mi lectura.** Hay dos razones, ambas en fuentes oficiales o en copias del texto oficial:

1. La Ley 8968, art. 2, párrafo 2, deja fuera de la ley las bases mantenidas "con fines exclusivamente internos, personales o domésticos", si no se venden ni se comercializan. Hoy los datos están en el aparato de cada persona y el equipo no tiene acceso: ni siquiera es una base de datos del equipo.
2. La inscripción obligatoria (Ley 8968, art. 21, y Reglamento art. 78) es para bases "con fines de distribución, difusión o comercialización". El Reglamento (Decreto 37554-JP), art. 44, último párrafo (agregado por el Decreto 40008 de 2016), dice: "No serán sujetas de inscripción ante la Agencia, las bases de datos personales, internas o domésticas". La definición de base "interna, personal o doméstica" está en el art. 2 c) del Reglamento.

**Cuidado con la nube.** Cuando el equipo guarde en Firebase los datos de otras personas, ya no es un uso personal de cada quien: el equipo pasa a ser el responsable (Ley 8968, art. 3 h) y la exención del art. 2 ya no cubre el caso con tanta claridad. La inscripción seguiría sin ser obligatoria mientras no se distribuyan, difundan ni comercialicen los datos (art. 21), pero **la ley sí aplica completa**: consentimiento, información previa, derechos, seguridad. Un pago o preventa no cambia esto, pero vender o usar los datos con fines comerciales sí obligaría a inscribir (y a pagar el canon anual de USD 200, Reglamento art. 78). Conclusión de nube: [SIN VERIFICAR] por un abogado; por seguridad, preguntar a la PRODHAB.

### Una corrección a la premisa: "datos de acceso restringido"

El art. 3 d) de la Ley 8968 define "datos de acceso restringido" como los que, aun estando en registros de acceso al público, no son de acceso irrestricto porque interesan solo a su titular o a la Administración. Es decir, la definición no habla de finanzas. El art. 9.2 dice que su tratamiento se permite solo con fines públicos o con consentimiento expreso del titular.

Lo más relevante: el art. 3 e) lista entre los **datos sensibles** la "condición socioeconómica". Los ingresos y gastos de una persona pueden mostrarla. El art. 9.1 dice que nadie está obligado a dar datos sensibles y prohíbe su tratamiento, salvo excepciones (que no incluyen claramente este caso). La política de privacidad trata los datos financieros como de acceso restringido, pero **el abogado debe decidir si hay que tratarlos como sensibles** antes de activar la nube. Es el punto legal más importante de este borrador.

### (b) ¿Hace falta un banner de cookies hoy?

**No, en mi lectura.** No hay cookies. Lo guardado en el navegador (IndexedDB y localStorage) es necesario para funcionar y no sale del aparato. Costa Rica no tiene una ley especial de cookies [no encontré ninguna; SIN VERIFICAR por un abogado]. La regla indirecta es la Ley 8968 (art. 5, consentimiento informado) y solo cuando los datos identifican a una persona. Agregar un banner antes de tener análisis de uso o almacenamiento no esencial sería innecesario. Hay que agregarlo antes de cualquier análisis, anuncio o similar.

Detalle de código: "Borrar todos los datos" limpia la base y las claves `rolloverSkipped.*`, pero deja `lang`, `theme`, `last*` y `lastBackup`. La política de cookies lo dice. Si se prefiere que borre todo, es un cambio de código (no lo hice).

### (c) Qué cambia cuando se active Firebase y el login

- **Consentimiento y aviso:** pantalla de aceptación antes de subir datos (Ley 8968, art. 5, y Reglamento arts. 4 a 6: libre, específico, informado, inequívoco, individualizado; la prueba la tiene el responsable). Se debe informar los 8 puntos del art. 5.1 de la Ley.
- **Google como encargado:** Reglamento art. 2 n) y art. 29: quien contrata a un proveedor sigue siendo responsable y debe verificar sus medidas de seguridad; art. 40: trasladar datos a un encargado o proveedor **no es** una "transferencia" que requiera un consentimiento aparte. Aun así, se informa en la política. Firebase es un proveedor (hay que leer sus términos de procesamiento de datos [SIN VERIFICAR]).
- **Servidores fuera de Costa Rica:** la ley no prohíbe expresamente el almacenamiento en el exterior (arts. 14 y 40 hablan de transferencia a otros responsables) [SIN VERIFICAR el criterio de la PRODHAB]. Se informa en la política.
- **Nuevas obligaciones del equipo:** protocolo mínimo de actuación (Reglamento art. 32), medidas de seguridad (arts. 34 a 37), aviso a los titulares de una vulneración en 5 días hábiles (art. 38), responder solicitudes de derechos en 5 días hábiles (Ley art. 7; Reglamento art. 18), revocación en 5 días hábiles (art. 8), nombrar correo para solicitudes.
- **Reglas de seguridad de Firestore** que aíslen a cada usuario (ya previstas en el plan).
- **Login:** Google de un toque trae el correo y el identificador de la cuenta de Google: son datos nuevos, hay que listarlos (ya está en la sección 13 de la política). Si se cambia a un login propio, se agregan contraseñas o correo: actualizar la sección.
- **Borrar cuenta:** en la app y en la web (ver d).
- **Actualizar** las cuatro políticas (cookies: la sesión; términos: cuenta y suspensión; privacidad: secciones 3, 5 y 13) y pedir el consentimiento de nuevo.

### (d) Google Play: URL pública y enlace para eliminar cuenta

- La ficha de Play necesita una **URL pública de la política de privacidad** (la política debe estar en un sitio web abierto, sin descarga ni login) [SIN VERIFICAR el requisito exacto de la consola; es el requisito habitual].
- Las apps con cuentas deben dar (1) una vía para eliminar la cuenta **dentro de la app** y (2) un **enlace web** donde se pueda pedir la eliminación sin reinstalar. Ese enlace se declara en la Play Console (formulario Data safety). Verificado en: https://support.google.com/googleplay/android-developer/answer/13327111
- La política debe decir qué datos se borran y cuáles se conservan y por qué. Ya está en la sección 13.
- Hoy no hay cuentas ni recolección, así que el formulario de Data safety se llena con "no se recopilan datos" mientras la nube siga apagada. Confirmar al enviar.
- Los reembolsos de Play los gestiona Google (ver la política de reembolsos).

### Otros puntos para el abogado

- **Retracto (Ley 7472, art. 40):** el texto vigente de la ley habla de "ventas a domicilio" fuera del establecimiento y dice "ocho días" sin decir si son hábiles o naturales. El Decreto 40703-MEIC (2017) agregó al art. 133 del Reglamento 37899-MEIC que el art. 40 aplica al comercio electrónico, que el retracto se ejerce por el mismo medio del consentimiento y que el reembolso va por el mismo medio de pago. Usé "8 días hábiles" como regla generosa. El plazo para devolver el dinero no lo pude verificar.
- **Ley 10946** (servicios digitales y comercio electrónico): publicada en La Gaceta, Alcance 80, el 24/06/2026; entra en vigencia 12 meses después (alrededor de junio de 2027); art. 15 e) pide informar las condiciones del retracto; art. 17 prohíbe patrones oscuros. Fuente: bufetes (secundarias). **No está en vigor hoy.**
- **Cláusula de límite de responsabilidad:** la Ley 7472, art. 42, declara nulas las condiciones generales abusivas en contratos de adhesión, entre ellas las que exoneren o limiten la responsabilidad del predisponente por daños corporales, cumplimiento defectuoso o mora. Los términos lo respetan.
- **Mayoría de edad = 18:** verificado el Código de la Niñez y la Adolescencia (Ley 7739), art. 2: adolescente es la persona de 12 a menos de 18. No pude confirmar el artículo del Código Civil: SIN VERIFICAR.
- **Consentimiento de menores:** la Ley 8968 menciona a los "representantes" (art. 5) pero no pone una edad mínima [revisar].
- La app ya pide el consentimiento con una casilla sin marcar antes de la bienvenida y guarda la versión y la fecha en el aparato; el abogado debe confirmar que eso basta como consentimiento escrito (art. 5 de la Ley 8968).
- Nombre y dirección del responsable: el art. 5.1 h) los exige. Hay que poner datos reales de una de las dos personas, mientras no exista una empresa.

## Fuentes

| Tema | Fuente | Estado |
|---|---|---|
| Ley 8968, arts. 2, 3, 5, 6, 7, 9, 10, 13, 14, 21, 24 | Texto de la ley (copia del Archivo Nacional): https://www.archivonacional.go.cr/web/normativa/ley8968.docx . Oficial: https://www.pgrweb.go.cr (SCIJ, norma 70975) | Leído el texto completo; es copia de una institución pública, no el SCIJ. **Verificada**, salvo reformas posteriores que no pude descartar |
| Reglamento 37554-JP, arts. 2, 4 a 9, 13 a 20, 25 a 26, 29, 32, 34 a 44, 78 (con reformas del Decreto 40008-JP de 2016) | https://www.archivonacional.go.cr/web/normativa/reglamento37554.docx (copia en https://www.tse.go.cr/pdf/normativa/reglamentoleyproteccionpersona.pdf) | Leído; copia con las reformas de 2016. **Verificada**, salvo reformas posteriores |
| Ley 7472, arts. 40 y 42 | https://dhr.go.cr/la_defensoria/leyes/ley_7472.pdf | Leído (Defensoría de los Habitantes). **Verificada**; sin saber si se reformó después |
| Decreto 40703-MEIC (2017) | https://faolex.fao.org/docs/pdf/cos176461.pdf | Leído. **Verificada** (copia en FAOLEX) |
| Decreto 37899-MEIC (Reglamento Ley 7472) | No pude leer el texto | **Sin verificar** (plazo de reembolso, hábiles o naturales) |
| Ley 10946 | https://bufetedecostarica.com/gobernanza-de-los-servicios-digitales-y-el-comercio-electronico-en-costa-rica-10946/ y https://consortiumlegal.com/2026/07/03/ley-comercio-electronico-costa-rica/ | Fuentes secundarias; **sin verificar** en La Gaceta |
| Código de la Niñez y la Adolescencia (7739), art. 2 | Búsqueda de la fuente secundaria (ver https://www.tse.go.cr/pdf/normativa/codigodelaninez.pdf) | Fuente secundaria; art. 2 coincide |
| Google Play: reembolsos | https://support.google.com/googleplay/answer/2479637 y https://support.google.com/googleplay/answer/15574908 | Primera página leída; la segunda **no la pude leer** (el plazo de 48 horas está **sin verificar**) |
| Google Play: eliminación de cuenta | https://support.google.com/googleplay/android-developer/answer/13327111 | Leído. **Verificada** |
| Cookies en Costa Rica | No encontré una ley específica | **Sin verificar** |
| PRODHAB (contacto, procedimiento de denuncia) | https://www.prodhab.go.cr (el sitio dio error 403 al consultarlo) | Reglamento arts. 58 a 63 describen la denuncia. Datos de contacto: **sin verificar** |
