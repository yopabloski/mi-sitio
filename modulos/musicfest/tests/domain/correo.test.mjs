// El correo es opcional pero identificatorio: lo que se prueba acá es que el
// campo en blanco pase sin ruido, que @udd.cl sea el único dominio aceptado y
// que lo que se guarda sea siempre la forma normalizada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMINIO, normalizarCorreo, correoVacio, validarCorreo, validarCorreos } from '../../js/domain/correo.js';

test('el campo en blanco es válido y no produce correo', () => {
  for (const vacio of ['', '   ', '\t\n', null, undefined]) {
    const r = validarCorreo(vacio);
    assert.equal(r.ok, true, JSON.stringify(vacio));
    assert.equal(r.correo, null);
    assert.equal(r.error, null);
    assert.equal(correoVacio(vacio), true);
  }
});

test('normalizar recorta y baja a minúsculas', () => {
  assert.equal(normalizarCorreo('  Pablo.Gonzalez@UDD.CL '), 'pablo.gonzalez@udd.cl');
  assert.equal(normalizarCorreo(undefined), '');
});

test('un correo @udd.cl válido se acepta ya normalizado', () => {
  for (const bruto of ['ana@udd.cl', ' ANA@UDD.CL ', 'ana.perez@udd.cl', 'ana_perez+musicfest@udd.cl', 'a1-b2@udd.cl']) {
    const r = validarCorreo(bruto);
    assert.equal(r.ok, true, bruto);
    assert.equal(r.error, null);
    assert.equal(r.correo, normalizarCorreo(bruto));
    assert.equal(r.correo, r.correo.trim().toLowerCase());
  }
});

test('sólo se acepta @udd.cl exacto: nada de subdominios ni parecidos', () => {
  for (const ajeno of [
    'ana@alumnos.udd.cl', 'ana@correo.udd.cl', 'ana@udd.com', 'ana@gmail.com',
    'ana@uddd.cl', 'ana@udd.cl.co', 'ana@sudd.cl'
  ]) {
    const r = validarCorreo(ajeno);
    assert.equal(r.ok, false, ajeno);
    assert.equal(r.correo, null);
    assert.match(r.error, new RegExp(`@${DOMINIO}`.replace('.', '\\.')));
  }
});

test('se rechaza lo que no tiene forma de correo', () => {
  for (const malo of ['ana', 'ana@', '@udd.cl', 'ana@@udd.cl', 'ana@udd@cl', 'ana perez@udd.cl']) {
    const r = validarCorreo(malo);
    assert.equal(r.ok, false, malo);
    assert.equal(r.correo, null);
    assert.ok(r.error.length > 0);
  }
});

test('se rechaza una parte local mal puntuada', () => {
  for (const malo of ['.ana@udd.cl', 'ana.@udd.cl', 'ana..perez@udd.cl', 'an;a@udd.cl', 'an/a@udd.cl']) {
    const r = validarCorreo(malo);
    assert.equal(r.ok, false, malo);
    assert.equal(r.correo, null);
  }
});

test('validar no depende del entorno: mismo texto, mismo resultado', () => {
  const a = validarCorreo('Ana@udd.cl');
  const b = validarCorreo('ana@UDD.cl');
  assert.deepEqual(a, b);
});

// --- La pareja -------------------------------------------------------------
// Trabajan de a dos, pero es habitual que sólo uno se siente al computador y
// que alguno trabaje solo. Ninguno de los dos campos puede obligar.

test('los dos campos en blanco siguen siendo válidos y no dejan correos', () => {
  const r = validarCorreos(['', '   ']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.correos, []);
  assert.equal(r.indice, null);
});

test('sin argumentos tampoco falla', () => {
  assert.deepEqual(validarCorreos(), { ok: true, correos: [], error: null, indice: null });
});

test('uno solo es válido, esté en el campo que esté', () => {
  assert.deepEqual(validarCorreos(['ana@udd.cl', '']).correos, ['ana@udd.cl']);
  assert.deepEqual(validarCorreos(['', 'ana@udd.cl']).correos, ['ana@udd.cl']);
});

test('la pareja completa conserva el orden: primero quien opera', () => {
  const r = validarCorreos([' Ana@UDD.cl ', 'beto@udd.cl']);
  assert.equal(r.ok, true);
  assert.deepEqual(r.correos, ['ana@udd.cl', 'beto@udd.cl'], 'normalizados y en orden de campo');
});

test('el mismo correo dos veces se rechaza y señala el segundo campo', () => {
  const r = validarCorreos(['ana@udd.cl', 'ANA@udd.cl']);
  assert.equal(r.ok, false);
  assert.equal(r.indice, 1, 'el campo a corregir es el segundo, no el primero');
  assert.deepEqual(r.correos, []);
  assert.match(r.error, /solo o sola/, 'el mensaje explica qué hacer si trabaja sin pareja');
});

test('un correo inválido señala su propio campo', () => {
  assert.equal(validarCorreos(['ana@gmail.com', 'beto@udd.cl']).indice, 0);
  assert.equal(validarCorreos(['ana@udd.cl', 'beto@gmail.com']).indice, 1);
});

test('si algo falla no se devuelve ningún correo a medias', () => {
  for (const par of [['ana@udd.cl', 'beto@gmail.com'], ['ana@gmail.com', 'beto@udd.cl'], ['ana@udd.cl', 'ana@udd.cl']]) {
    assert.deepEqual(validarCorreos(par).correos, [], JSON.stringify(par));
  }
});
