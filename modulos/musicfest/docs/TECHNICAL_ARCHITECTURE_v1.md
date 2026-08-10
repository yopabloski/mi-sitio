# MusicFest · Arquitectura técnica v1

## 1. Objetivo

Integrar MusicFest como un módulo independiente de Streamlab, siguiendo el patrón de La Odisea: aplicación web estática, JavaScript modular, Firebase Hosting, autenticación y Firestore en tiempo real. La arquitectura debe soportar modo secuencial, modo simultáneo, reapertura retroactiva, historial y validación autoritativa.

## 2. Componentes

### Cliente

- HTML, CSS y JavaScript ES Modules, sin compilación obligatoria.
- `index.html`: experiencia de estudiante.
- `admin.html`: configuración y control docente.
- Librería de dominio compartida para restricciones, totales y score.
- Web Worker para calcular el óptimo sin bloquear la interfaz.
- Modo demo local cuando Firebase no está configurado.

### Firebase

- Authentication anónima para estudiantes.
- Google Authentication para docentes.
- Custom claim `admin: true`; no utilizar una lista de UID embebida en el cliente.
- Firestore para sesiones, equipos, borradores, entregas y eventos.
- Cloud Functions para operaciones autoritativas.
- Firebase Hosting para servir el módulo.

## 3. Modelo de datos

```text
artistCatalog/{artistId}
  name, type, genre, country
  cost, popularity, durationHours
  albumTitle, albumYear, artworkUrl, artworkSourceUrl
  active, updatedAt

musicfestActivities/{activityId}
  ownerUid, name, course
  status: draft | published | archived
  currentVersion, updatedAt
  versions/{versionId}
    mode, days[], artistIds[], scoring, settings

musicfestSessions/{sessionId}
  code, activityId, activityVersion
  configSnapshot
  mode: sequential | simultaneous
  state: lobby | active | paused | closed
  activeDayIndex, revision
  startsAt, deadlineAt, updatedAt

  teams/{teamId}
    uid, name, joinedAt, lastSeenAt, status

  drafts/{teamId}
    selectionsByDay
    dayStatusById
    revision, syncState, updatedAt

  submissions/{submissionId}
    teamId, dayId, selections
    totals, constraintResults, score
    revision, status, submittedAt

  events/{eventId}
    type, actorUid, fromState, toState
    dayIndex, revision, affectedDays, createdAt
```

La sesión conserva un `configSnapshot`; por lo tanto, una actividad publicada no cambia cuando el docente modifica el borrador original.

## 4. Operaciones autoritativas

| Operación | Responsabilidad |
|---|---|
| `publishSession` | Validar configuración, congelar snapshot y generar código único |
| `joinSession` | Verificar código, estado y vincular UID anónimo con equipo |
| `submitLineup` | Recalcular totales, restricciones y score; crear entrega inmutable |
| `transitionSession` | Iniciar, pausar, reanudar, avanzar o cerrar |
| `reopenDay` | Incrementar revisión y aplicar reapertura en cascada |
| `buildLeaderboard` | Considerar únicamente entregas válidas de la revisión vigente |
| `exportResults` | Producir una exportación consistente y auditable |

El autoguardado del borrador puede escribir directamente en Firestore bajo reglas estrictas. El navegador no puede decidir que una entrega es válida ni escribir su score definitivo.

## 5. Máquinas de estado

### Sesión

```text
lobby → active ↔ paused → closed
```

El docente es el único actor que cambia el estado global.

### Día por equipo

```text
editable → submitted → closed
    ↑                      |
    └── needs_revalidation┘
```

`timed_out` congela temporalmente el borrador. El docente puede aceptarlo para revisión o devolverlo a `editable`; no se envía automáticamente.

## 6. Avance y reapertura secuencial

Al avanzar de día:

1. Se cierran las entregas vigentes del día.
2. Se actualiza `activeDayIndex` mediante transacción.
3. Se recalcula el pool disponible de cada equipo desde sus entregas válidas.
4. Se publica el nuevo `deadlineAt`.

Al reabrir un día anterior:

1. La función incrementa `session.revision`.
2. El día elegido y los posteriores vuelven a `editable` o `needs_revalidation`.
3. Los lineups se conservan en los borradores.
4. Las entregas anteriores permanecen inmutables, pero ya no participan en el ranking.
5. Se recalculan disponibilidad y restricciones.
6. Se registra un evento con actor, motivo y días afectados.

## 7. Seguridad

- Un estudiante solo puede leer sesiones publicadas a las que ingresó.
- Cada UID anónimo solo puede modificar el borrador de su propio equipo.
- Un estudiante nunca puede escribir `score`, `constraintResults`, `revision` global ni estados de sesión.
- Solo docentes con custom claim administran actividades y sesiones.
- Cloud Functions usa Admin SDK y valida de nuevo cada operación.
- App Check es recomendable antes de publicar el módulo fuera del entorno de clases.

## 8. Consistencia y conectividad

- Firestore mantiene listeners en tiempo real para sesión, equipo y ranking.
- El cliente muestra `guardando`, `sincronizado` o `sin conexión`.
- Los borradores utilizan escritura optimista y persistencia local.
- Una entrega requiere confirmación del servidor antes de bloquear la interfaz.
- Las operaciones de avance y reapertura utilizan transacciones e idempotency keys.

## 9. Estructura propuesta

```text
/modulos/musicfest/
  index.html
  admin.html
  assets/
  css/
    tokens.css
    components.css
    student.css
    admin.css
  js/
    app/
    domain/
      constraints.js
      scoring.js
      state-machine.js
    services/
      firebase.js
      local-store.js
      export.js
    data/
      seed-artists.js
  workers/
    optimal-worker.js
  functions/
  firestore.rules
  README.md
```

## 10. Orden de implementación

1. Dominio puro: datos, restricciones, score y estados.
2. Modo demo local completo.
3. Interfaz estudiante simultánea.
4. Interfaz estudiante secuencial.
5. Panel docente y control de sesión.
6. Firebase Auth, Firestore y reglas.
7. Cloud Functions autoritativas.
8. Solver óptimo, ranking y exportación.
9. Pruebas de reapertura, concurrencia y desconexión.
