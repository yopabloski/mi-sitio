// MusicFest · encuesta de percepción (vista del estudiante).
//
// Se aplica DESPUÉS de la experiencia y ANTES del test de salida, para medir
// el afecto en caliente sin que el desempeño en el test contamine las
// respuestas de disfrute y aprendizaje percibido.

import { guardar } from './services/survey-store.js';

/* ════════════════════════════════════════════════════════════════════════
   1 · DEFINICIÓN DE INSTRUMENTOS
   ────────────────────────────────────────────────────────────────────────
   Reemplaza cada `t:` por la redacción validada en español. Los corchetes
   indican el constructo que corresponde a ese ítem, para que sepas cuál
   pegar en cada posición. NO cambies los `id`: el panel los usa para leer.

   `inv:true` marca un ítem de puntuación invertida (solo lo necesitarás si
   usas la versión clásica del SUS en vez de la versión positiva).
   ════════════════════════════════════════════════════════════════════════ */

export const INSTRUMENTOS = [
  {
    id: "sus",
    nombre: "La plataforma",
    fuente: "SUS · versión española positiva",
    escala: 5,
    anclas: ["Muy en desacuerdo", "Muy de acuerdo"],
    items: [
      { id:"sus01", t:"[SUS 1 — uso frecuente: «Creo que usaría este sistema frecuentemente»]" },
      { id:"sus02", t:"[SUS 2 — simplicidad, versión positiva]" },
      { id:"sus03", t:"[SUS 3 — facilidad de uso]" },
      { id:"sus04", t:"[SUS 4 — autonomía respecto de apoyo técnico]" },
      { id:"sus05", t:"[SUS 5 — integración de las funciones]" },
      { id:"sus06", t:"[SUS 6 — consistencia, versión positiva]" },
      { id:"sus07", t:"[SUS 7 — rapidez de aprendizaje por parte de otros]" },
      { id:"sus08", t:"[SUS 8 — comodidad de uso, versión positiva]" },
      { id:"sus09", t:"[SUS 9 — confianza al usarlo]" },
      { id:"sus10", t:"[SUS 10 — poco aprendizaje previo necesario, versión positiva]" }
    ]
  },
  {
    id: "gamex",
    nombre: "La experiencia de juego",
    fuente: "GAMEX · subescalas seleccionadas",
    escala: 5,
    anclas: ["Nada", "Mucho"],
    items: [
      { id:"gx_dis1", t:"[GAMEX · Disfrute 1]", sub:"disfrute" },
      { id:"gx_dis2", t:"[GAMEX · Disfrute 2]", sub:"disfrute" },
      { id:"gx_dis3", t:"[GAMEX · Disfrute 3]", sub:"disfrute" },
      { id:"gx_abs1", t:"[GAMEX · Absorción 1]", sub:"absorcion" },
      { id:"gx_abs2", t:"[GAMEX · Absorción 2]", sub:"absorcion" },
      { id:"gx_abs3", t:"[GAMEX · Absorción 3]", sub:"absorcion" }
      /* Opcional: agrega la subescala de Activación si el tiempo lo permite.
         Cada ítem extra suma ~8 s al total. */
    ]
  },
  {
    id: "imi",
    nombre: "Motivación y valor",
    fuente: "IMI · tres subescalas · teoría de la autodeterminación",
    escala: 7,
    anclas: ["Nada cierto", "Muy cierto"],
    items: [
      { id:"imi_int1", t:"[IMI · Interés/disfrute 1]", sub:"interes" },
      { id:"imi_int2", t:"[IMI · Interés/disfrute 2]", sub:"interes" },
      { id:"imi_int3", t:"[IMI · Interés/disfrute 3]", sub:"interes" },
      { id:"imi_com1", t:"[IMI · Competencia percibida 1]", sub:"competencia" },
      { id:"imi_com2", t:"[IMI · Competencia percibida 2]", sub:"competencia" },
      { id:"imi_com3", t:"[IMI · Competencia percibida 3]", sub:"competencia" },
      { id:"imi_val1", t:"[IMI · Valor/utilidad 1]", sub:"valor" },
      { id:"imi_val2", t:"[IMI · Valor/utilidad 2]", sub:"valor" },
      { id:"imi_val3", t:"[IMI · Valor/utilidad 3]", sub:"valor" }
    ]
  },
  {
    id: "apre",
    nombre: "Lo que sientes que aprendiste",
    fuente: "Aprendizaje percibido · sostiene H6",
    escala: 5,
    anclas: ["Muy en desacuerdo", "Muy de acuerdo"],
    items: [
      { id:"apre01", t:"Siento que aprendí bastante sobre cómo modelar problemas de optimización" },
      { id:"apre02", t:"Ahora entiendo mejor este tipo de problemas que antes de empezar la clase" }
    ]
  }
];

