// The sounds of the title screen, as the page's launcher needs them: a reach, a press, and the match for BEGIN. The
// launcher is built before the audio engine is, so main.ts hands it these, which do nothing until the engine exists
// (and nothing while audio is still locked: browsers allow no sound before a first tap). Plain TypeScript.
import { Sound, type SoundId } from '../engine/services/audio/sounds';

export interface UiSound {
  hover(): void;
  press(): void;
  begin(): void;
}

/** What the sounds need from the engine. */
export interface UiPlayer {
  playUi(id: SoundId): boolean;
}

/** The sounds, played through whatever `player` returns at the time (null until the engine is made). */
export function createUiSound(player: () => UiPlayer | null): UiSound {
  return {
    hover: () => void player()?.playUi(Sound.Tick),
    press: () => void player()?.playUi(Sound.Press),
    begin: () => void player()?.playUi(Sound.Ignite),
  };
}
