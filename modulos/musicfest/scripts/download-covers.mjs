#!/usr/bin/env node
// MusicFest · baja las carátulas al repositorio y las sirve desde el sitio.
//
//   npm run covers:download -- --dry-run          informa, no descarga
//   npm run covers:download                       sólo las aprobadas
//   npm run covers:download -- --all              todas las que tengan URL
//   npm run covers:download -- --code DEMO        además actualiza Firestore
//   npm run covers:download -- --force            vuelve a bajar las existentes
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

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
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
const catalogo = firestore ? firestore.items : await desdeArchivos();

const candidatos = catalogo.filter(a => {
  if (!a.artworkUrl) return false;
  if (!/^https?:\/\//.test(a.artworkUrl)) return false;   // ya es local
  return todas || a.artworkStatus === 'approved';
});

console.log(`\n${catalogo.length} artistas · ${candidatos.length} carátulas ${todas ? '' : 'aprobadas '}por bajar.`);
if (!todas) console.log('Usa --all para incluir también las que están por confirmar.');

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
  if (existente && !force) {
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
console.log(fallos.length
  ? '\nLas que fallaron conservan su URL externa. Puedes reintentar con --force.'
  : '\n✓ Listo. Recuerda hacer commit de assets/covers/ y js/data/covers.local.js.');
process.exit(fallos.length ? 1 : 0);
