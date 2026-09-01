#!/usr/bin/env node
// MusicFest · baja las carátulas al repositorio y las sirve desde el sitio.
//
//   npm run covers:download -- --dry-run          informa, no descarga
//   npm run covers:download                       sólo las aprobadas
//   npm run covers:download -- --all              todas las que tengan URL
//   npm run covers:download -- --code DEMO        además actualiza Firestore
//   npm run covers:download -- --force            vuelve a bajar las existentes
//   npm run covers:download -- --only shakira      reemplaza sólo a ese artista
//   npm run covers:download -- --only shakira --url https://…   desde una URL a mano
//   npm run covers:download -- --only x --url … --no-normalize   sin normalizar al final
//
// Por qué existe: Cloud Storage for Firebase exige plan Blaze desde el 3 de
// febrero de 2026 y este proyecto está en Spark. Como el sitio ya se publica en
// GitHub Pages, las carátulas se guardan como archivos estáticos del repo: sale
// gratis, queda versionado, carga desde el mismo origen y deja de depender del
// CDN de Apple Music.
//
// Fuentes que consulta, en este orden:
//   1. Firestore, si se pasa --code y hay credenciales.
//   2. La exportación musicfest-*.json del módulo.
//   3. js/data/covers.generated.js y js/data/artists.js.
//
// Resultado:
//   assets/covers/{artistId}.{ext}   las imágenes
//   js/data/covers.local.js          mapa id -> ruta relativa, para el modo demo
//   Firestore (si --code)            artworkUrl reescrito a la ruta relativa

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { arg } from './firebase-admin-init.mjs';

const MODULE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const COVERS_DIR = join(MODULE_ROOT, 'assets', 'covers');
const RELATIVE = id => `assets/covers/${id}`;

const dryRun = Boolean(arg('dry-run'));
const todas = Boolean(arg('all'));
const force = Boolean(arg('force'));
const code = arg('code');

// --only reemplaza la carátula de artistas puntuales: ignora el estado de
// revisión, vuelve a bajar aunque el archivo ya exista, borra la copia
// anterior y deja el normalizador corriendo detrás. Es el camino para cambiar
// una carátula que ya está en el repositorio, donde el mapa local manda sobre
// cualquier elección hecha en el panel docente.
const only = arg('only');
if (only === true) {
  console.error('✗ --only necesita al menos un id: npm run covers:download -- --only shakira,tini');
  process.exit(1);
}
const soloIds = only ? String(only).split(',').map(x => x.trim()).filter(Boolean) : null;

