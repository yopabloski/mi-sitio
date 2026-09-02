// Banco de ítems y puntuación de la encuesta de percepción.
// Funciones puras: se ejecutan con `node --test`, sin emuladores ni red.
//
// Estas pruebas defienden decisiones metodológicas, no solo aritmética. Cuando
// alguna falle, lo primero que hay que preguntarse es si el cambio que la rompió
// era intencional.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEMS, ITEM_IDS, TOTAL_ITEMS, ESCALAS, DIMENSIONES, DIM_IDS,
  VERSION_INSTRUMENTO, bloques, itemsDe
} from '../../js/domain/encuesta.config.js';
import {
  promedio, varianza, desviacion, mediana, alfaCronbach, spearmanBrown,
  validar, esPlana, mediaDimension, valoracionUEQ, puntuar, agregar, porItem,
  cabeceraCSV, filaCSV, generarCSV, pearson
} from '../../js/domain/encuesta.scoring.js';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);
const todo = v => Object.fromEntries(ITEM_IDS.map(id => [id, v]));

/* ══════════════════════ BANCO DE ÍTEMS ══════════════════════ */

test('el banco tiene 28 ítems repartidos en cuatro escalas', () => {
  assert.equal(TOTAL_ITEMS, 28);
  assert.equal(ITEMS.length, 28);
  assert.deepEqual(bloques().map(b => [b.id, b.items.length]),
    [['ueq', 8], ['emsi', 14], ['comp', 3], ['apr', 3]]);
});

test('no hay ids repetidos y cada ítem declara escala y dimensión válidas', () => {
  assert.equal(new Set(ITEM_IDS).size, 28);
  for (const it of ITEMS) {
    assert.ok(ESCALAS[it.escala], `${it.id} apunta a una escala inexistente`);
    assert.ok(DIMENSIONES[it.dim], `${it.id} apunta a una dimensión inexistente`);
    assert.equal(DIMENSIONES[it.dim].escala, it.escala, `${it.id} y su dimensión discrepan de escala`);
  }
});

test('el EMSI conserva la numeración salteada de la validación española', () => {
  // Los ítems 10 y 11 del SIMS se eliminaron en el CFA. El salto es la
  // constancia de que se usó la versión de 14 y no una selección propia:
  // renumerarlos borraría esa evidencia.
  const emsi = itemsDe('intrinseca').concat(itemsDe('identificada'),
    itemsDe('externa'), itemsDe('desmotivacion')).map(i => i.id).sort();
  assert.equal(emsi.length, 14);
  assert.ok(emsi.includes('emsi09') && emsi.includes('emsi12'));
  assert.ok(!emsi.includes('emsi10') && !emsi.includes('emsi11'),
    'los ítems 10 y 11 no deben existir');
});

test('el UEQ-S no tiene ítems invertidos: los ocho declaran izq y der', () => {
  const ueq = ITEMS.filter(i => i.escala === 'ueq');
  assert.equal(ueq.length, 8);
  for (const it of ueq) {
    assert.equal(typeof it.izq, 'string');
    assert.equal(typeof it.der, 'string');
    assert.equal(it.t, undefined, 'un ítem de diferencial semántico no lleva enunciado');
  }
});

test('el ítem 8 del UEQ-S está corregido y no duplica al 7', () => {
  // El PDF oficial trae «convencional» en ambos por un error de transcripción;
  // en alemán son konventionell (7) y herkömmlich (8).
  const [i7, i8] = ITEMS.filter(i => ['ueq7', 'ueq8'].includes(i.id));
  assert.notEqual(i7.izq, i8.izq, 'ueq7 y ueq8 no pueden compartir el polo izquierdo');
  assert.equal(i8.izq, 'habitual');
});

