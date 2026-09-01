// MusicFest · el cartel se dibuja en canvas.
//
// Se dibuja en canvas y no en DOM a propósito: lo que el equipo ve en pantalla
// es exactamente el pixel que se descarga, sin una segunda maqueta que mantener
// ni librerías de rasterizado. Las carátulas viven en el repositorio (mismo
// origen), así que el canvas no queda contaminado y toBlob funciona.
//
// Lenguaje visual: cartel de festival con cada artista en su propio bloque de
// color, centrado. El color NO es decorativo — codifica el género, de modo que
// la diversidad exigida por las reglas se lee de un vistazo.

import { drawInstrument } from './instruments.js';

const INK = '#171710', PAPER = '#F2EFDF', PULSE = '#FF4D22', SIGNAL = '#C6F43D', ELECTRIC = '#4CA5FF';
const GENRE = {
  'Pop':         { fill: '#4CA5FF', text: INK },
  'Rock':        { fill: '#078994', text: PAPER },
  'Rap':         { fill: '#F0A51A', text: INK },
  'Trap Latino': { fill: '#FF4D22', text: INK }
};
const FALLBACK = { fill: '#B4B2A9', text: INK };
const DAY_ACCENT = { friday: PULSE, saturday: SIGNAL, sunday: ELECTRIC };
export const POSTER_W = 1000, POSTER_H = 1400;

const display = size => `${size}px "Archivo Black", "Arial Black", sans-serif`;
const sans = (size, weight = 700) => `${weight} ${size}px "DM Sans", system-ui, sans-serif`;
const genreStyle = genre => GENRE[genre] || FALLBACK;

/** Sin esto el primer dibujo sale en Arial y el cartel pierde su voz. */
export async function fontsReady() {
  if (!document.fonts) return;
  try {
    await Promise.all([document.fonts.load(display(72)), document.fonts.load(sans(16, 900))]);
    await document.fonts.ready;
  } catch { /* seguimos con las de sistema */ }
}

