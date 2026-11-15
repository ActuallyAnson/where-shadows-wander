// The game's audio events: what makes which sound, and where it seems to come from. Shape events make a paper
// rustle (recognised) and a thump (committed) at the hand's shadow on the wall; the candle whooshes when lit and
// crackles from the flame while it burns; the rain and the music are beds under it all.
// Talks to a SoundPlayer (the Web Audio engine), so it is testable with a recording fake.
import type { Handedness } from '../../hands/hand';
import type { HandShadow } from '../../hands/hand-shadow';
import type { ShapeEventQueue } from '../../hands/shape-events';
import type { StagePlane } from '../../shadow/pure/stage-plane';
import { Sound, soundForShapeEvent, type SoundId } from './sounds';
import { stagePoint } from './stage-point';

export interface SoundPlayer {
  playAt(id: SoundId, x: number, y: number, z: number, key?: number): boolean;
  setLoop(id: SoundId, on: boolean, x: number, y: number, z: number): void;
  moveLoop(id: SoundId, x: number, y: number, z: number): void;
}

/** Sounds from the wall come from this far in front of it, metres, so they are not inside the paper. */
const WALL_LIFT_M = 0.05;

export class GameAudio {
  private readonly at = { x: 0, y: 0, z: 0 };
  private flameLit = false;
  private raining = false;
  private music = false;

  constructor(private readonly player: SoundPlayer) {}

  /** Plays the sound for each event in `events`, from where that hand's shadow is on `stage`. */
  onShapeEvents(events: ShapeEventQueue, shadows: Readonly<Record<Handedness, HandShadow>>, stage: StagePlane): void {
    for (let i = 0; i < events.count; i++) {
      const e = events.at(i);
      const id = soundForShapeEvent(e.type, e.reason);
      if (id === null) continue;
      this.fromShadow(shadows[e.hand], e.hand, stage);
      this.player.playAt(id, this.at.x, this.at.y, this.at.z, e.hand === 'left' ? 0 : 1);
    }
  }

  /** Plays the ignition whoosh when the candle is lit. */
  candleIgnited(at?: ArrayLike<number> | { x: number; y: number; z: number }): void {
    if (at) {
      const x = 'x' in at ? at.x : at[0];
      const y = 'y' in at ? at.y : at[1];
      const z = 'z' in at ? at.z : at[2];
      this.player.playAt(Sound.Ignite, x, y, z);
    } else {
      this.player.playAt(Sound.Ignite, 0, 0.75, -0.45);
    }
  }

  /** A soft footstep (0 or 1, the two alternated) from the stage point (`sx`, `sy`) on `stage`: a story scene's cue. */
  storyStep(variant: number, stage: StagePlane, sx = 0, sy = 0): void {
    stagePoint(stage, sx, sy, WALL_LIFT_M, this.at);
    this.player.playAt(variant === 1 ? Sound.Step1 : Sound.Step0, this.at.x, this.at.y, this.at.z);
  }

  /** Call every frame: the crackle plays while the flame is lit, from the flame. `flame` is its scene position. */
  setFlame(lit: boolean, flame: ArrayLike<number>): void {
    if (lit && !this.flameLit) this.player.setLoop(Sound.Crackle, true, flame[0], flame[1], flame[2]);
    else if (!lit && this.flameLit) this.player.setLoop(Sound.Crackle, false, flame[0], flame[1], flame[2]);
    if (lit) this.player.moveLoop(Sound.Crackle, flame[0], flame[1], flame[2]);
    this.flameLit = lit;
  }

  /** Call every frame: the rain plays while `on`, from the window (`at`, its world position). */
  setRain(on: boolean, at: Readonly<{ x: number; y: number; z: number }>): void {
    if (on !== this.raining) this.player.setLoop(Sound.Rain, on, at.x, at.y, at.z);
    else if (on) this.player.moveLoop(Sound.Rain, at.x, at.y, at.z);
    this.raining = on;
  }

  /** Call every frame: the music plays while `on` (it is flat, so it has no place in the room), once its file has loaded. */
  setMusic(on: boolean): void {
    if (on !== this.music) this.player.setLoop(Sound.Music, on, 0, 0, 0);
    this.music = on;
  }

  /** Thunder far off, from the window's side (`at`, its world position). */
  thunder(at: Readonly<{ x: number; y: number; z: number }>): void {
    this.player.playAt(Sound.Thunder, at.x, at.y, at.z);
  }

  /** The bedclothes sliding as he sits up, from his lap (`at`, its world position). */
  covers(at: ArrayLike<number>): void {
    this.player.playAt(Sound.Covers, at[0], at[1], at[2]);
  }

  /** Puts the middle of a hand's shadow (or its side of the wall when it has none) into `this.at`. */
  private fromShadow(shadow: HandShadow, hand: Handedness, stage: StagePlane): void {
    let sx: number;
    let sy: number;
    if (shadow.active) {
      sx = (shadow.bounds[0] + shadow.bounds[2]) / 2;
      sy = (shadow.bounds[1] + shadow.bounds[3]) / 2;
    } else {
      sx = (hand === 'left' ? -0.25 : 0.25) * stage.width;
      sy = 0;
    }
    const hw = stage.width / 2;
    const hh = stage.height / 2;
    sx = sx < -hw ? -hw : sx > hw ? hw : sx;
    sy = sy < -hh ? -hh : sy > hh ? hh : sy;
    stagePoint(stage, sx, sy, WALL_LIFT_M, this.at);
  }
}
