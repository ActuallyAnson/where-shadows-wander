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
];
/** How many sounds there are: one definition each, in the order of `Sound`. */
export const SOUND_COUNT = SOUND_DEFS.length;

/**
 * The sound a shape event makes, or null for none: a paper rustle when recognised, a thump when it commits, a soft
 * letting-go when it is released, and a soft sigh when it was released because tracking was lost.
 */
export function soundForShapeEvent(type: ShapeEventType, reason: ReleaseReason | null = null): SoundId | null {
  if (type === 'candidate') return Sound.Rustle;
  if (type === 'commit') return Sound.Thump;
  // Letting go because another shape just committed is part of that commit's thump, not a sound of its own.
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
