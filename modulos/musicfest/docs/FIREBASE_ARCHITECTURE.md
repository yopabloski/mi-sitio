# MusicFest · Arquitectura Firebase v2

Actualiza `TECHNICAL_ARCHITECTURE.md` con las decisiones tomadas al implementar.
Donde ambos documentos difieran, manda éste, y cada diferencia está justificada.

## 1. Restricción de partida: plan Spark, sin Cloud Functions

La decisión de mantener el proyecto en plan gratuito cambia dónde vive la
autoridad. Sin Admin SDK en el servidor, el reparto queda así:

| Operación | Dónde se resuelve | Garantía |
|---|---|---|
| Iniciar, pausar, cerrar | Transacción cliente + reglas | Sólo docente puede escribir la actividad |
| Avanzar / retroceder día | Transacción cliente + reglas | Idem, y la transacción evita carreras entre dos pestañas |
| Reabrir día | Transacción + copia de borradores por lote | La revisión anterior queda intacta |
| Auditar entrega | Recálculo automático en el panel | No requiere aprobación manual |
| Eliminar entrega | Lote docente: borra la entrega y conserva el borrador | Sólo docente puede borrar |
| Enviar lineup | Reglas verifican la **estructura**; el panel docente recalcula los **números** | Ver §5 |
| Ranking | Recalculado en el cliente docente desde `selections` | Los totales enviados nunca se usan |

Lo único que no puede hacerse con reglas es sumar costos y popularidad sobre un
arreglo. Ésa es la brecha, y §5 explica cómo se cierra.

## 2. El proyecto es compartido

`streamlab-b9122` ya aloja MovieBlend (`activities/`, `exports/`) y La Odisea
(`experiences/`). De ahí dos consecuencias que no aparecen en el documento
original:

- **Todas las colecciones de MusicFest llevan prefijo**: `musicfestActivities`,
  `musicfestCodes`, `musicfestAdmins`. Usar `activities/` habría chocado con
  MovieBlend.
- **`firestore.rules` es único por proyecto.** El archivo de la raíz del sitio
  incluye las secciones de los tres módulos. Desplegar reglas con sólo MusicFest
  borraría las de La Odisea. Se verificó contra producción el 10 de agosto de
  2026: las secciones existentes están idénticas.

## 3. Modelo de datos

```text
musicfestAdmins/{uid}
  email, grantedAt                        · padrón docente; sólo Admin SDK escribe

musicfestCodes/{codigo-normalizado}
  activityId, code, ownerUid, updatedAt   · índice público CÓDIGO -> actividad

musicfestActivities/{activityId}
  code, name, ownerUid
  mode: sequential | simultaneous
  state: lobby | active | paused | closed
  activeDayIndex, revision, reopenedFrom
  days[]                                  · reglas editables por día
  activeArtistIds[]                       · denormalizado: las reglas lo necesitan
  deletedArtistIds[], catalogLocked
  teamJoinPolicy: open | locked
  schemaVersion, createdAt, updatedAt

  artists/{artistId}
    name, genre, country, cost, popularity, duration
    base, order, active
    artworkUrl, artworkStoragePath, artworkStatus: none | pending | approved
    album, albumYear, sourceUrl, updatedAt

  teams/{teamId}                          · teamId = slug del nombre del equipo
    name, memberUids[], createdAt, lastSeenAt

    drafts/{revision}                     · un borrador por revisión
      teamName, selections{}, statuses{}, revision, clonedFrom, updatedBy, updatedAt

  submissions/{teamId__dayId__rN}
    teamId, teamName, dayId, dayIndex, revision
    selections[]                          · lo único autoritativo del estudiante
    reportedTotals, reportedChecks        · informados por el cliente, nunca confiables
    validationStatus: pending | validated | returned   · heredado; la interfaz ya no lo usa
    submittedBy, submittedAt, validatedBy, validatedAt

  events/{eventId}
    type, text, actorUid, payload, createdAt   · inmutable
```

### Diferencias con `TECHNICAL_ARCHITECTURE.md` y por qué

| Documento original | Implementado | Razón |
|---|---|---|
| `artistCatalog/{artistId}` global | `musicfestActivities/{id}/artists/{artistId}` | El docente cura el pool por actividad; un catálogo global obligaría a versionar cada edición y dejaría que un cambio afectara a un curso en marcha |
| `musicfestActivities` + `musicfestSessions` separados | Una sola colección | El prototipo no distingue plantilla de sesión y separarlas ahora habría duplicado el panel docente sin necesidad. El campo `schemaVersion` deja la puerta abierta |
| `drafts/{teamId}` con `revision` dentro | `teams/{teamId}/drafts/{revision}` | Con la revisión en la ruta, reabrir crea un documento nuevo y la revisión anterior queda intacta por construcción, no por disciplina |
| Custom claim `admin: true` | Documento en `musicfestAdmins/{uid}` | El claim requiere Admin SDK para cada alta; el documento se administra con `npm run admin:grant` o desde la consola, y sigue cumpliendo "no incrustar UID en el cliente" (La Odisea sí los incrusta) |
| Cloud Functions autoritativas | Transacciones + reglas + recálculo docente | Plan Spark. El código de transición está aislado en `remote-store.js`, de modo que moverlo a Functions más adelante no toca las vistas |

### Sobre `teamId = slug(nombre)`

