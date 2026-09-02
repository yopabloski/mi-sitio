// MusicFest · persistencia de la encuesta de percepción.
//
// Mismo patrón que store.js: una sola API, dos implementaciones. Sin
// configuración de Firebase cae a localStorage y la encuesta funciona sola;
// con configuración escribe en Firestore.
//
// Contrato de la colección musicfestEncuestas (ver firestore.rules):
//   · el alumno CREA la suya con sesión anónima y no puede leer ninguna;
//   · el docente del padrón lee, lista y elimina;
//   · nadie edita una respuesta ya enviada.
//
// Se guardan todos los envíos, incluidos los repetidos: quien responde dos
// veces deja dos documentos. Depurar duplicados es decisión de análisis, no
// de la aplicación.

import { enabled, paths } from './firebase-config.js';

export const usingFirebase = enabled;
export const backend = enabled ? 'firebase' : 'local';

const CLAVE = 'musicfest_encuestas';

/** Clave de borrado. Los envíos nuevos traen `id`; para los guardados antes de
 *  que existiera, correo + instante de envío identifica igual de bien. */
export const claveDe = d => d.id || (d.email + '|' + d.enviadoEn);

// ---------------------------------------------------------------------------
// Implementación local (modo demo y respaldo de los datos de ejemplo)
// ---------------------------------------------------------------------------

export const local = {
  cargar() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; }
  },
  guardar(doc) {
    const prev = local.cargar();
    prev.push(doc);
    localStorage.setItem(CLAVE, JSON.stringify(prev));
  },
  reemplazar(registros) {
    localStorage.setItem(CLAVE, JSON.stringify(registros));
  },
  eliminar(claves) {
    const set = new Set(claves);
    local.reemplazar(local.cargar().filter(d => !set.has(claveDe(d))));
  }
};

const nuevoId = () => {
  try { return crypto.randomUUID(); } catch { return String(Date.now()) + Math.random().toString(16).slice(2); }
};

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Guarda una respuesta. El alumno entra con sesión anónima, igual que al jugar. */
export async function guardar(doc) {
  if (!enabled) { local.guardar({ id: nuevoId(), ...doc }); return; }

  const { sdk, signInStudent } = await import('./firebase.js');
  const user = await signInStudent();
  const { db, fsMod } = await sdk();
  await fsMod.addDoc(fsMod.collection(db, paths.encuestas), {
    ...doc,
    uid: user.uid,                       // exigido por las reglas
    creadoEn: fsMod.serverTimestamp()    // hora del servidor, no la del alumno
  });
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

const ordenar = registros =>
  [...registros].sort((a, b) => new Date(b.enviadoEn) - new Date(a.enviadoEn));

export { ordenar };
