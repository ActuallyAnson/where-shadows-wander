// Walks that wind into the distance: the traveller turns its back to us and walks away along a road that curves toward the horizon, and
// the land comes toward us as it goes (the paper-theatre way: flat things standing at different depths on a ground that recedes). This is
// the geometry and the drawing for the ground and what stands on it; the backdrops (sky, far hills, castle) are the layers of walk-lands.ts.
// Plain 2D canvas, no three.js. Distances are in metres: x across, z away from the camera.

import { blur, rng } from './vista-art';
import { drawLandmark, LANDS, type LandId, type Landmark } from './walk-lands';

type Ctx = CanvasRenderingContext2D;

export interface DepthCamera {
  /** Where the camera is: x across, z along the road. It looks along +z from `HEIGHT_M` above the ground. */
  x: number;
  z: number;
}

export const HEIGHT_M = 1.7;
/** Focal length and the horizon, as shares of the screen's width and height. */
export const FOCAL = 0.42;
export const HORIZON = 0.4;
/** How wide the road is, metres. */
export const ROAD_M = 1.9;
/** The road is drawn to this far, metres (beyond it, the haze has it). */
export const FAR_M = 60;

/** The road's winding: its centre line at distance z, metres across. Each land winds its own way. */
export function roadX(land: LandId, z: number): number {
  const a = { pass: 2.6, cave: 1.8, heights: 3.1, castle: 2.4 }[land];
  const k = { pass: 0.19, cave: 0.27, heights: 0.15, castle: 0.17 }[land];
  return a * Math.sin(z * k) + 0.8 * Math.sin(z * k * 2.3 + 1.2);
}

/** Where a point on the ground (x across, z along) lands on the screen of `W` by `H`, and how big a metre is there. null behind the camera. */
export function project(
  cam: DepthCamera,
  x: number,
  z: number,
  W: number,
  H: number,
  out: { sx: number; sy: number; px: number },
): boolean {
  const dz = z - cam.z;
  if (dz < 0.4) return false;
  const f = FOCAL * W;
  out.px = f / dz;
  out.sx = W / 2 + (x - cam.x) * out.px;
  out.sy = H * HORIZON + HEIGHT_M * out.px;
  return true;
}

/** The kinds of thing that stand beside a road (the land's own landmarks, and plain scenery). */
export type Prop = Landmark | 'rock' | 'tuft' | 'tree';

export interface PlacedProp {
  z: number;
  /** Metres from the road's centre line (negative left, positive right). */
  off: number;
  kind: Prop;
  size: number;
}

/** What stands along a land's road, in order of distance. A destination is placed at the road's end. */
export function placeProps(land: LandId, length: number): PlacedProp[] {
  const r = rng(land.length * 71 + 9);
  const marks = LANDS[land].landmarks.map((l) => l.kind);
  const out: PlacedProp[] = [];
  let z = 5;
  let i = 0;
  while (z < length - 3) {
    const left = i % 2 === 0;
    const special = i % 3 === 0;
    const kind: Prop = special
      ? marks[Math.floor(i / 3) % marks.length]
      : r() < 0.5
        ? 'rock'
        : r() < 0.5
          ? 'tree'
          : 'tuft';
    out.push({ z, off: (left ? -1 : 1) * (ROAD_M * 0.75 + r() * 2.4), kind, size: 0.8 + r() * 0.7 });
    if (r() < 0.55)
      out.push({
        z: z + 0.6 + r() * 1.5,
        off: (left ? 1 : -1) * (ROAD_M * 0.8 + r() * 3),
        kind: r() < 0.6 ? 'tuft' : 'rock',
        size: 0.7 + r() * 0.8,
      });
    z += 2.2 + r() * 2.6;
    i++;
  }
  return out.sort((a, b) => a.z - b.z);
}

/** The height of each kind in metres, and the share of the screen width `drawLandmark` makes it tall (its `unit`). */
const HEIGHT: Readonly<Record<Landmark, readonly [number, number]>> = {
  lamp: [2.2, 0.14],
  torch: [1.6, 0.11],
  flag: [2.6, 0.16],
  cairn: [1.0, 0.11],
  crystal: [0.8, 0.09],
  sign: [1.3, 0.082],
  gate: [4.2, 0.2],
};

