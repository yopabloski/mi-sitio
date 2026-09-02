// MusicFest · estadística de la encuesta de percepción.
//
// Funciones puras: no tocan el DOM ni Firebase, y por eso se prueban con
// `node --test` igual que el resto de js/domain/.
//
// Con n ≈ 50 por semestre no hay IRT ni CFA. Lo que se calcula acá es lo
// defendible con esa muestra: medias, dispersión, y una fiabilidad elegida
// según el número de ítems de cada subescala.

export const media = a => a.reduce((x, y) => x + y, 0) / a.length;

export const varianza = a => {
  if (a.length < 2) return 0;
  const m = media(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
};

export const de = a => Math.sqrt(varianza(a));

export const mediana = a => {
  const s = [...a].sort((x, y) => x - y);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/**
 * α de Cronbach. Solo válido de tres ítems hacia arriba: con dos, α depende de
 * la correlación de un único par y se vuelve inestable (Eisinga, Grotenhuis &
 * Pelzer, 2013). Para ese caso usa spearmanBrown.
 * @param {number[][]} matriz filas = personas, columnas = ítems
 */
export function alfa(matriz) {
  const k = matriz[0]?.length || 0;
  if (k < 2 || matriz.length < 3) return null;
  const varItems = [];
  for (let j = 0; j < k; j++) varItems.push(varianza(matriz.map(f => f[j])));
  const varTotal = varianza(matriz.map(f => f.reduce((a, b) => a + b, 0)));
  if (!varTotal) return null;
  return (k / (k - 1)) * (1 - varItems.reduce((a, b) => a + b, 0) / varTotal);
}

/** Fiabilidad correcta para subescalas de exactamente dos ítems. */
export function spearmanBrown(matriz) {
  if (matriz.length < 3) return null;
  const x = matriz.map(f => f[0]), y = matriz.map(f => f[1]);
  const mx = media(x), my = media(y);
  const num = x.reduce((s, _, i) => s + (x[i] - mx) * (y[i] - my), 0);
  const den = Math.sqrt(
    x.reduce((s, v) => s + (v - mx) ** 2, 0) * y.reduce((s, v) => s + (v - my) ** 2, 0)
  );
  if (!den) return null;
  const r = num / den;
  return (2 * r) / (1 + r);
}

/** Elige el estadístico según el número de ítems y devuelve también su nombre. */
export function fiabilidad(matriz, nItems) {
  const usa = nItems === 2 ? "Spearman-Brown" : "α";
  const valor = matriz.length ? (nItems === 2 ? spearmanBrown(matriz) : alfa(matriz)) : null;
  return { valor, usa };
}

/**
 * SUS convertido a 0–100 en su versión positiva: los diez ítems suman directo,
 * sin invertir los pares. Solo cuenta a quien respondió los diez.
 */
export function puntajeSUS(registros, items) {
  const porPersona = registros.map(d => {
    const vs = items.map(i => d.respuestas?.[i]).filter(v => typeof v === "number");
    if (vs.length !== items.length) return null;
    return vs.reduce((a, b) => a + (b - 1), 0) * 2.5;
  }).filter(v => v !== null);
  return porPersona.length ? media(porPersona) : null;
}

/** Lectura del SUS contra el promedio de referencia de la literatura (68). */
export function lecturaSUS(puntaje) {
  if (puntaje == null) return { clase: "", nota: "" };
  if (puntaje >= 72) return { clase: "", nota: "Por sobre el promedio de referencia (68)" };
  if (puntaje >= 62) return { clase: "warn", nota: "En torno al promedio de referencia (68)" };
  return { clase: "bad", nota: "Bajo el promedio de referencia (68)" };
}

/**
 * Fecha local en YYYY-MM-DD, comparable como texto con un <input type="date">.
 * Local y no UTC a propósito: una respuesta enviada a las 22:00 en Chile debe
 * contar como del día en que el alumno la respondió, no del siguiente.
 */
export function dia(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}

/** Filtra por rango inclusivo. Cualquiera de los dos extremos puede ir vacío. */
export function enRango(registros, desde, hasta) {
  return registros.filter(d => {
    const f = dia(d.enviadoEn);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    return true;
  });
}

/** Lectura de la duración mediana contra el presupuesto de 4 minutos. */
export function lecturaDuracion(segundos) {
  if (segundos == null) return "";
  if (segundos > 300) return "Se pasa del presupuesto. Considera recortar ítems antes de la próxima aplicación.";
  if (segundos < 90) return "Muy rápido para el número de ítems: revisa si hubo respuestas en línea recta.";
  return "Dentro de lo presupuestado.";
}

export const formatoDuracion = s =>
  s == null ? "—" : Math.floor(s / 60) + " min " + String(Math.round(s % 60)).padStart(2, "0") + " s";
