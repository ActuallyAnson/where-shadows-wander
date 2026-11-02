// The paper theatre's painted scenery, drawn in code: a night of pale layers (sky and moon, far hills, near hills with a cottage and
// trees, drifting clouds, a fringe of grass) that the paper stage shows behind the shadows, a little like a diorama. The colours are
// kept light and low in contrast so the black shadows still read; the stage's shader tints them by the night's mood and lights them
// by the flame. Each painter fills the canvas it is given, once, with a transparent background except the sky.

export type BackdropLayer = 'sky' | 'far' | 'mid' | 'near' | 'clouds';

/** Seeded, so the scenery paints the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A ridge line across the canvas: a few big rolls and finer wobble, as y values (fractions of the height) per column. */
function ridge(W: number, base: number, rise: number, seed: number, jag: number): number[] {
  const r = rng(seed);
  const a = r() * 6.28;
  const b = r() * 6.28;
  const out: number[] = [];
  for (let x = 0; x <= W; x += 4) {
    const t = x / W;
    out.push(
      base - rise * (0.55 * Math.sin(t * 5.2 + a) + 0.3 * Math.sin(t * 11.7 + b) + jag * Math.sin(t * 31 + a * b)),
    );
  }
  return out;
}

function fillRidge(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  line: readonly number[],
  fill: string | CanvasGradient,
): void {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(0, H);
  line.forEach((y, i) => g.lineTo(i * 4, y * H));
  g.lineTo(W, H);
  g.closePath();
  g.fill();
}

/** Paints one layer of the backdrop onto a canvas of any size (the layers share one shape: 16 by 9). */
export function paintBackdrop(g: CanvasRenderingContext2D, W: number, H: number, layer: BackdropLayer): void {
  const r = rng(layer.length * 977 + 13);
  g.clearRect(0, 0, W, H);
  if (layer === 'sky') {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#6c83c6');
    sky.addColorStop(0.55, '#a9b7e2');
    sky.addColorStop(1, '#f6dcc0');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // faint stars high up
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255, 252, 240, ${0.25 + r() * 0.5})`;
      g.fillRect(r() * W, r() * H * 0.45, 1 + r() * 1.6, 1 + r() * 1.6);
    }
    // the moon and its halo
    const mx = W * 0.78;
    const my = H * 0.24;
    const halo = g.createRadialGradient(mx, my, 0, mx, my, H * 0.55);
    halo.addColorStop(0, 'rgba(255, 246, 220, 0.85)');
    halo.addColorStop(0.3, 'rgba(255, 240, 205, 0.32)');
    halo.addColorStop(1, 'rgba(255, 240, 205, 0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#fffaea';
    g.beginPath();
    g.arc(mx, my, H * 0.11, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if ('filter' in g && (layer === 'far' || layer === 'clouds')) g.filter = `blur(${Math.max(1, W / 360)}px)`;
  if (layer === 'far') {
    fillRidge(g, W, H, ridge(W, 0.62, 0.16, 5, 0.08), '#8d9ccf');
    const mist = g.createLinearGradient(0, H * 0.55, 0, H * 0.8);
    mist.addColorStop(0, 'rgba(245, 235, 220, 0)');
    mist.addColorStop(1, 'rgba(245, 235, 220, 0.7)');
    g.fillStyle = mist;
    g.fillRect(0, H * 0.55, W, H * 0.3);
    fillRidge(g, W, H, ridge(W, 0.72, 0.1, 9, 0.12), '#a7b2d6');
    return;
  }
  if (layer === 'mid') {
    fillRidge(g, W, H, ridge(W, 0.8, 0.09, 21, 0.05), '#9db38c');
    // a cottage with a lit window, and two small pines, on the near hill
    const hx = W * 0.3;
    const hy = H * 0.74;
    g.fillStyle = '#8a8478';
    g.fillRect(hx, hy, W * 0.07, H * 0.06);
    g.beginPath();
    g.moveTo(hx - W * 0.006, hy);
    g.lineTo(hx + W * 0.035, hy - H * 0.05);
    g.lineTo(hx + W * 0.076, hy);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255, 214, 130, 0.95)';
    g.fillRect(hx + W * 0.028, hy + H * 0.012, W * 0.014, H * 0.022);
    for (const [px, ph] of [
      [W * 0.4, H * 0.1],
      [W * 0.43, H * 0.07],
      [W * 0.62, H * 0.09],
    ]) {
      g.fillStyle = '#7f9776';
      g.beginPath();
      g.moveTo(px, H * 0.8 - ph);
      g.lineTo(px - ph * 0.28, H * 0.8);
      g.lineTo(px + ph * 0.28, H * 0.8);
      g.closePath();
      g.fill();
    }
    fillRidge(g, W, H, ridge(W, 0.9, 0.05, 33, 0.04), '#90a67f');
    return;
  }
  if (layer === 'near') {
    // grass along the foot of the stage, and the edge of a branch hanging in from the top left
    g.fillStyle = 'rgba(112, 136, 98, 0.92)';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, H - H * (0.045 + 0.04 * r()) - (x % 18 < 6 ? H * 0.02 : 0));
    g.lineTo(W, H);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(104, 126, 90, 0.88)';
    g.lineWidth = Math.max(2, W / 150);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-5, H * 0.1);
    g.quadraticCurveTo(W * 0.1, H * 0.12, W * 0.22, H * 0.06);
    g.stroke();
    g.fillStyle = 'rgba(112, 136, 98, 0.85)';
    for (let i = 0; i < 9; i++) {
      const lx = W * (0.04 + 0.2 * (i / 9));
      const ly = H * (0.09 + 0.02 * Math.sin(i * 1.7));
      g.beginPath();
      g.ellipse(lx, ly + H * 0.025, W * 0.012, H * 0.03, 0.6 * (i % 2 ? 1 : -1), 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  // clouds: soft pale banks that wrap at the sides, so they can drift without a seam
  for (let i = 0; i < 16; i++) {
    const cx = r() * W;
    const cy = H * (0.1 + r() * 0.42);
    const rx = W * (0.07 + r() * 0.1);
    const ry = H * (0.035 + r() * 0.05);
    for (const dx of [-W, 0, W]) {
      const x = cx + dx;
      const grad = g.createRadialGradient(x, cy, 0, x, cy, rx);
      grad.addColorStop(0, `rgba(255, 255, 255, ${0.5 + r() * 0.2})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      g.save();
      g.translate(x, cy);
      g.scale(1, ry / rx);
      g.translate(-x, -cy);
      g.fillStyle = grad;
      g.fillRect(x - rx, cy - rx, rx * 2, rx * 2);
      g.restore();
    }
  }
}

