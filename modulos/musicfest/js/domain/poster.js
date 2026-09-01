// MusicFest · modelo del cartel.
//
// El cartel no es decoración: es la lectura visual de la decisión de
// optimización. La jerarquía tipográfica sale de la popularidad —la función
// objetivo— y el pie muestra cuánta holgura queda en cada restricción, para que
// el equipo vea de un vistazo si su solución está pegada a la frontera.
//
// Módulo puro: sin DOM, sin Firebase. Lo consume tanto la vista como las pruebas.

import { validate, genres } from './game.js';

/**
 * Agrupa por popularidad en tres niveles relativos al propio lineup: los del
 * valor máximo son cabeza de cartel, los del siguiente valor van en medio y el
 * resto abajo. Relativo y no absoluto para que un lineup modesto también tenga
 * headliner y el cartel nunca se lea plano.
 */
export function tiersByPopularity(chosen) {
  const ordenados = [...chosen].sort((a, b) =>
    b.popularity - a.popularity || a.name.localeCompare(b.name));
  const valores = [...new Set(ordenados.map(a => a.popularity))];
  return [
    ordenados.filter(a => a.popularity === valores[0]),
    ordenados.filter(a => a.popularity === valores[1]),
    ordenados.filter(a => valores.slice(2).includes(a.popularity))
  ];
}

/** Holgura de cada restricción, para dibujar las barras del pie. */
export function limits(totals, day) {
  const barra = (usado, tope) => ({
    usado, tope,
    ratio: tope > 0 ? Math.min(usado / tope, 1) : 0,
    alLimite: tope > 0 && usado / tope >= 0.95
  });
  const generosDistintos = Object.values(totals.genres).filter(Boolean).length;
  return {
    presupuesto: barra(totals.cost, day.budget),
    duracion: barra(totals.duration, day.duration),
    chilenos: { usado: totals.chilean, tope: day.minChilean, ratio: day.minChilean ? Math.min(totals.chilean / day.minChilean, 1) : 1, alLimite: false },
    generos: { usado: generosDistintos, tope: day.minGenres, ratio: day.minGenres ? Math.min(generosDistintos / day.minGenres, 1) : 1, alLimite: false }
  };
}

/**
 * @param {string[]} selections ids del lineup
 * @param {object} day regla del día
 * @param {Array} artists pool con el que se evalúa
 * @param {{teamName?:string, activityName?:string, revision?:number, status?:string}} meta
 */
export function posterModel(selections, day, artists, meta = {}) {
  const porId = new Map(artists.map(a => [a.id, a]));
  const chosen = (selections || []).map(id => porId.get(id)).filter(Boolean);
  const result = validate(selections || [], day, artists);

  return {
    day,
    teamName: meta.teamName || 'Equipo',
    activityName: meta.activityName || 'MusicFest',
    revision: meta.revision || 1,
    status: meta.status || 'editable',
    artists: chosen,
    tiers: tiersByPopularity(chosen),
    totals: result.totals,
    checks: result.checks,
    valid: result.valid,
    limits: limits(result.totals, day),
    genreBreakdown: genres.map(g => ({ genre: g, count: result.totals.genres[g] || 0 })),
    empty: chosen.length === 0
  };
}

/** Cartel de los tres días: un bloque por día más el agregado del festival. */
export function festivalModel(selectionsByDay, days, artists, meta = {}) {
  const bloques = days.map(day => posterModel(selectionsByDay?.[day.id] || [], day, artists, meta));
  const suma = (fn) => bloques.reduce((total, b) => total + fn(b), 0);
  return {
    ...meta,
    days: bloques,
    totals: {
      artists: suma(b => b.artists.length),
      cost: suma(b => b.totals.cost),
      duration: Number(suma(b => b.totals.duration).toFixed(2)),
      score: suma(b => b.totals.score),
      chilean: suma(b => b.totals.chilean)
    },
    caps: {
      cost: days.reduce((t, d) => t + d.budget, 0),
      duration: days.reduce((t, d) => t + d.duration, 0),
      artists: days.reduce((t, d) => t + d.artistCount, 0)
    },
    valid: bloques.every(b => b.valid),
    empty: bloques.every(b => b.empty)
  };
}

/** Nombre de archivo para la descarga: sin acentos ni espacios. */
export const posterFilename = (teamName, dayName) =>
  ['musicfest', teamName, dayName]
    .map(part => String(part || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    .filter(Boolean).join('-') + '.png';
