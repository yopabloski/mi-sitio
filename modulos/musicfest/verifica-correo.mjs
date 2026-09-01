// Verificación de interfaz del campo de correo, fuera del navegador.
// Levanta index.html en jsdom, carga student.js en modo demo y prueba los tres
// caminos: en blanco, correo válido y correo de otro dominio.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const MODULE_DIR = new URL('./', import.meta.url);
const nativeSetInterval = globalThis.setInterval;
const almacen = new Map();

function boot() {
  const html = readFileSync(new URL('index.html', MODULE_DIR), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/modulos/musicfest/', pretendToBeVisual: true });
  const { window } = dom;
  window.__MUSICFEST_FIREBASE__ = { apiKey: '', projectId: '' };
  for (const [k, v] of almacen) window.localStorage.setItem(k, v);
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.alert = () => {};
  for (const k of ['window','document','localStorage','sessionStorage','CustomEvent','Event','HTMLElement','Node','getComputedStyle','Blob','URL','alert','confirm']) globalThis[k] = window[k];
  globalThis.addEventListener = window.addEventListener.bind(window);
  globalThis.removeEventListener = window.removeEventListener.bind(window);
  globalThis.dispatchEvent = window.dispatchEvent.bind(window);
  globalThis.fetch = async () => { throw new Error('sin red'); };
  const intervals = [];
  globalThis.setInterval = (fn, ms) => { const id = nativeSetInterval(fn, ms); intervals.push(id); return id; };
  const cerrar = () => { intervals.forEach(clearInterval); globalThis.setInterval = nativeSetInterval; window.close(); };
  return { window, cerrar, $: s => window.document.querySelector(s) };
}

const load = name => import(new URL(name, MODULE_DIR).href + `?t=${Date.now()}${Math.random()}`);

async function entrar({ equipo, correo }) {
  const ctx = boot();
  const { $, window } = ctx;
  await load('js/student.js');
  $('#roleStudent').dispatchEvent(new window.Event('click'));
  await new Promise(r => setTimeout(r, 100)); // deja pasar el foco automático al equipo
  $('#code').value = 'DEMO';
  $('#team').value = equipo;
  $('#email').value = correo;
  $('#joinForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 40));
  return ctx;
}

// 0. El campo existe, es opcional y está bien rotulado.
{
  const { $, cerrar } = boot();
  const campo = $('#email');
  assert.ok(campo, 'debe existir #email');
  assert.equal(campo.hasAttribute('required'), false, 'el campo es opcional');
  assert.equal(campo.placeholder, 'nombre@udd.cl');
  const label = campo.closest('label');
  assert.ok(label.textContent.includes('Correo UDD'), 'el rótulo nombra el correo');
  assert.ok(label.querySelector('small').textContent.includes('opcional'));
  // Orden visual: código, equipo, correo, botón.
  const orden = [...$('#joinForm').children].map(n => n.querySelector('input')?.id || n.tagName);
  assert.deepEqual(orden.slice(0, 4), ['code', 'team', 'email', 'BUTTON'], JSON.stringify(orden));
  cerrar();
  console.log('✓ el campo existe, es opcional y va después del equipo');
}

// 1. En blanco: entra igual, sin error y sin recordar correo.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Sin Correo', correo: '' });
  assert.equal($('#joinError').textContent, '', 'en blanco no debe dar error');
  assert.equal($('#join').hidden, true, 'debe entrar a la partida');
  assert.equal($('#teamLabel').textContent, 'Sin Correo');
  assert.equal(JSON.parse(window.sessionStorage.getItem('musicfest:last')).email, null);
  cerrar();
  console.log('✓ campo en blanco: entra igual y no guarda correo');
}

// 2. Correo válido: entra y se recuerda normalizado.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Los Optimizadores', correo: '  Pablo.Gonzalez@UDD.CL ' });
  assert.equal($('#joinError').textContent, '');
  assert.equal($('#join').hidden, true);
  assert.equal(JSON.parse(window.sessionStorage.getItem('musicfest:last')).email, 'pablo.gonzalez@udd.cl');
  assert.equal($('#email').hasAttribute('aria-invalid'), false);
  cerrar();
  console.log('✓ correo válido: entra y se recuerda en minúsculas');
}

// 3. Otro dominio: no entra, mensaje visible y foco en el campo.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Ajenos', correo: 'ana@gmail.com' });
  assert.equal($('#join').hidden, false, 'no debe entrar a la partida');
  assert.equal($('#game').hidden, true);
  assert.match($('#joinError').textContent, /@udd\.cl/);
  assert.equal($('#email').getAttribute('aria-invalid'), 'true');
  assert.equal(window.document.activeElement.id, 'email', 'el foco vuelve al campo con el problema');
  assert.equal($('#joinForm button').disabled, false, 'el botón queda utilizable');
  assert.equal(window.sessionStorage.getItem('musicfest:last'), null, 'no se recuerda nada de un intento fallido');
  cerrar();
  console.log('✓ dominio ajeno: no entra, avisa y devuelve el foco');
}

// 4. Corregir después de fallar limpia el estado de error.
{
  const ctx = boot();
  const { $, window, cerrar } = ctx;
  await load('js/student.js');
  $('#roleStudent').dispatchEvent(new window.Event('click'));
  await new Promise(r => setTimeout(r, 100));
  $('#code').value = 'DEMO'; $('#team').value = 'Reintento'; $('#email').value = 'ana@alumnos.udd.cl';
  $('#joinForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 20));
  assert.notEqual($('#joinError').textContent, '', 'subdominio rechazado');
  $('#email').value = 'ana@udd.cl';
  $('#joinForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 40));
  assert.equal($('#joinError').textContent, '', 'al corregir, el error desaparece');
  assert.equal($('#email').hasAttribute('aria-invalid'), false);
  assert.equal($('#join').hidden, true);
  cerrar();
  console.log('✓ corregir el correo limpia el error y deja entrar');
}

console.log('\nInterfaz verificada.');
process.exit(0);
