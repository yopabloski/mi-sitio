// Ordenar el pool es una lectura del problema, no un adorno: el estudiante
// compara costo contra popularidad. Lo que se prueba acá es que el orden no
// pierda artistas, no dependa del filtro y no baraje los empates.
import test from 'node:test';
import assert from 'node:assert/strict';
import { artists } from '../../js/data/artists.js';
import { CRITERIOS, SIN_ORDEN, ordenarPool, siguienteOrden, flecha, describir } from '../../js/domain/pool.js';

const ids = lista => lista.map(a => a.id);

test('sin criterio válido, el orden es el del catálogo', () => {
  for (const orden of [undefined, null, SIN_ORDEN, { criterio: 'inventado' }]) {
    assert.deepEqual(ids(ordenarPool(artists, orden)), ids(artists));
  }
});

test('ordenar no muta la lista original', () => {
  const antes = ids(artists);
  ordenarPool(artists, { criterio: 'cost', direccion: 'desc' });
  assert.deepEqual(ids(artists), antes);
});

test('ordenar no pierde ni inventa artistas', () => {
  for (const criterio of Object.keys(CRITERIOS)) {
    for (const direccion of ['asc', 'desc']) {
      const salida = ordenarPool(artists, { criterio, direccion });
      assert.equal(salida.length, artists.length, `${criterio} ${direccion}`);
      assert.deepEqual(ids(salida).slice().sort(), ids(artists).slice().sort());
    }
  }
});

test('cada criterio ordena por su campo, en los dos sentidos', () => {
  for (const [criterio, { campo }] of Object.entries(CRITERIOS)) {
    const suben = ordenarPool(artists, { criterio, direccion: 'asc' }).map(a => Number(a[campo]));
    const bajan = ordenarPool(artists, { criterio, direccion: 'desc' }).map(a => Number(a[campo]));
    for (let i = 1; i < suben.length; i++) assert.ok(suben[i] >= suben[i - 1], `${criterio} asc en ${i}`);
    for (let i = 1; i < bajan.length; i++) assert.ok(bajan[i] <= bajan[i - 1], `${criterio} desc en ${i}`);
    assert.equal(suben[0], Math.min(...suben));
    assert.equal(bajan[0], Math.max(...bajan));
  }
});

test('los empates se resuelven por nombre y no se barajan al invertir', () => {
  const mismoCosto = a => a.cost === 4;
  const suben = ordenarPool(artists.filter(mismoCosto), { criterio: 'cost', direccion: 'asc' });
  const bajan = ordenarPool(artists.filter(mismoCosto), { criterio: 'cost', direccion: 'desc' });
  assert.ok(suben.length > 1, 'debe haber empates que comprobar');
  assert.deepEqual(ids(suben), ids(bajan), 'con todos iguales, invertir no cambia nada');
  assert.deepEqual(ids(suben), ids([...suben].sort((a, b) => a.name.localeCompare(b.name, 'es'))));
});

test('el orden se aplica sobre lo que el filtro ya dejó pasar', () => {
  // Es la garantía que pidió el aula: ordenar con y sin filtro de género.
  const rock = artists.filter(a => a.genre === 'Rock');
  const ordenado = ordenarPool(rock, { criterio: 'popularity', direccion: 'desc' });
  assert.equal(ordenado.length, rock.length);
  assert.ok(ordenado.every(a => a.genre === 'Rock'), 'ordenar no puede colar otros géneros');
  assert.equal(ordenado[0].popularity, Math.max(...rock.map(a => a.popularity)));
});

test('una lista vacía o de uno solo no rompe nada', () => {
  assert.deepEqual(ordenarPool([], { criterio: 'cost' }), []);
  assert.equal(ordenarPool([{ id: 'x', name: 'X', cost: 3 }], { criterio: 'cost' }).length, 1);
});

test('un dato ausente no manda al artista al limbo', () => {
  const lista = [{ id: 'a', name: 'A', cost: 2 }, { id: 'b', name: 'B' }, { id: 'c', name: 'C', cost: 1 }];
  assert.deepEqual(ids(ordenarPool(lista, { criterio: 'cost', direccion: 'asc' })), ['b', 'c', 'a']);
});

test('pulsar el criterio activo invierte; pulsar otro empieza subiendo', () => {
  let orden = SIN_ORDEN;
  orden = siguienteOrden(orden, 'cost');
  assert.deepEqual(orden, { criterio: 'cost', direccion: 'asc' });
  orden = siguienteOrden(orden, 'cost');
  assert.deepEqual(orden, { criterio: 'cost', direccion: 'desc' });
  orden = siguienteOrden(orden, 'popularity');
  assert.deepEqual(orden, { criterio: 'popularity', direccion: 'asc' });
  orden = siguienteOrden(orden, 'catalogo');
  assert.deepEqual(orden, SIN_ORDEN);
});

test('los rótulos dicen lo que el orden hace', () => {
  assert.equal(flecha({ criterio: 'cost', direccion: 'asc' }), '↑');
  assert.equal(flecha({ criterio: 'cost', direccion: 'desc' }), '↓');
  assert.equal(flecha(SIN_ORDEN), '');
  assert.equal(describir(SIN_ORDEN), 'Orden del catálogo');
  assert.equal(describir({ criterio: 'duration', direccion: 'desc' }), 'Duración, de mayor a menor');
});
