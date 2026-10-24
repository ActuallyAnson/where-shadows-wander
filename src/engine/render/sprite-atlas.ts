// Procedural in-memory sprite atlas for Where Shadows Wander entities.
// Generates a 512x512 CanvasTexture divided into a 4x4 grid of 128x128 sprite cells.
// Zero external file dependencies (0 ms download delay, 0 bundle bytes).
//
// Grid layout:
// Row 0: [0,0] Traveller Idle  | [1,0] Traveller Walk 1 | [2,0] Traveller Walk 2 | [3,0] Traveller Wait
// Row 1: [0,1] Raindrop        | [1,1] Jagged Rock      | [2,1] Flying Crow      | [3,1] Rabbit
// Row 2: [0,2] Fox             | [1,2] Firefly          | [2,2] Reserved         | [3,2] Reserved
// Row 3: Reserved

import { CanvasTexture, LinearFilter } from '@iwsdk/core';
import { Kind } from '../sim/entity-kinds';

export const ATLAS_SIZE = 512;
export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const CELL_SIZE = 128; // 512 / 4

export const SpriteTile = {
  TravellerIdle: { col: 0, row: 0 },
  TravellerWalk1: { col: 1, row: 0 },
  TravellerWalk2: { col: 2, row: 0 },
  TravellerWait: { col: 3, row: 0 },
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

/**
 * Selects the sprite tile for a given Entity Kind and optional animation frame.
 */
export function getTileForKind(kind: number, animFrame = 0): { col: number; row: number } {
  switch (kind) {
    case Kind.Traveller:
      // animFrame: 0 = idle, 1 = walk1, 2 = walk2, 3 = wait
      return { col: Math.abs(animFrame | 0) % 4, row: 0 };
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

  // Row 0: Traveller animation frames
  drawCell(ctx, 0, 0, (c) => drawTraveller(c, 0));
  drawCell(ctx, 1, 0, (c) => drawTraveller(c, 1));
  drawCell(ctx, 2, 0, (c) => drawTraveller(c, 2));
  drawCell(ctx, 3, 0, (c) => drawTraveller(c, 3));

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
): void {
  ctx.save();
  ctx.translate(col * CELL_SIZE, row * CELL_SIZE);
  drawFn(ctx);
  ctx.restore();
}

/**
 * Storybook hooded pilgrim with pointed cowl, walking boots, and a warm amber lantern opening.
 */
function drawTraveller(ctx: CanvasRenderingContext2D, frame: number): void {
  ctx.fillStyle = '#000000';

  // Hood & pointed cowl
  ctx.beginPath();
  if (frame === 3) {
    // Wait / looking back over shoulder: cowl leans slightly back
    ctx.moveTo(56, 24);
    ctx.quadraticCurveTo(72, 30, 80, 48);
    ctx.lineTo(44, 48);
    ctx.quadraticCurveTo(46, 30, 56, 24);
  } else {
    // Forward-facing pointed cowl
    ctx.moveTo(64, 22);
    ctx.quadraticCurveTo(76, 28, 80, 48);
    ctx.lineTo(46, 48);
    ctx.quadraticCurveTo(52, 28, 64, 22);
  }
  ctx.fill();

  // Face shadow opening (cowl hollow)
  ctx.beginPath();
  ctx.arc(63, 40, 8, 0, Math.PI * 2);
  ctx.fill();

  // Cloak & robe body
  ctx.beginPath();
  ctx.moveTo(48, 48);
  ctx.lineTo(78, 48);

  if (frame === 1) {
    // Walk frame 1: forward stride
    ctx.quadraticCurveTo(86, 72, 92, 96);
    ctx.lineTo(36, 96);
    ctx.quadraticCurveTo(42, 72, 48, 48);
  } else if (frame === 2) {
    // Walk frame 2: passing stride
    ctx.quadraticCurveTo(82, 72, 86, 96);
    ctx.lineTo(40, 96);
    ctx.quadraticCurveTo(44, 72, 48, 48);
  } else {
    // Idle / wait
    ctx.quadraticCurveTo(84, 72, 88, 96);
    ctx.lineTo(38, 96);
    ctx.quadraticCurveTo(42, 72, 48, 48);
  }
  ctx.closePath();
  ctx.fill();

  // Boots
  ctx.beginPath();
  if (frame === 1) {
    // Stride forward: front foot extended, back foot trailing
    // Back foot
    ctx.rect(38, 96, 12, 14);
    // Front foot
    ctx.rect(74, 96, 16, 14);
  } else if (frame === 2) {
    // Passing stride
    ctx.rect(48, 96, 14, 14);
    ctx.rect(66, 96, 14, 14);
  } else {
    // Idle boots
    ctx.rect(46, 96, 14, 14);
    ctx.rect(66, 96, 14, 14);
  }
  ctx.fill();

  // Small transparent hole at hands with warm amber glowing dot
  const lanternX = frame === 3 ? 54 : 70;
  const lanternY = 66;

  // Clear aperture hole through cloak
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(lanternX, lanternY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Warm amber shining lantern dot
  ctx.fillStyle = '#ffdf80';
  ctx.beginPath();
  ctx.arc(lanternX, lanternY, 4, 0, Math.PI * 2);
  ctx.fill();
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
