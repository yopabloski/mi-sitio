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

El único costo es el peso del repositorio: unos 5 MB para las 81 carátulas, o
2 MB si sólo bajas las aprobadas.

## Flujo de trabajo

1. **Buscar.** En el panel docente, escribe el nombre del artista y pulsa
   *Buscar últimos álbumes*. Consulta el catálogo público de Apple Music.
2. **Elegir y aprobar.** Selecciona la carátula, revisa la previsualización
   grande y guarda el artista. Queda marcada como aprobada, todavía apuntando
   al CDN de Apple.
3. **Bajarla al repositorio.**

```bash
cd modulos/musicfest
npm run covers:download -- --dry-run    # informa, no descarga
npm run covers:download                 # sólo las aprobadas
npm run covers:download -- --all        # también las que están por confirmar
```

4. **Commit.**

```bash
git add modulos/musicfest/assets/covers modulos/musicfest/js/data/covers.local.js
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
