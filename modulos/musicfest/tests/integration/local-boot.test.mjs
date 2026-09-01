// Humo de extremo a extremo del cliente, en modo demo, dentro de un DOM
// simulado. No necesita emuladores ni red: comprueba que la fachada, las
// vistas y el flujo docente/estudiante siguen arrancando después de la
// migración, y que una actividad completa sobrevive al ciclo entero.
//
//   node --test 'tests/integration/local-boot.test.mjs'
//
// Requiere jsdom (viene en devDependencies).

import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildFeasible } from '../helpers/lineup.mjs';

const MODULE_DIR = new URL('../../', import.meta.url);

const nativeSetInterval = globalThis.setInterval;

// Las pruebas de este archivo son un escenario encadenado: el equipo entrega en
// una y el docente valida en la siguiente. Cada JSDOM trae su propio
// localStorage, así que lo transportamos entre ventanas a mano.
const sharedStorage = new Map();

function bootDom(t, htmlFile) {
  const html = readFileSync(new URL(htmlFile, MODULE_DIR), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  const dom = new JSDOM(html, { url: 'http://localhost/modulos/musicfest/', pretendToBeVisual: true });
  const { window } = dom;

  // Modo demo: sin apiKey, la fachada usa local-store.js y no carga el SDK.
  window.__MUSICFEST_FIREBASE__ = { apiKey: '', projectId: '' };
  for (const [key, value] of sharedStorage) window.localStorage.setItem(key, value);
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const alerts = [];
  window.alert = message => { alerts.push(String(message)); };
  window.confirm = () => true;

  for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'CustomEvent', 'Event', 'HTMLElement', 'Node', 'getComputedStyle', 'Blob', 'URL', 'alert', 'confirm']) {
    globalThis[key] = window[key];
  }
  globalThis.addEventListener = window.addEventListener.bind(window);
  globalThis.removeEventListener = window.removeEventListener.bind(window);
  globalThis.dispatchEvent = window.dispatchEvent.bind(window);
  globalThis.fetch = async () => { throw new Error('sin red en las pruebas'); };

  // admin.js deja un setInterval vivo para refrescar la bandeja de entregas.
  // Sin esto, `node --test` nunca termina.
  const intervals = [];
  globalThis.setInterval = (fn, ms) => { const id = nativeSetInterval(fn, ms); intervals.push(id); return id; };
  t.after(() => {
    sharedStorage.clear();
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      sharedStorage.set(key, window.localStorage.getItem(key));
    }
    intervals.forEach(clearInterval);
    globalThis.setInterval = nativeSetInterval;
    window.close();
  });

  return { dom, window, alerts, $: selector => window.document.querySelector(selector) };
}

const bust = () => `?t=${Date.now()}${Math.random()}`;
// MODULE_DIR ya es una URL file:// válida. Ojo: NO usar .pathname aquí — viene
// percent-encoded y volver a pasarlo por pathToFileURL lo codifica dos veces,
// lo que rompe cualquier ruta con acentos (por ejemplo .../Admisión/...).
const load = name => import(new URL(name, MODULE_DIR).href + bust());

test('el panel docente arranca en modo demo y renderiza la actividad', async t => {
  const { $ } = bootDom(t, 'admin.html');
  await load('js/admin.js');

  assert.equal($('#adminState').textContent, 'Lobby');
  assert.equal($('#adminDay').textContent, 'Viernes');
  assert.ok($('#catalogList').children.length >= 80, 'el catálogo debe listar los 80 artistas semilla');
  assert.ok($('#genreSummary').textContent.includes('ACTIVOS'));
  assert.ok(!$('.teacher-gate'), 'en modo demo no debe aparecer la puerta docente');
  assert.ok($('#exportActivity'), 'el botón de exportar configuración sigue presente');
});

test('los controles docentes transaccionales avanzan y reabren el día', async t => {
  const { $, window, alerts } = bootDom(t, 'admin.html');
  await load('js/admin.js');
  const click = async selector => { $(selector).dispatchEvent(new window.Event('click')); await new Promise(r => setTimeout(r, 10)); assert.deepEqual(alerts, [], 'ninguna operación docente debería fallar'); };

  await click('#start');
  assert.equal($('#adminState').textContent, 'En curso');

  await click('#advance');
  assert.equal($('#adminDay').textContent, 'Sábado');

  await click('#advance');
  assert.equal($('#adminDay').textContent, 'Domingo');
  assert.equal($('#advance').disabled, true, 'no debe poder avanzar más allá del domingo');

  await click('#back');
  assert.equal($('#adminDay').textContent, 'Sábado');

  const session = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  const before = session.revision;
  await click('#reopen');
  await click('#confirmReopen');
  const after = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  assert.equal(after.revision, before + 1, 'reabrir debe subir la revisión');
  assert.equal(after.reopenedFrom, 1);
  assert.ok(after.events.some(e => e.type === 'reopen'));
});

