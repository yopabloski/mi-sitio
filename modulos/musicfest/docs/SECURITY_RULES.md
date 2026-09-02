# MusicFest · Reglas de seguridad explicadas

Un solo archivo, **único por proyecto**: `firestore.rules`, que incluye
MovieBlend, La Odisea y MusicFest.

No hay `storage.rules` porque el proyecto no usa Cloud Storage: exige plan Blaze
desde febrero de 2026 y las carátulas se sirven como archivos estáticos del
sitio. Ver `CARATULAS.md`.

> Antes de desplegar reglas, comprueba que las secciones de MovieBlend y La
> Odisea siguen tal cual. Desplegar un archivo con sólo MusicFest deja a los
> otros dos módulos sin acceso.

## Quién es quién

```javascript
function isMusicFestAdmin() {
  return request.auth != null
    && exists(/databases/$(database)/documents/musicfestAdmins/$(request.auth.uid));
}
```

El padrón vive en Firestore. Nadie puede escribirlo desde el navegador
(`allow write: if false`): sólo el Admin SDK (`npm run admin:grant`) o la
consola. Un docente puede leer su propio documento para saber si está
autorizado, pero no puede listar el padrón completo salvo que ya sea docente.

Diferencia deliberada con La Odisea, que compara contra un UID incrustado en el
cliente: eso obliga a editar y redesplegar reglas y código cada vez que se suma
un profesor, y expone la lista.

## Actividad: pública para leer, docente para escribir

```javascript
allow get: if true;                    // el estudiante necesita reglas y estado antes de autenticarse
allow list: if isMusicFestAdmin();     // recorrer todas las actividades es cosa del docente
allow update: if isMusicFestAdmin();
```

Con esto, un estudiante **no puede**: cambiar `state`, `revision`,
`activeDayIndex`, `days` ni `activeArtistIds`. La subcolección `artists` sigue
la misma lógica: lectura abierta, escritura docente.

No hay datos personales en la actividad, así que la lectura pública no expone
nada; a cambio, evita un `signInAnonymously` antes de mostrar el lobby.

## Equipos: quien lo crea, lo reclama

```javascript
allow create: if signedIn()
  && request.resource.data.memberUids.hasOnly([request.auth.uid])
  && request.resource.data.memberUids.size() == 1
  && activity().state != 'closed';
```

Un equipo nace con un único dueño: su creador. Después:

- **Miembro existente**: puede actualizar presencia, pero `memberUids` y `name`
  deben quedar idénticos. No puede expulsar a nadie ni renombrar el equipo.
- **Dispositivo nuevo**: sólo si `teamJoinPolicy == 'open'`, y sólo puede
  *añadirse* (`memberUids == resource.data.memberUids.concat([uid])`). No puede
  reemplazar la lista.
- **Docente**: puede todo, incluido liberar un equipo dejando `memberUids: []`.

## Borradores: uno por equipo y por revisión

```javascript
match /drafts/{revision} {
  allow read: if isMusicFestAdmin() || isTeamMember(teamId);
  allow create, update: if isMusicFestAdmin()
    || (isTeamMember(teamId)
        && activityRunning()
        && request.resource.data.revision == activity().revision
        && revision == string(activity().revision));
}
```

Tres cosas al mismo tiempo:

1. Un equipo no lee ni escribe el borrador de otro.
2. Con la actividad en `lobby` o `closed`, nadie edita. En `paused` sí, a
   propósito: pausar detiene el reloj, no el trabajo del equipo.
3. El id del documento **debe** ser la revisión vigente. Un estudiante no puede
   adelantarse creando `drafts/7`, ni seguir escribiendo en la revisión vieja
   después de una reapertura. Como el docente escribe la revisión nueva al
   reabrir, el historial queda intacto.

## Entregas: estructura verificada, veredicto ajeno

Al crear, las reglas comprueban:

| Comprobación | Qué impide |
|---|---|
| `isTeamMember(teamId)` y `submittedBy == request.auth.uid` | Entregar por otro equipo o firmar como otro |
| `activity().state == 'active'` | Entregar antes de empezar o después de cerrar |
| `revision == activity().revision` | Entregar en una revisión vencida |
| `dayId == activity().days[dayIndex].id` | Desalinear día e índice |
| Modo secuencial ⇒ `dayIndex == activeDayIndex` | Adelantarse al sábado el viernes |
| `selections.size() == days[dayIndex].artistCount` | Entregar de menos o de más |
| `selections.toSet().size() == selections.size()` | Repetir un artista |
| `selections.toSet().difference(activeArtistIds.toSet()).size() == 0` | Inventar artistas o usar artistas retirados del pool |
| `validationStatus == 'pending'`, `validatedAt == null`, `validatedBy == null` | Autovalidarse |

Al actualizar, sólo el docente, y aun así `selections`, `teamId`, `dayId`,
`revision` y `submittedAt` deben quedar idénticos. Esa posibilidad se conserva
para cohortes antiguas; la interfaz actual no pide validación manual. El docente
sí puede eliminar el documento completo desde el panel; el borrador y sus
selecciones se conservan y el día vuelve a estado editable.

**Lo que las reglas no pueden hacer** es sumar. `cost`, `duration` y `score`
llegan como `reportedTotals` y se tratan como declaración del estudiante, no
como dato. Ver §5 de `FIREBASE_ARCHITECTURE.md`.

### Lectura de entregas

Está abierta (`allow read: if true`) porque el Design Book pide que los equipos
comparen su solución con las demás. Si en algún curso no quieres esa
transparencia, el archivo trae comentada la variante restringida.

## Bitácora

```javascript
allow read: if isMusicFestAdmin();
allow create: if isMusicFestAdmin() && request.resource.data.actorUid == request.auth.uid;
allow update, delete: if false;
```

Un evento no se edita ni se borra, y el actor no se puede falsificar. La
bitácora sirve para explicar después qué pasó en clase.

## Costo de las reglas

Firestore limita a 10 accesos a documentos por evaluación. La regla más cara es
crear una entrega: `activity()`, el documento del equipo y `musicfestAdmins`.
Los resultados de `get()` y `exists()` se cachean dentro de una misma
evaluación, así que llamar a `activity()` diez veces cuenta una sola.

## Cómo verificarlas

```bash
npm run test:rules      # necesita Java 21+ para los emuladores
```

`tests/rules/firestore-rules.test.mjs` cubre 39 escenarios, incluidos los
intentos de manipulación: cambiar reglas siendo estudiante, entregar por otro
equipo, autovalidarse, repetir artistas, usar artistas fuera del pool, entregar
en una revisión vencida y editar o borrar una entrega ya enviada. También prueba
explícitamente que el docente sí pueda eliminarla.
Dos escenarios verifican además la atomicidad: una entrega aceptada confirma
el borrador en el mismo lote, y una entrega rechazada no deja un falso estado
`submitted`.
