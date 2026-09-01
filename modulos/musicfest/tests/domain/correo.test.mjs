// El correo es opcional pero identificatorio: lo que se prueba acá es que el
// campo en blanco pase sin ruido, que @udd.cl sea el único dominio aceptado y
// que lo que se guarda sea siempre la forma normalizada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMINIO, normalizarCorreo, correoVacio, validarCorreo } from '../../js/domain/correo.js';

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
