// Rutas resueltas contra el módulo, no contra el directorio de trabajo.
// Así `npm test` funciona igual desde modulos/musicfest o desde la raíz del sitio.

import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export const MODULE_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** Sube directorios hasta encontrar el archivo. Las reglas viven en la raíz del sitio. */
export function findUp(name, from = MODULE_ROOT) {
  let current = from;
  for (let i = 0; i < 6; i++) {
    const candidate = join(current, name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`No se encontró ${name} desde ${from}.`);
}

export const RULES_FILE = () => findUp('firestore.rules');
export const STORAGE_RULES_FILE = () => findUp('storage.rules');

/** La exportación de referencia del prototipo, dentro del módulo. */
export function activityExport() {
  const file = readdirSync(MODULE_ROOT).find(name => /^musicfest-.*\.json$/.test(name));
  if (!file) throw new Error(`No hay ninguna exportación musicfest-*.json en ${MODULE_ROOT}.`);
  return join(MODULE_ROOT, file);
}
