#!/usr/bin/env node
// MusicFest · normaliza las carátulas que ya están en el repositorio.
//
//   npm run covers:normalize -- --dry-run     informa, no escribe nada
//   npm run covers:normalize                  normaliza las que hagan falta
//   npm run covers:normalize -- --force       reprocesa todas
//   npm run covers:normalize -- --size 800    otro lado (por defecto 600)
//   npm run covers:normalize -- --quality 85  otra calidad (por defecto 80)
//
// Qué hace: deja todas las carátulas en WebP, cuadradas y del mismo lado.
// Las que vienen más grandes se reducen; las más chicas se dejan como están
// (agrandarlas no inventa detalle, sólo peso). El archivo original se borra
// cuando cambia la extensión: el historial de git lo conserva.
//
// Por qué 600 px: la tarjeta del pool es una grilla de mínimo 220 px
// (.artist-cover, aspect-ratio 1), la previsualización del panel docente llega
// a 240 px y la tira del cartel dibuja a 96 px con scale 2, o sea 192 px
// reales. Con pantallas retina, 600 cubre todo con margen.
//
// Idempotencia: assets/covers.normalized.json guarda el hash de cada archivo
// ya procesado. Si el hash en disco coincide, el archivo se salta. Correr el
// script dos veces seguidas no cambia un solo byte. Un archivo nuevo (recién
// bajado con covers:download) no está en el manifiesto y sí se procesa.
//
// El manifiesto vive fuera de assets/covers/ a propósito: download-covers.mjs
// recorre ese directorio entero para armar el mapa, y cualquier archivo extra
// ahí adentro terminaría como una entrada falsa en covers.local.js.
//
// Resultado:
//   assets/covers/{artistId}.webp    las imágenes normalizadas
//   assets/covers.normalized.json    el manifiesto de idempotencia
//   js/data/covers.local.js          el mapa id -> ruta, regenerado

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, resolve, extname, basename } from 'node:path';
import sharp from 'sharp';

const MODULE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const COVERS_DIR = join(MODULE_ROOT, 'assets', 'covers');
const MANIFEST = join(MODULE_ROOT, 'assets', 'covers.normalized.json');
const RELATIVE = archivo => `assets/covers/${archivo}`;

// Mismo parser que scripts/firebase-admin-init.mjs, para no arrastrar
// firebase-admin ni credenciales a una tarea que sólo toca archivos locales.
function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : true;
}

const dryRun = Boolean(arg('dry-run'));
const force = Boolean(arg('force'));
const LADO = Number(arg('size', 600));
const CALIDAD = Number(arg('quality', 80));

if (!Number.isInteger(LADO) || LADO < 64 || LADO > 3000) {
  console.error(`✗ --size inválido: ${arg('size')}. Se espera un entero entre 64 y 3000.`);
  process.exit(1);
}
if (!Number.isInteger(CALIDAD) || CALIDAD < 1 || CALIDAD > 100) {
  console.error(`✗ --quality inválido: ${arg('quality')}. Se espera un entero entre 1 y 100.`);
  process.exit(1);
}

const EXTENSIONES = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const kb = bytes => `${Math.round(bytes / 1024)} KB`;
const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

// ---------------------------------------------------------------------------
// 1. Reunir lo que hay
// ---------------------------------------------------------------------------

if (!existsSync(COVERS_DIR)) {
  console.error(`✗ No existe ${COVERS_DIR}. Baja las carátulas primero con: npm run covers:download`);
  process.exit(1);
}

const manifiestoPrevio = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const manifiesto = manifiestoPrevio.covers || {};

const contenido = readdirSync(COVERS_DIR).filter(n => !n.startsWith('.'));
const archivos = contenido
  .filter(n => EXTENSIONES.has(extname(n).toLowerCase()))
  .sort((a, b) => a.localeCompare(b));
const ignorados = contenido.filter(n => !EXTENSIONES.has(extname(n).toLowerCase()));

console.log(`\n${archivos.length} carátulas en assets/covers/ · objetivo: ${LADO}×${LADO} WebP q${CALIDAD}`);
if (ignorados.length) console.warn(`  ! Se ignoran ${ignorados.length} archivos que no son imagen: ${ignorados.join(', ')}`);

// ---------------------------------------------------------------------------
// 2. Normalizar
// ---------------------------------------------------------------------------

const rutas = {};
const nuevoManifiesto = {};
const fallos = [];
const pendientes = [];
let procesadas = 0, saltadas = 0, bytesAntes = 0, bytesDespues = 0;

