# MusicFest · carátulas

## Por qué no están en Firebase Storage

Firebase cambió las reglas: [desde el 3 de febrero de 2026, Cloud Storage exige
plan Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024).
En plan Spark no hay bucket disponible —ni siquiera el predeterminado— y las
llamadas devuelven 402 o 403.

Como el sitio ya se publica en GitHub Pages, la solución natural es guardar las
carátulas en el propio repositorio. Sale mejor que Storage en todo lo que
importa aquí:

| | Storage (Blaze) | Repositorio (GitHub Pages) |
|---|---|---|
| Costo | Requiere tarjeta | Gratis |
| Origen | Distinto al del sitio | El mismo: carga antes |
| Historial | Ninguno | Versionado en git |
| Recuperación ante error | Restaurar a mano | `git checkout` |
| Dependencia externa | Google Cloud | Ninguna |

El único costo es el peso del repositorio, y `npm run covers:normalize` lo deja
en alrededor de un tercio: las carátulas de Apple vienen sin optimizar y a
tamaños dispares.

## Flujo de trabajo

1. **Buscar.** En el panel docente, escribe el nombre del artista y pulsa
   *Buscar últimos álbumes*. Consulta el catálogo público de Apple Music.
2. **Elegir y aprobar.** Selecciona la carátula, revisa la previsualización
   grande y guarda el artista. Queda marcada como aprobada, todavía apuntando
   al CDN de Apple.
3. **Bajarla al repositorio.**

```bash
cd modulos/musicfest
npm run covers:download -- --dry-run          # informa, no descarga
npm run covers:download                       # sólo las aprobadas
npm run covers:download -- --all              # también las que están por confirmar
npm run covers:download -- --only shakira     # reemplaza sólo a ese artista
```

4. **Normalizarla.** Apple entrega tamaños y formatos dispares. Este paso las
   deja todas en WebP de 600×600, que es lo que la interfaz realmente necesita.

```bash
npm run covers:normalize -- --dry-run   # informa, no escribe
npm run covers:normalize                # sólo las que hagan falta
npm run covers:normalize -- --force     # reprocesa todas
```

5. **Commit.**

```bash
git add modulos/musicfest/assets/covers \
        modulos/musicfest/assets/covers.normalized.json \
        modulos/musicfest/js/data/covers.local.js
git commit -m "Bajar carátulas de MusicFest al repositorio"
```

## Qué hace el script

- Lee las carátulas desde Firestore (con `--code DEMO`), o desde la exportación
  `musicfest-*.json`, o desde `js/data/covers.generated.js`, en ese orden.
- Descarga cada imagen a `assets/covers/{artistId}.{ext}`, saltándose las que ya
  están (`--force` las vuelve a bajar).
- Genera `js/data/covers.local.js` con el mapa `id → ruta relativa`.
- Con `--code`, reescribe `artworkUrl` en Firestore a la ruta relativa y guarda
  la URL original en `sourceUrl`, por si hiciera falta rastrear la fuente.
- Las que fallen conservan su URL externa: nada se rompe, sólo sigue dependiendo
  del CDN.

## Revisar y cambiar varias: la planilla

Es la vía preferida cuando hay que mirar el catálogo completo o cambiar más de
una o dos carátulas. Ver 81 portadas juntas es lo que hace posible la decisión
curatorial —si la imagen representa al artista o es sólo la tapa de un disco
cualquiera—, y eso no se puede hacer artista por artista en el panel.

El ciclo:

1. Se genera una planilla con una fila por artista: la carátula actual
   incrustada en la celda, el álbum del que salió con enlace a su ficha, el
   estado de revisión, el peso, el tamaño de origen, y dos columnas vacías para
   la URL nueva y las notas.
2. Se llena la columna **URL nueva** sólo en las que se quieren cambiar. El
   resto se deja en blanco.
3. Se aplican los reemplazos con `--only ARTISTA --url DIRECCION`, uno por fila
   con URL, y se cierra con un `npm run covers:normalize`.

Para un lote conviene `--no-normalize` en cada descarga y normalizar una sola
vez al final: veinte tablas del normalizador seguidas esconden cualquier fallo.

Qué mirar al terminar: que `git status` liste exactamente tantas carátulas
modificadas como filas llenaste, y que las dimensiones de origen sean cuadradas.
Las que no lo sean se recortan al centro y merecen una mirada en el pool.

La planilla es un documento de trabajo, no infraestructura: no vive en el
repositorio.

## Cambiar una carátula que ya está en el repositorio

Este es el caso que confunde, así que conviene tenerlo escrito. Una vez que la
carátula está en `assets/covers/`, el mapa local gana sobre cualquier elección
del panel docente: `admin.js` aplica `localArtwork` al final y pisa lo demás.
Elegir otra portada en el panel no cambia nada hasta que la bajes.

No basta con guardar desde el panel, y conviene entender por qué. `admin.js`
termina con `watchSession(code, next => { session = normalizeSession(next) })`:
al guardar, la sesión se escribe, el watcher se dispara con lo recién guardado
y `normalizeSession` vuelve a aplicar `localArtwork` encima. La elección se
revierte en el acto y no sobrevive en ninguna parte. Para un artista que ya
tiene archivo en el repositorio, el campo de URL del panel no funciona.

La vía que sí funciona es la línea de comandos, con la dirección de la imagen:

```bash
npm run covers:download -- --only gorillaz --url https://…
```

Baja esa imagen, borra la copia anterior, la normaliza y regenera el mapa. No
necesita `--code` ni credenciales, y sirve para cualquier dirección: Amazon,
Wikipedia, lo que sea, mientras devuelva una imagen.