/** Which puzzle's scenery: 0 the books, 1 the ledge, 2 the drip, 3 the fan, 4 the castle. */
export type BackdropTheme = 0 | 1 | 2 | 3 | 4;
export const BACKDROP_THEMES = 5;

/**
 * The near scenery for one puzzle, in the same pale colours as the rest (an RGBA canvas, 16 by 9): giant books piled like hills, a
 * bedside table with a glowing lamp, a great plant with dripping leaves, wind curling leaves round a distant fan, a castle on a hill.
 * It replaces the 'mid' layer while that puzzle is up, and slides away when the next one comes.
 */
export function paintBackdropTheme(g: CanvasRenderingContext2D, W: number, H: number, theme: BackdropTheme): void {
  g.clearRect(0, 0, W, H);
  const r = rng(theme * 131 + 7);
  const ground = (base: number, rise: number, seed: number, fill: string) =>
    fillRidge(g, W, H, ridge(W, base, rise, seed, 0.04), fill);
  if (theme === 0) {
    // Giant books, tipped and stacked, with spines and page edges.
    const book = (x: number, y: number, w: number, h: number, tilt: number, cover: string) => {
      g.save();
      g.translate(x, y);
      g.rotate(tilt);
      g.fillStyle = cover;
      g.fillRect(0, -h, w, h);
      g.fillStyle = 'rgba(255, 244, 220, 0.85)';
      g.fillRect(w * 0.04, -h * 0.9, w * 0.92, h * 0.12);
      g.fillStyle = 'rgba(80, 50, 40, 0.35)';
      g.fillRect(0, -h, w * 0.06, h);
      g.restore();
    };
    ground(0.86, 0.04, 3, '#a9b79c');
    book(W * 0.08, H * 0.88, W * 0.26, H * 0.09, -0.03, '#b0786a');
    book(W * 0.1, H * 0.79, W * 0.22, H * 0.08, 0.04, '#7f9a94');
    book(W * 0.64, H * 0.9, W * 0.3, H * 0.1, 0.02, '#c4a46a');
    book(W * 0.7, H * 0.8, W * 0.2, H * 0.09, -0.05, '#9a86a6');
    book(W * 0.43, H * 0.9, W * 0.12, H * 0.07, -0.02, '#b8826a');
    return;
  }
  if (theme === 1) {
    // A bedside table with a drawer and a lamp that glows.
    ground(0.88, 0.03, 5, '#a9b39e');
    g.fillStyle = '#b6a088';
    g.fillRect(W * 0.58, H * 0.62, W * 0.3, H * 0.3);
    g.fillStyle = '#a28b72';
    g.fillRect(W * 0.6, H * 0.68, W * 0.26, H * 0.09);
    g.fillRect(W * 0.6, H * 0.8, W * 0.26, H * 0.09);
    g.fillStyle = '#cdbca4';
    g.fillRect(W * 0.55, H * 0.6, W * 0.36, H * 0.03);
    const lx = W * 0.72;
    const glow = g.createRadialGradient(lx, H * 0.44, 0, lx, H * 0.44, H * 0.3);
    glow.addColorStop(0, 'rgba(255, 224, 150, 0.7)');
    glow.addColorStop(1, 'rgba(255, 224, 150, 0)');
    g.fillStyle = glow;
    g.fillRect(lx - H * 0.3, H * 0.14, H * 0.6, H * 0.6);
    g.fillStyle = '#8f8a82';
    g.fillRect(lx - W * 0.006, H * 0.46, W * 0.012, H * 0.14);
    g.fillStyle = '#f3dba0';
    g.beginPath();
    g.moveTo(lx - W * 0.05, H * 0.46);
    g.lineTo(lx + W * 0.05, H * 0.46);
    g.lineTo(lx + W * 0.03, H * 0.32);
    g.lineTo(lx - W * 0.03, H * 0.32);
    g.closePath();
    g.fill();
    return;
  }
  if (theme === 2) {
    // A great plant in a pot: broad leaves, with drops hanging from their tips.
    ground(0.9, 0.03, 9, '#a6b49a');
    g.fillStyle = '#b98a6c';
    g.beginPath();
    g.moveTo(W * 0.66, H * 0.74);
    g.lineTo(W * 0.84, H * 0.74);
    g.lineTo(W * 0.81, H * 0.92);
    g.lineTo(W * 0.69, H * 0.92);
    g.closePath();
    g.fill();
    const leaf = (cx: number, cy: number, a: number, len: number) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillStyle = '#8fae86';
      g.beginPath();
      g.ellipse(len / 2, 0, len / 2, len * 0.17, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(70, 100, 70, 0.4)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(len, 0);
      g.stroke();
      g.restore();
    };
    for (let i = 0; i < 7; i++) leaf(W * 0.75, H * 0.74, -2.5 + i * 0.42, H * (0.34 + 0.08 * r()));
    g.fillStyle = 'rgba(190, 225, 255, 0.9)';
    for (const [x, y] of [
      [0.6, 0.5],
      [0.66, 0.44],
      [0.88, 0.5],
      [0.93, 0.58],
    ]) {
      g.beginPath();
      g.moveTo(W * x, H * (y - 0.03));
      g.quadraticCurveTo(W * (x + 0.012), H * y, W * x, H * (y + 0.02));
      g.quadraticCurveTo(W * (x - 0.012), H * y, W * x, H * (y - 0.03));
      g.fill();
    }
    return;
  }
  if (theme === 3) {
    // A fan in the distance and wind curling leaves across the paper.
    ground(0.88, 0.04, 11, '#a9b6a0');
    g.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    g.lineWidth = Math.max(2, W / 200);
    g.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const y = H * (0.3 + i * 0.1);
      g.beginPath();
      g.moveTo(W * (0.5 + 0.03 * i), y);
      g.bezierCurveTo(W * 0.65, y - H * 0.08, W * 0.78, y + H * 0.08, W * (0.95 - 0.02 * i), y - H * 0.02);
      g.stroke();
    }
    const fx = W * 0.2;
    const fy = H * 0.55;
    g.fillStyle = '#b8b2a8';
    g.beginPath();
    g.arc(fx, fy, H * 0.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d6d0c6';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(fx, fy, H * 0.17, H * 0.045, (i * Math.PI) / 5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#9a9488';
    g.fillRect(fx - W * 0.012, fy + H * 0.2, W * 0.024, H * 0.17);
    g.fillStyle = 'rgba(160, 190, 110, 0.9)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.ellipse(W * (0.55 + 0.4 * r()), H * (0.2 + 0.6 * r()), W * 0.014, H * 0.03, r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  // The castle on its hill, with a lit window and a gate.
  ground(0.84, 0.07, 13, '#a9b8a0');
  const cx = W * 0.62;
  const base = H * 0.8;
  g.fillStyle = '#b7aeb8';
  g.fillRect(cx - W * 0.17, base - H * 0.14, W * 0.34, H * 0.14);
  const tower = (x: number, w: number, h: number) => {
    g.fillStyle = '#b7aeb8';
    g.fillRect(x, base - h, w, h);
    g.fillStyle = '#9d94a8';
    g.beginPath();
    g.moveTo(x - w * 0.12, base - h);
    g.lineTo(x + w / 2, base - h - w * 1.1);
    g.lineTo(x + w * 1.12, base - h);
    g.closePath();
    g.fill();
  };
  tower(cx - W * 0.2, W * 0.06, H * 0.3);
  tower(cx - W * 0.07, W * 0.14, H * 0.46);
  tower(cx + W * 0.14, W * 0.06, H * 0.34);
  g.fillStyle = 'rgba(255, 214, 130, 0.95)';
  g.fillRect(cx - W * 0.015, base - H * 0.34, W * 0.03, H * 0.06);
  g.fillStyle = '#7d7488';
  g.beginPath();
  g.arc(cx, base - H * 0.04, W * 0.024, Math.PI, 0);
  g.fillRect(cx - W * 0.024, base - H * 0.04, W * 0.048, H * 0.04);
  g.fill();
}
