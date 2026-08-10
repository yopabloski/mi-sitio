// Fidelidad de la migración: usa la exportación real del prototipo y verifica
// que el viaje session -> documentos Firestore -> session no pierde artistas,
// ediciones, eliminaciones, carátulas ni estados de revisión.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activityExport } from '../helpers/paths.mjs';
import { artists as seedArtists } from '../../js/data/artists.js';
import { toArtistDocs, fromArtistDocs, catalogSummary, sameArtist } from '../../js/domain/activity-mapper.js';
import { validate } from '../../js/domain/game.js';

const exportFile = activityExport();
const payload = JSON.parse(readFileSync(exportFile, 'utf8'));
const session = payload.session;
const seedIds = new Set(seedArtists.map(a => a.id));

test('la exportación de referencia existe y tiene el formato esperado', () => {
  assert.ok(exportFile, 'no se encontró ninguna exportación musicfest-*.json en el módulo');
  assert.equal(payload.format, 'musicfest-activity');
  assert.ok(Array.isArray(session.days) && session.days.length === 3);
});

test('todos los artistas de la exportación llegan a Firestore', () => {
  const docs = toArtistDocs(session, seedArtists);
  const esperados = seedArtists.filter(a => !(session.deletedArtistIds || []).includes(a.id)).length
    + (session.customArtists || []).filter(a => !(session.deletedArtistIds || []).includes(a.id)).length;
  assert.equal(docs.size, esperados);
  for (const id of session.activeArtistIds || []) {
    assert.ok(docs.has(id), `el artista activo ${id} no llegó al catálogo`);
    assert.equal(docs.get(id).active, true, `${id} debería quedar marcado como activo`);
  }
});

test('las ediciones del docente sobreviven al mapeo', () => {
  const docs = toArtistDocs(session, seedArtists);
  const overrides = session.artistOverrides || {};
  assert.ok(Object.keys(overrides).length > 0, 'la exportación de referencia debería traer artistas editados');
  for (const [id, override] of Object.entries(overrides)) {
    if ((session.deletedArtistIds || []).includes(id)) continue;
    const doc = docs.get(id);
    assert.ok(doc, `${id} desapareció del catálogo`);
    for (const [field, value] of Object.entries(override)) {
      if (field === 'id') continue;
      const stored = typeof value === 'number' ? Number(doc[field]) : doc[field];
      assert.equal(stored, value, `${id}.${field} perdió la edición docente`);
    }
  }
});

test('los artistas personalizados conservan sus datos y no se confunden con los base', () => {
  const docs = toArtistDocs(session, seedArtists);
  for (const custom of session.customArtists || []) {
    const doc = docs.get(custom.id);
    assert.ok(doc, `el artista personalizado ${custom.id} no llegó a Firestore`);
    assert.equal(doc.base, false);
    assert.equal(doc.name, custom.name);
    assert.equal(Number(doc.cost), Number(custom.cost));
  }
});

test('editar un artista personalizado no pierde la edición (regresión)', () => {
  // El panel docente guarda las ediciones en artistOverrides tanto para
  // artistas base como personalizados. Aplicarlas sólo a los base borraba el
  // trabajo del docente sobre los artistas que él mismo había creado.
  const custom = { id: 'artista-nuevo', name: 'Nombre Viejo', genre: 'Rock', country: 'CHI', cost: 2, popularity: 2, duration: 1 };
  const editado = {
    ...session,
    customArtists: [...(session.customArtists || []), custom],
    artistOverrides: { ...(session.artistOverrides || {}), 'artista-nuevo': { ...custom, name: 'Nombre Corregido', cost: 4 } },
    activeArtistIds: [...(session.activeArtistIds || []), 'artista-nuevo']
  };
  const doc = toArtistDocs(editado, seedArtists).get('artista-nuevo');
  assert.equal(doc.name, 'Nombre Corregido');
  assert.equal(doc.cost, 4);
  assert.equal(doc.base, false);
});

test('los artistas eliminados no reaparecen', () => {
  const conBorrados = { ...session, deletedArtistIds: [...(session.deletedArtistIds || []), 'coldplay'] };
  const docs = toArtistDocs(conBorrados, seedArtists);
  assert.equal(docs.has('coldplay'), false);
});

test('carátulas y estados de revisión se conservan', () => {
  const docs = toArtistDocs(session, seedArtists);
  const artwork = session.artwork || {};
  const info = session.releaseInfo || {};
  let aprobadas = 0;
  for (const [id, url] of Object.entries(artwork)) {
    if (!docs.has(id)) continue;
    const doc = docs.get(id);
    assert.equal(doc.artworkUrl, url, `${id} perdió su carátula`);
    const review = info[id]?.review;
    if (review === 'approved') { aprobadas++; assert.equal(doc.artworkStatus, 'approved'); }
    else assert.equal(doc.artworkStatus, 'pending');
    if (info[id]?.album) assert.equal(doc.album, info[id].album);
    if (info[id]?.year) assert.equal(doc.albumYear, info[id].year);
  }
  assert.ok(aprobadas > 0, 'la exportación de referencia debería traer carátulas aprobadas');
});

test('el viaje de ida y vuelta reconstruye la misma sesión', () => {
  const docs = toArtistDocs(session, seedArtists);
  const rebuilt = fromArtistDocs(
    {
      code: session.code, name: session.name, mode: session.mode, state: session.state,
      activeDayIndex: session.activeDayIndex, revision: session.revision,
      reopenedFrom: session.reopenedFrom, days: session.days,
      activeArtistIds: session.activeArtistIds, deletedArtistIds: session.deletedArtistIds,
      catalogLocked: session.catalogLocked
    },
    docs.values(),
    seedIds
  );

  assert.equal(rebuilt.code, session.code);
  assert.equal(rebuilt.revision, session.revision);
  assert.deepEqual(rebuilt.days, session.days);
  assert.deepEqual(rebuilt.activeArtistIds, session.activeArtistIds);
  assert.deepEqual(
    rebuilt.customArtists.map(a => a.id).sort(),
    (session.customArtists || []).map(a => a.id).sort()
  );
  for (const [id, url] of Object.entries(session.artwork || {})) {
    if (docs.has(id)) assert.equal(rebuilt.artwork[id], url, `${id} perdió su carátula en la vuelta`);
  }

  // Segunda vuelta: el mapeo debe ser estable (no genera escrituras infinitas).
  const again = toArtistDocs(rebuilt, seedArtists);
  assert.equal(again.size, docs.size);
  for (const [id, doc] of docs) assert.ok(sameArtist(doc, again.get(id)), `${id} cambió en la segunda vuelta`);
});

test('el pool importado sigue permitiendo resolver los tres días', () => {
  const docs = toArtistDocs(session, seedArtists);
  const pool = [...docs.values()].filter(a => a.active);
  for (const day of session.days) {
    assert.ok(pool.length >= day.artistCount, `${day.name} pide más artistas de los que hay activos`);
    const conjunto = pool.slice(0, day.artistCount).map(a => a.id);
    assert.equal(validate(conjunto, day, pool).totals.count, day.artistCount);
  }
});

test('el resumen de catálogo es coherente con la exportación', () => {
  const summary = catalogSummary(session, seedArtists);
  assert.equal(summary.activos, (session.activeArtistIds || []).length);
  assert.equal(summary.personalizados, (session.customArtists || []).length);
  assert.ok(summary.conCaratula >= summary.caratulasAprobadas);
  assert.equal(summary.conCaratula, summary.caratulasAprobadas + summary.caratulasPorRevisar);
});
