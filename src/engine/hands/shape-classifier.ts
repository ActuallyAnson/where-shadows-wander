// Hold-to-commit shape recognition for one hand (GDD, "Pose classifier").
// Plain TypeScript: no IWSDK, no three.js. Allocates nothing per update.
//
//   idle -> candidate (a clear winner; the hold timer runs) -> committed
//
// - A candidate must stay inside its normal ranges for the whole hold (it
//   matches continuously). A committed shape stays while it's inside ranges
//   widened by `hysteresis` units, so a hand near a boundary doesn't flicker.
// - Switching: when the committed shape X has drifted outside its normal
//   ranges and another shape Y leads it by the ambiguity gap, Y is held as a
//   candidate and replaces X only when Y commits (release(switch) then commit,
//   in one update), so there's no gap between roles.
// - Gating: with any joint missing the classifier pauses, freezing the hold
//   and the committed shape. A pause longer than `freezeS` cancels a
//   candidate; longer than `lostReleaseS` releases the committed shape. It
//   never commits while paused.
import type { Handedness } from './hand';
import type { HandFeatures } from './hand-features';
import { createShapeState, type ShapeEventQueue, type ShapeState } from './shape-events';
import { clearWinner, FEATURE_COUNT, packFeatures, shapeMargins } from './shape-ranges';
import { COMPANION_SHAPES, SHAPES } from './shapes';

export interface ClassifierConfig {
  /** Seconds a verb shape (flat, fist, cup, spread) must be held to commit. */
  verbHoldS: number;
  /** Seconds a companion shape (rabbit, fox) must be held to commit. */
  companionHoldS: number;
  /** Accessibility tolerance, 1 = normal; each step above 1 widens every range by one unit. */
  tolerance: number;
  /** Extra units a candidate or committed shape keeps before it lets go. */
  hysteresis: number;
  /** A shape must lead every other matching shape by this many units to be picked. */
  ambiguityGap: number;
  /** A tracking dropout longer than this cancels a candidate (seconds). */
  freezeS: number;
  /** A tracking dropout longer than this releases the committed shape (seconds). */
  lostReleaseS: number;
}

export const DEFAULT_CLASSIFIER_CONFIG: Readonly<ClassifierConfig> = {
  verbHoldS: 0.4,
  companionHoldS: 1,
  tolerance: 1,
  hysteresis: 1,
  ambiguityGap: 0.25,
  freezeS: 0.2,
  lostReleaseS: 0.5,
};

/**
 * Longest step an update may take, so a long stall can't commit a shape in one
 * go. Below 10 updates a second (a struggling webcam), holds take longer in real time.
 */
const MAX_DT = 0.1;
const IS_COMPANION = SHAPES.map((s) => COMPANION_SHAPES.includes(s));

export class ShapeClassifier {
  readonly config: ClassifierConfig;
  readonly state: ShapeState;
  /** Each shape's margin on its normal ranges this update (SHAPES order), for the UI. */
  readonly margins = new Float32Array(SHAPES.length);
  private readonly keep = new Float32Array(SHAPES.length);
  private readonly packed = new Float32Array(FEATURE_COUNT);
  private candidate = -1;
  private committed = -1;
  private heldS = 0;
  private pausedS = 0;

