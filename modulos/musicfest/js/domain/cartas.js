// MusicFest · geometría de las cartas para imprimir.
//
// Puro: sin DOM, sin red, sin depender del catálogo. Todo lo que decide dónde
// cae cada carta en la hoja vive acá, porque es lo único de la impresión que se
// puede comprobar sin mirar una página impresa.
//
// La parte visual está en js/ui/cartas-print.js, igual que poster.js y
// poster-canvas.js se reparten el cartel.

/** Medidas de funda estándar, en milímetros. */
export const TAMANOS = {
  american: { etiqueta: 'Mini American', ancho: 41, alto: 63 },
  chimera:  { etiqueta: 'Mini Chimera',  ancho: 43, alto: 65 },
  euro:     { etiqueta: 'Mini Euro',     ancho: 45, alto: 68 }
};

/** Carta estadounidense, en milímetros, con el margen que deja el diseño. */
export const HOJA = { ancho: 216, alto: 279, margen: 8 };

export const areaUtil = (hoja = HOJA) => ({
  ancho: hoja.ancho - hoja.margen * 2,
  alto: hoja.alto - hoja.margen * 2
});

/**
 * Cuántas cartas entran en una hoja. Se calcula, no se escribe a mano: si
 * cambia el margen o aparece otro tamaño de funda, el reparto se ajusta solo.
 */
export function reparto(tamano, hoja = HOJA) {
  const util = areaUtil(hoja);
  const columnas = Math.floor(util.ancho / tamano.ancho);
  const filas = Math.floor(util.alto / tamano.alto);
  return { columnas, filas, porPagina: columnas * filas };
}

/**
 * Parte la lista en páginas completas. Las páginas se rellenan con `null` hasta
 * completar la grilla: sin eso, el espejo de los reversos desalinea la última
 * hoja, que es justamente la que nadie revisa.
 */
export function enPaginas(lista, porPagina) {
  if (porPagina < 1) throw new Error('porPagina debe ser al menos 1');
  const paginas = [];
  for (let i = 0; i < lista.length; i += porPagina) {
    const pagina = lista.slice(i, i + porPagina);
    while (pagina.length < porPagina) pagina.push(null);
    paginas.push(pagina);
  }
  return paginas;
}

/**
 * Posición espejada de los reversos según cómo voltee la impresora.
 *
 * Borde largo: la hoja gira sobre su eje vertical, así que la columna 1 termina
 * donde estaba la última. Se invierte cada fila.
 * Borde corto: la hoja gira 180°, y se invierte la página entera.
 */
export function espejar(pagina, columnas, modo = 'largo') {
  if (modo === 'corto') return [...pagina].reverse();
  const salida = [];
  for (let i = 0; i < pagina.length; i += columnas) {
    salida.push(...pagina.slice(i, i + columnas).reverse());
  }
  return salida;
}

/**
 * El pool real de la actividad: catálogo semilla más los artistas creados por
 * el docente, menos los que retiró, con sus ediciones aplicadas. Misma lectura
 * que hace student.js para armar la grilla del estudiante.
 */
export function poolDe(session, catalogo = []) {
  const todos = [...catalogo, ...(session?.customArtists || [])];
  const borrados = session?.deletedArtistIds || [];
  const ediciones = session?.artistOverrides || {};
  const activos = session?.activeArtistIds;
  const unicos = todos
    .filter((a, i) => !borrados.includes(a.id) && todos.findIndex(x => x.id === a.id) === i)
    .map(a => ({ ...a, ...(ediciones[a.id] || {}) }));
  return activos ? unicos.filter(a => activos.includes(a.id)) : unicos;
}

/** Resumen del trabajo de impresión, para avisar antes de gastar papel. */
export function plan(cantidad, tamano, { reversos = false, hoja = HOJA } = {}) {
  const { columnas, filas, porPagina } = reparto(tamano, hoja);
  const paginas = Math.ceil(cantidad / porPagina) || 0;
  return { columnas, filas, porPagina, paginas, hojas: reversos ? paginas * 2 : paginas };
}
