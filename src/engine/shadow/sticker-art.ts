// The traveller's stickers, drawn in code: a round paper bubble with a little tail and a face inked on it, one for each
// mood in pure/traveller-mood.ts. Painted once onto a square canvas; nothing here runs per frame.
import { Sticker, type StickerId } from './pure/traveller-mood';

const PAPER = '#f2e6c9';
const PAPER_SHADE = '#d9c79c';
const INK = '#1b1410';
const BLUSH = 'rgba(214, 120, 96, 0.55)';
const TWO_PI = Math.PI * 2;

/** Draws sticker `id` filling a `size` x `size` canvas; the bubble sits in the top part and its tail points down. */
export function paintSticker(g: CanvasRenderingContext2D, size: number, id: StickerId): void {
  g.clearRect(0, 0, size, size);
  const s = size / 100;
  g.save();
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // The tail first, then the bubble over its top, with a darker rim on the lower edge so it looks like cut paper.
  g.fillStyle = INK;
  triangle(g, 33, 66, 60, 70, 43, 98);
  g.fillStyle = PAPER_SHADE;
  triangle(g, 38, 66, 56, 69, 44, 91);
  g.fillStyle = INK;
  g.beginPath();
  g.arc(50, 44, 40, 0, TWO_PI);
  g.fill();
  g.fillStyle = PAPER_SHADE;
  g.beginPath();
  g.arc(50, 44, 37, 0, TWO_PI);
  g.fill();
  g.fillStyle = PAPER;
  g.beginPath();
  g.arc(49, 42, 35, 0, TWO_PI);
  g.fill();

  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = 3.4;
  switch (id) {
    case Sticker.Happy:
      happy(g);
      break;
    case Sticker.Sad:
      sad(g);
      break;
    case Sticker.Surprised:
      surprised(g);
      break;
    case Sticker.Puzzled:
      puzzled(g);
      break;
    default:
      break;
  }
  g.restore();
}

function triangle(
  g: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): void {
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.lineTo(cx, cy);
  g.closePath();
  g.fill();
}

/** A filled circle (its own path, so nothing joins it to the last one). */
function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, TWO_PI);
  g.fill();
}

function cheeks(g: CanvasRenderingContext2D): void {
  g.fillStyle = BLUSH;
  g.beginPath();
  g.ellipse(27, 50, 6.5, 4.2, 0, 0, TWO_PI);
  g.ellipse(71, 50, 6.5, 4.2, 0, 0, TWO_PI);
  g.fill();
  g.fillStyle = INK;
}

function happy(g: CanvasRenderingContext2D): void {
  // Closed, smiling eyes and a wide smile.
  for (const ex of [36, 63]) {
    g.beginPath();
    g.arc(ex, 42, 7, Math.PI * 1.1, Math.PI * 1.9);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(34, 52);
  g.quadraticCurveTo(49, 70, 65, 52);
  g.quadraticCurveTo(49, 57, 34, 52);
  g.fill();
  cheeks(g);
}

function sad(g: CanvasRenderingContext2D): void {
  // Big shining eyes (the pleading look), a tiny wobbling mouth and a tear.
  g.beginPath();
  g.ellipse(35, 40, 8.5, 10, 0, 0, TWO_PI);
  g.fill();
  g.beginPath();
  g.ellipse(64, 40, 8.5, 10, 0, 0, TWO_PI);
  g.fill();
  g.fillStyle = PAPER;
  dot(g, 32, 36, 3.2);
  dot(g, 61, 36, 3.2);
  dot(g, 37.5, 44, 1.6);
  dot(g, 66.5, 44, 1.6);
  g.fillStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(42, 61);
  g.quadraticCurveTo(45, 56, 48, 60);
  g.quadraticCurveTo(51, 64, 55, 59);
  g.stroke();
  g.fillStyle = '#7fa7c9';
  g.beginPath();
  g.moveTo(72, 49);
  g.quadraticCurveTo(77, 58, 72, 62);
  g.quadraticCurveTo(67, 58, 72, 49);
  g.fill();
}

function surprised(g: CanvasRenderingContext2D): void {
  // Round eyes with a glint and a small round mouth.
  dot(g, 36, 41, 6.5);
  dot(g, 63, 41, 6.5);
  g.fillStyle = PAPER;
  dot(g, 34, 39, 2.2);
  dot(g, 61, 39, 2.2);
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(49.5, 60, 5, 6.2, 0, 0, TWO_PI);
  g.fill();
  cheeks(g);
}

function puzzled(g: CanvasRenderingContext2D): void {
  // Eyes glancing up and to the side, a flat little mouth, and a question mark that has floated up beside them.
  dot(g, 38, 42, 5.5);
  dot(g, 60, 42, 5.5);
  g.fillStyle = PAPER;
  dot(g, 40, 40, 2);
  dot(g, 62, 40, 2);
  g.fillStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(42, 60);
  g.quadraticCurveTo(50, 57, 57, 62);
  g.stroke();
  g.lineWidth = 3.6;
  g.beginPath();
  g.moveTo(72, 12);
  g.bezierCurveTo(72, 3, 86, 3, 85, 12);
  g.bezierCurveTo(84, 18, 78, 18, 78, 25);
  g.stroke();
  g.beginPath();
  g.arc(78, 31, 2.4, 0, TWO_PI);
  g.fill();
}
