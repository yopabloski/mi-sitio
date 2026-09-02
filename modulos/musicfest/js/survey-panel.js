// MusicFest · panel docente de la encuesta de percepción.
//
// Lee musicfestEncuestas, agrega por constructo y deja borrar respuestas.
// La estadística vive en js/domain/survey-stats.js y se prueba aparte.

import { openTeacherGate } from './services/admin-gate.js';
import * as store from './services/survey-store.js';
import {
  media, de, mediana, fiabilidad, puntajeSUS, lecturaSUS,
  dia, enRango, lecturaDuracion, formatoDuracion
} from './domain/survey-stats.js';

/* ════════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN — debe reflejar la de js/survey.js
   ════════════════════════════════════════════════════════════════════════ */
export const ESCALAS = [
  { id:"sus",  nombre:"SUS · usabilidad de la plataforma", escala:5, items:["sus01","sus02","sus03","sus04","sus05","sus06","sus07","sus08","sus09","sus10"], sus:true },
  { id:"gx_disfrute",  nombre:"GAMEX · disfrute",  escala:5, items:["gx_dis1","gx_dis2","gx_dis3"] },
  { id:"gx_absorcion", nombre:"GAMEX · absorción", escala:5, items:["gx_abs1","gx_abs2","gx_abs3"] },
  { id:"imi_interes",     nombre:"IMI · interés y disfrute",    escala:7, items:["imi_int1","imi_int2","imi_int3"] },
  { id:"imi_competencia", nombre:"IMI · competencia percibida", escala:7, items:["imi_com1","imi_com2","imi_com3"] },
  { id:"imi_valor",       nombre:"IMI · valor y utilidad",      escala:7, items:["imi_val1","imi_val2","imi_val3"] },
  { id:"apre", nombre:"Aprendizaje percibido", escala:5, items:["apre01","apre02"] }
];

/** Opcional: { sus01: "texto del ítem", … } para mostrar el enunciado real
 *  en la tabla de ítems en vez del identificador. */
export const ETIQUETAS = {};

const N_ITEMS = ESCALAS.reduce((n, e) => n + e.items.length, 0);

/* ── Estado ────────────────────────────────────────────────────────────
   TODOS = lo que hay guardado. DATOS = lo que se está mirando.
   El panel, el CSV y los borrados operan sobre DATOS. */
const $ = s => document.querySelector(s);
let TODOS = [], DATOS = [], ejemploEnMemoria = false;

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const f1 = n => n == null ? "—" : n.toFixed(1);
const f2 = n => n == null ? "—" : n.toFixed(2);

/* ════════════════════════════════════════════════════════════════════════
   CARGA Y FILTRO
   ════════════════════════════════════════════════════════════════════════ */

function filtrar() {
  DATOS = enRango(TODOS, $("#desde").value, $("#hasta").value);
  const filtrado = Boolean($("#desde").value || $("#hasta").value);
  $("#filtro").classList.toggle("filtered", filtrado);
  $("#tally-n").textContent = DATOS.length;
  $("#tally-lbl").textContent = filtrado
    ? "de " + TODOS.length + " · filtradas por fecha"
    : "respuestas guardadas";
  pintar();
}