const loadImage = src => new Promise(resolve => {
  if (!src) return resolve(null);
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

// El logo oficial, variante "noche", que es la que tiene la M en claro y por
// tanto se lee sobre el fondo oscuro del cartel.
const LOGO_URL = new URL('../../assets/brand/vector/musicfest-logo-d-noche-vector.svg', import.meta.url).href;

let logoPromise = null;
/**
 * El SVG de marca trae un rectángulo de fondo opaco del color Backstage. Sobre
 * el cartel taparía las manchas de color con un cuadrado plano, así que se le
 * quita antes de rasterizarlo. El data-URL resultante es de mismo origen, de
 * modo que `toBlob` sigue funcionando. Si el fetch falla —por ejemplo abriendo
 * el archivo con file://— se cae al SVG tal cual, y si tampoco carga,
 * `drawPoster` dibuja el lockup tipográfico.
 */
function loadLogo() {
  if (logoPromise) return logoPromise;
  logoPromise = (async () => {
    try {
      const svg = await (await fetch(LOGO_URL)).text();
      const limpio = svg.replace(/<rect\b[^>]*width="500"[^>]*height="500"[^>]*>/i, '');
      if (limpio !== svg) {
        const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(limpio));
        if (img) return img;
      }
    } catch { /* sin red o sin fetch: seguimos con el archivo original */ }
    return loadImage(LOGO_URL);
  })();
  return logoPromise;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Reparte los bloques en filas centradas que quepan en `maxWidth`.
 * Devuelve filas con el ancho de cada bloque ya medido.
 */
function layoutBlocks(ctx, items, maxWidth, fontSize, padX, gap) {
  ctx.font = display(fontSize);
  const rows = [];
  let row = [], rowWidth = 0;
  for (const item of items) {
    const w = ctx.measureText(item.name.toUpperCase()).width + padX * 2;
    const extra = row.length ? gap : 0;
    if (row.length && rowWidth + extra + w > maxWidth) {
      rows.push({ blocks: row, width: rowWidth });
      row = []; rowWidth = 0;
    }
    row.push({ ...item, width: w });
    rowWidth += (row.length > 1 ? gap : 0) + w;
  }
  if (row.length) rows.push({ blocks: row, width: rowWidth });
  return rows;
}

// Posiciones fijas: el cartel debe salir idéntico cada vez que se redibuja,
// para que lo que el equipo ve en pantalla sea el archivo que descarga.
const BLOBS = [
  { x: 130, y: 170, r: 480, alpha: 0.34 },
  { x: 930, y: 430, r: 440, alpha: 0.26 },
  { x: 60, y: 880, r: 420, alpha: 0.20 },
  { x: 900, y: 1170, r: 450, alpha: 0.22 },
  { x: 500, y: 1420, r: 500, alpha: 0.16 }
];

// Siluetas grandes, sangradas por los bordes, como en un cartel serigrafiado.
// Se mantienen fuera de la franja central para no competir con los nombres.
const SILUETAS = [
  { name: 'audifonos', x: 95, y: 235, size: 260, rotate: -14, alpha: 0.075, tinta: 'papel' },
  { name: 'vinilo', x: 930, y: 165, size: 340, rotate: 0, alpha: 0.10, tinta: 'acento' },
  { name: 'guitarra', x: 66, y: 720, size: 480, rotate: -22, alpha: 0.085, tinta: 'papel' },
  { name: 'parlante', x: 955, y: 760, size: 340, rotate: 9, alpha: 0.075, tinta: 'papel' },
  { name: 'bateria', x: 135, y: 1290, size: 340, rotate: -6, alpha: 0.075, tinta: 'acento' },
  { name: 'teclado', x: 880, y: 1335, size: 350, rotate: 12, alpha: 0.065, tinta: 'papel' }
];

/**
 * Fondo del cartel: manchas de color difusas más siluetas de instrumentos.
 * Las manchas toman los colores de los géneros programados, así que el fondo
 * también cuenta qué se eligió en vez de ser decoración arbitraria.
 */
function backdrop(ctx, accent, genres = []) {
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  const paleta = genres.length ? genres.map(g => genreStyle(g).fill) : [accent, ELECTRIC, SIGNAL];
  BLOBS.forEach((b, i) => {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, paleta[i % paleta.length]);
    g.addColorStop(1, 'rgba(23,23,16,0)');
    ctx.save();
    ctx.globalAlpha = b.alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, POSTER_W, POSTER_H);
    ctx.restore();
  });

  for (const s of SILUETAS) {
    drawInstrument(ctx, s.name, { ...s, color: s.tinta === 'acento' ? accent : PAPER });
  }
}

let grainCache = null;
function grain(ctx) {
  if (!grainCache) {
    const off = document.createElement('canvas');
    off.width = off.height = 220;
    const octx = off.getContext('2d');
    const data = octx.createImageData(220, 220);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.random() * 255;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 11;
    }
    octx.putImageData(data, 0, 0);
    grainCache = off;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainCache, 'repeat');
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.restore();
}

function metric(ctx, x, y, w, label, value, cap, ratio, alLimite) {
  ctx.textAlign = 'left';
  ctx.fillStyle = PAPER;
  ctx.font = display(28);
  const text = String(value);
  const textW = ctx.measureText(text).width;   // medir antes de cambiar la fuente
  ctx.fillText(text, x, y);
  if (cap !== undefined && cap !== null) {
    ctx.fillStyle = '#F2EFDF59';
    ctx.font = display(18);
    ctx.fillText(`/${cap}`, x + textW + 3, y);
  }
  ctx.fillStyle = '#F2EFDF8c';
  ctx.font = sans(11, 900);
  ctx.letterSpacing = '1.5px';
  ctx.fillText(label, x, y + 19);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#F2EFDF26';
  ctx.fillRect(x, y + 30, w, 4);
  ctx.fillStyle = alLimite ? PULSE : SIGNAL;
  ctx.fillRect(x, y + 30, w * Math.max(0, Math.min(ratio, 1)), 4);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} model  posterModel()
 * @param {{coverOf?:(id:string)=>string, scale?:number}} options
 */
