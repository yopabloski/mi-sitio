// Restricciones del dominio. No tocan Firebase: se ejecutan con `node --test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { days, genres, totals, validate } from '../../js/domain/game.js';
import { artists } from '../../js/data/artists.js';
import { feasibleIds as buildFeasible } from '../helpers/lineup.mjs';

const byId = new Map(artists.map(a => [a.id, a]));
const friday = days[0];
const sunday = days[2];

test('el catálogo semilla mantiene su forma', () => {
  assert.equal(artists.length, 80);
  assert.equal(new Set(artists.map(a => a.id)).size, 80, 'no debe haber ids repetidos');
  for (const artist of artists) {
    assert.ok(genres.includes(artist.genre), `${artist.name} tiene un género desconocido: ${artist.genre}`);
    assert.ok(artist.cost >= 0 && artist.popularity >= 1 && artist.popularity <= 5, `${artist.name} tiene métricas fuera de rango`);
    assert.ok(artist.duration > 0);
  }
  assert.ok(artists.filter(a => a.country === 'CHI').length >= sunday.minChilean, 'debe haber suficientes chilenos para el domingo');
});

test('totals suma costo, duración, popularidad, chilenos y géneros', () => {
  const ids = ['bad-bunny', 'coldplay', 'cris-mj'];
  const t = totals(ids, artists);
  const expectedCost = ids.reduce((sum, id) => sum + byId.get(id).cost, 0);
  assert.equal(t.count, 3);
  assert.equal(t.cost, expectedCost);
  assert.equal(t.chilean, 1);
  assert.equal(t.score, ids.reduce((sum, id) => sum + byId.get(id).popularity, 0));
  assert.equal(Object.values(t.genres).reduce((a, b) => a + b, 0), 3);
});

test('totals ignora ids inexistentes en lugar de romperse', () => {
  const t = totals(['bad-bunny', 'artista-fantasma'], artists);
  assert.equal(t.count, 1);
});

test('un lineup vacío nunca es válido', () => {
  const result = validate([], friday, artists);
  assert.equal(result.valid, false);
  assert.equal(result.checks.find(c => c[0] === 'Artistas')[1], false);
});

test('existe al menos un lineup factible para cada día por defecto', () => {
  for (const day of days) {
    const ids = buildFeasible(day, artists);
    const result = validate(ids, day, artists);
    assert.equal(result.valid, true, `${day.name} no encontró lineup factible: ${result.checks.filter(c => !c[1]).map(c => `${c[0]} ${c[2]}`).join(', ')}`);
  }
});

test('excederse del presupuesto invalida el lineup', () => {
  const caros = [...artists].sort((a, b) => b.cost - a.cost).slice(0, friday.artistCount).map(a => a.id);
  const result = validate(caros, friday, artists);
  assert.equal(result.checks.find(c => c[0] === 'Presupuesto')[1], false);
  assert.equal(result.valid, false);
});

test('el mínimo de talento chileno se evalúa por país CHI', () => {
  const sinChilenos = artists.filter(a => a.country !== 'CHI').slice(0, friday.artistCount).map(a => a.id);
  const result = validate(sinChilenos, friday, artists);
  assert.equal(result.checks.find(c => c[0] === 'Talento chileno')[1], false);
});

test('los mínimos por género del domingo aparecen como restricciones propias', () => {
  const result = validate([], sunday, artists);
  for (const genre of Object.keys(sunday.genreMinimums)) {
    assert.ok(result.checks.some(c => c[0] === genre), `falta la restricción de ${genre}`);
  }
});

test('reglas editadas por el docente se respetan sin tocar el dominio', () => {
  const custom = { ...friday, artistCount: 2, budget: 100, duration: 100, minChilean: 2, minGenres: 1, genreMinimums: {} };
  const chilenos = artists.filter(a => a.country === 'CHI').slice(0, 2).map(a => a.id);
  assert.equal(validate(chilenos, custom, artists).valid, true);
});
