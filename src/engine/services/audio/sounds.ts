// The game's sounds as data: which bus each plays on, how loud, how it carries, and how often it may repeat.
// A file in src/assets/audio/sfx named after a sound replaces it (sound-files.ts); one without a file is made in code
// (placeholder-sounds.ts). Plain TypeScript.
import type { ReleaseReason, ShapeEventType } from '../../hands/shape-events';
import { Bus, type BusId } from './mixer';

export const Sound = {
  Rustle: 0,
  Thump: 1,
  Crackle: 2,
  /** A fingertip reaches a menu item. */
  Tick: 3,
  /** A menu item is pressed. */
  Press: 4,
  /** BEGIN: a match is struck and the flame catches. */
  Ignite: 5,
  /** A shape is let go. */
  Release: 6,
  /** Tracking was lost for too long. */
  Lost: 7,
  /** Footsteps outside (scene 2's hush): two soft steps, alternated. */
  Step0: 8,
  Step1: 9,
  /** Rain outside, on the window and the roof, a loop (ambience): the night's constant bed. */
  Rain: 10,
  /** Thunder far off, low and muffled by the distance and the walls: now and then, after a flash in the window (storm.ts). */
  Thunder: 11,
  /** The bedclothes as he sits up in bed (scene 1, as his eyes open): a soft slide of heavy cloth. */
  Covers: 12,
  /** The music: one track, looped, from the candle's lighting to the end (src/assets/audio/music/music.ogg). */
  Music: 13,
  /** Two kids laughing together, from the wall (scene 2 after the rabbit and after the hush, scene 3 in the grass). */
  Laugh: 14,
  /** Her torch clicking on as she sets it down (scene 2's prologue), from the wall. */
  Click: 15,
  /** Far thunder inside a memory (scene 2's fort), from the wall's window side: softer than the room's own thunder. */
  Rumble: 16,
  /** A small, sleepy yawn as his eyes grow heavy (the end, after the candle goes out), from his lap. */
  Yawn: 17,
  /** A short, stifled giggle: the kids after the hush (scene 2), having got away with it. */
  Giggle: 18,
  /** A tiny soft pat: the puppet rabbit landing a hop (scene 2). */
  Hop: 19,
  /** A soft cloth whoosh: she throws the blanket up into the fort (scene 2's prologue). */
  Blanket: 20,
  /** Running feet on grass: the chase in the park (scene 3). */
  Run: 21,
  /** A small glassy clink: the firefly goes into her jar (scene 4). */
  Jar: 22,
  /** A school bell far off as the gate slides in, morning (scene 4's end). */
  Bell: 23,
  /** The school gate's creak and clank as they part (scene 5). */
  Gate: 24,
  /** The house settling: a creak of the floor, now and then between memories (night-sounds.ts). */
  Creak: 25,
  /** A gust of wind: on the window between memories (night-sounds.ts), and on the hill as she fades (scene 6). */
  Gust: 26,
  /** Crickets at dusk, a loop (a story bed): from dusk in the park until morning (scenes 3 and 4). */
  Crickets: 27,
  /** A thin wind, a loop (a story bed): the empty wall and the goodbye (scenes 5 and 6). */
  Wind: 28,
  /** A tiny soft shimmer: a firefly settling in the player's cupped shadow, and on the kids' hands (scene 4). */
  Firefly: 29,
  /** A warm swell from palm meeting palm until the hands part (scene 6): the story's peak. */
  Palms: 30,
  /** A soft, dry slide of card: the paper scenery sliding on or off the wall at a change of place. */
  Slide: 31,
  /** A small hiss as his hand covers the flame and it gutters out (the end), from the flame. */
  Snuff: 32,
  /** One slow breath in and out, from his lap, as his eyes close for the last time (the end). */
  Breath: 33,
  /** Birdsong, a loop (a story bed): the spring park by day (scene 3) and the morning at the school gate (scenes 4 and 5). */
  Birds: 34,
} as const;
export type SoundId = (typeof Sound)[keyof typeof Sound];

export interface SoundDef {
  /** Also the asset id a real file will have in the manifest (src/assets/audio/sfx/<name>.ogg). */
  readonly name: string;
  readonly bus: BusId;
  /** Linear gain on top of the bus. */
  readonly gain: number;
  readonly loop: boolean;
  /** Higher wins when every voice is busy. */
  readonly priority: number;
  /** Shortest time between two plays, seconds, so a flickering shape does not machine-gun. */
  readonly minGapS: number;
  /** Panner distance model: full volume inside `refDistance` metres, rolling off to `maxDistance`. */
  readonly refDistance: number;
  readonly maxDistance: number;
  /** Not placed in the room: played straight into its bus, the same in both ears wherever the head turns (the music). */
  readonly flat?: boolean;
  /** Plays only from its file: until the file has loaded it is silent, and it has no placeholder (the music). */
  readonly fileOnly?: boolean;
  /** A loop's fade in and out, seconds (a time constant: it is mostly there after three of these); a short default if unset. */
  readonly fadeS?: number;
}