export async function drawPoster(canvas, model, { coverOf = () => null, scale = 2 } = {}) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx) return;                       // entornos sin canvas: no es un error
  canvas.width = POSTER_W * scale;
  canvas.height = POSTER_H * scale;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const accent = DAY_ACCENT[model.day?.id] || PULSE;
  const M = 60;
  const inner = POSTER_W - M * 2;
  const center = POSTER_W / 2;

  const generos = [...new Set(model.artists.map(a => a.genre))];
  backdrop(ctx, accent, generos);
  ctx.textBaseline = 'alphabetic';

  // ---- Cabecera: el logo oficial preside el cartel ------------------------
  let y = M - 6;
  const logo = await loadLogo();
  if (logo) {
    const lado = 148;
    ctx.drawImage(logo, center - lado / 2, y, lado, lado);
    y += lado + 8;
  } else {
    // Sin el SVG a mano, el lockup tipográfico mantiene la cabecera en pie.
    y += 52;
    ctx.textAlign = 'center';
    ctx.font = display(52);
    const musicW = ctx.measureText('MUSIC').width;
    const festW = ctx.measureText('FEST').width;
    const startX = center - (musicW + festW) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = PAPER;
    ctx.fillText('MUSIC', startX, y);
    ctx.fillStyle = PULSE;
    ctx.fillText('FEST', startX + musicW, y);
    y += 30;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = sans(14, 900);
  ctx.letterSpacing = '4.5px';
  ctx.fillText(String(model.day?.name || '').toUpperCase(), center, y);
  y += 22;
  ctx.fillStyle = '#F2EFDFa8';
  ctx.font = sans(12, 900);
  ctx.letterSpacing = '3px';
  ctx.fillText(model.teamName.toUpperCase(), center, y);
  ctx.letterSpacing = '0px';

  if (model.empty) {
    ctx.fillStyle = '#F2EFDF66';
    ctx.font = display(52);
    ctx.fillText('TU CARTEL', center, POSTER_H / 2 - 20);
    ctx.fillText('ESTÁ VACÍO', center, POSTER_H / 2 + 40);
    ctx.font = sans(17, 400);
    ctx.fillStyle = '#F2EFDF8c';
    ctx.fillText('Elige artistas en el pool y aparecerán aquí.', center, POSTER_H / 2 + 88);
    grain(ctx);
    return;
  }

  // ---- Tira de carátulas -------------------------------------------------
  y += 24;
  const covers = await Promise.all(model.artists.map(a => loadImage(coverOf(a.id))));
  const n = model.artists.length;
  const gapCover = 9;
  const sizeCover = Math.min(96, (inner - gapCover * (n - 1)) / n);
  const stripW = sizeCover * n + gapCover * (n - 1);
  let cx = center - stripW / 2;
  model.artists.forEach((artist, i) => {
    ctx.save();
    roundRect(ctx, cx, y, sizeCover, sizeCover, 4);
    ctx.clip();
    if (covers[i]) {
      ctx.drawImage(covers[i], cx, y, sizeCover, sizeCover);
    } else {
      const g = genreStyle(artist.genre);
      ctx.fillStyle = g.fill;
      ctx.fillRect(cx, y, sizeCover, sizeCover);
      ctx.fillStyle = g.text;
      ctx.font = display(Math.round(sizeCover * 0.3));
      ctx.textAlign = 'center';
      const iniciales = artist.name.split(/\s+/).slice(0, 2).map(p => p[0]).join('').replace('$', 'A');
      ctx.fillText(iniciales, cx + sizeCover / 2, y + sizeCover * 0.62);
    }
    ctx.restore();
    ctx.strokeStyle = '#F2EFDF33';
    ctx.lineWidth = 1;
    roundRect(ctx, cx + .5, y + .5, sizeCover - 1, sizeCover - 1, 4);
    ctx.stroke();
    cx += sizeCover + gapCover;
  });
  y += sizeCover + 40;

  // ---- Nombres en bloques de color, un nivel por popularidad -------------
  const footTop = POSTER_H - M - 150;
  const bases = [58, 34, 22];
  let escala = 1;
  let plan = null;

  // Se calcula el alto real y se reduce la escala hasta que quepa sobre el pie.
  for (let intento = 0; intento < 14; intento++) {
    plan = [];
    let alto = 0;
    model.tiers.forEach((tier, nivel) => {
      if (!tier.length) return;
      const size = Math.max(13, Math.round(bases[nivel] * escala));
      const padX = Math.round(size * 0.34);
      const padY = Math.round(size * 0.24);
      const gap = Math.round(size * 0.2) + 4;
      const rows = layoutBlocks(ctx, tier, inner, size, padX, gap);
      const rowH = size + padY * 2;
      plan.push({ rows, size, padX, padY, gap, rowH });
      alto += rows.length * (rowH + gap) + 10;
    });
    if (y + alto <= footTop || escala <= 0.42) break;
    escala -= 0.06;
  }

  for (const nivel of plan) {
    for (const row of nivel.rows) {
      let x = center - row.width / 2;
      for (const block of row.blocks) {
        const style = genreStyle(block.genre);
        ctx.fillStyle = style.fill;
        roundRect(ctx, x, y, block.width, nivel.rowH, 4);
        ctx.fill();
        ctx.fillStyle = style.text;
        ctx.font = display(nivel.size);
        ctx.textAlign = 'center';
        ctx.fillText(block.name.toUpperCase(), x + block.width / 2, y + nivel.rowH - nivel.padY - nivel.size * 0.18);
        x += block.width + nivel.gap;
      }
      y += nivel.rowH + nivel.gap;
    }
    y += 10;
  }

  // ---- Leyenda de géneros: el color tiene significado --------------------
  const presentes = generos;
  const legendY = footTop + 26;
  ctx.font = sans(11, 900);
  ctx.letterSpacing = '1.4px';
  const legendGap = 26, chip = 11;
  const widths = presentes.map(g => chip + 7 + ctx.measureText(g.toUpperCase()).width);
  let lx = center - (widths.reduce((a, b) => a + b, 0) + legendGap * (presentes.length - 1)) / 2;
  ctx.textAlign = 'left';
  presentes.forEach((g, i) => {
    ctx.fillStyle = genreStyle(g).fill;
    ctx.fillRect(lx, legendY - chip + 1, chip, chip);
    ctx.fillStyle = '#F2EFDFa8';
    ctx.fillText(g.toUpperCase(), lx + chip + 7, legendY);
    lx += widths[i] + legendGap;
  });
  ctx.letterSpacing = '0px';

  // ---- Pie: cuánta holgura queda en cada restricción ---------------------
  const footY = POSTER_H - M - 92;
  ctx.fillStyle = PAPER;
  ctx.fillRect(M, footY, inner, 3);

  const L = model.limits;
  const colW = 142, colGap = 20;
  const by = footY + 44;
  metric(ctx, M, by, colW, 'PRESUPUESTO', L.presupuesto.usado, L.presupuesto.tope, L.presupuesto.ratio, L.presupuesto.alLimite);
  metric(ctx, M + (colW + colGap), by, colW, 'HORAS', L.duracion.usado, L.duracion.tope, L.duracion.ratio, L.duracion.alLimite);
  metric(ctx, M + (colW + colGap) * 2, by, colW, 'CHILENOS', L.chilenos.usado, L.chilenos.tope, L.chilenos.ratio, false);
  metric(ctx, M + (colW + colGap) * 3, by, colW, 'GÉNEROS', L.generos.usado, L.generos.tope, L.generos.ratio, false);

  ctx.textAlign = 'right';
  ctx.fillStyle = model.valid ? SIGNAL : PULSE;
  ctx.font = display(60);
  ctx.fillText(String(model.totals.score), POSTER_W - M, by + 22);
  ctx.fillStyle = '#F2EFDF8c';
  ctx.font = sans(11, 900);
  ctx.letterSpacing = '1.5px';
  ctx.fillText(model.valid ? 'POPULARIDAD' : 'LINEUP INCOMPLETO', POSTER_W - M, by + 44);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';

  grain(ctx);
}

/** Descarga el contenido actual del canvas. */
export function downloadPoster(canvas, filename) {
  return new Promise((resolve, reject) => {
    if (!canvas?.toBlob) return reject(new Error('Este navegador no permite exportar la imagen.'));
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('No se pudo generar la imagen.'));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, 'image/png');
  });
}
