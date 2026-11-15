// A puppet scene: a short piece of shadow theatre on the wall (docs/adr/0016-story-shadow-theatre.md). Cut-out parts hang from
// each other at pivots (a leg from a hip, a lantern from a staff), keyframed tracks move them, wobbles keep them alive, and cues
// at marked moments write a line on the wall, change the light or make a sound. Plain data: a scene is written as a constant (prologue-scene.ts)
// and played by ScenePlayer. Coordinates are stage metres from the wall's centre (x right, y up); angles are radians,
// counter-clockwise as the player sees the wall.

/** What a track can move. */
export type PuppetProp = 'x' | 'y' | 'angle' | 'scale' | 'opacity';
export const PROPS: readonly PuppetProp[] = ['x', 'y', 'angle', 'scale', 'opacity'];
/** Floats per part in ScenePlayer's pose arrays: x, y, angle, scale, opacity. */
export const POSE_STRIDE = 5;

/** How a track arrives at a key: `step` jumps there at the key's time; `smooth` eases in and out. */
export type Ease = 'linear' | 'smooth' | 'in' | 'out' | 'step';
/** A key: at `t` seconds the value is `value`, reached from the key before with `ease` (default linear). */
export type Key = readonly [t: number, value: number, ease?: Ease];

export interface PuppetPart {
  readonly id: string;
  /**
   * What it looks like: a painted art id (puppet-art.ts), or the path of an image (.png, .webp) whose alpha is the cut-out.
   * Empty: an invisible joint that only carries children.
   */
  readonly art: string;
  /** A shadow (black, cast on the wall: the default) or a glow (light, added onto the wall). */
  readonly look?: 'shadow' | 'glow';
  /** A glow's colour, 0..1 each. */
  readonly tint?: readonly [number, number, number];
  /** The part it hangs from (listed before it). Its rest pose is then relative to the parent's pivot, in the parent's frame. */
  readonly parent?: string;
  /** Size, metres. */
  readonly w: number;
  readonly h: number;
  /** The point it turns about and is placed by, as a fraction of its size from its bottom-left corner. Default the centre. */
  readonly pivot?: readonly [number, number];
  /** Rest pose; a track on a prop replaces it. */
  readonly x?: number;
  readonly y?: number;
  readonly angle?: number;
  readonly scale?: number;
  readonly opacity?: number;
  /** Drawn mirrored left to right (it faces the other way). */
  readonly mirror?: boolean;
  /**
   * How far back it stands, 0..1: 0 is held against the wall (the darkest, sharpest shadow, like the player's hands), 1 the far
   * scenery (a pale, soft shadow, as a cut-out held near the candle casts). Default its parent's, or 0. Glows ignore it.
   */
  readonly depth?: number;
}

/** A shadow at depth 1 keeps this much of its darkness; between, it fades linearly. */
export const FAR_SHADOW_STRENGTH = 0.38;
/** A shadow at depth 1 is blurred by this much, in stage metres (scaled linearly between). */
export const FAR_SHADOW_BLUR = 0.009;

/** How dark a shadow at `depth` is, as a factor on its opacity. */
export function depthStrength(depth: number): number {
  const d = Math.min(1, Math.max(0, depth));
  return 1 - (1 - FAR_SHADOW_STRENGTH) * d;
}

/** How soft a shadow at `depth` is: its blur radius in stage metres. */
export function depthBlur(depth: number): number {
  return FAR_SHADOW_BLUR * Math.min(1, Math.max(0, depth));
}

/** Each part's depth, its parent's when it sets none (parts are listed parents first). Run on load. */
export function partDepths(scene: PuppetScene): Float32Array {
  const out = new Float32Array(scene.parts.length);
  const index = new Map<string, number>();
  scene.parts.forEach((p, i) => {
    const parent = p.parent === undefined ? undefined : index.get(p.parent);
    out[i] = p.depth ?? (parent === undefined ? 0 : out[parent]);
    index.set(p.id, i);
  });
  return out;
}

export interface Track {
  readonly part: string;
  readonly prop: PuppetProp;
  /** In time order. Before the first key the value is the first key's; after the last, the last key's. */
  readonly keys: readonly Key[];
}

/** The sounds a memory can make with a `sound` cue (each is a sound of the same name in services/audio/sounds.ts). */
export type StorySound = 'laugh' | 'click' | 'rumble';

/** A steady sway added on top of the pose: amp * sin(2π t / period + phase). */
export interface Wobble {
  readonly part: string;
  readonly prop: PuppetProp;
  readonly amp: number;
  readonly period: number;
  readonly phase?: number;
}

/**
 * Something that happens at a moment: a line written on the wall, the candle's light changing mood,
 * lightning in the room's window with its thunder after it, a footstep, or the room's candle hushed with the memory's light.
 */
