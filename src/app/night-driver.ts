// Plays the night (src/game) in the app: makes the Game when the opening ends, feeds it each frame,
// and turns its events into what the room shows and plays (docs/levels/night.md): the props'
// shadows, the hint ladder (the outline, the kindred's perch), the wall's mood per puzzle, the
// dimming before the fan, the return and the ending after the castle. main.ts makes one and calls
// frame() while the session is playing. Plain TypeScript: everything it touches comes in through
// NightHost, so main.ts keeps the views.
import type { HandShadow } from '../engine/hands/hand-shadow';
import type { ShapeEvent } from '../engine/hands/shape-events';
import type { Shape } from '../engine/hands/shapes';
import { createSilhouette, type Prop } from '../engine/shadow/pure/prop-shadow';
import { addPropTerrain } from '../engine/shadow/pure/prop-terrain';
import type { StagePlane } from '../engine/shadow/pure/stage-plane';
import { Game, type GameInput } from '../game/game';
import { createSceneProp, propToScene, type PropCaster } from '../game/props';
import { createNight } from '../game/puzzles/index';
import { SaveBridge, saveStateFrom, type SaveStore } from '../game/save-bridge';
import { newSave } from '../game/save-state';
import { Rewinder } from './rewinder';
import {
  DIMMING_LINE,
  LINE_DELAY_S,
  LINE_HOLD_S,
  lineForPuzzle,
  RETURN_LINE,
  WAKE_DELAY_S,
  WAKE_HOLD_S,
  wakeLineFor,
} from './story';

/** The wall's mood (0 cold .. 1 warm) on each puzzle: the colour script (docs/levels/night.md). */
export const NIGHT_MOOD: readonly number[] = [0.4, 0.55, 0.7, 0.45, 0.85];
/** The mood the return warms the room to, after the castle. */
export const RETURN_MOOD = 1;
/** The puzzle the dimming plays before (the fan): from it on, the kindred is away until the return. */
export const DIMMING_AT = 3;
/** Seconds of the return (the window lit, the kindred back) before the ending cutscene. */
export const RETURN_S = 3.5;

type Readable<E> = { readonly count: number; at(i: number): Readonly<E> };

/** What the driver needs from the app. main.ts fills it with its views, sounds and cutscenes. */
export interface NightHost {
  readonly stage: StagePlane;
  /** The candle flame's position, scene space: the light the props' shadows are cast from. */
  readonly flame: Readonly<ArrayLike<number>>;
  /** The shadow projector's blend (the hands' shadows use the same). */
  blend(): number;
  readonly saves: SaveStore;
  /** Draws the props' shadows (Anson's PropShadowView.setProps). */
  setProps(props: readonly Prop[], light: Readonly<ArrayLike<number>>, stage: StagePlane, blend: number): void;
  showHint(shape: Shape, x: number, y: number): void;
  hideHint(): void;
  /** The kindred flies to (x, y) on the stage and perches there until released. */
  perchKindred(x: number, y: number): void;
  releaseKindred(): void;
  /** The dimming: the candle gutters and the kindred darts away and hides. */
  dim(): void;
  /** The kindred stays away (true from the dimming until the return). */
  setKindredAway(away: boolean): void;
  setMood(goal: number): void;
  /** One short line of the story on the wall: after `delay` seconds, for `hold` seconds. */
  say(text: string, delay: number, hold: number, after?: boolean): void;
  /** Puzzle `index`'s scenery comes up on the paper (the last one slides away). */
  scenery(index: number): void;
  /** The reward for solving puzzle `index` plays where the traveller stands (gold dust, sparks, drops, leaves, light). */
  reward(index: number): void;
  /** The spark flies from the paper to sleeper `index` (0 = the lamp .. 4 = the window); the room lights it when it lands. */
  wake(index: number): void;
  /** How many things in the room are lit (one more each puzzle solved: 0 .. the number of puzzles). */
  setAwake(count: number): void;
  /** The solve moment: the chime, the bloom. */
  solved(): void;
  /** A soft sound and sparkle at (x, y): a puzzle object changed, or the obstacle eased. */
  twinkle(x: number, y: number): void;
  /** The night was turned back `seconds` (a fall, or a rewind asked for): a flash and a sound say so. */
  rewound?(seconds: number): void;
  /** Plays the ending cutscene, then calls onDone. */
  playEnding(onDone: () => void): void;
  /** The night is over: show the end screen. */
  nightOver(): void;
}

