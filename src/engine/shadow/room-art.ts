// The bedroom's painted art, drawn in code onto canvases (no image files): the wall behind the stage, the night outside the
// window, a bookcase and a rug. Each painter fills the whole canvas it is given, once, when the room is made. The colours are
// mid-tones: room-dressing-view.ts darkens or warms them with the candle, so they read as one lit room.

const TWO_PI = Math.PI * 2;
const INK = '#17110e';

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

function frame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, mat: string): void {
  rect(g, x - 9, y - 9, w + 18, h + 18, INK);
  rect(g, x - 6, y - 6, w + 12, h + 12, '#6b4a2e');
  rect(g, x - 3, y - 3, w + 6, h + 6, '#4a3220');
  rect(g, x, y, w, h, mat);
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

/**
 * The wall behind the stage (4 m by 2.5 m, any canvas of that shape): striped wallpaper with a small repeating motif, a
 * picture rail with paper bunting, framed pictures, two shelves of keepsakes and wooden panelling below. The middle, where
 * the paper stage hangs, is left calm so the shadows read against it. The pictures and shelves are not in it: they are
 * paintWallThings, held off the wall. Its edges and corners are shaded, so the wall sits in the room rather than on the screen.
 */
export function paintWall(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(11);
  g.save();
  g.scale(W / 1024, H / 640);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // Wallpaper: soft vertical stripes with a small diamond between them.
  rect(g, 0, 0, 1024, 640, '#5a4636');
  for (let x = 0; x < 1024; x += 64) {
    rect(g, x, 0, 32, 640, 'rgba(255, 230, 190, 0.05)');
    rect(g, x + 31, 0, 2, 640, 'rgba(20, 10, 4, 0.18)');
  }
  g.fillStyle = 'rgba(255, 220, 160, 0.10)';
  for (let y = 40; y < 430; y += 56) {
    for (let x = 16; x < 1024; x += 64) {
      const o = (Math.floor(y / 56) % 2) * 32;
      g.beginPath();
      g.moveTo(x + o, y - 8);
      g.lineTo(x + o + 6, y);
      g.lineTo(x + o, y + 8);
      g.lineTo(x + o - 6, y);
      g.closePath();
      g.fill();
    }
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

  // Fine grain, like paint on cloth: a few thousand specks, light and dark.
  for (let i = 0; i < 2600; i++) {
    const x = r() * 1024;
    const y = r() * 640;
    rect(g, x, y, 1 + r() * 2.5, 1 + r() * 1.5, r() < 0.5 ? 'rgba(255, 235, 200, 0.035)' : 'rgba(10, 5, 2, 0.05)');
  }

  // Picture rail and bunting.
  rect(g, 0, 58, 1024, 10, '#33241a');
  rect(g, 0, 68, 1024, 3, 'rgba(0, 0, 0, 0.35)');
  const flags = ['#8a4a3a', '#c79a52', '#4d6a5a', '#6a5a86', '#b36a4a'];
  g.strokeStyle = INK;
  g.lineWidth = 3;
  for (let seg = 0; seg < 2; seg++) {
    const x0 = seg === 0 ? 70 : 590,
      x1 = seg === 0 ? 440 : 960;
    g.beginPath();
    g.moveTo(x0, 72);
    g.quadraticCurveTo((x0 + x1) / 2, 128, x1, 72);
    g.stroke();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t;
      const y = 72 + 56 * 2 * t * (1 - t) * 0.98;
      g.fillStyle = flags[(i + seg * 2) % flags.length];
      g.beginPath();
      g.moveTo(x - 14, y);
      g.lineTo(x + 14, y);
      g.lineTo(x, y + 30);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      g.lineWidth = 2;
      g.stroke();
    }
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
/** A rectangle of the wall behind the stage, in its 1024 by 640 units (4 m by 2.5 m, so 256 units to the metre). */
export interface WallArea {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
/** The band of the wall the hung things are in, which is the area the painter paints when it is given none. */
export const WALL_THINGS_BAND: WallArea = { x: 0, y: 120, w: 1024, h: 320 };
/**
 * Where the hung things are: each cluster is a quad of its own, as small as its things, so the see-through space between them
 * costs nothing to draw (two quads the width of the wall cost a fifth of the frame in a software renderer).
 */
export const WALL_THINGS: readonly { readonly layer: 'pictures' | 'shelves'; readonly area: WallArea }[] = [
  { layer: 'pictures', area: { x: 130, y: 140, w: 180, h: 295 } }, // the bird and the moon
  { layer: 'pictures', area: { x: 785, y: 135, w: 180, h: 150 } }, // the hill
  { layer: 'shelves', area: { x: 695, y: 262, w: 260, h: 110 } }, // books, boat and lamp
  { layer: 'shelves', area: { x: 55, y: 205, w: 130, h: 105 } }, // jar and plant
];

/**
 * What hangs or stands on the wall behind the stage, on a transparent canvas that covers `area` of the wall (the whole band of rows
 * 120 to 440 when none is given): the `pictures` layer is the framed bird, moon and hill; the `shelves` layer is the two shelves
 * with their books, boat, lamp, jar and plant. Each cluster is a quad of its own, held a hand's breadth off the wall, so the things
 * really stand out from the paper when the head moves; castShadow() paints their shadows onto the wall itself.
 */
export function paintWallThings(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  layer: 'pictures' | 'shelves',
  area: WallArea = WALL_THINGS_BAND,
): void {
  g.save();
  g.scale(W / area.w, H / area.h);
  g.translate(-area.x, -area.y);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (layer === 'pictures') {
    // Left: a framed bird in flight, and a small moon picture under it.
    frame(g, 150, 160, 140, 170, '#d8c8a4');
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(190, 262);
    g.quadraticCurveTo(210, 232, 232, 246);
    g.quadraticCurveTo(250, 214, 276, 208);
    g.quadraticCurveTo(262, 232, 252, 252);
    g.quadraticCurveTo(262, 262, 244, 270);
    g.quadraticCurveTo(220, 276, 190, 262);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(222, 244);
    g.quadraticCurveTo(204, 204, 172, 196);
    g.quadraticCurveTo(190, 224, 204, 248);
    g.closePath();
    g.fill();
    frame(g, 178, 362, 84, 58, '#2d3a5e');
    g.fillStyle = '#eef0d8';
    g.beginPath();
    g.arc(230, 388, 14, 0, TWO_PI);
    g.fill();
    g.fillStyle = '#2d3a5e';
    g.beginPath();
    g.arc(236, 384, 12, 0, TWO_PI);
    g.fill();

    // Right: a framed hill and a framed candle, and a shelf of keepsakes beside them.
    frame(g, 800, 150, 150, 120, '#3a4a68');
    g.fillStyle = '#1b2236';
    g.beginPath();
    g.moveTo(800, 270);
    g.lineTo(800, 236);
    g.quadraticCurveTo(850, 196, 892, 232);
    g.quadraticCurveTo(920, 214, 950, 240);
    g.lineTo(950, 270);
    g.closePath();
    g.fill();
    star(g, 840, 176, 6, '#f4e8b8');
    star(g, 900, 190, 4, '#f4e8b8');
    star(g, 928, 168, 5, '#f4e8b8');
  } else {
    rect(g, 700, 330, 250, 12, '#3c2a1c'); // the shelf
    rect(g, 700, 342, 250, 4, 'rgba(0, 0, 0, 0.45)');
    for (const x of [716, 934]) rect(g, x, 340, 8, 28, '#2a1d13'); // brackets
    const book = (x: number, w: number, h: number, c: string) => {
      rect(g, x, 330 - h, w, h, c);
      rect(g, x + 2, 330 - h + 8, w - 4, 3, 'rgba(255, 230, 170, 0.5)');
      rect(g, x, 330 - h, w, h, 'rgba(0, 0, 0, 0.12)');
    };
    book(724, 18, 52, '#7a3b34');
    book(744, 14, 60, '#3b5a52');
    book(760, 20, 46, '#b08a4a');
    // a little wooden boat
    g.fillStyle = '#6a4630';
    g.beginPath();
    g.moveTo(800, 318);
    g.lineTo(856, 318);
    g.lineTo(844, 330);
    g.lineTo(812, 330);
    g.closePath();
    g.fill();
    rect(g, 826, 288, 3, 30, INK);
    g.fillStyle = '#d8c8a4';
    g.beginPath();
    g.moveTo(830, 290);
    g.lineTo(852, 312);
    g.lineTo(830, 312);
    g.closePath();
    g.fill();
    // a lamp
    rect(g, 886, 298, 6, 32, '#2a1d13');
    g.fillStyle = '#c79a52';
    g.beginPath();
    g.moveTo(872, 300);
    g.lineTo(906, 300);
    g.lineTo(898, 280);
    g.lineTo(880, 280);
    g.closePath();
    g.fill();

    // A second, lower shelf on the left with a jar of dried flowers and a plant.
    rect(g, 60, 292, 120, 10, '#3c2a1c');
    rect(g, 60, 302, 120, 4, 'rgba(0, 0, 0, 0.45)');
    g.fillStyle = 'rgba(190, 210, 200, 0.55)';
    g.fillRect(76, 252, 30, 40);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(76, 252, 30, 40);
    g.strokeStyle = '#8a6a3a';
    g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(91, 256);
      g.lineTo(80 + i * 8, 226 - (i % 2) * 8);
      g.stroke();
      g.fillStyle = '#b36a4a';
      g.beginPath();
      g.arc(80 + i * 8, 226 - (i % 2) * 8, 4, 0, TWO_PI);
      g.fill();
    }
    rect(g, 130, 270, 34, 22, '#6a4630'); // pot
    g.fillStyle = '#3f5a44';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(147 + (i - 2) * 9, 262 - Math.abs(i - 2) * 4, 6, 16, (i - 2) * 0.45, 0, TWO_PI);
      g.fill();
    }
  }
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
 * The night seen through the window, one layer at a time (each a canvas of the same shape, 220 by 260 units plus the margin on
 * every side, except the curtains, which are exactly the window): the `sky` is a deep winter sky with a faint aurora, stars, a
 * large moon in a halo and thin cloud; the `hills` are far mountains and a first row of snowy roofs; the `village` is the
 * nearer roofs, a steeple, chimneys with smoke and lit windows; `near` is the snowy slope and dark pines; the `curtains` are
 * tied back to each side. The room view slides the layers by different amounts as the head moves, so the outside has depth.
 * The snow that falls over it is a separate layer (paintSnow).
 */
export function paintNight(g: CanvasRenderingContext2D, W: number, H: number, layer: NightLayer = 'sky'): void {
  const r = rng(29);
  const M = layer === 'curtains' ? 0 : NIGHT_MARGIN;
  g.save();
  g.scale(W / (220 + 2 * M), H / (260 + 2 * M));
  g.translate(M, M);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // What is far away is soft: the sky and the hills are blurred a touch, as the eye would (where the canvas can).
  if ('filter' in g && (layer === 'sky' || layer === 'hills'))
    g.filter = layer === 'sky' ? 'blur(0.9px)' : 'blur(1.3px)';
  if (layer === 'sky') {
    const sky = g.createLinearGradient(0, 0, 0, 260);
    sky.addColorStop(0, '#060a20');
    sky.addColorStop(0.35, '#16215a');
    sky.addColorStop(0.7, '#34478a');
    sky.addColorStop(1, '#7a86b8');
    g.fillStyle = sky;
    g.fillRect(-M, -M, 220 + 2 * M, 260 + 2 * M);

    // A faint aurora: two soft bands.
    for (const [y, c] of [
      [52, 'rgba(90, 220, 190, 0.16)'],
      [74, 'rgba(150, 110, 230, 0.12)'],
    ] as const) {
      const band = g.createLinearGradient(0, y - 26, 0, y + 26);
      band.addColorStop(0, 'rgba(0, 0, 0, 0)');
      band.addColorStop(0.5, c);
      band.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = band;
      g.beginPath();
      g.moveTo(-M, y);
      g.bezierCurveTo(60, y - 30, 120, y + 22, 220 + M, y - 14);
      g.lineTo(220 + M, y + 40);
      g.bezierCurveTo(120, y + 52, 60, y + 14, -M, y + 40);
      g.closePath();
      g.fill();
    }

    // Stars: many small, a few large with a glint.
    for (let i = 0; i < 90; i++) {
      star(
        g,
        -M + r() * (220 + 2 * M),
        -M + r() * (150 + M),
        0.5 + r() * 1.1,
        `rgba(255, 246, 214, ${0.35 + r() * 0.6})`,
      );
    }
    for (let i = 0; i < 7; i++) {
      const x = 8 + r() * 204,
        y = 6 + r() * 100;
      star(g, x, y, 2.4, 'rgba(255, 250, 225, 0.95)');
      g.strokeStyle = 'rgba(255, 250, 225, 0.5)';
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(x - 5, y);
      g.lineTo(x + 5, y);
      g.moveTo(x, y - 5);
      g.lineTo(x, y + 5);
      g.stroke();
    }

    // The moon: a wide halo, a bright disc with soft seas and a lit rim.
    const halo = g.createRadialGradient(132, 74, 6, 132, 74, 96);
    halo.addColorStop(0, 'rgba(225, 235, 255, 0.6)');
    halo.addColorStop(0.35, 'rgba(180, 200, 255, 0.22)');
    halo.addColorStop(1, 'rgba(180, 200, 255, 0)');
    g.fillStyle = halo;
    g.fillRect(20, 0, 200, 170);
    const disc = g.createRadialGradient(126, 68, 4, 132, 74, 30);
    disc.addColorStop(0, '#ffffee');
    disc.addColorStop(1, '#e6e4c6');
    g.fillStyle = disc;
    g.beginPath();
    g.arc(132, 74, 28, 0, TWO_PI);
    g.fill();
    g.fillStyle = 'rgba(140, 140, 120, 0.3)';
    for (const [x, y, rx, ry, rot] of [
      [123, 66, 9, 6, 0.5],
      [140, 82, 7, 5, -0.3],
      [136, 60, 4, 3, 0],
      [120, 84, 5, 4, 0.2],
      [146, 68, 3, 3, 0],
    ]) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, rot, 0, TWO_PI);
      g.fill();
    }
    g.strokeStyle = 'rgba(255, 255, 240, 0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(132, 74, 28, -2.4, -0.7);
    g.stroke();

    // Thin cloud across the moon's lower edge, and two more.
    for (const [x, y, rx, ry, a] of [
      [112, 96, 56, 6, 0.3],
      [176, 112, 40, 5, 0.22],
      [42, 126, 46, 5, 0.18],
    ]) {
      const cl = g.createLinearGradient(x, y - ry, x, y + ry);
      cl.addColorStop(0, `rgba(210, 220, 255, ${a})`);
      cl.addColorStop(1, `rgba(120, 140, 210, ${a * 0.4})`);
      g.fillStyle = cl;
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, TWO_PI);
      g.fill();
    }
  }

  if (layer === 'hills') {
    // Far mountains, with snow on their ridges.
    g.fillStyle = '#2b3a78';
    g.beginPath();
    g.moveTo(-M, 190);
    g.lineTo(-M, 168);
    g.lineTo(34, 146);
    g.lineTo(58, 170);
    g.lineTo(92, 138);
    g.lineTo(128, 172);
    g.lineTo(160, 150);
    g.lineTo(220 + M, 180);
    g.lineTo(220 + M, 200);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(215, 225, 255, 0.55)';
    for (const [x, y] of [
      [34, 146],
      [92, 138],
      [160, 150],
    ]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 11, y + 14);
      g.lineTo(x - 4, y + 11);
      g.lineTo(x, y + 16);
      g.lineTo(x + 5, y + 11);
      g.lineTo(x + 12, y + 15);
      g.closePath();
      g.fill();
    }
  }

  // Village roofs, three rows from far to near, each darker, with a snow line along every roof.
  const roofs = (base: number, tone: string, snow: string, seed: number) => {
    const q = rng(seed);
    let x = -M - 6;
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
      // the snow lying on the roof: a cap that follows its slope and hangs a little at the eaves
      g.fillStyle = snow;
      g.beginPath();
      g.moveTo(x - 1.5, base + 3);
      g.lineTo(x + w / 2, base - h - 1);
      g.lineTo(x + w + 1.5, base + 3);
      g.lineTo(x + w - 2, base + 1);
      g.lineTo(x + w / 2, base - h + 3);
      g.lineTo(x + 2, base + 1);
      g.closePath();
      g.fill();
      x += w - 4;
    }
  };
  if (layer === 'hills') roofs(190, '#1a2252', 'rgba(200, 215, 250, 0.7)', 5);
  if (layer === 'hills') {
    // A band of haze lying between the hills and the roofs.
    const haze = g.createLinearGradient(0, 168, 0, 214);
    haze.addColorStop(0, 'rgba(150, 175, 230, 0)');
    haze.addColorStop(0.55, 'rgba(150, 175, 230, 0.3)');
    haze.addColorStop(1, 'rgba(150, 175, 230, 0)');
    g.fillStyle = haze;
    g.fillRect(-M, 168, 220 + 2 * M, 46);
  }
  if (layer === 'village') roofs(208, '#10173c', 'rgba(200, 215, 250, 0.75)', 9);

  if (layer === 'village') {
    // The church: a steeple among the roofs.
    g.fillStyle = '#10173c';
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
    g.fillStyle = 'rgba(255, 210, 130, 0.9)';
    g.beginPath();
    g.arc(177, 188, 3, Math.PI, 0);
    g.fillRect(174, 188, 6, 8);
    g.fill();

    // Chimneys with smoke.
    for (const [x, y] of [
      [38, 190],
      [116, 186],
      [66, 205],
    ]) {
      g.fillStyle = '#0b1030';
      g.fillRect(x, y, 7, 16);
      g.strokeStyle = 'rgba(190, 200, 230, 0.3)';
      g.lineWidth = 3.2;
      g.beginPath();
      g.moveTo(x + 3.5, y);
      g.bezierCurveTo(x - 6, y - 12, x + 14, y - 20, x + 2, y - 34);
      g.stroke();
    }

    // Lit windows, with a warm glow round each.
    for (const [x, y] of [
      [24, 216],
      [52, 222],
      [84, 214],
      [104, 224],
      [140, 218],
      [196, 220],
      [160, 230],
    ]) {
      const glow = g.createRadialGradient(x + 3, y + 4, 0, x + 3, y + 4, 13);
      glow.addColorStop(0, 'rgba(255, 190, 100, 0.55)');
      glow.addColorStop(1, 'rgba(255, 190, 100, 0)');
      g.fillStyle = glow;
      g.fillRect(x - 11, y - 10, 28, 28);
      g.fillStyle = '#ffd488';
      g.fillRect(x, y, 6, 8);
      g.fillStyle = 'rgba(40, 20, 8, 0.7)';
      g.fillRect(x + 2.7, y, 0.6, 8);
      g.fillRect(x, y + 3.7, 6, 0.6);
    }
  }

  if (layer === 'near') {
    // The near ground: a snowy slope and dark pines on each side.
    const snow = g.createLinearGradient(0, 232, 0, 260);
    snow.addColorStop(0, '#9aa8d4');
    snow.addColorStop(1, '#5a6aa0');
    g.fillStyle = snow;
    g.beginPath();
    g.moveTo(-M, 260 + M);
    g.lineTo(-M, 244);
    g.quadraticCurveTo(60, 232, 120, 242);
    g.quadraticCurveTo(180, 250, 220 + M, 238);
    g.lineTo(220 + M, 260 + M);
    g.closePath();
    g.fill();
    const pine = (x: number, base: number, h: number) => {
      g.fillStyle = '#070b22';
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
      g.fillStyle = 'rgba(200, 215, 255, 0.4)';
      for (let t = 0; t < 4; t++) {
        const y = base - h + t * (h / 4.4);
        g.fillRect(x - 2 - t, y + 2 + t * 0.6, 4 + 2 * t, 1.4);
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

/**
 * A tileable layer of falling snow (any canvas: it wraps at every edge): soft white flakes of mixed sizes. Two layers at
 * different scales and speeds make the snow outside the window (the room scrolls their texture offsets).
 */
export function paintSnow(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  seed: number,
  count: number,
  rMax: number,
): void {
  const r = rng(seed);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < count; i++) {
    const x = r() * W,
      y = r() * H,
      rad = rMax * (0.35 + 0.65 * r() * r());
    const a = 0.35 + 0.6 * r();
    for (const dx of [-W, 0, W]) {
      for (const dy of [-H, 0, H]) {
        const cx = x + dx,
          cy = y + dy;
        if (cx < -rad * 2 || cx > W + rad * 2 || cy < -rad * 2 || cy > H + rad * 2) continue;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad * 2);
        grad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
        grad.addColorStop(0.45, `rgba(235, 242, 255, ${a * 0.55})`);
        grad.addColorStop(1, 'rgba(235, 242, 255, 0)');
        g.fillStyle = grad;
        g.fillRect(cx - rad * 2, cy - rad * 2, rad * 4, rad * 4);
      }
    }
  }
}

/**
 * The window's moonlight on the floor: a slanted patch of cool light cut by the window's cross bars, soft at the edges.
 * Drawn to be added to the floor, so it is a grey-blue on black.
 */
export function paintMoonPatch(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.save();
  g.scale(W / 256, H / 256);
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  const panes: [number, number][] = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  for (const [cx, cy] of panes) {
    // each pane is a parallelogram leaning to the right as it goes down
    const x0 = 34 + cx * 100,
      y0 = 30 + cy * 100,
      w = 88,
      h = 88,
      lean = 26;
    const grad = g.createLinearGradient(0, y0, 0, y0 + h);
    grad.addColorStop(0, 'rgba(170, 195, 255, 0.95)');
    grad.addColorStop(1, 'rgba(110, 140, 220, 0.7)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0 + lean, y0);
    g.lineTo(x0 + lean + w, y0);
    g.lineTo(x0 + w, y0 + h);
    g.lineTo(x0, y0 + h);
    g.closePath();
    g.fill();
  }
  // soften the edges with the browser's blur where it has one, then fade the borders into black
  const blurred = 'filter' in g;
  if (blurred) {
    g.filter = 'blur(7px)';
    g.globalCompositeOperation = 'lighter';
    g.drawImage(g.canvas, 0, 0, 256, 256);
    g.filter = 'none';
    g.globalCompositeOperation = 'source-over';
  }
  const fade = g.createRadialGradient(128, 128, 30, 128, 128, 130);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
  g.fillStyle = fade;
  g.fillRect(0, 0, 256, 256);
  g.restore();
}

/** Things on the windowsill (a wide, short picture): a potted fern, a paper bird, a small book and an unlit candle stub. */
export function paintSill(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.save();
  g.scale(W / 300, H / 180);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // the book
  rect(g, 120, 138, 74, 18, '#7a3b34');
  rect(g, 120, 146, 74, 10, '#d8c8a4');
  rect(g, 120, 138, 74, 4, 'rgba(255, 230, 170, 0.35)');
  rect(g, 126, 120, 62, 18, '#3b5a52');
  rect(g, 126, 120, 62, 3, 'rgba(255, 230, 170, 0.35)');
  // the paper bird, on the books
  g.fillStyle = '#efe6cc';
  g.strokeStyle = INK;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(140, 118);
  g.lineTo(166, 100);
  g.lineTo(190, 116);
  g.lineTo(168, 120);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(166, 102);
  g.lineTo(158, 70);
  g.lineTo(178, 98);
  g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(190, 116);
  g.lineTo(206, 98);
  g.lineTo(194, 108);
  g.closePath();
  g.fill();
  g.stroke();
  // the fern in its pot
  g.fillStyle = '#6a4630';
  g.beginPath();
  g.moveTo(30, 128);
  g.lineTo(88, 128);
  g.lineTo(80, 164);
  g.lineTo(38, 164);
  g.closePath();
  g.fill();
  rect(g, 26, 124, 66, 8, '#8a5a3a');
  g.strokeStyle = '#3f6a48';
  g.lineWidth = 3.4;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.34;
    g.beginPath();
    g.moveTo(59, 124);
    g.quadraticCurveTo(
      59 + Math.cos(a) * 26,
      124 + Math.sin(a) * 36,
      59 + Math.cos(a) * 52 + (i - 4) * 3,
      124 + Math.sin(a) * 52 + 14,
    );
    g.stroke();
  }
  // the candle stub in a brass dish
  rect(g, 232, 134, 30, 24, '#e8dcc0');
  rect(g, 232, 134, 30, 4, 'rgba(0, 0, 0, 0.2)');
  g.fillStyle = '#b08a3a';
  g.beginPath();
  g.ellipse(247, 160, 28, 7, 0, 0, TWO_PI);
  g.fill();
  rect(g, 246, 126, 2, 8, INK);
  g.restore();
}

/** A tall bookcase (about 1 m by 1.8 m): a case of crowded shelves, a small globe on top. */
export function paintBookcase(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(53);
  g.save();
  g.scale(W / 200, H / 360);
  rect(g, 0, 40, 200, 320, INK);
  rect(g, 6, 46, 188, 308, '#3a2a1c');
  const colours = ['#7a3b34', '#3b5a52', '#b08a4a', '#3a4a68', '#6a5a86', '#8a5a3a', '#4d6a4a', '#9a7a62'];
  for (let shelf = 0; shelf < 5; shelf++) {
    const top = 52 + shelf * 60;
    rect(g, 6, top, 188, 54, '#1c140e');
    let x = 12;
    while (x < 182) {
      const w = 9 + r() * 12;
      const h = 30 + r() * 20;
      const lean = r() < 0.07;
      g.save();
      g.translate(x, top + 54);
      if (lean) g.rotate(-0.18);
      rect(g, 0, -h, w, h, colours[Math.floor(r() * colours.length)]);
      rect(g, 0, -h, w, h, 'rgba(0, 0, 0, 0.14)');
      rect(g, 2, -h + 6, w - 4, 2, 'rgba(255, 230, 170, 0.45)');
      rect(g, 2, -8, w - 4, 2, 'rgba(255, 230, 170, 0.25)');
      g.restore();
      x += w + 1 + (r() < 0.12 ? 10 + r() * 16 : 0);
    }
    rect(g, 6, top + 54, 188, 6, '#4d3826');
    // The shelf above shades the books under it, and the sides of the case shade the ends of the row.
    const under = g.createLinearGradient(0, top, 0, top + 24);
    under.addColorStop(0, 'rgba(6, 3, 2, 0.6)');
    under.addColorStop(1, 'rgba(6, 3, 2, 0)');
    g.fillStyle = under;
    g.fillRect(6, top, 188, 24);
    const left = g.createLinearGradient(6, 0, 30, 0);
    left.addColorStop(0, 'rgba(6, 3, 2, 0.45)');
    left.addColorStop(1, 'rgba(6, 3, 2, 0)');
    g.fillStyle = left;
    g.fillRect(6, top, 24, 54);
    const right = g.createLinearGradient(194, 0, 170, 0);
    right.addColorStop(0, 'rgba(6, 3, 2, 0.45)');
    right.addColorStop(1, 'rgba(6, 3, 2, 0)');
    g.fillStyle = right;
    g.fillRect(170, top, 24, 54);
  }
  // the globe
  rect(g, 98, 22, 4, 20, '#4d3826');
  g.fillStyle = '#4a6a8a';
  g.beginPath();
  g.arc(100, 14, 16, 0, TWO_PI);
  g.fill();
  g.fillStyle = '#6a8a5a';
  g.beginPath();
  g.ellipse(94, 10, 7, 5, 0.5, 0, TWO_PI);
  g.ellipse(107, 18, 5, 4, -0.3, 0, TWO_PI);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(100, 14, 16, 0, TWO_PI);
  g.stroke();
  g.restore();
}

/** A woven rug (any shape of canvas): a deep field, banded borders and a ring of small stars, with fringed ends. */
export function paintRug(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(83);
  g.save();
  g.scale(W / 512, H / 360);
  // The rug is drawn a little smaller than its canvas, so a soft shadow under it has room, and so its edge has a lip.
  g.translate(256, 180);
  g.scale(0.93, 0.93);
  g.translate(-256, -180);
  g.save();
  g.shadowColor = 'rgba(0, 0, 0, 0.7)';
  g.shadowBlur = 16;
  g.shadowOffsetX = 3;
  g.shadowOffsetY = 7;
  rect(g, 0, 18, 512, 324, '#241420');
  g.restore();
  rect(g, 0, 330, 512, 12, '#1b0f18'); // the rug's thickness along the near edge
  rect(g, 0, 18, 512, 324, '#3a2230');
  rect(g, 10, 28, 492, 304, '#6a3a3a');
  rect(g, 24, 42, 464, 276, '#2f3a5a');
  rect(g, 34, 52, 444, 256, '#8a6a3a');
  rect(g, 40, 58, 432, 244, '#2a2a46');
  g.strokeStyle = 'rgba(255, 220, 160, 0.35)';
  g.lineWidth = 2;
  g.strokeRect(52, 70, 408, 220);
  // a diamond field
  g.fillStyle = '#5a3a4a';
  g.beginPath();
  g.moveTo(256, 84);
  g.lineTo(380, 180);
  g.lineTo(256, 276);
  g.lineTo(132, 180);
  g.closePath();
  g.fill();
  g.fillStyle = '#c79a52';
  g.beginPath();
  g.moveTo(256, 112);
  g.lineTo(340, 180);
  g.lineTo(256, 248);
  g.lineTo(172, 180);
  g.closePath();
  g.fill();
  g.fillStyle = '#2a2a46';
  g.beginPath();
  g.moveTo(256, 138);
  g.lineTo(304, 180);
  g.lineTo(256, 222);
  g.lineTo(208, 180);
  g.closePath();
  g.fill();
  star(g, 256, 180, 14, '#f4e8b8');
  for (const [x, y] of [
    [84, 100],
    [428, 100],
    [84, 260],
    [428, 260],
  ]) {
    star(g, x, y, 11, '#c79a52');
  }
  // the pile: short tufts, some catching the light
  for (let i = 0; i < 700; i++) {
    const x = 12 + r() * 488,
      y = 28 + r() * 304;
    rect(g, x, y, 2 + r() * 3, 1.2, r() < 0.5 ? 'rgba(255, 225, 170, 0.12)' : 'rgba(10, 4, 8, 0.2)');
  }
  // the edge is a little lighter on the far side and darker on the near, where it dips toward the floor
  const lip = g.createLinearGradient(0, 28, 0, 332);
  lip.addColorStop(0, 'rgba(255, 225, 170, 0.14)');
  lip.addColorStop(0.15, 'rgba(255, 225, 170, 0)');
  lip.addColorStop(0.85, 'rgba(0, 0, 0, 0)');
  lip.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
  g.fillStyle = lip;
  g.fillRect(0, 28, 512, 304);
  // the fringe
  g.strokeStyle = '#d8c8a4';
  g.lineWidth = 2;
  for (let x = 12; x < 506; x += 9) {
    g.beginPath();
    g.moveTo(x, 18);
    g.lineTo(x + 1, 2);
    g.moveTo(x, 342);
    g.lineTo(x - 1, 358);
    g.stroke();
  }
  g.restore();
  g.restore();
}

/** Dark wood with a long grain (any small canvas): the sides and top of the bookcase, which stands out from the wall. */
export function paintWood(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(71);
  rect(g, 0, 0, W, H, '#4a3322');
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    rect(g, x, 0, 1 + r() * 2, H, r() < 0.5 ? 'rgba(20, 10, 4, 0.35)' : 'rgba(255, 220, 160, 0.10)');
  }
  rect(g, 0, 0, W, Math.max(2, H * 0.015), 'rgba(255, 220, 160, 0.18)');
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

/** A straw mattress under a ticking cover (any canvas, seen from above): stripes of cloth, a seam round the edge, loose straw sticking out. */
export function paintStraw(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(131);
  g.save();
  g.scale(W / 128, H / 256);
  rect(g, 0, 0, 128, 256, '#8a7448');
  for (let x = 0; x < 128; x += 16) {
    rect(g, x, 0, 8, 256, 'rgba(255, 235, 190, 0.12)');
    rect(g, x + 8, 0, 8, 256, 'rgba(20, 10, 2, 0.12)');
  }
  // loose straw
  for (let i = 0; i < 260; i++) {
    const x = r() * 128;
    const y = r() * 256;
    g.strokeStyle = r() < 0.5 ? 'rgba(255, 235, 150, 0.45)' : 'rgba(60, 40, 10, 0.4)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 16, y + (r() - 0.5) * 7);
    g.stroke();
  }
  // buttons that pinch the mattress, with a dimple round each
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 2; col++) {
      const x = 40 + col * 48;
      const y = 28 + row * 50;
      const dimple = g.createRadialGradient(x, y, 1, x, y, 16);
      dimple.addColorStop(0, 'rgba(10, 5, 0, 0.5)');
      dimple.addColorStop(1, 'rgba(10, 5, 0, 0)');
      g.fillStyle = dimple;
      g.fillRect(x - 16, y - 16, 32, 32);
      g.fillStyle = '#3a2a18';
      g.beginPath();
      g.arc(x, y, 2.4, 0, TWO_PI);
      g.fill();
    }
  }
  // the seam
  g.strokeStyle = 'rgba(30, 18, 6, 0.6)';
  g.lineWidth = 1.6;
  g.setLineDash([4, 3]);
  g.strokeRect(5, 5, 118, 246);
  g.restore();
}

