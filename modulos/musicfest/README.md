# MusicFest · módulo

Aplicación sin compilación, servida como estático. Funciona en dos modos:

- **Firebase** (por defecto): Firestore, Storage y Authentication.
- **Demo local**: si falta la configuración, todo cae a `localStorage`.

La decisión la toma `js/services/store.js` al cargar. Ninguna vista sabe cuál
de los dos está activo.

## Probar

```bash
npm install
npm run serve      # http://localhost:5173
npm test           # dominio + humo de extremo a extremo
```

- `modulos/musicfest/` — estudiante.
- `modulos/musicfest/admin.html` — docente.

Use el código `DEMO`. Con emuladores, agregue `?emu=1` a la URL. En modo demo el
estado se comparte mediante `localStorage`, por lo que conviene abrir estudiante
y docente en pestañas diferentes del mismo navegador.

**Para ponerlo en marcha por primera vez, siga `docs/PUESTA_EN_MARCHA.md`.**

## Dónde vive cada cosa

El módulo es autocontenido, igual que La Odisea: su código, sus assets de marca,
sus carátulas, sus scripts, sus pruebas y su documentación viven aquí. La única
excepción es `firestore.rules`, en la raíz del sitio, porque es **único para
todo el proyecto Firebase** y cubre también MovieBlend y La Odisea.

El sitio se publica en GitHub Pages. Firebase se usa sólo como Firestore y
Authentication: no hay Storage ni Cloud Functions, y las carátulas se sirven
como archivos estáticos del repositorio.

## Incluido

- Catálogo de 80 artistas extraído de `MusicFest.xlsx`.
- Modos secuencial y simultáneo.
- Reglas diferentes para viernes, sábado y domingo.
- Autoguardado local por equipo.
- Envío y bloqueo de lineups válidos.
- Avance docente y reapertura retroactiva con revisión.
- Configuración docente del nombre, código de entrada y reglas de cada día.
- Bandeja de entregables con filtros por estado, detalle de artistas y resumen de todas las restricciones.
- Validación o devolución de cada entrega por parte del docente.
- Curaduría del pool: activar o retirar artistas y revisar el total por género.
- Alta de artistas personalizados con costo, popularidad, duración, género y nacionalidad.
- Edición de artistas existentes y eliminación protegida mediante confirmación.
- Búsqueda asistida de carátulas de álbumes y EP mediante el catálogo público de Apple Music/iTunes.
- Identidad visual con el logo vectorial definitivo.
- Tarjetas funcionales con la anatomía final del Design Book: carátula dominante, identidad, métricas, estado y selección explícita.
- Catálogo sincronizado con 70 carátulas encontradas, cuatro aprobadas y estados de revisión para el resto.
- Control docente para cerrar o reabrir el pool antes de iniciar la actividad.
- Filtros momentáneos para revisar todos, covers por confirmar, artistas sin cover y covers aprobados.
- Previsualización grande de la carátula antes de guardar, incluyendo álbum, año y detección de URL inválida.
- Borrador automático de formularios y sincronización entre pestañas para evitar pérdida de cambios al actualizar.
- Exportación de la actividad completa a JSON desde el panel docente.

## Revisión de carátulas

La primera sincronización está en `js/data/covers.generated.js`. Los resultados automáticos quedan pendientes hasta que el docente los confirme desde el editor. Diez artistas mantienen el fallback tipográfico porque no hubo una coincidencia suficientemente confiable. Apple Music/iTunes es la fuente automática principal; Amazon Music puede utilizarse como contraste manual en casos ambiguos.
- Carátulas oficiales de prueba para cuatro artistas.

## Capa Firebase

`js/services/local-store.js` **no** fue reemplazado: sigue siendo el modo demo.
Junto a él viven ahora:

| Archivo | Rol |
|---|---|
| `services/firebase-config.js` | Configuración, flag `enabled`, emuladores, rutas |
| `services/firebase.js` | Carga diferida del SDK desde CDN, auth estudiante y docente |
| `services/remote-store.js` | Adaptador Firestore con espejo síncrono y escrituras diferenciales |
| `services/store.js` | Fachada con la API de `local-store.js` |

| `services/admin-gate.js` | Puerta de acceso docente |
| `domain/submissions.js` | Recálculo autoritativo de entregas y ranking |
| `domain/activity-mapper.js` | Traducción `session ⇄ documentos`, compartida con los scripts |

Las operaciones autoritativas (iniciar, avanzar, reabrir, validar) se resuelven
con transacciones y reglas de Firestore, no con Cloud Functions. El porqué y sus
límites están en `docs/FIREBASE_ARCHITECTURE.md`.

## Documentación

| Documento | Para qué |
|---|---|
| `docs/PUESTA_EN_MARCHA.md` | Paso a paso desde cero hasta publicar |
| `docs/CARATULAS.md` | Cómo se gestionan las carátulas y por qué no van en Storage |
| `docs/FIREBASE_ARCHITECTURE.md` | Modelo de datos y decisiones |
| `docs/SECURITY_RULES.md` | Cada regla explicada y qué ataque evita |
| `docs/TEST_RESULTS.md` | Qué se probó y qué falta |
| `docs/DECISIONES_PENDIENTES.md` | Lo que necesita respuesta antes de producción |
