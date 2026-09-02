// MusicFest · panel docente de la encuesta de percepción.
//
// Lee musicfestEncuestas y lo muestra. Toda la psicometría vive en
// js/domain/encuesta.scoring.js: aquí no se calcula ninguna media a mano.

import { openTeacherGate } from './services/admin-gate.js';
import * as store from './services/survey-store.js';
import { ESCALAS, DIMENSIONES, ITEM_IDS, TOTAL_ITEMS, VERSION_INSTRUMENTO } from './domain/encuesta.config.js';
import { agregar, porItem, generarCSV, mediana, esPlana, validar } from './domain/encuesta.scoring.js';

/* ── Estado ────────────────────────────────────────────────────────────
   TODOS = lo que hay guardado. DATOS = lo que se está mirando.
   El panel, el CSV y los borrados operan sobre DATOS. */
const $ = s => document.querySelector(s);
let TODOS = [], DATOS = [], ejemploEnMemoria = false;

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1 = n => n == null ? '—' : n.toFixed(1);
const f2 = n => n == null ? '—' : n.toFixed(2);
const signo = n => n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(2);

/* Fecha local en YYYY-MM-DD, comparable como texto con un <input type="date">.
   Local y no UTC a propósito: una respuesta enviada a las 22:00 en Chile debe
   contar como del día en que el alumno la respondió, no del siguiente. */
