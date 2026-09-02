// La lógica de la encuesta se separó del HTML. Estas pruebas cubren la costura
// que esa separación abre: que los identificadores que busca el JS existan en
// el markup, y que el panel y la encuesta sigan hablando de los mismos ítems.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

// Importables en Node porque ninguno toca el DOM al cargarse.
const { INSTRUMENTOS, TOTAL, marcado } = await import('../../js/survey.js');
const { ESCALAS, generarEjemplo } = await import('../../js/survey-panel.js');
const store = await import('../../js/services/survey-store.js');

test('la encuesta declara 27 ítems repartidos en cuatro instrumentos', () => {
  assert.equal(INSTRUMENTOS.length, 4);
  assert.equal(TOTAL, 27);
  assert.deepEqual(INSTRUMENTOS.map(b => b.items.length), [10, 6, 9, 2]);
  assert.deepEqual(INSTRUMENTOS.map(b => b.escala), [5, 5, 7, 5]);
});

test('el panel lee exactamente los ítems que la encuesta escribe', () => {
  const escribe = INSTRUMENTOS.flatMap(b => b.items.map(i => i.id));
  const lee = ESCALAS.flatMap(e => e.items);
  assert.deepEqual(lee, escribe, 'ESCALAS debe reflejar INSTRUMENTOS, en el mismo orden');
  assert.equal(new Set(escribe).size, escribe.length, 'no puede haber ids repetidos');
});

test('las escalas del panel coinciden con las de la encuesta ítem por ítem', () => {
  const escalaDe = {};
  INSTRUMENTOS.forEach(b => b.items.forEach(i => { escalaDe[i.id] = b.escala; }));
  ESCALAS.forEach(e => e.items.forEach(id => {
    assert.equal(e.escala, escalaDe[id], `${id} usa escala distinta en el panel`);
  }));
});

test('la subescala de aprendizaje percibido tiene dos ítems, y por eso no usa α', () => {
  const apre = ESCALAS.find(e => e.id === 'apre');
  assert.equal(apre.items.length, 2);
});

test('ningún enunciado visible nombra el mecanismo de la actividad', () => {
  // La encuesta va ANTES del test de salida: un ítem que hable de que las
  // decisiones de un día reducen las opciones del siguiente sería una pista.
  const prohibido = /reduc\w+ (las )?opciones|d[ií]as siguientes|se agota|ya no est[aá]n disponibles|acoplamiento/i;
  INSTRUMENTOS.flatMap(b => b.items).forEach(it => {
    assert.ok(!prohibido.test(it.t), `el ítem ${it.id} nombra el mecanismo: "${it.t}"`);
  });
});

test('marcado() genera un bloque por instrumento y una celda por punto de escala', () => {
  const html = marcado();
  assert.equal((html.match(/data-item="/g) || []).length, 27);
  assert.equal((html.match(/class="block"/g) || []).length, 4);
  // 10×5 + 6×5 + 9×7 + 2×5 = 153 radios
  assert.equal((html.match(/type="radio"/g) || []).length, 10*5 + 6*5 + 9*7 + 2*5);
});

test('marcado() escapa el texto de los ítems', () => {
  const html = marcado([{ nombre: 'x', fuente: 'y', escala: 2, anclas: ['a','b'],
    items: [{ id: 'z', t: '<script>alert(1)</script>' }] }]);
  assert.ok(!html.includes('<script>'), 'un enunciado con markup no debe inyectarse');
  assert.ok(html.includes('&lt;script&gt;'));
});

test('los datos de ejemplo se reparten en varios días, para poder filtrarlos', () => {
  const demo = generarEjemplo(Date.parse('2026-09-01T12:00:00Z'));
  assert.equal(demo.length, 43);
  assert.ok(demo.every(r => r.demo === true), 'quedan marcados como de ejemplo');
  assert.ok(demo.every(r => r.id.startsWith('demo-')), 'y con id reconocible');
  assert.ok(new Set(demo.map(r => r.enviadoEn.slice(0, 10))).size >= 4);
  assert.equal(new Set(demo.map(r => r.email)).size, 43, 'un correo distinto por respuesta');
});

test('claveDe() identifica también las respuestas guardadas antes de que hubiera id', () => {
  assert.equal(store.claveDe({ id: 'abc', email: 'a@udd.cl', enviadoEn: 'x' }), 'abc');
  assert.equal(store.claveDe({ email: 'a@udd.cl', enviadoEn: 'x' }), 'a@udd.cl|x');
});

test('ordenar() deja la respuesta más reciente primero', () => {
  const r = store.ordenar([
    { enviadoEn: '2026-09-01T10:00:00Z' },
    { enviadoEn: '2026-09-03T10:00:00Z' },
    { enviadoEn: '2026-09-02T10:00:00Z' }
  ]);
  assert.deepEqual(r.map(x => x.enviadoEn.slice(8, 10)), ['03', '02', '01']);
});

/* ── Costura HTML ↔ JS ────────────────────────────────────────────────── */

const idsQueBusca = js => [...js.matchAll(/\$\("#([\w-]+)"\)/g)].map(m => m[1]);
const idsQueDefine = html => new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));

test('todos los id que busca js/survey.js existen en survey.html', () => {
  const define = idsQueDefine(leer('survey.html'));
  const faltan = [...new Set(idsQueBusca(leer('js/survey.js')))].filter(id => !define.has(id));
  assert.deepEqual(faltan, [], 'el JS busca elementos que el markup no tiene');
});

test('todos los id que busca js/survey-panel.js existen en survey-dashboard.html', () => {
  const define = idsQueDefine(leer('survey-dashboard.html'));
  const faltan = [...new Set(idsQueBusca(leer('js/survey-panel.js')))].filter(id => !define.has(id));
  assert.deepEqual(faltan, [], 'el JS busca elementos que el markup no tiene');
});

test('las dos páginas cargan su módulo y no dejan lógica incrustada', () => {
  for (const [pagina, modulo] of [['survey.html', 'js/survey.js'], ['survey-dashboard.html', 'js/survey-panel.js']]) {
    const html = leer(pagina);
    assert.ok(html.includes(`<script type="module" src="${modulo}"></script>`), `${pagina} no carga ${modulo}`);
    assert.equal((html.match(/<script/g) || []).length, 1, `${pagina} tiene más de un script`);
  }
});

test('las clases que usa el markup están definidas en survey.css', () => {
  const css = leer('survey.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const definidas = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  for (const pagina of ['survey.html', 'survey-dashboard.html']) {
    const usadas = new Set([...leer(pagina).matchAll(/class="([^"{}]*)"/g)].flatMap(m => m[1].split(/\s+/)));
    const faltan = [...usadas].filter(c => c && !definidas.has(c));
    assert.deepEqual(faltan, [], `${pagina} usa clases sin definir`);
  }
});

test('la encuesta no pide número de pareja ni describe el procedimiento', () => {
  const html = leer('survey.html');
  assert.ok(!/id="pareja"|Número de pareja/.test(html));
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(!/hoja de salida|papeleta|chequeo de manipulaci/i.test(visible));
});
