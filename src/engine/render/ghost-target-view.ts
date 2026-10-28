// Visual ghost target outline and gesture trigger detector for Where Shadows Wander puzzles.
// Renders a dashed sepia hand silhouette on the wall stage (dark enough to read on the cream paper; lying on
// its side for the flat shape, as a bridge is), detects when the
// player's hand shadow overlaps it with the required committed shape, and fires a gameplay trigger.
//
// Zero per-frame allocations.

import { BufferAttribute, BufferGeometry, LineDashedMaterial, LineLoop, Object3D } from '@iwsdk/core';
import type { Handedness } from '../hands/hand';
import type { HandShadow } from '../hands/hand-shadow';
import type { ShapeClassifier } from '../hands/shape-classifier';
import type { ShapeRecognizer } from '../hands/shape-recognizer';
import type { Shape } from '../hands/shapes';
import { SHADOW_RENDER_ORDER } from '../shadow/shadow-renderer';

export const GHOST_RENDER_ORDER = SHADOW_RENDER_ORDER + 2; // 4
export const OVERLAP_RADIUS_M = 0.1; // 10 cm tolerance
export const DEFAULT_HOLD_DURATION_S = 0.3; // 300 ms dwell to trigger
/** Dark sepia: a pale amber outline vanished on the cream paper. */
export const GHOST_COLOR = 0x4a3018;

/**
 * 2D contour polygon of a child hand silhouette (~0.22m tall, ~0.14m wide).
 */
export const FLAT_HAND_CONTOUR: readonly [number, number][] = [
  [-0.025, -0.11], // wrist inner
  [0.025, -0.11], // wrist outer
  [0.055, -0.04], // outer palm lower
  [0.06, 0.01], // pinky base
  [0.065, 0.065], // pinky tip
  [0.042, 0.035], // pinky-ring notch
  [0.04, 0.095], // ring tip
  [0.02, 0.04], // ring-middle notch
  [0.005, 0.11], // middle tip
  [-0.015, 0.04], // middle-index notch
  [-0.03, 0.095], // index tip
  [-0.038, 0.01], // index-thumb notch
  [-0.07, -0.01], // thumb tip
  [-0.065, -0.05], // thumb knuckle
  [-0.035, -0.09], // inner wrist transition
];

export interface GhostTargetConfig {
  targetId?: string;
  x?: number;
  y?: number;
  requiredShape?: Shape;
  holdDuration?: number;
  onTrigger?: (targetId: string) => void;
  active?: boolean;
}

export class GhostTargetView {
  readonly mesh: LineLoop;
  readonly geometry: BufferGeometry;
  readonly material: LineDashedMaterial;

  targetId: string;
  x: number;
  y: number;
  requiredShape: Shape;
  holdDuration: number;
  active: boolean;
  triggered = false;
  holdTimer = 0;
  matchedHand: Handedness | null = null;
  onTrigger: ((targetId: string) => void) | null = null;

  private time = 0;

  constructor(parent?: Object3D, config: GhostTargetConfig = {}) {
    this.targetId = config.targetId ?? 'target_0';
    this.x = config.x ?? 0;
    this.y = config.y ?? 0;
    this.requiredShape = config.requiredShape ?? 'flat';
    this.holdDuration = config.holdDuration ?? DEFAULT_HOLD_DURATION_S;
    this.active = config.active ?? true;
    this.onTrigger = config.onTrigger ?? null;

    // Build dashed line geometry
    const positions = new Float32Array(FLAT_HAND_CONTOUR.length * 3);
    for (let i = 0; i < FLAT_HAND_CONTOUR.length; i++) {
      positions[i * 3 + 0] = FLAT_HAND_CONTOUR[i][0];
      positions[i * 3 + 1] = FLAT_HAND_CONTOUR[i][1];
      positions[i * 3 + 2] = 0.003; // slightly in front of shadow (0.002) and sprites (0.0025)
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(positions, 3));

    this.material = new LineDashedMaterial({
      color: GHOST_COLOR,
      dashSize: 0.012,
      gapSize: 0.008,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    });

    this.mesh = new LineLoop(this.geometry, this.material);
    this.mesh.computeLineDistances();
    this.mesh.renderOrder = GHOST_RENDER_ORDER;
    this.mesh.frustumCulled = false;
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.visible = this.active;

    if (parent) parent.add(this.mesh);
  }

  /**
   * Repositions or reconfigures the ghost target on the stage.
   */
  setTarget(id: string, x: number, y: number, requiredShape: Shape = 'flat'): void {
    this.targetId = id;
    this.x = x;
    this.y = y;
    this.requiredShape = requiredShape;
    this.triggered = false;
    this.holdTimer = 0;
    this.matchedHand = null;
    this.active = true;
    this.mesh.position.set(x, y, 0);
    // A flat hand is a plank, so its outline lies on its side (fingers to the right); the others stand upright.
    this.mesh.rotation.z = requiredShape === 'flat' ? -Math.PI / 2 : 0;
    this.mesh.visible = true;
  }

  /**
   * Per-frame update for breathing animation, shadow overlap, and gesture commit check.
   * Zero per-frame allocations.
   */
  update(
    delta: number,
    shadows: Readonly<Record<Handedness, HandShadow>>,
    shapes: ShapeRecognizer | Readonly<Record<Handedness, ShapeClassifier>>,
  ): void {
    if (!this.active) {
      this.mesh.visible = false;
      return;
    }

    this.mesh.visible = true;
    this.time += delta;

    // Check both hands for overlap and committed gesture
    let matched = false;
    let matchingHand: Handedness | null = null;
    const hands: readonly Handedness[] = ['left', 'right'];

    for (let i = 0; i < 2; i++) {
      const h = hands[i];
      const shadow = shadows[h];
      if (!shadow || !shadow.active || !shadow.onStage) continue;

      // Centroid of shadow on wall
      const cx = (shadow.bounds[0] + shadow.bounds[2]) * 0.5;
      const cy = (shadow.bounds[1] + shadow.bounds[3]) * 0.5;
      const dist = Math.hypot(cx - this.x, cy - this.y);

      if (dist <= OVERLAP_RADIUS_M) {
        // Hand shadow is hovering within 10cm of target!
        const classifier = 'left' in shapes && 'right' in shapes ? shapes[h] : null;
        const committedShape = classifier?.state?.committed;

        if (committedShape === this.requiredShape) {
          matched = true;
          matchingHand = h;
          break;
        }
      }
    }
    this.matchedHand = matchingHand;

    if (matched) {
      this.holdTimer += delta;
      if (this.holdTimer >= this.holdDuration) {
        // Snapped solid gold
        this.material.opacity = 1.0;
        if (!this.triggered) {
          this.triggered = true;
          this.onTrigger?.(this.targetId);
        }
      } else {
        const progress = this.holdTimer / this.holdDuration;
        this.material.opacity = 0.5 + 0.5 * progress;
      }
    } else {
      if (!this.triggered) {
        this.holdTimer = Math.max(0, this.holdTimer - delta * 2);
        // Breathing opacity
        this.material.opacity = 0.6 + 0.2 * Math.sin(this.time * 3);
      }
    }
  }

  /**
   * Frees allocated WebGL resources.
   */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