/** A plump linen pillow (any canvas, seen from above): pale cloth with creases, a stitched edge and a tassel at each end. */
export function paintPillow(g: CanvasRenderingContext2D, W: number, H: number): void {
  g.save();
  g.scale(W / 128, H / 64);
  rect(g, 0, 0, 128, 64, '#a89878');
  const puff = g.createRadialGradient(64, 30, 4, 64, 32, 76);
  puff.addColorStop(0, 'rgba(255, 245, 220, 0.3)');
  puff.addColorStop(0.5, 'rgba(255, 245, 220, 0)');
  puff.addColorStop(1, 'rgba(20, 10, 2, 0.55)');
  g.fillStyle = puff;
  g.fillRect(0, 0, 128, 64);
  g.strokeStyle = 'rgba(60, 40, 16, 0.3)';
  g.lineWidth = 1.2;
  for (const [x, y, x2, y2] of [
    [30, 14, 58, 26],
    [74, 38, 102, 24],
    [40, 48, 70, 40],
  ]) {
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo((x + x2) / 2, (y + y2) / 2 - 5, x2, y2);
    g.stroke();
  }
  g.strokeStyle = 'rgba(70, 50, 20, 0.55)';
  g.lineWidth = 1.2;
  g.setLineDash([3, 2.4]);
  g.strokeRect(4, 4, 120, 56);
  g.setLineDash([]);
  g.fillStyle = '#7a4a3a';
  for (const x of [2, 126]) {
    for (const y of [2, 62]) {
      g.beginPath();
      g.arc(x, y, 3, 0, TWO_PI);
      g.fill();
    }
  }
  g.restore();
}

