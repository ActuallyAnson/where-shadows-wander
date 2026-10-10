// The game: one object main.ts drives with one call a frame (ADR 0008). Owns the fixed-step loop,
// the entity store, the solver, the traveller, the abilities, the companions and the puzzle runner,
// and plays a chapter's puzzles in order. Plain TypeScript; per-frame and per-step code builds no
// objects (puzzle loads do, between puzzles).
//
// Each display frame, Game.frame(input):
//   1. clears last frame's events;
//   2. if paused, stops (and on resume drops the time that passed, so nothing jumps);
//   3. latches this frame's shape and gesture events, copies both hand shadows into the solver;
//   4. runs 0..N fixed steps and returns the interpolation factor for the renderer.
//
// Each fixed step:
//   hand events → abilities (roles), discovery     (only the first step after a frame captures them)
//   store.beginStep()
//   abilities.beforeSolve   hands solid to what their roles say
//   puzzle.step             hazards, wind, holds
//   creatures, traveller, companions think          set speeds
//   solver.step
//   abilities.afterSolve    catching, carrying, splashes on hands
//   puzzle.afterStep        contacts, gates, credit
//   traveller.after, companions.after, creatures.after
//   runner.update           credit, hint, win, outro → next puzzle

import type { GestureEvent } from '../engine/hands/gesture-events';
import type { HandShadow } from '../engine/hands/hand-shadow';
import type { ShapeEvent } from '../engine/hands/shape-events';
import { DEFAULT_CAPACITIES, Kind, KIND_COUNT } from '../engine/sim/entity-kinds';
import { EntityStore } from '../engine/sim/entity-store';
import { FixedStepLoop } from '../engine/sim/fixed-step';
import { InputLatch } from '../engine/sim/input-latch';
import { Rng } from '../engine/sim/rng';
import type { ParsedLayout } from '../engine/sim/scene-layout';
import { defaultSolverConfig, Solver, type SolverConfig } from '../engine/sim/solver';
import { Abilities } from './abilities';
import { Companions } from './companions';
import type { GameContext } from './context';
import { Creatures } from './creatures';
import { Discovery } from './discovery';
import { Fixtures } from './fixtures';
import { GameEventQueue } from './game-events';
import { GROUND_Y, loadPuzzle, markerOf } from './level';
import { PuzzleRunner, type PuzzleDef } from './puzzle';
import { addSolution, newSave, readSave, type SaveState } from './save-state';
import { Traveller } from './traveller';

/** The sim's fixed rate (main.ts's SIM_HZ). */
export const SIM_HZ = 60;
/** At most this many steps a frame; a longer stall drops time instead of catching up in a burst. */
export const MAX_STEPS_PER_FRAME = 4;

type Readable<E> = { readonly count: number; at(i: number): Readonly<E> };

/** What main.ts hands the game each display frame. */
export interface GameInput {
  /** Seconds since the last frame. */
  dt: number;
  /** The session is hidden or the player covered the flame: the world holds still. */
  paused: boolean;
  /** This frame's hand shadows in stage space (ShadowProjector.shadows), or null. */
  left: HandShadow | null;
  right: HandShadow | null;
  /** This frame's classifier events (ShapeRecognizer.events). */
  shapeEvents: Readable<ShapeEvent> | null;
  /** This frame's lantern gestures (GestureDetector.events); latched for gameplay that wants them. */
  gestureEvents?: Readable<GestureEvent> | null;
}

export interface GameOptions {
  /** The parsed chapter scene file (public/scenes/chapter-1.iwsdk.scene.json). */
  chapter: unknown;
  /** The chapter's puzzles in order. */
  puzzles: readonly PuzzleDef[];
  chapterId?: string;
  /** Seed for the puzzles' random numbers (each puzzle reseeds from it, so a restart replays). */
  seed?: number;
  /** Progress to resume from (readSave()); a new save if omitted. */
  save?: SaveState;
}

