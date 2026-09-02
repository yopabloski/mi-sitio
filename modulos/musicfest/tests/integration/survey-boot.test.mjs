// Humo de la encuesta de percepción y su panel, en modo demo, dentro de un DOM
// simulado. Mismo enfoque que local-boot.test.mjs: sin emuladores ni red.
//
//   node --test 'tests/integration/survey-boot.test.mjs'

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const MODULE_DIR = new URL('../../', import.meta.url);

function bootDom(htmlFile) {
  const html = readFileSync(new URL(htmlFile, MODULE_DIR), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/modulos/musicfest/', pretendToBeVisual: true });
  const { window } = dom;

  // Modo demo: sin apiKey, survey-store.js usa localStorage y no carga el SDK.
  window.__MUSICFEST_FIREBASE__ = { apiKey: '', projectId: '' };
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.Element.prototype.scrollIntoView = function () {};
  window.scrollTo = () => {};

  // `crypto` no se copia: en Node es de solo lectura y el global nativo ya
  // trae randomUUID, que es lo único que usa survey-store.js.
  for (const key of ['window', 'document', 'localStorage', 'Event', 'CustomEvent', 'HTMLElement', 'Node', 'Blob', 'URL']) {
    globalThis[key] = window[key];
  }
  return window;
}

const respirar = () => new Promise(r => setTimeout(r, 0));

/* ══════════════════════════ ENCUESTA ══════════════════════════ */

test('la encuesta se responde entera y queda guardada', async () => {
  const window = bootDom('survey.html');
  const d = window.document, $ = s => d.querySelector(s);
  await import('../../js/survey.js');   // se autoinicia al encontrar #bloques

  assert.equal(d.querySelectorAll('[data-item]').length, 27);
  assert.equal($('#total-items').textContent, '27');
  assert.equal($('#who').textContent, '', 'la cabecera no adelanta nada');

  $('#btn-empezar').click();
  assert.ok($('#err-email').classList.contains('on'), 'no avanza sin correo');

  $('#email').value = 'PABLO.Test@udd.cl ';
  $('#btn-empezar').click();
  assert.ok($('#pantalla-id').hidden && !$('#pantalla-encuesta').hidden);
  assert.equal($('#who').textContent, 'pablo.test@udd.cl', 'el correo se normaliza');

  $('#btn-enviar').click();
  await respirar();
  assert.equal(d.querySelectorAll('.item.missing').length, 27, 'marca todo lo que falta');

  for (const grupo of d.querySelectorAll('.opts')) {
    const radios = grupo.querySelectorAll('input[type=radio]');
    const elegido = radios[Math.floor(radios.length / 2)];
    elegido.checked = true;
    elegido.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  assert.equal($('#contador').textContent, '27 / 27');
  assert.equal($('#bar').style.width, '100%');
  assert.equal(d.querySelectorAll('.item.missing').length, 0);

  $('#abierta').value = 'El tiempo del domingo.';
  $('#btn-enviar').click();
  await respirar();
  assert.ok(!$('#pantalla-fin').hidden, 'muestra el cierre');

  const [guardado] = JSON.parse(window.localStorage.getItem('musicfest_encuestas'));
  assert.equal(guardado.email, 'pablo.test@udd.cl');
  assert.equal(Object.keys(guardado.respuestas).length, 27);
  assert.equal(typeof guardado.id, 'string');
  assert.equal(typeof guardado.duracionSeg, 'number');
  assert.ok(!('pareja' in guardado), 'ya no se pide número de pareja');
  assert.equal(guardado.abierta, 'El tiempo del domingo.');
});

/* ══════════════════════════ PANEL ══════════════════════════ */

const muestra = (n, diasAtras) => Array.from({ length: n }, (_, k) => {
  const f = new Date(); f.setDate(f.getDate() - diasAtras);
  return {
    id: `d${diasAtras}-${k}`,
    email: `alumno${diasAtras}-${k}@udd.cl`,
    enviadoEn: f.toISOString(),
    duracionSeg: 200,
    respuestas: Object.fromEntries(
      ['sus01','sus02','sus03','sus04','sus05','sus06','sus07','sus08','sus09','sus10',
       'gx_dis1','gx_dis2','gx_dis3','gx_abs1','gx_abs2','gx_abs3',
       'imi_int1','imi_int2','imi_int3','imi_com1','imi_com2','imi_com3','imi_val1','imi_val2','imi_val3',
       'apre01','apre02'].map((id, i) => [id, 2 + ((k + i) % 4)])),
    abierta: k === 0 ? 'Decidir rápido en pareja.' : null
  };
});

test('el panel filtra por fecha y borra de verdad', async () => {
  const window = bootDom('survey-dashboard.html');
  const d = window.document, $ = s => d.querySelector(s);
  const panel = await import('../../js/survey-panel.js');
  await respirar();   // deja pasar iniciar(): la puerta docente se abre sola en demo

  assert.ok(!d.querySelector('.teacher-gate'), 'sin Firebase la puerta docente no aparece');
  assert.ok(!$('#vacio').hidden, 'parte en el estado sin respuestas');

  // 10 de hoy, 10 de hace 3 días, 10 de hace 20
  panel.mostrar([...muestra(10, 0), ...muestra(10, 3), ...muestra(10, 20)], { enMemoria: true });

  assert.equal($('#tally-n').textContent, '30');
  assert.equal(d.querySelectorAll('#tbl-registros tr').length, 30);
  assert.equal(d.querySelectorAll('#tbl-escalas tr').length, 7);
  assert.equal(d.querySelectorAll('#tbl-items tr').length, 27);
  assert.ok($('#btn-borrar-todo').hidden, 'sin filtro no hace falta el botón de todo');

  const atajo = r => [...d.querySelectorAll('[data-rango]')].find(b => b.dataset.rango === r);

  atajo('hoy').click();
  assert.equal($('#tally-n').textContent, '10', 'atajo Hoy');
  assert.ok($('#filtro').classList.contains('filtered'));
  assert.ok(!$('#btn-borrar-todo').hidden, 'con filtro sí aparece');

  atajo('7').click();
  assert.equal($('#tally-n').textContent, '20', 'atajo últimos 7 días');

  // rango sin resultados: aviso propio, no el de base vacía
  $('#desde').value = '2000-01-01'; $('#hasta').value = '2000-01-31';
  $('#desde').dispatchEvent(new window.Event('change'));
  assert.ok(!$('#sin-rango').hidden && $('#panel').hidden && $('#vacio').hidden);

  atajo('todo').click();
  assert.equal($('#tally-n').textContent, '30');

  // borrar uno, con confirmación
  $('#tbl-registros').querySelector('[data-borrar]').click();
  assert.ok($('#dlg').open, 'pide confirmación');
  assert.ok($('#dlg-texto').textContent.includes('@udd.cl'), 'dice a quién borra');
  $('#dlg-cancelar').click();
  await respirar();
  assert.equal($('#tally-n').textContent, '30', 'cancelar no borra');

  $('#tbl-registros').querySelector('[data-borrar]').click();
  $('#dlg-confirmar').click();
  await respirar();
  assert.equal($('#tally-n').textContent, '29', 'confirmar sí borra');

  // borrar solo el rango deja intacto lo de fuera
  atajo('hoy').click();
  const enRango = Number($('#tally-n').textContent);
  $('#btn-borrar-vista').click();
  $('#dlg-confirmar').click();
  await respirar();
  atajo('todo').click();
  assert.equal(Number($('#tally-n').textContent), 29 - enRango, 'lo de fuera del rango sobrevive');

  // vaciar devuelve al estado inicial
  $('#btn-borrar-vista').click();
  $('#dlg-confirmar').click();
  await respirar();
  assert.ok(!$('#vacio').hidden && $('#panel').hidden && $('#filtro').hidden);
  assert.equal($('#estado').textContent, 'Sin datos');
});

test('los datos de ejemplo no se mezclan con las respuestas reales', async () => {
  const window = bootDom('survey-dashboard.html');
  const d = window.document, $ = s => d.querySelector(s);
  // El módulo ya está en caché por la prueba anterior, así que no se autoinicia
  // sobre este DOM nuevo: hay que arrancarlo a mano.
  const panel = await import('../../js/survey-panel.js');
  await panel.iniciar();
  await respirar();

  $('#btn-demo').click();
  assert.equal($('#tally-n').textContent, '43');
  const guardado = JSON.parse(window.localStorage.getItem('musicfest_encuestas') || '[]');
  // En modo demo (sin Firebase) sí persisten: es el único almacenamiento que hay.
  assert.equal(guardado.length, 43);
  assert.ok(guardado.every(r => r.demo === true), 'quedan marcados como de ejemplo');
  assert.ok($('#aviso-ejemplo').hidden, 'sin Firebase no hace falta advertir nada');
});
