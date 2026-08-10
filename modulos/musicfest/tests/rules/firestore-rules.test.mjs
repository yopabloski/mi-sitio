// Reglas de seguridad de MusicFest contra el emulador de Firestore.
//
//   npm run test:rules
//
// Cubre: separación docente/estudiante, inmutabilidad de entregas, validación
// estructural del lineup, propiedad del equipo y aislamiento entre equipos.

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, getDocs
} from 'firebase/firestore';
import { RULES_FILE } from '../helpers/paths.mjs';

const PROJECT = 'musicfest-rules-test';
const ACTIVITY = 'mf-demo-test01';
const TEACHER = 'uid-docente';
const OTHER_TEACHER = 'uid-docente-2';
const TEAM_A_UID = 'uid-equipo-a';
const TEAM_B_UID = 'uid-equipo-b';
const INTRUDER = 'uid-intruso';

const DAYS = [
  { id: 'friday', name: 'Viernes', artistCount: 3, budget: 24, duration: 10, minChilean: 1, minGenres: 2, genreMinimums: {} },
  { id: 'saturday', name: 'Sábado', artistCount: 4, budget: 28, duration: 12, minChilean: 2, minGenres: 2, genreMinimums: {} },
  { id: 'sunday', name: 'Domingo', artistCount: 4, budget: 28, duration: 12, minChilean: 2, minGenres: 2, genreMinimums: {} }
];
const POOL = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];

let env;

const teacher = () => env.authenticatedContext(TEACHER).firestore();
const otherTeacher = () => env.authenticatedContext(OTHER_TEACHER).firestore();
const student = uid => env.authenticatedContext(uid, { provider_id: 'anonymous' }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const activityPath = `musicfestActivities/${ACTIVITY}`;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(RULES_FILE(), 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'musicfestAdmins', TEACHER), { email: 'docente@udd.cl' });
    await setDoc(doc(db, 'musicfestAdmins', OTHER_TEACHER), { email: 'docente2@udd.cl' });
    await setDoc(doc(db, 'musicfestCodes', 'demo'), { activityId: ACTIVITY, code: 'DEMO' });
    await setDoc(doc(db, activityPath), {
      code: 'DEMO', name: 'MusicFest Demo', ownerUid: TEACHER,
      mode: 'sequential', state: 'active', activeDayIndex: 0, revision: 1, reopenedFrom: 0,
      days: DAYS, activeArtistIds: POOL, deletedArtistIds: [],
      catalogLocked: false, teamJoinPolicy: 'open', schemaVersion: 2
    });
    for (const id of POOL) {
      await setDoc(doc(db, `${activityPath}/artists/${id}`), {
        id, name: id.toUpperCase(), genre: 'Pop', country: 'CHI', cost: 2, popularity: 3, duration: 1,
        base: true, order: 0, active: true, artworkUrl: '', artworkStatus: 'none'
      });
    }
    await setDoc(doc(db, `${activityPath}/teams/equipo-a`), { name: 'Equipo A', memberUids: [TEAM_A_UID] });
    await setDoc(doc(db, `${activityPath}/teams/equipo-b`), { name: 'Equipo B', memberUids: [TEAM_B_UID] });
  });
});

const validSubmission = (extra = {}) => ({
  teamId: 'equipo-a', teamName: 'Equipo A',
  dayId: 'friday', dayIndex: 0, revision: 1,
  selections: ['a1', 'a2', 'a3'],
  reportedTotals: { count: 3, cost: 6, duration: 3, score: 9, chilean: 3, genres: {} },
  reportedChecks: [],
  validationStatus: 'pending', validatedAt: null, validatedBy: null,
  submittedBy: TEAM_A_UID, submittedAt: new Date(),
  ...extra
});

// ---------------------------------------------------------------------------
// Lectura pública y padrón docente
// ---------------------------------------------------------------------------

test('cualquiera puede leer la actividad: el estudiante necesita reglas y pool', async () => {
  await assertSucceeds(getDoc(doc(anon(), activityPath)));
  await assertSucceeds(getDocs(collection(anon(), `${activityPath}/artists`)));
});

test('nadie puede escribir el padrón docente desde el cliente', async () => {
  await assertFails(setDoc(doc(teacher(), 'musicfestAdmins/uid-nuevo'), { email: 'x@udd.cl' }));
  await assertFails(setDoc(doc(student(INTRUDER), `musicfestAdmins/${INTRUDER}`), { email: 'x@udd.cl' }));
});

test('un estudiante no puede listar el padrón docente', async () => {
  await assertFails(getDocs(collection(student(TEAM_A_UID), 'musicfestAdmins')));
  await assertSucceeds(getDocs(collection(teacher(), 'musicfestAdmins')));
});

// ---------------------------------------------------------------------------
// Reglas, pool y estado: sólo docente
// ---------------------------------------------------------------------------

