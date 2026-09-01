// MusicFest · orden del pool de artistas.
//
// Puro: sin DOM. El orden es una lectura del problema —¿qué me conviene por
// costo?, ¿qué me rinde por popularidad?— así que vive fuera de la vista y se
// puede comprobar sola.
//
// El orden no toca el filtro de género ni la búsqueda: se aplica sobre lo que
// esos dos ya dejaron pasar. Y nunca reordena el catálogo original, así que la
// numeración de las tarjetas se mantiene estable.

/** Lo que se puede ordenar, y cómo se llama en pantalla. */
export const CRITERIOS = {
  cost:       { etiqueta: 'Costo',       campo: 'cost' },
  popularity: { etiqueta: 'Popularidad', campo: 'popularity' },
  duration:   { etiqueta: 'Duración',    campo: 'duration' }
};

export const SIN_ORDEN = { criterio: 'catalogo', direccion: 'asc' };

/**
 * Ordena una copia. Los empates se resuelven siempre por nombre, en el mismo
 * sentido, para que invertir la dirección no baraje a los que valen igual: si
 * cinco artistas cuestan 4, aparecen en el mismo orden hacia arriba y hacia
 * abajo, y el estudiante no cree que la lista cambió más de lo que cambió.
 */
export function ordenarPool(lista, orden = SIN_ORDEN) {
  const criterio = orden?.criterio;
  if (!CRITERIOS[criterio]) return [...lista];
  const campo = CRITERIOS[criterio].campo;
  const signo = orden.direccion === 'desc' ? -1 : 1;
  return [...lista].sort((a, b) => {
    const diferencia = (Number(a?.[campo]) || 0) - (Number(b?.[campo]) || 0);
    if (diferencia) return diferencia * signo;
    return String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'es');
  });
}

/**
 * Qué orden sigue al pulsar un botón. Pulsar el criterio activo invierte la
 * dirección; pulsar otro empieza de menor a mayor; «catálogo» vuelve al orden
 * original.
 */
export function siguienteOrden(actual = SIN_ORDEN, criterio) {
  if (!CRITERIOS[criterio]) return { ...SIN_ORDEN };
  if (actual?.criterio !== criterio) return { criterio, direccion: 'asc' };
  return { criterio, direccion: actual.direccion === 'asc' ? 'desc' : 'asc' };
}

/** Cómo se rotula el botón activo. */
export const flecha = orden =>
  (CRITERIOS[orden?.criterio] ? (orden.direccion === 'desc' ? '↓' : '↑') : '');

/** Texto para lectores de pantalla y para el aviso del pool. */
export function describir(orden) {
  if (!CRITERIOS[orden?.criterio]) return 'Orden del catálogo';
  const sentido = orden.direccion === 'desc' ? 'de mayor a menor' : 'de menor a mayor';
  return `${CRITERIOS[orden.criterio].etiqueta}, ${sentido}`;
}
