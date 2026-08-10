#!/usr/bin/env node
// MusicFest · diagnóstico del proyecto Firebase.
//
//   npm run doctor
//   npm run doctor -- --code TALLER3
//
// Revisa de una vez todo lo que tiene que estar en su sitio antes de una clase,
// y para cada cosa que falte dice exactamente qué hacer. No escribe nada.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { admin, PATHS, normalizeCode, arg, loadEnv } from './firebase-admin-init.mjs';

const MODULE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SITE_ROOT = resolve(MODULE_ROOT, '..', '..');
const code = String(arg('code', 'DEMO')).toUpperCase();

loadEnv();

const resultados = [];
const ok = (que, detalle = '') => resultados.push({ estado: '✓', que, detalle });
const aviso = (que, detalle = '') => resultados.push({ estado: '!', que, detalle });
const falla = (que, detalle = '', arregla = '') => resultados.push({ estado: '✗', que, detalle, arregla });

console.log(`\nDiagnóstico de MusicFest · código ${code}\n${'─'.repeat(60)}`);

const { db, projectId } = await admin();
const app = (await import('firebase-admin/app')).getApps()[0];

/** Token de acceso para las APIs de administración de Google. */
async function accessToken() {
  try {
    const { access_token } = await app.options.credential.getAccessToken();
    return access_token;
  } catch {
    return null;
  }
}

const token = await accessToken();
const api = async url => {
  if (!token) return null;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// 1. Authentication: proveedores y dominios
// ---------------------------------------------------------------------------

const config = await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`);
if (!config) {
  aviso('Configuración de Authentication', 'No se pudo consultar; revísala a mano en la consola.');
} else {
  const emailOn = config.signIn?.email?.enabled;
  const anonOn = config.signIn?.anonymous?.enabled;
  const dominios = config.authorizedDomains || [];

  anonOn
    ? ok('Acceso anónimo (estudiantes)')
    : falla('Acceso anónimo (estudiantes)', 'Deshabilitado',
        'Consola → Authentication → Sign-in method → Anónimo → Habilitar');

  dominios.includes('yopabloski.github.io')
    ? ok('Dominio yopabloski.github.io autorizado')
    : falla('Dominio yopabloski.github.io autorizado', `Sólo: ${dominios.join(', ')}`,
        'Consola → Authentication → Settings → Authorized domains → Add domain');

  dominios.includes('localhost')
    ? ok('localhost autorizado (para probar en tu máquina)')
    : aviso('localhost no autorizado', 'No podrás probar el login docente en local.');

  if (emailOn) ok('Acceso con email/contraseña habilitado', 'Lo usa MovieBlend. MusicFest no lo necesita, pero no estorba.');
}

// El proveedor de Google se consulta aparte.
const providers = await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/defaultSupportedIdpConfigs`);
if (providers) {
  const google = (providers.defaultSupportedIdpConfigs || []).find(p => p.name?.endsWith('google.com'));
  google?.enabled
    ? ok('Acceso con Google (docentes)')
    : falla('Acceso con Google (docentes)', google ? 'Configurado pero deshabilitado' : 'No configurado',
        'Consola → Authentication → Sign-in method → Google → Habilitar');
}

// ---------------------------------------------------------------------------
// 2. Reglas desplegadas vs. archivo local
// ---------------------------------------------------------------------------

const rulesLocal = existsSync(join(SITE_ROOT, 'firestore.rules'))
  ? readFileSync(join(SITE_ROOT, 'firestore.rules'), 'utf8')
  : null;

