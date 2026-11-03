// The game's audio events: what makes which sound, and where it seems to come from. Shape events make a paper
// rustle (recognised) and a thump (committed) at the hand's shadow on the wall; a solved puzzle rings a chime
// from the top of the wall; a lit flame crackles from the flame. Teammate A's puzzle code calls `puzzleSolved`.
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
  /** Where the room's ambient sounds sit (scene space): the clock at the back of the room, the wind at the window. */
  private readonly clockAt = { x: -1.4, y: 1.9, z: 0.8 };
  private readonly windAt = { x: -1.95, y: 1.4, z: -0.8 };

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

  /** The chime for a solved puzzle, from the top middle of the wall. */
  puzzleSolved(stage?: StagePlane): void {
    if (stage) {
      stagePoint(stage, 0, stage.height * 0.35, WALL_LIFT_M, this.at);
      this.player.playAt(Sound.Chime, this.at.x, this.at.y, this.at.z);
    } else {
      this.player.playAt(Sound.Chime, 0, 1.8, -2.0);
    }
  }

  /** Plays a soft paper rustle when the hand bridge activates on the stage. */
  bridgeActivated(stage?: StagePlane, x = 0, y = 0): void {
    if (stage) {
      stagePoint(stage, x, y, WALL_LIFT_M, this.at);
      this.player.playAt(Sound.Rustle, this.at.x, this.at.y, this.at.z);
    } else {
      this.player.playAt(Sound.Rustle, x, 1.4 + y, -2.0);
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

  /** The spirit fox's sparkle, from a point on the wall (stage coordinates). */
  twinkleAt(stage: StagePlane, x: number, y: number): void {
    stagePoint(stage, x, y, WALL_LIFT_M, this.at);
    this.player.playAt(Sound.Twinkle, this.at.x, this.at.y, this.at.z);
  }

  /** A rabbit landing at a point on the wall (stage coordinates). */
  hopAt(stage: StagePlane, x: number, y: number): void {
    stagePoint(stage, x, y, WALL_LIFT_M, this.at);
    this.player.playAt(Sound.Hop, this.at.x, this.at.y, this.at.z);
  }

  /** One of the lullaby's five notes (0..4), from a point in the room (`x`, `y`, `z`, scene space): the sleeper it wakes. */
  lullabyNote(index: number, x: number, y: number, z: number): void {
    const i = index < 0 ? 0 : index > 4 ? 4 : Math.floor(index) || 0;
    this.player.playAt((Sound.Note0 + i) as SoundId, x, y, z);
  }

  /** The room tone and the music play under everything while `on` (a headset session is running). Where they sit does not matter: they are the room's. */
  setRoom(on: boolean): void {
    this.player.setLoop(Sound.Hum, on, 0, 1.5, 0);
    this.player.setLoop(Sound.Music, on, 0, 1.5, 0);
    this.player.setLoop(Sound.Clock, on, this.clockAt.x, this.clockAt.y, this.clockAt.z);
    this.player.setLoop(Sound.Wind, on, this.windAt.x, this.windAt.y, this.windAt.z);
  }

  /** Puts the clock and the wind where they are in the room now (the room moves when it is placed round the player). */
  placeAmbient(
    clock: Readonly<{ x: number; y: number; z: number }>,
    wind: Readonly<{ x: number; y: number; z: number }>,
  ): void {
    this.clockAt.x = clock.x;
    this.clockAt.y = clock.y;
    this.clockAt.z = clock.z;
    this.windAt.x = wind.x;
    this.windAt.y = wind.y;
    this.windAt.z = wind.z;
    this.player.moveLoop(Sound.Clock, clock.x, clock.y, clock.z);
    this.player.moveLoop(Sound.Wind, wind.x, wind.y, wind.z);
  }

  /** The window's flakes of snow, ticking on the glass (at the wind's place), or a beam creaking (above the room, `x` metres to the side). */
  snowTick(): void {
    this.player.playAt(Sound.Snowtick, this.windAt.x, this.windAt.y, this.windAt.z);
  }

  creak(x: number, z: number): void {
    this.player.playAt(Sound.Creak, x, 2.4, z);
  }

  /** One footstep at a point in the room (scene space), for the travel scenes; `alternate` picks the other of the two steps. */
  stepAtPoint(x: number, y: number, z: number, alternate: boolean): void {
    this.player.playAt(alternate ? Sound.Step1 : Sound.Step0, x, y, z);
  }

  /** One footstep of the traveller at a point on the wall (stage coordinates); `alternate` picks the other of the two steps. */
  stepAt(stage: StagePlane, x: number, y: number, alternate: boolean): void {
    stagePoint(stage, x, y, WALL_LIFT_M, this.at);
    this.player.playAt(alternate ? Sound.Step1 : Sound.Step0, this.at.x, this.at.y, this.at.z);
  }

  /** The candle lifted or set down, from the flame (`flame` is its scene position). Call with the frame's two flags. */
  candleMoved(pickedUp: boolean, placed: boolean, flame: ArrayLike<number>): void {
    if (pickedUp) this.player.playAt(Sound.Lift, flame[0], flame[1], flame[2]);
    if (placed) this.player.playAt(Sound.Set, flame[0], flame[1], flame[2]);
  }

  /** Call every frame: the crackle plays while the flame is lit, from the flame. `flame` is its scene position. */
  setFlame(lit: boolean, flame: ArrayLike<number>): void {
    if (lit && !this.flameLit) this.player.setLoop(Sound.Crackle, true, flame[0], flame[1], flame[2]);
    else if (!lit && this.flameLit) this.player.setLoop(Sound.Crackle, false, flame[0], flame[1], flame[2]);
    if (lit) this.player.moveLoop(Sound.Crackle, flame[0], flame[1], flame[2]);
    this.flameLit = lit;
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