for (const archivo of archivos) {
  const id = basename(archivo, extname(archivo));
  const origen = join(COVERS_DIR, archivo);
  const entrada = readFileSync(origen);
  const hashEntrada = sha(entrada);
  bytesAntes += entrada.length;

  const registrada = manifiesto[id];
  const yaNormalizada = registrada
    && registrada.file === archivo
    && registrada.hash === hashEntrada
    && registrada.size === LADO
    && registrada.quality === CALIDAD;

  if (yaNormalizada && !force) {
    rutas[id] = RELATIVE(archivo);
    nuevoManifiesto[id] = registrada;
    bytesDespues += entrada.length;
    saltadas++;
    continue;
  }

  try {
    const meta = await sharp(entrada).metadata();
    const salida = await sharp(entrada)
      .rotate()                                   // respeta la orientación EXIF
      .resize(LADO, LADO, {
        fit: 'cover',                             // recorta al centro si no fuera cuadrada
        position: 'centre',
        withoutEnlargement: true                  // nunca agranda: no inventa detalle
      })
      .webp({ quality: CALIDAD, effort: 6 })
      .toBuffer();
    const metaSalida = await sharp(salida).metadata();

    const destino = `${id}.webp`;
    const ahorro = entrada.length - salida.length;
    const detalle = `${meta.width}×${meta.height} ${String(meta.format).toUpperCase()} ${kb(entrada.length)}`
      + ` → ${metaSalida.width}×${metaSalida.height} WEBP ${kb(salida.length)}`
      + ` (${ahorro >= 0 ? '−' : '+'}${Math.abs(Math.round(ahorro / entrada.length * 100))}%)`;

    if (metaSalida.width < LADO) {
      pendientes.push({ artista: id, motivo: `origen de ${meta.width}×${meta.height}: queda en ${metaSalida.width} px` });
    }

    if (dryRun) {
      console.log(`  · ${id.padEnd(24)} ${detalle}`);
      rutas[id] = RELATIVE(archivo);
      bytesDespues += salida.length;
      procesadas++;
      continue;
    }

    writeFileSync(join(COVERS_DIR, destino), salida);
    if (destino !== archivo) unlinkSync(origen);

    rutas[id] = RELATIVE(destino);
    nuevoManifiesto[id] = {
      file: destino,
      hash: sha(salida),
      size: LADO,
      quality: CALIDAD,
      width: metaSalida.width,
      height: metaSalida.height,
      bytes: salida.length,
      from: { file: archivo, width: meta.width || null, height: meta.height || null, bytes: entrada.length }
    };
    bytesDespues += salida.length;
    procesadas++;
    console.log(`  ✓ ${id.padEnd(24)} ${detalle}`);
  } catch (error) {
    fallos.push({ artista: id, motivo: error.message });
    rutas[id] = RELATIVE(archivo);                // se queda como estaba: nada se rompe
    if (manifiesto[id]) nuevoManifiesto[id] = manifiesto[id];
    bytesDespues += entrada.length;
    console.warn(`  ✗ ${id}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Regenerar el mapa y el manifiesto
// ---------------------------------------------------------------------------

// El formato de covers.local.js debe coincidir exactamente con el que escribe
// scripts/download-covers.mjs: los dos generan el mismo archivo y cualquier
// diferencia aparecería como un diff falso al alternar entre ellos.
const ordenadas = Object.fromEntries(Object.entries(rutas).sort(([a], [b]) => a.localeCompare(b)));

if (!dryRun) {
  writeFileSync(join(MODULE_ROOT, 'js', 'data', 'covers.local.js'),
`// Generado por scripts/download-covers.mjs · no editar a mano.
// Carátulas guardadas en el repositorio y servidas por GitHub Pages.
// Las rutas son relativas a modulos/musicfest/.
export const localArtwork = ${JSON.stringify(ordenadas, null, 2)};
`);

  // La fecha sólo se actualiza si algo cambió: si no, correr el script de
  // nuevo dejaría un diff en git sin que ninguna imagen se haya tocado.
  const manifiestoOrdenado = Object.fromEntries(Object.entries(nuevoManifiesto).sort(([a], [b]) => a.localeCompare(b)));
  const sinCambios = procesadas === 0
    && JSON.stringify(manifiestoPrevio.covers || {}) === JSON.stringify(manifiestoOrdenado);
  writeFileSync(MANIFEST, `${JSON.stringify({
    _comentario: 'Generado por scripts/normalize-covers.mjs · no editar a mano. Guarda el hash de cada carátula ya normalizada para que volver a correr el script no la reprocese.',
    generado: sinCambios ? manifiestoPrevio.generado : new Date().toISOString(),
    size: LADO,
    quality: CALIDAD,
    covers: manifiestoOrdenado
  }, null, 2)}\n`);
}

// ---------------------------------------------------------------------------

const pesoReal = readdirSync(COVERS_DIR)
  .filter(n => !n.startsWith('.'))
  .reduce((suma, n) => suma + statSync(join(COVERS_DIR, n)).size, 0);

console.log('');
console.table({
  normalizadas: procesadas,
  yaEstaban: saltadas,
  conProblemas: fallos.length,
  totalEnRepositorio: Object.keys(ordenadas).length,
  antes: mb(bytesAntes),
  despues: mb(bytesDespues),
  ahorro: `${Math.round((1 - bytesDespues / bytesAntes) * 100)}%`,
  pesoEnDisco: mb(pesoReal)
});
if (pendientes.length) {
  console.log(`\n${pendientes.length} carátulas quedaron por debajo de ${LADO} px porque el original era más chico.`);
  console.log('No se agrandan: para mejorarlas hay que elegir otra portada en el panel docente y volver a bajarla.');
  console.table(pendientes);
}
if (fallos.length) console.table(fallos);

console.log(dryRun
  ? '\n--dry-run: no se escribió nada. Las cifras de arriba son reales, la conversión se hizo en memoria.'
  : fallos.length
    ? '\nLas que fallaron quedaron como estaban. Revisa el motivo y reintenta con --force.'
    : '\n✓ Listo. Revisa en localhost:5173/modulos/musicfest/ (tarjetas y pestaña Cartel) antes de hacer commit.');
process.exit(fallos.length ? 1 : 0);
