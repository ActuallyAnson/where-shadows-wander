// Two painted vistas, drawn in code: misty mountains with a rocky pass, and a cavern with a pool and a waterfall. They are made to
// be looked at from the room (the edges of the stage, the cinematic scenes), not to sit behind the shadows: they are rich and dark where
// the paper scenery is pale. Each fills a canvas of any size with a 16:9 picture. Plain 2D canvas, no three.js; a fixed seed makes the
// same picture every time.

type Ctx = CanvasRenderingContext2D;

/** The parts a vista is cut into, to be drawn at different depths and moved on their own (paint with `only` to get one). */
export type LayerName = 'sky' | 'far' | 'near' | 'mid' | 'water' | 'front' | 'frame';
// ('frame' is the rock that frames the picture at its edges: it stays where it is on screen while the land moves.)

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth ridge line: layered sines with random phases, from `x` in 0..1, a value in about -1..1. */
export function ridgeFn(seed: number, octaves = 5): (x: number) => number {
  const r = rng(seed);
  const parts = Array.from({ length: octaves }, (_, i) => ({
    f: 2 ** i * (1.3 + r()),
    p: r() * 6.283,
    a: 1 / 1.7 ** i,
  }));
  const total = parts.reduce((s, q) => s + q.a, 0);
  return (x) => parts.reduce((s, q) => s + Math.sin(x * q.f * 6.283 + q.p) * q.a, 0) / total;
}

