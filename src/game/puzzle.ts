// The puzzle framework: what a puzzle is (PuzzleDef), and the runner that plays one — solution
// credit, the stuck timer and ghost hint, the win, and the pause before the next puzzle.
// Plain TypeScript; no allocation per step.
//
// A puzzle is "a single screen of the stage with one obstacle", and "every puzzle accepts at least
// two solutions" (GDD; the tutorial has one). The layout (pieces, gap/goal/plate markers) is written
// beside the puzzle in TypeScript, with the props whose shadows are its ground, or comes from a group
// in the chapter file (the older puzzles); everything that moves or reacts is the puzzle's code, in
// its hooks:
//   setup(ctx)      once on load: terrain, fixtures, spawns beyond the layout
//   step(ctx)       each fixed step before the traveller and the solver: hazards, wind, holds
//   afterStep(ctx)  each fixed step after the solver: react to contacts, open gates, credit solutions
//
// Win: the traveller reaches the goal marker. Which solution was used is decided by credit: the
// puzzle (and the runner, for the roles the traveller stands on) calls ctx.credit(id) with evidence
// while the player plays; at the win, the solution with the most credit is recorded. A win with no
// credit at all is a way nobody designed (players are inventive): it is recorded as OTHER_SOLUTION,
// not mislabelled as the intended one. Credit for an id that isn't one of the puzzle's solutions is
// ignored, so the runner can credit role names freely.
//
// Hint: when the traveller has been stuck (blocked, looking back, held or pushed) for `hintDelayS`
// (20 s by default; the tutorial sets it near 0), a `hint-show` event names the shape and where;
// `hint-hide` follows once it moves on or the puzzle is solved.

import type { Shape } from '../engine/hands/shapes';
import { HAND_COUNT, Touch } from '../engine/sim/solver';
import { ROLE_NAMES } from './abilities';
import type { GameContext } from './context';
import { markerOf, type LevelSource } from './level';

/**
 * A puzzle. Where its layout and ground come from is LevelSource: `layout` and `props` written in
 * TypeScript, or `layoutId`, a group in the chapter file ("puzzle-1"); `ground: false` drops the
 * ground line.
 */
export interface PuzzleDef extends LevelSource {
  /** Stable id, used in saves and events ("p1-gap"). */
  readonly id: string;
  readonly title: string;
  /** Solution ids, intended one first. */
  readonly solutions: readonly string[];
  /** The shape the ghost hint shows. */
  readonly hintShape: Shape;
  /** Seconds stuck before the hint (default HINT_DELAY_S). */
  readonly hintDelayS?: number;
  /** Top of the ground (default GROUND_Y). */
  readonly groundY?: number;
  setup?(ctx: GameContext): void;
  step?(ctx: GameContext): void;
  afterStep?(ctx: GameContext): void;
  /** Where the ghost hint goes; default: over the gap marker, or a little ahead of the traveller. */
  hintAt?(ctx: GameContext, out: Float64Array): void;
}

/** The solution recorded for a win no listed solution got credit for. */
export const OTHER_SOLUTION = 'other';
/** GDD: the ghost hint appears if the player is stuck for more than 20 seconds. */
export const HINT_DELAY_S = 20;
/** Seconds between the win and the next puzzle (the scene holds, the traveller rests). */
export const OUTRO_S = 2.5;
/** Seconds the traveller must keep moving before the hint is taken down. */
const HINT_HIDE_AFTER_S = 0.5;
const MAX_SOLUTIONS = 8;

export type PuzzlePhase = 'playing' | 'outro' | 'done';

export class PuzzleRunner {
  def: PuzzleDef | null = null;
  phase: PuzzlePhase = 'playing';
  /** Seconds in the current phase. */
  phaseT = 0;
  /** Seconds the traveller has been stuck, continuously. */
  stuckT = 0;
  hintVisible = false;
  /** The solution recorded at the win. */
  solvedWith = '';
  /** Credit per solution, by index in def.solutions. */
  readonly credits = new Float64Array(MAX_SOLUTIONS);
  private movingT = 0;
  private readonly hintPos = new Float64Array(2);

