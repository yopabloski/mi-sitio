# MusicFest · Plan de migración a Firebase

## Idea en una línea

El prototipo no se reescribe: se le cambia el suelo. `local-store.js` sigue
existiendo y una fachada decide, al cargar, si la sesión vive en `localStorage`
o en Firestore. La experiencia, el Design Book y el dominio quedan intactos.

## Por qué así

El prototipo ya estaba probado en aula. Reemplazar la lógica de dominio por una
versión "Firebase-native" habría significado volver a validar reglas, estados y
reaperturas desde cero. En cambio:

1. `js/domain/game.js` no cambió ni una línea.
2. `js/services/local-store.js` no cambió ni una línea.
3. `student.js` cambió en 4 lugares; `admin.js`, en 6.
4. Todo lo nuevo vive en `js/services/` y `js/domain/submissions.js`.

Es el mismo patrón de La Odisea (`firebase.js` exporta un `store` con dos
implementaciones y un flag `enabled`), llevado un paso más allá: allá la API es
asíncrona de punta a punta; acá la fachada mantiene un espejo síncrono en
memoria para no tener que reescribir las vistas.

## Etapas

| # | Etapa | Estado |
|---|---|---|
| 1 | Lectura del prototipo y de La Odisea | Hecho |
| 2 | Modelo de datos y colecciones con prefijo `musicfest*` | Hecho |
| 3 | Capa de servicios (`firebase.js`, `remote-store.js`, `store.js`) | Hecho |
| 4 | Mapper `session ⇄ documentos` compartido por app y scripts | Hecho |
| 5 | Reglas de Firestore y Storage fusionadas con las existentes | Hecho |
| 6 | Adaptación de `student.js` y `admin.js` | Hecho |
| 7 | Carátulas en el repositorio, servidas por GitHub Pages | Hecho |
| 8 | Scripts: importar actividad, migrar covers, autorizar docentes | Hecho |
| 9 | Pruebas de dominio y de migración (27, en verde) | Hecho |
| 10 | Pruebas de reglas e integración con emuladores | Escritas · pendientes de ejecutar |
| 11 | Primer despliegue | Pendiente de decisiones |

## Orden recomendado para ponerlo en marcha

```bash
npm install
cp .env.example .env            # completar

# 1. Todo en local, sin tocar producción
npm run emulators                # emuladores
USE_FIREBASE_EMULATORS=1 npm run import:activity -- --file musicfest-demo-2026-08-10.json
npm run serve                    # otra terminal
# abrir http://localhost:5173/modulos/musicfest/admin.html?emu=1

# 2. Pruebas
npm run test:domain
npm run test:rules
npm run test:integration

# 3. Producción, cuando las decisiones estén tomadas
npm run admin:grant -- --email pablogonzalez@udd.cl
npm run import:activity -- --file musicfest-demo-2026-08-10.json
npm run covers:download -- --code DEMO
npm run deploy:rules
```

## Qué se conserva y cómo se verifica

| Riesgo | Mitigación | Prueba |
|---|---|---|
| Perder artistas editados | El mapper aplica `artistOverrides` a base **y** personalizados | `migration.test.mjs` |
| Perder artistas personalizados | Se guardan con `base: false` y orden 1000+ | `migration.test.mjs` |
| Resucitar artistas eliminados | `deletedArtistIds` se respeta en el mapeo y las semillas no se remezclan en modo Firebase | `migration.test.mjs` |
| Perder carátulas o su estado | `artworkUrl` + `artworkStatus` viajan por artista | `migration.test.mjs` |
| Perder el estado activo/inactivo | `active` por artista y `activeArtistIds` denormalizado en la actividad | `migration.test.mjs` |
| Destruir entregas al reabrir | Cada revisión tiene su propio borrador y sus propias entregas | `activity-flow.test.mjs` |
| Escrituras infinitas por diferencias de formato | El viaje de ida y vuelta debe ser estable | `migration.test.mjs` |

## Rollback

El prototipo local sigue funcionando. Basta con vaciar `apiKey` en
`js/services/firebase-config.js` (o servir el módulo con
`window.__MUSICFEST_FIREBASE__ = {}`) y todo vuelve a `localStorage`, con los
mismos archivos y sin desinstalar nada.

La guía paso a paso para ponerlo en marcha está en `PUESTA_EN_MARCHA.md`.
