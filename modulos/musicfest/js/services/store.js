// MusicFest · fachada de persistencia.
//
// Expone exactamente la API que ya usaban student.js y admin.js
// (loadSession, ensureSession, saveSession, loadDraft, saveDraft, listDrafts,
// setSubmissionStatus, watchSession) y decide en tiempo de carga si la sirve
// local-store.js (modo demo, sin Firebase) o remote-store.js (Firestore).
//
// Mismo patrón que `store` en La Odisea: un único objeto, dos implementaciones.

import { enabled } from './firebase-config.js';
import * as local from './local-store.js';
import { days as defaultDays } from '../domain/game.js';

let remote = null;
if (enabled) remote = await import('./remote-store.js');

export const usingFirebase = enabled;
export const backend = enabled ? 'firebase' : 'local';

// ---------------------------------------------------------------------------
// Conexión
// ---------------------------------------------------------------------------

/**
 * `emails` son los correos @udd.cl de la pareja, en orden de campo —primero
 * quien opera— y ya validados por js/domain/correo.js. Puede venir vacío:
 * ninguno de los dos campos obliga. En modo demo no hay dónde guardarlos
 * —no existe la colección de equipos— así que se devuelven y nada más.
 *
 * @param {{code:string, role?:'admin'|'student', teamName?:string, emails?:string[], create?:boolean}} options
 */
export async function connect(options) {
  if (!remote) {
    const session = local.ensureSession(options.code);
    session.days = session.days || defaultDays.map(d => structuredClone(d));
    local.saveSession(session);
    return { activityId: `local:${session.code}`, teamId: options.teamName || null, uid: 'local', emails: options.emails || [] };
  }
  return remote.connect(options);
}

export const disconnect = () => (remote ? remote.disconnect() : Promise.resolve());
export const status = () => (remote ? remote.status() : { ready: true, role: 'local', backend: 'local', pendingWrites: false });
export const activityId = () => (remote ? remote.activityId() : null);

// ---------------------------------------------------------------------------
// API heredada
// ---------------------------------------------------------------------------

export const loadSession = code => (remote ? remote.loadSession(code) : local.loadSession(code));
export const ensureSession = code => (remote ? remote.ensureSession(code) : local.ensureSession(code));
export const saveSession = session => (remote ? remote.saveSession(session) : local.saveSession(session));
export const loadDraft = (code, team) => (remote ? remote.loadDraft(code, team) : local.loadDraft(code, team));
export const saveDraft = (code, draft) => (remote ? remote.saveDraft(code, draft) : local.saveDraft(code, draft));
export const listDrafts = code => (remote ? remote.listDrafts(code) : local.listDrafts(code));
export const watchSession = (code, cb) => (remote ? remote.watchSession(code, cb) : local.watchSession(code, cb));
export const setSubmissionStatus = (code, team, dayId, state) =>
  (remote ? remote.setSubmissionStatus(code, team, dayId, state) : local.setSubmissionStatus(code, team, dayId, state));

// ---------------------------------------------------------------------------
// Operaciones docentes
// ---------------------------------------------------------------------------

const LOCAL_TRANSITIONS = {
  start: session => { session.state = 'active'; return 'La actividad comenzó.'; },
  pause: session => { session.state = session.state === 'paused' ? 'active' : 'paused'; return session.state === 'paused' ? 'Actividad pausada.' : 'Actividad reanudada.'; },
  close: session => { session.state = 'closed'; return 'Actividad cerrada.'; },
  advance: session => {
    const last = (session.days?.length || 3) - 1;
    if (session.activeDayIndex >= last) throw new Error('Ya estás en el último día.');
    session.activeDayIndex++; session.state = 'active';
    return `Avance a ${session.days[session.activeDayIndex].name}.`;
  },
  back: session => {
    if (session.activeDayIndex <= 0) throw new Error('Ya estás en el primer día.');
    session.activeDayIndex--;
    return `Vista docente volvió a ${session.days[session.activeDayIndex].name}.`;
  }
};

export async function transition(code, kind, options = {}) {
  if (remote) return remote.transition(kind, options);
  const session = local.ensureSession(code);
  const summary = LOCAL_TRANSITIONS[kind](session);
  session.events = [{ type: kind, text: summary, at: new Date().toISOString() }, ...(session.events || [])].slice(0, 20);
  local.saveSession(session);
  return summary;
}

export async function reopenDay(code, dayIndex) {
  if (remote) return remote.reopenDay(dayIndex);
  const session = local.ensureSession(code);
  session.revision = (session.revision || 1) + 1;
  session.reopenedFrom = dayIndex;
  session.activeDayIndex = dayIndex;
  session.state = 'active';
  const summary = `${session.days[dayIndex].name} y días posteriores reabiertos · revisión ${session.revision}.`;
  session.events = [{ type: 'reopen', text: summary, at: new Date().toISOString() }, ...(session.events || [])].slice(0, 20);
  local.saveSession(session);
  return summary;
}

// En modo demo no hay índice de códigos: la única partida es la del navegador.
export const listActivityCodes = () => (remote ? remote.listActivityCodes() : Promise.resolve([]));

// El panel docente necesita el código de la partida para el modo demo: ahí los
// equipos se deducen de los borradores en localStorage, no hay colección.
export const listTeams = code => (remote ? remote.listTeams() : local.listDrafts(code).map(d => ({ id: d.team, name: d.team })));
export const releaseTeam = teamId => (remote ? remote.releaseTeam(teamId) : Promise.resolve());
export const flushSession = () => (remote ? remote.flushSession() : Promise.resolve());
export const setArtistCover = (artistId, cover) => (remote ? remote.setArtistCover(artistId, cover) : Promise.resolve());
