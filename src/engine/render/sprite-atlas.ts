// Procedural in-memory sprite atlas for Where Shadows Wander entities.
// Generates a 1024x1024 CanvasTexture divided into a 4x4 grid of 256x256 sprite cells.
// Zero external file dependencies (0 ms download delay, 0 bundle bytes).
//
// Grid layout:
// Row 0: [0,0] Traveller Idle  | [1,0] Traveller Walk 1 | [2,0] Traveller Walk 2 | [3,0] Traveller Wait
// Row 1: [0,1] Raindrop        | [1,1] Jagged Rock      | [2,1] Flying Crow      | [3,1] Rabbit
// Row 2: [0,2] Fox             | [1,2] Firefly          | [2,2] Traveller Cheer  | [3,2] Traveller Shiver
// Row 3: [0,3] Traveller Walk 3 | [1,3] Traveller Walk 4 | [2,3] Traveller Blink  | [3,3] Reserved
// The traveller is drawn at full resolution by shadow/traveller-art.ts; the other sprites are drawn on a 128 grid and scaled up.

import { CanvasTexture, LinearFilter } from '@iwsdk/core';
import { Kind } from '../sim/entity-kinds';
import { paintTraveller, Pose } from '../shadow/traveller-art';

export const ATLAS_SIZE = 1024;
export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const CELL_SIZE = 256; // 1024 / 4

export const SpriteTile = {
  TravellerIdle: { col: 0, row: 0 },
  TravellerWalk1: { col: 1, row: 0 },
  TravellerWalk2: { col: 2, row: 0 },
  TravellerWait: { col: 3, row: 0 },
  TravellerCheer: { col: 2, row: 2 },
  TravellerShiver: { col: 3, row: 2 },
  TravellerWalk3: { col: 0, row: 3 },
  TravellerWalk4: { col: 1, row: 3 },
  TravellerBlink: { col: 2, row: 3 },
  Raindrop: { col: 0, row: 1 },
  Rock: { col: 1, row: 1 },
  Crow: { col: 2, row: 1 },
  Rabbit: { col: 3, row: 1 },
  Fox: { col: 0, row: 2 },
  Firefly: { col: 1, row: 2 },
} as const;

/**
 * Returns UV bounds [uOffset, vOffset, uScale, vScale] for a sprite at (col, row).
 * Note: Three.js textures map V=0 at the bottom when flipY is true,
 * so row 0 (top of canvas) maps to vOffset = (GRID_ROWS - 1 - row) * (1 / GRID_ROWS).
 */
export function getSpriteUvBounds(
  col: number,
  row: number,
  out: Float32Array | number[] = [0, 0, 0, 0],
): Float32Array | number[] {
  const uStep = 1.0 / GRID_COLS;
  const vStep = 1.0 / GRID_ROWS;
  out[0] = col * uStep;
  out[1] = (GRID_ROWS - 1 - row) * vStep;
  out[2] = uStep;
  out[3] = vStep;
  return out;
}

const TRAVELLER_TILES = [
  SpriteTile.TravellerIdle,
  SpriteTile.TravellerWalk1,
  SpriteTile.TravellerWalk2,
  SpriteTile.TravellerWait,
  SpriteTile.TravellerCheer,
  SpriteTile.TravellerShiver,
  SpriteTile.TravellerWalk3,
  SpriteTile.TravellerWalk4,
  SpriteTile.TravellerBlink,
] as const;

/**
 * Selects the sprite tile for a given Entity Kind and optional animation frame.
 */
export function getTileForKind(kind: number, animFrame = 0): { col: number; row: number } {
  switch (kind) {
    case Kind.Traveller:
      // animFrame is a pose number from shadow/traveller-art.ts (idle, walk 1, walk 2, wait, cheer, shiver, walk 3, walk 4, blink)
      return TRAVELLER_TILES[Math.max(0, Math.min(TRAVELLER_TILES.length - 1, animFrame | 0))];
    case Kind.Rock:
      return SpriteTile.Rock;
    case Kind.Raindrop:
      return SpriteTile.Raindrop;
    case Kind.Crow:
      return SpriteTile.Crow;
    case Kind.Rabbit:
      return SpriteTile.Rabbit;
    case Kind.Fox:
      return SpriteTile.Fox;
    case Kind.Firefly:
      return SpriteTile.Firefly;
    default:
      return SpriteTile.Rock;
  }
}

/**
 * Draws all shadow-puppet entity silhouettes into the 2D canvas context.
 */
export function renderSpriteAtlasToCanvas(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // The traveller's poses (shadow/traveller-art.ts), each in its own cell at full resolution.
  const poses: readonly [number, number, number][] = [
    [0, 0, Pose.Idle],
    [1, 0, Pose.Walk1],
    [2, 0, Pose.Walk2],
    [3, 0, Pose.Wait],
    [2, 2, Pose.Cheer],
    [3, 2, Pose.Shiver],
    [0, 3, Pose.Walk3],
    [1, 3, Pose.Walk4],
    [2, 3, Pose.Blink],
  ];
  for (const [col, row, pose] of poses) drawCell(ctx, col, row, (c) => paintTraveller(c, CELL_SIZE, pose), false);

  // Row 1: Environmental props & animals
  drawCell(ctx, 0, 1, drawRaindrop);
  drawCell(ctx, 1, 1, drawRock);
  drawCell(ctx, 2, 1, drawCrow);
  drawCell(ctx, 3, 1, drawRabbit);

  // Row 2: Fox & Firefly
  drawCell(ctx, 0, 2, drawFox);
  drawCell(ctx, 1, 2, drawFirefly);
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  drawFn: (ctx: CanvasRenderingContext2D) => void,
  /** Sprites drawn on the original 128 grid are scaled up to fill the cell. */
  legacy = true,
): void {
  ctx.save();
  ctx.translate(col * CELL_SIZE, row * CELL_SIZE);
  if (legacy) ctx.scale(CELL_SIZE / 128, CELL_SIZE / 128);
  drawFn(ctx);
  ctx.restore();
}