export type Cue =
  /** A soft footstep (one of two, alternated), from the stage point (`x`, `y`). */
  | { readonly t: number; readonly kind: 'step'; readonly variant: 0 | 1; readonly x: number; readonly y: number }
  /** A sound in the memory, from the stage point (`x`, `y`): the kids laughing, her torch clicking on, far thunder. */
  | { readonly t: number; readonly kind: 'sound'; readonly sound: StorySound; readonly x: number; readonly y: number }
  /**
   * The room's candle light eases to `level` (1 its own, less hushed) over `seconds`, as a light in the memory is covered and
   * uncovered (scene 2's torch): the memory's light reaches the room.
   */
  | { readonly t: number; readonly kind: 'hush'; readonly level: number; readonly seconds: number }
  /** Lightning now (the room's window flashes), and its thunder `thunderAfter` seconds later. */
  | { readonly t: number; readonly kind: 'storm'; readonly thunderAfter: number }
  /** The candle's light eases into `mood` (a name from story/candle-mood.ts) over `seconds` (its default if unset). */
  | { readonly t: number; readonly kind: 'mood'; readonly mood: string; readonly seconds?: number }
  | {
      readonly t: number;
      readonly kind: 'line';
      readonly text: string;
      /** Which of the wall's lines: the big title or the small line under it. */
      readonly slot: 'title' | 'line';
      /** Seconds it stays once written. */
      readonly hold: number;
    };

export interface PuppetScene {
  readonly id: string;
  /** Seconds it runs. */
  readonly length: number;
  /** Parents before their children; later parts draw over earlier ones. */
  readonly parts: readonly PuppetPart[];
  readonly tracks: readonly Track[];
  readonly wobbles?: readonly Wobble[];
  /** In time order. */
  readonly cues?: readonly Cue[];
}

/** Problems with a scene, as sentences (none when it is sound). Run on load and in tests, never per frame. */
export function validateScene(scene: PuppetScene): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  if (!(scene.length > 0)) problems.push(`${scene.id}: its length must be positive`);
  for (const p of scene.parts) {
    if (seen.has(p.id)) problems.push(`two parts are called ${p.id}`);
    if (p.parent !== undefined && !seen.has(p.parent))
      problems.push(`${p.id} hangs from ${p.parent}, which is not listed before it`);
    if (!(p.w > 0 && p.h > 0)) problems.push(`${p.id} has no size`);
    if (p.depth !== undefined && !(p.depth >= 0 && p.depth <= 1)) problems.push(`${p.id}'s depth must be 0..1`);
    seen.add(p.id);
  }
  for (const tr of scene.tracks) {
    if (!seen.has(tr.part)) problems.push(`a track moves ${tr.part}, which is not a part`);
    if (tr.keys.length === 0) problems.push(`the ${tr.prop} track of ${tr.part} has no keys`);
    for (let i = 1; i < tr.keys.length; i++)
      if (tr.keys[i][0] < tr.keys[i - 1][0])
        problems.push(`the ${tr.prop} track of ${tr.part} goes back in time at ${tr.keys[i][0]} s`);
  }
  for (const w of scene.wobbles ?? []) {
    if (!seen.has(w.part)) problems.push(`a wobble moves ${w.part}, which is not a part`);
    if (!(w.period > 0)) problems.push(`the wobble on ${w.part} needs a positive period`);
  }
  const cues = scene.cues ?? [];
  for (let i = 1; i < cues.length; i++)
    if (cues[i].t < cues[i - 1].t) problems.push(`the cues go back in time at ${cues[i].t} s`);
  return problems;
}

/** Keys that swing a value between `from ± amp` every `period` seconds from `t0` to `t1`, then settle on `rest`. */
export function swingKeys(
  t0: number,
  t1: number,
  period: number,
  amp: number,
  centre = 0,
  rest = centre,
  phase = 1,
): Key[] {
  const keys: Key[] = [[t0, centre]];
  let side = phase;
  for (let t = t0 + period / 4; t < t1 - period / 8; t += period / 2) {
    keys.push([t, centre + side * amp, 'smooth']);
    side = -side;
  }
  keys.push([t1, rest, 'smooth']);
  return keys;
}

/** Keys for a bob: a small lift at every footfall (`period` is a full stride, two steps) from `t0` to `t1`. */
export function bobKeys(t0: number, t1: number, period: number, base: number, lift: number): Key[] {
  const keys: Key[] = [[t0, base]];
  for (let t = t0 + period / 4; t < t1 - period / 8; t += period / 2) {
    keys.push([t, base + lift, 'out']);
    keys.push([Math.min(t + period / 4, t1), base, 'in']);
  }
  keys.push([t1, base]);
  return keys;
}
