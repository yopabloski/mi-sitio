#!/usr/bin/env node
// MusicFest · importa a Firestore el JSON del botón "Exportar configuración".
//
//   npm run import:activity -- --file musicfest-demo-2026-08-10.json
//   npm run import:activity -- --file demo.json --code TALLER3 --dry-run
//   USE_FIREBASE_EMULATORS=1 npm run import:activity -- --file demo.json
//
// Es idempotente: si el código ya existe, actualiza esa misma actividad y
// conserva su activityId, sus equipos y sus entregas.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { admin, PATHS, normalizeCode, arg } from './firebase-admin-init.mjs';
import { artists as seedArtists } from '../js/data/artists.js';
import { toArtistDocs, catalogSummary } from '../js/domain/activity-mapper.js';

const MODULE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const defaultExport = () => {
  const found = readdirSync(MODULE_ROOT).find(name => /^musicfest-.*\.json$/.test(name));
  return found ? join(MODULE_ROOT, found) : null;
};
const requested = arg('file');
const file = requested && requested !== true ? requested : defaultExport();
if (!file || !existsSync(file)) {
  console.error('✗ No se encontró la exportación. Usa --file <ruta al JSON>.');
  process.exit(1);
}
const dryRun = Boolean(arg('dry-run'));
const overrideCode = arg('code');
const ownerUid = arg('owner', process.env.MUSICFEST_ADMIN_UID || null);

const payload = JSON.parse(readFileSync(file, 'utf8'));
if (payload.format !== 'musicfest-activity') {
  console.error(`✗ ${file} no parece una exportación de MusicFest (format: ${payload.format}).`);
  process.exit(1);
}

const source = payload.session || {};
const catalog = payload.catalog || {};
const code = String(overrideCode || source.code || 'DEMO').trim().toUpperCase();
const codeKey = normalizeCode(code);

const seedById = new Map(seedArtists.map(a => [a.id, a]));
const overrides = { ...(catalog.artistOverrides || source.artistOverrides || {}) };
const customArtists = catalog.customArtists || source.customArtists || [];
const deleted = new Set(catalog.deletedArtistIds || source.deletedArtistIds || []);
const active = new Set(catalog.activeArtistIds || source.activeArtistIds || []);
const artwork = catalog.artwork || source.artwork || {};
const releaseInfo = catalog.releaseInfo || source.releaseInfo || {};

// La conversión session -> documentos usa exactamente el mismo mapper que la
// aplicación, de modo que importar y editar en vivo producen los mismos datos.
const artistDocs = [...toArtistDocs(source, seedArtists).values()];

const summary = {
  code,
  nombre: source.name,
  modo: source.mode,
  estado: source.state,
  revision: source.revision,
  diaActivo: source.activeDayIndex,
  ...catalogSummary(source, seedArtists),
  eventos: (source.events || []).length
};
console.table(summary);

// Verificación de integridad antes de escribir nada.
const problems = [];
const knownIds = new Set(artistDocs.map(a => a.id));
for (const id of active) if (!knownIds.has(id)) problems.push(`activeArtistIds contiene ${id}, que no existe en el catálogo.`);
for (const id of Object.keys(artwork)) if (!knownIds.has(id) && !deleted.has(id)) problems.push(`Hay carátula para ${id}, que no está en el catálogo.`);
const customIds = new Set(customArtists.map(a => a.id));
for (const id of Object.keys(overrides)) if (!seedById.has(id) && !customIds.has(id)) problems.push(`Hay una edición guardada para ${id}, que no existe en el catálogo.`);
for (const day of source.days || []) {
  if (!day.id || !day.name) problems.push(`Día sin id o nombre: ${JSON.stringify(day)}`);
  if (Number(day.artistCount) > active.size) problems.push(`${day.name} pide ${day.artistCount} artistas y sólo hay ${active.size} activos.`);
}
if (problems.length) {
  console.warn('\n⚠ Advertencias:');
  problems.forEach(p => console.warn(`  · ${p}`));
}

