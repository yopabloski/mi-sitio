// Quién puede entrar a un equipo: decisión pura, sin Firestore y sin DOM.
//
// El nombre del equipo es su identidad dentro de la partida —`normalizeTeamId`
// lo convierte en el id del documento— y los equipos viven como subcolección de
// la actividad, así que dos partidas distintas nunca se pisan los nombres.
// Lo que se decide acá es qué pasa dentro de una misma partida.
//
// Dos políticas:
//   'open'     el nombre es un punto de encuentro. Varios dispositivos comparten
//              un equipo y un borrador. Cómodo, pero dos grupos que eligen el
//              mismo nombre se fusionan sin enterarse.
//   'claimed'  el nombre es único: el primero que lo toma se lo queda.
//
// El caso que obliga a que esto sea una función y no un `if` suelto es el
// equipo liberado por el docente: queda existiendo con la membresía vacía, y
// tiene que poder reclamarse aunque la política sea estricta. Sin eso, liberar
// un equipo no lo libera de verdad.

export const POLITICAS = { ABIERTA: 'open', UNICA: 'claimed' };

/** La política efectiva de una actividad; ante cualquier valor raro, la abierta. */
export const politicaDe = actividad =>
  actividad?.teamJoinPolicy === POLITICAS.UNICA ? POLITICAS.UNICA : POLITICAS.ABIERTA;

/**
 * @param {{existe:boolean, miembros?:string[], uid:string, politica?:string}} situacion
 * @returns {{accion:'crear'|'reingresar'|'reclamar'|'sumarse'|'rechazar', permitido:boolean}}
 */
export function decidirIngreso({ existe, miembros = [], uid, politica = POLITICAS.ABIERTA }) {
  const permitir = accion => ({ accion, permitido: true });

  // Nadie lo ha tomado todavía.
  if (!existe) return permitir('crear');

  // Volver desde el mismo navegador no es entrar de nuevo: es seguir donde iba.
  if (uid && miembros.includes(uid)) return permitir('reingresar');

  // Equipo liberado por el docente: disponible para quien llegue, siempre.
  if (miembros.length === 0) return permitir('reclamar');

  // Segundo dispositivo del mismo equipo, sólo si la partida lo permite.
  if (politica === POLITICAS.ABIERTA) return permitir('sumarse');

  return { accion: 'rechazar', permitido: false };
}

/** El mensaje que ve el estudiante. Se le ofrece la salida que no depende de nadie. */
export const mensajeNombreTomado = nombre =>
  `El nombre "${String(nombre).trim()}" ya está en uso en esta partida. ` +
  'Elige otro, o pídele al docente que libere ese equipo si es el tuyo.';

/** Membresía resultante de una acción permitida. */
export function miembrosTras(accion, miembros = [], uid) {
  switch (accion) {
    case 'crear':
    case 'reclamar': return [uid];
    case 'sumarse': return [...miembros, uid];
    default: return [...miembros];
  }
}
