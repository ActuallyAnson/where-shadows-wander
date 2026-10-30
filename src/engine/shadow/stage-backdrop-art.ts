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