/** Game-wide solver tuning: what falls, what flies, what collides with what. */
export function gameSolverConfig(): SolverConfig {
  const cfg = defaultSolverConfig();
  const bit = (k: number) => 1 << k;
  const walkers = bit(Kind.Traveller) | bit(Kind.Rock) | bit(Kind.Rabbit) | bit(Kind.Fox);
  cfg.kindGravity[Kind.Crow] = 0;
  cfg.kindGravity[Kind.Firefly] = 0;
  // Drops start falling fast and speed up gently: rain should read as rain, not hail.
  cfg.kindGravity[Kind.Raindrop] = 0.5;
  cfg.kindCollides.fill(0);
  for (const k of [Kind.Traveller, Kind.Rock, Kind.Rabbit, Kind.Fox])
    cfg.kindCollides[k] = walkers | bit(Kind.Raindrop);
  cfg.kindCollides[Kind.Traveller] |= bit(Kind.Crow);
  cfg.kindCollides[Kind.Raindrop] = walkers;
  cfg.kindCollides[Kind.Crow] = bit(Kind.Traveller);
  cfg.terrainMask = ((1 << KIND_COUNT) - 1) & ~bit(Kind.Crow) & ~bit(Kind.Firefly);
  return cfg;
}

export class Game implements GameContext {
  readonly store = new EntityStore(DEFAULT_CAPACITIES);
  readonly solver = new Solver(this.store.capacity, gameSolverConfig());
  readonly rng = new Rng(1);
  readonly events = new GameEventQueue(128);
  readonly fixtures = new Fixtures();
  readonly traveller = new Traveller();
  readonly abilities = new Abilities();
  readonly companions = new Companions();
  readonly creatures: Creatures;
  readonly runner = new PuzzleRunner();
  readonly discovery: Discovery;
  readonly save: SaveState;
  readonly loop: FixedStepLoop;
  readonly latch = new InputLatch();
  readonly dt: number;

  layout: ParsedLayout = { entities: [], markers: [], problems: [] };
  groundY = GROUND_Y;
  time = 0;
  puzzleTime = 0;
  /** Index of the current puzzle in `puzzles`. */
  puzzleIndex = 0;
  /** True once the last puzzle is solved: the final scene stays painted on the stage. */
  complete = false;

  private readonly chapter: unknown;
  private readonly puzzles: readonly PuzzleDef[];
  private readonly seed: number;
  private wasPaused = false;
  private pendingLoad = -1;
  /** Events were queued outside frame() (by a load) and the next frame must not clear them. */
  private keepEvents = false;

  constructor(opts: GameOptions) {
    if (opts.puzzles.length === 0) throw new RangeError('a chapter needs at least one puzzle');
    this.chapter = opts.chapter;
    this.puzzles = opts.puzzles;
    this.seed = opts.seed ?? 1;
    // A copy: the game changes its save as the player progresses, and the caller's object (say, a
    // replay's options) must stay as it was.
    this.save = opts.save ? readSave(opts.save, opts.save.chapter) : newSave(opts.chapterId);
    this.discovery = new Discovery(this.save);
    this.creatures = new Creatures(this.store.capacity);
    this.loop = new FixedStepLoop(SIM_HZ, (dt) => this.step(dt), MAX_STEPS_PER_FRAME);
    this.dt = this.loop.step;
    this.complete = this.save.chapterComplete && this.save.puzzle >= this.puzzles.length;
    this.load(Math.min(this.save.puzzle, this.puzzles.length - 1));
  }

  /** The puzzle being played. */
  get puzzle(): PuzzleDef {
    return this.puzzles[this.puzzleIndex];
  }

  get puzzleCount(): number {
    return this.puzzles.length;
  }

  /** The interpolation factor for drawing entity state (px + (x - px) * alpha). */
  get alpha(): number {
    return this.loop.alpha;
  }

  /** Once per display frame. @returns the interpolation factor for the renderer. */
  frame(input: GameInput): number {
    // A load between frames (constructor, restart, goto) queued its events for this frame to deliver.
    if (this.keepEvents) this.keepEvents = false;
    else this.events.clear();
    // Latch first: a shape committed or released while paused still counts once play resumes.
    this.latch.capture(input.shapeEvents, input.gestureEvents ?? null);
    if (input.paused) {
      this.wasPaused = true;
      return this.loop.alpha;
    }
    if (this.wasPaused) {
      // Resume where it stopped: no catch-up for the time spent paused.
      this.loop.reset();
      this.wasPaused = false;
    }
    if (this.pendingLoad >= 0) {
      const i = this.pendingLoad;
      this.pendingLoad = -1;
      this.load(i, true);
    }
    this.abilities.setShadows(input.left, input.right, input.dt, this.solver.hands);
    return this.loop.advance(input.dt);
  }

