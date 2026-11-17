// The bedroom's painted art, drawn in code onto canvases (no image files): the wall behind the stage, the night outside the
// window with its rain, the moonlight on the floor and the quilt on his lap. Each painter fills the whole canvas it is given, once, when the room is made. The colours are
// mid-tones: room-dressing-view.ts darkens or warms them with the candle, so they read as one lit room.

const TWO_PI = Math.PI * 2;

/** Seeded, so the room paints the same every time (no Math.random: tests and screenshots stay steady). */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, fill: string): void {
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

/** The room's walls: plain plaster above wooden panelling. No picture rail or bunting: the walls are bare for the story. */
export function paintWall(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(11);
  g.save();
  g.scale(W / 1024, H / 640);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Plain plaster, no pattern: the shadow play is on this wall, and stripes or a motif fight the shadows' edges. Only a
  // soft, broad mottle, too large and faint to read as a pattern, so it is not a flat screen.
  rect(g, 0, 0, 1024, 640, '#5a4636');
  for (let i = 0; i < 40; i++) {
    const cx = r() * 1024,
      cy = r() * 440,
      rad = 60 + r() * 120;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, i % 2 ? 'rgba(255, 230, 190, 0.035)' : 'rgba(20, 10, 4, 0.05)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // Damp and age, in a few soft patches.
  for (let i = 0; i < 9; i++) {
    const cx = r() * 1024,
      cy = r() * 420,
      rad = 50 + r() * 90;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    grad.addColorStop(0, 'rgba(20, 10, 4, 0.14)');
    grad.addColorStop(1, 'rgba(20, 10, 4, 0)');
    g.fillStyle = grad;
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }

  // Panelling below the chair rail.
  rect(g, 0, 440, 1024, 200, '#3a2a1e');
  rect(g, 0, 434, 1024, 12, '#5a4028');
  rect(g, 0, 446, 1024, 3, 'rgba(0, 0, 0, 0.45)');
  for (let x = 24; x < 1000; x += 128) {
    rect(g, x, 470, 100, 130, '#2e2017');
    rect(g, x + 4, 474, 92, 122, '#33241a');
    rect(g, x, 470, 100, 3, 'rgba(0, 0, 0, 0.5)');
    rect(g, x, 596, 100, 3, 'rgba(255, 220, 160, 0.10)');
  }
  rect(g, 0, 612, 1024, 28, '#241810'); // skirting
  rect(g, 0, 612, 1024, 3, 'rgba(255, 220, 160, 0.10)');
  edgeShade(g);
  g.restore();
}
/**
 * Casts the soft shadow of everything drawn on `thing` onto `g`, moved by (dx, dy) and blurred, as if lit from the upper left;
 * only the shadow lands, `thing` is drawn far off to the side and its shadow is brought back (shadow offsets ignore the
 * transform). (x, y) is where `thing`'s top left corner sits on `g`.
 */
export function castShadow(
  g: CanvasRenderingContext2D,
  thing: CanvasImageSource,
  x: number,
  y: number,
  dx: number,
  dy: number,
  blur: number,
  alpha: number,
): void {
  const FAR = 8192;
  g.save();
  g.shadowColor = `rgba(8, 4, 2, ${alpha})`;
  g.shadowBlur = blur;
  g.shadowOffsetX = FAR + dx;
  g.shadowOffsetY = dy;
  g.drawImage(thing, x - FAR, y);
  g.restore();
}

/** Darkens a wall toward its edges (the corners, the ceiling, the floor line), so a flat painted wall reads as a room's wall. */
function edgeShade(g: CanvasRenderingContext2D): void {
  const side = (x0: number, x1: number, a: number) => {
    const grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, `rgba(6, 3, 2, ${a})`);
    grad.addColorStop(1, 'rgba(6, 3, 2, 0)');
    g.fillStyle = grad;
    g.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), 640);
  };
  side(0, 140, 0.55);
  side(1024, 884, 0.55);
  const top = g.createLinearGradient(0, 0, 0, 110);
  top.addColorStop(0, 'rgba(6, 3, 2, 0.6)');
  top.addColorStop(1, 'rgba(6, 3, 2, 0)');
  g.fillStyle = top;
  g.fillRect(0, 0, 1024, 110);
  const floor = g.createLinearGradient(0, 640, 0, 560);
  floor.addColorStop(0, 'rgba(6, 3, 2, 0.5)');
  floor.addColorStop(1, 'rgba(6, 3, 2, 0)');
  g.fillStyle = floor;
  g.fillRect(0, 560, 1024, 80);
}