  constructor(
    readonly hand: Handedness,
    config: Partial<ClassifierConfig> = {},
  ) {
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };
    this.state = createShapeState(hand);
  }

  /**
   * @param features this frame's features, or null when tracking is partial
   * @param dt seconds since the previous update
   * @param t the caller's clock, seconds, stamped on events
   */
  update(features: HandFeatures | null, validJoints: number, dt: number, t: number, events: ShapeEventQueue): void {
    dt = Math.min(Math.max(dt, 0), MAX_DT);
    const c = this.config;
    this.state.validJoints = validJoints;

    if (!features) {
      this.pausedS += dt;
      if (this.candidate >= 0 && this.pausedS > c.freezeS) {
        events.push('cancel', this.hand, SHAPES[this.candidate], t, 0, this.heldS);
        this.candidate = -1;
        this.heldS = 0;
      }
      if (this.committed >= 0 && this.pausedS > c.lostReleaseS) {
        events.push('release', this.hand, SHAPES[this.committed], t, 0, 0, 'lost');
        this.committed = -1;
      }
      this.margins.fill(-Infinity);
      return this.writeState(true);
    }
    this.pausedS = 0;

    packFeatures(features, this.packed);
    const widen = c.tolerance - 1;
    shapeMargins(this.packed, widen, this.margins);
    shapeMargins(this.packed, widen + c.hysteresis, this.keep);
    const winner = clearWinner(this.margins, c.ambiguityGap);

    // The committed shape lets go once it's outside even its widened ranges.
    if (this.committed >= 0 && this.keep[this.committed] < 0) {
      events.push('release', this.hand, SHAPES[this.committed], t, this.keep[this.committed], 0, 'exit');
      this.committed = -1;
    }

    if (this.candidate >= 0) {
      const y = this.candidate;
      if (this.margins[y] < 0) {
        events.push('cancel', this.hand, SHAPES[y], t, this.margins[y], this.heldS);
        this.candidate = -1;
        this.heldS = 0;
      } else if (winner >= 0 && winner !== y && this.margins[winner] >= this.margins[y] + c.ambiguityGap) {
        events.push('cancel', this.hand, SHAPES[y], t, this.margins[y], this.heldS);
        this.candidate = -1;
        this.heldS = 0;
        // The new leader may be the shape that's already committed: then there's nothing to hold.
        if (winner !== this.committed) this.startCandidate(winner, t, events);
      } else {
        this.heldS += dt;
      }
    }
    if (this.candidate < 0 && winner >= 0 && winner !== this.committed) {
      // With a shape committed, a new one must clearly beat it before its hold starts.
      if (this.committed < 0 || this.margins[winner] >= this.keep[this.committed] + c.ambiguityGap)
        this.startCandidate(winner, t, events);
    }

    // The epsilon stops float rounding (24 × 1/60 is just under 0.4) costing a frame.
    if (this.candidate >= 0 && this.heldS >= this.holdS(this.candidate) - 1e-6) {
      if (this.committed >= 0)
        events.push('release', this.hand, SHAPES[this.committed], t, this.keep[this.committed], 0, 'switch');
      this.committed = this.candidate;
      events.push('commit', this.hand, SHAPES[this.committed], t, this.margins[this.committed], this.heldS);
      this.candidate = -1;
      this.heldS = 0;
    }
    this.writeState(false);
  }

  /** Forgets everything without events, e.g. when the hand source changes. */
  reset(): void {
    this.candidate = this.committed = -1;
    this.heldS = this.pausedS = 0;
    this.margins.fill(-Infinity);
    this.writeState(false);
  }

  private startCandidate(i: number, t: number, events: ShapeEventQueue): void {
    this.candidate = i;
    this.heldS = 0;
    events.push('candidate', this.hand, SHAPES[i], t, this.margins[i], 0);
  }

  private holdS(i: number): number {
    return IS_COMPANION[i] ? this.config.companionHoldS : this.config.verbHoldS;
  }

  private writeState(paused: boolean): void {
    const s = this.state;
    s.candidate = this.candidate >= 0 ? SHAPES[this.candidate] : null;
    s.committed = this.committed >= 0 ? SHAPES[this.committed] : null;
    s.phase = paused ? 'paused' : this.candidate >= 0 ? 'candidate' : this.committed >= 0 ? 'committed' : 'idle';
    s.progress =
      this.candidate >= 0 ? Math.min(this.heldS / this.holdS(this.candidate), 1) : this.committed >= 0 ? 1 : 0;
    s.margin = paused
      ? 0
      : this.candidate >= 0
        ? this.margins[this.candidate]
        : this.committed >= 0
          ? this.margins[this.committed]
          : 0;
  }
}