test('un estudiante no puede cambiar reglas, estado, revisión ni pool', async () => {
  const db = student(TEAM_A_UID);
  await assertFails(updateDoc(doc(db, activityPath), { state: 'closed' }));
  await assertFails(updateDoc(doc(db, activityPath), { revision: 99 }));
  await assertFails(updateDoc(doc(db, activityPath), { activeDayIndex: 2 }));
  await assertFails(updateDoc(doc(db, activityPath), { days: [{ ...DAYS[0], artistCount: 1 }] }));
  await assertFails(updateDoc(doc(db, activityPath), { activeArtistIds: ['a1'] }));
  await assertFails(setDoc(doc(db, `${activityPath}/artists/a1`), { cost: 0 }, { merge: true }));
});

test('el docente sí puede avanzar el día y reabrir', async () => {
  await assertSucceeds(updateDoc(doc(teacher(), activityPath), { activeDayIndex: 1, state: 'active' }));
  await assertSucceeds(updateDoc(doc(teacher(), activityPath), { revision: 2, reopenedFrom: 0 }));
});

test('la bitácora es de sólo lectura docente y no se puede editar el pasado', async () => {
  await assertFails(getDocs(collection(student(TEAM_A_UID), `${activityPath}/events`)));
  const created = await assertSucceeds(addDoc(collection(teacher(), `${activityPath}/events`), {
    type: 'start', text: 'La actividad comenzó.', actorUid: TEACHER, createdAt: new Date()
  }));
  await assertFails(updateDoc(doc(teacher(), `${activityPath}/events/${created.id}`), { text: 'otra cosa' }));
  await assertFails(deleteDoc(doc(teacher(), `${activityPath}/events/${created.id}`)));
});

test('un estudiante no puede falsificar el actor de un evento', async () => {
  await assertFails(addDoc(collection(student(TEAM_A_UID), `${activityPath}/events`), {
    type: 'start', text: 'hackeo', actorUid: TEACHER, createdAt: new Date()
  }));
});

// ---------------------------------------------------------------------------
// Equipos
// ---------------------------------------------------------------------------

test('un equipo nuevo nace reclamado por quien lo crea', async () => {
  await assertSucceeds(setDoc(doc(student('uid-nuevo'), `${activityPath}/teams/equipo-c`), {
    name: 'Equipo C', memberUids: ['uid-nuevo']
  }));
  await assertFails(setDoc(doc(student('uid-nuevo'), `${activityPath}/teams/equipo-d`), {
    name: 'Equipo D', memberUids: ['uid-nuevo', 'otro-uid']
  }));
});

test('con teamJoinPolicy abierta un segundo dispositivo puede sumarse, pero no expulsar', async () => {
  const db = student('uid-segundo');
  await assertSucceeds(updateDoc(doc(db, `${activityPath}/teams/equipo-a`), {
    name: 'Equipo A', memberUids: [TEAM_A_UID, 'uid-segundo']
  }));
  await assertFails(updateDoc(doc(student(INTRUDER), `${activityPath}/teams/equipo-a`), {
    name: 'Equipo A', memberUids: [INTRUDER]
  }));
});

test('con teamJoinPolicy cerrada un intruso no puede unirse', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), activityPath), { teamJoinPolicy: 'locked' });
  });
  await assertFails(updateDoc(doc(student(INTRUDER), `${activityPath}/teams/equipo-a`), {
    name: 'Equipo A', memberUids: [TEAM_A_UID, INTRUDER]
  }));
});

// ---------------------------------------------------------------------------
// Borradores
// ---------------------------------------------------------------------------

test('cada equipo escribe sólo su propio borrador', async () => {
  const payload = { selections: { friday: ['a1'] }, statuses: { friday: 'editable' }, revision: 1 };
  await assertSucceeds(setDoc(doc(student(TEAM_A_UID), `${activityPath}/teams/equipo-a/drafts/1`), payload));
  await assertFails(setDoc(doc(student(TEAM_B_UID), `${activityPath}/teams/equipo-a/drafts/1`), payload));
  await assertFails(setDoc(doc(student(INTRUDER), `${activityPath}/teams/equipo-a/drafts/1`), payload));
});

test('un equipo no puede leer el borrador de otro', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), `${activityPath}/teams/equipo-a/drafts/1`), { selections: {}, statuses: {}, revision: 1 });
  });
  await assertSucceeds(getDoc(doc(student(TEAM_A_UID), `${activityPath}/teams/equipo-a/drafts/1`)));
  await assertFails(getDoc(doc(student(TEAM_B_UID), `${activityPath}/teams/equipo-a/drafts/1`)));
  await assertSucceeds(getDoc(doc(teacher(), `${activityPath}/teams/equipo-a/drafts/1`)));
});