/** The outside is painted in five layers that sit one behind the other (see paintNight); a layer is one of these. */
export type NightLayer = 'sky' | 'hills' | 'village' | 'near' | 'curtains';
/** Units (of 220 by 260) the outside layers are painted past each edge of the window, so they can slide without a bare edge. */
export const NIGHT_MARGIN = 24;

/**
 * The rainy night seen through the window, one layer at a time (each a canvas of the same shape, 220 by 260 units plus the margin
 * on every side, except the curtains, which are exactly the window): the `sky` is low, heavy rain cloud with the moon a faint
 * glow somewhere behind it; the `hills` are dark hills going into mist and a first row of wet roofs; the `village` is the nearer
 * roofs, a steeple, chimneys and lit windows; `near` is wet ground with puddles holding the windows' light, and dark pines; the
 * `curtains` are tied back to each side. The room view slides the layers by different amounts as the head moves, so the outside
 * has depth. The rain that falls over it is a separate layer (paintRain).
 */
export function paintNight(g: CanvasRenderingContext2D, W: number, H: number, layer: NightLayer = 'sky'): void {
  const r = rng(29);
  const M = layer === 'curtains' ? 0 : NIGHT_MARGIN;
  g.save();
  g.scale(W / (220 + 2 * M), H / (260 + 2 * M));
  g.translate(M, M);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  if (layer === 'sky') {
    const sky = g.createLinearGradient(0, 0, 0, 260);
    sky.addColorStop(0, '#0a0d17');
    sky.addColorStop(0.45, '#182032');
    sky.addColorStop(0.8, '#2a3348');
    sky.addColorStop(1, '#3a4258'); // a little lighter low down, where the village's lights catch the rain
    g.fillStyle = sky;
    g.fillRect(-M, -M, 220 + 2 * M, 260 + 2 * M);

    // The moon, lost behind the cloud: only a faint wide glow.
    const glow = g.createRadialGradient(140, 58, 4, 140, 58, 90);
    glow.addColorStop(0, 'rgba(170, 185, 215, 0.32)');
    glow.addColorStop(0.4, 'rgba(120, 135, 170, 0.12)');
    glow.addColorStop(1, 'rgba(120, 135, 170, 0)');
    g.fillStyle = glow;
    g.fillRect(30, -M, 220, 170);

    // Rain cloud: rows of soft, heavy shapes, dark underneath, a little lit on top near the moon.
    for (let row = 0; row < 4; row++) {
      const y0 = -10 + row * 34;
      for (let i = 0; i < 12; i++) {
        const x = -M + r() * (220 + 2 * M);
        const y = y0 + r() * 22;
        const rx = 24 + r() * 34;
        const ry = 7 + r() * 9;
        const nearMoon = Math.max(0, 1 - Math.hypot(x - 140, y - 58) / 90);
        const cl = g.createLinearGradient(x, y - ry, x, y + ry);
        cl.addColorStop(
          0,
          `rgba(${90 + 60 * nearMoon}, ${100 + 60 * nearMoon}, ${125 + 60 * nearMoon}, ${0.22 + 0.2 * nearMoon})`,
        );
        cl.addColorStop(1, `rgba(12, 15, 24, ${0.35 + 0.2 * r()})`);
        g.fillStyle = cl;
        g.beginPath();
        g.ellipse(x, y, rx, ry, (r() - 0.5) * 0.2, 0, TWO_PI);
        g.fill();
      }
    }

    // Far rain as a veil: long faint slanted lines over the whole sky.
    g.strokeStyle = 'rgba(160, 175, 205, 0.07)';
    g.lineWidth = 0.6;
    g.beginPath();
    for (let i = 0; i < 70; i++) {
      const x = -M + r() * (220 + 2 * M + 40);
      const y = -M + r() * (260 + M);
      const l = 20 + r() * 40;
      g.moveTo(x, y);
      g.lineTo(x - l * RAIN_SLANT, y + l);
    }
    g.stroke();
  }

  if (layer === 'hills') {
    // Dark hills, their tops lost in the rain.
    g.fillStyle = '#1b2232';
    g.beginPath();
    g.moveTo(-M, 200);
    g.lineTo(-M, 166);
    g.quadraticCurveTo(30, 146, 70, 160);
    g.quadraticCurveTo(110, 140, 150, 156);
    g.quadraticCurveTo(190, 146, 220 + M, 170);
    g.lineTo(220 + M, 200);
    g.closePath();
    g.fill();
    const mist = g.createLinearGradient(0, 136, 0, 186);
    mist.addColorStop(0, 'rgba(60, 70, 92, 0.55)');
    mist.addColorStop(1, 'rgba(60, 70, 92, 0)');
    g.fillStyle = mist;
    g.fillRect(-M, 136, 220 + 2 * M, 50);
  }

  // Village roofs, from far to near, each darker, each with a wet sheen along its slope.
  const roofs = (base: number, tone: string, sheen: string, seed: number) => {
    const q = rng(seed);
    let x = -M - 6;
    g.lineWidth = 1;
    while (x < 224 + M) {
      const w = 26 + q() * 22,
        h = 7 + q() * 9;
      g.fillStyle = tone;
      g.beginPath();
      g.moveTo(x, base + 60);
      g.lineTo(x, base + 2);
      g.lineTo(x + w / 2, base - h);
      g.lineTo(x + w, base + 2);
      g.lineTo(x + w, base + 60);
      g.closePath();
      g.fill();
      // the rain on the roof: a thin light along the ridge and down one slope
      g.strokeStyle = sheen;
      g.beginPath();
      g.moveTo(x + 1, base + 1.5);
      g.lineTo(x + w / 2, base - h + 0.6);
      g.lineTo(x + w - 1, base + 1.5);
      g.stroke();
      x += w - 4;
    }
  };
  if (layer === 'hills') roofs(190, '#141a2a', 'rgba(140, 160, 200, 0.3)', 5);
  if (layer === 'village') roofs(208, '#0d1220', 'rgba(150, 170, 210, 0.38)', 9);

  if (layer === 'village') {
    // The church: a steeple among the roofs.
    g.fillStyle = '#0d1220';
    g.beginPath();
    g.moveTo(170, 214);
    g.lineTo(170, 180);
    g.lineTo(177, 150);
    g.lineTo(184, 180);
    g.lineTo(184, 214);
    g.closePath();
    g.fill();
    g.fillRect(176, 138, 2, 12);
    g.fillRect(172.5, 143, 9, 2);
    g.fillStyle = 'rgba(255, 210, 130, 0.85)';
    g.beginPath();
    g.arc(177, 188, 3, Math.PI, 0);
    g.fillRect(174, 188, 6, 8);
    g.fill();

    // Chimneys (no smoke rises far in the rain).
    for (const [x, y] of [
      [38, 190],
      [116, 186],
      [66, 205],
    ]) {
      g.fillStyle = '#090d18';
      g.fillRect(x, y, 7, 16);
      g.strokeStyle = 'rgba(150, 160, 185, 0.14)';
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(x + 3.5, y);
      g.quadraticCurveTo(x + 1, y - 6, x + 6, y - 12);
      g.stroke();
    }

    // Lit windows, with a warm glow round each, softened by the rain.
    for (const [x, y] of [
      [24, 216],
      [52, 222],
      [84, 214],
      [104, 224],
      [140, 218],
      [196, 220],
      [160, 230],
    ]) {
      const glow = g.createRadialGradient(x + 3, y + 4, 0, x + 3, y + 4, 15);
      glow.addColorStop(0, 'rgba(255, 185, 100, 0.5)');
      glow.addColorStop(1, 'rgba(255, 185, 100, 0)');
      g.fillStyle = glow;
      g.fillRect(x - 13, y - 12, 32, 32);
      g.fillStyle = '#f2c47e';
      g.fillRect(x, y, 6, 8);
      g.fillStyle = 'rgba(40, 20, 8, 0.7)';
      g.fillRect(x + 2.7, y, 0.6, 8);
      g.fillRect(x, y + 3.7, 6, 0.6);
    }

    // Rain haze in front of the village.
    const haze = g.createLinearGradient(0, 196, 0, 244);
    haze.addColorStop(0, 'rgba(70, 80, 104, 0)');
    haze.addColorStop(1, 'rgba(70, 80, 104, 0.22)');
    g.fillStyle = haze;
    g.fillRect(-M, 196, 220 + 2 * M, 48);
  }

  if (layer === 'near') {
    // The near ground: dark and wet, with puddles that hold the windows' light and a little of the sky.
    const ground = g.createLinearGradient(0, 232, 0, 260);
    ground.addColorStop(0, '#1a2130');
    ground.addColorStop(1, '#0b0f18');
    g.fillStyle = ground;
    g.beginPath();
    g.moveTo(-M, 260 + M);
    g.lineTo(-M, 244);
    g.quadraticCurveTo(60, 232, 120, 242);
    g.quadraticCurveTo(180, 250, 220 + M, 238);
    g.lineTo(220 + M, 260 + M);
    g.closePath();
    g.fill();
    for (const [x, y, rx] of [
      [62, 248, 18],
      [128, 252, 24],
      [176, 256, 14],
    ]) {
      g.fillStyle = 'rgba(70, 82, 110, 0.55)';
      g.beginPath();
      g.ellipse(x, y, rx, 2.6, 0, 0, TWO_PI);
      g.fill();
      g.fillStyle = 'rgba(255, 190, 110, 0.35)';
      for (let k = 0; k < 2; k++) g.fillRect(x - rx * 0.5 + k * rx * 0.6 + r() * 4, y - 1, 1.6, 2.2);
    }
    const pine = (x: number, base: number, h: number) => {
      g.fillStyle = '#060912';
      for (let t = 0; t < 4; t++) {
        const y = base - h + t * (h / 4.4);
        const w = 8 + t * 6;
        g.beginPath();
        g.moveTo(x, y - 2);
        g.lineTo(x - w / 2, y + h / 3.2);
        g.lineTo(x + w / 2, y + h / 3.2);
        g.closePath();
        g.fill();
      }
      g.fillRect(x - 1.5, base - 4, 3, 8);
      // wet needles catching a little light
      g.fillStyle = 'rgba(130, 150, 190, 0.18)';
      for (let t = 0; t < 4; t++) {
        const y = base - h + t * (h / 4.4);
        g.fillRect(x - 2 - t, y + 2 + t * 0.6, 4 + 2 * t, 0.8);
      }
    };
    pine(30, 246, 70);
    pine(14, 252, 52);
    pine(196, 244, 62);
    pine(212, 250, 46);
  }

  if (layer === 'curtains') {
    // Curtains, tied back with a cord, with folds and a lit edge.
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : 220;
      const dir = side === 0 ? 1 : -1;
      const grad = g.createLinearGradient(x0, 0, x0 + dir * 60, 0);
      grad.addColorStop(0, '#6a343a');
      grad.addColorStop(0.55, '#4a2429');
      grad.addColorStop(1, '#2e1519');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x0, 0);
      g.lineTo(x0 + dir * 62, 0);
      g.quadraticCurveTo(x0 + dir * 34, 118, x0 + dir * 24, 150);
      g.quadraticCurveTo(x0 + dir * 50, 196, x0 + dir * 66, 260);
      g.lineTo(x0, 260);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      g.lineWidth = 1.8;
      for (let i = 1; i < 6; i++) {
        g.beginPath();
        g.moveTo(x0 + dir * i * 10, 0);
        g.quadraticCurveTo(x0 + dir * (i * 6 + 8), 130, x0 + dir * (i * 9 + 4), 260);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255, 190, 170, 0.28)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x0 + dir * 62, 0);
      g.quadraticCurveTo(x0 + dir * 34, 118, x0 + dir * 24, 150);
      g.quadraticCurveTo(x0 + dir * 50, 196, x0 + dir * 66, 260);
      g.stroke();
      // the tie
      g.strokeStyle = '#d8b46a';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x0 + dir * 18, 146);
      g.quadraticCurveTo(x0 + dir * 36, 154, x0 + dir * 52, 142);
      g.stroke();
      g.fillStyle = '#d8b46a';
      g.beginPath();
      g.arc(x0 + dir * 54, 152, 3.2, 0, TWO_PI);
      g.fill();
    }
    rect(g, 0, 0, 220, 9, '#2a1a14'); // the curtain rod
    rect(g, 0, 7, 220, 2, 'rgba(255, 220, 160, 0.2)');
  }

  g.restore();
}

