// Recálculo autoritativo de entregas: es la defensa que reemplaza a las
// Cloud Functions mientras el proyecto siga en plan Spark.
import test from 'node:test';
import assert from 'node:assert/strict';
import { days } from '../../js/domain/game.js';
import { artists } from '../../js/data/artists.js';
import { recomputeSubmission, crossDayConflicts, buildLeaderboard, serializeChecks, deserializeChecks } from '../../js/domain/submissions.js';

const friday = days[0];
const pool = artists;
const cheap = [...artists].sort((a, b) => a.cost - b.cost);
const feasible = (() => {
  const chosen = [];
  for (const genre of ['Pop', 'Rock', 'Rap', 'Trap Latino']) chosen.push(cheap.find(a => a.genre === genre));
  chosen.push(cheap.find(a => a.country === 'CHI' && !chosen.includes(a)));
  chosen.push(cheap.find(a => !chosen.includes(a)));
  return chosen.slice(0, friday.artistCount).map(a => a.id);
})();

const submission = (patch = {}) => ({
  teamId: 'los-optimizadores', teamName: 'Los Optimizadores',
  dayId: 'friday', dayIndex: 0, revision: 1,
  selections: [...feasible], validationStatus: 'validated',
  ...patch
});

test('el recálculo reproduce los totales cuando la entrega es honesta', () => {
  const honest = submission();
  const first = recomputeSubmission(honest, { days, artists: pool });
  const echoed = recomputeSubmission({ ...honest, reportedTotals: first.totals }, { days, artists: pool });
  assert.equal(echoed.tampered, false);
  assert.deepEqual(echoed.totals, first.totals);
});

test('una popularidad inflada por el cliente se detecta', () => {
  const truth = recomputeSubmission(submission(), { days, artists: pool });
  const inflated = recomputeSubmission(submission({ reportedTotals: { ...truth.totals, score: 999 } }), { days, artists: pool });
  assert.equal(inflated.tampered, true);
  assert.equal(inflated.totals.score, truth.totals.score, 'el recálculo ignora el número informado');
  assert.ok(inflated.deltas.some(d => d.startsWith('score')));
});

test('un artista fuera del pool invalida la entrega', () => {
  const result = recomputeSubmission(submission({ selections: [...feasible.slice(1), 'artista-inventado'] }), { days, artists: pool });
  assert.deepEqual(result.missing, ['artista-inventado']);
  assert.equal(result.valid, false);
  assert.equal(result.tampered, true);
});

test('artistas repetidos invalidan la entrega', () => {
  const repeated = [feasible[0], ...feasible.slice(0, friday.artistCount - 1)];
  const result = recomputeSubmission(submission({ selections: repeated }), { days, artists: pool });
  assert.equal(result.duplicated, true);
  assert.equal(result.valid, false);
});

test('un pool recortado después de la entrega vuelve inválido el lineup', () => {
  const reduced = pool.filter(a => a.id !== feasible[0]);
  const result = recomputeSubmission(submission(), { days, artists: reduced });
  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, [feasible[0]]);
});

test('crossDayConflicts detecta un artista asignado a dos días', () => {
  const conflicts = crossDayConflicts({ friday: ['bad-bunny', 'coldplay'], saturday: ['coldplay'], sunday: [] });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].artistId, 'coldplay');
});

test('el ranking sólo considera entregas validadas de la revisión vigente', () => {
  const entries = [
    submission({ teamId: 'a', teamName: 'A', validationStatus: 'validated', revision: 2 }),
    submission({ teamId: 'b', teamName: 'B', validationStatus: 'pending', revision: 2 }),
    submission({ teamId: 'c', teamName: 'C', validationStatus: 'validated', revision: 1 })
  ];
  const board = buildLeaderboard(entries, { revision: 2, days, artists: pool });
  assert.deepEqual(board.map(x => x.teamId), ['a']);
});

test('una entrega validada pero infactible no entra al ranking', () => {
  const caros = [...artists].sort((a, b) => b.cost - a.cost).slice(0, friday.artistCount).map(a => a.id);
  const board = buildLeaderboard([submission({ teamId: 'a', selections: caros })], { revision: 1, days, artists: pool });
  assert.equal(board.length, 0);
});

// ---------------------------------------------------------------------------
// Compatibilidad con Firestore
// ---------------------------------------------------------------------------

/** Recorre un valor y devuelve las rutas donde hay un array dentro de otro. */
function nestedArrayPaths(value, path = '$') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => (Array.isArray(item)
      ? [`${path}[${index}]`]
      : nestedArrayPaths(item, `${path}[${index}]`)));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.entries(value).flatMap(([key, item]) => nestedArrayPaths(item, `${path}.${key}`));
  }
  return [];
}

test('serializeChecks aplana los checks a mapas', () => {
  const { checks } = recomputeSubmission(submission(), { days, artists: pool });
  assert.ok(Array.isArray(checks[0]), 'validate sigue devolviendo tuplas');

  const plano = serializeChecks(checks);
  assert.deepEqual(nestedArrayPaths(plano), [], 'no debe quedar ningún array anidado');
  assert.equal(plano.length, checks.length);
  assert.deepEqual(Object.keys(plano[0]).sort(), ['name', 'ok', 'value']);
  assert.equal(typeof plano[0].ok, 'boolean');
  assert.equal(typeof plano[0].value, 'string');
});

test('deserializeChecks devuelve el formato que espera la interfaz', () => {
  const { checks } = recomputeSubmission(submission(), { days, artists: pool });
  assert.deepEqual(deserializeChecks(serializeChecks(checks)), checks.map(c => [c[0], c[1], String(c[2])]));
  assert.deepEqual(deserializeChecks(checks), checks, 'debe tolerar el formato antiguo');
});

test('el documento de entrega no contiene arrays anidados (regresión)', () => {
  // Firestore rechaza con `invalid-argument` cualquier array dentro de otro.
  // Este es el documento tal como lo escribe remote-store.js.
  const { totals: t, checks } = recomputeSubmission(submission(), { days, artists: pool });
  const documento = {
    teamId: 'los-optimizadores', teamName: 'Los Optimizadores',
    dayId: 'friday', dayName: 'Viernes', dayIndex: 0, revision: 1,
    selections: [...feasible],
    reportedTotals: t,
    reportedChecks: serializeChecks(checks),
    validationStatus: 'pending', validatedAt: null, validatedBy: null,
    submittedBy: 'uid-equipo'
  };
  assert.deepEqual(nestedArrayPaths(documento), [], 'Firestore rechazaría este documento');
});

test('recomputeSubmission no revienta con una entrega inexistente', () => {
  const resultado = recomputeSubmission(undefined, { days, artists: pool });
  assert.equal(resultado.valid, false);
  assert.equal(resultado.tampered, true);
});
