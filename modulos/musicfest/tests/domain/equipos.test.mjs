// Entrar a un equipo es donde se cruzan tres cosas que en clase se confunden:
// el mismo grupo en dos notebooks, dos grupos con el mismo nombre, y el equipo
// que el docente liberó. Estas pruebas fijan cuál es cuál.
import test from 'node:test';
import assert from 'node:assert/strict';
import { POLITICAS, politicaDe, decidirIngreso, mensajeNombreTomado, miembrosTras } from '../../js/domain/equipos.js';

const AMBAS = [POLITICAS.ABIERTA, POLITICAS.UNICA];

test('la política por defecto es la abierta, y cualquier valor raro cae ahí', () => {
  for (const actividad of [undefined, null, {}, { teamJoinPolicy: 'open' }, { teamJoinPolicy: 'cualquier-cosa' }]) {
    assert.equal(politicaDe(actividad), POLITICAS.ABIERTA, JSON.stringify(actividad));
  }
  assert.equal(politicaDe({ teamJoinPolicy: 'claimed' }), POLITICAS.UNICA);
});

test('un equipo que no existe siempre se puede crear', () => {
  for (const politica of AMBAS) {
    const r = decidirIngreso({ existe: false, uid: 'ana', politica });
    assert.deepEqual(r, { accion: 'crear', permitido: true }, politica);
  }
});

test('volver desde el mismo navegador no depende de la política', () => {
  for (const politica of AMBAS) {
    const r = decidirIngreso({ existe: true, miembros: ['ana', 'beto'], uid: 'ana', politica });
    assert.deepEqual(r, { accion: 'reingresar', permitido: true }, politica);
  }
});

test('con política abierta, un segundo dispositivo se suma al equipo', () => {
  const r = decidirIngreso({ existe: true, miembros: ['ana'], uid: 'beto', politica: POLITICAS.ABIERTA });
  assert.deepEqual(r, { accion: 'sumarse', permitido: true });
  assert.deepEqual(miembrosTras(r.accion, ['ana'], 'beto'), ['ana', 'beto']);
});

test('con nombres únicos, el nombre tomado se rechaza', () => {
  const r = decidirIngreso({ existe: true, miembros: ['ana'], uid: 'beto', politica: POLITICAS.UNICA });
  assert.equal(r.permitido, false);
  assert.equal(r.accion, 'rechazar');
  assert.deepEqual(miembrosTras(r.accion, ['ana'], 'beto'), ['ana'], 'un rechazo no cambia la membresía');
});

// Este es el caso que estaba roto: liberar vaciaba la membresía pero nadie
// podía volver a entrar, porque sólo se miraba la política.
test('un equipo liberado se puede reclamar, incluso con nombres únicos', () => {
  for (const politica of AMBAS) {
    const r = decidirIngreso({ existe: true, miembros: [], uid: 'beto', politica });
    assert.deepEqual(r, { accion: 'reclamar', permitido: true }, politica);
    assert.deepEqual(miembrosTras(r.accion, [], 'beto'), ['beto']);
  }
});

test('reclamar deja al nuevo dueño solo, no encima de los anteriores', () => {
  assert.deepEqual(miembrosTras('reclamar', [], 'beto'), ['beto']);
  assert.deepEqual(miembrosTras('crear', [], 'ana'), ['ana']);
});

test('el mensaje de rechazo nombra el equipo y ofrece las dos salidas', () => {
  const texto = mensajeNombreTomado('  Los Optimizadores ');
  assert.match(texto, /"Los Optimizadores"/, 'nombra el equipo sin espacios de más');
  assert.match(texto, /[Ee]lige otro/, 'la salida que no depende de nadie va primero');
  assert.match(texto, /docente/, 'y la que sí, después');
});

test('decidir no muta la lista de miembros que recibe', () => {
  const miembros = ['ana'];
  decidirIngreso({ existe: true, miembros, uid: 'beto', politica: POLITICAS.ABIERTA });
  miembrosTras('sumarse', miembros, 'beto');
  assert.deepEqual(miembros, ['ana']);
});
