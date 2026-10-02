// Draws an example hand picture (src/engine/hands/hand-sample.ts) on a 2D
// canvas: a filled palm, thick fingers and the joints, so it reads as a hand.
// Used by the headset prompt panel and, through sampleImage, the Hand Lab.
import { JOINT_PARENT, type Handedness } from '../hands/hand';
import { sampleHand } from '../hands/hand-sample';
import type { PresetName } from '../hands/synthetic-hand';

type Ctx = CanvasRenderingContext2D;
/** The palm's outline: wrist, thumb base, then the knuckles from index to pinky, and back by the pinky's base. */
const PALM = [0, 1, 2, 6, 11, 16, 21, 20];

/** Draws `preset` centred at (cx, cy), fitting a square of side `size` pixels. */
export function drawHandSample(
  g: Ctx,
  preset: PresetName,
  cx: number,
  cy: number,
  size: number,
  color: string,
  side: Handedness = 'right',
): void {
  const pts = sampleHand(preset, side);
  const half = size * 0.42;
  const X = (j: number) => cx + pts[j * 2] * half,
    Y = (j: number) => cy + pts[j * 2 + 1] * half;
  g.save();
  g.fillStyle = g.strokeStyle = color;
  g.lineCap = g.lineJoin = 'round';
  g.beginPath();
  PALM.forEach((j, i) => (i ? g.lineTo(X(j), Y(j)) : g.moveTo(X(j), Y(j))));
  g.closePath();
  g.globalAlpha = 0.55;
  g.fill();
  g.globalAlpha = 1;
  g.lineWidth = size * 0.065;
  for (let j = 1; j < JOINT_PARENT.length; j++) {
    const parent = JOINT_PARENT[j];
    g.beginPath();
    g.moveTo(X(parent), Y(parent));
    g.lineTo(X(j), Y(j));
    g.stroke();
  }
  g.restore();
}

const cache = new Map<string, string>();

/** A data URL picture of `preset` (cached), for <img> tags in page panels. */
export function sampleImage(preset: PresetName, color = '#f0a24a', side: Handedness = 'right', px = 96): string {
  const key = `${preset}:${color}:${side}:${px}`;
  let url = cache.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    drawHandSample(c.getContext('2d')!, preset, px / 2, px / 2, px, color, side);
    url = c.toDataURL();
    cache.set(key, url);
  }
  return url;
}