/** A recording that plays only from its file (no placeholder: these are all real recordings), from the wall or the room. */
function recorded(
  name: string,
  gain: number,
  opts: { loop?: boolean; priority?: number; minGapS?: number; near?: boolean; far?: boolean; fadeS?: number } = {},
): SoundDef {
  return {
    name,
    bus: opts.loop || opts.far ? Bus.Ambience : Bus.Effects,
    gain,
    loop: opts.loop ?? false,
    priority: opts.priority ?? 1,
    minGapS: opts.minGapS ?? 0.2,
    // Near: a small sound close to where it is (a hop, a clink). Far: about as loud anywhere in the room (a bed, a far bell).
    refDistance: opts.far ? 3 : opts.near ? 0.6 : 1,
    maxDistance: opts.far ? 20 : opts.near ? 4 : 8,
    fileOnly: true,
    ...(opts.fadeS === undefined ? {} : { fadeS: opts.fadeS }),
  };
}

export const SOUND_DEFS: readonly SoundDef[] = [
  {
    name: 'rustle',
    bus: Bus.Effects,
    gain: 0.5,
    loop: false,
    priority: 1,
    minGapS: 0.25,
    refDistance: 1,
    maxDistance: 8,
  },
  {
    name: 'thump',
    bus: Bus.Effects,
    gain: 0.9,
    loop: false,
    priority: 2,
    minGapS: 0.15,
    refDistance: 1,
    maxDistance: 8,
  },
  {
    name: 'crackle',
    bus: Bus.Ambience,
    gain: 0.35,
    loop: true,
    priority: 0,
    minGapS: 0,
    refDistance: 0.3,
    maxDistance: 4,
  },
  {
    name: 'tick',
    bus: Bus.Effects,
    gain: 0.35,
    loop: false,
    priority: 0,
    minGapS: 0.06,
    refDistance: 1,
    maxDistance: 8,
  },
  {
    name: 'press',
    bus: Bus.Effects,
    gain: 0.7,
    loop: false,
    priority: 2,
    minGapS: 0.12,
    refDistance: 1,
    maxDistance: 8,
  },
  {
    name: 'ignite',
    bus: Bus.Effects,
    gain: 0.8,
    loop: false,
    priority: 3,
    minGapS: 1,
    refDistance: 1,
    maxDistance: 8,
  },
  {
    name: 'release',
    bus: Bus.Effects,
    gain: 0.35,
    loop: false,
    priority: 1,
    minGapS: 0.25,
    refDistance: 1,
    maxDistance: 8,
  },
  {
    name: 'lost',
    bus: Bus.Effects,
    gain: 0.4,
    loop: false,
    priority: 2,
    minGapS: 2,
    refDistance: 1,
    maxDistance: 8,
  },
  {
    name: 'step0',
    bus: Bus.Effects,
    gain: 0.45,
    loop: false,
    priority: 0,
    minGapS: 0.12,
    refDistance: 0.6,
    maxDistance: 4,
  },
  {
    name: 'step1',
    bus: Bus.Effects,
    gain: 0.45,
    loop: false,
    priority: 0,
    minGapS: 0.12,
    refDistance: 0.6,
    maxDistance: 4,
  },
  {
    name: 'rain',
    bus: Bus.Ambience,
    gain: 0.55,
    loop: true,
    priority: 0,
    minGapS: 0,
    // From the window, but heard about as loud anywhere in the room.
    refDistance: 3,
    maxDistance: 20,
  },
  {
    name: 'thunder',
    bus: Bus.Ambience,
    gain: 0.6,
    loop: false,
    priority: 2,
    minGapS: 4,
    // Far away: the same loudness anywhere in the room, from the window's side.
    refDistance: 50,
    maxDistance: 100,
  },
  {
    name: 'covers',
    bus: Bus.Effects,
    gain: 0.55,
    loop: false,
    priority: 2,
    minGapS: 1,
    // From the lap: close.
    refDistance: 1,
    maxDistance: 6,
  },
  {
    name: 'music',
    bus: Bus.Music,
    gain: 0.5,
    loop: true,
    priority: 0,
    minGapS: 0,
    // Flat, so the distances are not used.
    refDistance: 1,
    maxDistance: 1,
    flat: true,
    fileOnly: true,
  },
  {
    name: 'laugh',
    bus: Bus.Effects,
    gain: 0.5,
    loop: false,
    priority: 2,
    minGapS: 1,
    refDistance: 1,
    maxDistance: 8,
    // Laughter made in code would sound like a machine: until the recording loads, the kids laugh silently.
    fileOnly: true,
  },
  {
    name: 'click',
    bus: Bus.Effects,
    gain: 0.45,
    loop: false,
    priority: 1,
    minGapS: 0.5,
    refDistance: 0.6,
    maxDistance: 4,
  },
  {
    name: 'rumble',
    bus: Bus.Ambience,
    gain: 0.4,
    loop: false,
    priority: 1,
    minGapS: 4,
    // From the memory, so from the wall; far off, so about as loud anywhere in the room.
    refDistance: 3,
    maxDistance: 20,
  },
  {
    name: 'yawn',
    bus: Bus.Effects,
    gain: 0.5,
    loop: false,
    priority: 2,
    minGapS: 4,
    // His own, from close by (played at his lap, as the covers are).
    refDistance: 1,
    maxDistance: 6,
    // A yawn made in code would sound like a machine: until the recording loads, the end is silent here.
    fileOnly: true,
  },
  // The memories' small sounds and the room's night sounds (all recordings; until a file loads, its moment is silent). Quiet:
  // the rain, the candle and the music are the bed, and these sit on top. Tune by ear on a headset.
  recorded('giggle', 0.45, { priority: 2, minGapS: 1 }),
  recorded('hop', 0.3, { near: true, minGapS: 0.1, priority: 0 }),
  recorded('blanket', 0.75, { minGapS: 1 }),
  recorded('run', 0.35, { near: true, minGapS: 0.5, priority: 0 }),
  recorded('jar', 0.2, { near: true, minGapS: 1 }),
  recorded('bell', 0.25, { far: true, minGapS: 4 }),
  recorded('gate', 0.3, { minGapS: 1 }),
  recorded('creak', 0.25, { far: true, minGapS: 4, priority: 0 }),
  recorded('gust', 0.3, { far: true, minGapS: 4, priority: 0 }),
  recorded('crickets', 0.3, { loop: true, priority: 0, minGapS: 0, far: true, fadeS: 1.2 }),
  recorded('wind', 0.25, { loop: true, priority: 0, minGapS: 0, far: true, fadeS: 1.5 }),
  recorded('firefly', 0.3, { near: true, minGapS: 0.4 }),
  recorded('palms', 0.85, { priority: 3, minGapS: 4 }),
  recorded('slide', 0.15, { minGapS: 0.5, priority: 0 }),
  recorded('snuff', 0.4, { near: true, priority: 3, minGapS: 4 }),
  recorded('breath', 0.35, { priority: 2, minGapS: 4 }),
  recorded('birds', 0.22, { loop: true, priority: 0, minGapS: 0, far: true, fadeS: 1.5 }),
];
/** How many sounds there are: one definition each, in the order of `Sound`. */
export const SOUND_COUNT = SOUND_DEFS.length;

/**
 * The sound a shape event makes, or null for none. Recognising and committing a shape are silent (the wall already shows
 * them, and the sounds only distracted); letting go makes a soft sound, and so does losing tracking.
 */
export function soundForShapeEvent(type: ShapeEventType, reason: ReleaseReason | null = null): SoundId | null {
  // Letting go because another shape just committed is not a sound of its own.
  if (type === 'release') return reason === 'lost' ? Sound.Lost : reason === 'switch' ? null : Sound.Release;
  return null;
}

/** Who made a sound, for the gap between plays: each hand has its own, so two hands acting together both sound. */
export const KEY_COUNT = 2;

/** When each sound last played for each key, to enforce `minGapS`. No allocation. */
export class Cooldowns {
  private readonly last = new Float64Array(SOUND_COUNT * KEY_COUNT).fill(-Infinity);

  /** True if `id` for `key` (0 or 1) may play at `now` (seconds). Does not start the gap: call `mark` once it plays. */
  ready(id: SoundId, key: number, now: number): boolean {
    return now - this.last[id * KEY_COUNT + key] >= SOUND_DEFS[id].minGapS;
  }

  mark(id: SoundId, key: number, now: number): void {
    this.last[id * KEY_COUNT + key] = now;
  }
}
