/**
 * MusicFest · Banco de ítems de la encuesta de percepción
 * ═══════════════════════════════════════════════════════════════════════════
 * Módulo de datos puro. Sin dependencias, sin DOM, sin Firebase.
 * Renderízalo con tus propios componentes; puntúalo con encuesta.scoring.js
 *
 * CUÁNDO SE APLICA
 * Minutos 48–52 de la sesión: después del juego y ANTES de la hoja de salida.
 * El EMSI está diseñado para aplicarse durante o inmediatamente después de la
 * actividad, así que ese momento es el que el instrumento espera.
 *
 * ⚠️ REGLA DE DISEÑO — no la rompas al editar
 * Ningún ítem de esta encuesta puede nombrar el mecanismo, es decir, que las
 * decisiones de un día reducen las opciones de los días siguientes. La encuesta
 * va antes de la hoja de salida; un ítem que nombre el acoplamiento dejaría de
 * ser medición y pasaría a ser una pista entregada un minuto antes de evaluarla.
 * El chequeo de manipulación va en la papeleta de papel del final.
 *
 * ⚠️ VERSIONADO
 * Si cambias, agregas o quitas un ítem, sube VERSION_INSTRUMENTO y guarda ese
 * valor en cada documento. Vas a acumular cuatro semestres; sin ese campo no
 * podrás separar cohortes después.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const VERSION_INSTRUMENTO = "2026-1";

/* ─────────────────────────────────────────────────────────────────────────
   ESCALAS
   ───────────────────────────────────────────────────────────────────────── */
export const ESCALAS = {
  ueq: {
    nombre: "La plataforma",
    fuente: "UEQ-S · versión española oficial",
    cita: "Schrepp, M., Hinderks, A. & Thomaschewski, J. (2017). Design and Evaluation of a Short Version of the User Experience Questionnaire (UEQ-S). IJIMAI, 4(6), 103–108.",
    tipo: "diferencial",          // par de adjetivos opuestos
    min: 1, max: 7,
    transformar: true,            // se puntúa en −3…+3 restando 4
    intro: "Marca la casilla que mejor refleje tu impresión de la aplicación que acabas de usar. Los extremos son opuestos: elige el punto intermedio si ninguno te representa.",
    dimensiones: ["pragmatica", "hedonica"]
  },
  emsi: {
    nombre: "Por qué participaste",
    fuente: "EMSI · versión española validada de 14 ítems",
    cita: "Martín-Albo, J., Núñez, J. L. & Navarro, J. G. (2009). Validation of the Spanish Version of the Situational Motivation Scale (EMSI) in the Educational Context. The Spanish Journal of Psychology, 12(2), 799–807.",
    tipo: "likert",
    min: 1, max: 7,
    transformar: false,
    stem: "¿Por qué estás realizando esta actividad en este momento?",
    anclas: ["No corresponde en absoluto", "Corresponde moderadamente", "Corresponde exactamente"],
    dimensiones: ["intrinseca", "identificada", "externa", "desmotivacion"]
  },
  comp: {
    nombre: "Cómo te sentiste con tu desempeño",
    fuente: "Competencia percibida · IMI · adaptación propia",
    cita: "Adaptado de la subescala de competencia percibida del Intrinsic Motivation Inventory. Sin validación en español: declarar como limitación.",
    tipo: "likert",
    min: 1, max: 7,
    transformar: false,
    anclas: ["No es nada cierto", "Es moderadamente cierto", "Es totalmente cierto"],
    dimensiones: ["competencia"]
  },
  apr: {
    nombre: "Lo que sientes que aprendiste",
    fuente: "Aprendizaje percibido · adaptación propia",
    cita: "Adaptación propia en la tradición SALG. Sostiene H6: se espera que NO correlacione con la ganancia medida en los indicadores A y B.",
    tipo: "likert",
    min: 1, max: 7,
    transformar: false,
    anclas: ["Muy en desacuerdo", "Ni de acuerdo ni en desacuerdo", "Muy de acuerdo"],
    dimensiones: ["aprendizaje"]
  }
};

/* ─────────────────────────────────────────────────────────────────────────
   DIMENSIONES
   alfaRef = alfa reportado en la validación española (n = 373).
   Si tu alfa cae mucho por debajo, revisa la aplicación antes de interpretar.
   ───────────────────────────────────────────────────────────────────────── */
export const DIMENSIONES = {
  pragmatica:    { escala: "ueq",  nombre: "Calidad pragmática" },
  hedonica:      { escala: "ueq",  nombre: "Calidad hedónica" },
  intrinseca:    { escala: "emsi", nombre: "Motivación intrínseca",   alfaRef: 0.84 },
  identificada:  { escala: "emsi", nombre: "Regulación identificada", alfaRef: 0.82 },
  externa:       { escala: "emsi", nombre: "Regulación externa",      alfaRef: 0.87 },
  desmotivacion: { escala: "emsi", nombre: "Desmotivación",           alfaRef: 0.81 },
  competencia:   { escala: "comp", nombre: "Competencia percibida" },
  aprendizaje:   { escala: "apr",  nombre: "Aprendizaje percibido" }
};

