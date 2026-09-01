#!/usr/bin/env node
// MusicFest · apunta las carátulas semilla al repositorio.
//
//   npm run covers:localize -- --dry-run    informa, no escribe
//   npm run covers:localize                 reescribe covers.generated.js
//
// Qué arregla. `js/data/covers.generated.js` guarda la primera sincronización
// con Apple Music: un mapa `syncedArtwork` de id a URL del CDN. Desde que las
// carátulas viven en el repositorio, esas URLs son letra muerta —`localArtwork`
// pisa a `syncedArtwork` en toda la cadena de resolución— pero siguen ahí y
// hacen daño de dos maneras:
//
//   1. `download-covers.mjs` sin `--code` lee este archivo como fuente. Sus
//      URLs viejas parecen carátulas por bajar cuando ya no lo son.
//   2. `remote-store.js` las usa para sembrar `artworkUrl` al crear una
//      actividad nueva en Firestore, que nace apuntando a un CDN ajeno. Basta
//      con que Apple mueva una imagen para que esa actividad quede coja.
//
// Qué hace. Reemplaza cada URL de `syncedArtwork` por la ruta local del mismo
// artista, tomada de `covers.local.js`. No borra el archivo ni toca
// `releaseInfo` —el álbum, el año, el estado de revisión y el enlace a la ficha
// de Apple son metadatos legítimos que el panel docente muestra— ni
// `unresolvedArtists`.
//
// Los artistas sin archivo en el repositorio conservan su URL: son los únicos
// para los que todavía significa algo.
//
// Idempotente: correrlo dos veces no cambia nada, porque una ruta local ya no
// coincide con el patrón que busca.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const MODULE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const GENERADO = join(MODULE_ROOT, 'js', 'data', 'covers.generated.js');
const COVERS_DIR = join(MODULE_ROOT, 'assets', 'covers');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : true;
}

const dryRun = Boolean(arg('dry-run'));

if (!existsSync(GENERADO)) {
  console.error(`✗ No existe ${GENERADO}.`);
  process.exit(1);
}

const { localArtwork } = await import('../js/data/covers.local.js');
const original = readFileSync(GENERADO, 'utf8');

// Sólo se toca el bloque de syncedArtwork: releaseInfo trae enlaces a fichas de
// álbum de Apple Music, que no son imágenes y sí sirven.
const bloque = original.match(/export const syncedArtwork\s*=\s*\{[\s\S]*?\n\};?/);
if (!bloque) {
  console.error('✗ No encontré el bloque syncedArtwork. ¿Cambió el formato del archivo generado?');
  process.exit(1);
}

const cambios = [];
const sinArchivo = [];
const yaLocales = [];

const bloqueNuevo = bloque[0].replace(/"([^"]+)"\s*:\s*"([^"]+)"/g, (linea, id, valor) => {
  if (!/^https?:\/\//.test(valor)) { yaLocales.push(id); return linea; }
  const local = localArtwork[id];
  if (!local) { sinArchivo.push(id); return linea; }
  cambios.push({ artista: id, antes: `${valor.slice(0, 48)}…`, ahora: local });
  return linea.replace(`"${valor}"`, `"${local}"`);
});

const salida = original.replace(bloque[0], bloqueNuevo);

console.log(`\n${cambios.length} carátulas semilla apuntan ahora al repositorio.`);
if (yaLocales.length) console.log(`  · ${yaLocales.length} ya estaban locales, sin cambios.`);
if (sinArchivo.length) {
  console.log(`  · ${sinArchivo.length} conservan su URL porque no tienen archivo en el repositorio:`);
  console.log(`    ${sinArchivo.join(', ')}`);
}

if (!cambios.length) {
  console.log('\nNada que hacer.');
  process.exit(0);
}

if (dryRun) {
  console.table(cambios.slice(0, 10));
  if (cambios.length > 10) console.log(`… y ${cambios.length - 10} más.`);
  console.log('\n--dry-run: no se escribió nada.');
  process.exit(0);
}

writeFileSync(GENERADO, salida);

const antes = Buffer.byteLength(original);
const despues = Buffer.byteLength(salida);
console.log(`\ncovers.generated.js: ${(antes / 1024).toFixed(1)} KB → ${(despues / 1024).toFixed(1)} KB`
  + ` (${Math.round((1 - despues / antes) * 100)}% menos)`);
console.log('\n✓ Listo. Corre npm test y revisa en localhost antes de hacer commit.');
