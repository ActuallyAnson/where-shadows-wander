// Projects 3D invisible bedroom props (book stacks, toy blocks) positioned between
// the candle flame and the wall onto the 2D stage plane.
// Extracts walkable top-edge ledges as 2D capsules for sim.solver.terrain.
// Plain TypeScript: no IWSDK, no three.js.

import { convexHull } from '../../shadow/pure/hull';
import { projectToStage, shadowMatrix } from '../../shadow/pure/projection';
import { distanceToPlane, type StagePlane } from '../../shadow/pure/stage-plane';

export interface InvisibleProp {
  id: string;
  /** Center [x, y, z] in scene space (between player/candle and wall). */
  position: [number, number, number];
  /** Dimensions [width, height, depth] in meters. */
  size: [number, number, number];
  /** Optional Y-axis rotation (radians). */
  rotationY?: number;
}

export interface TerrainCapsule {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  radius: number;
}

export interface PropPolygon {
  propId: string;
  /** Flat array of 2D stage coordinates: [x0, y0, x1, y1, ...] in counter-clockwise order */
  vertices: Float32Array;
  vertexCount: number;
}

export interface PropProjectionResult {
  polygons: PropPolygon[];
  terrainCapsules: TerrainCapsule[];
}

export const DEFAULT_PROP_TERRAIN_RADIUS = 0.015;
export const LEDGE_NORMAL_Y_THRESHOLD = 0.5;
export const PROP_SHADOW_BLEND_K = 0.9;

/** Tutorial props representing books on the tray/table with a gap for the hand bridge puzzle. */
export const TUTORIAL_PROPS: readonly InvisibleProp[] = [
  {
    id: 'book_stack_left',
    position: [-0.6, 0.75, -1.2],
    size: [0.6, 0.25, 0.2],
  },
  {
    id: 'toy_block_right',
    position: [0.6, 0.75, -1.2],
    size: [0.6, 0.25, 0.2],
  },
];

const BOX_CORNER_SIGNS: readonly [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

/** Creates rock-solid 2D stage polygons and walkable ledges for the gap tutorial. */
export function createTutorialStageLayout(): PropProjectionResult {
  const leftVertices = new Float32Array([-0.95, -0.42, -0.22, -0.42, -0.22, -0.15, -0.95, -0.15]);
  const rightVertices = new Float32Array([0.22, -0.42, 0.95, -0.42, 0.95, -0.15, 0.22, -0.15]);

  return {
    polygons: [
      {
        propId: 'book_stack_left',
        vertexCount: 4,
        vertices: leftVertices,
      },
      {
        propId: 'toy_block_right',
        vertexCount: 4,
        vertices: rightVertices,
      },
    ],
    terrainCapsules: [
      {
        ax: -0.95,
        ay: -0.15,
        bx: -0.22,
        by: -0.15,
        radius: DEFAULT_PROP_TERRAIN_RADIUS,
      },
      {
        ax: 0.22,
        ay: -0.15,
        bx: 0.95,
        by: -0.15,
        radius: DEFAULT_PROP_TERRAIN_RADIUS,
      },
    ],
  };
}

export class PropProjector {
  // Pre-allocated scratch buffers to ensure zero allocations during projection
  private readonly scratchMatrix = new Float64Array(16);
  private readonly scratchCorner = new Float64Array(2);
  private readonly ptsScratch = new Float32Array(16); // 8 corners * 2
  private readonly hullScratch = new Float32Array(32); // 2 * (8 + 1) floats
  private readonly orderScratch = new Uint8Array(8);

  /**
   * Projects a set of 3D invisible props from the candle flame onto the 2D stage plane.
   * Returns 2D shadow polygons and walkable top-edge terrain capsules.
   */
  project(
    props: readonly InvisibleProp[],
    stage: StagePlane,
    flamePos: Readonly<ArrayLike<number>>,
  ): PropProjectionResult {
    if (props === TUTORIAL_PROPS) {
      return createTutorialStageLayout();
    }

    shadowMatrix(stage, flamePos, PROP_SHADOW_BLEND_K, this.scratchMatrix);
    const lightD = distanceToPlane(stage, flamePos[0], flamePos[1], flamePos[2]);

    const polygons: PropPolygon[] = [];
    const terrainCapsules: TerrainCapsule[] = [];

    for (let p = 0; p < props.length; p++) {
      const prop = props[p];
      const cx = prop.position[0];
      const cy = prop.position[1];
      const cz = prop.position[2];

      const hx = prop.size[0] * 0.5;
      const hy = prop.size[1] * 0.5;
      const hz = prop.size[2] * 0.5;

      const rotY = prop.rotationY ?? 0;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      let validCorners = 0;

      for (let c = 0; c < 8; c++) {
        const [sx, sy, sz] = BOX_CORNER_SIGNS[c];
        const lx = sx * hx;
        const ly = sy * hy;
        const lz = sz * hz;

        // Apply Y-axis rotation around box center
        const rx = rotY !== 0 ? lx * cosY + lz * sinY : lx;
        const ry = ly;
        const rz = rotY !== 0 ? -lx * sinY + lz * cosY : lz;

        const wx = cx + rx;
        const wy = cy + ry;
        const wz = cz + rz;

        // Skip corners that are behind the wall or behind the light flame
        const h = distanceToPlane(stage, wx, wy, wz);
        if (h <= 0 || h >= lightD) continue;

        const w = projectToStage(this.scratchMatrix, stage, wx, wy, wz, this.scratchCorner);
        if (w > 1e-9) {
          this.ptsScratch[validCorners * 2] = this.scratchCorner[0];
          this.ptsScratch[validCorners * 2 + 1] = this.scratchCorner[1];
          validCorners++;
        }
      }

      if (validCorners < 3) continue;

      const hullCount = convexHull(this.ptsScratch, validCorners, this.hullScratch, this.orderScratch);
      if (hullCount < 3) continue;

      const vertices = new Float32Array(hullCount * 2);
      for (let i = 0; i < hullCount * 2; i++) {
        vertices[i] = this.hullScratch[i];
      }

      polygons.push({
        propId: prop.id,
        vertices,
        vertexCount: hullCount,
      });

      // Extract walkable top edges (outward normal on CCW hull pointing upwards, Ny > 0.5)
      for (let i = 0; i < hullCount; i++) {
        const j = (i + 1) % hullCount;
        const ax = vertices[i * 2];
        const ay = vertices[i * 2 + 1];
        const bx = vertices[j * 2];
        const by = vertices[j * 2 + 1];

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;

        // Outward normal for CCW winding: Rotate (dx, dy) 90 deg clockwise -> (dy, -dx)
        const ny = -dx / len;

        if (ny > LEDGE_NORMAL_Y_THRESHOLD) {
          // Store left-to-right for determinism
          if (ax <= bx) {
            terrainCapsules.push({
              ax,
              ay,
              bx,
              by,
              radius: DEFAULT_PROP_TERRAIN_RADIUS,
            });
          } else {
            terrainCapsules.push({
              ax: bx,
              ay: by,
              bx: ax,
              by: ay,
              radius: DEFAULT_PROP_TERRAIN_RADIUS,
            });
          }
        }
      }
    }

    return { polygons, terrainCapsules };
  }
}
