# MusicFest · Resultados de las pruebas

Última ejecución: 2 de septiembre de 2026, desde `modulos/musicfest`.

## Resumen

Todo verde, ejecutado en el equipo de Pablo (macOS, Node 24.14.1, Temurin 21).

| Suite | Comando | Resultado |
|---|---|---|
| Dominio y migración | `npm run test:domain` | **128/128** |
| Humo de extremo a extremo (modo demo, jsdom) | `npm run test:smoke` | **20/20** |
| Reglas de Firestore (emulador) | `npm run test:rules` | **37/37** |
| Integración con emuladores | `npm run test:integration` | **5/5** |
| **Total** | `npm test` + las dos de emulador | **190/190** |

Verificaciones adicionales:

- Importador en seco sobre la exportación real: sin advertencias.
- `firestore.rules` comparado carácter por carácter con las reglas vivas del
  proyecto: MovieBlend, La Odisea e `isOdysseyAdmin` idénticas.
- Todas las rutas del sitio responden 200 sobre HTTP, incluidas las de los otros
  dos módulos.

## Detalle · restricciones, entregas y migración

`tests/domain/constraints.test.mjs` — 10 pruebas

- El catálogo semilla mantiene sus 80 artistas, sin ids repetidos, con géneros
  conocidos y métricas en rango.
- `totals` suma costo, duración, popularidad, chilenos y géneros, e ignora ids
  inexistentes.
- Existe un lineup factible para los tres días con las reglas por defecto.
- Presupuesto, mínimo de talento chileno y mínimos por género invalidan cuando
  corresponde.
- Reglas editadas por el docente se respetan sin tocar el dominio.

`tests/domain/submissions.test.mjs` — 13 pruebas

- El recálculo reproduce los totales de una entrega honesta.
- Una popularidad inflada por el cliente se detecta y se ignora.
- Artistas fuera del pool, repetidos, o un pool recortado después de la entrega
  invalidan el lineup.
- `crossDayConflicts` detecta un artista asignado a dos días.
- El ranking cuenta entregas factibles de la revisión vigente sin aprobación
  manual, y descarta las infactibles.
- La auditoría de cierre distingue entrega existente, falta de chilenos,
  lineup incompleto, ausencia total y lineup válido sin confirmar.

`tests/domain/migration.test.mjs` — 9 pruebas, sobre la exportación real
`musicfest-demo-2026-08-10.json`

- Los 81 artistas (80 semilla + 1 personalizado) llegan completos.
- Las 31 ediciones docentes sobreviven al mapeo.
- Los artistas eliminados no reaparecen.
- Las 81 carátulas y sus 35 aprobaciones se conservan.
- El viaje `session → documentos → session` reconstruye la misma actividad, y la
  segunda vuelta es estable (no genera escrituras infinitas).
- El pool importado sigue permitiendo resolver los tres días.

## Detalle · humo de extremo a extremo (9)

`tests/integration/local-boot.test.mjs`, escenario encadenado en modo demo:

1. El panel docente arranca, lista los 80 artistas y conserva el botón de
   exportar. En modo demo no aparece la puerta de acceso.
2. Iniciar, avanzar a sábado y domingo, retroceder y reabrir funcionan; la
   reapertura sube la revisión y registra el evento en la bitácora.
3. Retirar un artista del pool quita exactamente uno; agregar un artista
   personalizado lo guarda y lo activa sin perder al resto.
4. El estudiante entra, ve el escenario cerrado, el docente inicia desde "otra
   pestaña", el equipo arma un lineup válido haciendo clic en tarjetas reales y
   lo entrega con `dayIndex`, revisión y estado `pending`.
5. El panel docente ve la entrega, muestra el recálculo automático y la registra
   como enviada sin pedir aprobación manual.
6. Una entrega con la popularidad inflada a 999 aparece marcada como
   "REVISAR", muestra `informado 999` y el panel no usa ese número.
