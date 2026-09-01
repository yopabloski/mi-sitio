// El cartel es la lectura visual de la decisión: la jerarquía sale de la
// función objetivo y el pie muestra la holgura de cada restricción.
import test from 'node:test';
import assert from 'node:assert/strict';
import { days } from '../../js/domain/game.js';
import { artists } from '../../js/data/artists.js';
import { posterModel, festivalModel, tiersByPopularity, posterFilename } from '../../js/domain/poster.js';

const friday = days[0];
const optimo = ['bad-bunny', 'arctic-monkeys', 'travis-scott', 'rihanna', 'wallows', 'kidd-voodoo'];

test('la jerarquía del cartel sale de la popularidad', () => {
  const { tiers } = posterModel(optimo, friday, artists, {});
  assert.equal(tiers[0].length, 4, 'cuatro artistas comparten la popularidad máxima');
  assert.ok(tiers[0].every(a => a.popularity === 5));
  assert.deepEqual(tiers[1].map(a => a.name), ['Wallows']);
  assert.deepEqual(tiers[2].map(a => a.name), ['Kidd Voodoo']);
  assert.equal(tiers.flat().length, optimo.length, 'nadie se queda fuera del cartel');
});

test('los niveles son relativos: un lineup modesto también tiene cabeza de cartel', () => {
  const flojos = artists.filter(a => a.popularity <= 2).slice(0, 4);
  const [cabeza] = tiersByPopularity(flojos);
  assert.ok(cabeza.length > 0, 'siempre hay un nivel superior');
});

test('el pie marca las restricciones pegadas a la frontera', () => {
  const { limits } = posterModel(optimo, friday, artists, {});
  assert.equal(limits.presupuesto.usado, 23);
  assert.equal(limits.presupuesto.tope, 24);
  assert.equal(limits.presupuesto.alLimite, true, '23 de 24 es estar al límite');
  assert.equal(limits.duracion.alLimite, true, '10 de 10 horas, exacto');
  assert.equal(limits.chilenos.alLimite, false, 'un mínimo cumplido no es una frontera');
  assert.ok(limits.presupuesto.ratio <= 1 && limits.duracion.ratio <= 1);
});

test('un cartel vacío se declara vacío en vez de romperse', () => {
  const model = posterModel([], friday, artists, {});
  assert.equal(model.empty, true);
  assert.equal(model.valid, false);
  assert.equal(model.totals.score, 0);
  assert.deepEqual(model.tiers.flat(), []);
});

test('un artista que ya no está en el pool no aparece en el cartel', () => {
  const reducido = artists.filter(a => a.id !== 'bad-bunny');
  const model = posterModel(optimo, friday, reducido, {});
  assert.equal(model.artists.length, optimo.length - 1);
  assert.equal(model.valid, false);
});

test('el cartel del festival suma los tres días y sus topes', () => {
  const f = festivalModel(
    { friday: optimo, saturday: [], sunday: [] },
    days, artists, { teamName: 'Los Optimizadores' }
  );
  assert.equal(f.days.length, 3);
  assert.equal(f.totals.score, 27);
  assert.equal(f.totals.artists, 6);
  assert.equal(f.caps.cost, days.reduce((t, d) => t + d.budget, 0));
  assert.equal(f.valid, false, 'con dos días vacíos el festival no está completo');
  assert.equal(f.empty, false);
});

test('el nombre del archivo es seguro para cualquier sistema', () => {
  assert.equal(posterFilename('Los Optimizadores', 'Viernes'), 'musicfest-los-optimizadores-viernes.png');
  assert.equal(posterFilename('Añañuca & Cía.', 'Sábado'), 'musicfest-ananuca-cia-sabado.png');
  assert.equal(posterFilename('', ''), 'musicfest.png');
});
