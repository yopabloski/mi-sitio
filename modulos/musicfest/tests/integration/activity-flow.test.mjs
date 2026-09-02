// Integración de extremo a extremo contra los emuladores:
// importar una actividad completa, jugar un día, recalcular, reabrir y comprobar
// que la reapertura no destruye las entregas anteriores.
//
//   npm run test:integration
//
// A diferencia de tests/rules, aquí se usa el Admin SDK (sin reglas) para
// montar el escenario, y el SDK cliente con contexto de estudiante para
// comprobar que el flujo real funciona con las reglas puestas.

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, query, where } from 'firebase/firestore';
import { artists as seedArtists } from '../../js/data/artists.js';
import { toArtistDocs, fromArtistDocs } from '../../js/domain/activity-mapper.js';
import { validate, days as defaultDays } from '../../js/domain/game.js';
import { recomputeSubmission, buildLeaderboard, serializeChecks } from '../../js/domain/submissions.js';
import { buildFeasible as feasibleLineup } from '../helpers/lineup.mjs';
import { RULES_FILE, activityExport } from '../helpers/paths.mjs';

const PROJECT = 'musicfest-integration';
const ACTIVITY = 'mf-demo-integration';
const TEACHER = 'uid-docente';
const TEAM_UID = 'uid-equipo';
const TEAM_ID = 'los-optimizadores';
const activityPath = `musicfestActivities/${ACTIVITY}`;

const payload = JSON.parse(readFileSync(activityExport(), 'utf8'));
const source = payload.session;
const artistDocs = [...toArtistDocs(source, seedArtists).values()];
const seedIds = new Set(seedArtists.map(a => a.id));

let env;
const teacher = () => env.authenticatedContext(TEACHER).firestore();
const student = () => env.authenticatedContext(TEAM_UID, { provider_id: 'anonymous' }).firestore();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(RULES_FILE(), 'utf8'), host: '127.0.0.1', port: 8080 }
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'musicfestAdmins', TEACHER), { email: 'docente@udd.cl' });
    await setDoc(doc(db, 'musicfestCodes', 'demo'), { activityId: ACTIVITY, code: 'DEMO' });
    await setDoc(doc(db, activityPath), {
      code: 'DEMO', name: source.name, ownerUid: TEACHER,
      mode: 'sequential', state: 'lobby', activeDayIndex: 0, revision: 1, reopenedFrom: 0,
      days: source.days, activeArtistIds: artistDocs.filter(a => a.active).map(a => a.id),
      deletedArtistIds: source.deletedArtistIds || [], catalogLocked: false,
      teamJoinPolicy: 'open', schemaVersion: 2
    });
    for (const artist of artistDocs) await setDoc(doc(db, `${activityPath}/artists/${artist.id}`), artist);
  });
});

after(async () => { await env?.cleanup(); });

test('la actividad importada se lee completa desde Firestore', async () => {
  const snapshot = await getDoc(doc(teacher(), activityPath));
  const artistsSnap = await getDocs(collection(teacher(), `${activityPath}/artists`));
  assert.equal(artistsSnap.size, artistDocs.length);

  const rebuilt = fromArtistDocs(snapshot.data(), artistsSnap.docs.map(d => ({ id: d.id, ...d.data() })), seedIds);
  assert.equal(rebuilt.customArtists.length, (source.customArtists || []).length);
  assert.equal(Object.keys(rebuilt.artwork).length, Object.keys(source.artwork || {}).length);
  assert.equal(rebuilt.activeArtistIds.length, (source.activeArtistIds || []).length);
});

test('el equipo entra, guarda borrador y entrega el viernes', async () => {
  await updateDoc(doc(teacher(), activityPath), { state: 'active' });

  await setDoc(doc(student(), `${activityPath}/teams/${TEAM_ID}`), {
    name: 'Los Optimizadores', memberUids: [TEAM_UID]
  });

  const activity = (await getDoc(doc(student(), activityPath))).data();
  const artistsSnap = await getDocs(collection(student(), `${activityPath}/artists`));
  const pool = artistsSnap.docs.map(d => d.data()).filter(a => activity.activeArtistIds.includes(a.id));
  const friday = activity.days[0];
  const lineup = feasibleLineup(friday, pool);
  const result = validate(lineup.map(a => a.id), friday, pool);
  assert.equal(result.valid, true, 'el escenario de prueba debe partir de un lineup factible');

  await setDoc(doc(student(), `${activityPath}/teams/${TEAM_ID}/drafts/1`), {
    teamName: 'Los Optimizadores',
    selections: { friday: lineup.map(a => a.id), saturday: [], sunday: [] },
    statuses: { friday: 'editable', saturday: 'editable', sunday: 'editable' },
    revision: 1, updatedBy: TEAM_UID
  });

  await setDoc(doc(student(), `${activityPath}/submissions/${TEAM_ID}__friday__r1`), {
    teamId: TEAM_ID, teamName: 'Los Optimizadores',
    dayId: 'friday', dayIndex: 0, revision: 1,
    selections: lineup.map(a => a.id),
    reportedTotals: result.totals, reportedChecks: serializeChecks(result.checks),
    validationStatus: 'pending', validatedAt: null, validatedBy: null,
    submittedBy: TEAM_UID, submittedAt: new Date()
  });

  const stored = await getDoc(doc(teacher(), `${activityPath}/submissions/${TEAM_ID}__friday__r1`));
  assert.equal(stored.exists(), true);
  assert.equal(stored.data().validationStatus, 'pending');
});