Para un artista que **no** tiene archivo en el repositorio —uno personalizado,
recién agregado— el panel sí sirve: eliges ahí y después bajas lo aprobado.

```bash
npm run covers:download -- --code CODIGO --only artista-nuevo
```

`--only` ignora el estado de revisión, vuelve a bajar aunque el archivo ya
exista, borra la copia anterior y deja el normalizador corriendo detrás. Acepta
varios ids separados por coma. Después queda el commit de siempre.

Para un lote, `--no-normalize` evita que el normalizador corra en cada vuelta:
bajas todo y cierras con un solo `npm run covers:normalize`. Veinte tablas
seguidas esconden cualquier fallo.

Si la descarga falla, la carátula anterior se conserva. El archivo viejo sólo
se borra después de que la nueva llegó entera.

## Lo que el panel muestra

El resumen del catálogo distingue tres cosas:

- **EN EL REPO** — carátulas servidas desde `assets/covers/`. Son las
  definitivas y las únicas que permiten exportar el cartel a PNG.
- **POR BAJAR** — el docente eligió una carátula que todavía vive en un CDN
  ajeno. Mientras esté así, el botón de descargar el cartel falla para cualquier
  lineup que la incluya.
- **POR REVISAR** — carátulas sin confirmar por el docente. Es la revisión de
  contenido, independiente de dónde se sirva la imagen.

Los filtros del catálogo siguen la misma división, y la fila del artista se
marca como `POR BAJAR` cuando corresponde.

Una advertencia sobre `POR BAJAR`: sólo detecta artistas que no tienen archivo
en el repositorio. Si eliges una carátula nueva para un artista que ya lo tiene,
el contador la muestra hasta que recargues la página, y después vuelve a cero
aunque el cambio siga pendiente. Es consecuencia directa de que `localArtwork`
pise la elección al normalizar la sesión. El aviso del editor cubre ese caso:
al abrir un artista servido desde el repositorio, el panel dice el comando
exacto que hay que correr.

## Qué hace normalize-covers

- Reduce cada carátula a 600×600 y la convierte a WebP q80. Las que ya son más
  chicas se dejan como están: agrandarlas no inventa detalle, sólo peso.
- Borra el archivo original cuando cambia la extensión. El historial de git lo
  conserva, así que no hace falta guardar una copia aparte.
- Regenera `js/data/covers.local.js`, igual que `download-covers.mjs`.
- Anota el hash de cada archivo en `assets/covers.normalized.json`. Volver a
  correrlo no reprocesa nada ni deja diff: es idempotente.
- Las que fallen se quedan como estaban y salen listadas al final.

Por qué 600 px y no más: la tarjeta del pool es una grilla de mínimo 220 px
(`.artist-cover`, `aspect-ratio: 1`), la previsualización del panel docente
llega a 240 px y la tira del cartel dibuja a 96 px con `scale: 2`, o sea 192 px
reales. Con pantallas retina, 600 cubre todo con margen; 800 sería peso puro.

El manifiesto vive fuera de `assets/covers/` a propósito: `download-covers.mjs`
recorre ese directorio entero para armar el mapa, y cualquier archivo extra ahí
adentro terminaría como una entrada falsa en `covers.local.js`.

## La semilla también apunta al repositorio

`js/data/covers.generated.js` guarda la primera sincronización con Apple Music.
Sus URLs quedaron obsoletas en cuanto las carátulas bajaron al repositorio
—`localArtwork` las pisa en toda la cadena— pero seguían haciendo daño:
`remote-store.js` las usa para sembrar `artworkUrl` al crear una actividad
nueva, que nacía apuntando a un CDN ajeno.

```bash
npm run covers:localize -- --dry-run
npm run covers:localize
```

Reemplaza cada URL de `syncedArtwork` por la ruta local del mismo artista. No
toca `releaseInfo` —álbum, año, estado de revisión y el enlace a la ficha del
disco son metadatos que el panel muestra— ni borra nada. Es idempotente: los
artistas sin archivo en el repositorio conservan su URL, que es lo único para
lo que todavía sirve.

## Una trampa con --force

`download-covers.mjs` sin `--code` lee la exportación `musicfest-*.json` del
módulo, que es una foto de un momento. Sus URLs no saben nada de las carátulas
elegidas después, así que un `--force` distraído reemplaza trabajo de curaduría
por lo que había hace meses. El script avisa antes de hacerlo, pero conviene
saberlo: para traer lo que elegiste en el panel va `--code`, y para una carátula
concreta, `--only ARTISTA --url DIRECCION`.

## Cómo las resuelve la aplicación

`js/data/covers.local.js` tiene prioridad sobre cualquier otra fuente:

```
covers.local.js  →  session.artwork  →  artists.js  →  covers.generated.js
```

Una vez que una carátula está en el repositorio, se sirve desde ahí siempre, sin
importar lo que diga Firestore. Es deliberado: la copia local es la definitiva.

Consecuencia a tener en cuenta: si borras la carátula de un artista desde el
panel pero el archivo sigue en `assets/covers/`, volverá a aparecer. Para
retirarla de verdad hay que borrar también el archivo y regenerar el mapa.

## Derechos de uso

Son carátulas de álbumes obtenidas del catálogo público de Apple Music, usadas
con fines docentes para identificar visualmente a cada artista dentro de una
actividad de aula. No se redistribuyen como producto ni se usan con fines
comerciales. Si el módulo saliera alguna vez del contexto universitario, este
punto habría que revisarlo con calma.
