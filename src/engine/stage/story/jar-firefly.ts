// The firefly in the room's jar (docs/STORY.md, scenes 4, 5 and 7): the jar she gave him stands on his desk with her firefly
// glowing in it, from the moment he wakes, until the firefly leaves the jar on the wall in scene 5; then the real jar goes dark
// with it, and stays dark to the end. Worked out from the story's time each frame, so a skip or a jump can't lose it.
// Pure TypeScript; time comes in as `dt`.
import { FLY_OUT_S } from './last-ordinary-day';
import { STORY_CHAPTER } from './story-stage';

/** When the firefly leaves the jar on the wall, in the story's puppet show (STORY_STAGE), seconds. */
export const FIREFLY_LEAVES_AT = STORY_CHAPTER['last-ordinary-day'].start + FLY_OUT_S;
/** How long the room's jar takes to go dark, seconds (the wall's jar takes 0.9). */
const FADE_S = 1.2;
/** The blink: a slow swell with a quicker flutter on it. */
const SWELL_S = 2.3;
const FLUTTER_S = 0.83;

export class JarFirefly {
  /** How much the firefly is there: 1 in the jar, 0 gone. */
  level = 1;
  /** Its light now, blink and all, 0..1. */
  glow = 0;
  private home = true;
  private t = 0;

  /**
   * @param storyTime how far the story's puppet show has played (the memory on the wall, playing or held), or null when there
   *   is none (before the story, or in the end): then it keeps what it had
   * @param fresh true before a new play-through (the title): the firefly is back in the jar
   */
  update(dt: number, storyTime: number | null, fresh: boolean): void {
    if (fresh) this.home = true;
    else if (storyTime !== null) this.home = storyTime < FIREFLY_LEAVES_AT;
    if (fresh) this.level = 1;
    else if (this.home) this.level = Math.min(1, this.level + dt / FADE_S);
    else this.level = Math.max(0, this.level - dt / FADE_S);
    this.t += dt;
    const swell = 0.5 + 0.5 * Math.sin((this.t * 2 * Math.PI) / SWELL_S);
    const flutter = 0.5 + 0.5 * Math.sin((this.t * 2 * Math.PI) / FLUTTER_S + 1.1);
    this.glow = this.level * (0.55 + 0.3 * swell + 0.15 * flutter);
  }
}
