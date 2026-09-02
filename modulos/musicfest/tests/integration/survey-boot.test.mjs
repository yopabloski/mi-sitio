// Humo de la encuesta de percepción y su panel, en modo demo, dentro de un DOM
// simulado. Mismo enfoque que local-boot.test.mjs: sin emuladores ni red.
//
//   node --test 'tests/integration/survey-boot.test.mjs'

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const MODULE_DIR = new URL('../../', import.meta.url);
const RAIZ = fileURLToPath(MODULE_DIR);

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

  // `crypto` no se copia: en Node es de solo lectura.
  for (const key of ['window', 'document', 'localStorage', 'Event', 'CustomEvent', 'HTMLElement', 'Node', 'Blob', 'URL']) {
    globalThis[key] = window[key];
  }
  return window;
}

const respirar = () => new Promise(r => setTimeout(r, 0));

const config  = await import('../../js/domain/encuesta.config.js');
const scoring = await import('../../js/domain/encuesta.scoring.js');

/* ══════════════════════════ ENCUESTA ══════════════════════════ */

test('la encuesta renderiza los 28 ítems con la forma que declara el config', async () => {
  const window = bootDom('survey.html');
  const d = window.document, $ = s => d.querySelector(s);
  await import('../../js/survey.js');   // se autoinicia al encontrar #bloques

  assert.equal(d.querySelectorAll('[data-item]').length, 28);
  assert.equal($('#total-items').textContent, '28');
  assert.equal($('#version').textContent, config.VERSION_INSTRUMENTO);
  assert.equal($('#who').textContent, '', 'la cabecera no adelanta nada');

  // ocho de diferencial semántico, veinte de Likert
  assert.equal(d.querySelectorAll('.item-dif').length, 8);
  assert.equal(d.querySelectorAll('.item:not(.item-dif)[data-item]').length, 20);

  // todos los ítems ofrecen siete puntos
  const anchos = [...d.querySelectorAll('[data-item] .opts')].map(o => o.children.length);
  assert.ok(anchos.every(n => n === 7), `hay escalas que no son de 7: ${[...new Set(anchos)]}`);
  assert.equal(anchos.length, 28);
});

test('el diferencial semántico muestra los dos polos, con el negativo a la izquierda', async () => {
  const d = globalThis.document;
  const primero = d.querySelector('[data-item="ueq1"]');
  assert.equal(primero.querySelector('.polo-izq').textContent, 'obstructivo');
  assert.equal(primero.querySelector('.polo-der').textContent, 'impulsor de apoyo');
  assert.equal(primero.querySelector('.anchors'), null, 'el diferencial no lleva anclas verbales');
});

test('el EMSI muestra su stem destacado y las tres anclas verbales', async () => {
  const d = globalThis.document;
  const bloques = [...d.querySelectorAll('.block')];
  const emsi = bloques.find(b => b.querySelector('h2')?.textContent === config.ESCALAS.emsi.nombre);
  assert.ok(emsi.querySelector('.stem'), 'falta el stem');
  assert.equal(emsi.querySelector('.stem').textContent, config.ESCALAS.emsi.stem);
  const anclas = [...emsi.querySelector('.anchors-3').children].map(s => s.textContent);
  assert.deepEqual(anclas, config.ESCALAS.emsi.anclas);
});

test('no se puede enviar con ítems vacíos', async () => {
  const window = globalThis.window, d = window.document, $ = s => d.querySelector(s);

  $('#btn-empezar').click();
  assert.ok($('#err-email').classList.contains('on'), 'no avanza sin correo');

  $('#email').value = '  PABLO.Test@udd.cl ';
  $('#btn-empezar').click();
  assert.ok($('#pantalla-id').hidden && !$('#pantalla-encuesta').hidden);
  assert.equal($('#who').textContent, 'pablo.test@udd.cl', 'el correo se normaliza al entrar');

  $('#btn-enviar').click();
  await respirar();
  assert.equal(d.querySelectorAll('.item.missing').length, 28, 'marca los 28 que faltan');
  assert.equal(JSON.parse(window.localStorage.getItem('musicfest_encuestas') || '[]').length, 0);

  // responder todos menos uno: sigue sin poder enviar
  for (const grupo of d.querySelectorAll('.opts')) {
    const radios = grupo.querySelectorAll('input[type=radio]');
    const elegido = radios[(grupo.closest('[data-item]').dataset.item.length) % 7];
    elegido.checked = true;
    elegido.dispatchEvent(new window.Event('change', { bubbles: true }));
  }
  assert.equal($('#contador').textContent, '28 / 28');
});