/* ⚠️ REGLA DE DISEÑO — no la rompas al editar:
   Ningún ítem de esta encuesta puede nombrar el mecanismo (que las decisiones
   de un día reducen las opciones de los siguientes). La encuesta se aplica
   ANTES del test de salida; un ítem que nombre el acoplamiento dejaría de ser
   medición y pasaría a ser una pista entregada un minuto antes de evaluar
   exactamente eso. El chequeo de manipulación va en la papeleta de papel que
   se entrega al final.                                                      */

export const TOTAL = INSTRUMENTOS.reduce((n, b) => n + b.items.length, 0);

/* ════════════════════════════════════════════════════════════════════════
   2 · RENDER Y LÓGICA
   ════════════════════════════════════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const respuestas = {};
let sesion = null;

export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function marcado(bloques = INSTRUMENTOS) {
  let n = 0;
  return bloques.map(b => {
    const items = b.items.map(it => {
      n++;
      const opts = Array.from({ length: b.escala }, (_, i) => {
        const v = i + 1;
        return `<label class="opt">
          <input type="radio" name="${it.id}" value="${v}" aria-label="${v} de ${b.escala}">
          <span>${v}</span>
        </label>`;
      }).join("");
      return `<div class="item" data-item="${it.id}">
        <p class="q"><span class="num">${String(n).padStart(2, "0")}</span>${esc(it.t)}</p>
        <div class="opts" role="radiogroup" aria-label="${esc(it.t)}">${opts}</div>
        <div class="anchors"><span>${esc(b.anclas[0])}</span><span>${esc(b.anclas[1])}</span></div>
      </div>`;
    }).join("");
    return `<section class="block">
      <div class="block-band">
        <p class="kicker">${b.items.length} ÍTEMS</p>
        <h2>${esc(b.nombre)}</h2>
        <p class="src">${esc(b.fuente)} · escala de 1 a ${b.escala}</p>
      </div>
      ${items}
    </section>`;
  }).join("");
}

function actualizar() {
  const hechos = Object.keys(respuestas).length;
  $("#bar").style.width = (hechos / TOTAL * 100) + "%";
  $("#contador").textContent = hechos + " / " + TOTAL;
  $("#contador2").innerHTML = hechos + ' <small>DE ' + TOTAL + '</small>';
}

const faltantes = () =>
  INSTRUMENTOS.flatMap(b => b.items).filter(it => !respuestas[it.id]).map(it => it.id);

export function iniciar() {
  $("#bloques").innerHTML = marcado();
  $("#total-items").textContent = TOTAL;

  $("#bloques").addEventListener("change", e => {
    if (e.target.type !== "radio") return;
    respuestas[e.target.name] = Number(e.target.value);
    e.target.closest(".item").classList.remove("missing");
    actualizar();
  });

  $("#btn-empezar").addEventListener("click", () => {
    const email = $("#email").value.trim().toLowerCase();
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    $("#err-email").classList.toggle("on", !okMail);
    if (!okMail) return;

    sesion = { email, iniciadoEn: new Date().toISOString() };
    $("#who").textContent = email;
    $("#pantalla-id").hidden = true;
    $("#pantalla-encuesta").hidden = false;
    actualizar();
    window.scrollTo({ top: 0 });
  });

  $("#btn-enviar").addEventListener("click", async () => {
    const falta = faltantes();
    document.querySelectorAll(".item").forEach(el => el.classList.remove("missing"));
    if (falta.length) {
      falta.forEach(id => document.querySelector(`[data-item="${id}"]`)?.classList.add("missing"));
      $("#err-faltan").textContent = "Faltan " + falta.length + " respuestas. Están marcadas más arriba.";
      $("#err-faltan").classList.add("on");
      document.querySelector(`[data-item="${falta[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    $("#err-faltan").classList.remove("on");
    const btn = $("#btn-enviar");
    btn.disabled = true;
    btn.textContent = "Enviando…";

    try {
      await guardar({
        ...sesion,
        enviadoEn: new Date().toISOString(),
        duracionSeg: Math.round((Date.now() - new Date(sesion.iniciadoEn)) / 1000),
        respuestas: { ...respuestas },
        abierta: $("#abierta").value.trim() || null
      });
      $("#pantalla-encuesta").hidden = true;
      $("#pantalla-fin").hidden = false;
      $("#bar").style.width = "100%";
      window.scrollTo({ top: 0 });
    } catch (error) {
      console.error('[MusicFest] no se pudo guardar la encuesta', error);
      btn.disabled = false;
      btn.innerHTML = 'Enviar respuestas <span aria-hidden="true">↗</span>';
      $("#err-faltan").textContent = "No se pudo guardar. Revisa tu conexión e inténtalo otra vez.";
      $("#err-faltan").classList.add("on");
    }
  });
}

if (typeof document !== 'undefined' && document.querySelector('#bloques')) iniciar();
