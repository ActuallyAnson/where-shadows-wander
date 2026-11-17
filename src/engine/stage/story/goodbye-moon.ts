// The moonlight in the room in scene 6 (docs/STORY.md): as the two shadows' palms meet on the wall, the moon's light through the
// window brightens slowly on the desk and the bed beside the player, as if the clouds had thinned; it stays while the hands are
// together, and settles back to the night's as she fades. It is light, at the edge of the player's view, so it never pulls the
// eye from the wall. Worked out from the story's time, so a skip or a jump can't lose it. Pure TypeScript.
import { GIRL_GO_LEN_S, GIRL_GO_S, ZOOM_LEN_S, ZOOM_S } from './goodbye';
import { STORY_CHAPTER } from './story-stage';

/** How bright the moon's beam grows at the touch, as a multiple of the night's. Tune in the headset. */
export const GOODBYE_MOON_PEAK = 1.9;
/** It grows from the touch (the chapter's start) until the view has drawn back to show the two kids. */
const RISE_S = ZOOM_S + ZOOM_LEN_S;

const smooth = (x: number): number => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * The moon's beam in the room, as a multiple of the night's (1), for a time in the story's puppet show (STORY_STAGE, seconds),
 * or null when no memory is showing.
 */
export function goodbyeMoon(storyTime: number | null): number {
  if (storyTime === null || !Number.isFinite(storyTime)) return 1;
  const t = storyTime - STORY_CHAPTER.goodbye.start;
  if (t <= 0 || t >= GIRL_GO_S + GIRL_GO_LEN_S) return 1;
  const up = smooth(t / RISE_S);
  const down = smooth((t - GIRL_GO_S) / GIRL_GO_LEN_S);
  return 1 + (GOODBYE_MOON_PEAK - 1) * up * (1 - down);
}
