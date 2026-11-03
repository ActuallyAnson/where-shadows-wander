// The five lands the traveller walks through between puzzles, each painted in layers (sky, far, mid, path, near) that move at their own speeds
// as it goes. A land is described by a small table (its colours and what stands in it); one set of painters draws any of them. The canyon,
// which the traveller climbs, is climb-art.ts; the other four are here: the Broken Pass, the Weeping Cave, the Windy Heights and the Sleeping
// Castle. Plain 2D canvas, no three.js; the same picture every time.

import { blur, mix, poly, rng, ridgeFn, rockMass } from './vista-art';
import { pathPoint as climbPathPoint } from './climb-art';

type Ctx = CanvasRenderingContext2D;

export type LandId = 'pass' | 'cave' | 'heights' | 'castle';
export type LandLayer = 'sky' | 'far' | 'mid' | 'path' | 'near';
export type Landmark = 'cairn' | 'sign' | 'lamp' | 'flag' | 'crystal' | 'torch' | 'gate';

export interface LandStyle {
  readonly name: string;
  /** What the land looks like when it is awake (the day), and the cold tint it wears while it sleeps (multiplied over it, 0 to 255). */
  readonly sleepTint: readonly [number, number, number];
  readonly sky: { top: string; mid: string; low: string; sun: readonly [number, number, string] };
  readonly far: {
    kind: 'peaks' | 'hills' | 'cloud' | 'cave';
    near: readonly number[];
    far: readonly number[];
    haze: string;
  };
  readonly mid: { kind: 'peaks' | 'cave' | 'castle' | 'ridge'; body: readonly number[]; lit: readonly number[] };
  readonly ground: {
    top: string;
    bottom: string;
    seams: boolean;
    tufts: 'grass' | 'dry' | 'moss' | 'none';
    water: boolean;
  };
  /** Waypoints of the path in tenths of the layer's size (x across, y down). */
  readonly path: readonly (readonly [number, number])[];
  readonly landmarks: readonly { at: number; kind: Landmark }[];
  readonly near: { grass: readonly number[]; rocks: boolean };
}

/** The size each layer is painted at, in screens (width, height). */
export const LAND_SIZE: Readonly<Record<LandLayer, readonly [number, number]>> = {
  sky: [1, 1],
  far: [1.4, 1.35],
  mid: [2.1, 1.5],
  path: [2.4, 1.9],
  near: [2.4, 1],
};