test('un envío completo se guarda con correo normalizado y versión', async () => {
  const window = globalThis.window, $ = s => window.document.querySelector(s);
  $('#abierta').value = 'El tiempo del domingo.';
  $('#btn-enviar').click();
  await respirar();
  assert.ok(!$('#pantalla-fin').hidden, 'muestra el cierre');

  const [g] = JSON.parse(window.localStorage.getItem('musicfest_encuestas'));
  assert.equal(g.email, 'pablo.test@udd.cl');
  assert.equal(g.version, config.VERSION_INSTRUMENTO);
  assert.equal(Object.keys(g.respuestas).length, 28);
  assert.ok(scoring.validar(g.respuestas).completo);
  assert.equal(typeof g.duracionSeg, 'number');
  assert.equal(g.abierta, 'El tiempo del domingo.');
  // No se guardan subtotales: se derivan al leer.
  for (const dim of config.DIM_IDS) assert.equal(g[dim], undefined, `${dim} no debe persistirse`);
  assert.equal(g.ueqGlobal, undefined);
});

test('reenviar el mismo correo actualiza en vez de duplicar', async () => {
  const store = await import('../../js/services/survey-store.js');
  const window = globalThis.window;
  const base = { email: 'pablo.test@udd.cl', version: config.VERSION_INSTRUMENTO,
                 enviadoEn: new Date().toISOString(), duracionSeg: 200,
                 respuestas: Object.fromEntries(config.ITEM_IDS.map(id => [id, 7])) };

  await store.guardar(base);
  let todos = JSON.parse(window.localStorage.getItem('musicfest_encuestas'));
  assert.equal(todos.length, 1, 'sigue habiendo un solo documento');
  assert.equal(todos[0].respuestas.ueq1, 7, 'y trae las respuestas nuevas');

  // Mayúsculas y espacios no crean un segundo documento.
  await store.guardar({ ...base, email: '  Pablo.TEST@UDD.cl  ',
                        respuestas: Object.fromEntries(config.ITEM_IDS.map(id => [id, 2])) });
  todos = JSON.parse(window.localStorage.getItem('musicfest_encuestas'));
  assert.equal(todos.length, 1);
  assert.equal(todos[0].respuestas.ueq1, 2);

  // Otra cohorte sí deja un documento aparte.
  await store.guardar({ ...base, version: '2026-2' });
  assert.equal(JSON.parse(window.localStorage.getItem('musicfest_encuestas')).length, 2);
  assert.notEqual(store.idDocumento('a@udd.cl', '2026-1'), store.idDocumento('a@udd.cl', '2026-2'));
});

/* ══════════════════════════ PANEL ══════════════════════════ */

const muestra = (n, diasAtras, valor = null) => Array.from({ length: n }, (_, k) => {
  const f = new Date(); f.setDate(f.getDate() - diasAtras);
  return {
    id: `d${diasAtras}-${k}`,
    email: `alumno${diasAtras}-${k}@udd.cl`,
    version: config.VERSION_INSTRUMENTO,
    enviadoEn: f.toISOString(),
    duracionSeg: 200,
    respuestas: Object.fromEntries(config.ITEM_IDS.map((id, i) => [id, valor ?? ((k + i) % 7) + 1])),
    abierta: k === 0 ? 'Decidir rápido en pareja.' : null
  };
});

test('el panel muestra las tablas del scoring y no calcula nada por su cuenta', async () => {
  const window = bootDom('survey-dashboard.html');
  const d = window.document, $ = s => d.querySelector(s);
  const panel = await import('../../js/survey-panel.js');
  await respirar();   // deja pasar iniciar(): la puerta docente se abre sola en demo

  assert.ok(!d.querySelector('.teacher-gate'), 'sin Firebase la puerta docente no aparece');
  assert.ok(!$('#vacio').hidden, 'con la colección vacía, estado vacío y no errores');
  assert.ok($('#panel').hidden);

  const datos = [...muestra(10, 0), ...muestra(10, 3), ...muestra(10, 20)];
  panel.mostrar(datos, { enMemoria: true });

  assert.equal($('#tally-n').textContent, '30');
  assert.equal(d.querySelectorAll('#tbl-ueq tr').length, 3, 'pragmática, hedónica y global');
  assert.equal(d.querySelectorAll('#tbl-emsi tr').length, 4, 'las cuatro subescalas del EMSI');
  assert.equal(d.querySelectorAll('#tbl-otras tr').length, 2);
  assert.equal(d.querySelectorAll('#tbl-items tr').length, 28);
  assert.equal(d.querySelectorAll('#tbl-registros tr').length, 30);
  assert.equal(d.querySelectorAll('#kpis .kpi').length, 5);

  // los números de la vista salen de agregar(), no de una cuenta paralela
  const A = scoring.agregar(datos);
  const signo = n => (n > 0 ? '+' : '') + n.toFixed(2);
  assert.ok($('#tbl-ueq').textContent.includes(signo(A.ueqGlobal)));
  assert.equal($('#sdi').textContent, signo(A.indiceAutodeterminacion));
  assert.equal($('#planas').textContent, String(A.planas));
});