  start(def: PuzzleDef): void {
    if (def.solutions.length === 0 || def.solutions.length > MAX_SOLUTIONS)
      throw new RangeError(`${def.id}: needs 1 to ${MAX_SOLUTIONS} solutions`);
    this.def = def;
    this.phase = 'playing';
    this.phaseT = 0;
    this.stuckT = 0;
    this.movingT = 0;
    this.hintVisible = false;
    this.solvedWith = '';
    this.credits.fill(0);
  }

  credit(solution: string, amount: number): void {
    const sols = this.def?.solutions;
    if (!sols || this.phase !== 'playing') return;
    for (let i = 0; i < sols.length; i++) {
      if (sols[i] === solution) {
        this.credits[i] += amount;
        return;
      }
    }
  }

  /**
   * After everything else in the step: credits the role the traveller stands on, runs the hint
   * timer, and detects the win. @returns 'solved' on the step the traveller reaches the goal,
   * 'next' on the step the outro ends (load the next puzzle), otherwise null.
   */
  update(ctx: GameContext): 'solved' | 'next' | null {
    const def = this.def;
    if (!def) return null;
    this.phaseT += ctx.dt;
    if (this.phase === 'outro') {
      if (this.phaseT < OUTRO_S) return null;
      this.phase = 'done';
      this.phaseT = 0;
      return 'next';
    }
    if (this.phase === 'done') return null;

    const t = ctx.traveller;
    if (t.standingOn(ctx) === Touch.Hand) {
      const h = t.standingOnId(ctx);
      if (h >= 0 && h < HAND_COUNT) this.credit(ROLE_NAMES[ctx.abilities.hands[h].role], ctx.dt);
    }

    if (t.state === 'goal') {
      const best = this.best();
      this.solvedWith = this.credits[best] > 0 ? def.solutions[best] : OTHER_SOLUTION;
      this.phase = 'outro';
      this.phaseT = 0;
      if (this.hintVisible) this.hideHint(ctx);
      return 'solved';
    }

    const stuck = t.state === 'blocked' || t.state === 'look-back' || t.state === 'held' || t.state === 'pushed';
    if (stuck) {
      this.stuckT += ctx.dt;
      this.movingT = 0;
    } else {
      this.stuckT = 0;
      this.movingT += ctx.dt;
    }
    if (!this.hintVisible && this.stuckT >= (def.hintDelayS ?? HINT_DELAY_S)) {
      this.hintVisible = true;
      const p = this.hintPos;
      if (def.hintAt) def.hintAt(ctx, p);
      else defaultHintAt(ctx, p);
      ctx.events.push('hint-show', def.hintShape, ctx.time, 0, p[0], p[1]);
    } else if (this.hintVisible && this.movingT >= HINT_HIDE_AFTER_S) {
      this.hideHint(ctx);
    }
    return null;
  }

  private hideHint(ctx: GameContext): void {
    this.hintVisible = false;
    ctx.events.push('hint-hide', '', ctx.time);
  }

  private best(): number {
    let best = 0;
    const n = this.def!.solutions.length;
    for (let i = 1; i < n; i++) if (this.credits[i] > this.credits[best]) best = i;
    return best;
  }
}

/** Over the gap marker at ground height; with no gap, 0.25 m ahead of the traveller. */
export function defaultHintAt(ctx: GameContext, out: Float64Array): void {
  const gap = markerOf(ctx.layout, 'gap');
  if (gap) {
    out[0] = gap.x;
    out[1] = ctx.groundY;
    return;
  }
  const s = ctx.traveller.slot(ctx);
  out[0] = s < 0 ? 0 : ctx.store.x[s] + ctx.traveller.dir * 0.25;
  out[1] = ctx.groundY + 0.1;
}