export const LANDS: Readonly<Record<LandId, LandStyle>> = {
  pass: {
    name: 'The Broken Pass',
    sleepTint: [84, 104, 164],
    sky: { top: '#6f9cc8', mid: '#bcd2e0', low: '#efeadb', sun: [0.6, 0.2, '#fff6dc'] },
    far: { kind: 'peaks', near: [118, 138, 150], far: [182, 198, 214], haze: '236,234,219' },
    mid: { kind: 'peaks', body: [58, 74, 70], lit: [158, 160, 140] },
    ground: { top: '#a89a80', bottom: '#4a4236', seams: false, tufts: 'dry', water: false },
    path: [
      [0.04, 0.86],
      [0.4, 0.84],
      [0.6, 0.78],
      [0.96, 0.7],
    ],
    landmarks: [
      { at: 0.22, kind: 'cairn' },
      { at: 0.55, kind: 'sign' },
      { at: 0.86, kind: 'cairn' },
    ],
    near: { grass: [80, 96, 60], rocks: true },
  },
  cave: {
    name: 'The Weeping Cave',
    sleepTint: [60, 96, 130],
    sky: { top: '#1a2c3e', mid: '#37556b', low: '#6a8da0', sun: [0.4, 0.0, '#e8faff'] },
    far: { kind: 'cave', near: [40, 64, 82], far: [90, 124, 142], haze: '170,214,230' },
    mid: { kind: 'cave', body: [24, 38, 52], lit: [96, 132, 152] },
    ground: { top: '#8d9a98', bottom: '#2a3a3c', seams: false, tufts: 'moss', water: true },
    path: [
      [0.04, 0.8],
      [0.3, 0.8],
      [0.4, 0.84],
      [0.56, 0.84],
      [0.64, 0.8],
      [0.96, 0.8],
    ],
    landmarks: [
      { at: 0.2, kind: 'crystal' },
      { at: 0.5, kind: 'lamp' },
      { at: 0.82, kind: 'crystal' },
    ],
    near: { grass: [46, 86, 70], rocks: true },
  },
  heights: {
    name: 'The Windy Heights',
    sleepTint: [100, 90, 160],
    sky: { top: '#5b6fa8', mid: '#c79bb0', low: '#f6d9aa', sun: [0.3, 0.5, '#ffeabe'] },
    far: { kind: 'cloud', near: [58, 70, 96], far: [176, 150, 178], haze: '255,232,214' },
    mid: { kind: 'ridge', body: [66, 76, 104], lit: [190, 150, 150] },
    ground: { top: '#79803f', bottom: '#2a3020', seams: false, tufts: 'grass', water: false },
    path: [
      [0.04, 0.88],
      [0.3, 0.84],
      [0.5, 0.74],
      [0.7, 0.66],
      [0.96, 0.58],
    ],
    landmarks: [
      { at: 0.25, kind: 'flag' },
      { at: 0.6, kind: 'cairn' },
      { at: 0.9, kind: 'flag' },
    ],
    near: { grass: [120, 130, 60], rocks: false },
  },
  castle: {
    name: 'The Sleeping Castle',
    sleepTint: [70, 70, 150],
    sky: { top: '#1a1f4a', mid: '#6a4a86', low: '#f1b283', sun: [0.74, 0.18, '#fff6e0'] },
    far: { kind: 'hills', near: [44, 36, 78], far: [96, 78, 128], haze: '241,178,131' },
    mid: { kind: 'castle', body: [26, 24, 48], lit: [84, 70, 110] },
    ground: { top: '#6a6078', bottom: '#1a1828', seams: true, tufts: 'none', water: true },
    path: [
      [0.04, 0.86],
      [0.35, 0.84],
      [0.45, 0.8],
      [0.7, 0.8],
      [0.8, 0.7],
      [0.96, 0.68],
    ],
    landmarks: [
      { at: 0.2, kind: 'torch' },
      { at: 0.55, kind: 'torch' },
      { at: 0.92, kind: 'gate' },
    ],
    near: { grass: [60, 56, 90], rocks: true },
  },
};

export const LAND_IDS = Object.keys(LANDS) as LandId[];

