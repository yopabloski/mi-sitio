#!/usr/bin/env node
// MusicFest · autoriza (o revoca) a un docente en el padrón musicfestAdmins.
//
//   npm run admin:grant -- --uid TVmbMyACnKZ8RxqcnBSncsz3umx2 --email pablogonzalez@udd.cl
//   npm run admin:grant -- --email pablogonzalez@udd.cl          (busca el UID en Auth)
//   npm run admin:grant -- --uid ... --revoke
//   npm run admin:grant -- --list
//
// El padrón vive en Firestore y NO en el cliente: cumple el requisito de
// TECHNICAL_ARCHITECTURE.md de no incrustar una lista de UID en el navegador.


import { admin, PATHS, arg } from './firebase-admin-init.mjs';

const { db } = await admin();
const list = Boolean(arg('list'));
const revoke = Boolean(arg('revoke'));
let uid = arg('uid', process.env.MUSICFEST_ADMIN_UID);
const email = arg('email', process.env.MUSICFEST_ADMIN_EMAIL);

if (list) {
  const snapshot = await db.collection(PATHS.admins).get();
  if (snapshot.empty) console.log('El padrón docente está vacío.');
  else console.table(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
  process.exit(0);
}

if (!uid && email) {
  try {
    const { getAuth } = await import('firebase-admin/auth');
    uid = (await getAuth().getUserByEmail(email)).uid;
    console.log(`UID encontrado para ${email}: ${uid}`);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`✗ No hay ninguna cuenta en Authentication con el correo ${email}.`);
      console.error('  El docente debe iniciar sesión con Google al menos una vez antes de ser autorizado.');
      console.error('  Comprueba también que el proveedor Google esté habilitado en la consola.');
    } else {
      console.error(`✗ No se pudo consultar Authentication: ${error.message}`);
      console.error('  Revisa la conexión y que la clave de servicio sea del proyecto correcto.');
    }
    process.exit(1);
  }
}

if (!uid) {
  console.error('✗ Falta --uid o --email.');
  process.exit(1);
}

const ref = db.collection(PATHS.admins).doc(uid);
if (revoke) {
  await ref.delete();
  console.log(`✓ ${uid} ya no es docente de MusicFest.`);
} else {
  await ref.set({ email: email || null, grantedAt: new Date().toISOString() }, { merge: true });
  console.log(`✓ ${uid}${email ? ` (${email})` : ''} autorizado como docente de MusicFest.`);
}
