// Turning the night back a few seconds. The game is deterministic: given the same puzzle and the same inputs, step for step, it
// reaches the same state (src/game/replay.ts proves it and plays a recording back). So a rewind needs no saved states: the
// Rewinder keeps the inputs of the puzzle being played (a recording of about 0.6 KB a frame, reused), and to go back N seconds it
// reloads the puzzle and plays the recording again, all but the last N seconds, in a few milliseconds (a frame of the game takes
// about 0.02 ms). It is for a gentle rescue (the traveller falls: the night turns back a moment so the player has another try) and
// for time-travel debugging. A puzzle that was entered by walking on from the last one is rebuilt from a fresh load of the puzzle,
// which differs from the live one by at most the steps left in the frame where it loaded.
import type { Game, GameInput } from '../game/game';
import { InputRecorder, replay } from '../game/replay';

export class Rewinder {
  readonly recorder: InputRecorder;
  private index = -1;
  /** The game's clock when the puzzle began, put back on a rewind so times in the puzzle line up again. */
  private timeAtBegin = 0;

  /** @param maxFrames the longest puzzle that can be rewound (90 s at 72 frames a second by default; beyond it, no rewinding until the next puzzle) */
  constructor(maxFrames = 72 * 90) {
    this.recorder = new InputRecorder(maxFrames);
  }

  /** Whether there is a recording to go back through. */
  get ready(): boolean {
    return this.index >= 0 && !this.recorder.full && this.recorder.frames > 0;
  }

  /** Seconds of play recorded since the puzzle began. */
  get seconds(): number {
    let s = 0;
    for (let f = 0; f < this.recorder.frames; f++) s += this.recorder.dt[f];
    return s;
  }

  /** A puzzle has begun (at `gameTime` on the game's clock): start a fresh recording of it, which a rewind can reload and replay. */
  begin(puzzleIndex: number, gameTime = 0): void {
    this.recorder.reset();
    this.recorder.recordCommand('goto', puzzleIndex);
    this.index = puzzleIndex;
    this.timeAtBegin = gameTime;
  }

  /** Forgets everything (the night ended or restarted). */
  clear(): void {
    this.recorder.reset();
    this.index = -1;
  }

  /** Records one frame's input. Call it with the object about to be passed to game.frame(), before that call. */
  record(input: GameInput): void {
    if (this.index >= 0) this.recorder.record(input);
  }

  /**
   * Takes the game back `seconds`: the puzzle is loaded again and the recorded frames but the last `seconds` are played into it.
   * The recording is cut back to match, so playing on records from there. Returns the seconds actually gone back (0 when it could
   * not: nothing recorded, or the recording ran out of room).
   */
  rewind(game: Game, seconds: number): number {
    if (!this.ready || !(seconds > 0)) return 0;
    const rec = this.recorder;
    let dropped = 0;
    let gone = 0;
    while (dropped < rec.frames && gone < seconds) {
      dropped++;
      gone += rec.dt[rec.frames - dropped];
    }
    const keep = rec.frames - dropped;
    rec.frames = keep;
    // What is not in the recording is put right by hand: the clock, the loop's leftover fraction of a step, and the shapes the hands
    // are holding now (the classifier does not say again what it already said; what the hands hold NOW is what counts, not what the
    // replay thinks they held).
    const hands = game.abilities.hands;
    const roles = [hands[0].role, hands[1].role] as const;
    const shapes = [hands[0].shape, hands[1].shape] as const;
    game.loop.reset();
    game.abilities.reset();
    game.time = this.timeAtBegin;
    if (keep === 0) {
      // Right back to the start of the puzzle: just load it again.
      game.goto(this.index);
    } else {
      rec.command[0] = 2;
      rec.commandArg[0] = this.index;
      replay(rec, game);
    }
    hands[0].role = roles[0];
    hands[0].shape = shapes[0];
    hands[1].role = roles[1];
    hands[1].shape = shapes[1];
    // What the replayed frames said happened is not news: the app has already heard it.
    game.events.clear();
    return gone;
  }
}
