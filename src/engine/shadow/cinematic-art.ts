// The paintings for the cinematic scenes, drawn in code (no image files): a sky that burns from deep violet to orange, a huge
// glowing sun with a castle's silhouette before it, a dark glossy floor with the sun's light streaking across it, black pillars
// with a rim of light on the side that faces the sun, and a soft particle. Each fills the canvas it is given, once. The scenes
// are lit by one big light and a lot of dark, like a painted film still: a palette picks the sky and the light's colour.

export interface CinematicPalette {
  /** Sky, top to horizon. */
  readonly sky: readonly [string, string, string, string];
  /** The big light: its bright core, its body and its glow (the glow is the colour the floor and the rims take). */
  readonly core: string;
  readonly body: string;
  readonly glow: string;
  /** The floor's dark, and the rim light on silhouettes. */
  readonly floor: string;
  readonly rim: string;
  /** The floating particles. */
  readonly motes: readonly string[];
}

/** A burning dusk: red-violet sky, an orange sun, a violet floor. */
export const DUSK: CinematicPalette = {
  sky: ['#12072e', '#3d1466', '#b01f5c', '#ff7a38'],
  core: '#fff4cc',
  body: '#ffb347',
  glow: '#ff6a3a',
  floor: '#10082a',
  rim: '#ff9a50',
  motes: ['#ff7ad9', '#ffb86b', '#b48cff'],
};