export function mix(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function poly(g: Ctx, pts: readonly (readonly [number, number])[], fill: string | CanvasGradient): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

export function blur(g: Ctx, px: number): void {
  if ('filter' in g) g.filter = px > 0 ? `blur(${px}px)` : 'none';
}

/** A jagged rock mass: a polygon whose edge is rough, cut into facets that catch the light on one side. */
export function rockMass(
  g: Ctx,
  r: () => number,
  box: { x0: number; y0: number; x1: number; y1: number },
  dark: number[],
  lit: number[],
  lightFrom: 1 | -1,
  facets: number,
  /** Which edge faces the middle of the picture: it gets a broken outline, as a cliff has (otherwise the mass stays a block). */
  inner?: 'left' | 'right',
): void {
  const { x0, y0, x1, y1 } = box;
  const w = x1 - x0;
  const h = y1 - y0;
  g.save();
  const outline: [number, number][] = [];
  if (inner) {
    const edge = ridgeFn(Math.floor(x0 * 7 + y0 * 13 + facets) + 5, 6);
    const top = ridgeFn(Math.floor(x1 * 3 + y1) + 11, 5);
    g.beginPath();
    const steps = 40;
    const ix = (y: number) =>
      (inner === 'right' ? x1 : x0) + (inner === 'right' ? 1 : -1) * (edge(y) * 0.5 - 0.1) * w * 0.55;
    g.moveTo(inner === 'right' ? x0 - w : x1 + w, y0 - h * 0.2);
    // Along the top, a ragged crest.
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const x = inner === 'right' ? x0 + f * w : x1 - f * w;
      g.lineTo(x, y0 + (top(f) * 0.5 + 0.2) * h * 0.14);
    }
    // Down the inner side, a broken cliff face.
    for (let i = 0; i <= steps; i++) {
      const y = y0 + (i / steps) * (y1 - y0 + h * 0.1);
      const ox = ix((y - y0) / h);
      outline.push([ox, y]);
      g.lineTo(ox, y);
    }
    g.lineTo(inner === 'right' ? x0 - w : x1 + w, y1 + h * 0.2);
    g.closePath();
    g.clip();
  }
  // Scatter points across the mass and join neighbours into triangles by columns and rows (a loose mesh).
  const cols = facets;
  const rows = Math.max(2, Math.round((facets * h) / w));
  const pts: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    pts.push([]);
    for (let i = 0; i <= cols; i++) {
      pts[j].push([
        x0 + (i / cols) * w + (r() - 0.5) * (w / cols) * 0.8,
        y0 + (j / rows) * h + (r() - 0.5) * (h / rows) * 0.8,
      ]);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = pts[j][i],
        b = pts[j][i + 1],
        c = pts[j + 1][i],
        d = pts[j + 1][i + 1];
      // Facets facing the light are brighter; the lean runs from the lit edge to the far one.
      const across = lightFrom === 1 ? 1 - (i + 0.5) / cols : (i + 0.5) / cols;
      for (const tri of [
        [a, b, c],
        [b, d, c],
      ] as const) {
        const tone = Math.min(1, Math.max(0, across * 0.55 + r() * 0.5 - 0.1));
        poly(g, tri as unknown as [number, number][], mix(dark, lit, tone * tone));
      }
    }
  }
  // Soft light over the facets: brighter on the side the light comes from, darker low down where the rock is in its own shade.
  const shade = g.createLinearGradient(lightFrom === 1 ? x1 : x0, y0, lightFrom === 1 ? x0 : x1, y1);
  shade.addColorStop(0, 'rgba(255,236,200,0.16)');
  shade.addColorStop(0.5, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = shade;
  g.fillRect(x0 - w, y0 - h, w * 3, h * 3);
  // Grit: specks and cracks over the facets, so the surface is not smooth flat colour.
  const specks = Math.round((w * h) / 90);
  for (let i = 0; i < specks; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${0.06 + r() * 0.16})` : `rgba(255,250,235,${0.03 + r() * 0.1})`;
    const s = 0.8 + r() * 2.4;
    g.fillRect(x0 + r() * w, y0 + r() * h, s * (1 + r() * 2), s);
  }
  for (let i = 0; i < (w > 160 ? Math.round(w / 12) : 0); i++) {
    g.strokeStyle = `rgba(0,0,0,${0.12 + r() * 0.2})`;
    g.lineWidth = 0.7 + r() * 1.3;
    g.beginPath();
    const cx = x0 + r() * w;
    const cy = y0 + r() * h;
    g.moveTo(cx, cy);
    g.lineTo(cx + (r() - 0.5) * 50, cy + 10 + r() * 60);
    g.stroke();
  }
  // A thin lit edge along the broken face that looks toward the light.
  if (outline.length > 1) {
    g.strokeStyle = 'rgba(255,238,206,0.42)';
    g.lineWidth = Math.max(1.5, w / 160);
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(outline[0][0], outline[0][1]);
    for (const [ox, oy] of outline) g.lineTo(ox, oy);
    g.stroke();
  }
  g.restore();
}

/** Misty mountains and a rocky pass in soft sun. */
export function paintMountains(g: Ctx, W: number, H: number): void {
  const r = rng(4242);
  g.save();
  g.clearRect(0, 0, W, H);

  // Sky: cool above, warm and pale at the horizon, with the sun a little right of centre behind haze.
  const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#7ea6cf');
  sky.addColorStop(0.55, '#b9d0e2');
  sky.addColorStop(1, '#eceadb');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.56, H * 0.26, 0, W * 0.56, H * 0.26, W * 0.42);
  sun.addColorStop(0, 'rgba(255,252,236,0.95)');
  sun.addColorStop(0.18, 'rgba(255,244,214,0.55)');
  sun.addColorStop(1, 'rgba(255,244,214,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);

  // Soft clouds.
  blur(g, W / 120);
  for (let i = 0; i < 9; i++) {
    const cx = r() * W;
    const cy = H * (0.06 + r() * 0.26);
    g.fillStyle = `rgba(255,255,255,${0.18 + r() * 0.2})`;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.ellipse(
        cx + (r() - 0.5) * W * 0.14,
        cy + (r() - 0.5) * H * 0.03,
        W * (0.05 + r() * 0.06),
        H * (0.018 + r() * 0.02),
        0,
        0,
        6.283,
      );
      g.fill();
    }
  }
  blur(g, 0);

  // Ranges from far to near: paler, bluer and softer far away. A band of haze lies over the foot of each.
  const far = [168, 188, 205];
  const near = [66, 82, 74];
  const ranges = 5;
  for (let k = 0; k < ranges; k++) {
    const t = k / (ranges - 1);
    const ridge = ridgeFn(100 + k * 17, 6);
    const base = H * (0.34 + t * 0.2);
    const amp = H * (0.2 - t * 0.06);
    blur(g, (1 - t) * (W / 400) * 2);
    g.beginPath();
    g.moveTo(0, H);
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;
      // Sharper peaks: the absolute value of the ridge, so it comes to points and valleys.
      const peak = 1 - Math.abs(ridge(x));
      g.lineTo(x * W, base - peak * peak * amp);
    }
    g.lineTo(W, H);
    g.closePath();
    const body = g.createLinearGradient(0, base - amp, 0, base + H * 0.1);
    body.addColorStop(0, mix(far, near, t));
    body.addColorStop(1, mix(far, near, Math.min(1, t + 0.15)));
    g.fillStyle = body;
    g.fill();
    blur(g, 0);
    // Sun-side lighter streaks down the slopes.
    g.globalAlpha = 0.12 + 0.1 * (1 - t);
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      g.strokeStyle = 'rgba(255,248,226,1)';
      g.lineWidth = 1 + r() * 3;
      g.beginPath();
      g.moveTo(x, base - amp * 0.55 * r());
      g.lineTo(x + (r() - 0.3) * 40, base + amp * 0.1);
      g.stroke();
    }
    g.globalAlpha = 1;
    const haze = g.createLinearGradient(0, base - amp * 0.2, 0, base + H * 0.09);
    haze.addColorStop(0, 'rgba(236,234,219,0)');
    haze.addColorStop(1, `rgba(236,234,219,${0.5 - t * 0.25})`);
    g.fillStyle = haze;
    g.fillRect(0, base - amp * 0.2, W, H * 0.3);
  }

  // The floor of the pass: dusty earth, lighter toward the middle, with grit.
  const groundTop = H * 0.62;
  const ground = g.createLinearGradient(0, groundTop, 0, H);
  ground.addColorStop(0, '#9a8c74');
  ground.addColorStop(0.5, '#6e6454');
  ground.addColorStop(1, '#3d372f');
  g.fillStyle = ground;
  g.beginPath();
  g.moveTo(0, groundTop + H * 0.04);
  const floor = ridgeFn(77, 4);
  for (let i = 0; i <= 80; i++) g.lineTo((i / 80) * W, groundTop + floor(i / 80) * H * 0.012);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  for (let i = 0; i < 2600; i++) {
    const y = groundTop + r() ** 0.7 * (H - groundTop);
    const s = 0.6 + ((y - groundTop) / (H - groundTop)) * 3;
    g.fillStyle = `rgba(${r() < 0.5 ? '30,26,20' : '210,196,168'},${0.08 + r() * 0.18})`;
    g.fillRect(r() * W, y, s * (1 + r() * 2), s);
  }
  // Boulders on the floor, small far away and larger near.
  for (let i = 0; i < 46; i++) {
    const y = groundTop + r() ** 1.4 * (H - groundTop) * 0.92;
    const s = (0.012 + ((y - groundTop) / (H - groundTop)) * 0.06) * W * (0.5 + r());
    const x = r() * W;
    if (x > W * 0.3 && x < W * 0.7 && r() < 0.6) continue;
    rockMass(g, r, { x0: x - s, y0: y - s * 0.7, x1: x + s, y1: y + s * 0.15 }, [40, 42, 42], [140, 138, 126], 1, 3);
  }

  // The great rock walls at the sides, dark, faceted and rim-lit on the edge that faces the sun.
  rockMass(
    g,
    r,
    { x0: -W * 0.05, y0: H * 0.02, x1: W * 0.3, y1: H * 0.95 },
    [20, 22, 24],
    [92, 92, 84],
    -1,
    9,
    'right',
  );
  rockMass(
    g,
    r,
    { x0: W * 0.74, y0: H * 0.14, x1: W * 1.05, y1: H * 0.98 },
    [22, 24, 26],
    [110, 108, 98],
    1,
    9,
    'left',
  );
  rockMass(g, r, { x0: W * 0.78, y0: H * 0.52, x1: W * 1.02, y1: H * 1.02 }, [16, 18, 20], [84, 84, 78], 1, 5, 'left');
  // Grass and moss clinging to the near rock, a green tuft here and there.
  for (let i = 0; i < 70; i++) {
    const left = r() < 0.5;
    const x = left ? r() * W * 0.28 : W * (0.76 + r() * 0.24);
    const y = H * (0.3 + r() * 0.65);
    g.fillStyle = `rgba(${70 + r() * 40},${96 + r() * 50},${52},${0.25 + r() * 0.3})`;
    g.beginPath();
    g.ellipse(x, y, 4 + r() * 16, 2 + r() * 6, 0, 0, 6.283);
    g.fill();
  }

  // Light shafts down from the sun, added over everything.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const x = W * (0.42 + r() * 0.3);
    const wid = W * (0.03 + r() * 0.06);
    const shaft = g.createLinearGradient(x, 0, x + W * 0.1, H * 0.8);
    shaft.addColorStop(0, 'rgba(255,240,200,0.16)');
    shaft.addColorStop(1, 'rgba(255,240,200,0)');
    poly(
      g,
      [
        [x, 0],
        [x + wid, 0],
        [x + wid + W * 0.2, H * 0.85],
        [x + W * 0.1, H * 0.85],
      ],
      shaft,
    );
  }
  // Motes of dust in the air.
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(255,248,226,${0.1 + r() * 0.4})`;
    g.beginPath();
    g.arc(r() * W, r() * H * 0.9, 0.6 + r() * 1.8, 0, 6.283);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  // A soft vignette, so the eye goes to the middle.
  const vig = g.createRadialGradient(W / 2, H * 0.52, H * 0.35, W / 2, H * 0.52, W * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(8,10,14,0.5)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** A cavern: a waterfall into a pool, light from a gap above, pale stones in the front. */
export function paintCavern(g: Ctx, W: number, H: number): void {
  const r = rng(9001);
  g.save();
  g.clearRect(0, 0, W, H);

  // The back wall: cold stone, streaked, darker toward the corners.
  const wall = g.createLinearGradient(0, 0, 0, H * 0.55);
  wall.addColorStop(0, '#2a3b4c');
  wall.addColorStop(1, '#53697b');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) {
    const x = r() * W;
    const y = r() * H * 0.5;
    g.strokeStyle = `rgba(${r() < 0.5 ? '16,24,34' : '150,176,196'},${0.05 + r() * 0.12})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 30, y + 20 + r() * 90);
    g.stroke();
  }
  // The opening above, where the light comes in.
  const gap = g.createRadialGradient(W * 0.42, -H * 0.05, 0, W * 0.42, -H * 0.05, W * 0.55);
  gap.addColorStop(0, 'rgba(236,250,255,0.95)');
  gap.addColorStop(0.3, 'rgba(160,214,236,0.5)');
  gap.addColorStop(1, 'rgba(120,180,210,0)');
  g.fillStyle = gap;
  g.fillRect(0, 0, W, H * 0.7);

  // The waterfall: white strands falling from the lit gap into the pool.
  const fx = W * 0.3;
  const fw = W * 0.12;
  blur(g, 1.2);
  for (let i = 0; i < 90; i++) {
    const x = fx + (r() - 0.5) * fw;
    g.strokeStyle = `rgba(${220 + r() * 35},${240 + r() * 15},255,${0.18 + r() * 0.4})`;
    g.lineWidth = 1 + r() * 4;
    g.beginPath();
    g.moveTo(x + (r() - 0.5) * 8, H * 0.02);
    g.lineTo(x + (r() - 0.5) * 14, H * 0.5);
    g.stroke();
  }
  blur(g, 0);

  // The pool: deep teal at the back, pale and bright toward the light; the cavern mirrored in it.
  const poolTop = H * 0.44;
  const poolBottom = H * 0.76;
  const pool = g.createLinearGradient(0, poolTop, 0, poolBottom);
  pool.addColorStop(0, '#2f7f95');
  pool.addColorStop(0.5, '#1f6d86');
  pool.addColorStop(1, '#0e4a62');
  g.fillStyle = pool;
  g.fillRect(0, poolTop, W, poolBottom - poolTop);
  g.save();
  g.beginPath();
  g.rect(0, poolTop, W, poolBottom - poolTop);
  g.clip();
  g.globalAlpha = 0.35;
  g.translate(0, poolTop * 2);
  g.scale(1, -0.55);
  g.translate(0, -poolTop * 0.7);
  blur(g, 3);
  g.fillStyle = wall;
  g.fillRect(0, 0, W, poolTop);
  g.fillStyle = 'rgba(236,250,255,0.5)';
  g.fillRect(fx - fw / 2, 0, fw, poolTop);
  blur(g, 0);
  g.restore();
  // Ripples: thin light lines, longer and brighter near the front.
  for (let i = 0; i < 380; i++) {
    const t = r();
    const y = poolTop + t * (poolBottom - poolTop);
    const len = 8 + t * 90 * r();
    g.strokeStyle = `rgba(210,240,250,${0.05 + t * 0.2 * r()})`;
    g.lineWidth = 0.6 + t * 1.6;
    const x = r() * W;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len / 2, y - 2 * t, x + len, y);
    g.stroke();
  }
  // Foam and mist where the fall meets the pool.
  blur(g, 8);
  g.fillStyle = 'rgba(235,248,255,0.75)';
  g.beginPath();
  g.ellipse(fx, poolTop + H * 0.02, fw * 0.8, H * 0.03, 0, 0, 6.283);
  g.fill();
  g.fillStyle = 'rgba(235,248,255,0.25)';
  g.beginPath();
  g.ellipse(fx, poolTop - H * 0.05, fw * 1.2, H * 0.1, 0, 0, 6.283);
  g.fill();
  blur(g, 0);
  // Sparkles on the water.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 120; i++) {
    const t = r();
    g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`;
    g.beginPath();
    g.arc(r() * W, poolTop + t * (poolBottom - poolTop), 0.6 + r() * 1.6 * (0.4 + t), 0, 6.283);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';

  // The shore: pale, flat-topped stones in a band across the front, and a mossy bank at the very bottom.
  const bank = g.createLinearGradient(0, poolBottom, 0, H);
  bank.addColorStop(0, '#8d8a7c');
  bank.addColorStop(1, '#3f4238');
  g.fillStyle = bank;
  g.fillRect(0, poolBottom, W, H - poolBottom);
  for (let i = 0; i < 34; i++) {
    const y = poolBottom + r() * (H - poolBottom) * 0.8;
    const s = W * (0.02 + r() * 0.05);
    const x = r() * W;
    rockMass(g, r, { x0: x - s, y0: y - s * 0.5, x1: x + s, y1: y + s * 0.2 }, [66, 70, 72], [196, 196, 182], 1, 3);
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(${74 + r() * 30},${108 + r() * 40},${64},${0.25 + r() * 0.3})`;
    g.beginPath();
    g.ellipse(r() * W, H * (0.84 + r() * 0.16), 6 + r() * 26, 2 + r() * 7, 0, 0, 6.283);
    g.fill();
  }

  // The dark walls closing in at both sides.
  rockMass(
    g,
    r,
    { x0: -W * 0.05, y0: -H * 0.02, x1: W * 0.2, y1: H * 0.9 },
    [10, 14, 18],
    [70, 86, 96],
    -1,
    8,
    'right',
  );
  rockMass(
    g,
    r,
    { x0: W * 0.82, y0: -H * 0.02, x1: W * 1.05, y1: H * 0.95 },
    [10, 14, 18],
    [78, 94, 104],
    1,
    8,
    'left',
  );

  // Shafts of light from the gap, and a cool bloom.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = W * (0.3 + r() * 0.2);
    const shaft = g.createLinearGradient(x, 0, x + W * 0.1, H * 0.7);
    shaft.addColorStop(0, 'rgba(200,236,255,0.18)');
    shaft.addColorStop(1, 'rgba(200,236,255,0)');
    poly(
      g,
      [
        [x, 0],
        [x + W * 0.06, 0],
        [x + W * 0.2, H * 0.75],
        [x + W * 0.05, H * 0.75],
      ],
      shaft,
    );
  }
  g.globalCompositeOperation = 'source-over';
  const vig = g.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, W * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4,8,12,0.55)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** A windswept highland at golden hour: a sea of cloud below, ridges standing out of it, a grassy edge bent in the wind. */
export function paintHighlands(g: Ctx, W: number, H: number, only?: LayerName): void {
  const on = (n: LayerName) => !only || only === n;
  const r = rng(31337);
  g.save();
  g.clearRect(0, 0, W, H);
  if (on('sky')) {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#5b6fa8');
    sky.addColorStop(0.45, '#c79bb0');
    sky.addColorStop(0.8, '#f2c79a');
    sky.addColorStop(1, '#f8dfb4');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(W * 0.3, H * 0.5, 0, W * 0.3, H * 0.5, W * 0.5);
    sun.addColorStop(0, 'rgba(255,236,190,1)');
    sun.addColorStop(0.12, 'rgba(255,214,150,0.7)');
    sun.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    // High streaks of cloud, stretched by the wind.
    blur(g, W / 160);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(255,236,230,${0.1 + r() * 0.2})`;
      g.beginPath();
      g.ellipse(r() * W, H * (0.05 + r() * 0.3), W * (0.08 + r() * 0.16), H * (0.006 + r() * 0.012), -0.04, 0, 6.283);
      g.fill();
    }
    blur(g, 0);
  }
  // Ridges standing out of a sea of cloud: far ones violet, near ones deep blue-green; a bank of cloud in front of each.
  const far = [176, 150, 178];
  const near = [58, 70, 96];
  for (let k = 0; k < 4; k++) {
    if (!on(k < 2 ? 'far' : 'near')) continue;
    const t = k / 3;
    const ridge = ridgeFn(500 + k * 31, 5);
    const base = H * (0.5 + t * 0.12);
    const amp = H * (0.2 - t * 0.04);
    blur(g, (1 - t) * (W / 500) * 2);
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i <= 140; i++) {
      const x = i / 140;
      const peak = 1 - Math.abs(ridge(x));
      g.lineTo(x * W, base - peak * peak * peak * amp);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = mix(far, near, t);
    g.fill();
    blur(g, 0);
    blur(g, W / 120);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(255,232,214,${0.35 - t * 0.12})`;
      g.beginPath();
      g.ellipse(
        r() * W,
        base + H * 0.03 + r() * H * 0.04,
        W * (0.07 + r() * 0.12),
        H * (0.02 + r() * 0.03),
        0,
        0,
        6.283,
      );
      g.fill();
    }
    blur(g, 0);
  }
  if (on('front')) {
    // The grassy edge in the front, a cliff top with wind-bent tufts and rocks, and a lean tree.
    const edge = ridgeFn(88, 4);
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i <= 80; i++) g.lineTo((i / 80) * W, H * 0.78 + edge(i / 80) * H * 0.04 + (i / 80) * H * 0.06);
    g.lineTo(W, H);
    g.closePath();
    const grass = g.createLinearGradient(0, H * 0.7, 0, H);
    grass.addColorStop(0, '#5f6b3e');
    grass.addColorStop(1, '#232a1a');
    g.fillStyle = grass;
    g.fill();
    for (let i = 0; i < 1400; i++) {
      const x = r() * W;
      const y = H * (0.8 + r() * 0.2);
      const len = 8 + r() * 22;
      g.strokeStyle = `rgba(${150 + r() * 70},${160 + r() * 60},${80 + r() * 40},${0.3 + r() * 0.4})`;
      g.lineWidth = 1 + r() * 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len * 0.3, y - len * 0.8, x + len * 0.9, y - len * 0.7); // bent downwind, to the right
      g.stroke();
    }
    // A lone tree leaning with the wind, in silhouette against the glow.
    g.strokeStyle = '#1b1a22';
    g.lineCap = 'round';
    g.lineWidth = W * 0.008;
    g.beginPath();
    g.moveTo(W * 0.78, H * 0.8);
    g.quadraticCurveTo(W * 0.78, H * 0.62, W * 0.83, H * 0.55);
    g.stroke();
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(28,26,36,${0.7 + r() * 0.3})`;
      g.beginPath();
      g.ellipse(
        W * (0.82 + (r() - 0.3) * 0.08),
        H * (0.55 + (r() - 0.5) * 0.06),
        5 + r() * 12,
        2 + r() * 5,
        -0.3,
        0,
        6.283,
      );
      g.fill();
    }
  }
  if (on('frame')) {
    rockMass(
      g,
      r,
      { x0: -W * 0.04, y0: H * 0.7, x1: W * 0.2, y1: H * 1.02 },
      [26, 28, 34],
      [150, 124, 120],
      1,
      6,
      'right',
    );
    rockMass(
      g,
      r,
      { x0: W * 0.86, y0: H * 0.76, x1: W * 1.04, y1: H * 1.02 },
      [26, 28, 34],
      [140, 118, 116],
      1,
      5,
      'left',
    );
  }
  if (!only) {
    // Wind: streaks and petals blowing across.
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const y = H * (0.2 + r() * 0.7);
      const x = r() * W;
      g.strokeStyle = `rgba(255,236,214,${0.04 + r() * 0.1})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + 60, y - 8, x + 120, y + 8, x + 180 + r() * 120, y - 4);
      g.stroke();
    }
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,214,180,${0.3 + r() * 0.5})`;
      g.beginPath();
      g.ellipse(r() * W, H * (0.3 + r() * 0.6), 2 + r() * 3, 1 + r() * 1.5, r(), 0, 6.283);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const vig = g.createRadialGradient(W / 2, H * 0.5, H * 0.4, W / 2, H * 0.5, W * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(14,10,22,0.45)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
  }
  g.restore();
}

/** A sandstone canyon: banded cliffs in warm light, ledges climbing in steps, a dusty floor, far mesas in haze. */
export function paintCanyon(g: Ctx, W: number, H: number): void {
  const r = rng(2468);
  g.save();
  g.clearRect(0, 0, W, H);
  const sky = g.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, '#6ea3cc');
  sky.addColorStop(1, '#f1e1c3');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(W * 0.7, H * 0.12, 0, W * 0.7, H * 0.12, W * 0.4);
  sun.addColorStop(0, 'rgba(255,248,220,0.95)');
  sun.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, W, H);
  // Far mesas in haze.
  const bands = [
    [222, 192, 158],
    [206, 160, 124],
    [180, 126, 96],
    [140, 90, 70],
  ];
  for (let k = 0; k < 4; k++) {
    const t = k / 3;
    const ridge = ridgeFn(900 + k * 13, 4);
    const base = H * (0.42 + t * 0.1);
    blur(g, (1 - t) * 3);
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i <= 90; i++) {
      const x = i / 90;
      // Flat-topped: the ridge is cut off into mesas.
      const hgt = Math.min(0.55, Math.max(0, ridge(x) * 0.5 + 0.35));
      g.lineTo(x * W, base - Math.round(hgt * 6) * (H * 0.022));
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = mix(bands[k], bands[Math.min(3, k + 1)], 0.3);
    g.fill();
    blur(g, 0);
    const haze = g.createLinearGradient(0, base - H * 0.05, 0, base + H * 0.08);
    haze.addColorStop(0, 'rgba(244,226,196,0)');
    haze.addColorStop(1, `rgba(244,226,196,${0.5 - t * 0.3})`);
    g.fillStyle = haze;
    g.fillRect(0, base - H * 0.05, W, H * 0.2);
  }
  // The canyon floor.
  const floor = g.createLinearGradient(0, H * 0.62, 0, H);
  floor.addColorStop(0, '#d6b48a');
  floor.addColorStop(1, '#6d4c37');
  g.fillStyle = floor;
  g.fillRect(0, H * 0.62, W, H * 0.38);
  for (let i = 0; i < 2200; i++) {
    const y = H * 0.62 + r() ** 0.8 * H * 0.38;
    g.fillStyle = `rgba(${r() < 0.5 ? '70,44,30' : '240,214,170'},${0.08 + r() * 0.16})`;
    g.fillRect(r() * W, y, 1 + r() * 4, 1 + r() * 2);
  }
  // Stepped ledges climbing across the middle: flat tops, banded faces, lit from the sun side.
  const steps = [
    { x: 0.34, w: 0.16, top: 0.74 },
    { x: 0.5, w: 0.14, top: 0.66 },
    { x: 0.62, w: 0.13, top: 0.58 },
  ];
  for (const s of steps) {
    const x0 = W * s.x;
    const x1 = W * (s.x + s.w);
    const y0 = H * s.top;
    const body = g.createLinearGradient(x0, 0, x1, 0);
    body.addColorStop(0, '#a8663f');
    body.addColorStop(1, '#6c3f2c');
    g.fillStyle = body;
    g.fillRect(x0, y0, x1 - x0, H * 0.82 - y0);
    for (let b = 0; b < 8; b++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,214,170' : '60,30,22'},${0.1 + r() * 0.15})`;
      g.fillRect(x0, y0 + b * ((H * 0.82 - y0) / 8), x1 - x0, 2 + r() * 6);
    }
    g.fillStyle = '#e2b886'; // the lit top
    g.fillRect(x0, y0 - 5, x1 - x0, 8);
  }
  // The great walls on both sides: banded strata in red and ochre, with a broken edge.
  const wall = (x0: number, x1: number, inner: 'left' | 'right', dark: number[], lit: number[]) => {
    rockMass(g, r, { x0, y0: -H * 0.02, x1, y1: H * 1.02 }, dark, lit, inner === 'right' ? -1 : 1, 8, inner);
    // Strata: horizontal bands across the face, clipped to the mass by drawing only inside its box.
    g.save();
    g.beginPath();
    // Only the solid part of the wall (the broken inner edge is left bare, so the bands do not spill into the sky).
    const solid = (x1 - x0) * 0.6;
    const sx0 = inner === 'right' ? Math.max(0, x0) : x1 - solid;
    const sx1 = inner === 'right' ? x0 + solid : Math.min(W, x1);
    g.rect(sx0, 0, sx1 - sx0, H);
    g.clip();
    for (let b = 0; b < 26; b++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,190,130' : '40,16,12'},${0.06 + r() * 0.1})`;
      g.fillRect(sx0, r() * H, sx1 - sx0, 3 + r() * 14);
    }
    g.restore();
  };
  wall(-W * 0.05, W * 0.3, 'right', [58, 26, 20], [214, 130, 82]);
  wall(W * 0.76, W * 1.05, 'left', [54, 24, 20], [226, 150, 96]);
  // Sun shafts and drifting dust over all of it.
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = W * (0.55 + r() * 0.2);
    const shaft = g.createLinearGradient(x, 0, x - W * 0.15, H * 0.8);
    shaft.addColorStop(0, 'rgba(255,236,190,0.16)');
    shaft.addColorStop(1, 'rgba(255,236,190,0)');
    poly(
      g,
      [
        [x, 0],
        [x + W * 0.05, 0],
        [x - W * 0.1, H * 0.8],
        [x - W * 0.2, H * 0.8],
      ],
      shaft,
    );
  }
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255,236,200,${0.1 + r() * 0.35})`;
    g.beginPath();
    g.arc(r() * W, r() * H, 0.6 + r() * 1.6, 0, 6.283);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  const vig = g.createRadialGradient(W / 2, H * 0.5, H * 0.4, W / 2, H * 0.5, W * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(24,10,6,0.45)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** A castle at dusk on a hill, its windows lit, a moat in front holding the reflection, a big moon and stars. */
export function paintCastle(g: Ctx, W: number, H: number, only?: LayerName): void {
  const on = (n: LayerName) => !only || only === n;
  const r = rng(1313);
  const stone = '#1a1830';
  const towers = [
    { x: 0.36, w: 0.05, top: 0.3 },
    { x: 0.44, w: 0.07, top: 0.2 },
    { x: 0.53, w: 0.05, top: 0.28 },
    { x: 0.6, w: 0.045, top: 0.36 },
  ];
  g.save();
  g.clearRect(0, 0, W, H);
  if (on('sky')) {
    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#1a1f4a');
    sky.addColorStop(0.5, '#6a4a86');
    sky.addColorStop(0.85, '#e58f78');
    sky.addColorStop(1, '#f6c58c');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,248,230,${0.2 + r() * 0.7})`;
      g.beginPath();
      g.arc(r() * W, r() * H * 0.4, 0.5 + r() * 1.3, 0, 6.283);
      g.fill();
    }
    const moon = g.createRadialGradient(W * 0.72, H * 0.2, 0, W * 0.72, H * 0.2, W * 0.2);
    moon.addColorStop(0, 'rgba(255,250,232,1)');
    moon.addColorStop(0.2, 'rgba(255,244,214,0.9)');
    moon.addColorStop(0.24, 'rgba(255,230,190,0.35)');
    moon.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = moon;
    g.fillRect(0, 0, W, H);
    blur(g, W / 200);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(255,214,190,${0.12 + r() * 0.14})`;
      g.beginPath();
      g.ellipse(r() * W, H * (0.1 + r() * 0.32), W * (0.06 + r() * 0.1), H * 0.014, 0, 0, 6.283);
      g.fill();
    }
    blur(g, 0);
  }
  if (on('far')) {
    // Far hills, violet, then the castle's hill.
    const hills = ridgeFn(61, 4);
    g.fillStyle = '#4a3a66';
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 0; i <= 90; i++) g.lineTo((i / 90) * W, H * 0.56 + hills(i / 90) * H * 0.05);
    g.lineTo(W, H);
    g.fill();
  }
  if (on('mid')) {
    const hill = ridgeFn(62, 3);
    g.fillStyle = '#24203e';
    g.beginPath();
    g.moveTo(W * 0.15, H);
    for (let i = 0; i <= 60; i++) {
      const x = 0.2 + (i / 60) * 0.6;
      g.lineTo(x * W, H * 0.52 + (1 - Math.sin(((x - 0.2) / 0.6) * Math.PI)) * H * 0.1 + hill(x) * H * 0.01);
    }
    g.lineTo(W * 0.85, H);
    g.fill();
    // The castle: towers of different heights with cones, walls with crenellations, windows lit warm.
    g.fillStyle = stone;
    g.fillRect(W * 0.33, H * 0.42, W * 0.34, H * 0.12); // the curtain wall
    for (let i = 0; i < 34; i++) g.fillRect(W * (0.33 + i * 0.01), H * 0.405, W * 0.006, H * 0.016);
    for (const t of towers) {
      g.fillStyle = stone;
      g.fillRect(W * t.x, H * t.top, W * t.w, H * 0.54 - H * t.top);
      poly(
        g,
        [
          [W * (t.x - 0.006), H * t.top],
          [W * (t.x + t.w * 0.5), H * (t.top - 0.09)],
          [W * (t.x + t.w + 0.006), H * t.top],
        ],
        '#2a2448',
      );
      // Windows, some lit.
      for (let k = 0; k < 3; k++) {
        const lit = r() < 0.7;
        g.fillStyle = lit ? 'rgba(255,208,120,0.95)' : 'rgba(20,18,40,0.9)';
        g.fillRect(W * (t.x + t.w * 0.38), H * (t.top + 0.03 + k * 0.05), W * t.w * 0.22, H * 0.022);
      }
    }
    // The great gate, its arch glowing.
    g.fillStyle = 'rgba(255,196,110,0.9)';
    g.beginPath();
    g.moveTo(W * 0.475, H * 0.54);
    g.lineTo(W * 0.475, H * 0.5);
    g.arc(W * 0.5, H * 0.5, W * 0.025, Math.PI, 0);
    g.lineTo(W * 0.525, H * 0.54);
    g.fill();
  }
  if (on('water')) {
    // The moat: dark water holding the castle's lights and the sky, with a stone bridge across.
    const moatTop = H * 0.66;
    const water = g.createLinearGradient(0, moatTop, 0, H * 0.84);
    water.addColorStop(0, '#6b5a8e');
    water.addColorStop(1, '#171532');
    g.fillStyle = water;
    g.fillRect(0, moatTop, W, H * 0.18);
    g.save();
    g.beginPath();
    g.rect(0, moatTop, W, H * 0.18);
    g.clip();
    g.globalAlpha = 0.5;
    blur(g, 3);
    for (const t of towers) {
      g.fillStyle = '#0f0e22';
      g.fillRect(W * t.x, moatTop + (H * 0.54 - H * t.top) * 0.0 + H * 0.02, W * t.w, H * (0.1 + (0.54 - t.top) * 0.3));
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = 'rgba(255,200,120,0.8)';
      g.fillRect(W * (0.38 + r() * 0.24), moatTop + H * (0.02 + r() * 0.1), 3 + r() * 5, 14 + r() * 26);
    }
    blur(g, 0);
    g.restore();
    for (let i = 0; i < 200; i++) {
      g.strokeStyle = `rgba(230,210,240,${0.04 + r() * 0.12})`;
      g.lineWidth = 1 + r() * 1.4;
      const x = r() * W;
      const y = moatTop + r() * H * 0.18;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 10 + r() * 60, y);
      g.stroke();
    }
    g.fillStyle = '#211d3a';
    g.fillRect(W * 0.46, moatTop - H * 0.02, W * 0.08, H * 0.04); // the bridge
  }
  if (on('front')) {
    // The near bank and dark rocks framing the picture.
    const bank = g.createLinearGradient(0, H * 0.82, 0, H);
    bank.addColorStop(0, '#2b2a3c');
    bank.addColorStop(1, '#0d0c18');
    g.fillStyle = bank;
    g.fillRect(0, H * 0.82, W, H * 0.18);
  }
  if (on('frame')) {
    rockMass(
      g,
      r,
      { x0: -W * 0.05, y0: H * 0.3, x1: W * 0.22, y1: H * 1.02 },
      [10, 10, 20],
      [96, 70, 96],
      1,
      7,
      'right',
    );
    rockMass(
      g,
      r,
      { x0: W * 0.8, y0: H * 0.4, x1: W * 1.05, y1: H * 1.02 },
      [10, 10, 20],
      [110, 80, 100],
      1,
      7,
      'left',
    );
  }
  if (!only) {
    // Fireflies and torch glow.
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const x = r() * W;
      const y = H * (0.45 + r() * 0.5);
      const f = g.createRadialGradient(x, y, 0, x, y, 8 + r() * 10);
      f.addColorStop(0, 'rgba(255,230,150,0.9)');
      f.addColorStop(1, 'rgba(255,200,100,0)');
      g.fillStyle = f;
      g.fillRect(x - 20, y - 20, 40, 40);
    }
    g.globalCompositeOperation = 'source-over';
    const vig = g.createRadialGradient(W / 2, H * 0.5, H * 0.4, W / 2, H * 0.5, W * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(6,4,16,0.5)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
  }
  g.restore();
}