export function dia(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

const enRango = (registros, desde, hasta) => registros.filter(d => {
  const f = dia(d.enviadoEn);
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
});

/* ════════════════════════════════════════════════════════════════════════
   CARGA Y FILTRO
   ════════════════════════════════════════════════════════════════════════ */

function filtrar() {
  DATOS = enRango(TODOS, $('#desde').value, $('#hasta').value);
  const filtrado = Boolean($('#desde').value || $('#hasta').value);
  $('#filtro').classList.toggle('filtered', filtrado);
  $('#tally-n').textContent = DATOS.length;
  $('#tally-lbl').textContent = filtrado
    ? 'de ' + TODOS.length + ' · filtradas por fecha'
    : 'respuestas guardadas';
  pintar();
}

async function recargar() {
  if (ejemploEnMemoria) { filtrar(); return; }
  try {
    TODOS = store.ordenar(await store.cargar());
  } catch (error) {
    console.error('[MusicFest] no se pudieron leer las encuestas', error);
    $('#resumen').textContent = 'No se pudieron leer las respuestas. Revisa tu conexión o tu autorización docente.';
    TODOS = [];
  }
  filtrar();
}

/**
 * Alimenta el panel desde afuera, sin volver a leer el almacenamiento.
 * Con `enMemoria` los borrados no salen a Firestore: es lo que usan los datos
 * de ejemplo y las pruebas.
 */
export function mostrar(registros, { enMemoria = false } = {}) {
  TODOS = store.ordenar(registros);
  ejemploEnMemoria = enMemoria;
  filtrar();
}

/* ════════════════════════════════════════════════════════════════════════
   RENDER
   ════════════════════════════════════════════════════════════════════════ */

/** Barra bipolar para el UEQ-S: −3…+3 con el cero en el centro. */
function bipolar(v) {
  if (v == null) return '<div class="bipolar"><b>—</b></div>';
  const mitad = Math.min(Math.abs(v) / 3, 1) * 50;
  const clase = v > 0.8 ? 'pos' : v < -0.8 ? 'neg' : '';
  const estilo = v >= 0
    ? `left:50%;width:${mitad.toFixed(1)}%`
    : `right:50%;width:${mitad.toFixed(1)}%`;
  return `<div class="bipolar ${clase}"><i style="${estilo}"></i><b>${signo(v)}</b></div>`;
}

function pintar() {
  const hayAlgo = TODOS.length > 0;
  $('#vacio').hidden = hayAlgo;
  $('#filtro').hidden = !hayAlgo;
  $('#sin-rango').hidden = !(hayAlgo && !DATOS.length);
  $('#panel').hidden = !DATOS.length;
  $('#sin-rango-n').textContent = TODOS.length;
  $('#aviso-ejemplo').hidden = !ejemploEnMemoria;

  $('#estado').textContent = hayAlgo ? DATOS.length + ' respuestas' : 'Sin datos';
  if (!DATOS.length) { $('#resumen').textContent = ''; return; }

  const A = agregar(DATOS);
  const D = A.dimensiones;

  const versiones = [...new Set(DATOS.map(d => d.version).filter(Boolean))];
  $('#resumen').textContent = DATOS.length + ' respuestas · última el ' +
    new Date(Math.max(...DATOS.map(d => +new Date(d.enviadoEn)))).toLocaleString('es-CL') +
    ' · instrumento ' + (versiones.length ? versiones.join(', ') : '—');

  // ── tarjetas ──
  $('#kpis').innerHTML = `
    <div class="kpi"><div class="k">Respuestas</div><div class="v">${A.n}</div><div class="n">${A.completos} completas de ${A.n}</div></div>
    <div class="kpi ${A.ueqGlobal == null ? '' : A.ueqGlobal > 0.8 ? '' : A.ueqGlobal < -0.8 ? 'bad' : 'warn'}">
      <div class="k">UEQ-S global</div><div class="v">${signo(A.ueqGlobal)}</div>
      <div class="n">escala −3 a +3 · valoración ${A.valoracionUEQ || '—'}</div></div>
    <div class="kpi"><div class="k">Motivación intrínseca</div><div class="v">${f1(D.intrinseca.media)}</div><div class="n">escala 1 a 7</div></div>
    <div class="kpi ${D.desmotivacion.media > 3.5 ? 'warn' : ''}"><div class="k">Desmotivación</div><div class="v">${f1(D.desmotivacion.media)}</div><div class="n">escala 1 a 7 · más bajo es mejor</div></div>
    <div class="kpi"><div class="k">Aprendizaje percibido</div><div class="v">${f1(D.aprendizaje.media)}</div><div class="n">escala 1 a 7 · la mitad de H6</div></div>`;

  // ── UEQ-S ──
  const filaUEQ = (dim, nombre) => {
    const d = D[dim];
    return `<tr>
      <td><strong>${esc(nombre)}</strong><div class="hint">${d.k} ítems · n = ${d.n}</div></td>
      <td class="n">${signo(d.media)}</td>
      <td class="n">${f2(d.de)}</td>
      <td>${bipolar(d.media)}
        <div class="escala-bipolar"><span>−3</span><span>0</span><span>+3</span></div></td>
      <td>${d.media == null ? '—' : `<span class="chip ${d.media > 0.8 ? 'ok' : ''}">${d.media > 0.8 ? 'positiva' : d.media < -0.8 ? 'negativa' : 'neutra'}</span>`}</td>
    </tr>`;
  };
  $('#tbl-ueq').innerHTML =
    filaUEQ('pragmatica', DIMENSIONES.pragmatica.nombre) +
    filaUEQ('hedonica', DIMENSIONES.hedonica.nombre) +
    `<tr class="total">
      <td><strong>Global</strong><div class="hint">media de las dos</div></td>
      <td class="n"><span class="big">${signo(A.ueqGlobal)}</span></td>
      <td class="n">—</td>
      <td>${bipolar(A.ueqGlobal)}
        <div class="escala-bipolar"><span>−3</span><span>0</span><span>+3</span></div></td>
      <td>${A.valoracionUEQ ? `<span class="chip ${A.valoracionUEQ === 'positiva' ? 'ok' : ''}">${A.valoracionUEQ}</span>` : '—'}</td>
    </tr>`;

  // ── EMSI ──
  const emsiDims = ['intrinseca', 'identificada', 'externa', 'desmotivacion'];
  $('#tbl-emsi').innerHTML = emsiDims.map(dim => {
    const d = D[dim];
    return `<tr class="${d.alertaFiabilidad ? 'alerta' : ''}">
      <td><strong>${esc(DIMENSIONES[dim].nombre)}</strong><div class="hint">${d.k} ítems · n = ${d.n}</div></td>
      <td class="n"><span class="big">${f2(d.media)}</span></td>
      <td class="n">${f2(d.de)}</td>
      <td><div class="bar"><i style="width:${d.media == null ? 0 : ((d.media - 1) / 6 * 100).toFixed(0)}%"></i></div></td>
      <td class="n">${f2(d.alfa)}${d.alertaFiabilidad ? '<span class="badge-alerta">BAJA</span>' : ''}
        <div class="alfa-ref">validación: ${d.alfaRef == null ? '—' : d.alfaRef.toFixed(2)}</div></td>
    </tr>`;
  }).join('');

  $('#sdi').textContent = A.indiceAutodeterminacion == null ? '—' : signo(A.indiceAutodeterminacion);

  // ── competencia y aprendizaje ──
  $('#tbl-otras').innerHTML = ['competencia', 'aprendizaje'].map(dim => {
    const d = D[dim];
    return `<tr>
      <td><strong>${esc(DIMENSIONES[dim].nombre)}</strong><div class="hint">${esc(ESCALAS[DIMENSIONES[dim].escala].fuente)} · n = ${d.n}</div></td>
      <td class="n">${d.k}</td>
      <td class="n"><span class="big">${f2(d.media)}</span></td>
      <td class="n">${f2(d.de)}</td>
      <td><div class="bar"><i style="width:${d.media == null ? 0 : ((d.media - 1) / 6 * 100).toFixed(0)}%"></i></div></td>
      <td class="n">${f2(d.alfa)}</td>
    </tr>`;
  }).join('');

  // ── ítem por ítem ──
  $('#tbl-items').innerHTML = porItem(DATOS).map(it => {
    const max = Math.max(1, ...it.distribucion);
    const barras = it.distribucion.map(c =>
      `<div class="${c === max && c > 0 ? 'hi' : ''}" style="height:${(c / max * 100).toFixed(0)}%" title="${c}"></div>`).join('');
    return `<tr>
      <td><code>${it.id}</code> ${esc(it.texto)}<div class="hint">${esc(DIMENSIONES[it.dim].nombre)}</div></td>
      <td class="n"><span class="big">${f2(it.media)}</span></td>
      <td class="n">${f2(it.de)}</td>
      <td><div class="dist">${barras}</div></td>
      <td class="n">${it.faltantes ? `<span class="chip">${it.faltantes}</span>` : '<span class="chip ok">0</span>'}</td>
    </tr>`;
  }).join('');

  // ── control de calidad ──
  const durs = DATOS.map(d => d.duracionSeg).filter(v => typeof v === 'number');
  const durMed = durs.length ? mediana(durs) : null;
  $('#dur').textContent = durMed == null ? '—'
    : Math.floor(durMed / 60) + ' min ' + String(Math.round(durMed % 60)).padStart(2, '0') + ' s';
  $('#dur-nota').textContent = durMed == null ? ''
    : durMed > 300 ? 'Se pasa del presupuesto de 4 minutos. Considera recortar ítems antes de la próxima aplicación.'
    : durMed < 90 ? 'Muy rápido para 28 ítems: mira el conteo de respuestas planas de al lado.'
    : 'Dentro de lo presupuestado.';

  $('#planas').textContent = A.planas;
  $('#planas-nota').textContent = A.planas
    ? 'Usaron dos valores distintos o menos en los 28 ítems. Excluirlas es defendible, pero hay que declararlo en el manuscrito.'
    : 'Nadie respondió en línea recta.';

  const abiertas = DATOS.map(d => d.abierta).filter(Boolean);
  $('#abiertas').innerHTML = abiertas.length
    ? abiertas.map(t => `<p>${esc(t)}</p>`).join('')
    : '<p class="hint">Sin respuestas abiertas todavía.</p>';

  // ── registros ──
  $('#tbl-registros').innerHTML = DATOS.map(d => {
    const n = Object.keys(d.respuestas || {}).length;
    const completo = validar(d.respuestas || {}).completo;
    const plana = esPlana(d.respuestas || {});
    const dur = typeof d.duracionSeg === 'number'
      ? Math.floor(d.duracionSeg / 60) + ':' + String(Math.round(d.duracionSeg % 60)).padStart(2, '0')
      : '—';
    const clave = store.claveDe(d);
    return `<tr data-clave="${esc(clave)}">
      <td><strong>${esc(d.email || 'sin correo')}</strong>${plana ? '<span class="badge-alerta">PLANA</span>' : ''}</td>
      <td>${new Date(d.enviadoEn).toLocaleString('es-CL')}</td>
      <td class="n">${dur}</td>
      <td class="n">${completo ? `<span class="chip ok">${n}</span>` : `<span class="chip">${n} / ${TOTAL_ITEMS}</span>`}</td>
      <td class="acciones"><button class="mini" data-borrar="${esc(clave)}">Eliminar</button></td>
    </tr>`;
  }).join('');

  $('#btn-borrar-vista').textContent = 'Eliminar los ' + DATOS.length + ' del rango';
  $('#btn-borrar-todo').hidden = DATOS.length === TODOS.length;

  $('#nota-h6').innerHTML = '<b>H6 · discordancia percepción/medición</b><p>El aprendizaje percibido de arriba es la mitad del contraste. La otra mitad es la ganancia observada en los indicadores A y B de las hojas de trabajo, que se digita aparte. Cruza ambas por correo del alumno con <code>pearson()</code> del módulo de scoring: la predicción es que <em>no</em> correlacionen, y podrían correlacionar negativamente. Usa competencia percibida como covariable.</p>';
}

/* ════════════════════════════════════════════════════════════════════════
   BORRADO — siempre pasa por confirmación explícita
   ════════════════════════════════════════════════════════════════════════ */
let pendiente = null;

function confirmar(titulo, texto, claves) {
  pendiente = claves;
  $('#dlg-titulo').textContent = titulo;
  $('#dlg-texto').textContent = texto;
  $('#dlg').showModal();
}

/* ════════════════════════════════════════════════════════════════════════
   CSV — exporta lo que está a la vista, no todo el almacenamiento
   ════════════════════════════════════════════════════════════════════════ */
function csv() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([generarCSV(DATOS)], { type: 'text/csv;charset=utf-8' }));
  a.download = 'musicfest-encuesta-' + VERSION_INSTRUMENTO + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

