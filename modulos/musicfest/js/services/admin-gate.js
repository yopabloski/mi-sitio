// MusicFest · puerta de acceso docente.
// En modo demo local se abre sola. Con Firebase exige Google + padrón
// musicfestAdmins/{uid}. Mismo rol que #adminGate en La Odisea, pero la
// autorización vive en Firestore y no en una lista incrustada en el cliente.

import { enabled } from './firebase-config.js';

// Cada panel docente dice qué protege. Los valores por defecto son los del
// panel de control, que fue el primero en usar esta puerta.
const POR_DEFECTO = {
  titulo: 'Control de producción',
  copy: 'Este panel controla la actividad en vivo: reglas, pool, avance de días y validación de entregas. Entra con tu cuenta institucional.'
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const markup = ({ titulo, copy }) => `
<div class="teacher-gate-card">
  <img src="assets/brand/vector/musicfest-logo-d-noche-vector.svg" alt="MusicFest">
  <p class="kicker">ACCESO DOCENTE</p>
  <h2>${esc(titulo)}</h2>
  <p class="teacher-gate-copy">${esc(copy)}</p>
  <button id="teacherGateLogin" type="button">Entrar con Google</button>
  <p id="teacherGateMsg" class="teacher-gate-msg" role="status"></p>
</div>`;

export async function openTeacherGate(textos = {}) {
  if (!enabled) return { uid: 'local', demo: true };

  const { restoreTeacher, signInTeacher } = await import('./firebase.js');
  const gate = document.createElement('section');
  gate.className = 'teacher-gate';
  gate.innerHTML = markup({ ...POR_DEFECTO, ...textos });
  document.body.append(gate);
  document.body.classList.add('gate-open');

  const message = gate.querySelector('#teacherGateMsg');
  const button = gate.querySelector('#teacherGateLogin');

  message.textContent = 'Comprobando sesión docente…';
  const restored = await restoreTeacher().catch(() => null);
  if (restored) { close(gate); return restored; }
  message.textContent = '';

  const user = await new Promise(resolve => {
    button.onclick = async () => {
      button.disabled = true;
      message.textContent = 'Abriendo el inicio de sesión de Google…';
      try {
        resolve(await signInTeacher());
      } catch (error) {
        message.textContent = error.message || 'No fue posible iniciar sesión.';
        message.classList.add('error');
        button.disabled = false;
      }
    };
  });

  close(gate);
  return user;
}

function close(gate) {
  gate.remove();
  document.body.classList.remove('gate-open');
}