test('el borrador debe corresponder a la revisión vigente', async () => {
  const payload = { selections: { friday: [] }, statuses: { friday: 'editable' }, revision: 2 };
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/teams/equipo-a/drafts/2`), payload));
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), activityPath), { revision: 2 });
  });
  await assertSucceeds(setDoc(doc(student(TEAM_A_UID), `${activityPath}/teams/equipo-a/drafts/2`), payload));
});

test('con la actividad cerrada el borrador queda congelado', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), activityPath), { state: 'closed' });
  });
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/teams/equipo-a/drafts/1`), {
    selections: { friday: ['a1'] }, statuses: { friday: 'editable' }, revision: 1
  }));
});

// ---------------------------------------------------------------------------
// Entregas
// ---------------------------------------------------------------------------

test('una entrega bien formada del propio equipo se acepta', async () => {
  await assertSucceeds(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/equipo-a__friday__r1`), validSubmission()));
});

test('el servidor rechaza un lineup con la cantidad equivocada de artistas', async () => {
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x1`), validSubmission({ selections: ['a1', 'a2'] })));
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x2`), validSubmission({ selections: ['a1', 'a2', 'a3', 'a4'] })));
});

test('el servidor rechaza artistas repetidos', async () => {
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x3`), validSubmission({ selections: ['a1', 'a1', 'a2'] })));
});

test('el servidor rechaza artistas fuera del pool activo', async () => {
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x4`), validSubmission({ selections: ['a1', 'a2', 'inventado'] })));
});

test('el servidor rechaza entregas de un día que no está activo en modo secuencial', async () => {
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x5`), validSubmission({
    dayId: 'saturday', dayIndex: 1, selections: ['a1', 'a2', 'a3', 'a4']
  })));
});

test('en modo simultáneo sí se aceptan los tres días', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), activityPath), { mode: 'simultaneous' });
  });
  await assertSucceeds(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x6`), validSubmission({
    dayId: 'saturday', dayIndex: 1, selections: ['a1', 'a2', 'a3', 'a4']
  })));
});

test('el servidor rechaza entregas de una revisión vencida', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), activityPath), { revision: 3 });
  });
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x7`), validSubmission({ revision: 1 })));
  await assertSucceeds(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x8`), validSubmission({ revision: 3 })));
});

test('un estudiante no puede entregar por otro equipo ni firmar como otro uid', async () => {
  await assertFails(setDoc(doc(student(TEAM_B_UID), `${activityPath}/submissions/x9`), validSubmission()));
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x10`), validSubmission({ submittedBy: TEACHER })));
});

test('un estudiante no puede autovalidarse', async () => {
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x11`), validSubmission({ validationStatus: 'validated' })));
  await assertFails(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/x12`), validSubmission({ validatedAt: new Date() })));
});

test('una entrega enviada es inmutable para el estudiante', async () => {
  const path = `${activityPath}/submissions/equipo-a__friday__r1`;
  await setDoc(doc(student(TEAM_A_UID), path), validSubmission());
  await assertFails(updateDoc(doc(student(TEAM_A_UID), path), { selections: ['a4', 'a5', 'a6'] }));
  await assertFails(updateDoc(doc(student(TEAM_A_UID), path), { validationStatus: 'validated' }));
  await assertFails(deleteDoc(doc(student(TEAM_A_UID), path)));
});

test('el docente valida y devuelve, pero no puede reescribir el lineup entregado', async () => {
  const path = `${activityPath}/submissions/equipo-a__friday__r1`;
  await setDoc(doc(student(TEAM_A_UID), path), validSubmission());
  await assertSucceeds(updateDoc(doc(teacher(), path), { validationStatus: 'validated', validatedAt: new Date(), validatedBy: TEACHER }));
  await assertSucceeds(updateDoc(doc(otherTeacher(), path), { validationStatus: 'returned', validatedAt: null, validatedBy: null }));
  await assertFails(updateDoc(doc(teacher(), path), { selections: ['a4', 'a5', 'a6'] }));
  await assertFails(updateDoc(doc(teacher(), path), { revision: 9 }));
});

test('el docente puede marcar el día como needs_revalidation en el borrador del equipo', async () => {
  await assertSucceeds(setDoc(doc(teacher(), `${activityPath}/teams/equipo-a/drafts/1`), {
    selections: { friday: ['a1'] }, statuses: { friday: 'needs_revalidation' }, revision: 1
  }, { merge: true }));
});

test('reabrir conserva la entrega anterior: la revisión vieja sigue existiendo', async () => {
  const oldPath = `${activityPath}/submissions/equipo-a__friday__r1`;
  await setDoc(doc(student(TEAM_A_UID), oldPath), validSubmission());
  await assertSucceeds(updateDoc(doc(teacher(), activityPath), { revision: 2, reopenedFrom: 0 }));
  const survivor = await getDoc(doc(teacher(), oldPath));
  assert.equal(survivor.exists(), true);
  assert.deepEqual(survivor.data().selections, ['a1', 'a2', 'a3']);
  await assertSucceeds(setDoc(doc(student(TEAM_A_UID), `${activityPath}/submissions/equipo-a__friday__r2`), validSubmission({ revision: 2 })));
});