async function recargar() {
  if (ejemploEnMemoria) { filtrar(); return; }
  try {
    TODOS = store.ordenar(await store.cargar());
  } catch (error) {
    console.error('[MusicFest] no se pudieron leer las encuestas', error);
    $("#resumen").textContent = "No se pudieron leer las respuestas. Revisa tu conexión o tu autorización docente.";
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

const valores = itemId =>
  DATOS.map(d => d.respuestas?.[itemId]).filter(v => typeof v === "number");

function pintar() {
  const hayAlgo = TODOS.length > 0;
  $("#vacio").hidden = hayAlgo;
  $("#filtro").hidden = !hayAlgo;
  $("#sin-rango").hidden = !(hayAlgo && !DATOS.length);
  $("#panel").hidden = !DATOS.length;
  $("#sin-rango-n").textContent = TODOS.length;
  $("#aviso-ejemplo").hidden = !ejemploEnMemoria;

  $("#estado").textContent = hayAlgo ? DATOS.length + " respuestas" : "Sin datos";
  if (!DATOS.length) { $("#resumen").textContent = ""; return; }

  $("#resumen").textContent = DATOS.length + " respuestas · última el " +
    new Date(Math.max(...DATOS.map(d => +new Date(d.enviadoEn)))).toLocaleString("es-CL") +
    " · las parejas se reconstruyen desde el correo al cruzar con las hojas de trabajo";

  // ── KPIs ──
  const susEsc = ESCALAS.find(e => e.sus);
  const susScore = susEsc ? puntajeSUS(DATOS, susEsc.items) : null;
  const { clase: susClase, nota: susNota } = lecturaSUS(susScore);

  const apreEsc = ESCALAS.find(e => e.id === "apre");
  const apreVals = DATOS.map(d => {
    const v = apreEsc.items.map(i => d.respuestas?.[i]).filter(x => typeof x === "number");
    return v.length ? media(v) : null;
  }).filter(v => v !== null);

  const durs = DATOS.map(d => d.duracionSeg).filter(v => typeof v === "number");
  const durMed = durs.length ? mediana(durs) : null;
  const completas = DATOS.filter(d => Object.keys(d.respuestas || {}).length >= N_ITEMS).length;

  $("#kpis").innerHTML = `
    <div class="kpi"><div class="k">Respuestas</div><div class="v">${DATOS.length}</div><div class="n">de 50 esperadas</div></div>
    <div class="kpi ${susClase}"><div class="k">SUS</div><div class="v">${susScore == null ? "—" : Math.round(susScore)}</div><div class="n">${susNota}</div></div>
    <div class="kpi"><div class="k">Aprendizaje percibido</div><div class="v">${apreVals.length ? f1(media(apreVals)) : "—"}</div><div class="n">escala 1 a 5</div></div>
    <div class="kpi"><div class="k">Completitud</div><div class="v">${Math.round(completas / DATOS.length * 100)}%</div><div class="n">encuestas sin ítems vacíos</div></div>`;

  // ── escalas ──
  $("#tbl-escalas").innerHTML = ESCALAS.map(e => {
    const filas = DATOS.map(d => e.items.map(i => d.respuestas?.[i]))
      .filter(f => f.every(v => typeof v === "number"));
    const medias = filas.map(f => media(f));
    const m = medias.length ? media(medias) : null;
    const s = medias.length ? de(medias) : null;
    const { valor: rel, usa } = fiabilidad(filas, e.items.length);
    const pct = m == null ? 0 : ((m - 1) / (e.escala - 1)) * 100;
    return `<tr>
      <td><strong>${esc(e.nombre)}</strong><div class="hint">escala 1–${e.escala} · n = ${filas.length}</div></td>
      <td class="n">${e.items.length}</td>
      <td class="n"><span class="big">${f2(m)}</span></td>
      <td class="n">${f2(s)}</td>
      <td><div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div></td>
      <td class="n">${rel == null ? "—" : f2(rel)}<div class="hint">${usa}</div></td>
    </tr>`;
  }).join("");

  // ── ítems ──
  const items = ESCALAS.flatMap(e => e.items.map(i => ({ id: i, escala: e.escala, grupo: e.nombre })));
  $("#tbl-items").innerHTML = items.map(it => {
    const v = valores(it.id);
    const faltan = DATOS.length - v.length;
    const conteo = Array.from({ length: it.escala }, (_, k) => v.filter(x => x === k + 1).length);
    const max = Math.max(1, ...conteo);
    const barras = conteo.map(c =>
      `<div class="${c === max && c > 0 ? 'hi' : ''}" style="height:${(c / max * 100).toFixed(0)}%" title="${c}"></div>`).join("");
    return `<tr>
      <td><code>${it.id}</code> ${esc(ETIQUETAS[it.id] || "")}<div class="hint">${esc(it.grupo)}</div></td>
      <td class="n"><span class="big">${v.length ? f2(media(v)) : "—"}</span></td>
      <td class="n">${v.length ? f2(de(v)) : "—"}</td>
      <td><div class="dist">${barras}</div></td>
      <td class="n">${faltan ? `<span class="chip">${faltan}</span>` : `<span class="chip ok">0</span>`}</td>
    </tr>`;
  }).join("");

  // ── duración y voz ──
  $("#dur").textContent = formatoDuracion(durMed);
  $("#dur-nota").textContent = lecturaDuracion(durMed);

  const abiertas = DATOS.map(d => d.abierta).filter(Boolean);
  $("#abiertas").innerHTML = abiertas.length
    ? abiertas.map(t => `<p>${esc(t)}</p>`).join("")
    : `<p class="hint">Sin respuestas abiertas todavía.</p>`;

  // ── registros ──
  $("#tbl-registros").innerHTML = DATOS.map(d => {
    const n = Object.keys(d.respuestas || {}).length;
    const dur = typeof d.duracionSeg === "number"
      ? Math.floor(d.duracionSeg / 60) + ":" + String(Math.round(d.duracionSeg % 60)).padStart(2, "0")
      : "—";
    const clave = store.claveDe(d);
    return `<tr data-clave="${esc(clave)}">
      <td><strong>${esc(d.email || "sin correo")}</strong></td>
      <td>${new Date(d.enviadoEn).toLocaleString("es-CL")}</td>
      <td class="n">${dur}</td>
      <td class="n">${n === N_ITEMS ? `<span class="chip ok">${n}</span>` : `<span class="chip">${n} / ${N_ITEMS}</span>`}</td>
      <td class="acciones"><button class="mini" data-borrar="${esc(clave)}">Eliminar</button></td>
    </tr>`;
  }).join("");

  $("#btn-borrar-vista").textContent = "Eliminar los " + DATOS.length + " del rango";
  $("#btn-borrar-todo").hidden = DATOS.length === TODOS.length;

  $("#nota-h6").innerHTML = "<b>H6 · discordancia percepción/medición</b><p>El puntaje de aprendizaje percibido de arriba es la mitad del contraste. La otra mitad es la ganancia observada en los indicadores A y B de las hojas de trabajo, que se digita aparte. Cruza ambas por correo del alumno: la predicción es que <em>no</em> correlacionen, y podrían correlacionar negativamente.</p>";
}

/* ════════════════════════════════════════════════════════════════════════
   BORRADO — siempre pasa por confirmación explícita
   ════════════════════════════════════════════════════════════════════════ */
let pendiente = null;

function confirmar(titulo, texto, claves) {
  pendiente = claves;
  $("#dlg-titulo").textContent = titulo;
  $("#dlg-texto").textContent = texto;
  $("#dlg").showModal();
}

/* ════════════════════════════════════════════════════════════════════════
   CSV — exporta lo que está a la vista, no todo el almacenamiento
   ════════════════════════════════════════════════════════════════════════ */
function csv() {
  const items = ESCALAS.flatMap(e => e.items);
  const cab = ["email", "enviadoEn", "duracionSeg", ...items, "abierta"];
  const filas = DATOS.map(d => [
    d.email, d.enviadoEn, d.duracionSeg,
    ...items.map(i => d.respuestas?.[i] ?? ""),
    (d.abierta || "").replace(/[\r\n]+/g, " ")
  ]);
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const txt = "﻿" + [cab, ...filas].map(f => f.map(q).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
  a.download = "musicfest-encuesta-" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
}

/* ════════════════════════════════════════════════════════════════════════
   DATOS DE EJEMPLO
   ────────────────────────────────────────────────────────────────────────
   Con Firebase activo NO se escriben: 43 respuestas falsas en la colección
   de producción serían indistinguibles de las reales para cualquiera que
   mire los datos después. Se quedan en memoria y el panel lo dice.
   ════════════════════════════════════════════════════════════════════════ */
export function generarEjemplo(ahora = Date.now()) {
  const items = ESCALAS.flatMap(e => e.items.map(i => ({ id: i, esc: e.escala })));
  const rnd = (min, max) => Math.max(min, Math.min(max, Math.round(min + Math.random() * (max - min))));
  const DIA = 86400000;
  const frases = ["Quedarme sin chilenos el domingo.", "El tiempo del domingo.", "Decidir rápido en pareja.", "Nada, estuvo entretenido."];
  return Array.from({ length: 43 }, (_, k) => {
    const r = {};
    items.forEach(it => { r[it.id] = it.esc === 7 ? rnd(3, 7) : rnd(2, 5); });
    return {
      id: "demo-" + (k + 1),
      demo: true,
      email: "alumno" + (k + 1) + "@udd.cl",
      enviadoEn: new Date(ahora - Math.floor(k / 9) * DIA - k * 60000).toISOString(),
      duracionSeg: rnd(160, 320),
      respuestas: r,
      abierta: k % 5 === 0 ? frases[k % 4] : null
    };
  });
}

function ejemplo() {
  TODOS = generarEjemplo();
  if (store.usingFirebase) {
    ejemploEnMemoria = true;           // no tocar la colección de producción
  } else {
    store.local.reemplazar(TODOS);     // modo demo: persiste, como antes
  }
  $("#desde").value = ""; $("#hasta").value = "";
  filtrar();
}

/* ════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ════════════════════════════════════════════════════════════════════════ */
export function cablear() {
  $("#btn-csv").addEventListener("click", csv);
  $("#btn-demo").addEventListener("click", ejemplo);
  $("#btn-recargar").addEventListener("click", () => { ejemploEnMemoria = false; recargar(); });
  $("#desde").addEventListener("change", filtrar);
  $("#hasta").addEventListener("change", filtrar);

  document.querySelectorAll("[data-rango]").forEach(b => b.addEventListener("click", () => {
    const hoy = dia(new Date().toISOString());
    if (b.dataset.rango === "hoy") { $("#desde").value = hoy; $("#hasta").value = hoy; }
    else if (b.dataset.rango === "7") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      $("#desde").value = dia(d.toISOString()); $("#hasta").value = hoy;
    } else { $("#desde").value = ""; $("#hasta").value = ""; }
    filtrar();
  }));

  $("#dlg-cancelar").addEventListener("click", () => {
    document.querySelectorAll("tr.va-borrar").forEach(tr => tr.classList.remove("va-borrar"));
    pendiente = null;
    $("#dlg").close();
  });

  $("#dlg-confirmar").addEventListener("click", async () => {
    const claves = pendiente;
    pendiente = null;
    $("#dlg").close();
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

  $("#tbl-registros").addEventListener("click", e => {
    const clave = e.target.dataset?.borrar;
    if (!clave) return;
    e.target.closest("tr").classList.add("va-borrar");
    const fila = DATOS.find(d => store.claveDe(d) === clave);
    confirmar("Eliminar una respuesta",
      "Se borrará definitivamente la respuesta de " + (fila?.email || "este registro") + ".",
      [clave]);
  });

  $("#btn-borrar-vista").addEventListener("click", () => {
    if (!DATOS.length) return;
    confirmar("Eliminar " + DATOS.length + " respuestas",
      "Se borrarán todas las respuestas del rango de fechas seleccionado. Las que quedan fuera del rango no se tocan.",
      DATOS.map(store.claveDe));
  });

  $("#btn-borrar-todo").addEventListener("click", () => {
    if (!TODOS.length) return;
    confirmar("Eliminar las " + TODOS.length + " respuestas",
      "Se borrará todo lo guardado, incluidas las respuestas fuera del rango que estás mirando.",
      TODOS.map(store.claveDe));
  });
}

export async function iniciar() {
  cablear();
  await openTeacherGate();   // en modo demo se abre sola
  await recargar();
}

if (typeof document !== 'undefined' && document.querySelector('#tbl-registros')) iniciar();