test('ningún enunciado visible nombra el mecanismo de la actividad', () => {
  // La encuesta va ANTES de la hoja de salida: un ítem que hable de que las
  // decisiones de un día reducen las opciones del siguiente sería una pista.
  const prohibido = /reduc\w+ (las )?opciones|d[ií]as? siguiente|se agota|ya no est[aá]n disponibles|acoplamiento|viernes|s[aá]bado|domingo/i;
  for (const it of ITEMS) {
    const texto = it.t || `${it.izq} ${it.der}`;
    assert.ok(!prohibido.test(texto), `${it.id} nombra el mecanismo: "${texto}"`);
  }
});

test('la versión del instrumento está declarada', () => {
  assert.match(VERSION_INSTRUMENTO, /^\d{4}-\d$/);
});

/* ══════════════════════ ESTADÍSTICA ══════════════════════ */

test('los descriptivos usan varianza muestral, no poblacional', () => {
  cerca(promedio([1, 2, 3, 4]), 2.5);
  cerca(varianza([1, 2, 3, 4]), 5 / 3);
  cerca(desviacion([2, 2, 2]), 0);
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
});

test('α de Cronbach reproduce el valor de su propia fórmula', () => {
  const m = [[1,2,2],[2,2,3],[3,4,4],[4,4,5],[5,5,5]];
  const k = 3;
  const varItems = [0,1,2].map(j => varianza(m.map(f => f[j])));
  const esperado = (k / (k - 1)) * (1 - varItems.reduce((a, b) => a + b, 0) / varianza(m.map(f => f[0]+f[1]+f[2])));
  cerca(alfaCronbach(m), esperado);
  assert.ok(alfaCronbach(m) > 0.9);
});

test('α se niega a calcularse donde no corresponde', () => {
  assert.equal(alfaCronbach([[1, 2]]), null, 'una sola persona');
  assert.equal(alfaCronbach([[3],[3],[3]]), null, 'un solo ítem');
  assert.equal(alfaCronbach([[2,2],[2,2],[2,2]]), null, 'varianza total cero');
});

test('Spearman-Brown solo acepta matrices de dos columnas', () => {
  cerca(spearmanBrown([[1,1],[2,2],[3,3],[4,4]]), 1);
  assert.equal(spearmanBrown([[1,1,1],[2,2,2],[3,3,3]]), null);
});

/* ══════════════════════ VALIDACIÓN ══════════════════════ */

test('validar() exige los 28 ítems como enteros de 1 a 7', () => {
  assert.ok(validar(todo(4)).completo);
  assert.equal(validar(todo(4)).faltantes.length, 0);

  const falta = todo(4); delete falta.ueq1;
  assert.equal(validar(falta).completo, false);
  assert.deepEqual(validar(falta).faltantes, ['ueq1']);

  const malo = todo(4); malo.emsi01 = 8;
  assert.deepEqual(validar(malo).invalidos, ['emsi01']);

  const decimal = todo(4); decimal.apr1 = 4.5;
  assert.deepEqual(validar(decimal).invalidos, ['apr1']);

  assert.equal(validar({}).faltantes.length, 28);
});

test('esPlana() detecta la respuesta en línea recta', () => {
  assert.ok(esPlana(todo(4)), 'un solo valor en los 28 es plana');
  const dos = todo(4); ITEM_IDS.slice(0, 10).forEach(id => { dos[id] = 5; });
  assert.ok(esPlana(dos), 'dos valores distintos también');
  const variada = Object.fromEntries(ITEM_IDS.map((id, i) => [id, (i % 7) + 1]));
  assert.equal(esPlana(variada), false);
  assert.equal(esPlana({}), false, 'sin respuestas no se marca nada');
});

/* ══════════════════════ PUNTUACIÓN ══════════════════════ */

test('el UEQ-S se transforma restando 4 y queda en −3…+3', () => {
  assert.equal(mediaDimension(todo(7), 'pragmatica'), 3);
  assert.equal(mediaDimension(todo(1), 'pragmatica'), -3);
  assert.equal(mediaDimension(todo(4), 'hedonica'), 0, 'el punto medio es el cero');
});

