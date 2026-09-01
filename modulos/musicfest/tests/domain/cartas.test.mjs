// Las cartas impresas van a entrar en fundas físicas: lo que se prueba acá es
// la aritmética de la hoja, que es lo único de una impresión que se puede
// comprobar sin gastar papel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { artists } from '../../js/data/artists.js';
import { TAMANOS, HOJA, areaUtil, reparto, enPaginas, espejar, poolDe, plan } from '../../js/domain/cartas.js';

test('los tres tamaños son los de las fundas mini estándar', () => {
  assert.deepEqual(
    Object.values(TAMANOS).map(t => `${t.ancho}×${t.alto}`),
    ['41×63', '43×65', '45×68']
  );
});

test('ninguna carta se sale del área imprimible', () => {
  const util = areaUtil(HOJA);
  for (const [clave, tamano] of Object.entries(TAMANOS)) {
    const { columnas, filas } = reparto(tamano);
    assert.ok(columnas >= 1 && filas >= 1, `${clave} no entra en la hoja`);
    assert.ok(columnas * tamano.ancho <= util.ancho, `${clave} se pasa de ancho`);
    assert.ok(filas * tamano.alto <= util.alto, `${clave} se pasa de alto`);
  }
});

test('el reparto por hoja es el que dicta la geometría', () => {
  assert.deepEqual(reparto(TAMANOS.american), { columnas: 4, filas: 4, porPagina: 16 });
  assert.deepEqual(reparto(TAMANOS.chimera), { columnas: 4, filas: 4, porPagina: 16 });
  assert.deepEqual(reparto(TAMANOS.euro), { columnas: 4, filas: 3, porPagina: 12 });
});

test('un margen más generoso quita una columna antes que romper la hoja', () => {
  const { columnas } = reparto(TAMANOS.euro, { ...HOJA, margen: 20 });
  assert.equal(columnas, 3);
  assert.ok(3 * TAMANOS.euro.ancho <= areaUtil({ ...HOJA, margen: 20 }).ancho);
});

test('la última página se rellena para que la grilla quede completa', () => {
  const paginas = enPaginas([1, 2, 3, 4, 5], 4);
  assert.equal(paginas.length, 2);
  assert.deepEqual(paginas[0], [1, 2, 3, 4]);
  assert.deepEqual(paginas[1], [5, null, null, null]);
});

test('el espejo por borde largo invierte cada fila, no la página', () => {
  const pagina = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(espejar(pagina, 4, 'largo'), [4, 3, 2, 1, 8, 7, 6, 5]);
});

test('el espejo por borde corto gira la página entera', () => {
  const pagina = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.deepEqual(espejar(pagina, 4, 'corto'), [8, 7, 6, 5, 4, 3, 2, 1]);
});

test('espejar dos veces devuelve la página original', () => {
  const pagina = [...Array(16).keys()];
  for (const modo of ['largo', 'corto']) {
    assert.deepEqual(espejar(espejar(pagina, 4, modo), 4, modo), pagina, `modo ${modo}`);
  }
});

test('el reverso de una página incompleta cae sobre su propia cara', () => {
  // El caso que rompe en la última hoja: sin relleno, el hueco se corre y cada
  // reverso queda pegado a la carta equivocada.
  const [pagina] = enPaginas(['a', 'b', 'c'], 8);
  const reverso = espejar(pagina, 4, 'largo');
  // La carta 'a' está en la posición 0 de la fila 1; su reverso debe caer en la
  // posición 3, que es donde queda esa columna después de voltear la hoja.
  assert.equal(reverso[3], 'a');
  assert.equal(reverso[2], 'b');
  assert.equal(reverso[1], 'c');
  assert.equal(reverso[0], null);
});

test('el pool respeta lo que el docente dejó en juego', () => {
  const session = {
    activeArtistIds: ['coldplay', 'radiohead', 'los-tres'],
    customArtists: [{ id: 'los-tres', name: 'Los Tres', genre: 'Rock', country: 'CHI', cost: 3, popularity: 4, duration: 1.5 }],
    deletedArtistIds: [],
    artistOverrides: { radiohead: { cost: 9 } }
  };
  const pool = poolDe(session, artists);
  assert.deepEqual(pool.map(a => a.id).sort(), ['coldplay', 'los-tres', 'radiohead']);
  assert.equal(pool.find(a => a.id === 'radiohead').cost, 9, 'la edición del docente manda');
  assert.ok(pool.find(a => a.id === 'los-tres'), 'los artistas personalizados también se imprimen');
});

test('un artista eliminado no vuelve por la puerta del catálogo semilla', () => {
  const session = { activeArtistIds: null, deletedArtistIds: ['coldplay'], customArtists: [], artistOverrides: {} };
  assert.equal(poolDe(session, artists).some(a => a.id === 'coldplay'), false);
});

test('sin sesión, el pool es el catálogo completo', () => {
  assert.equal(poolDe(null, artists).length, artists.length);
});

test('el plan de impresión cuenta las hojas antes de gastar papel', () => {
  assert.deepEqual(plan(81, TAMANOS.american, { reversos: false }),
    { columnas: 4, filas: 4, porPagina: 16, paginas: 6, hojas: 6 });
  assert.deepEqual(plan(81, TAMANOS.euro, { reversos: true }),
    { columnas: 4, filas: 3, porPagina: 12, paginas: 7, hojas: 14 });
  assert.equal(plan(0, TAMANOS.euro).paginas, 0);
});
