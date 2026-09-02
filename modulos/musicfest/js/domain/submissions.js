// MusicFest · recálculo autoritativo de entregas.
//
// Sin Cloud Functions, el cliente estudiante calcula sus totales. Las reglas de
// Firestore verifican la ESTRUCTURA del lineup (tamaño, duplicados, artistas
// dentro del pool, revisión y día vigentes), pero no pueden sumar costos ni
// popularidad. Por eso el panel docente NUNCA confía en los números enviados:
// los recalcula aquí desde `selections` + el pool + las reglas del día, y marca
// cualquier discrepancia. El ranking y los diagnósticos usan sólo estos valores.

import { validate, totals } from './game.js';

// Firestore NO admite arrays dentro de arrays. `validate()` devuelve los checks
// como [nombre, ok, valor], así que hay que aplanarlos a mapas antes de
// escribirlos. Sin esto, cada entrega falla con `invalid-argument`.
export const serializeChecks = checks =>
  (checks || []).map(check => (Array.isArray(check)
    ? { name: check[0], ok: Boolean(check[1]), value: String(check[2] ?? '') }
    : { name: check.name, ok: Boolean(check.ok), value: String(check.value ?? '') }));

export const deserializeChecks = list =>
  (list || []).map(check => (Array.isArray(check) ? check : [check.name, check.ok, check.value]));

/**
 * @param {{selections:string[], dayId:string, reportedTotals?:object}} submission
 * @param {{days:Array, artists:Array}} context
 */
export function recomputeSubmission(submission, { days, artists }) {
  if (!submission) {
    return { day: null, totals: totals([], artists), checks: [], valid: false, missing: [], duplicated: false, tampered: true, deltas: ['Entrega inexistente'] };
  }
  const day = days.find(d => d.id === submission.dayId) || days[submission.dayIndex] || null;
  const selections = Array.isArray(submission.selections) ? submission.selections : [];
  const pool = new Map(artists.map(a => [a.id, a]));

  const missing = selections.filter(id => !pool.has(id));
  const duplicated = selections.length !== new Set(selections).size;

  if (!day) {
    return { day: null, totals: totals(selections, artists), checks: [], valid: false, missing, duplicated, tampered: true, deltas: ['Día desconocido'] };
  }

  const result = validate(selections, day, artists);
  const reported = submission.reportedTotals || submission.totals || null;
  const deltas = [];
  if (reported) {
    for (const key of ['count', 'cost', 'duration', 'score', 'chilean']) {
      if (Number(reported[key]) !== Number(result.totals[key])) {
        deltas.push(`${key}: informado ${reported[key]} · recalculado ${result.totals[key]}`);
      }
    }
  }
  if (missing.length) deltas.push(`Artistas fuera del pool: ${missing.join(', ')}`);
  if (duplicated) deltas.push('Hay artistas repetidos en el lineup.');

  return {
    day,
    totals: result.totals,
    checks: result.checks,
    valid: result.valid && !missing.length && !duplicated,
    missing,
    duplicated,
    tampered: deltas.length > 0,
    deltas
  };
}

/**
 * Estado observable de cada equipo al cerrar la actividad.
 *
 * La ausencia de una entrega no basta para afirmar que el equipo quedó
 * infactible: también puede haber tenido un lineup válido y no haber pulsado
 * confirmar. Esta auditoría contrasta la entrega con el último borrador y
 * conserva esa diferencia, que es indispensable para interpretar H5.
 */
export function auditarCierre(drafts = [], { revision, days = [], artists = [] } = {}) {
  return drafts.map(draft => {
    const porDia = {};

    days.forEach((day, dayIndex) => {
      const selections = [...(draft?.selections?.[day.id] || [])];
      const candidate = draft?.submissions?.[day.id] || null;
      const submission = candidate && (revision === undefined || (candidate.revision || 1) === revision)
        ? candidate : null;
      const computed = recomputeSubmission(submission || {
        teamId: draft.teamId,
        teamName: draft.team,
        dayId: day.id,
        dayIndex,
        revision: revision ?? draft.revision ?? 1,
        selections
      }, { days, artists });
      const failures = computed.checks
        .filter(check => !check[1])
        .map(check => ({ name: check[0], value: check[2] }));

      let reason = 'sent';
      if (!submission) {
        if (!selections.length) reason = 'no_activity';
        else if (computed.valid) reason = 'valid_unsubmitted';
        else if (selections.length < day.artistCount) reason = 'incomplete';
        else if (failures.some(f => f.name === 'Talento chileno')) reason = 'missing_chilean';
        else reason = 'other_constraints';
      }

      porDia[day.id] = {
        sent: Boolean(submission),
        reason,
        valid: computed.valid,
        selections: selections.length,
        failures,
        submission
      };
    });

    return {
      team: draft.team,
      teamId: draft.teamId || null,
      revision: revision ?? draft.revision ?? 1,
      days: porDia,
      allSent: days.length > 0 && days.every(day => porDia[day.id]?.sent)
    };
  });
}

/** Detecta si un mismo artista aparece en más de un día del mismo equipo. */
export function crossDayConflicts(selectionsByDay) {
  const seen = new Map();
  const conflicts = [];
  for (const [dayId, ids] of Object.entries(selectionsByDay || {})) {
    for (const id of ids || []) {
      if (seen.has(id)) conflicts.push({ artistId: id, days: [seen.get(id), dayId] });
      else seen.set(id, dayId);
    }
  }
  return conflicts;
}

/**
 * Ranking: usa entregas de la revisión vigente y las valida automáticamente
 * mediante el recálculo autoritativo. `onlyValidated` se conserva únicamente
 * para consultar cohortes antiguas que sí usaron aprobación manual.
 */
export function buildLeaderboard(submissions, { revision, days, artists, onlyValidated = false } = {}) {
  const byTeam = new Map();
  for (const submission of submissions) {
    if (revision !== undefined && (submission.revision || 1) !== revision) continue;
    if (onlyValidated && submission.validationStatus !== 'validated') continue;
    const recomputed = recomputeSubmission(submission, { days, artists });
    if (!recomputed.valid) continue;
    const entry = byTeam.get(submission.teamId) || { teamId: submission.teamId, teamName: submission.teamName || submission.teamId, score: 0, cost: 0, days: [] };
    entry.score += recomputed.totals.score;
    entry.cost += recomputed.totals.cost;
    entry.days.push({ dayId: submission.dayId, score: recomputed.totals.score });
    byTeam.set(submission.teamId, entry);
  }
  return [...byTeam.values()].sort((a, b) => b.score - a.score || a.cost - b.cost || a.teamName.localeCompare(b.teamName));
}
