// The Stair of Stone as a world to climb: a path that rises in steps through a sandstone canyon, drawn as separate layers (sky, far mesas,
// middle cliffs, the path and what stands beside it, a soft blurred foreground, and the rock that frames the picture) so each can move at its
// own speed as the traveller goes up. Plain 2D canvas, no three.js. Every layer has its own size (the path and the cliffs are bigger than
// the screen: the camera follows the climb across them).

import { blur, mix, poly, rng, ridgeFn, rockMass } from './vista-art';

type Ctx = CanvasRenderingContext2D;

export type ClimbLayer = 'sky' | 'far' | 'mid' | 'path' | 'near' | 'frame';

/** The size each layer is painted at, as a share of a screen width and height (the screen is the unit). */
export const CLIMB_SIZE: Readonly<Record<ClimbLayer, readonly [number, number]>> = {
  sky: [1, 1],
  far: [1.4, 1],
  mid: [2.1, 1.5],
  path: [2.4, 1.9],
  near: [1.4, 1],
  frame: [1, 1],
};

/** The path the traveller climbs: waypoints in the `path` layer, in tenths of its size across and down. Flats joined by short risers. */
export const CLIMB_PATH: readonly (readonly [number, number])[] = [
  [0.04, 0.9],
  [0.28, 0.9],
  [0.34, 0.78],
  [0.5, 0.78],
  [0.56, 0.66],
  [0.72, 0.66],
  [0.78, 0.54],
  [0.96, 0.54],
];

/** Landmarks beside the path, as the share along its length (0 to 1) and what they are. */
export const CLIMB_LANDMARKS: readonly { at: number; kind: 'sign' | 'lamp' | 'arch' }[] = [
  { at: 0.2, kind: 'sign' },
  { at: 0.52, kind: 'lamp' },
  { at: 0.88, kind: 'arch' },
];

/** Where along the path (0 to 1) a point is, as the position in layer pixels. Flat parts are walked at a steady pace, risers faster. */
export function pathPoint(u: number, W: number, H: number, out: { x: number; y: number }): void {
  const pts = CLIMB_PATH;
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot((pts[i][0] - pts[i - 1][0]) * W, (pts[i][1] - pts[i - 1][1]) * H);
    lens.push(l);
    total += l;
  }
  let d = Math.min(1, Math.max(0, u)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] > 0 ? Math.min(1, d / lens[i]) : 0;
      out.x = (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f) * W;
      out.y = (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f) * H;
      return;
    }
    d -= lens[i];
  }
}

