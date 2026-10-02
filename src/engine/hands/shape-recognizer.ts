// Runs the shape classifier on both hands each frame: features, then the
// hold-to-commit state machine, with this frame's events in one queue.
// Plain TypeScript: no IWSDK, no three.js. Allocates nothing per update.
import type { HandFrame, Handedness, Vec3 } from './hand';
import { CalibrationRun, createCurlBias, type CurlBias } from './hand-calibration';
import { computeHandFeatures, createHandFeatures, WORLD_UP, type HandFeatures } from './hand-features';
import { ShapeClassifier, type ClassifierConfig } from './shape-classifier';
import { ShapeEventQueue } from './shape-events';
import { SHAPES, type Shape } from './shapes';

export const MAX_TOLERANCE = 3;

export class ShapeRecognizer {
  readonly left: ShapeClassifier;
  readonly right: ShapeClassifier;
  /** This update's events from both hands. Reused: read them before the next update. */
  readonly events = new ShapeEventQueue(16);
  /** The latest features per hand (stale while that hand is paused). */
  readonly features: Record<Handedness, HandFeatures> = { left: createHandFeatures(), right: createHandFeatures() };
  /** Whether each hand's features are from this frame (false while it's paused, when they're stale). */
  readonly valid: Record<Handedness, boolean> = { left: false, right: false };
  /** Commits per shape since start, for diagnostics. */
  readonly commits = Object.fromEntries(SHAPES.map((s) => [s, 0])) as Record<Shape, number>;
  /** The stage's normal; up for the tabletop theatre. StageFrame sets it for the wall stage. */
  readonly stageNormal: Vec3 = [...WORLD_UP];
  /** Each hand's baseline finger curl (hand-calibration.ts); zeros until calibrated. */
  readonly calibration: Record<Handedness, CurlBias> = { left: createCurlBias(), right: createCurlBias() };
  /** A calibration in progress, if any; read its state and progress for the UI. */
  calibrating: CalibrationRun | null = null;
  private readonly raw = createHandFeatures();
  private lastT = NaN;

  constructor(config: Partial<ClassifierConfig> = {}) {
    this.left = new ShapeClassifier('left', config);
    this.right = new ShapeClassifier('right', config);
  }

  /** @param t the caller's clock, seconds (mock time in the Hand Lab, so pausing freezes holds). */
  update(hands: Readonly<Record<Handedness, HandFrame>>, t: number): void {
    this.events.clear();
    const dt = Number.isNaN(this.lastT) ? 0 : t - this.lastT;
    this.lastT = t;
    this.step(this.left, hands.left, dt, t);
    this.step(this.right, hands.right, dt, t);
    for (let i = 0; i < this.events.count; i++) {
      const e = this.events.at(i);
      if (e.type === 'commit') this.commits[e.shape]++;
    }
  }

  /** Starts calibrating `hand`: hold it flat for CALIBRATION_HOLD_S. The result is applied when done. */
  startCalibration(hand: Handedness): CalibrationRun {
    this.calibrating = new CalibrationRun(hand);
    return this.calibrating;
  }

  /** Sets (or with null, clears) a hand's calibration, e.g. one saved earlier. */
  setCalibration(hand: Handedness, bias: ArrayLike<number> | null): void {
    const c = this.calibration[hand];
    for (let i = 0; i < c.length; i++) c[i] = bias ? bias[i] : 0;
  }

  setStageNormal(n: Readonly<Vec3>): void {
    this.stageNormal[0] = n[0];
    this.stageNormal[1] = n[1];
    this.stageNormal[2] = n[2];
  }

  /**
   * Accessibility: 1 = normal, up to MAX_TOLERANCE; each step widens every
   * shape's ranges by one unit. Beyond that the shapes overlap too much to tell apart.
   */
  setTolerance(tolerance: number): void {
    this.left.config.tolerance = this.right.config.tolerance = Math.min(Math.max(tolerance, 1), MAX_TOLERANCE);
  }

  setHoldTimes(verbS: number, companionS: number): void {
    for (const c of [this.left, this.right]) {
      c.config.verbHoldS = verbS;
      c.config.companionHoldS = companionS;
    }
  }

  /** Forgets both hands' state without events, e.g. when the hand source changes. */
  reset(): void {
    this.left.reset();
    this.right.reset();
    this.lastT = NaN;
  }

  private step(c: ShapeClassifier, hand: HandFrame, dt: number, t: number): void {
    const run = this.calibrating;
    if (run && run.hand === c.hand && run.state === 'collecting') {
      if (run.add(computeHandFeatures(hand, this.raw, this.stageNormal), dt) === 'done')
        this.setCalibration(c.hand, run.bias);
    }
    const f = computeHandFeatures(hand, this.features[c.hand], this.stageNormal, this.calibration[c.hand]);
    this.valid[c.hand] = f !== null;
    c.update(f, hand.validJoints, dt, t, this.events);
  }
}
