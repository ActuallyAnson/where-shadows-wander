// The story's memories as one long puppet show (docs/STORY.md, "One story, not seven"): each memory is written as a chapter with
// its own clock from 0, and joinChapters lays them end to end into a single PuppetScene. A puppet that appears in several
// chapters (the two kids, the rabbit) is one part, so it carries over from one memory into the next instead of being built again;
// its tracks in each chapter are joined into one. The story plays the scene a chapter at a time and holds on each chapter's
// last picture while it waits for the player (story-director.ts). Also here: the keys that slide a place on or off the wall, the
// way a shadow theatre changes its scenery. Run on load, never per frame.
import type { Cue, Key, PuppetPart, PuppetScene, Track, Wobble } from './puppet-scene';

export interface Chapter {
  readonly id: string;
  /** Seconds it runs; it ends on the picture the story waits on. */
  readonly length: number;
  /** The parts it brings on (a part from an earlier chapter is used by its id, not listed again). */
  readonly parts: readonly PuppetPart[];
  /** Times in seconds from the chapter's start; tracks may move parts from earlier chapters. */
  readonly tracks: readonly Track[];
  readonly wobbles?: readonly Wobble[];
  readonly cues?: readonly Cue[];
}

export interface JoinedChapters {
  readonly scene: PuppetScene;
  /** Each chapter's stretch of the scene, seconds: where it starts and ends. */
  readonly at: Readonly<Record<string, { readonly start: number; readonly end: number }>>;
}

/** Lays `chapters` end to end into one scene: their parts in order, each part's tracks joined, their cues and keys shifted. */
export function joinChapters(id: string, chapters: readonly Chapter[]): JoinedChapters {
  const parts: PuppetPart[] = [];
  const tracks = new Map<string, { part: string; prop: Track['prop']; keys: Key[] }>();
  const wobbles: Wobble[] = [];
  const cues: Cue[] = [];
  const at: Record<string, { start: number; end: number }> = {};
  let start = 0;
  for (const c of chapters) {
    if (at[c.id]) throw new Error(`chapters: two are called ${c.id}`);
    at[c.id] = { start, end: start + c.length };
    parts.push(...c.parts);
    for (const tr of c.tracks) {
      const key = `${tr.part}.${tr.prop}`;
      let joined = tracks.get(key);
      if (!joined) tracks.set(key, (joined = { part: tr.part, prop: tr.prop, keys: [] }));
      for (const [t, v, e] of tr.keys) joined.keys.push(e === undefined ? [t + start, v] : [t + start, v, e]);
    }
    wobbles.push(...(c.wobbles ?? []));
    for (const cue of c.cues ?? []) cues.push({ ...cue, t: cue.t + start });
    start += c.length;
  }
  return { scene: { id, length: start, parts, tracks: [...tracks.values()], wobbles, cues }, at };
}

/** How much longer a place standing right at the back (depth 1) takes to slide than one at the front: the far scenery lags. */
export const SLIDE_DEPTH_LAG = 0.35;
/** How far a place slides to be off the wall, stage metres: past the wall's edge (0.84 from the middle) with room for its width. */
export const OFF_WALL_X = 1.6;

/**
 * Keys that slide a part's x from `from` to `to`, starting at `t0` and taking `seconds`, longer the further back it stands
 * (`depth`, as PuppetPart.depth), so the near pieces of a place move ahead of the far ones and it reads as the stage turning.
 * Arriving eases out (it settles); leaving eases in (it gathers pace).
 */
export function slideKeys(t0: number, seconds: number, from: number, to: number, depth = 0, leaving = false): Key[] {
  const d = seconds * (1 + SLIDE_DEPTH_LAG * Math.min(1, Math.max(0, depth)));
  return [
    [t0, from],
    [t0 + d, to, leaving ? 'in' : 'out'],
  ];
}
