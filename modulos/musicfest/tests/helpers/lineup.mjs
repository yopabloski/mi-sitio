// Ayudante compartido por las pruebas: arma un lineup factible para un día,
// respetando cuotas de género, mínimo de chilenos, presupuesto y duración.
// Voraz con reparación e intercambio; suficiente para los tamaños del juego.

import { genres, validate } from '../../js/domain/game.js';

export function buildFeasible(day, pool) {
  const minimums = day.genreMinimums || {};
  const chosen = [];
  const has = a => a && chosen.some(x => x.id === a.id);
  const chileans = () => chosen.filter(a => a.country === 'CHI').length;
  const cheapFirst = (a, b) => a.cost - b.cost || a.duration - b.duration;
  const chileanFirst = (a, b) => ((a.country === 'CHI') === (b.country === 'CHI') ? cheapFirst(a, b) : a.country === 'CHI' ? -1 : 1);
  const pick = (candidates, prefChilean) => candidates.filter(a => !has(a)).sort(prefChilean ? chileanFirst : cheapFirst)[0];

  // 1. Cuotas explícitas por género, prefiriendo chilenos mientras falten.
  for (const [genre, min] of Object.entries(minimums)) {
    for (let i = 0; i < min; i++) {
      const next = pick(pool.filter(a => a.genre === genre), chileans() < day.minChilean);
      if (next) chosen.push(next);
    }
  }
  // 2. Diversidad mínima: al menos un artista por género hasta cubrir minGenres.
  for (const genre of genres) {
    const distintos = new Set(chosen.map(a => a.genre)).size;
    if (distintos >= day.minGenres || chosen.length >= day.artistCount) break;
    if (chosen.some(a => a.genre === genre)) continue;
    const next = pick(pool.filter(a => a.genre === genre), chileans() < day.minChilean);
    if (next) chosen.push(next);
  }
  // 3. Completar cupos.
  while (chosen.length < day.artistCount) {
    const next = pick(pool, chileans() < day.minChilean);
    if (!next) break;
    chosen.push(next);
  }
  // 4. Reparar el mínimo de talento chileno sin romper géneros ni diversidad.
  let guard = pool.length * 2;
  while (chileans() < day.minChilean && guard-- > 0) {
    const swapped = chosen.some((out, index) => {
      if (out.country === 'CHI') return false;
      const enGenero = chosen.filter(a => a.genre === out.genre).length;
      const puedeSalir = enGenero - 1 >= (minimums[out.genre] || 0) && (enGenero > 1 || new Set(chosen.map(a => a.genre)).size > day.minGenres);
      const mismoGenero = pick(pool.filter(a => a.country === 'CHI' && a.genre === out.genre), false);
      const cualquiera = puedeSalir ? pick(pool.filter(a => a.country === 'CHI'), false) : null;
      const entra = mismoGenero || cualquiera;
      if (!entra) return false;
      chosen.splice(index, 1, entra);
      return true;
    });
    if (!swapped) break;
  }
  // 5. Abaratar si el presupuesto o la duración se pasan.
  guard = pool.length * 2;
  while (guard-- > 0) {
    const check = validate(chosen.map(a => a.id), day, pool);
    if (check.valid) break;
    const caro = [...chosen].sort((a, b) => b.cost - a.cost)
      .find(out => pool.some(a => !has(a) && a.genre === out.genre && a.country === out.country && a.cost < out.cost));
    if (!caro) break;
    const barato = pick(pool.filter(a => a.genre === caro.genre && a.country === caro.country && a.cost < caro.cost), false);
    if (!barato) break;
    chosen.splice(chosen.indexOf(caro), 1, barato);
  }
  return chosen.slice(0, day.artistCount);
}

export const feasibleIds = (day, pool) => buildFeasible(day, pool).map(a => a.id);
