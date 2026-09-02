// MusicFest · encuesta de percepción (vista del estudiante).
//
// Se aplica DESPUÉS de la experiencia y ANTES de la hoja de salida, para medir
// el afecto en caliente sin que el desempeño en el test contamine las
// respuestas de motivación y aprendizaje percibido.
//
// Los ítems y las fórmulas NO viven aquí. Esta vista solo renderiza lo que
// declara js/domain/encuesta.config.js y valida con encuesta.scoring.js.

import { bloques, TOTAL_ITEMS, VERSION_INSTRUMENTO } from './domain/encuesta.config.js';
import { validar } from './domain/encuesta.scoring.js';
import { guardar, normalizarCorreo } from './services/survey-store.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const respuestas = {};
let sesion = null;

/* ════════════════════════════════════════════════════════════════════════
   RENDER
   ────────────────────────────────────────────────────────────────────────
   Dos formas de ítem:

   · diferencial semántico (UEQ-S) — par de adjetivos opuestos con siete
     casillas entre medio. El polo negativo va SIEMPRE a la izquierda, así que
     no hay nada que recodificar. En móvil los polos se apilan sobre y bajo la
     escala, porque a 375 px no caben a los costados sin partir palabras.

   · Likert de 7 (EMSI, competencia, aprendizaje) — con las anclas verbales de
     cada escala. Son tres, no dos: extremo izquierdo, punto medio y extremo
     derecho. El punto medio importa: sin él, «corresponde moderadamente» se
     pierde y el alumno interpreta la escala como quiere.
   ════════════════════════════════════════════════════════════════════════ */

function celdas(item, min, max) {
  return Array.from({ length: max - min + 1 }, (_, i) => {
    const v = min + i;
    return `<label class="opt">
      <input type="radio" name="${item.id}" value="${v}" aria-label="${v} de ${max}">
      <span>${v}</span>
    </label>`;
  }).join('');
}

function marcaDiferencial(item, bloque, n) {
  return `<div class="item item-dif" data-item="${item.id}">
    <p class="q q-dif"><span class="num">${String(n).padStart(2, '0')}</span></p>
    <div class="dif">
      <span class="polo polo-izq">${esc(item.izq)}</span>
      <div class="opts" role="radiogroup" aria-label="${esc(item.izq)} frente a ${esc(item.der)}">
        ${celdas(item, bloque.min, bloque.max)}
      </div>
      <span class="polo polo-der">${esc(item.der)}</span>
    </div>
  </div>`;
}

function marcaLikert(item, bloque, n) {
  const anclas = bloque.anclas || [];
  return `<div class="item" data-item="${item.id}">
    <p class="q"><span class="num">${String(n).padStart(2, '0')}</span>${esc(item.t)}</p>
    <div class="opts" role="radiogroup" aria-label="${esc(item.t)}">
      ${celdas(item, bloque.min, bloque.max)}
    </div>
    <div class="anchors anchors-3">
      ${anclas.map(a => `<span>${esc(a)}</span>`).join('')}
    </div>
  </div>`;
}

export function marcado(lista = bloques()) {
  let n = 0;
  return lista.map(b => {
    const items = b.items.map(it => {
      n++;
      return b.tipo === 'diferencial' ? marcaDiferencial(it, b, n) : marcaLikert(it, b, n);
    }).join('');

    const intro = b.intro ? `<p class="block-intro">${esc(b.intro)}</p>` : '';
    const stem  = b.stem  ? `<p class="stem">${esc(b.stem)}</p>` : '';

    return `<section class="block ${b.tipo === 'diferencial' ? 'block-dif' : ''}">
      <div class="block-band">
        <p class="kicker">${b.items.length} ÍTEMS</p>
        <h2>${esc(b.nombre)}</h2>
        <p class="src">${esc(b.fuente)} · escala de ${b.min} a ${b.max}</p>
      </div>
      ${intro || stem ? `<div class="block-lead">${stem}${intro}</div>` : ''}
      ${items}
    </section>`;
  }).join('');
}

/* ════════════════════════════════════════════════════════════════════════
   LÓGICA
   ════════════════════════════════════════════════════════════════════════ */

function actualizar() {
  const hechos = Object.keys(respuestas).length;
  $('#bar').style.width = (hechos / TOTAL_ITEMS * 100) + '%';
  $('#contador').textContent = hechos + ' / ' + TOTAL_ITEMS;
  $('#contador2').innerHTML = hechos + ' <small>DE ' + TOTAL_ITEMS + '</small>';
}

function marcarFaltantes(ids) {
  document.querySelectorAll('.item').forEach(el => el.classList.remove('missing'));
  ids.forEach(id => document.querySelector(`[data-item="${id}"]`)?.classList.add('missing'));
  document.querySelector(`[data-item="${ids[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function iniciar() {
  $('#bloques').innerHTML = marcado();
  $('#total-items').textContent = TOTAL_ITEMS;
  $('#version').textContent = VERSION_INSTRUMENTO;

  $('#bloques').addEventListener('change', e => {
    if (e.target.type !== 'radio') return;
    respuestas[e.target.name] = Number(e.target.value);
    e.target.closest('.item').classList.remove('missing');
    actualizar();
  });

  $('#btn-empezar').addEventListener('click', () => {
    const email = normalizarCorreo($('#email').value);
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    $('#err-email').classList.toggle('on', !ok);
    if (!ok) return;

    sesion = { email, version: VERSION_INSTRUMENTO, iniciadoEn: new Date().toISOString() };
    $('#who').textContent = email;
    $('#pantalla-id').hidden = true;
    $('#pantalla-encuesta').hidden = false;
    actualizar();
    window.scrollTo({ top: 0 });
  });

  $('#btn-enviar').addEventListener('click', async () => {
    const { completo, faltantes, invalidos } = validar(respuestas);
    if (!completo) {
      const pendientes = [...faltantes, ...invalidos];
      marcarFaltantes(pendientes);
      $('#err-faltan').textContent = 'Faltan ' + pendientes.length + ' respuestas. Están marcadas más arriba.';
      $('#err-faltan').classList.add('on');
      return;
    }
    $('#err-faltan').classList.remove('on');
    const btn = $('#btn-enviar');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    try {
      await guardar({
        ...sesion,
        enviadoEn: new Date().toISOString(),
        duracionSeg: Math.round((Date.now() - new Date(sesion.iniciadoEn)) / 1000),
        respuestas: { ...respuestas },
        abierta: $('#abierta').value.trim() || null
      });
      $('#pantalla-encuesta').hidden = true;
      $('#pantalla-fin').hidden = false;
      $('#bar').style.width = '100%';
      window.scrollTo({ top: 0 });
    } catch (error) {
      console.error('[MusicFest] no se pudo guardar la encuesta', error);
      btn.disabled = false;
      btn.innerHTML = 'Enviar respuestas <span aria-hidden="true">↗</span>';
      // Si ya respondió desde otro navegador, las reglas rechazan la
      // actualización porque el uid anónimo es distinto. Decirlo tal cual.
      $('#err-faltan').textContent = String(error?.code || '').includes('permission-denied')
        ? 'Este correo ya envió la encuesta desde otro dispositivo. Avísale al profesor.'
        : 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.';
      $('#err-faltan').classList.add('on');
    }
  });
}

if (typeof document !== 'undefined' && document.querySelector('#bloques')) iniciar();