const release = await api(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`);
if (!release || !rulesLocal) {
  aviso('Reglas de Firestore', 'No se pudieron comparar con las desplegadas.');
} else {
  const ruleset = await api(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  const remoto = ruleset?.source?.files?.[0]?.content;
  const limpia = t => t.replace(/\s+/g, '');
  if (!remoto) {
    aviso('Reglas de Firestore', 'No se pudo leer el contenido desplegado.');
  } else if (limpia(remoto) === limpia(rulesLocal)) {
    ok('Reglas desplegadas', 'Idénticas al archivo local');
  } else {
    const tieneMusicFest = remoto.includes('musicfestActivities');
    const tieneOdisea = remoto.includes('experiences');
    falla('Reglas desplegadas', `Difieren del archivo local (MusicFest: ${tieneMusicFest ? 'sí' : 'NO'}, La Odisea: ${tieneOdisea ? 'sí' : 'NO'})`,
      'cd ../.. && firebase deploy --only firestore:rules');
  }
}

// ---------------------------------------------------------------------------
// 3. Padrón docente y cuentas
// ---------------------------------------------------------------------------

const admins = await db.collection(PATHS.admins).get();
if (admins.empty) {
  falla('Padrón docente', 'Vacío: nadie puede abrir el panel',
    'npm run admin:grant -- --email TU-CORREO');
} else {
  ok(`Padrón docente (${admins.size})`, admins.docs.map(d => d.data().email || d.id).join(', '));
}

try {
  const { getAuth } = await import('firebase-admin/auth');
  // Sólo se cuentan. El proyecto es compartido con MovieBlend y La Odisea, así
  // que la mayoría de estas cuentas son de estudiantes de otros módulos: ni son
  // candidatas a docente ni corresponde listar sus correos en una terminal.
  const usuarios = await getAuth().listUsers(1000);
  const conCorreo = usuarios.users.filter(u => u.email).length;
  const anonimos = usuarios.users.length - conCorreo;
  if (!usuarios.users.length) {
    falla('Cuentas en Authentication', 'Ninguna todavía',
      'Abre el panel docente y pulsa "Entrar con Google" una vez. Fallará: es lo esperado.');
  } else {
    ok(`Cuentas en Authentication (${usuarios.users.length})`,
      `${conCorreo} con correo · ${anonimos} anónimas · incluye MovieBlend y La Odisea`);
  }

  for (const docente of admins.docs) {
    const existe = usuarios.users.some(u => u.uid === docente.id);
    if (!existe) {
      aviso(`Docente ${docente.data().email || docente.id} no aparece en Authentication`,
        'El UID del padrón no corresponde a ninguna cuenta: no podrá entrar.');
    }
  }
} catch (error) {
  aviso('Cuentas en Authentication', `No se pudieron listar: ${error.message}`);
}

// ---------------------------------------------------------------------------
// 4. La actividad
// ---------------------------------------------------------------------------

const codeSnap = await db.collection(PATHS.codes).doc(normalizeCode(code)).get();
if (!codeSnap.exists) {
  falla(`Actividad con código ${code}`, 'No existe', 'npm run import:activity');
} else {
  const activityId = codeSnap.data().activityId;
  const actividad = await db.collection(PATHS.activities).doc(activityId).get();
  if (!actividad.exists) {
    falla(`Actividad ${activityId}`, 'El código apunta a una actividad inexistente', 'npm run import:activity');
  } else {
    const d = actividad.data();
    const artistas = await db.collection(PATHS.activities).doc(activityId).collection('artists').get();
    const activos = artistas.docs.filter(a => a.data().active).length;
    const conCover = artistas.docs.filter(a => a.data().artworkUrl).length;
    const locales = artistas.docs.filter(a => !/^https?:/.test(a.data().artworkUrl || 'http')).length;

    ok(`Actividad ${code}`, `${d.name} · modo ${d.mode} · estado ${d.state} · revisión ${d.revision}`);
    artistas.size
      ? ok(`Catálogo (${artistas.size} artistas)`, `${activos} en juego · ${conCover} con carátula`)
      : falla('Catálogo', 'Sin artistas', 'npm run import:activity');

    const minimoNecesario = Math.max(...(d.days || []).map(x => x.artistCount || 0));
    activos >= minimoNecesario
      ? ok('Pool suficiente para todos los días', `${activos} activos, el día mayor pide ${minimoNecesario}`)
      : falla('Pool insuficiente', `${activos} activos y el día mayor pide ${minimoNecesario}`,
          'Activa más artistas desde el panel docente');

    locales === conCover && conCover > 0
      ? ok('Carátulas servidas desde el repositorio')
      : aviso(`Carátulas en el CDN de Apple (${conCover - locales} de ${conCover})`,
          'Funcionan, pero dependen de un tercero. Arréglalo con: npm run covers:download -- --code ' + code);

    const equipos = await db.collection(PATHS.activities).doc(activityId).collection('teams').get();
    const entregas = await db.collection(PATHS.activities).doc(activityId).collection('submissions').get();
    if (equipos.size || entregas.size) {
      ok(`Datos de clase`, `${equipos.size} equipos · ${entregas.size} entregas`);
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Higiene del repositorio
// ---------------------------------------------------------------------------

const secretos = join(SITE_ROOT, '.secrets');
if (existsSync(secretos)) {
  const gitignore = existsSync(join(SITE_ROOT, '.gitignore'))
    ? readFileSync(join(SITE_ROOT, '.gitignore'), 'utf8')
    : '';
  gitignore.includes('.secrets')
    ? ok('La clave de servicio está fuera de git')
    : falla('La clave de servicio NO está ignorada por git', '', 'Agrega .secrets/ a .gitignore antes de hacer commit');
}

const coversDir = join(MODULE_ROOT, 'assets', 'covers');
if (existsSync(coversDir)) {
  const n = readdirSync(coversDir).filter(f => !f.startsWith('.')).length;
  ok(`Carátulas en el repositorio (${n})`);
}

// ---------------------------------------------------------------------------

console.log('');
for (const r of resultados) {
  const color = r.estado === '✓' ? '\x1b[32m' : r.estado === '!' ? '\x1b[33m' : '\x1b[31m';
  console.log(`${color}${r.estado}\x1b[0m ${r.que}${r.detalle ? `\n   ${r.detalle}` : ''}`);
  if (r.arregla) console.log(`   \x1b[36m→ ${r.arregla}\x1b[0m`);
}

const fallas = resultados.filter(r => r.estado === '✗');
const avisos = resultados.filter(r => r.estado === '!');
console.log(`\n${'─'.repeat(60)}`);
console.log(fallas.length
  ? `${fallas.length} cosa${fallas.length > 1 ? 's' : ''} por resolver, ${avisos.length} aviso${avisos.length === 1 ? '' : 's'}.`
  : `Todo en orden${avisos.length ? `, con ${avisos.length} aviso${avisos.length === 1 ? '' : 's'}` : ''}.`);
console.log('');
process.exit(fallas.length ? 1 : 0);
