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
  puzzleSolved(stage: StagePlane): void {
    stagePoint(stage, 0, stage.height * 0.35, WALL_LIFT_M, this.at);
    this.player.playAt(Sound.Chime, this.at.x, this.at.y, this.at.z);
  }

  /** The room tone and the music play under everything while `on` (a headset session is running). Where they sit does not matter: they are the room's. */
  setRoom(on: boolean): void {
    this.player.setLoop(Sound.Hum, on, 0, 1.5, 0);
    this.player.setLoop(Sound.Music, on, 0, 1.5, 0);
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