/** Paints one layer onto a canvas of the layer's own size (`W` by `H` pixels; `unit` is the screen's width, to scale detail by). */
export function paintClimbLayer(g: Ctx, layer: ClimbLayer, W: number, H: number, unit: number): void {
  const r = rng(layer.length * 331 + 17);
  g.save();
  g.clearRect(0, 0, W, H);

  if (layer === 'sky') {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#5e97c4');
    sky.addColorStop(0.6, '#cfdcd0');
    sky.addColorStop(1, '#f6e4be');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(W * 0.74, H * 0.14, 0, W * 0.74, H * 0.14, W * 0.45);
    sun.addColorStop(0, 'rgba(255,250,226,1)');
    sun.addColorStop(0.15, 'rgba(255,240,200,0.6)');
    sun.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    blur(g, unit / 140);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(255,255,255,${0.16 + r() * 0.18})`;
      g.beginPath();
      g.ellipse(r() * W, H * (0.05 + r() * 0.25), unit * (0.06 + r() * 0.1), H * 0.014, 0, 0, 6.283);
      g.fill();
    }
    blur(g, 0);
  }

  if (layer === 'far') {
    // Flat-topped mesas in haze, three ranks, paler and bluer with distance.
    for (let k = 0; k < 3; k++) {
      const t = k / 2;
      const ridge = ridgeFn(700 + k * 11, 4);
      const base = H * (0.62 + t * 0.1);
      blur(g, (1 - t) * 2.4);
      g.beginPath();
      g.moveTo(0, H);
      for (let i = 0; i <= 90; i++) {
        const x = i / 90;
        const step = Math.round(Math.min(0.7, Math.max(0, ridge(x) * 0.5 + 0.4)) * 6);
        g.lineTo(x * W, base - step * H * 0.05);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fillStyle = mix([208, 186, 168], [150, 104, 88], t);
      g.fill();
      blur(g, 0);
      const haze = g.createLinearGradient(0, base - H * 0.2, 0, base + H * 0.1);
      haze.addColorStop(0, 'rgba(246,230,200,0)');
      haze.addColorStop(1, `rgba(246,230,200,${0.55 - t * 0.3})`);
      g.fillStyle = haze;
      g.fillRect(0, base - H * 0.2, W, H * 0.4);
    }
  }

  if (layer === 'mid') {
    // Tall banded buttes, lit from the right, dusty and softened by the air between.
    const buttes = 7;
    for (let k = 0; k < buttes; k++) {
      const cx = ((k + 0.5) / buttes) * W + (r() - 0.5) * W * 0.05;
      const w = W * (0.08 + r() * 0.07);
      const top = H * (0.18 + r() * 0.36);
      const body = g.createLinearGradient(cx - w, 0, cx + w, 0);
      body.addColorStop(0, '#8a5238');
      body.addColorStop(0.7, '#c98a58');
      body.addColorStop(1, '#e8b27a');
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(cx - w, H);
      const edge = ridgeFn(60 + k, 4);
      for (let i = 0; i <= 14; i++) {
        const f = i / 14;
        g.lineTo(cx - w + edge(f) * w * 0.18, H - f * (H - top));
      }
      g.lineTo(cx - w * 0.9 + w * 0.18, top);
      g.lineTo(cx + w * 0.9, top + H * 0.012);
      for (let i = 0; i <= 14; i++) {
        const f = 1 - i / 14;
        g.lineTo(cx + w + edge(f + 0.4) * w * 0.18, H - f * (H - top));
      }
      g.closePath();
      g.fill();
      g.save();
      g.clip(); // the bands and the lit top stay inside the rock
      for (let b = 0; b < 22; b++) {
        g.fillStyle = `rgba(${r() < 0.5 ? '255,214,170' : '70,34,26'},${0.07 + r() * 0.12})`;
        g.fillRect(cx - w, top + r() * (H - top), w * 2, 2 + r() * 8);
      }
      g.fillStyle = 'rgba(255,236,196,0.55)';
      g.fillRect(cx - w * 0.9, top, w * 1.8, 5);
      g.restore();
    }
    const haze = g.createLinearGradient(0, 0, 0, H);
    haze.addColorStop(0, 'rgba(244,226,196,0.55)');
    haze.addColorStop(1, 'rgba(244,226,196,0.05)');
    g.fillStyle = haze;
    g.fillRect(0, 0, W, H);
  }

  if (layer === 'path') {
    // The terraces: banded sandstone below the path, a lit top edge, a dusty path on it, with grass tufts and stones along it.
    const pts = CLIMB_PATH.map(([x, y]) => [x * W, y * H] as [number, number]);
    const face = g.createLinearGradient(0, H * 0.5, 0, H);
    face.addColorStop(0, '#d49a64');
    face.addColorStop(1, '#6a4030');
    g.fillStyle = face;
    g.beginPath();
    g.moveTo(pts[0][0], H);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineTo(pts[pts.length - 1][0], H);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    for (let b = 0; b < 70; b++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,220,176' : '56,28,22'},${0.06 + r() * 0.12})`;
      g.fillRect(0, H * 0.5 + r() * H * 0.5, W, 2 + r() * 10);
    }
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.05 + r() * 0.12})` : `rgba(255,240,214,${0.04 + r() * 0.1})`;
      g.fillRect(r() * W, H * 0.5 + r() * H * 0.5, 1 + r() * 4, 1 + r() * 2);
    }
    // Cracks and dark crevices under each lip, so the steps have weight.
    for (let i = 1; i < pts.length; i++) {
      const under = g.createLinearGradient(
        0,
        Math.min(pts[i - 1][1], pts[i][1]),
        0,
        Math.min(pts[i - 1][1], pts[i][1]) + H * 0.07,
      );
      under.addColorStop(0, 'rgba(30,14,10,0.5)');
      under.addColorStop(1, 'rgba(30,14,10,0)');
      g.fillStyle = under;
      g.fillRect(pts[i - 1][0], Math.min(pts[i - 1][1], pts[i][1]), pts[i][0] - pts[i - 1][0], H * 0.07);
    }
    g.restore();
    // The path itself: a pale dusty band along the top, and a bright lit edge.
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = '#ecc88e';
    g.lineWidth = unit * 0.014;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1] + unit * 0.006);
    for (const p of pts) g.lineTo(p[0], p[1] + unit * 0.006);
    g.stroke();
    g.strokeStyle = 'rgba(255,244,214,0.85)';
    g.lineWidth = unit * 0.004;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1] - unit * 0.004);
    for (const p of pts) g.lineTo(p[0], p[1] - unit * 0.004);
    g.stroke();
    // Tufts of dry grass and small stones along the edge.
    for (let i = 0; i < 260; i++) {
      const f = r();
      const seg = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
      const s = f * (pts.length - 1) - seg;
      const x = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * s;
      const y = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * s;
      const len = unit * (0.006 + r() * 0.014);
      g.strokeStyle = `rgba(${150 + r() * 70},${130 + r() * 50},${70 + r() * 30},${0.6 + r() * 0.4})`;
      g.lineWidth = 1 + r() * 1.6;
      g.beginPath();
      g.moveTo(x, y - unit * 0.004);
      g.quadraticCurveTo(x + len * 0.3, y - len, x + len * 0.9, y - len * 0.85);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      const f = r();
      const seg = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
      const s = f * (pts.length - 1) - seg;
      const x = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * s;
      const y = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * s;
      const sz = unit * (0.004 + r() * 0.01);
      g.fillStyle = `rgb(${150 + r() * 40},${116 + r() * 30},${90 + r() * 20})`;
      g.beginPath();
      g.ellipse(x, y - sz * 0.4, sz, sz * 0.62, 0, 0, 6.283);
      g.fill();
    }
    // Landmarks to walk past.
    const at = { x: 0, y: 0 };
    for (const lm of CLIMB_LANDMARKS) {
      pathPoint(lm.at, W, H, at);
      const base = at.y;
      const x = at.x;
      g.fillStyle = '#2a1c16';
      g.strokeStyle = '#2a1c16';
      if (lm.kind === 'sign') {
        g.lineWidth = unit * 0.007;
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x, base - unit * 0.08);
        g.stroke();
        poly(
          g,
          [
            [x - unit * 0.001, base - unit * 0.075],
            [x + unit * 0.05, base - unit * 0.082],
            [x + unit * 0.058, base - unit * 0.066],
            [x - unit * 0.001, base - unit * 0.06],
          ],
          '#3a281e',
        );
        poly(
          g,
          [
            [x + unit * 0.001, base - unit * 0.057],
            [x - unit * 0.04, base - unit * 0.052],
            [x - unit * 0.047, base - unit * 0.04],
            [x + unit * 0.001, base - unit * 0.044],
          ],
          '#3a281e',
        );
      } else if (lm.kind === 'lamp') {
        g.lineWidth = unit * 0.006;
        g.beginPath();
        g.moveTo(x, base);
        g.lineTo(x, base - unit * 0.12);
        g.quadraticCurveTo(x, base - unit * 0.14, x + unit * 0.02, base - unit * 0.14);
        g.stroke();
        g.globalCompositeOperation = 'lighter';
        const glow = g.createRadialGradient(
          x + unit * 0.02,
          base - unit * 0.125,
          0,
          x + unit * 0.02,
          base - unit * 0.125,
          unit * 0.09,
        );
        glow.addColorStop(0, 'rgba(255,214,140,0.95)');
        glow.addColorStop(0.2, 'rgba(255,190,100,0.5)');
        glow.addColorStop(1, 'rgba(255,170,80,0)');
        g.fillStyle = glow;
        g.fillRect(x - unit * 0.08, base - unit * 0.22, unit * 0.2, unit * 0.2);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#2a1c16';
        g.fillRect(x + unit * 0.012, base - unit * 0.134, unit * 0.016, unit * 0.02);
      } else {
        // A stone arch that the path passes through, its inside dark and a little light beyond.
        const aw = unit * 0.11;
        const ah = unit * 0.16;
        g.fillStyle = '#5a3a2c';
        g.fillRect(x - aw, base - ah, aw * 0.5, ah);
        g.fillRect(x + aw * 0.5, base - ah, aw * 0.5, ah);
        g.beginPath();
        g.arc(x, base - ah, aw, Math.PI, 0);
        g.arc(x, base - ah, aw * 0.5, 0, Math.PI, true);
        g.fill();
        g.fillStyle = 'rgba(255,226,170,0.35)';
        g.beginPath();
        g.arc(x, base - ah, aw * 0.5, Math.PI, 0);
        g.lineTo(x + aw * 0.5, base);
        g.lineTo(x - aw * 0.5, base);
        g.fill();
        g.strokeStyle = 'rgba(255,230,180,0.6)';
        g.lineWidth = unit * 0.003;
        g.beginPath();
        g.arc(x, base - ah, aw, Math.PI, 0);
        g.stroke();
      }
    }
  }

  if (layer === 'near') {
    // Blurred things close to the camera: big tufts at the bottom and a leafy branch at the top left, out of focus.
    blur(g, unit / 90);
    for (let i = 0; i < 60; i++) {
      const x = r() * W;
      g.strokeStyle = `rgba(${70 + r() * 40},${86 + r() * 40},${40},${0.5 + r() * 0.4})`;
      g.lineWidth = unit * (0.004 + r() * 0.01);
      g.beginPath();
      g.moveTo(x, H);
      g.quadraticCurveTo(x + 10, H * (0.9 - r() * 0.1), x + unit * (0.02 + r() * 0.05), H * (0.8 - r() * 0.1));
      g.stroke();
    }
    g.fillStyle = 'rgba(46,60,30,0.7)';
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      g.ellipse(
        unit * (0.02 + r() * 0.35),
        H * (0.02 + r() * 0.16),
        unit * 0.04,
        unit * 0.014,
        0.6 + r() * 0.5,
        0,
        6.283,
      );
      g.fill();
    }
    blur(g, 0);
  }

  if (layer === 'frame') {
    // The rock at the edges that frames the picture: it stays put on screen.
    rockMass(
      g,
      r,
      { x0: -W * 0.06, y0: H * 0.4, x1: W * 0.14, y1: H * 1.04 },
      [38, 18, 14],
      [190, 118, 76],
      1,
      6,
      'right',
    );
    rockMass(
      g,
      r,
      { x0: W * 0.9, y0: H * 0.5, x1: W * 1.06, y1: H * 1.04 },
      [36, 16, 12],
      [200, 130, 84],
      1,
      5,
      'left',
    );
  }
  g.restore();
}
