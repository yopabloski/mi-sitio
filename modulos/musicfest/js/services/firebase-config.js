// MusicFest · configuración Firebase del cliente.
// Mismo patrón que La Odisea: si falta apiKey o projectId, el módulo funciona
// en modo demo local con localStorage y no carga el SDK.
//
// Estos valores NO son secretos: viajan al navegador por diseño. La protección
// real está en firestore.rules, los dominios autorizados de
// Authentication y, opcionalmente, App Check.

export const firebaseConfig = {
  apiKey: 'AIzaSyDlv_qH1Kx6-yjHI723_PAnpfo0Hq8SoXo',
  authDomain: 'streamlab-b9122.firebaseapp.com',
  projectId: 'streamlab-b9122',
  messagingSenderId: '789036572548',
  appId: '1:789036572548:web:5848484e9374a06ebd47d1'
};

// Permite sobreescribir la configuración sin tocar el repositorio, por ejemplo
// desde un <script> previo en un despliegue distinto:
//   <script>window.__MUSICFEST_FIREBASE__ = { projectId: 'otro-proyecto', ... }</script>
if (typeof window !== 'undefined' && window.__MUSICFEST_FIREBASE__) {
  Object.assign(firebaseConfig, window.__MUSICFEST_FIREBASE__);
}

// Versión del SDK servida desde el CDN de Google. Sin bundler, sin build.
export const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

// Modo demo: sin configuración válida, todo cae a local-store.js.
export const enabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Emuladores: se activan explícitamente para no tocar producción por accidente.
//   http://localhost:5000/modulos/musicfest/admin.html?emu=1
export const useEmulators = (() => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('emu') === '1') { try { localStorage.setItem('musicfest:emulators', '1'); } catch {} return true; }
  if (params.get('emu') === '0') { try { localStorage.removeItem('musicfest:emulators'); } catch {} return false; }
  try { return localStorage.getItem('musicfest:emulators') === '1'; } catch { return false; }
})();

export const emulatorPorts = { auth: 9099, firestore: 8080 };

// Rutas de colecciones. Prefijo obligatorio: el proyecto Streamlab ya usa
// `activities/` para MovieBlend y `experiences/` para La Odisea.
export const paths = {
  admins: 'musicfestAdmins',
  codes: 'musicfestCodes',
  activities: 'musicfestActivities',
  // Encuesta de percepción: colección propia, no colgada de una partida.
  // La encuesta se aplica aunque no haya actividad abierta, y el cruce con
  // las hojas de trabajo es por correo del alumno.
  encuestas: 'musicfestEncuestas'
};

// Normalización de códigos de partida, igual que en La Odisea.
export const normalizeCode = value =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9áéíóúñ-]+/gi, '-').replace(/(^-|-$)/g, '');

// Identificador estable de equipo a partir de su nombre.
export const normalizeTeamId = value => {
  const slug = String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || 'equipo';
};
