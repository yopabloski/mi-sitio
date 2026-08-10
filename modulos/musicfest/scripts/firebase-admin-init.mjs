// Inicialización compartida del Admin SDK para los scripts de MusicFest.
// Con USE_FIREBASE_EMULATORS=1 apunta a los emuladores y no toca producción.

// firebase-admin se carga de forma diferida: así `--dry-run` y `--help`
// funcionan sin dependencias instaladas.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const MODULE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/**
 * Localiza la clave de servicio sin depender del directorio de trabajo.
 * Prueba, en orden: la ruta dada tal cual, la misma relativa al módulo, y
 * finalmente cualquier .json dentro de un .secrets/ subiendo directorios.
 */
function findServiceAccount(configured) {
  const candidates = [];
  if (configured) {
    candidates.push(isAbsolute(configured) ? configured : resolve(process.cwd(), configured));
    candidates.push(resolve(MODULE_ROOT, configured));
  }
  let dir = MODULE_ROOT;
  for (let i = 0; i < 5; i++) {
    const secrets = join(dir, '.secrets');
    if (existsSync(secrets)) {
      for (const name of readdirSync(secrets)) {
        if (name.endsWith('.json')) candidates.push(join(secrets, name));
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return candidates.find(existsSync) || null;
}

/** Busca un archivo subiendo directorios desde `from`. */
export function findUpFile(name, from = MODULE_ROOT) {
  let dir = from;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`No se encontró ${name} desde ${from}.`);
}

export function loadEnv(file = '.env') {
  const path = existsSync(file) ? file : join(MODULE_ROOT, file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, '');
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

export async function admin() {
  loadEnv();
  let appMod, firestoreMod, storageMod;
  try {
    [appMod, firestoreMod, storageMod] = await Promise.all([
      import('firebase-admin/app'), import('firebase-admin/firestore'), import('firebase-admin/storage')
    ]);
  } catch {
    console.error('✗ Falta firebase-admin. Ejecuta `npm install` antes de escribir en Firestore.');
    process.exit(1);
  }
  const { initializeApp, cert, applicationDefault, getApps } = appMod;
  const { getFirestore } = firestoreMod;
  const { getStorage } = storageMod;

  const useEmulators = process.env.USE_FIREBASE_EMULATORS === '1';
  const projectId = process.env.FIREBASE_PROJECT_ID || 'streamlab-b9122';
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || null;

  // El Admin SDK obedece FIRESTORE_EMULATOR_HOST y compañía sin preguntar.
  // Si alguien las dejó puestas en su .env, un script "de producción" acabaría
  // escribiendo en un emulador (o colgándose contra uno apagado) sin avisar.
  // Aquí manda una sola variable: USE_FIREBASE_EMULATORS.
  const EMULATOR_VARS = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST'];
  if (useEmulators) {
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
    console.log('▸ Destino: EMULADORES locales');
  } else {
    const colgadas = EMULATOR_VARS.filter(v => process.env[v]);
    for (const v of colgadas) delete process.env[v];
    if (colgadas.length) console.log(`▸ Ignorando ${colgadas.join(', ')} (USE_FIREBASE_EMULATORS no está en 1)`);
    console.log(`▸ Destino: PRODUCCIÓN · proyecto ${projectId}`);
  }

  if (!getApps().length) {
    if (useEmulators) {
      initializeApp({ projectId });
    } else {
      const keyPath = findServiceAccount(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (!keyPath) {
        console.error('✗ No se encontró la clave de servicio de Firebase.\n');
        console.error('  1. Consola Firebase → Configuración del proyecto → Cuentas de servicio');
        console.error('     → Generar nueva clave privada.');
        console.error(`  2. Guarda el archivo .json dentro de una carpeta .secrets/`);
        console.error('     (por ejemplo en la raíz del sitio: mi-sitio/.secrets/).');
        console.error('\n  El script la busca sola: no necesitas configurar rutas.');
        console.error('  Para usar los emuladores en vez de producción: USE_FIREBASE_EMULATORS=1\n');
        process.exit(1);
      }
      let key;
      try {
        key = JSON.parse(readFileSync(keyPath, 'utf8'));
      } catch (error) {
        console.error(`✗ ${keyPath} no es un JSON válido: ${error.message}`);
        process.exit(1);
      }
      if (key.project_id && key.project_id !== projectId) {
        console.error(`✗ La clave es del proyecto "${key.project_id}" y estás apuntando a "${projectId}".`);
        process.exit(1);
      }
      console.log(`Clave de servicio: ${keyPath}`);
      initializeApp({ credential: cert(key), projectId });
    }
  }

  return { db: getFirestore(), storage: getStorage(), projectId, storageBucket, useEmulators };
}

export const PATHS = {
  admins: 'musicfestAdmins',
  codes: 'musicfestCodes',
  activities: 'musicfestActivities'
};

export const normalizeCode = value =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9áéíóúñ-]+/gi, '-').replace(/(^-|-$)/g, '');

export function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const next = process.argv[index + 1];
  return next && !next.startsWith('--') ? next : true;
}