test('el docente recalcula y el ranking usa esos valores sin aprobación manual', async () => {
  const activity = (await getDoc(doc(teacher(), activityPath))).data();
  const artistsSnap = await getDocs(collection(teacher(), `${activityPath}/artists`));
  const pool = artistsSnap.docs.map(d => d.data());
  const submissions = (await getDocs(collection(teacher(), `${activityPath}/submissions`))).docs.map(d => ({ id: d.id, ...d.data() }));

  const check = recomputeSubmission(submissions[0], { days: activity.days, artists: pool });
  assert.equal(check.valid, true);
  assert.equal(check.tampered, false, `el recálculo no debería diferir: ${check.deltas.join(' | ')}`);

  const board = buildLeaderboard(submissions, { revision: 1, days: activity.days, artists: pool });
  assert.equal(board.length, 1);
  assert.equal(board[0].score, check.totals.score);
});

test('reabrir el viernes conserva la entrega anterior y abre una revisión nueva', async () => {
  const before = (await getDoc(doc(teacher(), `${activityPath}/submissions/${TEAM_ID}__friday__r1`))).data();

  await updateDoc(doc(teacher(), activityPath), { revision: 2, reopenedFrom: 0, activeDayIndex: 0, state: 'active' });
  const previousDraft = (await getDoc(doc(teacher(), `${activityPath}/teams/${TEAM_ID}/drafts/1`))).data();
  await setDoc(doc(teacher(), `${activityPath}/teams/${TEAM_ID}/drafts/2`), {
    ...previousDraft,
    statuses: { ...previousDraft.statuses, friday: 'needs_revalidation' },
    revision: 2, clonedFrom: 1
  });

  // La entrega de la revisión 1 sigue intacta.
  const survivor = (await getDoc(doc(teacher(), `${activityPath}/submissions/${TEAM_ID}__friday__r1`))).data();
  assert.deepEqual(survivor.selections, before.selections);
  assert.equal(survivor.validationStatus, 'pending', 'el estado heredado ya no requiere intervención docente');

  // El borrador nuevo conserva las selecciones y pide revalidar.
  const fresh = (await getDoc(doc(student(), `${activityPath}/teams/${TEAM_ID}/drafts/2`))).data();
  assert.deepEqual(fresh.selections.friday, previousDraft.selections.friday);
  assert.equal(fresh.statuses.friday, 'needs_revalidation');

  // El ranking de la revisión vigente ya no cuenta la entrega vieja.
  const activity = (await getDoc(doc(teacher(), activityPath))).data();
  const pool = (await getDocs(collection(teacher(), `${activityPath}/artists`))).docs.map(d => d.data());
  const all = (await getDocs(collection(teacher(), `${activityPath}/submissions`))).docs.map(d => d.data());
  assert.equal(buildLeaderboard(all, { revision: 2, days: activity.days, artists: pool }).length, 0);
  assert.equal(buildLeaderboard(all, { revision: 1, days: activity.days, artists: pool }).length, 1);
});

test('el equipo vuelve a entregar en la revisión 2 y ambas entregas coexisten', async () => {
  const activity = (await getDoc(doc(student(), activityPath))).data();
  const pool = (await getDocs(collection(student(), `${activityPath}/artists`))).docs.map(d => d.data())
    .filter(a => activity.activeArtistIds.includes(a.id));
  const friday = activity.days[0];
  const lineup = feasibleLineup(friday, pool);
  const result = validate(lineup.map(a => a.id), friday, pool);

  await setDoc(doc(student(), `${activityPath}/submissions/${TEAM_ID}__friday__r2`), {
    teamId: TEAM_ID, teamName: 'Los Optimizadores',
    dayId: 'friday', dayIndex: 0, revision: 2,
    selections: lineup.map(a => a.id),
    reportedTotals: result.totals, reportedChecks: serializeChecks(result.checks),
    validationStatus: 'pending', validatedAt: null, validatedBy: null,
    submittedBy: TEAM_UID, submittedAt: new Date()
  });

  const historial = await getDocs(query(collection(teacher(), `${activityPath}/submissions`), where('teamId', '==', TEAM_ID)));
  assert.equal(historial.size, 2, 'la reapertura debe conservar el historial completo');
  assert.deepEqual(historial.docs.map(d => d.data().revision).sort(), [1, 2]);
});