/** How far rain leans as it falls: across per unit down (it falls down and a little to the left of the picture). */
export const RAIN_SLANT = 0.12;

/**
 * A tileable layer of falling rain (any canvas: it wraps at every edge): thin pale streaks, faint at the top and brighter at the
 * drop's end, leaning by RAIN_SLANT. Two layers at different scales and speeds make the rain outside the window (the room scrolls
 * their texture offsets along the lean).
 */
export function paintRain(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  seed: number,
  count: number,
  length: number,
): void {
  const r = rng(seed);
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * W,
      y = r() * H,
      l = length * (0.55 + 0.45 * r());
    const a = 0.18 + 0.32 * r();
    g.lineWidth = 0.8 + r() * 0.9;
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        const x0 = x + dx,
          y0 = y + dy,
          x1 = x0 - l * RAIN_SLANT,
          y1 = y0 + l;
        if (Math.max(x0, x1) < -2 || Math.min(x0, x1) > W + 2 || y1 < -2 || y0 > H + 2) continue;
        const grad = g.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, 'rgba(200, 215, 240, 0)');
        grad.addColorStop(1, `rgba(215, 228, 250, ${a})`);
        g.strokeStyle = grad;
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
  }
}

const QUILT_COLOURS = ['#25324d', '#2d3e33', '#583a2d', '#604f35', '#3d2b38', '#302b28'];