test('curar el pool y editar un artista se persiste sin perder al resto', async t => {
  const { $, window } = bootDom(t, 'admin.html');
  await load('js/admin.js');
  const click = async selector => { $(selector).dispatchEvent(new window.Event('click')); await new Promise(r => setTimeout(r, 10)); };
  const set = (selector, value) => {
    $(selector).value = value;
    $(selector).dispatchEvent(new window.Event('input', { bubbles: true }));
  };

  const start = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO')).activeArtistIds.length;
  $('[data-pool="coldplay"]').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 10));
  let stored = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  assert.equal(stored.activeArtistIds.length, start - 1, 'retirar del pool debe quitar exactamente uno');
  assert.equal(stored.activeArtistIds.includes('coldplay'), false);

  set('#newName', 'Los Tres');
  set('#newCountry', 'CHI');
  set('#newCost', '3');
  set('#newPopularity', '4');
  set('#newDuration', '1.5');
  await click('#addArtist');

  stored = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  const nuevo = stored.customArtists.find(a => a.name === 'Los Tres');
  assert.ok(nuevo, 'el artista personalizado debe quedar guardado');
  assert.equal(stored.activeArtistIds.includes(nuevo.id), true);
  assert.equal(stored.deletedArtistIds.length, 0);
});

test('el estudiante entra, arma un lineup válido y lo entrega', async t => {
  const { $, window } = bootDom(t, 'index.html');
  const { days, validate } = await load('js/domain/game.js');
  const { artists } = await load('js/data/artists.js');

  // Las pruebas anteriores dejaron la actividad en curso; el estudiante llega
  // cuando el escenario todavía está cerrado.
  const lobby = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  lobby.state = 'lobby';
  window.localStorage.setItem('musicfest:session:DEMO', JSON.stringify(lobby));

  await load('js/student.js');

  $('#code').value = 'DEMO';
  $('#team').value = 'Los Optimizadores';
  $('#email').value = 'ana@udd.cl';
  $('#joinForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 30));

  assert.equal($('#joinError').textContent, '', 'no debe haber error al entrar');
  assert.equal($('#join').hidden, true);
  assert.equal($('#teamLabel').textContent, 'Los Optimizadores');

  // La sesión demo nace en lobby: el escenario está cerrado.
  assert.equal($('#waiting').hidden, false);

  // El docente inicia desde otra "pestaña": mismo localStorage.
  const session = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  session.state = 'active';
  session.updatedAt = new Date().toISOString();
  window.localStorage.setItem('musicfest:session:DEMO', JSON.stringify(session));
  window.dispatchEvent(new window.CustomEvent('musicfest-session', { detail: session }));
  await new Promise(r => setTimeout(r, 10));

  assert.equal($('#workspace').hidden, false);
  assert.ok($('#artistGrid').children.length > 0, 'la grilla de artistas debe renderizar');
  assert.equal($('#submit').disabled, true, 'sin lineup no se puede enviar');

  // Arma un lineup factible haciendo clic en las tarjetas reales.
  // El día activo lo decide el docente; después de la reapertura anterior no
  // tiene por qué ser el viernes.
  const dayIndex = session.mode === 'sequential' ? session.activeDayIndex : 0;
  const friday = { ...days[dayIndex], ...(session.days?.[dayIndex] || {}) };
  // El pool real de la actividad: catálogo semilla + personalizados, menos los
  // que el docente retiró en la prueba anterior.
  const pool = [...artists, ...(session.customArtists || [])]
    .map(a => ({ ...a, ...((session.artistOverrides || {})[a.id] || {}) }))
    .filter(a => session.activeArtistIds.includes(a.id));
  const chosen = buildFeasible(friday, pool);
  assert.equal(validate(chosen.map(a => a.id), friday, pool).valid, true, 'el escenario debe partir de un lineup factible');

  for (const artist of chosen) {
    const card = $(`[data-artist-id="${artist.id}"]`);
    assert.ok(card, `falta la tarjeta de ${artist.name}`);
    card.dispatchEvent(new window.Event('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 2));
  }

  assert.equal($('#submit').disabled, false, 'con el lineup completo el envío debe habilitarse');
  $('#submit').dispatchEvent(new window.Event('click'));
  $('#confirmSubmit').dispatchEvent(new window.Event('click'));
  await new Promise(r => setTimeout(r, 10));

  const draft = JSON.parse(window.localStorage.getItem('musicfest:draft:DEMO:Los Optimizadores'));
  const entrega = draft.submissions[friday.id];
  assert.equal(draft.statuses[friday.id], 'submitted');
  assert.equal(entrega.selections.length, friday.artistCount);
  assert.equal(entrega.dayIndex, dayIndex, 'la entrega debe llevar dayIndex para las reglas de Firestore');
  assert.equal(entrega.validationStatus, 'pending');
  assert.equal(entrega.revision, session.revision);

  // Deja que se apaguen los temporizadores de "Guardando…" antes de cerrar.
  await new Promise(r => setTimeout(r, 300));
});

test('la pestaña del cartel refleja el lineup y habilita la descarga', async t => {
  // jsdom no implementa canvas: el dibujo se salta solo, pero todo lo que lo
  // rodea —pestañas, contador, texto alternativo, estado del botón— sí se prueba.
  const { $, window } = bootDom(t, 'index.html');
  const activa = JSON.parse(window.localStorage.getItem('musicfest:session:DEMO'));
  activa.state = 'active';
  window.localStorage.setItem('musicfest:session:DEMO', JSON.stringify(activa));
  await load('js/student.js');

  $('#code').value = 'DEMO';
  $('#team').value = 'Los Optimizadores';
  $('#email').value = 'ana@udd.cl';
  $('#joinForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 40));

  assert.equal($('#panePoster').hidden, true, 'el pool es la pestaña inicial');
  assert.equal($('#posterCount').textContent, String(
    JSON.parse(window.localStorage.getItem('musicfest:draft:DEMO:Los Optimizadores')).selections[
      activa.mode === 'sequential' ? activa.days[activa.activeDayIndex].id : 'friday'].length));

  const tabCartel = $('[data-pane="poster"]');
  tabCartel.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 220));

  assert.equal($('#panePoster').hidden, false, 'la pestaña del cartel se muestra');
  assert.equal($('#panePool').hidden, true, 'el pool se oculta');
  assert.equal(tabCartel.getAttribute('aria-selected'), 'true');
  assert.ok($('#posterAlt').textContent.length > 0, 'el cartel describe su contenido para lectores de pantalla');

  const draft = JSON.parse(window.localStorage.getItem('musicfest:draft:DEMO:Los Optimizadores'));
  const dayId = activa.days[activa.mode === 'sequential' ? activa.activeDayIndex : 0].id;
  const tieneArtistas = draft.selections[dayId].length > 0;
  assert.equal($('#posterDownload').disabled, !tieneArtistas,
    'la descarga sólo se ofrece si hay algo que descargar');

  await new Promise(r => setTimeout(r, 200));
});

test('el panel docente ve la entrega, la recalcula y la valida', async t => {
  const { $, window } = bootDom(t, 'admin.html');
  await load('js/admin.js');
  await new Promise(r => setTimeout(r, 10));

  const card = $('#deliveryList .delivery-card');
  assert.ok(card, 'la entrega del equipo debe aparecer en la bandeja');
  assert.ok(card.textContent.includes('Los Optimizadores'));
  assert.ok(card.textContent.includes('RECÁLCULO DEL SERVIDOR'), 'la tarjeta debe mostrar el recálculo autoritativo');
  assert.ok(card.textContent.includes('CUMPLE TODAS LAS RESTRICCIONES'));
  assert.equal(card.textContent.includes('REVISAR'), false, 'no debería haber discrepancias');

  const validar = $('#deliveryList [data-validate]');
  assert.equal(validar.disabled, false);
  validar.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 20));

  const draft = JSON.parse(window.localStorage.getItem('musicfest:draft:DEMO:Los Optimizadores'));
  const entrega = Object.values(draft.submissions)[0];
  assert.equal(entrega.validationStatus, 'validated');
  assert.ok(entrega.validatedAt);
});

test('una entrega con totales inflados se marca y no se puede validar', async t => {
  const { $, window } = bootDom(t, 'admin.html');
  const key = 'musicfest:draft:DEMO:Los Optimizadores';
  const draft = JSON.parse(window.localStorage.getItem(key));
  const dayId = Object.keys(draft.submissions)[0];
  draft.submissions[dayId].validationStatus = 'pending';
  draft.submissions[dayId].totals = { ...draft.submissions[dayId].totals, score: 999 };
  window.localStorage.setItem(key, JSON.stringify(draft));

  await load('js/admin.js');
  await new Promise(r => setTimeout(r, 10));

  const card = $('#deliveryList .delivery-card');
  assert.ok(card.textContent.includes('REVISAR'), 'la discrepancia debe hacerse visible');
  assert.ok(card.textContent.includes('informado 999'));
  assert.equal(card.textContent.includes('999</b><small>POPULARIDAD'), false);
});