/* ════════════════════════════════════════════════════════════════════════
   DATOS DE EJEMPLO
   ────────────────────────────────────────────────────────────────────────
   Con Firebase activo NO se escriben: respuestas falsas en la colección de
   producción serían indistinguibles de las reales para quien mire los datos
   dentro de dos años. Se quedan en memoria y el panel lo dice.
   ════════════════════════════════════════════════════════════════════════ */
const DESMOTIVACION = new Set(['emsi04', 'emsi08', 'emsi12', 'emsi16']);

export function generarEjemplo(ahora = Date.now(), n = 43) {
  const rnd = (min, max) => Math.max(min, Math.min(max, Math.round(min + Math.random() * (max - min))));
  const DIA = 86400000;
  const frases = ['Quedarme sin chilenos el domingo.', 'El tiempo del domingo.',
                  'Decidir rápido en pareja.', 'Nada, estuvo entretenido.'];
  return Array.from({ length: n }, (_, k) => ({
    id: 'demo-' + (k + 1),
    demo: true,
    email: 'alumno' + (k + 1) + '@udd.cl',
    version: VERSION_INSTRUMENTO,
    enviadoEn: new Date(ahora - Math.floor(k / 9) * DIA - k * 60000).toISOString(),
    duracionSeg: rnd(150, 320),
    respuestas: Object.fromEntries(ITEM_IDS.map(id => [
      id,
      // La desmotivación se genera baja a propósito: así el panel de ejemplo
      // se parece a un resultado plausible y no a ruido uniforme.
      DESMOTIVACION.has(id) ? rnd(1, 3) : rnd(4, 7)
    ])),
    abierta: k % 5 === 0 ? frases[k % 4] : null
  }));
}

