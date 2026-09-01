// Verificación de la sección de equipos del panel docente, fuera del navegador.
// Levanta admin.html en jsdom, en modo demo, con dos borradores sembrados.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const MODULE_DIR = new URL('./', import.meta.url);
const nativeSetInterval = globalThis.setInterval;

function boot(semillas = {}) {
  const html = readFileSync(new URL('admin.html', MODULE_DIR), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/modulos/musicfest/', pretendToBeVisual: true });
  const { window } = dom;
  window.__MUSICFEST_FIREBASE__ = { apiKey: '', projectId: '' };
  for (const [k, v] of Object.entries(semillas)) window.localStorage.setItem(k, v);
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const avisos = [], confirmados = [];
  window.alert = m => avisos.push(String(m));
  window.confirm = m => { confirmados.push(String(m)); return true; };
  for (const k of ['window','document','localStorage','sessionStorage','CustomEvent','Event','HTMLElement','Node','getComputedStyle','Blob','URL','alert','confirm']) globalThis[k] = window[k];
  globalThis.addEventListener = window.addEventListener.bind(window);
  globalThis.removeEventListener = window.removeEventListener.bind(window);
  globalThis.dispatchEvent = window.dispatchEvent.bind(window);
  globalThis.fetch = async () => { throw new Error('sin red'); };
  const intervals = [];
  globalThis.setInterval = (fn, ms) => { const id = nativeSetInterval(fn, ms); intervals.push(id); return id; };
  const cerrar = () => { intervals.forEach(clearInterval); globalThis.setInterval = nativeSetInterval; window.close(); };
  return { window, cerrar, avisos, confirmados, $: s => window.document.querySelector(s), $$: s => [...window.document.querySelectorAll(s)] };
}

const load = name => import(new URL(name, MODULE_DIR).href + `?t=${Date.now()}${Math.random()}`);
const draft = team => JSON.stringify({ team, selections: { friday: [], saturday: [], sunday: [] }, statuses: {}, revision: 1 });

// 1. Sin equipos, la sección lo dice en vez de quedar vacía.
{
  const { $, cerrar } = boot();
  await load('js/admin.js');
  await new Promise(r => setTimeout(r, 20));
  assert.ok($('#teamList'), 'debe existir la lista de equipos');
  assert.match($('#teamList').textContent, /Todavía no ha entrado ningún equipo/);
  assert.ok($('#uniqueNames'), 'debe existir el control de nombres únicos');
  cerrar();
  console.log('✓ sección vacía: explica que nadie ha entrado');
}

// 2. Con equipos, aparecen ordenados y con su rótulo.
{
  const { $, $$, cerrar } = boot({
    'musicfest:draft:DEMO:Zúrich': draft('Zúrich'),
    'musicfest:draft:DEMO:Los Optimizadores': draft('Los Optimizadores')
  });
  await load('js/admin.js');
  await new Promise(r => setTimeout(r, 20));
  const nombres = $$('#teamList .team-card h3').map(h => h.textContent);
  assert.deepEqual(nombres, ['Los Optimizadores', 'Zúrich'], 'orden alfabético en español: ' + JSON.stringify(nombres));
  assert.match($('#teamList').textContent, /EQUIPO LOCAL/, 'en demo no hay membresía que mostrar');
  assert.match($('#teamList').textContent, /Sin correos declarados/);
  assert.equal($$('#teamList button[data-release]').every(b => b.disabled), true, 'en demo no se puede liberar');
  cerrar();
  console.log('✓ los equipos se listan ordenados, con rótulo y correos');
}

// 3. El interruptor refleja y cambia la política de la partida.
{
  const { $, window, cerrar } = boot({ 'musicfest:draft:DEMO:Uno': draft('Uno') });
  await load('js/admin.js');
  await new Promise(r => setTimeout(r, 20));
  const leer = () => JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  assert.equal($('#uniqueNames').checked, false, 'una partida demo nace con la política abierta');

  $('#uniqueNames').checked = true;
  $('#uniqueNames').dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  assert.equal(leer().teamJoinPolicy, 'claimed', 'marcar debe exigir nombres únicos');
  assert.equal($('#uniqueNames').checked, true, 'y el control queda marcado tras repintar');

  $('#uniqueNames').checked = false;
  $('#uniqueNames').dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));
  assert.equal(leer().teamJoinPolicy, 'open', 'desmarcar debe volver a la política abierta');
  cerrar();
  console.log('✓ el interruptor de nombres únicos guarda en la partida');
}

// 4. Una partida guardada con nombres únicos abre el panel con el control marcado.
{
  const semilla = { 'musicfest:draft:DEMO:Uno': draft('Uno') };
  const previa = boot(semilla);
  await load('js/admin.js');
  await new Promise(r => setTimeout(r, 20));
  const sesion = JSON.parse(previa.window.localStorage.getItem('musicfest:session:DEMO'));
  sesion.teamJoinPolicy = 'claimed';
  previa.cerrar();

  const { $, cerrar } = boot({ ...semilla, 'musicfest:session:DEMO': JSON.stringify(sesion) });
  await load('js/admin.js');
  await new Promise(r => setTimeout(r, 20));
  assert.equal($('#uniqueNames').checked, true, 'el panel debe reflejar la política guardada');
  cerrar();
  console.log('✓ el panel refleja la política que ya tenía la partida');
}

console.log('\nPanel de equipos verificado.');
process.exit(0);