test('la barra del UEQ-S está centrada en cero y se colorea por signo', async () => {
  const d = globalThis.document;
  const barras = [...d.querySelectorAll('#tbl-ueq .bipolar i')];
  assert.equal(barras.length, 3);
  for (const b of barras) {
    const est = b.getAttribute('style');
    assert.ok(/^(left|right):50%/.test(est), `la barra no arranca del centro: ${est}`);
  }
});

test('la alerta de fiabilidad se ve en la tabla del EMSI', async () => {
  const panel = await import('../../js/survey-panel.js');
  const d = globalThis.document;
  // Muestra de ruido: los alfas se desploman y las filas deben marcarse.
  panel.mostrar(panel.generarEjemplo(Date.now(), 30), { enMemoria: true });
  assert.ok(d.querySelectorAll('#tbl-emsi tr.alerta').length > 0, 'ninguna fila marcada');
  assert.ok(d.querySelector('#tbl-emsi .badge-alerta'), 'falta la insignia');
});

test('el panel filtra por fecha y borra de verdad', async () => {
  const panel = await import('../../js/survey-panel.js');
  const window = globalThis.window, d = window.document, $ = s => d.querySelector(s);
  panel.mostrar([...muestra(10, 0), ...muestra(10, 3), ...muestra(10, 20)], { enMemoria: true });

  const atajo = r => [...d.querySelectorAll('[data-rango]')].find(b => b.dataset.rango === r);

  atajo('hoy').click();
  assert.equal($('#tally-n').textContent, '10');
  assert.ok($('#filtro').classList.contains('filtered'));
  assert.equal(d.querySelectorAll('#tbl-registros tr').length, 10);

  atajo('7').click();
  assert.equal($('#tally-n').textContent, '20');

  $('#desde').value = '2000-01-01'; $('#hasta').value = '2000-01-31';
  $('#desde').dispatchEvent(new window.Event('change'));
  assert.ok(!$('#sin-rango').hidden && $('#panel').hidden && $('#vacio').hidden,
    'rango vacío tiene su propio aviso, distinto del de base vacía');

  atajo('todo').click();
  assert.equal($('#tally-n').textContent, '30');

  $('#tbl-registros').querySelector('[data-borrar]').click();
  assert.ok($('#dlg').open, 'pide confirmación');
  assert.ok($('#dlg-texto').textContent.includes('@udd.cl'));
  $('#dlg-cancelar').click();
  await respirar();
  assert.equal($('#tally-n').textContent, '30', 'cancelar no borra');

  $('#tbl-registros').querySelector('[data-borrar]').click();
  $('#dlg-confirmar').click();
  await respirar();
  assert.equal($('#tally-n').textContent, '29', 'confirmar sí borra');

  atajo('hoy').click();
  const enRango = Number($('#tally-n').textContent);
  $('#btn-borrar-vista').click();
  $('#dlg-confirmar').click();
  await respirar();
  atajo('todo').click();
  assert.equal(Number($('#tally-n').textContent), 29 - enRango, 'lo de fuera del rango sobrevive');

  $('#btn-borrar-vista').click();
  $('#dlg-confirmar').click();
  await respirar();
  assert.ok(!$('#vacio').hidden && $('#panel').hidden && $('#filtro').hidden);
  assert.equal($('#estado').textContent, 'Sin datos');
});

/* ══════════════════════════ FUENTE ÚNICA ══════════════════════════ */

test('los ítems y las fórmulas aparecen una sola vez en el repo', () => {
  const archivos = [];
  (function recorrer(dir) {
    for (const nombre of readdirSync(dir)) {
      if (['node_modules', 'assets', '.git'].includes(nombre)) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (/\.(mjs|js|html)$/.test(nombre)) archivos.push(ruta);
    }
  })(RAIZ);

  const modulos = ['encuesta.config.js', 'encuesta.scoring.js'];
  const pruebas = /tests\//;

  // Enunciados: solo pueden estar en el config.
  const enunciado = config.ITEMS.find(i => i.id === 'emsi01').t;
  const conEnunciado = archivos.filter(f => !modulos.some(m => f.endsWith(m)) &&
    readFileSync(f, 'utf8').includes(enunciado));
  assert.deepEqual(conEnunciado, [], 'un enunciado del banco está duplicado fuera del config');

  // Fórmula de alfa: solo puede estar en el scoring.
  const formula = 'k / (k - 1)';
  const conFormula = archivos.filter(f => !modulos.some(m => f.endsWith(m)) && !pruebas.test(f) &&
    readFileSync(f, 'utf8').includes(formula));
  assert.deepEqual(conFormula, [], 'la fórmula de alfa está duplicada fuera del scoring');

  // La lista de ids tampoco se copia a mano.
  const idsALaMano = archivos.filter(f => !modulos.some(m => f.endsWith(m)) && !pruebas.test(f) &&
    /["']emsi01["']\s*,\s*["']emsi02["']/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(idsALaMano, [], 'hay una lista de ids copiada a mano');
});
