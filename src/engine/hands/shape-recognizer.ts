// Runs the shape classifier on both hands each frame: features, then the
// hold-to-commit state machine, with this frame's events in one queue.
// Plain TypeScript: no IWSDK, no three.js. Allocates nothing per update.
import type { HandFrame, Handedness, Vec3 } from './hand';
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
  /** Commits per shape since start, for diagnostics. */
  readonly commits = Object.fromEntries(SHAPES.map((s) => [s, 0])) as Record<Shape, number>;
  /** The stage's normal; up for the tabletop theatre. StageFrame sets it for the wall stage. */
  readonly stageNormal: Vec3 = [...WORLD_UP];
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
    const f = computeHandFeatures(hand, this.features[c.hand], this.stageNormal);
    c.update(f, hand.validJoints, dt, t, this.events);
  }
}
