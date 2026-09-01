// El código de partida tiene una trampa: no es el identificador de la actividad
// sino un puntero. Renombrar hacia un código ajeno se lo roba y deja la otra
// partida sin forma de abrirse. Estas pruebas fijan el seguro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCodigo, conflictoDeCodigo, ordenarPartidas, elegirPartida } from '../../js/domain/partidas.js';

test('el código se normaliza a mayúsculas y sin adornos', () => {
  assert.equal(normalizarCodigo('  mf2026 '), 'MF2026');
  assert.equal(normalizarCodigo('mf 2026!'), 'MF2026');
  assert.equal(normalizarCodigo('curso-a'), 'CURSO-A', 'el guion se conserva');
  assert.equal(normalizarCodigo(null), '');
  assert.equal(normalizarCodigo('¡¿!'), '');
});

test('renombrar a un código libre se permite', () => {
  assert.equal(conflictoDeCodigo({ codigo: 'MF2026', mapa: { DEMO: 'mf-demo' }, activityIdActual: 'mf-demo' }), null);
});

test('renombrar al código que ya tiene la propia partida se permite', () => {
  assert.equal(conflictoDeCodigo({ codigo: 'demo', mapa: { DEMO: 'mf-demo' }, activityIdActual: 'mf-demo' }), null);
});

// El caso real del 1 de septiembre: la partida de prueba se quedó con el código
// DEMO y la anterior desapareció del mapa.
test('renombrar al código de OTRA partida se rechaza y explica la salida', () => {
  const motivo = conflictoDeCodigo({ codigo: 'DEMO', mapa: { DEMO: 'mf-demo-q6wj8k' }, activityIdActual: 'mf-prueba1-75b2wy' });
  assert.ok(motivo, 'tiene que haber un motivo');
  assert.match(motivo, /DEMO/, 'nombra el código en conflicto');
  assert.match(motivo, /selector/, 'ofrece abrir esa partida en vez de robarle el código');
});

test('un código vacío se rechaza', () => {
  assert.match(conflictoDeCodigo({ codigo: '   ', mapa: {}, activityIdActual: 'mf-a' }), /vacío/);
});

test('sin actividad actual no se inventa un conflicto', () => {
  assert.equal(conflictoDeCodigo({ codigo: 'DEMO', mapa: { DEMO: 'mf-demo' }, activityIdActual: null }), null);
});

test('las partidas se ordenan de la más reciente a la más antigua', () => {
  const lista = [
    { code: 'VIEJA', updatedAt: '2026-01-01T00:00:00.000Z' },
    { code: 'NUEVA', updatedAt: '2026-09-01T00:00:00.000Z' },
    { code: 'MEDIA', updatedAt: '2026-05-01T00:00:00.000Z' }
  ];
  assert.deepEqual(ordenarPartidas(lista).map(p => p.code), ['NUEVA', 'MEDIA', 'VIEJA']);
  assert.deepEqual(lista.map(p => p.code), ['VIEJA', 'NUEVA', 'MEDIA'], 'ordenar no muta la lista');
});

test('las partidas sin fecha quedan al final y no rompen el orden', () => {
  const lista = [{ code: 'SIN' }, { code: 'CON', updatedAt: '2026-09-01T00:00:00.000Z' }];
  assert.deepEqual(ordenarPartidas(lista).map(p => p.code), ['CON', 'SIN']);
});

test('lo escrito manda sobre lo seleccionado', () => {
  const r = elegirPartida({ seleccionada: 'DEMO', escrita: 'mf2026', actual: 'DEMO' });
  assert.deepEqual(r, { accion: 'abrir', codigo: 'MF2026', error: null });
});

test('sin nada escrito se usa lo seleccionado', () => {
  assert.deepEqual(elegirPartida({ seleccionada: 'OTRA', escrita: '', actual: 'DEMO' }),
    { accion: 'abrir', codigo: 'OTRA', error: null });
});

test('elegir la partida en la que ya estás no hace nada', () => {
  const r = elegirPartida({ seleccionada: 'DEMO', escrita: '', actual: 'demo' });
  assert.equal(r.accion, 'quedarse');
  assert.equal(r.error, null, 'no es un error, simplemente no hay nada que abrir');
});

test('sin selección ni código escrito se pide una de las dos cosas', () => {
  const r = elegirPartida({ seleccionada: '', escrita: '  ', actual: 'DEMO' });
  assert.equal(r.accion, 'quedarse');
  assert.match(r.error, /Elige una partida o escribe/);
});
