// MusicFest · persistencia de la encuesta de percepción.
//
// Mismo patrón que store.js: una sola API, dos implementaciones. Sin
// configuración de Firebase cae a localStorage y la encuesta funciona sola;
// con configuración escribe en Firestore.
//
// FORMA DEL DOCUMENTO (ver firestore.rules)
//   { email, version, uid, iniciadoEn, enviadoEn, duracionSeg, respuestas, abierta }
// No se guardan subtotales ni medias: se derivan al leer con puntuar(). Así una
// corrección de fórmula no obliga a migrar documentos.
//
// UN ENVÍO POR ALUMNO Y COHORTE
// El id del documento se deriva de version + correo, así que reenviar
// sobrescribe en vez de duplicar. La versión entra en el id a propósito: un
// alumno que repita el curso el semestre siguiente deja un documento nuevo en
// lugar de pisar el de la cohorte anterior.
//
// Consecuencia conocida: el id es adivinable. Las reglas cierran el hueco
// exigiendo que solo el uid que creó el documento pueda actualizarlo.

import { enabled, paths } from './firebase-config.js';
import { VERSION_INSTRUMENTO } from '../domain/encuesta.config.js';

export const usingFirebase = enabled;
export const backend = enabled ? 'firebase' : 'local';

const CLAVE = 'musicfest_encuestas';

/** El correo es la llave de enlace con las hojas de papel: minúsculas y sin espacios. */
export const normalizarCorreo = valor => String(valor || '').trim().toLowerCase();

/**
 * Id de documento. Firestore prohíbe "/" y reserva los id con forma __x__;
 * ninguno de los dos casos se puede dar aquí porque el id empieza por la
 * versión, pero el correo se limpia igual por si trae algo raro.
 */
export function idDocumento(email, version = VERSION_INSTRUMENTO) {
  const limpio = normalizarCorreo(email).replace(/[^a-z0-9@._-]+/g, '-');
  return `${version}__${limpio}`;
}

export const claveDe = d => d.id || idDocumento(d.email, d.version);

// ---------------------------------------------------------------------------
// Implementación local (modo demo y datos de ejemplo)
// ---------------------------------------------------------------------------

export const local = {
  cargar() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; }
  },
  guardar(doc) {
    const id = claveDe(doc);
    const otros = local.cargar().filter(d => claveDe(d) !== id);
    otros.push({ ...doc, id });
    local.reemplazar(otros);
  },
  reemplazar(registros) {
    localStorage.setItem(CLAVE, JSON.stringify(registros));
  },
  eliminar(claves) {
    const set = new Set(claves);
    local.reemplazar(local.cargar().filter(d => !set.has(claveDe(d))));
  }
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Guarda o reemplaza la respuesta. El alumno entra con sesión anónima. */
export async function guardar(doc) {
  const email = normalizarCorreo(doc.email);
  const version = doc.version || VERSION_INSTRUMENTO;
  const id = idDocumento(email, version);

  if (!enabled) { local.guardar({ ...doc, email, version, id }); return { id }; }

  const { sdk, signInStudent } = await import('./firebase.js');
  const user = await signInStudent();
  const { db, fsMod } = await sdk();
  await fsMod.setDoc(fsMod.doc(db, paths.encuestas, id), {
    ...doc,
    email,
    version,
    uid: user.uid,                       // exigido por las reglas
    creadoEn: fsMod.serverTimestamp()    // hora del servidor, no la del alumno
  });
  return { id };
}

/** Lee todas las respuestas, de la más reciente a la más antigua. */
export async function cargar() {
  if (!enabled) return ordenar(local.cargar());

  const { sdk } = await import('./firebase.js');
  const { db, fsMod } = await sdk();
  const snap = await fsMod.getDocs(
    fsMod.query(fsMod.collection(db, paths.encuestas), fsMod.orderBy('enviadoEn', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Borra definitivamente. Firestore no acepta más de 500 escrituras por lote. */
export async function eliminar(claves) {
  const lista = [...claves];
  if (!lista.length) return;
  if (!enabled) { local.eliminar(lista); return; }

  const { sdk } = await import('./firebase.js');
  const { db, fsMod } = await sdk();
  for (let i = 0; i < lista.length; i += 450) {
    const lote = fsMod.writeBatch(db);
    for (const clave of lista.slice(i, i + 450)) {
      lote.delete(fsMod.doc(db, paths.encuestas, clave));
    }
    await lote.commit();
  }
}

export const ordenar = registros =>
  [...registros].sort((a, b) => new Date(b.enviadoEn) - new Date(a.enviadoEn));