/* ─────────────────────────────────────────────────────────────────────────
   ÍTEMS · en orden de presentación

   UEQ-S: polo negativo a la IZQUIERDA en los ocho, o sea NO hay ítems
   invertidos y no se recodifica nada.

   Corrección documentada del ítem 8: el PDF oficial trae «convencional» como
   polo izquierdo, duplicando el ítem 7. Es un error de transcripción — en
   alemán son `konventionell` (7) y `herkömmlich` (8), en inglés `conventional`
   y `usual` — y se corrige a «habitual». Declararlo en el manuscrito.

   EMSI: los ítems 10 y 11 del SIMS original fueron eliminados en el CFA de la
   validación española. Los id conservan la numeración original salteada para
   dejar constancia de que se usó la versión de 14 y no una selección propia.
   ───────────────────────────────────────────────────────────────────────── */
export const ITEMS = [
  // ── UEQ-S · calidad pragmática ──
  { id: "ueq1", escala: "ueq", dim: "pragmatica", izq: "obstructivo",    der: "impulsor de apoyo" },
  { id: "ueq2", escala: "ueq", dim: "pragmatica", izq: "complicado",     der: "fácil" },
  { id: "ueq3", escala: "ueq", dim: "pragmatica", izq: "ineficiente",    der: "eficiente" },
  { id: "ueq4", escala: "ueq", dim: "pragmatica", izq: "confuso",        der: "claro" },
  // ── UEQ-S · calidad hedónica ──
  { id: "ueq5", escala: "ueq", dim: "hedonica",   izq: "aburrido",       der: "emocionante" },
  { id: "ueq6", escala: "ueq", dim: "hedonica",   izq: "no interesante", der: "interesante" },
  { id: "ueq7", escala: "ueq", dim: "hedonica",   izq: "convencional",   der: "original" },
  { id: "ueq8", escala: "ueq", dim: "hedonica",   izq: "habitual",       der: "novedoso" },

  // ── EMSI · 14 ítems, en el orden original del instrumento ──
  { id: "emsi01", escala: "emsi", dim: "intrinseca",    t: "Porque creo que esta actividad es interesante" },
  { id: "emsi02", escala: "emsi", dim: "identificada",  t: "Por mi propio bien" },
  { id: "emsi03", escala: "emsi", dim: "externa",       t: "Porque se supone que debo hacerlo" },
  { id: "emsi04", escala: "emsi", dim: "desmotivacion", t: "Puede que haya buenas razones para realizar esta actividad, pero yo no veo ninguna" },
  { id: "emsi05", escala: "emsi", dim: "intrinseca",    t: "Porque disfruto con esta actividad" },
  { id: "emsi06", escala: "emsi", dim: "identificada",  t: "Porque creo que esta actividad es buena para mí" },
  { id: "emsi07", escala: "emsi", dim: "externa",       t: "Porque es algo que tengo que hacer" },
  { id: "emsi08", escala: "emsi", dim: "desmotivacion", t: "Realizo esta actividad, pero no estoy seguro de si vale la pena" },
  { id: "emsi09", escala: "emsi", dim: "intrinseca",    t: "Porque esta actividad es divertida" },
  // (ítems 10 y 11 eliminados en la validación española)
  { id: "emsi12", escala: "emsi", dim: "desmotivacion", t: "No lo sé; no veo qué me aporta esta actividad" },
  { id: "emsi13", escala: "emsi", dim: "intrinseca",    t: "Porque me siento bien realizando esta actividad" },
  { id: "emsi14", escala: "emsi", dim: "identificada",  t: "Porque creo que esta actividad es importante para mí" },
  { id: "emsi15", escala: "emsi", dim: "externa",       t: "Porque creo que tengo que hacerlo" },
  { id: "emsi16", escala: "emsi", dim: "desmotivacion", t: "Hago esta actividad, pero no estoy seguro de que sea conveniente continuar con ella" },

  // ── Competencia percibida ──
  { id: "comp1", escala: "comp", dim: "competencia", t: "Creo que lo hice bastante bien en esta actividad" },
  { id: "comp2", escala: "comp", dim: "competencia", t: "Estoy satisfecho con mi desempeño en esta actividad" },
  { id: "comp3", escala: "comp", dim: "competencia", t: "Después de trabajar un rato en esto, me sentí bastante competente" },

  // ── Aprendizaje percibido ──
  { id: "apr1", escala: "apr", dim: "aprendizaje", t: "Siento que aprendí bastante sobre cómo modelar problemas de optimización" },
  { id: "apr2", escala: "apr", dim: "aprendizaje", t: "Ahora entiendo mejor este tipo de problemas que antes de empezar la clase" },
  { id: "apr3", escala: "apr", dim: "aprendizaje", t: "Sabría enfrentar por mi cuenta un problema parecido a este" }
];

/* ─────────────────────────────────────────────────────────────────────────
   HELPERS DE CONSULTA
   ───────────────────────────────────────────────────────────────────────── */
export const ITEM_IDS   = ITEMS.map(i => i.id);
export const TOTAL_ITEMS = ITEMS.length;                       // 28
export const itemsDe    = dim => ITEMS.filter(i => i.dim === dim);
export const itemsDeEscala = esc => ITEMS.filter(i => i.escala === esc);
export const DIM_IDS    = Object.keys(DIMENSIONES);

/** Ítems agrupados por escala, en orden de presentación. Útil para renderizar. */
export function bloques() {
  return Object.entries(ESCALAS).map(([id, esc]) => ({
    id, ...esc, items: itemsDeEscala(id)
  }));
}
