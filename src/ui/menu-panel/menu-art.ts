// Draws the menu screens (docs/UI-STYLE.md): small clean serif text floating on dark mist with shafts of pale light and
// drifting dust, no panel. Everything is painted on 2D canvases (once, or when the reached item changes), then shown as
// textures; nothing here runs per frame. The mist is painted with gradients only, so it is the same on every browser.
import { FIRST_ITEM_V, ITEM_PITCH_V, LINE_V, RULE_V, TITLE_V } from './menu-layout';
import type { MenuScreen } from './screens';

export const MENU_FONT = 'Cinzel';
export const MENU_CANVAS_PX = 1024;

const INK = { title: '#e9eef6', line: '#8d97a8', dim: '#7e8694', lit: '#ffffff', rule: '#aab3c4' };
const HIGH = { title: '#000', line: '#000', dim: '#000', lit: '#000', rule: '#000' };

/** A small seeded generator, so the mist and the dust are the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** The thin ornament under a title: lines that fade out, a diamond, and a small curl each side of it. */
function ornament(g: CanvasRenderingContext2D, cx: number, y: number, half: number, colour: string): void {
  const line = g.createLinearGradient(cx - half, 0, cx + half, 0);
  line.addColorStop(0, 'rgba(170,179,196,0)');
  line.addColorStop(0.3, colour);
  line.addColorStop(0.7, colour);
  line.addColorStop(1, 'rgba(170,179,196,0)');
  g.strokeStyle = line;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - half, y);
  g.lineTo(cx - 34, y);
  g.moveTo(cx + 34, y);
  g.lineTo(cx + half, y);
  g.stroke();
  g.strokeStyle = colour;
  g.fillStyle = colour;
  g.lineWidth = 2;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + s * 34, y);
    g.quadraticCurveTo(cx + s * 26, y - 11, cx + s * 17, y - 5);
    g.moveTo(cx + s * 34, y);
    g.quadraticCurveTo(cx + s * 26, y + 11, cx + s * 17, y + 5);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(cx, y - 9);
  g.lineTo(cx + 9, y);
  g.lineTo(cx, y + 9);
  g.lineTo(cx - 9, y);
  g.closePath();
  g.fill();
}

function arrow(g: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1): void {
  g.beginPath();
  g.moveTo(x + dir * 14, y);
  g.lineTo(x - dir * 8, y - 11);
  g.lineTo(x - dir * 8, y + 11);
  g.closePath();
  g.fill();
}

/** One screen's text on a transparent canvas. `hover` is the item to light, or -1. */
export function paintMenu(g: CanvasRenderingContext2D, screen: MenuScreen, hover: number, high: boolean): void {
  const W = MENU_CANVAS_PX;
  const ink = high ? HIGH : INK;
  g.clearRect(0, 0, W, W);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = W / 2;
  const family = `'${MENU_FONT}', 'Cinzel Decorative', Georgia, serif`;

  g.fillStyle = ink.title;
  g.font = `400 84px ${family}`;
  (g as unknown as { letterSpacing: string }).letterSpacing = '10px';
  g.fillText(screen.title.toUpperCase(), cx + 5, TITLE_V * W);
  (g as unknown as { letterSpacing: string }).letterSpacing = '0px';

  ornament(g, cx, RULE_V * W, 250, ink.rule);

  g.fillStyle = ink.line;
  g.font = `400 30px ${family}`;
  g.fillText(screen.line, cx, LINE_V * W);

  screen.buttons.forEach((b, i) => {
    const y = (FIRST_ITEM_V + i * ITEM_PITCH_V) * W;
    const lit = i === hover;
    g.font = `400 ${lit ? 46 : 42}px ${family}`;
    if (lit && !high) {
      g.shadowColor = 'rgba(220,230,255,0.75)';
      g.shadowBlur = 22;
    }
    g.fillStyle = lit ? ink.lit : ink.dim;
    g.fillText(b.label, cx, y);
    if (lit) {
      const half = g.measureText(b.label).width / 2 + 44;
      arrow(g, cx - half, y, 1);
      arrow(g, cx + half, y, -1);
    }
    g.shadowBlur = 0;
    g.shadowColor = 'transparent';
  });
}

/** The mist behind a menu: dark in the middle, fog, shafts of pale light from above, and edges that fade to nothing. */
export function paintBackdrop(g: CanvasRenderingContext2D, w: number, h: number): void {
  const rand = rng(7);
  g.clearRect(0, 0, w, h);
  // The dark body of it.
  const body = g.createRadialGradient(w / 2, h * 0.5, 0, w / 2, h * 0.5, w * 0.55);
  body.addColorStop(0, 'rgba(3,5,9,0.94)');
  body.addColorStop(0.6, 'rgba(5,8,13,0.88)');
  body.addColorStop(1, 'rgba(5,8,13,0.5)');
  g.fillStyle = body;
  g.fillRect(0, 0, w, h);
  // Fog: big soft blobs of grey-blue, mostly low down.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const x = rand() * w;
    const y = h * (0.25 + rand() * 0.75);
    const r = w * (0.12 + rand() * 0.18);
    const a = 0.035 + rand() * 0.05;
    const f = g.createRadialGradient(x, y, 0, x, y, r);
    f.addColorStop(0, `rgba(120,138,168,${a})`);
    f.addColorStop(1, 'rgba(120,138,168,0)');
    g.fillStyle = f;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Shafts of light from above: each is a few soft strips, widest and faintest first.
  for (let i = 0; i < 7; i++) {
    const x = w * (0.18 + rand() * 0.64);
    const lean = (rand() - 0.5) * w * 0.12;
    const width = w * (0.03 + rand() * 0.05);
    for (let k = 3; k >= 1; k--) {
      const ww = width * k * 0.6;
      const grad = g.createLinearGradient(0, 0, 0, h * 0.95);
      grad.addColorStop(0, `rgba(205,215,232,${0.14 + rand() * 0.08})`);
      grad.addColorStop(0.7, 'rgba(205,215,232,0.04)');
      grad.addColorStop(1, 'rgba(205,215,232,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - ww * 0.4, 0);
      g.lineTo(x + ww * 0.4, 0);
      g.lineTo(x + lean + ww, h);
      g.lineTo(x + lean - ww, h);
      g.closePath();
      g.fill();
    }
  }
  // Darker corners and a dark base, as in the reference.
  g.globalCompositeOperation = 'source-over';
  const base = g.createLinearGradient(0, h * 0.6, 0, h);
  base.addColorStop(0, 'rgba(2,3,6,0)');
  base.addColorStop(1, 'rgba(2,3,6,0.55)');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // Fade the whole thing to nothing at its edges, so it never shows as a rectangle.
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  g.translate(-w / 2, -w / 2);
  g.fillStyle = mask;
  g.fillRect(0, 0, w, w);
  g.restore();
  g.globalCompositeOperation = 'source-over';
}

/** A tile of drifting specks (it repeats, so the view slides it). */
export function paintDust(g: CanvasRenderingContext2D, size: number): void {
  const rand = rng(21);
  g.clearRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * rand() * 3.4;
    const a = 0.25 + rand() * 0.6;
    const grad = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
    grad.addColorStop(0, `rgba(235,240,250,${a})`);
    grad.addColorStop(0.4, `rgba(235,240,250,${a * 0.45})`);
    grad.addColorStop(1, 'rgba(235,240,250,0)');
    g.fillStyle = grad;
    g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  }
}
