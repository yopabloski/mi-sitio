// MusicFest · adaptador Firestore con la API de local-store.js.
//
// Estrategia: `connect()` es asíncrono y deja hidratado un espejo en memoria
// alimentado por onSnapshot. A partir de ahí, loadSession/loadDraft/listDrafts
// siguen siendo SÍNCRONOS y saveSession/saveDraft escriben en segundo plano.
// Así student.js y admin.js conservan su forma original.

import { paths, normalizeCode, normalizeTeamId } from './firebase-config.js';
import { sdk, signInStudent, currentUser } from './firebase.js';
import { artists as seedArtists, artwork as seedArtwork } from '../data/artists.js';
import { syncedArtwork, releaseInfo as seedReleaseInfo } from '../data/covers.generated.js';
import { days as defaultDays } from '../domain/game.js';
import { toArtistDocs, fromArtistDocs, sameArtist } from '../domain/activity-mapper.js';
import { serializeChecks } from '../domain/submissions.js';
import { validarCorreos } from '../domain/correo.js';
import { decidirIngreso, politicaDe, mensajeNombreTomado, miembrosTras, POLITICAS } from '../domain/equipos.js';

const SEED_IDS = new Set(seedArtists.map(a => a.id));
// Tope defensivo: un equipo de aula no pasa de un puñado de personas y el
// documento no es lugar para una lista que crezca sin límite.
const MAX_TEAM_EMAILS = 12;
const clone = value => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
const nowIso = () => new Date().toISOString();

const state = {
  ready: false,
  role: 'student',
  uid: null,
  code: null,
  activityId: null,
  activity: null,
  artistDocs: new Map(),
  events: [],
  teams: new Map(),
  drafts: new Map(),          // teamId -> { selections, statuses, revision }
  submissions: new Map(),     // submissionId -> data
  teamId: null,
  teamName: null,
  emails: [],                // correos @udd.cl de la pareja, si los dieron
  session: null,              // objeto legacy compuesto
  remote: null,               // último snapshot compuesto (base del diff)
  unsubscribe: [],
  draftUnsubscribe: new Map(),
  subscribers: new Set(),
  pendingSession: null,
  sessionTimer: null,
  draftTimers: new Map(),
  lastError: null
};

export const status = () => ({
  ready: state.ready, role: state.role, uid: state.uid,
  activityId: state.activityId, code: state.code,
  teamId: state.teamId, error: state.lastError,
  pendingWrites: Boolean(state.pendingSession) || state.draftTimers.size > 0
});

export const activityId = () => state.activityId;

// ---------------------------------------------------------------------------
// Composición: documentos Firestore -> objeto `session` heredado
// ---------------------------------------------------------------------------

function composeSession() {
  const activity = state.activity;
  if (!activity) return null;
  const session = fromArtistDocs({ ...activity, days: activity.days || defaultDays }, state.artistDocs.values(), SEED_IDS);
  session.days = clone(session.days);
  session.events = clone(state.events);
  session.updatedAt = activity.updatedAt || nowIso();
  return session;
}

function refreshSession() {
  state.session = composeSession();
  state.remote = state.session ? clone(state.session) : null;
  if (state.session) {
    for (const cb of state.subscribers) { try { cb(clone(state.session)); } catch (error) { console.error(error); } }
    dispatchEvent(new CustomEvent('musicfest-session', { detail: clone(state.session) }));
  }
}

function notifyDrafts() {
  dispatchEvent(new CustomEvent('musicfest-draft', { detail: { code: state.code } }));
}

// ---------------------------------------------------------------------------
// Creación / apertura de la actividad
// ---------------------------------------------------------------------------

function seedArtistDoc(artist, index) {
  const cover = seedArtwork[artist.id] || syncedArtwork[artist.id] || '';
  const info = seedReleaseInfo[artist.id] || {};
  return {
    id: artist.id, name: artist.name, genre: artist.genre, country: artist.country,
    cost: artist.cost, popularity: artist.popularity, duration: artist.duration,
    base: true, order: index,
    artworkUrl: cover, artworkStoragePath: '',
    artworkStatus: cover ? (info.review || 'pending') : 'none',
    album: info.album || '', albumYear: info.year || '', sourceUrl: info.url || ''
  };
}