/**
 * Slender angled raindrop streak.
 */
function drawRaindrop(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  // Angled teardrop: top tip at (52, 24), curves down to rounded droplet at (76, 96)
  ctx.moveTo(52, 24);
  ctx.bezierCurveTo(50, 48, 60, 76, 62, 88);
  ctx.arc(74, 96, 14, Math.PI * 0.8, Math.PI * 1.9, false);
  ctx.bezierCurveTo(84, 78, 64, 48, 52, 24);
  ctx.closePath();
  ctx.fill();
}

/**
 * 7-sided jagged chiseled pebble with sharp paper-cut silhouette edges.
 */
function drawRock(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  // 7 sharp vertices
  ctx.moveTo(34, 88); // bottom-left
  ctx.lineTo(26, 62); // mid-left notch
  ctx.lineTo(44, 38); // top-left facet
  ctx.lineTo(72, 32); // top crest
  ctx.lineTo(98, 48); // top-right peak
  ctx.lineTo(102, 80); // mid-right facet
  ctx.lineTo(80, 94); // bottom-right base
  ctx.closePath();
  ctx.fill();
}

/**
 * Flying crow with angled V-wings and pointed beak.
 */
function drawCrow(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  // Left wing tip
  ctx.moveTo(18, 34);
  ctx.quadraticCurveTo(40, 44, 58, 64);
  // Head & pointed beak
  ctx.lineTo(76, 58);
  ctx.lineTo(92, 60); // beak tip
  ctx.lineTo(78, 66);
  // Right wing tip
  ctx.quadraticCurveTo(94, 46, 110, 34);
  ctx.quadraticCurveTo(90, 60, 72, 72);
  // Tail feathers
  ctx.lineTo(66, 92);
  ctx.lineTo(58, 92);
  ctx.lineTo(54, 72);
  // Body belly curve back to left wing
  ctx.quadraticCurveTo(34, 58, 18, 34);
  ctx.closePath();
  ctx.fill();
}

/**
 * Rabbit shadow puppet with long upright ears.
 */
function drawRabbit(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();

  // Two long upright ears
  ctx.moveTo(56, 16);
  ctx.quadraticCurveTo(52, 30, 58, 48); // ear 1 left
  ctx.quadraticCurveTo(62, 32, 64, 48); // notch between ears
  ctx.quadraticCurveTo(70, 20, 74, 18); // ear 2 tip
  ctx.quadraticCurveTo(76, 32, 70, 48); // ear 2 right

  // Head and muzzle
  ctx.quadraticCurveTo(86, 50, 88, 56);
  ctx.quadraticCurveTo(80, 64, 74, 66);

  // Front paws
  ctx.lineTo(78, 74);
  ctx.lineTo(72, 76);

  // Body & hind haunches
  ctx.quadraticCurveTo(78, 94, 76, 102);
  ctx.lineTo(44, 102);
  ctx.quadraticCurveTo(38, 88, 34, 82);

  // Fluffy tail
  ctx.arc(32, 88, 8, 0, Math.PI * 2);

  // Back curve up to neck
  ctx.quadraticCurveTo(40, 64, 56, 48);
  ctx.closePath();
  ctx.fill();
}

/**
 * Fox shadow puppet with sharp snout and bushy tail.
 */
function drawFox(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();

  // Triangular ears
  ctx.moveTo(56, 28);
  ctx.lineTo(62, 44);
  ctx.lineTo(68, 30);
  ctx.lineTo(74, 44);

  // Long sleek snout
  ctx.lineTo(96, 56); // snout tip
  ctx.lineTo(80, 64); // chin / throat

  // Chest & front legs
  ctx.lineTo(78, 98);
  ctx.lineTo(70, 98);
  ctx.lineTo(64, 76);

  // Belly & hind leg
  ctx.lineTo(52, 98);
  ctx.lineTo(44, 98);
  ctx.lineTo(40, 78);

  // Big arched bushy tail
  ctx.quadraticCurveTo(24, 72, 20, 52);
  ctx.quadraticCurveTo(26, 42, 32, 48);
  ctx.quadraticCurveTo(34, 64, 46, 68);

  // Backline up to neck
  ctx.quadraticCurveTo(48, 52, 56, 28);
  ctx.closePath();
  ctx.fill();
}

/**
 * Firefly glow circle with warm amber center and soft halo.
 */
function drawFirefly(ctx: CanvasRenderingContext2D): void {
  const cx = 64;
  const cy = 64;

  // Soft luminous radial halo
  if (ctx.createRadialGradient) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 54);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, '#ffdf80');
    grad.addColorStop(0.5, 'rgba(255, 223, 128, 0.45)');
    grad.addColorStop(1, 'rgba(255, 223, 128, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 54, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small dark silhouette body in center
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 5, 8, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Creates and returns the procedural CanvasTexture for the sprite atlas.
 */
export function createSpriteAtlas(customCanvas?: HTMLCanvasElement): CanvasTexture {
  let canvas = customCanvas;
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
  }
  if (!canvas) {
    // In headless test environments without DOM
    canvas = {
      width: ATLAS_SIZE,
      height: ATLAS_SIZE,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
  }

  renderSpriteAtlasToCanvas(canvas);

  const texture = new CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  return texture;
}
