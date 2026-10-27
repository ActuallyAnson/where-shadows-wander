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
 * the paper stage hangs, is left calm so the shadows read against it. `furnished` false paints the same paper and panelling
 * without the pictures and shelves, for the plain side walls.
 */
export function paintWall(g: CanvasRenderingContext2D, W: number, H: number, furnished = true): void {
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

  if (furnished) {
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
  g.restore();
}

/**
 * The night seen through the window (a tall rectangle): a deep blue sky, a large moon, stars, thin cloud, the roofs and a
 * chimney of the village, and curtains drawn back to each side.
 */
export function paintNight(g: CanvasRenderingContext2D, W: number, H: number): void {
  const r = rng(29);
  g.save();
  g.scale(W / 220, H / 260);
  const sky = g.createLinearGradient(0, 0, 0, 260);
  sky.addColorStop(0, '#0c1230');
  sky.addColorStop(0.65, '#27346a');
  sky.addColorStop(1, '#4a5a92');
  g.fillStyle = sky;
  g.fillRect(0, 0, 220, 260);
  for (let i = 0; i < 46; i++)
    star(g, r() * 220, r() * 150, 0.8 + r() * 1.4, `rgba(255, 246, 214, ${0.5 + r() * 0.5})`);
  // the moon, with a halo
  const halo = g.createRadialGradient(128, 78, 8, 128, 78, 74);
  halo.addColorStop(0, 'rgba(210, 225, 255, 0.55)');
  halo.addColorStop(1, 'rgba(210, 225, 255, 0)');
  g.fillStyle = halo;
  g.fillRect(40, 0, 180, 160);
  g.fillStyle = '#f2f1dc';
  g.beginPath();
  g.arc(128, 78, 26, 0, TWO_PI);
  g.fill();
  g.fillStyle = 'rgba(150, 150, 130, 0.35)';
  for (const [x, y, rad] of [
    [120, 70, 6],
    [138, 88, 5],
    [130, 64, 3],
    [118, 90, 4],
  ]) {
    g.beginPath();
    g.arc(x, y, rad, 0, TWO_PI);
    g.fill();
  }
  // a thin cloud
  g.fillStyle = 'rgba(180, 195, 240, 0.28)';
  g.beginPath();
  g.ellipse(88, 118, 52, 7, 0, 0, TWO_PI);
  g.ellipse(160, 130, 40, 6, 0, 0, TWO_PI);
  g.fill();
  // roofs
  g.fillStyle = '#10142a';
  g.beginPath();
  g.moveTo(0, 260);
  g.lineTo(0, 214);
  g.lineTo(26, 192);
  g.lineTo(52, 214);
  g.lineTo(52, 204);
  g.lineTo(84, 178);
  g.lineTo(116, 204);
  g.lineTo(116, 196);
  g.lineTo(150, 208);
  g.lineTo(176, 186);
  g.lineTo(220, 216);
  g.lineTo(220, 260);
  g.closePath();
  g.fill();
  rect(g, 92, 160, 10, 24, '#10142a'); // chimney
  g.fillStyle = 'rgba(255, 200, 120, 0.9)';
  g.fillRect(30, 212, 7, 9); // a lit window far away
  g.fillRect(158, 214, 7, 9);
  // curtains
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : 220;
    const dir = side === 0 ? 1 : -1;
    const grad = g.createLinearGradient(x0, 0, x0 + dir * 56, 0);
    grad.addColorStop(0, '#5a2e34');
    grad.addColorStop(1, '#3a1d22');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x0, 0);
    g.lineTo(x0 + dir * 56, 0);
    g.quadraticCurveTo(x0 + dir * 30, 130, x0 + dir * 60, 260);
    g.lineTo(x0, 260);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    g.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(x0 + dir * i * 11, 0);
      g.quadraticCurveTo(x0 + dir * (i * 7 + 10), 130, x0 + dir * (i * 11 + 4), 260);
      g.stroke();
    }
  }
  rect(g, 0, 0, 220, 8, '#2a1a14'); // the curtain rod
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
  g.save();
  g.scale(W / 512, H / 360);
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
}