/**
 * A patchwork quilt (a square canvas, four patches by four, laid out like the bed tray's own): every patch is woven cloth with a
 * small motif (star, diamond, stripes, dots, triangles), puffed in the middle and pinched at the seams, with a dashed thread
 * stitched round it. The colours are the bed tray's own muted ones.
 */
export function paintQuilt(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(97);
  g.save();
  g.scale(W / 256, H / 256);
  const P = 64;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * P;
      const y = row * P;
      const base = QUILT_COLOURS[(row * 3 + col * 2 + (row % 2)) % QUILT_COLOURS.length];
      rect(g, x, y, P, P, base);
      // woven cloth: fine threads both ways
      g.fillStyle = 'rgba(255, 235, 200, 0.05)';
      for (let i = 0; i < P; i += 3) {
        g.fillRect(x + i, y, 1, P);
        g.fillRect(x, y + i, P, 1);
      }
      // the motif, a shade lighter than the cloth
      g.fillStyle = 'rgba(255, 235, 200, 0.16)';
      g.strokeStyle = 'rgba(255, 235, 200, 0.16)';
      g.lineWidth = 3;
      const cx = x + P / 2;
      const cy = y + P / 2;
      switch ((row + col * 2) % 5) {
        case 0:
          star(g, cx, cy, 20, 'rgba(255, 235, 200, 0.18)');
          break;
        case 1:
          g.beginPath();
          g.moveTo(cx, cy - 20);
          g.lineTo(cx + 20, cy);
          g.lineTo(cx, cy + 20);
          g.lineTo(cx - 20, cy);
          g.closePath();
          g.fill();
          break;
        case 2:
          for (let i = 0; i < 4; i++) g.fillRect(x + 12 + i * 12, y + 8, 5, P - 16);
          break;
        case 3:
          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              g.beginPath();
              g.arc(x + 14 + i * 18, y + 14 + j * 18, 3.4, 0, TWO_PI);
              g.fill();
            }
          }
          break;
        default:
          g.beginPath();
          g.moveTo(x + 6, y + 6);
          g.lineTo(x + P - 6, y + 6);
          g.lineTo(x + 6, y + P - 6);
          g.closePath();
          g.fill();
      }
      // the odd darker tuft of wear
      if (r() < 0.5) rect(g, x + r() * 40, y + r() * 50, 10 + r() * 14, 2, 'rgba(0, 0, 0, 0.18)');
      // puffed in the middle, pinched at the seams
      const puff = g.createRadialGradient(cx - 6, cy - 8, 4, cx, cy, P * 0.72);
      puff.addColorStop(0, 'rgba(255, 235, 200, 0.2)');
      puff.addColorStop(0.55, 'rgba(255, 235, 200, 0)');
      puff.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
      g.fillStyle = puff;
      g.fillRect(x, y, P, P);
      // the dashed thread
      g.strokeStyle = 'rgba(235, 220, 190, 0.55)';
      g.lineWidth = 1.2;
      g.setLineDash([3, 2.5]);
      g.strokeRect(x + 5, y + 5, P - 10, P - 10);
      g.setLineDash([]);
    }
  }
  // the seams, dark where the patches are pinched together
  g.fillStyle = 'rgba(8, 4, 4, 0.55)';
  for (let i = 1; i < 4; i++) {
    g.fillRect(i * P - 1.2, 0, 2.4, 256);
    g.fillRect(0, i * P - 1.2, 256, 2.4);
  }
  g.restore();
}