// --url salta el panel docente por completo. Existe porque el mapa local pisa
// cualquier carátula elegida en el panel para un artista que ya tiene archivo
// en el repositorio: ahí la única vía es traer la imagen desde la línea de
// comandos. No necesita --code ni credenciales.
// En un lote conviene bajar todo y normalizar una sola vez al final: veinte
// tablas del normalizador seguidas esconden cualquier fallo.
const sinNormalizar = Boolean(arg('no-normalize'));
const urlManual = arg('url');
if (urlManual === true) {
  console.error('✗ --url necesita la dirección de la imagen.');
  process.exit(1);
}
if (urlManual && (!soloIds || soloIds.length !== 1)) {
  console.error('✗ --url va con exactamente un --only: npm run covers:download -- --only gorillaz --url https://…');
  process.exit(1);
}
if (urlManual && !/^https?:\/\//.test(String(urlManual))) {
  console.error(`✗ --url debe empezar con http:// o https://. Recibí: ${urlManual}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Reunir las carátulas a bajar
// ---------------------------------------------------------------------------

async function desdeFirestore(codigo) {
  const { admin, PATHS, normalizeCode } = await import('./firebase-admin-init.mjs');
  const { db } = await admin();
  const codeSnap = await db.collection(PATHS.codes).doc(normalizeCode(codigo)).get();
  if (!codeSnap.exists) {
    console.error(`✗ No existe ninguna actividad con el código ${codigo}.`);
    process.exit(1);
  }
  const activityId = codeSnap.data().activityId;
  const artists = await db.collection(PATHS.activities).doc(activityId).collection('artists').get();
  return {
    activityId,
    db,
    PATHS,
    items: artists.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
  };
}

async function desdeArchivos() {
  const exportado = readdirSync(MODULE_ROOT).find(n => /^musicfest-.*\.json$/.test(n));
  if (exportado) {
    const payload = JSON.parse(readFileSync(join(MODULE_ROOT, exportado), 'utf8'));
    const s = payload.session || {};
    const artwork = s.artwork || {};
    const info = s.releaseInfo || {};
    console.log(`Fuente: ${exportado}`);
    return Object.keys(artwork).map(id => ({
      id,
      artworkUrl: artwork[id],
      artworkStatus: info[id]?.review || 'pending'
    }));
  }
  const generated = await import('../js/data/covers.generated.js');
  console.log('Fuente: js/data/covers.generated.js');
  return Object.entries(generated.syncedArtwork).map(([id, url]) => ({
    id,
    artworkUrl: url,
    artworkStatus: generated.releaseInfo?.[id]?.review || 'pending'
  }));
}

const firestore = code ? await desdeFirestore(code) : null;
// Con --url la imagen viene dada: no hace falta consultar ninguna fuente.
const catalogo = firestore ? firestore.items : (urlManual ? [] : await desdeArchivos());

const candidatos = urlManual
  ? [{ ...(catalogo.find(a => a.id === soloIds[0]) || { id: soloIds[0] }), artworkUrl: String(urlManual), artworkStatus: 'approved' }]
  : catalogo.filter(a => {
  if (!a.artworkUrl) return false;
  if (!/^https?:\/\//.test(a.artworkUrl)) return false;   // ya es local
  if (soloIds) return soloIds.includes(a.id);
  return todas || a.artworkStatus === 'approved';
});

if (urlManual) {
  console.log(`\nReemplazo manual · ${soloIds[0]} ← ${urlManual}`);
} else if (soloIds) {
  console.log(`\n${catalogo.length} artistas · ${candidatos.length} de ${soloIds.length} por reemplazar.`);
  const sinUrl = soloIds.filter(id => !candidatos.some(a => a.id === id));
  if (sinUrl.length) {
    console.warn(`  ! Sin carátula nueva que bajar: ${sinUrl.join(', ')}`);
    console.warn('    Elige la carátula en el panel docente y guarda el artista antes de correr esto.');
  }
  if (!code) {
    console.warn('  ! Sin --code la fuente es un archivo local, que trae la carátula anterior y no la');
    console.warn('    que acabas de elegir en el panel. Usa --code CODIGO, o pasa la imagen con --url.');
  }
} else {
  console.log(`\n${catalogo.length} artistas · ${candidatos.length} carátulas ${todas ? '' : 'aprobadas '}por bajar.`);
  if (!todas) console.log('Usa --all para incluir también las que están por confirmar.');
}

// ---------------------------------------------------------------------------
// 2. Descargar
// ---------------------------------------------------------------------------

const extensionDe = (contentType = '', url = '') => {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  const m = String(url).match(/\.(jpe?g|png|webp)(\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
};

const yaDescargada = id => {
  if (!existsSync(COVERS_DIR)) return null;
  const encontrado = readdirSync(COVERS_DIR).find(n => n.replace(/\.[^.]+$/, '') === id);
  return encontrado ? RELATIVE(encontrado) : null;
};

// Un artista tiene exactamente un archivo. Si la carátula nueva llega en otro
// formato que la anterior (shakira.jpg donde había shakira.webp), quedarían
// dos archivos con el mismo id: el mapa apuntaría al que la lectura del
// directorio encuentre primero y el normalizador procesaría los dos.
const limpiarPrevias = (id, conservar) => {
  if (!existsSync(COVERS_DIR)) return;
  for (const nombre of readdirSync(COVERS_DIR)) {
    if (nombre !== conservar && nombre.replace(/\.[^.]+$/, '') === id) {
      unlinkSync(join(COVERS_DIR, nombre));
    }
  }
};

if (dryRun) {
  candidatos.forEach(a => console.log(`  · ${a.id}  ${yaDescargada(a.id) ? '(ya está)' : ''}`));
  console.log('\n--dry-run: no se descargó nada.');
  process.exit(0);
}

mkdirSync(COVERS_DIR, { recursive: true });

const rutas = {};
const fallos = [];
let bajadas = 0, reutilizadas = 0, bytes = 0;

for (const artista of candidatos) {
  const existente = yaDescargada(artista.id);
  if (existente && !force && !soloIds) {
    rutas[artista.id] = existente;
    reutilizadas++;
    continue;
  }
  try {
    const respuesta = await fetch(artista.artworkUrl);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const contentType = respuesta.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) throw new Error(`Content-Type inesperado: ${contentType}`);
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (buffer.length > 2 * 1024 * 1024) throw new Error(`Pesa ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);

    const archivo = `${artista.id}.${extensionDe(contentType, artista.artworkUrl)}`;
    writeFileSync(join(COVERS_DIR, archivo), buffer);
    limpiarPrevias(artista.id, archivo);       // recién ahora: si la descarga falla, la vieja sigue ahí
    rutas[artista.id] = RELATIVE(archivo);
    bajadas++;
    bytes += buffer.length;
    console.log(`  ✓ ${artista.id} → ${RELATIVE(archivo)}  (${Math.round(buffer.length / 1024)} KB)`);
  } catch (error) {
    fallos.push({ artista: artista.id, motivo: error.message });
    console.warn(`  ✗ ${artista.id}: ${error.message}`);
  }
}

