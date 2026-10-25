// Draws all active gameplay entities (Traveller, Rock, Raindrop, Crow, Rabbit, Fox, Firefly)
// on the stage in 1 single Three.js draw call using an InstancedMesh and the procedural
// in-memory sprite atlas.
//
// Layered directly in front of the paper wall and hand shadows (SHADOW_RENDER_ORDER + 1).
// Interpolates entity positions between simulation steps with `alpha` for smooth 72/90 Hz VR.
// Zero per-frame allocations.

import {
  CanvasTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import { SHADOW_RENDER_ORDER } from '../shadow/shadow-renderer';
import { Flag, Kind } from '../sim/entity-kinds';
import type { EntityStore } from '../sim/entity-store';
import { WALK_CYCLE } from '../shadow/traveller-art';
import { createSpriteAtlas, getTileForKind, GRID_ROWS } from './sprite-atlas';

export const MAX_STAGE_INSTANCES = 256;
export const SPRITE_RENDER_ORDER = SHADOW_RENDER_ORDER + 1; // 3
export const SPRITE_Z_OFFSET = 0.0025; // in front of shadow plane (0.002)

// Module-level pre-allocated variables for zero per-frame garbage.
const scratchPos = new Vector3();
const scratchRot = new Quaternion();
const scratchScale = new Vector3();
const scratchMatrix = new Matrix4();

function insertAfter(source: string, target: string, insertion: string): string {
  const index = source.indexOf(target);
  if (index === -1) return source;
  const split = index + target.length;
  return source.slice(0, split) + '\n' + insertion + source.slice(split);
}

export class StageRenderer {
  readonly mesh: InstancedMesh;
  readonly geometry: PlaneGeometry;
  readonly material: MeshBasicMaterial;
  readonly texture: CanvasTexture;

  private readonly uvArray: Float32Array;
  private readonly uvAttr: InstancedBufferAttribute;
  private _liveCount = 0;
  private readonly ownsTexture: boolean;

  constructor(parent?: Object3D, atlasTexture?: CanvasTexture) {
    this.ownsTexture = !atlasTexture;
    this.texture = atlasTexture ?? createSpriteAtlas();

    this.geometry = new PlaneGeometry(1, 1);
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });

    // Custom shader injection for per-instance atlas UV transformation
    this.material.customProgramCacheKey = () => 'wsw-stage-renderer';
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = insertAfter(
        insertAfter(shader.vertexShader, '#include <common>', 'attribute vec4 aAtlasUv;'),
        '#include <uv_vertex>',
        '#ifdef USE_MAP\n\tvMapUv = uv * aAtlasUv.zw + aAtlasUv.xy;\n#endif',
      );
    };

    this.mesh = new InstancedMesh(this.geometry, this.material, MAX_STAGE_INSTANCES);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = SPRITE_RENDER_ORDER;
    this.mesh.count = 0;

    // Allocate per-instance UV attribute: [uOffset, vOffset, uScale, vScale]
    this.uvArray = new Float32Array(MAX_STAGE_INSTANCES * 4);
    this.uvAttr = new InstancedBufferAttribute(this.uvArray, 4);
    this.geometry.setAttribute('aAtlasUv', this.uvAttr);

    if (parent) parent.add(this.mesh);
  }

  /**
   * How many entity instances were rendered on the most recent frame.
   */
  get liveCount(): number {
    return this._liveCount;
  }

  /**
   * Updates all live entity transforms and sprite atlas UVs for this frame.
   *
   * @param store The gameplay entity store
   * @param alpha Simulation interpolation factor in [0, 1) from FixedStepLoop.advance()
   *
   * Zero per-frame allocations.
   */
  update(store: EntityStore, alpha: number): void {
    let liveCount = 0;
    const capacity = store.capacity;
    const clampedAlpha = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
    const invGridRows = 1.0 / GRID_ROWS;

    for (let s = 0; s < capacity && liveCount < MAX_STAGE_INSTANCES; s++) {
      if (store.alive[s] === 0) continue;
      if ((store.flags[s] & Flag.Hidden) !== 0) continue;

      const px = store.px[s];
      const py = store.py[s];
      const x = store.x[s];
      const y = store.y[s];
      const vx = store.vx[s];
      const vy = store.vy[s];
      const radius = store.radius[s];
      const kind = store.kind[s];

      // Smooth interpolation between previous and current simulation step
      const renderX = px + (x - px) * clampedAlpha;
      const renderY = py + (y - py) * clampedAlpha;

      // Entity size in stage metres (diameter = radius * 2)
      const r = radius > 0 ? radius : 0.05;
      const sizeX = r * 2;
      const sizeY = r * 2;

      // Compose instance matrix
      scratchPos.set(renderX, renderY, SPRITE_Z_OFFSET);
      scratchRot.identity();
      scratchScale.set(sizeX, sizeY, 1);
      scratchMatrix.compose(scratchPos, scratchRot, scratchScale);
      this.mesh.setMatrixAt(liveCount, scratchMatrix);

      // Determine animation frame & tile
      let animFrame = 0;
      if (kind === Kind.Traveller) {
        if ((store.flags[s] & Flag.WaitPose) !== 0) {
          animFrame = 3; // wait pose: looking back toward player
        } else {
          const speed = Math.hypot(vx, vy);
          if (speed > 0.05) {
            // Walk animation cadence based on stage position
            animFrame = WALK_CYCLE[Math.floor(Math.abs(renderX) * 16) % WALK_CYCLE.length];
          } else {
            animFrame = 0; // idle
          }
        }
      }

      const tile = getTileForKind(kind, animFrame);
      const baseCol = tile.col;
      const baseRow = tile.row;

      let uScale = 0.25;
      let uOffset = baseCol * 0.25;

      // Mirror horizontally if moving left
      if (vx < -0.01) {
        uScale = -0.25;
        uOffset = (baseCol + 1) * 0.25;
      }

      const vScale = 0.25;
      const vOffset = (GRID_ROWS - 1 - baseRow) * invGridRows;

      const o = liveCount * 4;
      this.uvArray[o] = uOffset;
      this.uvArray[o + 1] = vOffset;
      this.uvArray[o + 2] = uScale;
      this.uvArray[o + 3] = vScale;

      liveCount++;
    }

    this._liveCount = liveCount;
    this.mesh.count = liveCount;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
  }

  /**
   * Frees allocated WebGL resources.
   */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    if (this.ownsTexture) this.texture.dispose();
  }
}
