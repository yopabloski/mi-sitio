// Elegir partida es la única operación sobre códigos que quedó: se abre una
// existente o se crea otra. Cambiarle el código a una partida ya creada se
// eliminó a propósito —ver la cabecera de js/domain/partidas.js—.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarCodigo, etiquetaEstado, etiquetaPartida, ordenarPartidas, elegirPartida } from '../../js/domain/partidas.js';

test('el código se normaliza a mayúsculas y sin adornos', () => {
  assert.equal(normalizarCodigo('  mf2026 '), 'MF2026');
  assert.equal(normalizarCodigo('mf 2026!'), 'MF2026');
  assert.equal(normalizarCodigo('curso-a'), 'CURSO-A', 'el guion se conserva');
  assert.equal(normalizarCodigo(null), '');
  assert.equal(normalizarCodigo('¡¿!'), '');
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

test('cada estado tiene su lectura en la lista', () => {
  assert.equal(etiquetaEstado('lobby'), 'sin empezar');
  assert.equal(etiquetaEstado('active'), 'en curso');
  assert.equal(etiquetaEstado('paused'), 'pausada');
  assert.equal(etiquetaEstado('closed'), 'cerrada');
});

test('un estado desconocido o ausente no inventa texto', () => {
  for (const raro of [undefined, null, '', 'inventado']) assert.equal(etiquetaEstado(raro), '');
});

test('la etiqueta junta código y estado', () => {
  assert.equal(etiquetaPartida({ code: 'mf2026', state: 'active' }), 'MF2026 · en curso');
  assert.equal(etiquetaPartida({ code: 'MARZO-A', state: 'closed' }), 'MARZO-A · cerrada');
});

// Estar abierta en el panel y estar en curso son cosas distintas: una partida
// cerrada se abre en el panel justamente para revisarla.
test('la partida cargada en el panel se distingue de su estado', () => {
  assert.equal(etiquetaPartida({ code: 'MF2026', state: 'closed', abierta: true }),
    'MF2026 · cerrada · abierta aquí');
  assert.equal(etiquetaPartida({ code: 'MF2026', state: 'lobby', abierta: true }),
    'MF2026 · sin empezar · abierta aquí');
});

test('sin estado conocido, la etiqueta es sólo el código', () => {
  assert.equal(etiquetaPartida({ code: 'MF2026' }), 'MF2026');
  assert.equal(etiquetaPartida({ code: 'MF2026', abierta: true }), 'MF2026 · abierta aquí');
});
