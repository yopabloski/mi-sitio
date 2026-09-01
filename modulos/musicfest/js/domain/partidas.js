// Códigos de partida: lógica pura para elegir, crear y renombrar.
//
// En MusicFest el código no es el identificador de la actividad. Hay una
// indirección: `musicfestCodes/{código}` guarda el `activityId` real, que lleva
// un sufijo aleatorio. Esa indirección permite renombrar una partida sin mover
// sus equipos ni sus entregas, pero abre una trampa: renombrar hacia un código
// que ya usa OTRA actividad le roba el mapeo y la deja huérfana —existe en la
// base de datos pero ya no se llega a ella desde ninguna parte—.
//
// Eso pasó de verdad el 1 de septiembre de 2026 y costó una limpieza a mano.
// Por eso `conflictoDeCodigo` existe: la comprobación vive acá, con pruebas, y
// no como un `if` olvidable dentro del manejador de un botón.

/** Lo que el docente escribe se guarda siempre así: mayúsculas, sin adornos. */
export const normalizarCodigo = valor =>
  String(valor ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

/**
 * ¿Se puede renombrar la partida actual a este código?
 *
 * @param {{codigo:string, mapa:Object<string,string>, activityIdActual:string|null}} situacion
 *   `mapa` va de código normalizado a activityId, tal como está en Firestore.
 * @returns {string|null} el motivo del rechazo, o null si se puede.
 */
export function conflictoDeCodigo({ codigo, mapa = {}, activityIdActual = null }) {
  const limpio = normalizarCodigo(codigo);
  if (!limpio) return 'El código no puede quedar vacío.';

  const dueño = mapa[limpio];
  if (dueño && activityIdActual && dueño !== activityIdActual) {
    return `El código ${limpio} ya es de otra partida. Elige uno distinto, o abre esa partida desde el selector.`;
  }
  return null;
}

/** Las más recientes primero: es el orden en que un docente las busca. */
export const ordenarPartidas = (lista = []) =>
  [...lista].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

/**
 * Abrir una partida es recargar el panel apuntando a otro código. Decidir si
 * hay algo que hacer —y con qué código— es lo que se prueba.
 *
 * @returns {{accion:'abrir'|'quedarse', codigo:string, error:string|null}}
 */
export function elegirPartida({ seleccionada = '', escrita = '', actual = '' }) {
  // Lo escrito manda sobre lo seleccionado: si el docente tecleó un código, es
  // porque quiere ese y no el que quedó marcado en la lista.
  const codigo = normalizarCodigo(escrita) || normalizarCodigo(seleccionada);
  if (!codigo) return { accion: 'quedarse', codigo: '', error: 'Elige una partida o escribe un código nuevo.' };
  if (codigo === normalizarCodigo(actual)) return { accion: 'quedarse', codigo, error: null };
  return { accion: 'abrir', codigo, error: null };
}