  credit(solution: string, amount = 1): void {
    this.runner.credit(solution, amount);
  }

  /** Restarts the current puzzle (debug, or a "try again" gesture). */
  restart(): void {
    this.load(this.puzzleIndex);
  }

  /** Jumps to a puzzle by index (debug and chapter select). */
  goto(index: number): void {
    if (!(index >= 0 && index < this.puzzles.length)) throw new RangeError(`no puzzle ${index}`);
    this.complete = false;
    this.load(index);
  }

  private step(dt: number): void {
    this.time += dt;
    this.puzzleTime += dt;
    const shapes = this.latch.shapes;
    for (let i = 0; i < shapes.count; i++) {
      const e = shapes.at(i);
      this.discovery.onShapeEvent(e, this);
      this.abilities.onShapeEvent(e, this);
    }
    this.latch.consume();

    this.store.beginStep();
    this.abilities.beforeSolve(this);
    const def = this.puzzle;
    if (!this.complete) def.step?.(this);
    this.creatures.think(this);
    this.traveller.think(this);
    this.companions.think(this);
    this.solver.step(this.store, dt);
    this.abilities.afterSolve(this);
    if (!this.complete) def.afterStep?.(this);
    this.traveller.after(this);
    this.companions.after(this);
    this.creatures.after(this);
    if (this.complete) return;
    const result = this.runner.update(this);
    if (result === 'solved') this.solved();
    else if (result === 'next') this.next();
  }

  private solved(): void {
    const def = this.puzzle;
    const with_ = this.runner.solvedWith;
    const fresh = addSolution(this.save, def.id, with_);
    this.events.push('puzzle-solved', with_, this.time, this.puzzleIndex, fresh ? 1 : 0);
    if (this.puzzleIndex + 1 < this.puzzles.length) this.save.puzzle = this.puzzleIndex + 1;
  }

  private next(): void {
    if (this.puzzleIndex + 1 >= this.puzzles.length) {
      this.complete = true;
      this.save.chapterComplete = true;
      this.save.puzzle = this.puzzles.length;
      const window = this.fixtures.find('window');
      if (window) window.active = true;
      this.events.push('chapter-complete', this.save.chapter, this.time);
      return;
    }
    // Load between frames, not mid-step: the store is cleared and the renderer must see a clean cut.
    this.pendingLoad = this.puzzleIndex + 1;
  }

  /**
   * Loads puzzle `index` (allocates: layouts, terrain, fixtures). `inFrame`: called from frame(),
   * whose events are delivered anyway; otherwise the next frame keeps them.
   */
  private load(index: number, inFrame = false): void {
    // Between frames, the queue still holds the last frame's events, already read: start afresh.
    if (!inFrame) this.events.clear();
    if (this.runner.hintVisible) this.events.push('hint-hide', '', this.time);
    const def = this.puzzles[index];
    this.puzzleIndex = index;
    this.groundY = def.groundY ?? GROUND_Y;
    const loaded = loadPuzzle(this.chapter, def.layoutId, this.store, this.solver, [], this.groundY);
    if (loaded.layout.problems.length > 0) console.warn(`${def.layoutId}:`, loaded.layout.problems.join('; '));
    this.layout = loaded.layout;
    this.puzzleTime = 0;
    this.rng.state = (this.seed * 2654435761 + index * 40503) >>> 0;
    this.fixtures.clear();
    this.latch.clear();
    // Roles stay: the classifier still holds its commits across a load, and will release them later.
    this.abilities.resetForPuzzle();
    this.companions.reset();
    this.traveller.spawn(this, markerOf(this.layout, 'goal'));
    this.runner.start(def);
    def.setup?.(this);
    this.discovery.setup(def, this);
    // After setup, so fireflies a puzzle spawns itself also get their home.
    this.creatures.settle(this.store);
    if (index === this.puzzles.length - 1 && !this.fixtures.find('window')) {
      // The chapter ends at a lit window by the last goal (GDD): drawn dark until the end.
      const goal = markerOf(this.layout, 'goal');
      if (goal) this.fixtures.add('window', goal.x, goal.y + 0.25, 0.16, 0.2, this.complete);
    }
    this.events.push('puzzle-start', def.id, this.time, index);
    if (!inFrame) this.keepEvents = true;
  }
}
