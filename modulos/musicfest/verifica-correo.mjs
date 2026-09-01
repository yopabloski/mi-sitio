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

async function entrar({ equipo, correo = '', pareja = '' }) {
  const ctx = boot();
  const { $, window } = ctx;
  await load('js/student.js');
  $('#roleStudent').dispatchEvent(new window.Event('click'));
  await new Promise(r => setTimeout(r, 100)); // deja pasar el foco automático al equipo
  $('#code').value = 'DEMO';
  $('#team').value = equipo;
  $('#email').value = correo;
  $('#email2').value = pareja;
  $('#joinForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 40));
  return ctx;
}

// 0. Los dos campos existen: el primero obligatorio, el segundo opcional.
{
  const { $, cerrar } = boot();
  for (const id of ['email', 'email2']) {
    assert.ok($('#' + id), 'debe existir #' + id);
    assert.equal($('#' + id).placeholder, 'nombre@udd.cl');
  }
  assert.equal($('#email').hasAttribute('required'), true, 'el primero es obligatorio');
  assert.equal($('#email').closest('label').querySelector('small'), null, 'y no se rotula como opcional');
  assert.equal($('#email2').hasAttribute('required'), false, 'el segundo es opcional');
  assert.ok($('#email2').closest('label').querySelector('small').textContent.includes('opcional'));
  assert.match($('#email').closest('label').textContent, /Tu correo/, 'el primero es de quien opera');
  assert.match($('#email2').closest('label').textContent, /pareja/, 'el segundo es de la pareja');
  // Orden visual: código, equipo, tu correo, correo de la pareja, botón.
  const orden = [...$('#joinForm').children].map(n => n.querySelector('input')?.id || n.tagName);
  assert.deepEqual(orden.slice(0, 5), ['code', 'team', 'email', 'email2', 'BUTTON'], JSON.stringify(orden));
  cerrar();
  console.log('✓ los dos campos existen, el primero obligatorio, tras el equipo');
}

// 1. Sin el primer correo no se entra: es la llave de la investigación.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Sin Correo', correo: '' });
  assert.equal($('#join').hidden, false, 'no debe entrar sin correo');
  assert.equal($('#game').hidden, true);
  assert.match($('#joinError').textContent, /@udd\.cl/);
  assert.equal($('#email').getAttribute('aria-invalid'), 'true');
  assert.equal(window.document.activeElement.id, 'email');
  assert.equal(window.sessionStorage.getItem('musicfest:last'), null);
  cerrar();
  console.log('✓ sin el primer correo no se entra');
}

// 1b. Y tampoco basta con poner sólo el de la pareja.
{
  const { $, cerrar } = await entrar({ equipo: 'Solo Pareja', correo: '', pareja: 'beto@udd.cl' });
  assert.equal($('#join').hidden, false, 'el segundo campo no reemplaza al primero');
  assert.equal($('#email').getAttribute('aria-invalid'), 'true');
  cerrar();
  console.log('✓ el correo de la pareja no reemplaza al propio');
}

// 2. La pareja completa: entra y se recuerdan ambos, normalizados y en orden.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Los Optimizadores', correo: '  Pablo.Gonzalez@UDD.CL ', pareja: 'Ana.Perez@udd.cl' });
  assert.equal($('#joinError').textContent, '');
  assert.equal($('#join').hidden, true);
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem('musicfest:last')).emails,
    ['pablo.gonzalez@udd.cl', 'ana.perez@udd.cl'], 'primero quien opera');
  assert.equal($('#email').hasAttribute('aria-invalid'), false);
  cerrar();
  console.log('✓ la pareja completa: entra y se recuerdan los dos, en orden');
}

// 2b. Trabajar solo: el segundo campo en blanco es legítimo.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Solitario', correo: 'ana@udd.cl' });
  assert.equal($('#joinError').textContent, '');
  assert.equal($('#join').hidden, true);
  assert.deepEqual(JSON.parse(window.sessionStorage.getItem('musicfest:last')).emails, ['ana@udd.cl']);
  cerrar();
  console.log('✓ trabajar solo: basta con el primer correo');
}

// 2c. El mismo correo en los dos campos se rechaza y señala el segundo.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Repetido', correo: 'ana@udd.cl', pareja: 'ANA@udd.cl' });
  assert.equal($('#join').hidden, false, 'no debe entrar');
  assert.match($('#joinError').textContent, /solo o sola/);
  assert.equal($('#email2').getAttribute('aria-invalid'), 'true', 'el campo señalado es el segundo');
  assert.equal($('#email').hasAttribute('aria-invalid'), false, 'el primero está bien y no se marca');
  assert.equal(window.document.activeElement.id, 'email2');
  cerrar();
  console.log('✓ correo repetido: rechaza y señala el segundo campo');
}

// 2d. Un dominio ajeno en el segundo campo señala ese campo, no el primero.
{
  const { $, window, cerrar } = await entrar({ equipo: 'Mixto', correo: 'ana@udd.cl', pareja: 'beto@gmail.com' });
  assert.equal($('#join').hidden, false);
  assert.match($('#joinError').textContent, /@udd\.cl/);
  assert.equal($('#email2').getAttribute('aria-invalid'), 'true');
  assert.equal(window.document.activeElement.id, 'email2');
  cerrar();
  console.log('✓ el error señala el campo que lo causó, no siempre el primero');
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
  $('#code').value = 'DEMO'; $('#team').value = 'Reintento'; $('#email').value = 'ana@alumnos.udd.cl'; $('#email2').value = '';
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