Permite que un equipo recupere su borrador tras recargar o cambiar de
dispositivo, algo que un `teamId = uid` no permitiría con auth anónima. El
precio es que alguien podría escribir el nombre de otro equipo; por eso existe
`teamJoinPolicy`:

- `open` (por defecto): un segundo dispositivo puede sumarse al equipo. Cómodo
  cuando el equipo trabaja en dos notebooks.
- `locked`: sólo los UID ya registrados pueden escribir. Si un equipo se queda
  fuera, el docente lo libera desde el panel.

## 4. Capa de cliente

```text
modulos/musicfest/js/
  domain/
    game.js               · sin cambios; restricciones y totales
    submissions.js        · recálculo autoritativo, cierre, conflictos y ranking
    activity-mapper.js    · session ⇄ documentos Firestore (compartido con los scripts)
  services/
    firebase-config.js    · config, flag `enabled`, emuladores, rutas
    firebase.js           · SDK diferido desde CDN, auth estudiante/docente
    remote-store.js       · adaptador Firestore con espejo síncrono
    local-store.js        · sin cambios; modo demo
    store.js              · fachada: elige uno u otro
    admin-gate.js         · puerta de acceso docente
```

### El espejo síncrono

`connect()` suscribe `onSnapshot` a la actividad, los artistas, los eventos, los
equipos, los borradores y las entregas, y espera la primera emisión. Después,
`loadSession()`, `loadDraft()` y `listDrafts()` devuelven datos del espejo sin
`await`, y `saveSession()` / `saveDraft()` encolan escrituras con *debounce*
(250 ms y 400 ms). Ése es el truco que permitió no reescribir las vistas.

Las escrituras son diferenciales: `saveSession()` compara la sesión entrante con
el último snapshot compuesto y escribe únicamente el documento de actividad, los
artistas que cambiaron y los eventos nuevos. Guardar una regla de día no toca 81
documentos de artista.

## 5. La brecha del cálculo, y cómo se cierra

Un estudiante con la consola abierta puede enviar `reportedTotals.score = 999`.
Las reglas no pueden sumar, así que no lo detectan. Pero:

1. Las reglas **sí** verifican que `selections` tenga exactamente
   `days[dayIndex].artistCount` elementos, sin repetidos, todos dentro de
   `activeArtistIds`, en la revisión y el día vigentes, y con el equipo correcto.
   Es decir: **el lineup es real**.
2. El panel docente ignora `reportedTotals` y recalcula todo con
   `recomputeSubmission()`. Si hay diferencia, la tarjeta muestra un aviso
   "REVISAR". No hay un segundo paso de aprobación manual.
3. El ranking (`buildLeaderboard`) considera las entregas factibles de la
   revisión vigente y usa la popularidad recalculada.
4. `auditarCierre()` cruza entregas y borradores. La matriz docente usa sólo
   los estados principales **Enviado / Sin enviar**, y para estos últimos
   conserva el diagnóstico: sin actividad, incompleto, válido sin confirmar,
   falta de talento chileno u otras restricciones.

Resultado: falsificar los totales no da ninguna ventaja y además queda visible.
El campo `validationStatus` se conserva para leer cohortes antiguas y mantener
compatibilidad con las reglas desplegadas, pero el flujo actual no lo modifica.

Con Cloud Functions esto se cerraría de raíz: `submitLineup` calcularía y
escribiría los totales. El código está preparado para ese cambio —
`recomputeSubmission()` es puro y se puede ejecutar tal cual en una Function.

## 6. Conectividad

- Caché persistente multipestaña (`persistentLocalCache` +
  `persistentMultipleTabManager`): el borrador se sigue editando sin conexión y
  se reconcilia al volver.
- Las entregas y las transiciones requieren confirmación del servidor.
- Borrador y entrega se escriben en un mismo lote atómico. La interfaz no
  muestra "Lineup enviado" hasta que ese lote queda confirmado; si Firestore
  lo rechaza, el borrador vuelve a editable y ofrece reintentar.
- Al hidratar datos antiguos, un estado `submitted` sin documento de entrega
  se autocorrige a `editable`; esto recupera los falsos positivos anteriores.
- Las transiciones usan `runTransaction`, de modo que dos pestañas docentes
  abiertas no pueden dejar la sesión en estados distintos.

## 7. Carátulas, sin Storage

Cloud Storage for Firebase [exige plan Blaze desde el 3 de febrero de
2026](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
En Spark no hay bucket, ni siquiera el predeterminado. El módulo por tanto **no
carga el SDK de Storage** y `firebase.json` no lo declara.

Las carátulas viven en `modulos/musicfest/assets/covers/` y las sirve GitHub
Pages junto al resto del sitio. `scripts/download-covers.mjs` las baja desde
Apple Music, genera `js/data/covers.local.js` y, si se le pasa `--code`,
reescribe `artworkUrl` en Firestore a la ruta relativa.

Para este caso resulta mejor que Storage: gratis, versionado, mismo origen y sin
dependencia de terceros. El detalle está en `CARATULAS.md`.

En el documento de artista quedan dos campos relacionados:

- `artworkUrl` — lo que consume la interfaz. Puede ser una ruta relativa del
  repositorio o, mientras no se haya bajado, una URL del CDN de Apple.
- `sourceUrl` — la página del álbum en Apple Music, para poder rastrear el
  origen de la imagen.
