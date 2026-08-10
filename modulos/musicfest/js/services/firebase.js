// MusicFest · inicialización del SDK, sesión y autenticación.
// Carga diferida desde el CDN (sin bundler), igual que La Odisea.

// Nota: este módulo NO carga Cloud Storage. Desde el 3 de febrero de 2026
// Storage exige plan Blaze y el proyecto está en Spark; las carátulas se sirven
// como archivos estáticos del sitio. Ver docs/CARATULAS.md.
import { firebaseConfig, enabled, useEmulators, emulatorPorts, paths, SDK } from './firebase-config.js';

let ready = null;

export function sdk() {
  if (!enabled) return Promise.reject(new Error('Firebase no está configurado; el módulo corre en modo demo.'));
  if (ready) return ready;
  ready = (async () => {
    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`)
    ]);

    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);

    // Caché local persistente con soporte multipestaña: el borrador sigue
    // editable sin conexión y se reconcilia al reconectar.
    let db;
    try {
      db = fsMod.initializeFirestore(app, {
        localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() })
      });
    } catch {
      db = fsMod.getFirestore(app);
    }

    if (useEmulators) {
      authMod.connectAuthEmulator(auth, `http://127.0.0.1:${emulatorPorts.auth}`, { disableWarnings: true });
      fsMod.connectFirestoreEmulator(db, '127.0.0.1', emulatorPorts.firestore);
      console.info('[MusicFest] Emuladores locales conectados.');
    }

    return { app, auth, db, authMod, fsMod };
  })();
  return ready;
}

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

/** Estudiante: sesión anónima automática, silenciosa. */
export async function signInStudent() {
  const { auth, authMod } = await sdk();
  if (auth.currentUser) return auth.currentUser;
  const restored = await currentUser();
  if (restored) return restored;
  const credential = await authMod.signInAnonymously(auth);
  return credential.user;
}

/** Docente: popup de Google. La autorización real la da musicfestAdmins/{uid}. */
export async function signInTeacher() {
  const { auth, authMod } = await sdk();
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await authMod.signInWithPopup(auth, provider);
  if (!(await isTeacher(credential.user.uid))) {
    const email = credential.user.email || 'esta cuenta';
    await authMod.signOut(auth);
    throw new Error(`${email} todavía no está autorizada como docente de MusicFest. Pide que agreguen tu UID al padrón.`);
  }
  return credential.user;
}

export async function signOutTeacher() {
  const { auth, authMod } = await sdk();
  await authMod.signOut(auth);
}

/** Resuelve el usuario actual esperando la primera emisión de onAuthStateChanged. */
export function currentUser() {
  return sdk().then(({ auth, authMod }) => new Promise(resolve => {
    const stop = authMod.onAuthStateChanged(auth, user => { stop(); resolve(user || null); });
  }));
}

/** Docente restaurado desde una sesión previa, o null. */
export async function restoreTeacher() {
  const user = await currentUser();
  if (!user || user.isAnonymous) return null;
  return (await isTeacher(user.uid)) ? user : null;
}

const teacherCache = new Map();

export async function isTeacher(uid) {
  if (!uid) return false;
  if (teacherCache.has(uid)) return teacherCache.get(uid);
  const { db, fsMod } = await sdk();
  try {
    const snapshot = await fsMod.getDoc(fsMod.doc(db, paths.admins, uid));
    teacherCache.set(uid, snapshot.exists());
    return snapshot.exists();
  } catch {
    teacherCache.set(uid, false);
    return false;
  }
}

export { enabled, paths };