/** How far the night turns back when the traveller falls and "rewind on a fall" is on. */
export const FALL_REWIND_S = 3;

export class NightDriver {
  game: Game | null = null;
  /** When on, a fall turns the night back FALL_REWIND_S seconds (instead of leaving the traveller at the start of the puzzle). */
  rewindOnFall = false;
  private rewinder: Rewinder | null = null;
  private fell = false;
  private bridge: SaveBridge | null = null;
  private readonly input: GameInput = {
    dt: 0,
    paused: false,
    left: null,
    right: null,
    shapeEvents: null,
    leftTracked: true,
    rightTracked: true,
  };
  private readonly scene = createSceneProp();
  private readonly scratch = createSilhouette();
  private readonly caster: PropCaster;
  /** The puzzle shown last, to tell moving on (the dimming plays) from a restart or a resume. */
  private shownIndex = -1;
  /** Seconds into the return, or -1. */
  private returnT = -1;

  constructor(private readonly host: NightHost) {
    // Props' shadows become ground the same way they are drawn: from the flame, with the hands' blend.
    // It allocates a little per prop, on puzzle load only.
    this.caster = {
      cast: (p, tag, sink) =>
        addPropTerrain(
          { ...propToScene(p, host.stage, this.scene), solid: true, tag },
          host.flame,
          host.stage,
          host.blend(),
          sink,
          this.scratch,
        ),
    };
  }

  get started(): boolean {
    return this.game !== null;
  }

  /** Fixed steps run so far (for the diagnostics report). */
  get steps(): number {
    return this.game?.loop.steps ?? 0;
  }

  /** The renderer's interpolation factor for the last frame. */
  get alpha(): number {
    return this.game?.alpha ?? 0;
  }

  /**
   * Starts the night where the save left it (the first puzzle for a new player, or after a finished
   * night). Called when the opening ends; a second call does nothing.
   */
  start(): void {
    if (this.game) return;
    const puzzles = createNight();
    const ids = puzzles.map((p) => p.id);
    let save = saveStateFrom(this.host.saves, ids);
    if (save.chapterComplete || save.puzzle >= puzzles.length) save = newSave();
    this.game = new Game({ puzzles, save, caster: this.caster });
    this.bridge = new SaveBridge(this.host.saves, this.game);
    this.rewinder = new Rewinder();
  }

  /** Turns the night back `seconds` (the puzzle is reloaded and its recorded inputs played again, all but the last `seconds`). Returns whether it did. */
  rewind(seconds: number): boolean {
    const game = this.game;
    if (!game || !this.rewinder) return false;
    const gone = this.rewinder.rewind(game, seconds);
    if (gone > 0) this.host.rewound?.(gone);
    return gone > 0;
  }

  /** "Begin this puzzle again". */
  restart(): void {
    this.game?.restart();
  }

  /** "Begin again" after the end: the night from the first puzzle. */
  again(): void {
    if (!this.game) return this.start();
    this.returnT = -1;
    this.shownIndex = -1;
    this.game.goto(0);
  }

  /** The flame or the wall moved: cast the current puzzle's props again (it restarts the puzzle). */
  relight(): void {
    if (this.game && !this.game.complete) this.game.restart();
  }