async function resolveActivityId(code, { create, ownerUid }) {
  const { db, fsMod } = await sdk();
  const key = normalizeCode(code) || 'demo';
  const codeRef = fsMod.doc(db, paths.codes, key);
  const codeSnap = await fsMod.getDoc(codeRef);
  if (codeSnap.exists() && codeSnap.data().activityId) return codeSnap.data().activityId;
  if (!create) return null;

  const id = `mf-${key}-${Math.random().toString(36).slice(2, 8)}`;
  const batch = fsMod.writeBatch(db);
  const activityRef = fsMod.doc(db, paths.activities, id);
  batch.set(activityRef, {
    code: String(code).trim().toUpperCase(),
    name: 'MusicFest',
    ownerUid,
    mode: 'sequential',
    state: 'lobby',
    activeDayIndex: 0,
    revision: 1,
    reopenedFrom: 0,
    days: clone(defaultDays),
    activeArtistIds: seedArtists.map(a => a.id),
    deletedArtistIds: [],
    catalogLocked: false,
    teamJoinPolicy: POLITICAS.UNICA,   // nombres únicos por partida; el panel docente lo puede abrir
    schemaVersion: 2,
    createdAt: fsMod.serverTimestamp(),
    updatedAt: fsMod.serverTimestamp()
  });
  seedArtists.forEach((artist, index) => {
    batch.set(fsMod.doc(db, paths.activities, id, 'artists', artist.id), seedArtistDoc(artist, index));
  });
  batch.set(codeRef, { activityId: id, code: String(code).trim().toUpperCase(), ownerUid, updatedAt: fsMod.serverTimestamp() });
  await batch.commit();
  return id;
}

// ---------------------------------------------------------------------------
// Suscripciones
// ---------------------------------------------------------------------------

async function subscribeCore() {
  const { db, fsMod } = await sdk();
  const base = fsMod.doc(db, paths.activities, state.activityId);

  await new Promise((resolve, reject) => {
    let settled = false;
    state.unsubscribe.push(fsMod.onSnapshot(base, snapshot => {
      state.activity = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      if (state.activity?.updatedAt?.toDate) state.activity.updatedAt = state.activity.updatedAt.toDate().toISOString();
      refreshSession();
      if (!settled) { settled = true; resolve(); }
    }, error => { state.lastError = error; if (!settled) { settled = true; reject(error); } }));
  });

  await new Promise((resolve, reject) => {
    let settled = false;
    state.unsubscribe.push(fsMod.onSnapshot(fsMod.collection(db, paths.activities, state.activityId, 'artists'), snapshot => {
      state.artistDocs = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
      refreshSession();
      if (!settled) { settled = true; resolve(); }
    }, error => { state.lastError = error; if (!settled) { settled = true; reject(error); } }));
  });
}