test('el EMSI NO se transforma: se queda en 1…7', () => {
  assert.equal(mediaDimension(todo(7), 'intrinseca'), 7);
  assert.equal(mediaDimension(todo(1), 'desmotivacion'), 1);
  assert.equal(mediaDimension(todo(5), 'competencia'), 5);
  assert.equal(mediaDimension(todo(5), 'aprendizaje'), 5);
});

test('una dimensión incompleta queda en null y no contamina el resto', () => {
  const r = todo(5); delete r.ueq1;
  assert.equal(mediaDimension(r, 'pragmatica'), null);
  assert.equal(mediaDimension(r, 'hedonica'), 1, 'la otra mitad del UEQ sigue puntuando');
  const p = puntuar(r);
  assert.equal(p.pragmatica, null);
  assert.equal(p.ueqGlobal, null, 'sin una de las dos no hay global');
  assert.equal(p.completo, false);
  assert.equal(p.itemsRespondidos, 27);
});

test('la valoración del UEQ usa el umbral de ±0,8', () => {
  assert.equal(valoracionUEQ(0.81), 'positiva');
  assert.equal(valoracionUEQ(0.8), 'neutra', 'el umbral es estricto');
  assert.equal(valoracionUEQ(-0.81), 'negativa');
  assert.equal(valoracionUEQ(0), 'neutra');
  assert.equal(valoracionUEQ(null), null);
});

test('el índice de autodeterminación es 2·MI + RI − RE − 2·AM', () => {
  const r = todo(4);
  itemsDe('intrinseca').forEach(i => { r[i.id] = 7; });
  itemsDe('identificada').forEach(i => { r[i.id] = 7; });
  itemsDe('externa').forEach(i => { r[i.id] = 1; });
  itemsDe('desmotivacion').forEach(i => { r[i.id] = 1; });
  // 2(7) + 7 − 1 − 2(1) = 18, el máximo del rango
  assert.equal(puntuar(r).indiceAutodeterminacion, 18);

  const inverso = todo(4);
  itemsDe('intrinseca').forEach(i => { inverso[i.id] = 1; });
  itemsDe('identificada').forEach(i => { inverso[i.id] = 1; });
  itemsDe('externa').forEach(i => { inverso[i.id] = 7; });
  itemsDe('desmotivacion').forEach(i => { inverso[i.id] = 7; });
  assert.equal(puntuar(inverso).indiceAutodeterminacion, -18);
});

/* ══════════════════════ AGREGACIÓN ══════════════════════ */

test('agregar() cuenta completos y planas, y transforma solo el UEQ', () => {
  const variada = Object.fromEntries(ITEM_IDS.map((id, i) => [id, (i % 7) + 1]));
  const incompleta = { ...variada }; delete incompleta.apr1;
  const docs = [{ respuestas: todo(4) }, { respuestas: variada }, { respuestas: incompleta }];
  const a = agregar(docs);
  assert.equal(a.n, 3);
  assert.equal(a.completos, 2);
  assert.equal(a.planas, 1, 'solo la de todo 4 es plana');
  assert.equal(a.dimensiones.aprendizaje.n, 2, 'la incompleta no entra en su dimensión');
  assert.equal(a.dimensiones.pragmatica.n, 3, 'pero sí en las que tiene completas');
});

test('agregar() sobre una muestra vacía devuelve ceros, no errores', () => {
  const a = agregar([]);
  assert.equal(a.n, 0);
  assert.equal(a.ueqGlobal, null);
  assert.equal(a.indiceAutodeterminacion, null);
  for (const dim of DIM_IDS) {
    assert.equal(a.dimensiones[dim].n, 0);
    assert.equal(a.dimensiones[dim].media, null);
    assert.equal(a.dimensiones[dim].alertaFiabilidad, false);
  }
});