/** Draws the ground: the land either side of the road, the road, and its edges, with the distance going to haze. */
export function drawGround(g: Ctx, land: LandId, cam: DepthCamera, W: number, H: number, haze: string): void {
  const s = LANDS[land];
  const hy = H * HORIZON;
  const ground = g.createLinearGradient(0, hy, 0, H);
  ground.addColorStop(0, s.ground.top);
  ground.addColorStop(1, s.ground.bottom);
  g.fillStyle = ground;
  g.fillRect(0, hy, W, H - hy);
  // The road, as strips of the ground from the horizon toward us.
  const a = { sx: 0, sy: 0, px: 0 };
  const b = { sx: 0, sy: 0, px: 0 };
  const road = g.createLinearGradient(0, hy, 0, H);
  road.addColorStop(0, '#cdb995');
  road.addColorStop(1, '#8c7556');
  const step = 0.6;
  for (let z = cam.z + FAR_M; z > cam.z + 0.5; z -= step) {
    const z2 = z - step;
    if (
      !project(cam, roadX(land, z) - ROAD_M / 2, z, W, H, a) ||
      !project(cam, roadX(land, z2) - ROAD_M / 2, z2, W, H, b)
    )
      continue;
    const aL = a.sx;
    const aY = a.sy;
    const bL = b.sx;
    const bY = b.sy;
    project(cam, roadX(land, z) + ROAD_M / 2, z, W, H, a);
    project(cam, roadX(land, z2) + ROAD_M / 2, z2, W, H, b);
    g.fillStyle = road;
    g.beginPath();
    g.moveTo(aL, aY);
    g.lineTo(a.sx, a.sy);
    g.lineTo(b.sx, bY);
    g.lineTo(bL, bY);
    g.closePath();
    g.fill();
    // A lit edge along both sides, and a slight darker rut down the middle.
    g.strokeStyle = 'rgba(255,242,214,0.35)';
    g.lineWidth = Math.max(1, a.px * 0.05);
    g.beginPath();
    g.moveTo(aL, aY);
    g.lineTo(bL, bY);
    g.moveTo(a.sx, a.sy);
    g.lineTo(b.sx, bY);
    g.stroke();
  }
  // Haze lying along the horizon, so the far end of the road melts away.
  const fog = g.createLinearGradient(0, hy - H * 0.04, 0, hy + H * 0.2);
  fog.addColorStop(0, `rgba(${haze},0)`);
  fog.addColorStop(0.3, `rgba(${haze},0.7)`);
  fog.addColorStop(1, `rgba(${haze},0)`);
  g.fillStyle = fog;
  g.fillRect(0, hy - H * 0.04, W, H * 0.24);
}

/** Draws one prop standing on the ground, scaled to its distance and faded into the haze when far. */
export function drawProp(
  g: Ctx,
  land: LandId,
  p: PlacedProp,
  cam: DepthCamera,
  W: number,
  H: number,
  time: number,
): void {
  const at = { sx: 0, sy: 0, px: 0 };
  const x = roadX(land, p.z) + p.off;
  if (!project(cam, x, p.z, W, H, at)) return;
  if (at.sx < -W * 0.3 || at.sx > W * 1.3) return;
  const dz = p.z - cam.z;
  const fade = Math.max(0, Math.min(1, 1 - (dz - 18) / 30));
  if (fade <= 0) return;
  const r = rng(Math.floor(p.z * 100));
  g.save();
  g.globalAlpha = fade;
  if (p.kind === 'rock') {
    const w = at.px * 0.55 * p.size;
    g.fillStyle = '#2b2630';
    g.beginPath();
    g.moveTo(at.sx - w, at.sy);
    g.lineTo(at.sx - w * 0.7, at.sy - w * 0.6);
    g.lineTo(at.sx - w * 0.1, at.sy - w * 0.9);
    g.lineTo(at.sx + w * 0.6, at.sy - w * 0.55);
    g.lineTo(at.sx + w, at.sy);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,238,206,0.25)';
    g.beginPath();
    g.moveTo(at.sx - w * 0.1, at.sy - w * 0.9);
    g.lineTo(at.sx + w * 0.6, at.sy - w * 0.55);
    g.lineTo(at.sx + w * 0.2, at.sy - w * 0.5);
    g.closePath();
    g.fill();
  } else if (p.kind === 'tuft') {
    const hgt = at.px * 0.5 * p.size;
    for (let i = 0; i < 9; i++) {
      const bx = at.sx + (i - 4) * hgt * 0.07;
      const sway = Math.sin(time * 1.8 + p.z + i) * hgt * 0.1;
      g.strokeStyle = `rgba(${130 + r() * 60},${140 + r() * 50},${70 + r() * 30},0.95)`;
      g.lineWidth = Math.max(1, hgt * 0.04);
      g.beginPath();
      g.moveTo(bx, at.sy);
      g.quadraticCurveTo(bx + sway, at.sy - hgt * 0.6, bx + hgt * 0.15 + sway * 1.5, at.sy - hgt * (0.7 + r() * 0.3));
      g.stroke();
    }
  } else if (p.kind === 'tree') {
    const hgt = at.px * 3.2 * p.size;
    g.strokeStyle = '#1f1a26';
    g.lineCap = 'round';
    g.lineWidth = Math.max(2, hgt * 0.04);
    g.beginPath();
    g.moveTo(at.sx, at.sy);
    g.quadraticCurveTo(
      at.sx + Math.sin(time * 0.9 + p.z) * hgt * 0.03,
      at.sy - hgt * 0.5,
      at.sx + hgt * 0.05,
      at.sy - hgt * 0.8,
    );
    g.stroke();
    g.fillStyle = '#231e2c';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.ellipse(
        at.sx + hgt * 0.05 + (r() - 0.5) * hgt * 0.34,
        at.sy - hgt * (0.78 + r() * 0.2),
        hgt * 0.05,
        hgt * 0.025,
        r(),
        0,
        6.283,
      );
      g.fill();
    }
  } else {
    const [metres, ratio] = HEIGHT[p.kind];
    const unit = (at.px * metres) / ratio;
    drawLandmark(g, p.kind, at.sx, at.sy, unit, r);
  }
  g.restore();
}

/** Blurs a layer a little the nearer it is, to fake the soft focus of things close to the camera. */
export function softFocus(g: Ctx, dz: number): void {
  blur(g, dz < 2.5 ? (2.5 - dz) * 2.5 : 0);
}
