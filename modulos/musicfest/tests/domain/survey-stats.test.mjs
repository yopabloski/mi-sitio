// Estadística de la encuesta de percepción. No toca Firebase ni el DOM:
// se ejecuta con `node --test`, igual que el resto de tests/domain/.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  media, varianza, de, mediana, alfa, spearmanBrown, fiabilidad,
  puntajeSUS, lecturaSUS, dia, enRango, lecturaDuracion, formatoDuracion
} from '../../js/domain/survey-stats.js';

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} ≠ ${b}`);

test('los descriptivos usan varianza muestral, no poblacional', () => {
  cerca(media([1, 2, 3, 4]), 2.5);
  cerca(varianza([1, 2, 3, 4]), 5 / 3);   // n-1 en el denominador
  cerca(de([2, 2, 2]), 0);
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
});

test('α de Cronbach reproduce el valor conocido de una matriz de referencia', () => {
  // Tres ítems, cinco personas. α calculado a mano con la fórmula estándar.
  const m = [[1,2,2],[2,2,3],[3,4,4],[4,4,5],[5,5,5]];
  const k = 3;
  const varItems = [0,1,2].map(j => varianza(m.map(f => f[j])));
  const varTotal = varianza(m.map(f => f[0] + f[1] + f[2]));
  const esperado = (k / (k - 1)) * (1 - varItems.reduce((a, b) => a + b, 0) / varTotal);
  cerca(alfa(m), esperado);
  assert.ok(alfa(m) > 0.9, 'ítems muy correlacionados deben dar α alto');
});

test('α se niega a calcularse donde no corresponde', () => {
  assert.equal(alfa([[1, 2]]), null, 'una sola persona');
  assert.equal(alfa([[3],[3],[3]]), null, 'un solo ítem');
  assert.equal(alfa([[2,2],[2,2],[2,2]]), null, 'varianza total cero');
});

test('Spearman-Brown es la fiabilidad de las escalas de dos ítems', () => {
  // Correlación perfecta: la fórmula debe devolver exactamente 1.
  cerca(spearmanBrown([[1,1],[2,2],[3,3],[4,4]]), 1);
  // 2r/(1+r) con r conocido.
  const m = [[1,2],[2,1],[3,4],[4,3],[5,5]];
  const x = m.map(f => f[0]), y = m.map(f => f[1]);
  const mx = media(x), my = media(y);
  const num = x.reduce((s, _, i) => s + (x[i] - mx) * (y[i] - my), 0);
  const den = Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0) * y.reduce((s, v) => s + (v - my) ** 2, 0));
  const r = num / den;
  cerca(spearmanBrown(m), (2 * r) / (1 + r));
});

test('fiabilidad elige el estadístico según el número de ítems', () => {
  const dos = [[1,1],[2,2],[3,3],[4,4]];
  const tres = [[1,2,2],[2,2,3],[3,4,4],[4,4,5],[5,5,5]];
  assert.equal(fiabilidad(dos, 2).usa, 'Spearman-Brown');
  assert.equal(fiabilidad(tres, 3).usa, 'α');
  // Con dos ítems NUNCA debe caer en α: es inestable y está mal aplicado.
  cerca(fiabilidad(dos, 2).valor, spearmanBrown(dos));
  assert.equal(fiabilidad([], 3).valor, null);
});

test('el SUS positivo se convierte a 0–100 sin invertir ítems', () => {
  const items = Array.from({ length: 10 }, (_, i) => 'sus' + String(i + 1).padStart(2, '0'));
  const todo5 = { respuestas: Object.fromEntries(items.map(i => [i, 5])) };
  const todo1 = { respuestas: Object.fromEntries(items.map(i => [i, 1])) };
  const todo3 = { respuestas: Object.fromEntries(items.map(i => [i, 3])) };
  assert.equal(puntajeSUS([todo5], items), 100);
  assert.equal(puntajeSUS([todo1], items), 0);
  assert.equal(puntajeSUS([todo3], items), 50);
  assert.equal(puntajeSUS([todo5, todo1], items), 50);
});

test('el SUS descarta a quien no respondió los diez ítems', () => {
  const items = Array.from({ length: 10 }, (_, i) => 'sus' + String(i + 1).padStart(2, '0'));
  const completo = { respuestas: Object.fromEntries(items.map(i => [i, 5])) };
  const incompleto = { respuestas: Object.fromEntries(items.slice(0, 9).map(i => [i, 1])) };
  assert.equal(puntajeSUS([completo, incompleto], items), 100, 'el incompleto no arrastra la media');
  assert.equal(puntajeSUS([incompleto], items), null);
});

test('la lectura del SUS se ancla en el promedio de referencia 68', () => {
  assert.equal(lecturaSUS(null).nota, '');
  assert.equal(lecturaSUS(80).clase, '');
  assert.ok(lecturaSUS(80).nota.includes('sobre'));
  assert.equal(lecturaSUS(65).clase, 'warn');
  assert.equal(lecturaSUS(40).clase, 'bad');
});

test('dia() usa la fecha local, no UTC', () => {
  // Un envío a las 22:00 en Chile debe contar como del día en curso.
  const noche = new Date(2026, 8, 1, 22, 30).toISOString();
  assert.equal(dia(noche), '2026-09-01');
  const madrugada = new Date(2026, 8, 2, 0, 30).toISOString();
  assert.equal(dia(madrugada), '2026-09-02');
  assert.equal(dia('no es fecha'), '');
});

test('el filtro por rango es inclusivo en ambos extremos', () => {
  const r = [
    { enviadoEn: new Date(2026, 8, 1, 12).toISOString() },
    { enviadoEn: new Date(2026, 8, 3, 12).toISOString() },
    { enviadoEn: new Date(2026, 8, 5, 12).toISOString() }
  ];
  assert.equal(enRango(r, '', '').length, 3, 'sin extremos no filtra');
  assert.equal(enRango(r, '2026-09-01', '2026-09-05').length, 3, 'los bordes entran');
  assert.equal(enRango(r, '2026-09-02', '').length, 2);
  assert.equal(enRango(r, '', '2026-09-03').length, 2);
  assert.equal(enRango(r, '2026-09-03', '2026-09-03').length, 1);
  assert.equal(enRango(r, '2026-10-01', '2026-10-31').length, 0);
});

test('la duración se lee contra el presupuesto de 4 minutos', () => {
  assert.ok(lecturaDuracion(400).includes('pasa del presupuesto'));
  assert.ok(lecturaDuracion(60).includes('línea recta'));
  assert.ok(lecturaDuracion(200).includes('Dentro'));
  assert.equal(lecturaDuracion(null), '');
  assert.equal(formatoDuracion(200), '3 min 20 s');
  assert.equal(formatoDuracion(65), '1 min 05 s');
  assert.equal(formatoDuracion(null), '—');
});
