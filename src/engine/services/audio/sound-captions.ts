// Captions for the sounds that matter to the story, for players who cannot hear them: a small bracketed line such as
// "[a music-box note]" when one plays, if the Captions setting is on. The shape sounds (rustle, thump) and the loops are
// left out: they happen all the time and the hands already show what they did.
import type { SoundPlayer } from './game-audio';
import { Sound, type SoundId } from './sounds';

const NOTE = '[a music-box note]';

export const CAPTIONS: Readonly<Partial<Record<SoundId, string>>> = {
  [Sound.Chime]: '[a soft chime]',
  [Sound.Twinkle]: '[a tiny sparkle]',
  [Sound.Note0]: NOTE,
  [Sound.Note1]: NOTE,
  [Sound.Note2]: NOTE,
  [Sound.Note3]: NOTE,
  [Sound.Note4]: NOTE,
  [Sound.Creak]: '[a beam creaks]',
  [Sound.Hop]: '[a soft landing]',
  [Sound.Ignite]: '[a match strikes]',
  [Sound.Thunder]: '[thunder, far off]',
  [Sound.Covers]: '[bedclothes rustle]',
};

/** The least time between two captions, seconds, so a run of sparkles does not flood the wall. */
export const CAPTION_GAP_S = 1.5;

/** A sound player that tells `show` what each notable sound is, and passes everything on to `inner` unchanged. */
export class CaptioningPlayer implements SoundPlayer {
  private last = -Infinity;

  constructor(
    private readonly inner: SoundPlayer,
    private readonly enabled: () => boolean,
    /** Shows a caption; false when it could not be shown (so it does not use up the gap). */
    private readonly show: (text: string) => boolean | void,
    private readonly now: () => number,
  ) {}

  playAt(id: SoundId, x: number, y: number, z: number, key?: number): boolean {
    const played = this.inner.playAt(id, x, y, z, key);
    const text = CAPTIONS[id];
    if (played && text && this.enabled()) {
      const t = this.now();
      if (t - this.last >= CAPTION_GAP_S) {
        if (this.show(text) !== false) this.last = t;
      }
    }
    return played;
  }

  setLoop(id: SoundId, on: boolean, x: number, y: number, z: number): void {
    this.inner.setLoop(id, on, x, y, z);
  }

  moveLoop(id: SoundId, x: number, y: number, z: number): void {
    this.inner.moveLoop(id, x, y, z);
  }
}
