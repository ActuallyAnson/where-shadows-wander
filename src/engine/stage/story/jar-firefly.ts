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
/** How far it wanders inside the jar from the jar's middle, metres: across, and up and down (the jar is 0.11 wide, 0.17 tall). */
const WANDER_XZ = 0.022;
const WANDER_Y = 0.03;
/** Its flash: a bright pulse taking this share of each cycle, and the cycle's length, which drifts between about 2 and 3 s. */
const FLASH_SHARE = 0.38;
const FLASH_CYCLE_S = 2.5;
const FLASH_CYCLE_SWAY_S = 0.5;
/** Between flashes it never goes quite dark, so the player can still find it. */
const DIM = 0.28;

const TAU = 2 * Math.PI;

export class JarFirefly {
  /** How much the firefly is there: 1 in the jar, 0 gone. */
  level = 1;
  /** Its light now, flash and all, 0..1. */
  glow = 0;
  /** Where it is in the jar, metres from the jar's middle, in the jar's own axes (x across, y up, z front to back). */
  x = 0;
  y = 0;
  z = 0;
  private home = true;
  private t = 0;
  private flashPhase = 0.5;

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
    const t = (this.t += dt);

    // A slow, looping drift about the jar, with a quicker small flutter on it, as a firefly hovers: sums of waves whose periods
    // don't line up, so the path takes a long time to repeat.
    this.x = WANDER_XZ * (0.7 * Math.sin((t * TAU) / 5.3) + 0.3 * Math.sin((t * TAU) / 1.9 + 0.4));
    this.z = WANDER_XZ * (0.7 * Math.sin((t * TAU) / 6.7 + 1.3) + 0.3 * Math.sin((t * TAU) / 2.3 + 2.1));
    this.y = WANDER_Y * (0.75 * Math.sin((t * TAU) / 4.1 + 0.8) + 0.25 * Math.sin((t * TAU) / 0.9));

    // Its flash: a soft pulse, then a dim rest, the rhythm loosening and tightening a little.
    const cycle = FLASH_CYCLE_S + FLASH_CYCLE_SWAY_S * Math.sin((t * TAU) / 11);
    this.flashPhase = (this.flashPhase + dt / cycle) % 1;
    const p = this.flashPhase / FLASH_SHARE;
    const pulse = p < 1 ? Math.sin(Math.PI * p) ** 2 : 0;
    this.glow = this.level * (DIM + (1 - DIM) * pulse);
  }
}