  /** Once a display frame while the session plays. Returns the interpolation factor. */
  frame(
    dt: number,
    paused: boolean,
    left: HandShadow | null,
    right: HandShadow | null,
    shapeEvents: Readable<ShapeEvent> | null,
    leftTracked: boolean,
    rightTracked: boolean,
  ): number {
    const game = this.game;
    if (!game) return 0;
    const input = this.input;
    input.dt = dt;
    input.paused = paused;
    input.left = left;
    input.right = right;
    input.shapeEvents = shapeEvents;
    input.leftTracked = leftTracked;
    input.rightTracked = rightTracked;
    this.rewinder?.record(input);
    const alpha = game.frame(input);
    this.bridge?.update();
    this.readEvents(game);
    if (this.fell) {
      this.fell = false;
      if (this.rewindOnFall) this.rewind(FALL_REWIND_S);
    }
    if (this.returnT >= 0 && !paused) {
      this.returnT += dt;
      if (this.returnT >= RETURN_S) {
        this.returnT = -1;
        this.host.playEnding(() => this.host.nightOver());
      }
    }
    return alpha;
  }

  private readEvents(game: Game): void {
    const host = this.host;
    const ev = game.events;
    for (let i = 0; i < ev.count; i++) {
      const e = ev.at(i);
      switch (e.type) {
        case 'puzzle-start':
          this.rewinder?.begin(e.value, game.time);
          this.puzzleStarted(game, e.value);
          break;
        case 'traveller-fell':
          this.fell = true;
          break;
        case 'puzzle-solved': {
          host.solved();
          host.reward(e.value);
          host.wake(e.value); // the spark flies to the sleeper, and the room lights it when it lands
          if (e.value + 1 < NIGHT_MOOD.length) host.say(wakeLineFor(e.value), WAKE_DELAY_S, WAKE_HOLD_S);
          // Each solve warms the wall one step, except into the fan: the dimming cools it instead.
          const next = e.value + 1;
          if (next < NIGHT_MOOD.length && next !== DIMMING_AT) host.setMood(NIGHT_MOOD[next]);
          break;
        }
        case 'chapter-complete': {
          // The return: the room fills with light, the kindred comes back to the lit window.
          host.setMood(RETURN_MOOD);
          host.say(RETURN_LINE, 0.5, 3);
          host.setKindredAway(false);
          const w = game.fixtures.find('window');
          if (w) host.perchKindred(w.x, w.y + w.h / 2 + 0.04);
          this.returnT = 0;
          break;
        }
        case 'hint-show':
          host.showHint(e.id as Shape, e.x, e.y);
          break;
        case 'hint-kindred':
          host.perchKindred(e.x, e.y + 0.09);
          break;
        case 'hint-hide':
          host.hideHint();
          host.releaseKindred();
          break;
        case 'hint-ease':
          host.twinkle(e.x, e.y);
          break;
        case 'puzzle-event':
          if (e.id === 'gate-open') host.twinkle(e.x, e.y + 0.1);
          break;
        default:
          break;
      }
    }
  }

  private puzzleStarted(game: Game, index: number): void {
    const host = this.host;
    if (index === DIMMING_AT && this.shownIndex === DIMMING_AT - 1) host.dim();
    host.setKindredAway(index >= DIMMING_AT);
    host.setAwake(index);
    host.scenery(index);
    if (index === DIMMING_AT && this.shownIndex === DIMMING_AT - 1) host.say(DIMMING_LINE, 1.5, 4);
    else host.say(lineForPuzzle(index), LINE_DELAY_S, LINE_HOLD_S, true); // after the last wake line has been written
    host.setMood(NIGHT_MOOD[Math.min(index, NIGHT_MOOD.length - 1)]);
    host.hideHint();
    host.releaseKindred();
    this.shownIndex = index;
    // Draw this puzzle's props' shadows, ground and scenery alike (allocates: once per load).
    const props: Prop[] = [];
    for (const p of game.puzzle.props ?? []) {
      const s = propToScene(p, host.stage, createSceneProp());
      props.push({ shape: s.shape, position: s.position, size: s.size, rotation: s.rotation });
    }
    host.setProps(props, host.flame, host.stage, host.blend());
  }
}
