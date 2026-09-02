/**
 * MusicFest · Puntuación y agregación de la encuesta de percepción
 * ═══════════════════════════════════════════════════════════════════════════
 * Funciones puras. Sin dependencias, sin DOM, sin Firebase.
 * Entrada: objetos `respuestas` con forma { ueq1: 5, emsi01: 6, ... }.
 *
 * REGLAS DE PUNTUACIÓN
 * · UEQ-S  → se transforma restando 4, quedando en −3…+3. Polo negativo a la
 *            izquierda en los ocho ítems, así que no hay recodificación.
 *            Interpretación: > +0,8 positiva · < −0,8 negativa · resto neutra.
 * · EMSI   → media simple por subescala en 1…7, sin inversiones.
 * · Índice de autodeterminación = 2·MI + RI − RE − 2·AM, rango −18…+18.
 *            Reportar como secundario: el RAI tiene detractores.
 * · Fiabilidad → alfa de Cronbach. Todas las subescalas tienen 3 o 4 ítems, así
 *            que alfa es aplicable. Si alguna vez bajas una a 2 ítems, usa
 *            Spearman-Brown en su lugar: alfa está mal aplicado con 2 ítems.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ITEMS, ITEM_IDS, DIMENSIONES, DIM_IDS, itemsDe, TOTAL_ITEMS } from "./encuesta.config.js";

/* ─────────────────── estadística básica ─────────────────── */
export const promedio = a => a.reduce((x, y) => x + y, 0) / a.length;
export const varianza = a => {
  if (a.length < 2) return 0;
  const m = promedio(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);   // muestral, n−1
};
export const desviacion = a => Math.sqrt(varianza(a));
export const mediana = a => {
  const s = [...a].sort((x, y) => x - y), h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/** Alfa de Cronbach. `matriz`: filas = personas, columnas = ítems. */
export function alfaCronbach(matriz) {
  const k = matriz[0]?.length || 0;
  if (k < 2 || matriz.length < 3) return null;
  const varItems = [];
  for (let j = 0; j < k; j++) varItems.push(varianza(matriz.map(f => f[j])));
  const varTotal = varianza(matriz.map(f => f.reduce((a, b) => a + b, 0)));
  if (!varTotal) return null;
  return (k / (k - 1)) * (1 - varItems.reduce((a, b) => a + b, 0) / varTotal);
}

/** Spearman-Brown. Úsalo solo si alguna subescala queda con 2 ítems. */
export function spearmanBrown(matriz) {
  if (matriz.length < 3 || matriz[0]?.length !== 2) return null;
  const x = matriz.map(f => f[0]), y = matriz.map(f => f[1]);
  const mx = promedio(x), my = promedio(y);
  const num = x.reduce((s, _, i) => s + (x[i] - mx) * (y[i] - my), 0);
  const den = Math.sqrt(
    x.reduce((s, v) => s + (v - mx) ** 2, 0) * y.reduce((s, v) => s + (v - my) ** 2, 0)
  );
  if (!den) return null;
  const r = num / den;
  return (2 * r) / (1 + r);
}

/* ─────────────────── validación ─────────────────── */

/** ¿Está completa y bien formada? Devuelve los id que faltan o son inválidos. */
export function validar(respuestas = {}) {
  const faltantes = [], invalidos = [];
  for (const it of ITEMS) {
    const v = respuestas[it.id];
    if (v === undefined || v === null || v === "") { faltantes.push(it.id); continue; }
    if (!Number.isInteger(v) || v < 1 || v > 7) invalidos.push(it.id);
  }
  return { completo: !faltantes.length && !invalidos.length, faltantes, invalidos };
}

/**
 * Control de calidad: respuesta en línea recta.
 * Marca a quien usó 2 o menos valores distintos en los 28 ítems.
 * Excluirlas es defendible, pero hay que declararlo en el manuscrito.
 */
export function esPlana(respuestas = {}, maxDistintos = 2) {
  const v = ITEM_IDS.map(id => respuestas[id]).filter(x => typeof x === "number");
  return v.length >= 20 && new Set(v).size <= maxDistintos;
}

/* ─────────────────── puntuación individual ─────────────────── */

/** Media de una dimensión para una persona. `null` si le falta algún ítem. */
export function mediaDimension(respuestas, dim) {
  const ids = itemsDe(dim).map(i => i.id);
  const v = ids.map(id => respuestas?.[id]);
  if (v.some(x => typeof x !== "number")) return null;
  const transformar = DIMENSIONES[dim].escala === "ueq";
  return promedio(transformar ? v.map(x => x - 4) : v);
}

/** Valoración cualitativa de un puntaje UEQ en escala −3…+3. */
export function valoracionUEQ(v) {
  if (v == null) return null;
  if (v > 0.8) return "positiva";
  if (v < -0.8) return "negativa";
  return "neutra";
}

/**
 * Todos los puntajes de una persona.
 * Cualquier dimensión incompleta queda en null y no contamina el resto.
 */
export function puntuar(respuestas = {}) {
  const d = {};
  for (const dim of DIM_IDS) d[dim] = mediaDimension(respuestas, dim);

  const ueqGlobal = (d.pragmatica != null && d.hedonica != null)
    ? (d.pragmatica + d.hedonica) / 2 : null;

  const sdi = [d.intrinseca, d.identificada, d.externa, d.desmotivacion].every(x => x != null)
    ? 2 * d.intrinseca + d.identificada - d.externa - 2 * d.desmotivacion : null;

  return {
    ...d,
    ueqGlobal,
    valoracionUEQ: valoracionUEQ(ueqGlobal),
    indiceAutodeterminacion: sdi,          // rango −18…+18
    itemsRespondidos: ITEM_IDS.filter(id => typeof respuestas[id] === "number").length,
    completo: validar(respuestas).completo
  };
}

/* ─────────────────── agregación de la muestra ─────────────────── */

/**
 * Estadísticos de grupo por dimensión.
 * `docs`: arreglo de documentos con la forma { respuestas: {...} }.
 * Cada dimensión usa solo los casos completos EN ESA dimensión.
 */
export function agregar(docs = []) {
  const salida = {};
  for (const dim of DIM_IDS) {
    const ids = itemsDe(dim).map(i => i.id);
    const transformar = DIMENSIONES[dim].escala === "ueq";
    const matriz = docs
      .map(doc => ids.map(id => {
        const v = doc?.respuestas?.[id];
        return typeof v === "number" ? (transformar ? v - 4 : v) : null;
      }))
      .filter(f => f.every(v => v !== null));

    if (!matriz.length) {
      salida[dim] = { n: 0, k: ids.length, media: null, de: null, alfa: null,
                      alfaRef: DIMENSIONES[dim].alfaRef ?? null, alertaFiabilidad: false };
      continue;
    }
    const medias = matriz.map(f => promedio(f));
    const a = ids.length === 2 ? spearmanBrown(matriz) : alfaCronbach(matriz);
    const ref = DIMENSIONES[dim].alfaRef ?? null;
    salida[dim] = {
      n: matriz.length, k: ids.length,
      media: promedio(medias), de: desviacion(medias),
      alfa: a, alfaRef: ref,
      // se enciende si tu fiabilidad cae más de .15 bajo la de la validación
      alertaFiabilidad: a != null && ref != null && a < ref - 0.15
    };
  }

  const g = (salida.pragmatica.media != null && salida.hedonica.media != null)
    ? (salida.pragmatica.media + salida.hedonica.media) / 2 : null;

  const sdi = ["intrinseca", "identificada", "externa", "desmotivacion"]
    .every(k => salida[k].media != null)
    ? 2 * salida.intrinseca.media + salida.identificada.media
      - salida.externa.media - 2 * salida.desmotivacion.media : null;

  return {
    n: docs.length,
    completos: docs.filter(d => validar(d?.respuestas || {}).completo).length,
    planas: docs.filter(d => esPlana(d?.respuestas || {})).length,
    dimensiones: salida,
    ueqGlobal: g,
    valoracionUEQ: valoracionUEQ(g),
    indiceAutodeterminacion: sdi
  };
}

/** Estadísticos por ítem: media, DE, distribución 1..7 y faltantes. */
export function porItem(docs = []) {
  return ITEMS.map(it => {
    const v = docs.map(d => d?.respuestas?.[it.id]).filter(x => typeof x === "number");
    return {
      id: it.id, dim: it.dim, escala: it.escala,
      texto: it.t || `${it.izq} — ${it.der}`,
      n: v.length, faltantes: docs.length - v.length,
      media: v.length ? promedio(v) : null,
      de: v.length ? desviacion(v) : null,
      distribucion: Array.from({ length: 7 }, (_, k) => v.filter(x => x === k + 1).length)
    };
  });
}

/* ─────────────────── exportación ─────────────────── */

export function cabeceraCSV() {
  return ["email", "pareja", "sesionId", "version", "enviadoEn", "duracionSeg",
          ...ITEM_IDS,
          ...DIM_IDS.map(d => "m_" + d),
          "ueq_global", "indice_autodeterminacion", "completo", "plana", "abierta"];
}

export function filaCSV(doc = {}) {
  const p = puntuar(doc.respuestas || {});
  const r4 = x => (x == null ? "" : Number(x.toFixed(4)));
  return [
    doc.email ?? "", doc.pareja ?? "", doc.sesionId ?? "", doc.version ?? "",
    doc.enviadoEn ?? "", doc.duracionSeg ?? "",
    ...ITEM_IDS.map(id => doc.respuestas?.[id] ?? ""),
    ...DIM_IDS.map(d => r4(p[d])),
    r4(p.ueqGlobal), r4(p.indiceAutodeterminacion),
    p.completo ? 1 : 0, esPlana(doc.respuestas || {}) ? 1 : 0,
    (doc.abierta || "").replace(/[\r\n]+/g, " ")
  ];
}

/** CSV completo con BOM, para que Excel en español lo abra en UTF-8. */
export function generarCSV(docs = []) {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [cabeceraCSV(), ...docs.map(filaCSV)]
    .map(f => f.map(q).join(",")).join("\r\n");
}

/* ─────────────────── H6 ─────────────────── */

/**
 * Correlación de Pearson. Para H6: cruza `aprendizaje` de cada alumno contra
 * su ganancia observada en los indicadores A y B de las hojas de trabajo.
 * La predicción es que NO correlacionen, y podrían correlacionar negativamente.
 * Usa `competencia` como covariable: quienes no cerraron el domingo deberían
 * puntuar más bajo en ella.
 */
export function pearson(x, y) {
  if (x.length !== y.length || x.length < 3) return null;
  const mx = promedio(x), my = promedio(y);
  const num = x.reduce((s, _, i) => s + (x[i] - mx) * (y[i] - my), 0);
  const den = Math.sqrt(
    x.reduce((s, v) => s + (v - mx) ** 2, 0) * y.reduce((s, v) => s + (v - my) ** 2, 0)
  );
  return den ? num / den : null;
}
