// MusicFest · siluetas de instrumentos para el fondo del cartel.
//
// Se dibujan con primitivas de canvas y no con SVG importado: así heredan el
// color que fije el cartel, escalan sin archivos extra y no hay que cargar nada
// por red antes de poder pintar el fondo.
//
// Cada figura se rasteriza a un canvas propio y se compone de una sola vez. Si
// se dibujaran directamente con `globalAlpha` bajo, cada trazo superpuesto
// sumaría opacidad y aparecerían costuras donde el mástil cruza la caja de la
// guitarra o donde los tensores tocan el casco del bombo.

const TAU = Math.PI * 2;

/** Rectángulo redondeado como sub-trazo: no abre ni cierra el path. */
function roundPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const arc = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };

// Todas las figuras se dibujan centradas en el origen dentro de una caja de
// lado `s`, de modo que rotarlas alrededor de su centro sea trivial.
const shapes = {
  /** Vinilo: aro exterior, surcos y etiqueta central. */
  vinilo(ctx, s) {
    const R = s * 0.47;
    ctx.lineWidth = s * 0.032;
    arc(ctx, 0, 0, R); ctx.stroke();
    ctx.lineWidth = s * 0.013;
    for (let i = 0; i < 4; i++) { arc(ctx, 0, 0, R * (0.46 + i * 0.12)); ctx.stroke(); }
    arc(ctx, 0, 0, R * 0.30); ctx.fill();
  },

  /** Guitarra de cuerpo curvo, mástil y boca. */
  guitarra(ctx, s) {
    ctx.lineWidth = s * 0.030;

    // Mástil y clavijero primero: después el cuerpo borra lo que queda dentro.
    ctx.beginPath();
    ctx.rect(-s * 0.045, -s * 0.48, s * 0.09, s * 0.28);
    ctx.stroke();
    ctx.beginPath();
    roundPath(ctx, -s * 0.085, -s * 0.51, s * 0.17, s * 0.10, s * 0.02);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -s * 0.30);
    ctx.bezierCurveTo(s * 0.20, -s * 0.30, s * 0.28, -s * 0.20, s * 0.28, -s * 0.08);
    ctx.bezierCurveTo(s * 0.28, s * 0.02, s * 0.17, s * 0.06, s * 0.17, s * 0.13);
    ctx.bezierCurveTo(s * 0.17, s * 0.22, s * 0.34, s * 0.26, s * 0.34, s * 0.38);
    ctx.bezierCurveTo(s * 0.34, s * 0.48, s * 0.20, s * 0.52, 0, s * 0.52);
    ctx.bezierCurveTo(-s * 0.20, s * 0.52, -s * 0.34, s * 0.48, -s * 0.34, s * 0.38);
    ctx.bezierCurveTo(-s * 0.34, s * 0.26, -s * 0.17, s * 0.22, -s * 0.17, s * 0.13);
    ctx.bezierCurveTo(-s * 0.17, s * 0.06, -s * 0.28, s * 0.02, -s * 0.28, -s * 0.08);
    ctx.bezierCurveTo(-s * 0.28, -s * 0.20, -s * 0.20, -s * 0.30, 0, -s * 0.30);
    ctx.closePath();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';   // sólo afecta a este sello
    ctx.fill();
    ctx.restore();
    ctx.stroke();

    ctx.lineWidth = s * 0.024;
    arc(ctx, 0, -s * 0.05, s * 0.075); ctx.stroke();
    ctx.beginPath();
    ctx.rect(-s * 0.10, s * 0.30, s * 0.20, s * 0.035);
    ctx.fill();
  },

  /** Caja acústica con woofer y tweeter. */
  parlante(ctx, s) {
    const w = s * 0.58, h = s * 0.92;
    ctx.lineWidth = s * 0.032;
    ctx.beginPath();
    roundPath(ctx, -w / 2, -h / 2, w, h, s * 0.05);
    ctx.stroke();
    arc(ctx, 0, h * 0.17, s * 0.19); ctx.stroke();
    arc(ctx, 0, h * 0.17, s * 0.068); ctx.fill();
    arc(ctx, 0, -h * 0.27, s * 0.088); ctx.stroke();
    arc(ctx, 0, -h * 0.27, s * 0.032); ctx.fill();
  },

  /** Bombo visto de frente, con los tensores en zigzag. */
  bateria(ctx, s) {
    const R = s * 0.42, hh = s * 0.20, ry = s * 0.12;
    ctx.lineWidth = s * 0.030;
    ctx.beginPath(); ctx.ellipse(0, -hh, R, ry, 0, 0, TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-R, -hh); ctx.lineTo(-R, hh);
    ctx.moveTo(R, -hh); ctx.lineTo(R, hh);
    ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, hh, R, ry, 0, 0, Math.PI); ctx.stroke();
    ctx.lineWidth = s * 0.017;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) ctx.lineTo(-R + (2 * R * i) / 8, i % 2 ? hh : -hh);
    ctx.stroke();
  },

  /** Audífonos de diadema. */
  audifonos(ctx, s) {
    const R = s * 0.33;
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.arc(0, s * 0.02, R, Math.PI, TAU);
    ctx.stroke();
    ctx.lineWidth = s * 0.032;
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      roundPath(ctx, lado * R - s * 0.075, s * 0.02, s * 0.15, s * 0.30, s * 0.06);
      ctx.stroke();
    }
  },

  /** Octava de teclado. */
  teclado(ctx, s) {
    const w = s * 0.92, h = s * 0.40, n = 7, kw = w / n;
    ctx.lineWidth = s * 0.028;
    ctx.beginPath();
    roundPath(ctx, -w / 2, -h / 2, w, h, s * 0.025);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      ctx.moveTo(-w / 2 + kw * i, -h / 2);
      ctx.lineTo(-w / 2 + kw * i, h / 2);
    }
    ctx.stroke();
    for (const i of [1, 2, 4, 5, 6]) {          // do#, re#, fa#, sol#, la#
      ctx.beginPath();
      ctx.rect(-w / 2 + kw * i - kw * 0.28, -h / 2, kw * 0.56, h * 0.60);
      ctx.fill();
    }
  }
};

export const INSTRUMENTS = Object.keys(shapes);

const cache = new Map();

/** Rasteriza una silueta al doble de resolución para que aguante la rotación. */
function stamp(name, size, color) {
  const key = `${name}|${size}|${color}`;
  if (cache.has(key)) return cache.get(key);
  const off = document.createElement('canvas');
  off.width = off.height = Math.round(size * 2);
  const ctx = off.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  (shapes[name] || shapes.vinilo)(ctx, size);
  cache.set(key, off);
  return off;
}

/**
 * Estampa una silueta centrada en (x, y).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name  una de INSTRUMENTS
 */
export function drawInstrument(ctx, name, { x, y, size, rotate = 0, color, alpha = 0.07 }) {
  const sello = stamp(name, size, color);
  if (!sello) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(sello, -size / 2, -size / 2, size, size);
  ctx.restore();
}