test('la alerta de fiabilidad se enciende .15 bajo la validación', () => {
  const a = agregar([]);
  assert.equal(a.dimensiones.intrinseca.alfaRef, 0.84);
  assert.equal(a.dimensiones.competencia.alfaRef, null, 'sin validación no hay referencia');

  // Respuestas aleatorias: alfa se desploma y la alerta debe encenderse.
  let semilla = 7;
  const azar = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) % 7 + 1;
  const ruido = Array.from({ length: 30 }, () => ({
    respuestas: Object.fromEntries(ITEM_IDS.map(id => [id, azar()]))
  }));
  assert.equal(agregar(ruido).dimensiones.intrinseca.alertaFiabilidad, true);
});

test('porItem() devuelve una fila por ítem con distribución de siete casillas', () => {
  const filas = porItem([{ respuestas: todo(4) }, { respuestas: todo(7) }]);
  assert.equal(filas.length, 28);
  const ueq1 = filas.find(f => f.id === 'ueq1');
  assert.equal(ueq1.texto, 'obstructivo — impulsor de apoyo', 'el diferencial muestra sus dos polos');
  assert.equal(ueq1.distribucion.length, 7);
  assert.equal(ueq1.distribucion[3], 1, 'un 4');
  assert.equal(ueq1.distribucion[6], 1, 'un 7');
  assert.equal(ueq1.media, 5.5, 'porItem NO transforma: informa la respuesta cruda');
  assert.equal(filas.find(f => f.id === 'emsi01').texto, ITEMS.find(i => i.id === 'emsi01').t);
});

test('porItem() cuenta los faltantes contra el total de documentos', () => {
  const sin = todo(4); delete sin.comp1;
  const filas = porItem([{ respuestas: todo(4) }, { respuestas: sin }]);
  assert.equal(filas.find(f => f.id === 'comp1').faltantes, 1);
  assert.equal(filas.find(f => f.id === 'comp2').faltantes, 0);
});

/* ══════════════════════ CSV ══════════════════════ */

test('el CSV lleva BOM para que Excel en español lo abra en UTF-8', () => {
  const csv = generarCSV([{ email: 'a@udd.cl', respuestas: todo(4) }]);
  assert.equal(csv.charCodeAt(0), 0xFEFF, 'sin BOM, Excel rompe las tildes');
  assert.ok(csv.includes('\r\n'), 'saltos de línea de Windows');
});

test('cada fila del CSV tiene exactamente las columnas de la cabecera', () => {
  const cab = cabeceraCSV();
  assert.equal(cab.length, 6 + 28 + DIM_IDS.length + 5);
  const fila = filaCSV({ email: 'a@udd.cl', version: '2026-1', respuestas: todo(4) });
  assert.equal(fila.length, cab.length);
  // Campos que ya no se recogen quedan vacíos, sin desalinear nada.
  assert.equal(fila[cab.indexOf('pareja')], '');
  assert.equal(fila[cab.indexOf('sesionId')], '');
});

test('el CSV escapa comillas y aplana los saltos de línea de la respuesta abierta', () => {
  const csv = generarCSV([{ email: 'a@udd.cl', abierta: 'Dijo "esto"\ny esto', respuestas: todo(4) }]);
  assert.ok(csv.includes('""esto""'), 'las comillas se duplican');
  const lineas = csv.split('\r\n');
  assert.equal(lineas.length, 2, 'el salto interno no puede partir la fila');
});

test('una muestra vacía produce un CSV con solo la cabecera', () => {
  assert.equal(generarCSV([]).split('\r\n').length, 1);
});

/* ══════════════════════ H6 ══════════════════════ */

test('pearson() calcula la correlación y se niega con muestras cortas', () => {
  cerca(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  cerca(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1);
  assert.equal(pearson([1, 2], [1, 2]), null, 'menos de tres pares');
  assert.equal(pearson([1, 2, 3], [1, 2]), null, 'largos distintos');
  assert.equal(pearson([2, 2, 2], [1, 2, 3]), null, 'sin varianza no hay correlación');
});
