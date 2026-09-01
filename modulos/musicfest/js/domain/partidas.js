// Códigos de partida: lógica pura para elegir, crear y renombrar.
//
// En MusicFest el código no es el identificador de la actividad. Hay una
// indirección: `musicfestCodes/{código}` guarda el `activityId` real, que lleva
// un sufijo aleatorio.
//
// Hubo un botón para cambiarle el código a una partida existente, y era una
// trampa: apuntar el código hacia otra actividad le robaba el mapeo y dejaba la
// anterior huérfana —existiendo en la base de datos, pero inalcanzable desde
// cualquier parte—. Pasó de verdad el 1 de septiembre de 2026 y costó una
// limpieza a mano. La operación se eliminó en vez de ponerle un seguro: si el
// código ES la partida, cambiárselo no significa nada claro. Se abre la que se
// quiere, o se crea otra.

/** Lo que el docente escribe se guarda siempre así: mayúsculas, sin adornos. */
export const normalizarCodigo = valor =>
  String(valor ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

// Cómo se lee cada estado en la lista. Son los mismos cuatro estados que maneja
// el panel, en minúscula y en femenino porque acompañan a "partida".
const ESTADOS = {
  lobby: 'sin empezar',
  active: 'en curso',
  paused: 'pausada',
  closed: 'cerrada'
};

export const etiquetaEstado = estado => ESTADOS[estado] || '';

/**
 * El texto de una opción del selector. "Abierta aquí" distingue la partida que
 * el panel tiene cargada del estado de la actividad, que son cosas distintas:
 * una partida cerrada puede estar abierta en el panel para revisarla.
 */
export function etiquetaPartida({ code, state, abierta = false }) {
  const partes = [normalizarCodigo(code)];
  const estado = etiquetaEstado(state);
  if (estado) partes.push(estado);
  if (abierta) partes.push('abierta aquí');
  return partes.join(' · ');
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