if (dryRun) {
  console.log('\n--dry-run: no se escribió nada en Firestore.');
  process.exit(problems.length ? 2 : 0);
}

const { db, useEmulators } = await admin();
console.log(`\nEscribiendo en ${useEmulators ? 'los EMULADORES' : 'PRODUCCIÓN'}…`);

const codeRef = db.collection(PATHS.codes).doc(codeKey);
const codeSnap = await codeRef.get();
const activityId = codeSnap.exists && codeSnap.data().activityId
  ? codeSnap.data().activityId
  : `mf-${codeKey}-${Math.random().toString(36).slice(2, 8)}`;
const activityRef = db.collection(PATHS.activities).doc(activityId);
const existing = await activityRef.get();

const activityData = {
  code,
  name: source.name || 'MusicFest',
  ownerUid: ownerUid || existing.data()?.ownerUid || null,
  mode: source.mode || 'sequential',
  state: source.state || 'lobby',
  activeDayIndex: source.activeDayIndex ?? 0,
  revision: source.revision ?? 1,
  reopenedFrom: source.reopenedFrom ?? 0,
  days: source.days || [],
  activeArtistIds: artistDocs.filter(a => a.active).map(a => a.id),
  deletedArtistIds: [...deleted],
  catalogLocked: Boolean(source.catalogLocked),
  teamJoinPolicy: source.teamJoinPolicy || 'open',
  schemaVersion: 2,
  importedFrom: file,
  importedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
if (!existing.exists) activityData.createdAt = new Date().toISOString();

let batch = db.batch();
let operations = 0;
const flush = async () => { if (operations) { await batch.commit(); batch = db.batch(); operations = 0; } };
const queue = (fn) => { fn(); if (++operations >= 400) return flush(); };

await queue(() => batch.set(activityRef, activityData, { merge: true }));
await queue(() => batch.set(codeRef, { activityId, code, ownerUid: activityData.ownerUid, updatedAt: new Date().toISOString() }));

// Artistas que ya no existen en la exportación se eliminan de la subcolección.
const currentArtists = await activityRef.collection('artists').get();
const incoming = new Set(artistDocs.map(a => a.id));
for (const doc of currentArtists.docs) {
  if (!incoming.has(doc.id)) await queue(() => batch.delete(doc.ref));
}
for (const artist of artistDocs) {
  await queue(() => batch.set(activityRef.collection('artists').doc(artist.id), { ...artist, updatedAt: new Date().toISOString() }, { merge: true }));
}

// Bitácora: se importa en orden cronológico para que la lectura desc coincida.
for (const event of [...(source.events || [])].reverse()) {
  await queue(() => batch.set(activityRef.collection('events').doc(), {
    type: event.type || 'import',
    text: event.text || '',
    actorUid: activityData.ownerUid,
    payload: { imported: true },
    createdAt: new Date(event.at || Date.now())
  }));
}
await flush();

// Verificación posterior: releer y comparar.
const verifyActivity = await activityRef.get();
const verifyArtists = await activityRef.collection('artists').get();
const stored = verifyArtists.docs.map(d => d.data());
const report = {
  activityId,
  artistasEscritos: stored.length,
  artistasEsperados: artistDocs.length,
  activosEscritos: stored.filter(a => a.active).length,
  activosEsperados: activityData.activeArtistIds.length,
  caratulasEscritas: stored.filter(a => a.artworkUrl).length,
  caratulasEsperadas: artistDocs.filter(a => a.artworkUrl).length,
  revision: verifyActivity.data().revision
};
console.table(report);

const ok = report.artistasEscritos === report.artistasEsperados
  && report.activosEscritos === report.activosEsperados
  && report.caratulasEscritas === report.caratulasEsperadas;
console.log(ok ? `\n✓ Importación verificada. activityId = ${activityId}` : '\n✗ La verificación encontró diferencias.');
process.exit(ok ? 0 : 1);
