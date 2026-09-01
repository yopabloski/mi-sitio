// MusicFest · vista de impresión de cartas.
//
// Dibuja el pool activo de una actividad como hojas carta a medidas reales de
// funda, para exportarlas a PDF desde el propio navegador (Cmd+P → Guardar como
// PDF). No hay generador de PDF ni dependencia nueva: la geometría está en
// milímetros y el navegador la respeta mientras no se le deje escalar.
//
//   cartas.html?code=DEMO&tamano=euro&reversos=largo
//
// La aritmética de la hoja vive en js/domain/cartas.js, que sí tiene pruebas.
// Acá sólo queda el DOM y la conexión.

import { artists, artwork } from '../data/artists.js';
import { syncedArtwork } from '../data/covers.generated.js';
import { localArtwork } from '../data/covers.local.js';
import { connect, ensureSession, backend } from '../services/store.js';
import { TAMANOS, reparto, enPaginas, espejar, poolDe } from '../domain/cartas.js';

const $ = s => document.querySelector(s);

const COLOR_GENERO = { 'Pop':'#4ca5ff', 'Rock':'#078994', 'Rap':'#f0a51a', 'Trap Latino':'#ff4d22' };

const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const iniciales = n => String(n).split(/\s+/).slice(0, 2).map(x => x[0]).join('').replace('$', 'A').toUpperCase();

// Misma cadena de prioridad que student.js: la copia del repositorio manda.
const caratulaDe = (session, id) =>
  localArtwork[id] || session?.artwork?.[id] || artwork[id] || syncedArtwork[id] || '';

const cartaHTML = (a, session) => `<article class="carta" style="--genero:${COLOR_GENERO[a.genre] || '#999'}">
  <div class="cinta"><span>${esc(a.genre)}</span><span>${esc(a.country)}</span></div>
  <div class="portada">${caratulaDe(session, a.id)
    ? `<img src="${esc(caratulaDe(session, a.id))}" alt="">`
    : `<b>${esc(iniciales(a.name))}</b>`}</div>
  <h2 class="nombre">${esc(a.name)}</h2>
  <div class="datos">
    <span><b>$${esc(a.cost)}</b><small>COSTO</small></span>
    <span><b>★${esc(a.popularity)}</b><small>POPUL.</small></span>
    <span><b>${esc(a.duration)}h</b><small>DURAC.</small></span>
  </div>
</article>`;

const reversoHTML = a => `<article class="carta reverso" style="--genero:${COLOR_GENERO[a.genre] || '#999'}">
  <div class="marca">Music<em>Fest</em></div>
  <div class="barra"></div>
  <div class="pie">${esc(a.genre)}</div>
</article>`;

const HUECO = '<div class="hueco"></div>';

function render(session, pool, clave, modoReverso) {
  const tamano = TAMANOS[clave];
  const { columnas, porPagina, filas } = reparto(tamano);
  const paginas = enPaginas(pool, porPagina);
  const hojas = [];

  paginas.forEach((pagina, i) => {
    const cabecera = `<p class="hoja-titulo"><span>${esc(session.name || 'MusicFest')} · ${esc(session.code)}</span>`
      + `<span>${tamano.etiqueta} · ${tamano.ancho}×${tamano.alto} mm · hoja ${i + 1} de ${paginas.length}</span></p>`;

    hojas.push(`<section class="hoja tam-${clave}" data-cara="frente" style="--cols:${columnas}">${cabecera}`
      + pagina.map(a => (a ? cartaHTML(a, session) : HUECO)).join('') + '</section>');

    if (modoReverso !== 'ninguno') {
      hojas.push(`<section class="hoja tam-${clave}" data-cara="reverso" style="--cols:${columnas}">${cabecera}`
        + espejar(pagina, columnas, modoReverso).map(a => (a ? reversoHTML(a) : HUECO)).join('') + '</section>');
    }
  });

  $('#hojas').innerHTML = hojas.join('');
  return { columnas, filas, paginas: paginas.length, hojas: hojas.length };
}

// ---------------------------------------------------------------------------

const parametros = new URLSearchParams(location.search);
if (parametros.get('code')) $('#codigo').value = parametros.get('code').toUpperCase();
if (TAMANOS[parametros.get('tamano')]) $('#tamano').value = parametros.get('tamano');
if (['ninguno', 'largo', 'corto'].includes(parametros.get('reversos'))) $('#reversos').value = parametros.get('reversos');

let sesionActual = null;

async function cargar() {
  const code = $('#codigo').value.trim().toUpperCase();
  const estado = $('#estado');
  if (!code) { estado.textContent = 'Falta el código de la actividad.'; estado.className = 'estado error'; return; }

  $('#cargar').disabled = true;
  estado.className = 'estado';
  estado.textContent = backend === 'firebase' ? 'Conectando con la actividad…' : 'Leyendo la actividad local…';
  try {
    await connect({ code, role: 'student' });   // sin teamName: no crea equipo en la bandeja
    sesionActual = ensureSession(code);
    dibujar();
  } catch (problema) {
    estado.className = 'estado error';
    estado.textContent = problema.message || 'No fue posible leer la actividad.';
    $('#imprimir').disabled = true;
  } finally {
    $('#cargar').disabled = false;
  }
}

function dibujar() {
  if (!sesionActual) return;
  const pool = poolDe(sesionActual, artists);
  if (!pool.length) {
    $('#estado').className = 'estado error';
    $('#estado').textContent = 'La actividad no tiene artistas en el pool.';
    $('#hojas').innerHTML = '';
    $('#imprimir').disabled = true;
    return;
  }
  const modo = $('#reversos').value;
  const r = render(sesionActual, pool, $('#tamano').value, modo);
  const sinCaratula = pool.filter(a => !caratulaDe(sesionActual, a.id)).length;
  $('#estado').className = 'estado';
  $('#estado').textContent =
    `${pool.length} cartas · ${r.columnas}×${r.filas} por hoja · ${r.paginas} ${r.paginas === 1 ? 'hoja' : 'hojas'} de caras`
    + (modo === 'ninguno' ? '' : `, ${r.hojas} en total con los reversos`)
    + (sinCaratula ? ` · ${sinCaratula} sin carátula, salen con iniciales` : '');
  $('#imprimir').disabled = false;
}

$('#cargar').addEventListener('click', cargar);
$('#codigo').addEventListener('keydown', e => { if (e.key === 'Enter') cargar(); });
$('#tamano').addEventListener('change', dibujar);
$('#reversos').addEventListener('change', dibujar);
// La vista previa de impresión tarda: el navegador decodifica y rasteriza
// todas las portadas de todas las hojas antes de mostrar nada. No se puede
// evitar, pero sí avisar, y ceder un cuadro para que el aviso alcance a
// pintarse antes de que print() bloquee el hilo.
$('#imprimir').addEventListener('click', () => {
  const estado = $('#estado');
  const previo = estado.textContent;
  const hojas = document.querySelectorAll('.hoja').length;
  estado.textContent = `Preparando ${hojas} hojas para imprimir… puede tardar unos segundos.`;
  $('#imprimir').disabled = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { window.print(); } finally {
      estado.textContent = previo;
      $('#imprimir').disabled = false;
    }
  }));
});

if (parametros.get('code')) cargar();