7. El registro de cierre muestra Enviado/Sin enviar y el motivo observable.
8. El docente puede eliminar un envío sin borrar el lineup del borrador.
9. El cierre muestra un resumen, pausa brevemente y recibe los últimos borradores.

## Bugs encontrados y corregidos durante la verificación

Cuatro bugs, y los dos más graves sólo aparecieron al ejecutar las pruebas
contra Firestore de verdad. Ninguna prueba en modo demo los habría detectado.

1. **Firestore rechazaba TODAS las entregas.** `validate()` devuelve los checks
   como tuplas `['Artistas', true, '6 / 6']`, y Firestore no admite arrays
   dentro de arrays: cada entrega fallaba con `invalid-argument`. En modo demo
   con `localStorage` funcionaba perfecto, así que el prototipo nunca lo mostró.
   Habría reventado en la primera entrega de la primera clase. Corregido con
   `serializeChecks()`, que aplana los checks a `{name, ok, value}`, y una
   prueba que recorre el documento de entrega completo buscando arrays anidados.

2. **Rutas con acentos rompían las pruebas de humo.** El ayudante que importa
   los módulos dentro de jsdom hacía `pathToFileURL(url.pathname)`: `.pathname`
   ya viene percent-encoded, así que `Admisión` terminaba como
   `Admisio%25CC%2581n` y Node no encontraba el archivo. Apareció sólo al
   ejecutarlo en `~/Desktop/UDD/Admisión/`. Corregido usando la URL directamente;
   verificado en una ruta con acentos y espacios.

1. **Editar un artista personalizado perdía la edición.** El mapper aplicaba
   `artistOverrides` sólo a los artistas base, y el panel docente los escribe
   también para los que él mismo crea. Corregido en `activity-mapper.js`, con
   prueba de regresión.
4. **Una actualización remota podía romper el panel.** La normalización de la
   sesión (`customArtists`, `activeArtistIds`, etc.) sólo ocurría al arrancar;
   una sesión llegada por snapshot o por otra pestaña dejaba el panel con
   campos indefinidos y `allArtists()` lanzaba. Corregido con
   `normalizeSession()` aplicada en ambos caminos.
5. **`TypeError` al escribir el indicador de sincronización.** `student.js`
   asumía que `#syncText` existía al vencer un temporizador. Corregido con un
   ayudante que verifica el elemento.

## Verificación del importador

```
code                   DEMO
nombre                 MusicFest Demo
modo                   sequential
estado                 active
revision               1
total                  81
activos                80
personalizados         1
eliminados             0
conCaratula            81
caratulasAprobadas     35
caratulasPorRevisar    46
eventos                20
```

Sin advertencias de integridad. Al ejecutarlo de verdad (sin `--dry-run`), el
script relee lo escrito y compara conteos de artistas, activos y carátulas antes
de dar la importación por buena.

## Verificación de la integración en mi-sitio

- Las 33 pruebas vuelven a pasar desde la nueva ubicación del módulo.
- Todas las rutas responden 200 sobre HTTP, incluidas las de La Odisea y
  MovieBlend, que no se tocaron.
- `firestore.rules` se comparó carácter por carácter con las reglas vivas del
  proyecto: las secciones de MovieBlend, La Odisea y `isOdysseyAdmin` están
  idénticas. Sólo se añaden 4.005 caracteres de MusicFest.
- Revisión estructural del archivo de reglas: llaves, paréntesis y corchetes
  balanceados, 38 sentencias `allow` bien terminadas, ninguna llamada a función
  sin definir.
- Estado previo respaldado en `firestore.rules.backup-2026-08-10`.

## Lo que sólo se puede comprobar en clase

1. Una pasada manual con dos navegadores contra los emuladores: docente en uno,
   equipo en otro, para confirmar la latencia y el comportamiento de los
   listeners en vivo.
2. `npm run covers:download` y comprobar que las tarjetas cargan las imágenes
   desde el propio sitio y no desde mzstatic.com.
3. Prueba de desconexión: cortar la red con un borrador a medio armar y
   comprobar que se reconcilia al volver.
