// Allocation-free state machine for Puzzle 1 (the wordless gap tutorial).
// Connects the Traveller, invisible prop ledges, flat-hand shadow bridge, ghost target,
// and audio into the first end-to-end playable loop.
// Plain TypeScript: pure game logic, no IWSDK, no three.js, no engine-facing imports.

import type { Handedness } from '../engine/hands/hand';
import type { HandShadow } from '../engine/hands/hand-shadow';
import type { ShapeClassifier } from '../engine/hands/shape-classifier';
import type { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import type { Shape } from '../engine/hands/shapes';
import { Flag, Kind } from '../engine/sim/entity-kinds';
import { NULL_HANDLE, type EntityStore, type Handle } from '../engine/sim/entity-store';
import { LEFT, RIGHT, type Solver } from '../engine/sim/solver';

export type TutorialState = 'IDLE' | 'WALK_TO_GAP' | 'WAIT_AT_GAP' | 'CROSSING_BRIDGE' | 'GOAL_REACHED';

export const OVERLAP_TOLERANCE_M = 0.1;

export const TUTORIAL_CONFIG = {
  SPAWN_X: -0.75,
  SPAWN_Y: -0.05,
  TRAVELLER_RADIUS: 0.04,
  WALK_SPEED: 0.18,
  GAP_WAIT_X: -0.22,
  BRIDGE_TARGET_X: 0.0,
  BRIDGE_TARGET_Y: -0.15,
  GOAL_X: 0.65,
  HOP_VELOCITY_Y: 0.8,
  RESPAWN_Y: -1.0,
} as const;

export interface GhostTargetController {
  active: boolean;
  x: number;
  y: number;
  readonly triggered: boolean;
  readonly matchedHand: Handedness | null;
  setTarget(id: string, x: number, y: number, requiredShape?: Shape): void;
}

export interface TutorialAudio {
  bridgeActivated?(): void;
  puzzleSolved?(): void;
}

export class TutorialFlow {
  private _state: TutorialState = 'IDLE';
  private travellerHandle: Handle = NULL_HANDLE;
  private bridgeHand: Handedness = 'right';
  private _isBridgeActive = false;

  get state(): TutorialState {
    return this._state;
  }

  get travellerX(): number {
    const s = this.store.slotOf(this.travellerHandle);
    return s >= 0 ? this.store.x[s] : 0;
  }

  get travellerY(): number {
    const s = this.store.slotOf(this.travellerHandle);
    return s >= 0 ? this.store.y[s] : 0;
  }

  get isGrounded(): boolean {
    const s = this.store.slotOf(this.travellerHandle);
    return s >= 0 ? (this.store.flags[s] & Flag.Grounded) !== 0 : false;
  }

  get isBridgeActive(): boolean {
    return this._isBridgeActive;
  }

  get handle(): Handle {
    return this.travellerHandle;
  }

  constructor(
    readonly store: EntityStore,
    readonly solver: Solver,
    readonly ghostTarget: GhostTargetController,
    readonly audio?: TutorialAudio,
  ) {
    this.ghostTarget.active = false;
  }

  /**
   * Starts or restarts the tutorial loop, spawning the Traveller onto the left ledge.
   */
  start(): void {
    if (this.travellerHandle !== NULL_HANDLE && this.store.isAlive(this.travellerHandle)) {
      this.store.destroy(this.travellerHandle);
    }

    this.travellerHandle = this.store.create(
      Kind.Traveller,
      TUTORIAL_CONFIG.SPAWN_X,
      TUTORIAL_CONFIG.SPAWN_Y,
      TUTORIAL_CONFIG.TRAVELLER_RADIUS,
    );

    this._state = 'WALK_TO_GAP';
    this._isBridgeActive = false;
    this.solver.hands[LEFT].mask = 0;
    this.solver.hands[RIGHT].mask = 0;
    this.ghostTarget.active = false;
  }

  /**
   * Resets Traveller position if they fall off the stage.
   */
  respawn(): void {
    const s = this.store.slotOf(this.travellerHandle);
    if (s >= 0) {
      this.store.x[s] = TUTORIAL_CONFIG.SPAWN_X;
      this.store.y[s] = TUTORIAL_CONFIG.SPAWN_Y;
      this.store.px[s] = TUTORIAL_CONFIG.SPAWN_X;
      this.store.py[s] = TUTORIAL_CONFIG.SPAWN_Y;
      this.store.vx[s] = 0;
      this.store.vy[s] = 0;
      this.store.flags[s] &= ~Flag.WaitPose;
    }
    this._state = 'WALK_TO_GAP';
    this._isBridgeActive = false;
    this.solver.hands[LEFT].mask = 0;
    this.solver.hands[RIGHT].mask = 0;
    this.ghostTarget.active = false;
  }

  /**
   * Per-frame state update and physics/hand synchronization.
   * Zero per-frame allocations.
   */
  update(
    _delta: number,
    shadows: Readonly<Record<Handedness, HandShadow>>,
    shapes: ShapeRecognizer | Readonly<Record<Handedness, ShapeClassifier>>,
  ): void {
    if (this._state === 'IDLE') return;

    // Slot check
    const s = this.store.slotOf(this.travellerHandle);
    if (s < 0) {
      this.start();
      return;
    }

    const x = this.store.x[s];
    const y = this.store.y[s];

    // Fall recovery
    if (y < TUTORIAL_CONFIG.RESPAWN_Y) {
      this.respawn();
      return;
    }

    switch (this._state) {
      case 'WALK_TO_GAP': {
        // Walk rightward toward the gap
        this.store.vx[s] = TUTORIAL_CONFIG.WALK_SPEED;
        this.store.flags[s] &= ~Flag.WaitPose;

        if (x >= TUTORIAL_CONFIG.GAP_WAIT_X) {
          // Reached the edge of the gap! Stop, wait, and activate ghost hint.
          this.store.vx[s] = 0;
          this.store.flags[s] |= Flag.WaitPose;
          this._state = 'WAIT_AT_GAP';

          this.ghostTarget.setTarget(
            'tutorial_bridge_hint',
            TUTORIAL_CONFIG.BRIDGE_TARGET_X,
            TUTORIAL_CONFIG.BRIDGE_TARGET_Y,
            'flat',
          );
          this.ghostTarget.active = true;
        }
        break;
      }

      case 'WAIT_AT_GAP': {
        this.store.vx[s] = 0;
        this.store.flags[s] |= Flag.WaitPose;

        // Check if player's flat hand triggered the ghost target
        const matchedHand = this.detectFlatHandOverGap(shadows, shapes);
        if (this.ghostTarget.triggered || matchedHand !== null) {
          this.bridgeHand = matchedHand ?? this.ghostTarget.matchedHand ?? 'right';
          this.activateBridge(shadows);
          this._state = 'CROSSING_BRIDGE';
          this.store.vx[s] = TUTORIAL_CONFIG.WALK_SPEED;
          this.store.flags[s] &= ~Flag.WaitPose;
          this.audio?.bridgeActivated?.();
        }
        break;
      }

      case 'CROSSING_BRIDGE': {
        // Maintain hand collider while player holds flat hand
        this.maintainBridge(shadows, shapes);

        // Keep moving forward across the bridge
        this.store.vx[s] = TUTORIAL_CONFIG.WALK_SPEED;

        // Check if Traveller has reached the goal ledge
        if (x >= TUTORIAL_CONFIG.GOAL_X) {
          this._state = 'GOAL_REACHED';
          this.store.vx[s] = 0;
          this.store.vy[s] = TUTORIAL_CONFIG.HOP_VELOCITY_Y; // Victory hop!
          this._isBridgeActive = false;
          this.solver.hands[LEFT].mask = 0;
          this.solver.hands[RIGHT].mask = 0;
          this.ghostTarget.active = false;
          this.audio?.puzzleSolved?.();
        }
        break;
      }

      case 'GOAL_REACHED': {
        // Rest on goal ledge
        this.store.vx[s] = 0;
        break;
      }
    }
  }

  private detectFlatHandOverGap(
    shadows: Readonly<Record<Handedness, HandShadow>>,
    shapes: ShapeRecognizer | Readonly<Record<Handedness, ShapeClassifier>>,
  ): Handedness | null {
    const hands: readonly Handedness[] = ['left', 'right'];
    for (let i = 0; i < 2; i++) {
      const h = hands[i];
      const shadow = shadows[h];
      if (!shadow || !shadow.active || !shadow.onStage) continue;

      const cx = (shadow.bounds[0] + shadow.bounds[2]) * 0.5;
      const cy = (shadow.bounds[1] + shadow.bounds[3]) * 0.5;
      const dist = Math.hypot(cx - TUTORIAL_CONFIG.BRIDGE_TARGET_X, cy - TUTORIAL_CONFIG.BRIDGE_TARGET_Y);

      if (dist <= OVERLAP_TOLERANCE_M) {
        const classifier = 'left' in shapes && 'right' in shapes ? shapes[h] : null;
        if (classifier?.state?.committed === 'flat') {
          return h;
        }
      }
    }
    return null;
  }

  private activateBridge(shadows: Readonly<Record<Handedness, HandShadow>>): void {
    const handIdx = this.bridgeHand === 'left' ? LEFT : RIGHT;
    const shadow = shadows[this.bridgeHand];
    if (shadow && shadow.active && shadow.onStage) {
      this.solver.hands[handIdx].copyFrom(true, shadow.capsules, shadow.bounds);
      this.solver.hands[handIdx].mask = 1 << Kind.Traveller;
      this._isBridgeActive = true;
    }
  }

  private maintainBridge(
    shadows: Readonly<Record<Handedness, HandShadow>>,
    shapes: ShapeRecognizer | Readonly<Record<Handedness, ShapeClassifier>>,
  ): void {
    const handIdx = this.bridgeHand === 'left' ? LEFT : RIGHT;
    const shadow = shadows[this.bridgeHand];
    const classifier = 'left' in shapes && 'right' in shapes ? shapes[this.bridgeHand] : null;
    const isFlat = classifier?.state?.committed === 'flat';

    if (shadow && shadow.active && shadow.onStage && isFlat) {
      this.solver.hands[handIdx].copyFrom(true, shadow.capsules, shadow.bounds);
      this.solver.hands[handIdx].mask = 1 << Kind.Traveller;
      this._isBridgeActive = true;
    } else {
      // Bridge lost
      this.solver.hands[handIdx].mask = 0;
      this._isBridgeActive = false;
    }
  }
}