/** A night of gold and green: a hall lit from one crystal. */
export const CRYSTAL: CinematicPalette = {
  sky: ['#04100d', '#0b2a1c', '#1d5a2a', '#9ac22a'],
  core: '#fffbd0',
  body: '#ffd42a',
  glow: '#d8c020',
  floor: '#0a1208',
  rim: '#ffc83a',
  motes: ['#ffe46b', '#c8ff6b', '#ffb347'],
};

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The sky: a vertical gradient (any canvas), with a few faint stars high up. */
export function paintSky(g: CanvasRenderingContext2D, W: number, H: number, p: CinematicPalette): void {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, p.sky[0]);
  grad.addColorStop(0.45, p.sky[1]);
  grad.addColorStop(0.8, p.sky[2]);
  grad.addColorStop(1, p.sky[3]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const r = rng(5);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255, 240, 255, ${0.15 + r() * 0.5})`;
    g.fillRect(r() * W, r() * H * 0.5, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

/** The big light (a square canvas): a white-hot core, a body, and a wide glow; its edge is a little torn, like a sun in haze. */
export function paintSun(g: CanvasRenderingContext2D, W: number, H: number, p: CinematicPalette): void {
  g.clearRect(0, 0, W, H);
  const c = W / 2;
  const glow = g.createRadialGradient(c, c, 0, c, c, c);
  glow.addColorStop(0, p.core);
  glow.addColorStop(0.18, p.body);
  glow.addColorStop(0.3, p.body);
  glow.addColorStop(0.34, p.glow + 'cc');
  glow.addColorStop(0.55, p.glow + '55');
  glow.addColorStop(1, p.glow + '00');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  // the disc: a hard bright edge with a bite taken out (haze or a broken rim)
  const r = rng(11);
  g.fillStyle = p.core;
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rad = c * 0.3 * (1 + (r() - 0.5) * 0.04);
    g.lineTo(c + Math.cos(a) * rad, c + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
  const inner = g.createRadialGradient(c, c, 0, c, c, c * 0.3);
  inner.addColorStop(0, p.core);
  inner.addColorStop(1, p.body);
  g.fillStyle = inner;
  g.beginPath();
  g.arc(c, c, c * 0.3, 0, Math.PI * 2);
  g.fill();
}

/** A castle's silhouette (any canvas, wider than tall): towers, a keep and a gate, near-black, standing on the canvas's bottom edge. */
export function paintCastle(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#0c0418';
  const u = W / 100;
  const rect = (x: number, y: number, w: number, h: number) => g.fillRect(x * u, H - y * u, w * u, y * u - (y - h) * u);
  // curtain wall and gate
  rect(8, 12, 84, 12);
  // towers with pointed roofs
  const tower = (x: number, w: number, h: number) => {
    g.fillRect(x * u, H - h * u, w * u, h * u);
    g.beginPath();
    g.moveTo((x - 0.8) * u, H - h * u);
    g.lineTo((x + w / 2) * u, H - (h + w * 1.3) * u);
    g.lineTo((x + w + 0.8) * u, H - h * u);
    g.closePath();
    g.fill();
  };
  tower(10, 7, 26);
  tower(26, 6, 32);
  tower(44, 12, 44); // the keep
  tower(68, 6, 34);
  tower(83, 7, 28);
  // battlements on the wall
  for (let x = 18; x < 82; x += 4) if (x < 42 || x > 58) g.fillRect(x * u, H - 14.5 * u, 2 * u, 2.5 * u);
  // a gate, and a few lit windows (the only warm thing)
  g.fillStyle = '#ffb347';
  for (const [x, y] of [
    [46.6, 36],
    [51.2, 36],
    [48.8, 26],
    [28.3, 24],
    [70.4, 26],
  ]) {
    g.fillRect(x * u, H - y * u, 1.2 * u, 2.2 * u);
  }
}

/** The floor: dark stone tiles (a tileable square), their edges just catching the light. */
export function paintFloorTile(g: CanvasRenderingContext2D, W: number, H: number, p: CinematicPalette): void {
  const r = rng(23);
  g.fillStyle = p.floor;
  g.fillRect(0, 0, W, H);
  // each tile a little different in tone
  const n = 2;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = r() * 0.5;
      g.fillStyle = `rgba(120, 80, 200, ${0.1 + k * 0.2})`;
      g.fillRect((i * W) / n, (j * H) / n, W / n, H / n);
    }
  }
  g.strokeStyle = p.rim + '66';
  g.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    g.beginPath();
    g.moveTo((i * W) / n, 0);
    g.lineTo((i * W) / n, H);
    g.moveTo(0, (i * H) / n);
    g.lineTo(W, (i * H) / n);
    g.stroke();
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255, 255, 255, ${r() * 0.05})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
  }
}

/** The light's streak on the floor (a tall canvas: the near end at the bottom): a bright column with ripples, fading with distance. */
export function paintStreak(g: CanvasRenderingContext2D, W: number, H: number, p: CinematicPalette): void {
  g.clearRect(0, 0, W, H);
  const r = rng(31);
  for (let y = 0; y < H; y += 3) {
    const t = y / H; // 0 far .. 1 near
    const wave = Math.sin(y * 0.35) * 0.5 + 0.5;
    const width = W * (0.12 + 0.26 * t) * (0.55 + 0.9 * wave * (0.6 + r() * 0.4));
    const a = (0.95 - 0.5 * t) * (0.4 + 0.6 * wave);
    const grad = g.createLinearGradient(W / 2 - width, 0, W / 2 + width, 0);
    grad.addColorStop(0, p.glow + '00');
    grad.addColorStop(
      0.5,
      p.core +
        Math.round(Math.max(0, Math.min(1, a)) * 255)
          .toString(16)
          .padStart(2, '0'),
    );
    grad.addColorStop(1, p.glow + '00');
    g.fillStyle = grad;
    g.fillRect(W / 2 - width, y, width * 2, 3);
  }
}

/** A tall black pillar or rock (any canvas, taller than wide) with a rim of light on its right edge (the side toward the light). */
export function paintPillar(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: CinematicPalette,
  seed: number,
): void {
  g.clearRect(0, 0, W, H);
  const r = rng(seed);
  g.fillStyle = '#080311';
  g.beginPath();
  g.moveTo(W * 0.1, H);
  for (let i = 0; i <= 10; i++) g.lineTo(W * (0.08 + r() * 0.06), H * (1 - i / 10));
  g.lineTo(W * 0.5, 0);
  for (let i = 10; i >= 0; i--) g.lineTo(W * (0.88 - r() * 0.08), H * (1 - i / 10));
  g.lineTo(W * 0.92, H);
  g.closePath();
  g.fill();
  const rim = g.createLinearGradient(W * 0.7, 0, W, 0);
  rim.addColorStop(0, p.rim + '00');
  rim.addColorStop(1, p.rim + 'aa');
  g.fillStyle = rim;
  g.globalCompositeOperation = 'source-atop';
  g.fillRect(W * 0.7, 0, W * 0.3, H);
  g.globalCompositeOperation = 'source-over';
}

/** A soft round glow for particles. */
export function paintMote(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.clearRect(0, 0, W, H);
  const grad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

/** The line of text that floats over a scene (any wide canvas): warm white with a soft glow, centred. */
export function paintCaption(g: CanvasRenderingContext2D, W: number, H: number, text: string): void {
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = Math.round(H * 0.56);
  do {
    g.font = `400 ${size}px 'Cinzel Decorative', Georgia, serif`;
    size -= 4;
  } while (g.measureText(text).width > W * 0.94 && size > 16);
  g.shadowColor = 'rgba(255, 190, 110, 0.9)';
  g.shadowBlur = H * 0.22;
  g.fillStyle = '#fff3dc';
  g.fillText(text, W / 2, H / 2);
  g.shadowBlur = 0;
  g.fillText(text, W / 2, H / 2);
}

/** A great faceted crystal standing on its point (a tall canvas): a bright core, planes of gold, and a glow round it all. */
export function paintCrystal(g: CanvasRenderingContext2D, W: number, H: number, p: CinematicPalette): void {
  g.clearRect(0, 0, W, H);
  const r = rng(61);
  const cx = W / 2;
  const cy = H * 0.5;
  const halo = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.62);
  halo.addColorStop(0, p.body + 'aa');
  halo.addColorStop(0.5, p.glow + '44');
  halo.addColorStop(1, p.glow + '00');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  // the body: a long diamond, cut into facets that catch the light differently
  const top = [cx, H * 0.04];
  const bottom = [cx, H * 0.96];
  const left = [cx - W * 0.27, cy];
  const right = [cx + W * 0.27, cy];
  const body = g.createLinearGradient(left[0], 0, right[0], 0);
  body.addColorStop(0, p.glow);
  body.addColorStop(0.5, p.body);
  body.addColorStop(1, p.glow);
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(top[0], top[1]);
  g.lineTo(right[0], right[1]);
  g.lineTo(bottom[0], bottom[1]);
  g.lineTo(left[0], left[1]);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  for (let i = 0; i < 26; i++) {
    const x = cx + (r() - 0.5) * W * 0.5;
    const y = H * (0.06 + r() * 0.88);
    g.fillStyle = r() < 0.5 ? 'rgba(255, 252, 220, 0.28)' : 'rgba(160, 90, 0, 0.22)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * W * 0.3, y + r() * H * 0.12);
    g.lineTo(x + (r() - 0.5) * W * 0.3, y + r() * H * 0.12);
    g.closePath();
    g.fill();
  }
  const core = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.24);
  core.addColorStop(0, p.core);
  core.addColorStop(0.35, p.core + 'cc');
  core.addColorStop(1, p.body + '00');
  g.fillStyle = core;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** A fluted stone column (a tall canvas), dark, with a rim of light on its right edge (the side toward the crystal). */
export function paintColumn(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: CinematicPalette,
  seed: number,
): void {
  g.clearRect(0, 0, W, H);
  const r = rng(seed);
  const stone = g.createLinearGradient(0, 0, W, 0);
  stone.addColorStop(0, '#13130d');
  stone.addColorStop(0.55, '#2a2a1f');
  stone.addColorStop(1, '#3a3826');
  g.fillStyle = stone;
  g.fillRect(W * 0.16, 0, W * 0.68, H);
  // the flutes
  g.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (let x = W * 0.2; x < W * 0.82; x += W * 0.09) g.fillRect(x, 0, W * 0.012, H);
  g.fillStyle = 'rgba(255, 240, 180, 0.07)';
  for (let x = W * 0.25; x < W * 0.82; x += W * 0.09) g.fillRect(x, 0, W * 0.012, H);
  // a capital and a base, and cracks
  g.fillStyle = '#1a1a12';
  g.fillRect(W * 0.08, 0, W * 0.84, H * 0.05);
  g.fillRect(W * 0.1, H * 0.95, W * 0.8, H * 0.05);
  g.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const y = H * (0.2 + r() * 0.6);
    g.beginPath();
    g.moveTo(W * (0.2 + r() * 0.5), y);
    g.lineTo(W * (0.2 + r() * 0.6), y + H * 0.05);
    g.stroke();
  }
  // the dark toward the top, and the rim of light
  const dark = g.createLinearGradient(0, 0, 0, H);
  dark.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  dark.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
  g.fillStyle = dark;
  g.fillRect(0, 0, W, H);
  const rim = g.createLinearGradient(W * 0.7, 0, W * 0.86, 0);
  rim.addColorStop(0, p.rim + '00');
  rim.addColorStop(1, p.rim + 'bb');
  g.fillStyle = rim;
  g.globalCompositeOperation = 'source-atop';
  g.fillRect(W * 0.7, 0, W * 0.2, H);
  g.globalCompositeOperation = 'source-over';
}

/** A tall soft beam of light (a tall canvas): bright at the middle, fading at the sides and the top. */
export function paintBeam(g: CanvasRenderingContext2D, W: number, H: number, p: CinematicPalette): void {
  g.clearRect(0, 0, W, H);
  for (let x = 0; x < W; x++) {
    const across = Math.max(0, Math.sin((x / (W - 1)) * Math.PI));
    const grad = g.createLinearGradient(0, 0, 0, H);
    const a = across * across;
    grad.addColorStop(0, p.body + '00');
    grad.addColorStop(
      0.5,
      p.body +
        Math.round(a * 120)
          .toString(16)
          .padStart(2, '0'),
    );
    grad.addColorStop(
      1,
      p.core +
        Math.round(a * 200)
          .toString(16)
          .padStart(2, '0'),
    );
    g.fillStyle = grad;
    g.fillRect(x, 0, 1, H);
  }
}