// Conservar las que ya estaban aunque no fueran candidatas esta vez.
if (existsSync(COVERS_DIR)) {
  for (const archivo of readdirSync(COVERS_DIR)) {
    const id = archivo.replace(/\.[^.]+$/, '');
    if (!rutas[id]) rutas[id] = RELATIVE(archivo);
  }
}

// ---------------------------------------------------------------------------
// 3. Publicar el mapa para el modo demo
// ---------------------------------------------------------------------------

const ordenadas = Object.fromEntries(Object.entries(rutas).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(MODULE_ROOT, 'js', 'data', 'covers.local.js'),
`// Generado por scripts/download-covers.mjs · no editar a mano.
// Carátulas guardadas en el repositorio y servidas por GitHub Pages.
// Las rutas son relativas a modulos/musicfest/.
export const localArtwork = ${JSON.stringify(ordenadas, null, 2)};
`);

// ---------------------------------------------------------------------------
// 4. Actualizar Firestore, si corresponde
// ---------------------------------------------------------------------------

if (firestore) {
  let escritos = 0;
  const batch = firestore.db.batch();
  for (const artista of firestore.items) {
    const ruta = rutas[artista.id];
    if (!ruta || artista.artworkUrl === ruta) continue;
    batch.set(artista.ref, {
      artworkUrl: ruta,
      artworkPath: ruta,
      sourceUrl: artista.sourceUrl || artista.artworkUrl,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    escritos++;
  }
  if (escritos) await batch.commit();
  console.log(`\nFirestore: ${escritos} artistas ahora apuntan al repositorio.`);
}

// ---------------------------------------------------------------------------

const pesoTotal = existsSync(COVERS_DIR)
  ? readdirSync(COVERS_DIR).reduce((suma, n) => suma + statSync(join(COVERS_DIR, n)).size, 0)
  : 0;

console.log('');
console.table({
  descargadas: bajadas,
  yaEstaban: reutilizadas,
  conProblemas: fallos.length,
  totalEnRepositorio: Object.keys(ordenadas).length,
  pesoTotal: `${(pesoTotal / 1024 / 1024).toFixed(1)} MB`
});
if (fallos.length) console.table(fallos);
// Con --only el ciclo se cierra aquí mismo: bajar y normalizar son un solo
// gesto para quien vino a cambiar una carátula. En una descarga masiva se
// dejan separados, porque ahí conviene mirar el resultado en medio.
let encadenado = false;
if (soloIds && !fallos.length && bajadas && !sinNormalizar) {
  const { spawnSync } = await import('node:child_process');
  console.log('\nNormalizando lo recién bajado…');
  const resultado = spawnSync(process.execPath, [join(MODULE_ROOT, 'scripts', 'normalize-covers.mjs')], { stdio: 'inherit' });
  if (resultado.status !== 0) {
    console.warn('\n! El normalizador no terminó bien. Revísalo con: npm run covers:normalize');
    process.exit(1);
  }
  encadenado = true;
}

// El normalizador ya cerró con su propio mensaje: no lo repetimos.
if (fallos.length) {
  console.log('\nLas que fallaron conservan su URL externa. Puedes reintentar con --force.');
} else if (sinNormalizar) {
  console.log('\n✓ Bajada, sin normalizar. Cierra el lote con: npm run covers:normalize');
} else if (encadenado) {
  console.log('Y de assets/covers.normalized.json, que también cambió.');
} else {
  console.log('\n✓ Listo. Recuerda hacer commit de assets/covers/ y js/data/covers.local.js.');
}
process.exit(fallos.length ? 1 : 0);