/** Where along a land's path a point is, in layer pixels (the same walk as the climb, with the land's own waypoints). */
export function landPathPoint(land: LandId, u: number, W: number, H: number, out: { x: number; y: number }): void {
  const pts = LANDS[land].path;
  let total = 0;
  const lens: number[] = [];
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
void climbPathPoint;

function drawLandmark(g: Ctx, kind: Landmark, x: number, base: number, unit: number, r: () => number): void {
  g.save();
  g.fillStyle = '#241a1e';
  g.strokeStyle = '#241a1e';
  g.lineCap = 'round';
  const glow = (cx: number, cy: number, rad: number, c: string) => {
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, `rgba(${c},0.9)`);
    gr.addColorStop(0.25, `rgba(${c},0.45)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    g.globalCompositeOperation = 'source-over';
  };
  if (kind === 'cairn') {
    for (let i = 0; i < 5; i++) {
      const w = unit * (0.05 - i * 0.008);
      g.fillStyle = `rgb(${100 + r() * 40},${96 + r() * 30},${88 + r() * 30})`;
      g.beginPath();
      g.ellipse(x + (r() - 0.5) * unit * 0.006, base - i * unit * 0.022 - unit * 0.01, w, unit * 0.014, 0, 0, 6.283);
      g.fill();
    }
  } else if (kind === 'sign') {
    g.lineWidth = unit * 0.007;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x, base - unit * 0.08);
    g.stroke();
    poly(
      g,
      [
        [x, base - unit * 0.075],
        [x + unit * 0.05, base - unit * 0.082],
        [x + unit * 0.058, base - unit * 0.066],
        [x, base - unit * 0.06],
      ],
      '#3a281e',
    );
  } else if (kind === 'lamp') {
    g.lineWidth = unit * 0.006;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x, base - unit * 0.12);
    g.quadraticCurveTo(x, base - unit * 0.14, x + unit * 0.02, base - unit * 0.14);
    g.stroke();
    glow(x + unit * 0.02, base - unit * 0.125, unit * 0.09, '255,214,140');
  } else if (kind === 'flag') {
    g.lineWidth = unit * 0.005;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x, base - unit * 0.16);
    g.stroke();
    poly(
      g,
      [
        [x, base - unit * 0.16],
        [x + unit * 0.07, base - unit * 0.145],
        [x, base - unit * 0.12],
      ],
      '#b8554a',
    );
  } else if (kind === 'crystal') {
    for (let i = 0; i < 4; i++) {
      const cx = x + (i - 1.5) * unit * 0.014;
      const h = unit * (0.04 + r() * 0.05);
      poly(
        g,
        [
          [cx - unit * 0.007, base],
          [cx, base - h],
          [cx + unit * 0.007, base],
        ],
        'rgba(140,224,236,0.95)',
      );
    }
    glow(x, base - unit * 0.03, unit * 0.1, '120,220,240');
  } else if (kind === 'torch') {
    g.lineWidth = unit * 0.006;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x, base - unit * 0.1);
    g.stroke();
    glow(x, base - unit * 0.11, unit * 0.1, '255,190,100');
  } else {
    // The gate: two stone posts and a glowing arch beyond.
    g.fillStyle = '#2a2640';
    g.fillRect(x - unit * 0.07, base - unit * 0.2, unit * 0.025, unit * 0.2);
    g.fillRect(x + unit * 0.045, base - unit * 0.2, unit * 0.025, unit * 0.2);
    g.fillStyle = 'rgba(255,196,110,0.9)';
    g.beginPath();
    g.moveTo(x - unit * 0.045, base);
    g.lineTo(x - unit * 0.045, base - unit * 0.12);
    g.arc(x, base - unit * 0.12, unit * 0.045, Math.PI, 0);
    g.lineTo(x + unit * 0.045, base);
    g.fill();
    glow(x, base - unit * 0.08, unit * 0.2, '255,200,120');
  }
  g.restore();
}

/** Paints one layer of a land onto a canvas of the layer's own size (`unit` is the screen's width in pixels, to scale detail by). */
export function paintLandLayer(land: LandId, layer: LandLayer, g: Ctx, W: number, H: number, unit: number): void {
  const s = LANDS[land];
  const r = rng(land.length * 97 + layer.length * 31 + 5);
  g.save();
  g.clearRect(0, 0, W, H);

  if (layer === 'sky') {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, s.sky.top);
    sky.addColorStop(0.55, s.sky.mid);
    sky.addColorStop(1, s.sky.low);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const [sx, sy, sc] = s.sky.sun;
    const sun = g.createRadialGradient(W * sx, H * sy, 0, W * sx, H * sy, W * 0.45);
    sun.addColorStop(0, sc);
    sun.addColorStop(0.14, 'rgba(255,240,200,0.55)');
    sun.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    blur(g, unit / 150);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.16})`;
      g.beginPath();
      g.ellipse(r() * W, H * (0.05 + r() * 0.3), unit * (0.05 + r() * 0.12), H * 0.012, 0, 0, 6.283);
      g.fill();
    }
    blur(g, 0);
  }

  if (layer === 'far') {
    for (let k = 0; k < 3; k++) {
      const t = k / 2;
      const ridge = ridgeFn(800 + k * 13 + land.length, 5);
      const base = H * (0.6 + t * 0.1);
      const amp = H * (0.22 - t * 0.05);
      blur(g, (1 - t) * 2.4);
      g.beginPath();
      g.moveTo(0, H);
      for (let i = 0; i <= 120; i++) {
        const x = i / 120;
        const peak = 1 - Math.abs(ridge(x));
        const hgt =
          s.far.kind === 'hills'
            ? 0.25 + ridge(x) * 0.25
            : s.far.kind === 'cloud' || s.far.kind === 'peaks'
              ? peak * peak * peak
              : 0.5 + ridge(x) * 0.3;
        g.lineTo(x * W, base - hgt * amp);
      }
      g.lineTo(W, H);
      g.closePath();
      g.fillStyle = mix([...s.far.far], [...s.far.near], t);
      g.fill();
      blur(g, 0);
      const haze = g.createLinearGradient(0, base - amp * 0.4, 0, base + H * 0.1);
      haze.addColorStop(0, `rgba(${s.far.haze},0)`);
      haze.addColorStop(1, `rgba(${s.far.haze},${0.55 - t * 0.28})`);
      g.fillStyle = haze;
      g.fillRect(0, base - amp * 0.4, W, H * 0.4);
    }
  }

  if (layer === 'mid') {
    const body = [...s.mid.body];
    const lit = [...s.mid.lit];
    if (s.mid.kind === 'peaks' || s.mid.kind === 'ridge') {
      for (let k = 0; k < 2; k++) {
        const ridge = ridgeFn(300 + k * 19 + land.length, 6);
        const base = H * (0.7 + k * 0.12);
        const amp = H * (0.5 - k * 0.12);
        g.beginPath();
        g.moveTo(0, H);
        for (let i = 0; i <= 160; i++) {
          const x = i / 160;
          const peak = 1 - Math.abs(ridge(x));
          g.lineTo(x * W, base - peak * peak * amp);
        }
        g.lineTo(W, H);
        g.closePath();
        const gr = g.createLinearGradient(0, base - amp, 0, H);
        gr.addColorStop(0, mix(lit, body, 0.35 + k * 0.2));
        gr.addColorStop(1, mix(body, body, 1));
        g.fillStyle = gr;
        g.fill();
        g.save();
        g.clip();
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = `rgba(${r() < 0.5 ? '255,244,220' : '10,14,16'},${0.05 + r() * 0.1})`;
          g.lineWidth = 1 + r() * 3;
          const x = r() * W;
          g.beginPath();
          g.moveTo(x, base - amp * r());
          g.lineTo(x + (r() - 0.4) * 60, base + amp * 0.2);
          g.stroke();
        }
        g.restore();
        const haze = g.createLinearGradient(0, base - amp, 0, base + H * 0.1);
        haze.addColorStop(0, `rgba(${s.far.haze},0)`); // starts clear, so the top of the mist has no edge
        haze.addColorStop(0.35, `rgba(${s.far.haze},0.42)`);
        haze.addColorStop(1, `rgba(${s.far.haze},0.05)`);
        g.fillStyle = haze;
        g.fillRect(0, base - amp, W, amp + H * 0.2);
      }
    } else if (s.mid.kind === 'cave') {
      // The back wall of the cavern, streaked; stalactites hanging from the roof; a waterfall into the pool.
      const wall = g.createLinearGradient(0, 0, 0, H);
      wall.addColorStop(0, '#16222e');
      wall.addColorStop(0.7, '#2e4658');
      wall.addColorStop(1, '#1c2c38');
      g.fillStyle = wall;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 900; i++) {
        const x = r() * W;
        const y = r() * H * 0.8;
        g.strokeStyle = `rgba(${r() < 0.5 ? '10,18,26' : '150,180,200'},${0.04 + r() * 0.1})`;
        g.lineWidth = 1 + r() * 4;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 24, y + 20 + r() * 100);
        g.stroke();
      }
      for (let i = 0; i < 26; i++) {
        const x = r() * W;
        const h = H * (0.05 + r() * 0.16);
        poly(
          g,
          [
            [x - unit * 0.02, 0],
            [x, h],
            [x + unit * 0.02, 0],
          ],
          '#101a24',
        );
      }
      // The pool and the waterfall.
      const poolTop = H * 0.74;
      const pool = g.createLinearGradient(0, poolTop, 0, H);
      pool.addColorStop(0, '#2f7f95');
      pool.addColorStop(1, '#0c3a50');
      g.fillStyle = pool;
      g.fillRect(0, poolTop, W, H - poolTop);
      const fx = W * 0.5;
      blur(g, 1.2);
      for (let i = 0; i < 120; i++) {
        const x = fx + (r() - 0.5) * unit * 0.2;
        g.strokeStyle = `rgba(${220 + r() * 35},${240 + r() * 15},255,${0.2 + r() * 0.4})`;
        g.lineWidth = 1 + r() * 4;
        g.beginPath();
        g.moveTo(x, H * 0.02);
        g.lineTo(x + (r() - 0.5) * 12, poolTop);
        g.stroke();
      }
      blur(g, unit / 80);
      g.fillStyle = 'rgba(235,248,255,0.7)';
      g.beginPath();
      g.ellipse(fx, poolTop, unit * 0.14, H * 0.025, 0, 0, 6.283);
      g.fill();
      blur(g, 0);
      const gap = g.createRadialGradient(W * 0.45, -H * 0.05, 0, W * 0.45, -H * 0.05, W * 0.4);
      gap.addColorStop(0, 'rgba(236,250,255,0.85)');
      gap.addColorStop(1, 'rgba(120,180,210,0)');
      g.fillStyle = gap;
      g.fillRect(0, 0, W, H * 0.7);
    } else {
      // The castle on its hill, seen from afar, with windows lit.
      const hill = ridgeFn(62, 3);
      g.fillStyle = mix(body, lit, 0.15);
      g.beginPath();
      g.moveTo(W * 0.2, H);
      for (let i = 0; i <= 60; i++) {
        const x = 0.25 + (i / 60) * 0.55;
        g.lineTo(x * W, H * 0.62 + (1 - Math.sin(((x - 0.25) / 0.55) * Math.PI)) * H * 0.16 + hill(x) * H * 0.01);
      }
      g.lineTo(W * 0.85, H);
      g.fill();
      const stone = mix(body, body, 1);
      const towers = [
        { x: 0.42, w: 0.04, top: 0.36 },
        { x: 0.49, w: 0.06, top: 0.26 },
        { x: 0.57, w: 0.04, top: 0.34 },
        { x: 0.63, w: 0.035, top: 0.42 },
      ];
      g.fillStyle = stone;
      g.fillRect(W * 0.4, H * 0.5, W * 0.28, H * 0.14);
      for (const t of towers) {
        g.fillStyle = stone;
        g.fillRect(W * t.x, H * t.top, W * t.w, H * 0.64 - H * t.top);
        poly(
          g,
          [
            [W * (t.x - 0.005), H * t.top],
            [W * (t.x + t.w * 0.5), H * (t.top - 0.08)],
            [W * (t.x + t.w + 0.005), H * t.top],
          ],
          mix(body, lit, 0.2),
        );
        for (let k = 0; k < 3; k++) {
          g.fillStyle = r() < 0.7 ? 'rgba(255,208,120,0.95)' : 'rgba(20,18,40,0.9)';
          g.fillRect(W * (t.x + t.w * 0.38), H * (t.top + 0.03 + k * 0.05), W * t.w * 0.22, H * 0.022);
        }
      }
    }
  }

  if (layer === 'path') {
    const pts = s.path.map(([x, y]) => [x * W, y * H] as [number, number]);
    const face = g.createLinearGradient(0, H * 0.5, 0, H);
    face.addColorStop(0, s.ground.top);
    face.addColorStop(1, s.ground.bottom);
    g.fillStyle = face;
    g.beginPath();
    g.moveTo(pts[0][0], H);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineTo(pts[pts.length - 1][0], H);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.05 + r() * 0.12})` : `rgba(255,244,222,${0.04 + r() * 0.1})`;
      g.fillRect(r() * W, H * 0.5 + r() * H * 0.5, 1 + r() * 4, 1 + r() * 2);
    }
    if (s.ground.seams) {
      for (let row = 0; row < 14; row++) {
        const y = H * 0.55 + row * H * 0.034;
        g.strokeStyle = 'rgba(10,8,24,0.32)';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
        let x = r() * unit * 0.1;
        while (x < W) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + H * 0.034);
          g.stroke();
          x += unit * (0.06 + r() * 0.08);
        }
      }
    }
    for (let i = 1; i < pts.length; i++) {
      const top = Math.min(pts[i - 1][1], pts[i][1]);
      const under = g.createLinearGradient(0, top, 0, top + H * 0.07);
      under.addColorStop(0, 'rgba(10,6,12,0.45)');
      under.addColorStop(1, 'rgba(10,6,12,0)');
      g.fillStyle = under;
      g.fillRect(pts[i - 1][0], top, pts[i][0] - pts[i - 1][0], H * 0.07);
    }
    g.restore();
    // The lit top of the path.
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,244,214,0.8)';
    g.lineWidth = unit * 0.004;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1] - unit * 0.003);
    for (const p of pts) g.lineTo(p[0], p[1] - unit * 0.003);
    g.stroke();
    // Tufts and stones along it.
    const along = (f: number) => {
      const seg = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
      const k = f * (pts.length - 1) - seg;
      return [
        pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * k,
        pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * k,
      ] as const;
    };
    if (s.ground.tufts !== 'none') {
      const palette = { grass: [150, 168, 80], dry: [190, 170, 100], moss: [80, 150, 110] }[s.ground.tufts];
      for (let i = 0; i < 280; i++) {
        const [x, y] = along(r());
        const len = unit * (0.006 + r() * 0.014);
        g.strokeStyle = `rgba(${palette[0] + r() * 40},${palette[1] + r() * 40},${palette[2] + r() * 30},${0.6 + r() * 0.4})`;
        g.lineWidth = 1 + r() * 1.6;
        g.beginPath();
        g.moveTo(x, y - unit * 0.003);
        g.quadraticCurveTo(x + len * 0.3, y - len, x + len * 0.9, y - len * 0.85);
        g.stroke();
      }
    }
    for (let i = 0; i < 40; i++) {
      const [x, y] = along(r());
      const sz = unit * (0.004 + r() * 0.01);
      g.fillStyle = `rgb(${110 + r() * 50},${104 + r() * 40},${96 + r() * 30})`;
      g.beginPath();
      g.ellipse(x, y - sz * 0.4, sz, sz * 0.62, 0, 0, 6.283);
      g.fill();
    }
    const at = { x: 0, y: 0 };
    for (const lm of s.landmarks) {
      landPathPoint(land, lm.at, W, H, at);
      drawLandmark(g, lm.kind, at.x, at.y, unit, r);
    }
  }

  if (layer === 'near') {
    blur(g, unit / 90);
    for (let i = 0; i < 70; i++) {
      const x = r() * W;
      g.strokeStyle = `rgba(${s.near.grass[0] + r() * 40},${s.near.grass[1] + r() * 40},${s.near.grass[2]},${0.5 + r() * 0.4})`;
      g.lineWidth = unit * (0.004 + r() * 0.01);
      g.beginPath();
      g.moveTo(x, H);
      g.quadraticCurveTo(x + 10, H * (0.9 - r() * 0.1), x + unit * (0.02 + r() * 0.05), H * (0.8 - r() * 0.1));
      g.stroke();
    }
    if (s.near.rocks) {
      blur(g, unit / 120);
      rockMass(g, r, { x0: W * 0.2, y0: H * 0.72, x1: W * 0.28, y1: H * 1.05 }, [14, 12, 20], [90, 76, 84], 1, 4);
      rockMass(g, r, { x0: W * 0.7, y0: H * 0.8, x1: W * 0.82, y1: H * 1.05 }, [14, 12, 20], [90, 76, 84], 1, 4);
    }
    blur(g, 0);
  }
  g.restore();
}