/** Soft drifting mist (any canvas; it wraps at the sides): overlapping pale clouds, so it can scroll without a seam. */
export function paintMist(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(211);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const cx = r() * W;
    const cy = H * (0.25 + r() * 0.55);
    const rx = W * (0.08 + r() * 0.16);
    const ry = H * (0.14 + r() * 0.24);
    const a = 0.1 + r() * 0.16;
    for (const dx of [-W, 0, W]) {
      const x = cx + dx;
      const grad = g.createRadialGradient(x, cy, 0, x, cy, rx);
      grad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
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

/** A beam of moonlight (any canvas): soft at the sides, bright toward the top and fading toward the bottom, with faint streaks. */
export function paintShaft(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(307);
  g.clearRect(0, 0, W, H);
  for (let x = 0; x < W; x++) {
    const across = Math.sin((x / (W - 1)) * Math.PI); // 0 at the sides, 1 in the middle
    const streak = 0.7 + 0.3 * Math.sin(x * 0.45 + r() * 0.8);
    const grad = g.createLinearGradient(0, 0, 0, H);
    const a = across * across * streak;
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * a})`);
    grad.addColorStop(1, `rgba(255, 255, 255, ${0.05 * a})`);
    g.fillStyle = grad;
    g.fillRect(x, 0, 1, H);
  }
}
