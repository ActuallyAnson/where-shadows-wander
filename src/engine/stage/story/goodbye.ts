// Scene 6, "Goodbye" (docs/STORY.md): the chapter after the player's flat hand meets the friend's, palm to palm. The touch
// starts where the player's hand was (the story's handoff) as one flat hand, face on; it turns clockwise, and as it turns it
// shows what it was: two hands, side on, pressed palm to palm, the boy's from the left and the girl's from the right, each
// held up from below on its forearm. They stay together a while. Then hers slowly fades, and his, alone, lowers away out of
// sight, leaving the wall empty for sleep. Every time is in seconds from the chapter's start.
import type { Chapter } from '../puppet/chapters';
import type { Cue, PuppetPart, Track, Wobble } from '../puppet/puppet-scene';

/** Where the palms meet, on the wall: the middle of the friend's flat hand in scene 6 (story-script.ts). */
export const GOODBYE_AT: readonly [number, number] = [0, 0.13];
/** The hands' size, as the friend's painted hands are drawn. */
const SCALE = 1.35;
/** The touch shows (the painted friend's hand fading under it), and the pair turns clockwise, face on to side on. */
const SHOW_S = 0.6;
const TURN_S = 0.4;
const TURN_LEN_S = 1.8;
/** How far it starts turned (anticlockwise of upright), so the turn to upright is clockwise. */
const TURN_FROM = 0.7;
/** They hold together, and then hers slowly fades... */
const FADE_S = TURN_S + TURN_LEN_S + 3.4;
const FADE_LEN_S = 4.0;
/** ...and his, alone, lowers away out of sight. */
const LOWER_S = FADE_S + FADE_LEN_S + 1.6;
const LOWER_LEN_S = 2.6;
export const GOODBYE_LENGTH_S = LOWER_S + LOWER_LEN_S + 0.6;

/** A side-on hand's size, and where its palm's face is across it (the art faces right; mirrored, it faces left). */
const SIDE_W = 0.11;
const SIDE_H = 0.3;
const PALM_FACE = 0.86;
/** How far into each other the hands start (as one, face on), before they part to just touching. */
const START_OVERLAP = 0.035;

/** A forearm running down from a side-on hand's wrist and off the bottom of the wall, leaning out to `lean` (radians). */
const forearm = (hand: string, x: number, lean: number): PuppetPart => ({
  id: `${hand}-arm`,
  art: 'friend-arm',
  parent: hand,
  w: 0.075,
  h: 0.8,
  pivot: [0.5, 1],
  x,
  y: -0.12,
  angle: lean,
});

const parts: PuppetPart[] = [
  // The touch: it starts where the player's hand was, and eases to its place (the story's handoff).
  { id: 'goodbye', art: '', w: 0.01, h: 0.01, x: GOODBYE_AT[0], y: GOODBYE_AT[1], scale: SCALE, opacity: 0 },
  { id: 'goodbye-pair', art: '', parent: 'goodbye', w: 0.01, h: 0.01, angle: TURN_FROM },
  // The joined hands face on: one flat hand, as the two palms together cast it.
  { id: 'goodbye-face', art: 'friend-palm', parent: 'goodbye-pair', w: 0.2, h: 0.3, pivot: [0.5, 0.55] },
  // The boy's hand from the left, palm to the right; the girl's from the right, palm to the left.
  {
    id: 'goodbye-boy',
    art: 'side-hand',
    parent: 'goodbye-pair',
    w: SIDE_W,
    h: SIDE_H,
    pivot: [PALM_FACE, 0.5],
    x: START_OVERLAP,
    opacity: 0,
  },
  forearm('goodbye-boy', -0.035, -0.32),
  {
    id: 'goodbye-girl',
    art: 'side-hand',
    parent: 'goodbye-pair',
    w: SIDE_W,
    h: SIDE_H,
    pivot: [1 - PALM_FACE, 0.5],
    x: -START_OVERLAP,
    opacity: 0,
    mirror: true,
  },
  forearm('goodbye-girl', 0.035, 0.32),
];

const tracks: Track[] = [
  {
    part: 'goodbye',
    prop: 'opacity',
    keys: [
      [0, 0],
      [SHOW_S, 1, 'smooth'],
      [LOWER_S + LOWER_LEN_S - 0.6, 1],
      [LOWER_S + LOWER_LEN_S, 0, 'smooth'],
    ],
  },
  // It turns clockwise to upright: face on becomes side on.
  {
    part: 'goodbye-pair',
    prop: 'angle',
    keys: [
      [TURN_S, TURN_FROM],
      [TURN_S + TURN_LEN_S, 0, 'smooth'],
    ],
  },
  {
    part: 'goodbye-face',
    prop: 'opacity',
    keys: [
      [TURN_S, 1],
      [TURN_S + TURN_LEN_S * 0.6, 0, 'smooth'],
    ],
  },
  ...(['boy', 'girl'] as const).flatMap((who): Track[] => [
    {
      part: `goodbye-${who}`,
      prop: 'opacity',
      keys: [
        [TURN_S, 0],
        [TURN_S + TURN_LEN_S * 0.6, 1, 'smooth'],
        // Hers fades away; his stays.
        ...(who === 'girl'
          ? ([
              [FADE_S, 1],
              [FADE_S + FADE_LEN_S, 0, 'smooth'],
            ] as const)
          : []),
      ],
    },
    // As they turn they part, from one hand to two just touching.
    {
      part: `goodbye-${who}`,
      prop: 'x',
      keys: [
        [TURN_S, who === 'boy' ? START_OVERLAP : -START_OVERLAP],
        [TURN_S + TURN_LEN_S, 0, 'smooth'],
      ],
    },
  ]),
  // His hand, alone, stays a moment, and lowers away.
  {
    part: 'goodbye-pair',
    prop: 'y',
    keys: [
      [LOWER_S, 0],
      [LOWER_S + LOWER_LEN_S, -0.85, 'in'],
    ],
  },
];

const wobbles: Wobble[] = [
  // Held up by real arms: the pair breathes a little.
  { part: 'goodbye-pair', prop: 'x', amp: 0.002, period: 3.1 },
  { part: 'goodbye-pair', prop: 'y', amp: 0.002, period: 3.7, phase: 1 },
];

/** A note as the palms meet, and one as hers fades. */
const cues: Cue[] = [
  { t: 0.2, kind: 'note', note: 2 },
  { t: FADE_S, kind: 'note', note: 0 },
];

export const GOODBYE: Chapter = { id: 'goodbye', length: GOODBYE_LENGTH_S, parts, tracks, wobbles, cues };