function ejemplo() {
  TODOS = generarEjemplo();
  if (store.usingFirebase) {
    ejemploEnMemoria = true;           // no tocar la colección de producción
  } else {
    store.local.reemplazar(TODOS);     // modo demo: persiste
  }
  $('#desde').value = ''; $('#hasta').value = '';
  filtrar();
}

/* ════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ════════════════════════════════════════════════════════════════════════ */
export function cablear() {
  $('#btn-csv').addEventListener('click', csv);
  $('#btn-demo').addEventListener('click', ejemplo);
  $('#btn-recargar').addEventListener('click', () => { ejemploEnMemoria = false; recargar(); });
  $('#desde').addEventListener('change', filtrar);
  $('#hasta').addEventListener('change', filtrar);

  document.querySelectorAll('[data-rango]').forEach(b => b.addEventListener('click', () => {
    const hoy = dia(new Date().toISOString());
    if (b.dataset.rango === 'hoy') { $('#desde').value = hoy; $('#hasta').value = hoy; }
    else if (b.dataset.rango === '7') {
      const d = new Date(); d.setDate(d.getDate() - 6);
      $('#desde').value = dia(d.toISOString()); $('#hasta').value = hoy;
    } else { $('#desde').value = ''; $('#hasta').value = ''; }
    filtrar();
  }));

  $('#dlg-cancelar').addEventListener('click', () => {
    document.querySelectorAll('tr.va-borrar').forEach(tr => tr.classList.remove('va-borrar'));
    pendiente = null;
    $('#dlg').close();
  });

  $('#dlg-confirmar').addEventListener('click', async () => {
    const claves = pendiente;
    pendiente = null;
    $('#dlg').close();
    if (!claves) return;
    if (ejemploEnMemoria) {
      const set = new Set(claves);
      TODOS = TODOS.filter(d => !set.has(store.claveDe(d)));
      if (!TODOS.length) ejemploEnMemoria = false;
      filtrar();
      return;
    }
    try { await store.eliminar(claves); }
    catch (error) { console.error('[MusicFest] no se pudo eliminar', error); }
    await recargar();
  });

  $('#tbl-registros').addEventListener('click', e => {
    const clave = e.target.dataset?.borrar;
    if (!clave) return;
    e.target.closest('tr').classList.add('va-borrar');
    const fila = DATOS.find(d => store.claveDe(d) === clave);
    confirmar('Eliminar una respuesta',
      'Se borrará definitivamente la respuesta de ' + (fila?.email || 'este registro') + '.',
      [clave]);
  });

  $('#btn-borrar-vista').addEventListener('click', () => {
    if (!DATOS.length) return;
    confirmar('Eliminar ' + DATOS.length + ' respuestas',
      'Se borrarán todas las respuestas del rango de fechas seleccionado. Las que quedan fuera del rango no se tocan.',
      DATOS.map(store.claveDe));
  });

  $('#btn-borrar-todo').addEventListener('click', () => {
    if (!TODOS.length) return;
    confirmar('Eliminar las ' + TODOS.length + ' respuestas',
      'Se borrará todo lo guardado, incluidas las respuestas fuera del rango que estás mirando.',
      TODOS.map(store.claveDe));
  });
}

export async function iniciar() {
  cablear();
  // En modo demo se abre sola. El texto es propio: esta puerta no protege
  // los controles de la partida, protege datos personales de los alumnos.
  await openTeacherGate({
    titulo: 'Resultados de la encuesta',
    copy: 'Detrás hay respuestas de percepción con el correo de cada alumno. Entra con tu cuenta institucional para verlas.'
  });
  await recargar();
}

if (typeof document !== 'undefined' && document.querySelector('#tbl-registros')) iniciar();