async function subscribeTeacher() {
  const { db, fsMod } = await sdk();
  const root = [paths.activities, state.activityId];

  state.unsubscribe.push(fsMod.onSnapshot(
    fsMod.query(fsMod.collection(db, ...root, 'events'), fsMod.orderBy('createdAt', 'desc'), fsMod.limit(20)),
    snapshot => {
      state.events = snapshot.docs.map(d => {
        const data = d.data();
        return { id: d.id, type: data.type, text: data.text, at: data.createdAt?.toDate?.().toISOString() || data.at || nowIso() };
      });
      refreshSession();
    },
    error => { state.lastError = error; }
  ));

  state.unsubscribe.push(fsMod.onSnapshot(fsMod.collection(db, ...root, 'teams'), snapshot => {
    state.teams = new Map(snapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    for (const [teamId, stop] of state.draftUnsubscribe) {
      if (!state.teams.has(teamId)) { stop(); state.draftUnsubscribe.delete(teamId); state.drafts.delete(teamId); }
    }
    for (const teamId of state.teams.keys()) {
      if (state.draftUnsubscribe.has(teamId)) continue;
      const stop = fsMod.onSnapshot(fsMod.collection(db, ...root, 'teams', teamId, 'drafts'), draftSnap => {
        const latest = draftSnap.docs
          .map(d => ({ revision: Number(d.id) || 1, ...d.data() }))
          .sort((a, b) => b.revision - a.revision)[0];
        if (latest) state.drafts.set(teamId, latest); else state.drafts.delete(teamId);
        notifyDrafts();
      }, error => { state.lastError = error; });
      state.draftUnsubscribe.set(teamId, stop);
    }
    notifyDrafts();
  }, error => { state.lastError = error; }));

  state.unsubscribe.push(fsMod.onSnapshot(fsMod.collection(db, ...root, 'submissions'), snapshot => {
    state.submissions = new Map(snapshot.docs.map(d => {
      const data = d.data();
      return [d.id, {
        id: d.id, ...data,
        submittedAt: data.submittedAt?.toDate?.().toISOString() || data.submittedAt || nowIso(),
        validatedAt: data.validatedAt?.toDate?.().toISOString() || data.validatedAt || null
      }];
    }));
    notifyDrafts();
  }, error => { state.lastError = error; }));
}

async function subscribeTeam(teamId) {
  const { db, fsMod } = await sdk();
  const root = [paths.activities, state.activityId];

  await new Promise(resolve => {
    let settled = false;
    state.unsubscribe.push(fsMod.onSnapshot(fsMod.collection(db, ...root, 'teams', teamId, 'drafts'), snapshot => {
      const latest = snapshot.docs
        .map(d => ({ revision: Number(d.id) || 1, ...d.data() }))
        .sort((a, b) => b.revision - a.revision)[0];
      if (latest) state.drafts.set(teamId, latest);
      notifyDrafts();
      if (!settled) { settled = true; resolve(); }
    }, error => { state.lastError = error; if (!settled) { settled = true; resolve(); } }));
  });

  await new Promise(resolve => {
    let settled = false;
    state.unsubscribe.push(fsMod.onSnapshot(
      fsMod.query(fsMod.collection(db, ...root, 'submissions'), fsMod.where('teamId', '==', teamId)),
      snapshot => {
        for (const d of snapshot.docs) {
          const data = d.data();
          state.submissions.set(d.id, {
            id: d.id, ...data,
            submittedAt: data.submittedAt?.toDate?.().toISOString() || data.submittedAt || nowIso(),
            validatedAt: data.validatedAt?.toDate?.().toISOString() || data.validatedAt || null
          });
        }
        notifyDrafts();
        if (!settled) { settled = true; resolve(); }
      },
      error => { state.lastError = error; if (!settled) { settled = true; resolve(); } }
    ));
  });
}

// ---------------------------------------------------------------------------
// connect
// ---------------------------------------------------------------------------

export async function connect({ code, role = 'student', teamName = null, emails = [], create = false, ownerUid = null } = {}) {
  await disconnect();
  state.role = role;
  // Los correos son opcionales: si vienen mal formados se ignoran en silencio
  // en vez de impedir la entrada. La interfaz ya avisó antes de llegar hasta acá.
  const revisados = validarCorreos(emails);
  state.emails = revisados.ok ? revisados.correos : [];
  state.code = String(code || 'DEMO').trim().toUpperCase();

  const user = role === 'admin' ? await currentUser() : await signInStudent();
  state.uid = user?.uid || null;

  state.activityId = await resolveActivityId(state.code, { create: create || role === 'admin', ownerUid: ownerUid || state.uid });
  if (!state.activityId) throw new Error(`No existe ninguna actividad con el código ${state.code}.`);

  await subscribeCore();

  if (role === 'admin') {
    await subscribeTeacher();
  } else if (teamName) {
    state.teamId = await joinTeam(teamName, state.emails);
    await subscribeTeam(state.teamId);
  }

  state.ready = true;
  return { activityId: state.activityId, teamId: state.teamId, uid: state.uid };
}

export async function disconnect() {
  state.unsubscribe.forEach(stop => { try { stop(); } catch {} });
  state.draftUnsubscribe.forEach(stop => { try { stop(); } catch {} });
  state.unsubscribe = [];
  state.draftUnsubscribe.clear();
  state.artistDocs.clear();
  state.teams.clear();
  state.drafts.clear();
  state.submissions.clear();
  state.events = [];
  state.activity = null;
  state.session = null;
  state.remote = null;
  state.emails = [];
  state.ready = false;
}

// ---------------------------------------------------------------------------
// Equipos
// ---------------------------------------------------------------------------

export async function joinTeam(name, emails = []) {
  const { db, fsMod } = await sdk();
  const teamId = normalizeTeamId(name);
  const ref = fsMod.doc(db, paths.activities, state.activityId, 'teams', teamId);
  const snapshot = await fsMod.getDoc(ref);
  const datos = snapshot.exists() ? snapshot.data() : {};
  state.teamName = String(name).trim();

  // Quién puede entrar lo decide js/domain/equipos.js; acá sólo se ejecuta.
  const miembros = datos.memberUids || [];
  const { accion, permitido } = decidirIngreso({
    existe: snapshot.exists(),
    miembros,
    uid: state.uid,
    politica: politicaDe(state.activity)
  });
  if (!permitido) throw new Error(mensajeNombreTomado(state.teamName));

  // Los correos se acumulan en el equipo sin duplicados: cada dispositivo aporta
  // los de su pareja —hasta dos— y nunca se borran acá, porque quien entra
  // segundo no tiene por qué pisar lo que dejó el primero.
  const memberEmails = [...(datos.memberEmails || [])];
  for (const correo of emails) if (correo && !memberEmails.includes(correo)) memberEmails.push(correo);
  memberEmails.splice(MAX_TEAM_EMAILS);
  const memberUids = miembrosTras(accion, miembros, state.uid);

  if (accion === 'crear') {
    await fsMod.setDoc(ref, {
      name: state.teamName, memberUids, memberEmails,
      createdAt: fsMod.serverTimestamp(), lastSeenAt: fsMod.serverTimestamp()
    });
  } else {
    await fsMod.updateDoc(ref, { memberUids, memberEmails, lastSeenAt: fsMod.serverTimestamp() });
  }
  return teamId;
}

/** Docente: devuelve un equipo a estado libre para que vuelva a reclamarse. */
export async function releaseTeam(teamId) {
  const { db, fsMod } = await sdk();
  await fsMod.updateDoc(fsMod.doc(db, paths.activities, state.activityId, 'teams', teamId), { memberUids: [] });
}

export const listTeams = () => [...state.teams.values()];

// ---------------------------------------------------------------------------
// API heredada de local-store.js
// ---------------------------------------------------------------------------

export const loadSession = () => (state.session ? clone(state.session) : null);

export function ensureSession() {
  if (!state.session) throw new Error('El almacén remoto no está conectado. Llama a connect() primero.');
  return clone(state.session);
}

export function saveSession(session) {
  session.updatedAt = nowIso();
  state.pendingSession = session;
  clearTimeout(state.sessionTimer);
  state.sessionTimer = setTimeout(() => { flushSession().catch(error => { state.lastError = error; console.error('[MusicFest] Error al guardar la actividad:', error); }); }, 250);
  return session;
}

export async function flushSession() {
  const next = state.pendingSession;
  if (!next) return;
  state.pendingSession = null;
  const prev = state.remote || {};
  const { db, fsMod } = await sdk();
  const batch = fsMod.writeBatch(db);
  const activityRef = fsMod.doc(db, paths.activities, state.activityId);
  let writes = 0;

  // 1) Documento de actividad
  const activityPatch = {};
  const scalarFields = ['name', 'mode', 'state', 'activeDayIndex', 'revision', 'reopenedFrom', 'catalogLocked', 'teamJoinPolicy'];
  for (const field of scalarFields) {
    if (next[field] !== undefined && next[field] !== prev[field]) activityPatch[field] = next[field];
  }
  for (const field of ['days', 'activeArtistIds', 'deletedArtistIds']) {
    if (next[field] && JSON.stringify(next[field]) !== JSON.stringify(prev[field])) activityPatch[field] = clone(next[field]);
  }
  if (next.code && next.code !== prev.code) {
    activityPatch.code = next.code;
    batch.set(fsMod.doc(db, paths.codes, normalizeCode(next.code)), {
      activityId: state.activityId, code: next.code, ownerUid: state.uid, updatedAt: fsMod.serverTimestamp()
    });
    if (prev.code) batch.delete(fsMod.doc(db, paths.codes, normalizeCode(prev.code)));
    writes++;
  }
  if (Object.keys(activityPatch).length) {
    activityPatch.updatedAt = fsMod.serverTimestamp();
    batch.update(activityRef, activityPatch);
    writes++;
  }

  // 2) Artistas: sólo los que cambiaron
  const desired = desiredArtistDocs(next);
  for (const [id, doc] of desired) {
    const current = state.artistDocs.get(id);
    if (current && sameArtist(current, doc)) continue;
    batch.set(fsMod.doc(db, paths.activities, state.activityId, 'artists', id), { ...doc, updatedAt: fsMod.serverTimestamp() }, { merge: true });
    writes++;
  }
  for (const id of state.artistDocs.keys()) {
    if (desired.has(id)) continue;
    batch.delete(fsMod.doc(db, paths.activities, state.activityId, 'artists', id));
    writes++;
  }

  // 3) Bitácora: eventos nuevos
  const known = new Set(state.events.map(e => `${e.at}|${e.text}`));
  const fresh = (next.events || []).filter(e => !known.has(`${e.at}|${e.text}`)).reverse();
  for (const event of fresh) {
    batch.set(fsMod.doc(fsMod.collection(db, paths.activities, state.activityId, 'events')), {
      type: event.type || 'info', text: event.text || '', actorUid: state.uid,
      payload: event.payload || null, createdAt: fsMod.serverTimestamp()
    });
    writes++;
  }

  if (writes) await batch.commit();
}

const desiredArtistDocs = session => toArtistDocs(session, seedArtists, {
  keepStoragePath: id => state.artistDocs.get(id)?.artworkStoragePath || ''
});

// ---------------------------------------------------------------------------
// Borradores y entregas
// ---------------------------------------------------------------------------

const emptyDraft = (team, revision) => ({
  team,
  selections: { friday: [], saturday: [], sunday: [] },
  statuses: { friday: 'editable', saturday: 'editable', sunday: 'editable' },
  revision: revision || 1,
  submissions: {}
});

function composeDraft(teamId, teamName) {
  const revision = state.session?.revision || 1;
  const stored = state.drafts.get(teamId);
  const draft = stored
    ? { team: teamName, selections: clone(stored.selections || {}), statuses: clone(stored.statuses || {}), revision: stored.revision || revision, updatedAt: stored.updatedAt }
    : emptyDraft(teamName, revision);
  for (const day of ['friday', 'saturday', 'sunday']) {
    draft.selections[day] = draft.selections[day] || [];
    draft.statuses[day] = draft.statuses[day] || 'editable';
  }
  draft.submissions = {};
  draft.allSubmissions = [];
  for (const submission of state.submissions.values()) {
    if (submission.teamId !== teamId) continue;
    draft.allSubmissions.push(submission);
    const current = draft.submissions[submission.dayId];
    if (!current || (submission.revision || 1) >= (current.revision || 1)) draft.submissions[submission.dayId] = submission;
  }
  return draft;
}

export function loadDraft(code, team) {
  const teamId = normalizeTeamId(team);
  return composeDraft(teamId, team);
}

export function listDrafts() {
  return [...state.teams.values()].map(team => composeDraft(team.id, team.name));
}

export function saveDraft(code, draft) {
  draft.updatedAt = nowIso();
  const teamId = normalizeTeamId(draft.team);
  clearTimeout(state.draftTimers.get(teamId));
  state.draftTimers.set(teamId, setTimeout(() => {
    flushDraft(teamId, draft).catch(error => { state.lastError = error; console.error('[MusicFest] Error al guardar el borrador:', error); });
  }, 400));
  notifyDrafts();
  return draft;
}

async function flushDraft(teamId, draft) {
  const { db, fsMod } = await sdk();
  const revision = draft.revision || state.session?.revision || 1;
  const root = [paths.activities, state.activityId, 'teams', teamId];

  await fsMod.setDoc(fsMod.doc(db, ...root, 'drafts', String(revision)), {
    teamName: draft.team,
    selections: clone(draft.selections),
    statuses: clone(draft.statuses),
    revision,
    updatedBy: state.uid,
    updatedAt: fsMod.serverTimestamp()
  }, { merge: true });

  // Entregas nuevas creadas por student.js dentro de draft.submissions.
  for (const [dayId, submission] of Object.entries(draft.submissions || {})) {
    const id = `${teamId}__${dayId}__r${submission.revision || revision}`;
    if (state.submissions.has(id)) continue;
    const dayIndex = (state.session?.days || []).findIndex(d => d.id === dayId);
    await fsMod.setDoc(fsMod.doc(db, paths.activities, state.activityId, 'submissions', id), {
      teamId,
      teamName: draft.team,
      dayId,
      dayName: submission.dayName || dayId,
      dayIndex,
      revision: submission.revision || revision,
      selections: [...submission.selections],
      reportedTotals: submission.totals || null,
      reportedChecks: serializeChecks(submission.checks),
      validationStatus: 'pending',
      validatedAt: null,
      validatedBy: null,
      submittedBy: state.uid,
      submittedAt: fsMod.serverTimestamp()
    });
  }
}

export async function setSubmissionStatus(code, team, dayId, status) {
  const teamId = normalizeTeamId(team);
  const draft = composeDraft(teamId, team);
  const submission = draft.submissions?.[dayId];
  if (!submission) return null;
  const { db, fsMod } = await sdk();

  await fsMod.updateDoc(fsMod.doc(db, paths.activities, state.activityId, 'submissions', submission.id), {
    validationStatus: status,
    validatedAt: status === 'validated' ? fsMod.serverTimestamp() : null,
    validatedBy: status === 'validated' ? state.uid : null
  });

  if (status === 'returned') {
    const revision = draft.revision || state.session?.revision || 1;
    await fsMod.setDoc(
      fsMod.doc(db, paths.activities, state.activityId, 'teams', teamId, 'drafts', String(revision)),
      { statuses: { ...draft.statuses, [dayId]: 'needs_revalidation' }, updatedAt: fsMod.serverTimestamp() },
      { merge: true }
    );
  }
  return draft;
}

/** Escritura directa de la carátula definitiva de un artista. */
export async function setArtistCover(artistId, { url, path = '', status = 'approved', album, albumYear, sourceUrl } = {}) {
  const { db, fsMod } = await sdk();
  const patch = { artworkUrl: url || '', artworkPath: path, artworkStatus: url ? status : 'none', updatedAt: fsMod.serverTimestamp() };
  if (album !== undefined) patch.album = album;
  if (albumYear !== undefined) patch.albumYear = albumYear;
  if (sourceUrl !== undefined) patch.sourceUrl = sourceUrl;
  await fsMod.setDoc(fsMod.doc(db, paths.activities, state.activityId, 'artists', artistId), patch, { merge: true });
}

export function watchSession(code, cb) {
  state.subscribers.add(cb);
  if (state.session) cb(clone(state.session));
  return () => state.subscribers.delete(cb);
}

// ---------------------------------------------------------------------------
// Operaciones docentes transaccionales
// ---------------------------------------------------------------------------

/**
 * Avanzar, retroceder, reabrir, iniciar, pausar y cerrar se ejecutan dentro de
 * una transacción: si dos pestañas docentes actúan a la vez, gana una sola y la
 * otra reintenta sobre el estado fresco.
 */
export async function transition(kind, options = {}) {
  const { db, fsMod } = await sdk();
  const ref = fsMod.doc(db, paths.activities, state.activityId);
  let summary = null;

  await fsMod.runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error('La actividad ya no existe.');
    const data = snapshot.data();
    const lastIndex = (data.days?.length || 3) - 1;
    const patch = { updatedAt: fsMod.serverTimestamp() };

    if (kind === 'start') { patch.state = 'active'; summary = 'La actividad comenzó.'; }
    else if (kind === 'pause') { patch.state = data.state === 'paused' ? 'active' : 'paused'; summary = patch.state === 'paused' ? 'Actividad pausada.' : 'Actividad reanudada.'; }
    else if (kind === 'close') { patch.state = 'closed'; summary = 'Actividad cerrada.'; }
    else if (kind === 'advance') {
      if (data.activeDayIndex >= lastIndex) throw new Error('Ya estás en el último día.');
      patch.activeDayIndex = data.activeDayIndex + 1;
      patch.state = 'active';
      summary = `Avance a ${data.days[patch.activeDayIndex].name}.`;
    } else if (kind === 'back') {
      if (data.activeDayIndex <= 0) throw new Error('Ya estás en el primer día.');
      patch.activeDayIndex = data.activeDayIndex - 1;
      summary = `Vista docente volvió a ${data.days[patch.activeDayIndex].name}.`;
    } else if (kind === 'reopen') {
      const from = options.dayIndex ?? data.activeDayIndex;
      patch.revision = (data.revision || 1) + 1;
      patch.reopenedFrom = from;
      patch.activeDayIndex = from;
      patch.state = 'active';
      summary = `${data.days[from].name} y días posteriores reabiertos · revisión ${patch.revision}.`;
    } else {
      throw new Error(`Transición desconocida: ${kind}`);
    }

    tx.update(ref, patch);
    tx.set(fsMod.doc(fsMod.collection(db, paths.activities, state.activityId, 'events')), {
      type: kind, text: summary, actorUid: state.uid,
      payload: { from: data.activeDayIndex, revision: data.revision || 1 },
      createdAt: fsMod.serverTimestamp()
    });
  });

  return summary;
}

/**
 * Reapertura: además de subir la revisión, copia el borrador vigente de cada
 * equipo a la nueva revisión. La revisión anterior y sus entregas quedan
 * intactas como historial.
 */
export async function reopenDay(dayIndex) {
  const previousRevision = state.session?.revision || 1;
  const summary = await transition('reopen', { dayIndex });
  const { db, fsMod } = await sdk();
  const nextRevision = previousRevision + 1;
  const days = state.session?.days || [];
  const affected = days.slice(dayIndex).map(d => d.id);

  const batch = fsMod.writeBatch(db);
  for (const [teamId, draft] of state.drafts) {
    const statuses = { ...(draft.statuses || {}) };
    for (const dayId of affected) {
      statuses[dayId] = (draft.selections?.[dayId]?.length ? 'needs_revalidation' : 'editable');
    }
    batch.set(fsMod.doc(db, paths.activities, state.activityId, 'teams', teamId, 'drafts', String(nextRevision)), {
      teamName: draft.teamName || teamId,
      selections: clone(draft.selections || {}),
      statuses,
      revision: nextRevision,
      clonedFrom: previousRevision,
      updatedBy: state.uid,
      updatedAt: fsMod.serverTimestamp()
    });
  }
  await batch.commit();
  return summary;
}
