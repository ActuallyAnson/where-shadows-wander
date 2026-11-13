// Scene 2, "How they met" (docs/STORY.md): the memory that plays once the player has copied the friend's rabbit. The player's
// rabbit becomes a puppet rabbit and hops off; the scene widens to two small kids under a blanket fort with a torch between them.
// The friend's hand is the rabbit; the new kid tries, makes a lumpy shape, the friend leans over to help, and his rabbit comes
// right; the two rabbits nod at each other, and the kids laugh. Every time is in seconds from the memory's start; tune here.
import {
  bobKeys,
  swingKeys,
  type Cue,
  type Key,
  type PuppetPart,
  type PuppetScene,
  type Track,
  type Wobble,
} from '../puppet/puppet-scene';

/** The floor of the fort, metres up the wall from its centre (above the panelling's rail, as the prologue's path was). */
const FLOOR_Y = -0.12;
/** Where each kid sits: the friend on the left facing right, the boy on the right facing left. */
const FRIEND_X = -0.3;
const BOY_X = 0.3;
/** The kids' size: their parts are drawn at 1 and scaled up together by this (1 is about 23 cm sitting). */
const KID_SCALE = 1.4;

/** The puppet rabbit: from the player's shadow (the handoff) to its first place, then hopping to the friend's raised hand. */
export const RABBIT_FROM: readonly [number, number] = [0.04, 0.06];
const RABBIT_HOPS_S = 1.8;
const RABBIT_HOP_S = 0.55;
const RABBIT_SMALL = 0.7;

/** The fort and the kids appear around the rabbit. */
const WIDEN_FROM_S = 3.4;
const WIDEN_S = 2.2;
/** The boy raises his hand and makes a lump, the friend leans over to help, and the boy's rabbit comes right. */
const BOY_ARM_UP_S = 7.2;
const LUMP_S = 8.4;
const HELP_S = 10.6;
const RIGHT_S = 12.2;
/** They laugh. */
const LAUGH_S = 14.6;
const LAUGH_LEN_S = 3.2;
export const HOW_THEY_MET_LENGTH_S = 23;
const FADE_OUT_FROM_S = 19.6;

/** The kids' arms rest down along their sides at this angle, and are raised to the other. */
const ARM_DOWN = 2.7;
const ARM_UP = 0.62;
/** An arm's shoulder on the kid's body (unscaled; x towards where the kid faces), its length, and its hand along it. */
const SHOULDER: readonly [number, number] = [0.016, 0.112];
const ARM_LEN = 0.085;
const HAND_ALONG = 0.86;

/** Where a kid's raised hand is on the wall: what a rabbit sits on. */
function handAt(x: number, facing: 1 | -1): [number, number] {
  const reach = ARM_LEN * (HAND_ALONG - 0.06);
  return [
    x + KID_SCALE * facing * (SHOULDER[0] + Math.sin(ARM_UP) * reach),
    FLOOR_Y + KID_SCALE * (SHOULDER[1] + Math.cos(ARM_UP) * reach),
  ];
}
const RABBIT_AT_HAND = handAt(FRIEND_X, 1);
const BOY_HAND = handAt(BOY_X, -1);
/** How far the friend leans over to help, and his hand with him. */
const LEAN_X = 0.04 * KID_SCALE;
const LEAN_HAND_X = 0.07 * KID_SCALE;

const fadeOut = (from: number): Key[] => [
  [FADE_OUT_FROM_S, from],
  [HOW_THEY_MET_LENGTH_S - 0.4, 0, 'smooth'],
];

const kid = (id: string, x: number, facing: 1 | -1, armUp: boolean): PuppetPart[] => [
  { id, art: '', parent: 'scenery', w: 1, h: 1, x, y: FLOOR_Y, scale: KID_SCALE },
  { id: `${id}-body`, art: 'kid', parent: id, w: 0.13, h: 0.15, pivot: [0.5, 0], mirror: facing < 0 },
  {
    id: `${id}-head`,
    art: 'kid-head',
    parent: `${id}-body`,
    w: 0.08,
    h: 0.08,
    pivot: [0.5, 0.12],
    x: 0.012 * facing,
    y: 0.135,
    mirror: facing < 0,
  },
  {
    id: `${id}-arm`,
    art: 'arm',
    parent: `${id}-body`,
    w: 0.02,
    h: ARM_LEN,
    pivot: [0.5, 0.06],
    x: SHOULDER[0] * facing,
    y: SHOULDER[1],
    angle: (armUp ? -ARM_UP : -ARM_DOWN) * facing,
    mirror: facing < 0,
  },
];

const parts: PuppetPart[] = [
  // The fort, the torch and the two kids, fading up together.
  { id: 'scenery', art: '', w: 1, h: 1, opacity: 0 },
  { id: 'fort', art: 'fort', parent: 'scenery', w: 1.12, h: 0.62, pivot: [0.5, 0], y: FLOOR_Y - 0.01 },
  {
    id: 'torch-light',
    art: 'orb',
    look: 'glow',
    tint: [1, 0.8, 0.5],
    parent: 'scenery',
    w: 0.46,
    h: 0.46,
    y: FLOOR_Y + 0.05,
    opacity: 0.55,
  },
  { id: 'torch', art: 'torch', parent: 'scenery', w: 0.06, h: 0.025, pivot: [0.5, 0], y: FLOOR_Y, angle: 0.15 },
  ...kid('friend', FRIEND_X, 1, true),
  ...kid('boy', BOY_X, -1, false),
  // The boy's first try: a lump on his hand, which comes right as his rabbit.
  {
    id: 'lump',
    art: 'lump',
    w: 0.07 * KID_SCALE,
    h: 0.06 * KID_SCALE,
    pivot: [0.5, 0.15],
    x: BOY_HAND[0],
    y: BOY_HAND[1],
    opacity: 0,
    mirror: true,
  },
  {
    id: 'boy-rabbit',
    art: 'rabbit',
    w: 0.16,
    h: 0.14,
    pivot: [0.5, 0],
    x: BOY_HAND[0],
    y: BOY_HAND[1],
    scale: RABBIT_SMALL,
    opacity: 0,
    mirror: true,
  },
  // The player's rabbit: the first puppet, over everything.
  { id: 'rabbit', art: 'rabbit', w: 0.16, h: 0.14, pivot: [0.5, 0], x: RABBIT_FROM[0], y: RABBIT_FROM[1], opacity: 0 },
];

/** Hops from `from` to `to`, `n` of them, starting at `t0`: the x keys and the y keys (a lift at each). */
function hops(
  t0: number,
  n: number,
  hop: number,
  from: readonly [number, number],
  to: readonly [number, number],
  lift: number,
) {
  const x: Key[] = [[t0, from[0]]];
  const y: Key[] = [[t0, from[1]]];
  for (let i = 1; i <= n; i++) {
    const t = t0 + i * hop;
    const k = i / n;
    x.push([t, from[0] + (to[0] - from[0]) * k, 'smooth']);
    const base = from[1] + (to[1] - from[1]) * k;
    y.push([t - hop / 2, base + lift, 'out']);
    y.push([t, base, 'in']);
  }
  return { x, y };
}

const rabbitHops = hops(RABBIT_HOPS_S, 3, RABBIT_HOP_S, RABBIT_FROM, RABBIT_AT_HAND, 0.05);
const hopsEnd = RABBIT_HOPS_S + 3 * RABBIT_HOP_S;

const tracks: Track[] = [
  { part: 'scenery', prop: 'opacity', keys: [[WIDEN_FROM_S, 0], [WIDEN_FROM_S + WIDEN_S, 1, 'smooth'], ...fadeOut(1)] },
  // The rabbit comes off the player's shadow, sits, hops to the friend's hand and shrinks to sit on it.
  { part: 'rabbit', prop: 'opacity', keys: [[0, 0], [0.5, 1, 'out'], ...fadeOut(1)] },
  {
    part: 'rabbit',
    prop: 'y',
    keys: [
      ...rabbitHops.y,
      // It nods at the boy's rabbit when that one comes right.
      [RIGHT_S + 0.6, RABBIT_AT_HAND[1]],
      [RIGHT_S + 0.85, RABBIT_AT_HAND[1] + 0.012, 'out'],
      [RIGHT_S + 1.1, RABBIT_AT_HAND[1], 'in'],
    ],
  },
  {
    part: 'rabbit',
    prop: 'scale',
    keys: [
      [hopsEnd - 0.8, 1],
      [hopsEnd + 0.4, RABBIT_SMALL, 'smooth'],
    ],
  },
  // Its ears twitch now and then.
  {
    part: 'rabbit',
    prop: 'angle',
    keys: [
      [0.9, 0],
      [1.05, 0.12, 'out'],
      [1.3, 0, 'smooth'],
      [hopsEnd + 1.6, 0],
      [hopsEnd + 1.75, 0.14, 'out'],
      [hopsEnd + 2.0, 0, 'smooth'],
    ],
  },
  // The boy raises his hand; a lump wobbles on it while he tilts his head at it.
  {
    part: 'boy-arm',
    prop: 'angle',
    keys: [
      [BOY_ARM_UP_S, ARM_DOWN],
      [BOY_ARM_UP_S + 1.0, ARM_UP, 'smooth'],
    ],
  },
  {
    part: 'lump',
    prop: 'opacity',
    keys: [
      [LUMP_S, 0],
      [LUMP_S + 0.5, 1, 'out'],
      [RIGHT_S - 0.2, 1],
      [RIGHT_S + 0.3, 0, 'in'],
    ],
  },
  { part: 'lump', prop: 'angle', keys: swingKeys(LUMP_S + 0.4, RIGHT_S, 0.9, 0.18) },
  {
    part: 'boy-head',
    prop: 'angle',
    keys: [
      [LUMP_S + 0.4, 0],
      [LUMP_S + 1.2, 0.22, 'smooth'],
      [HELP_S + 0.6, 0.22],
      [HELP_S + 1.2, 0, 'smooth'],
      // He laughs: his head tips back (he faces left, so back is clockwise).
      [LAUGH_S, 0],
      [LAUGH_S + 0.4, -0.3, 'out'],
      [LAUGH_S + LAUGH_LEN_S, -0.3],
      [LAUGH_S + LAUGH_LEN_S + 0.8, 0, 'smooth'],
    ],
  },
  // The friend leans over to show him, and sits back once it is right.
  {
    part: 'friend-body',
    prop: 'angle',
    keys: [
      [HELP_S, 0],
      [HELP_S + 0.7, -0.16, 'smooth'],
      [RIGHT_S + 0.4, -0.16],
      [RIGHT_S + 1.2, 0, 'smooth'],
    ],
  },
  {
    part: 'friend',
    prop: 'x',
    keys: [
      [HELP_S, FRIEND_X],
      [HELP_S + 0.7, FRIEND_X + LEAN_X, 'smooth'],
      [RIGHT_S + 0.4, FRIEND_X + LEAN_X],
      [RIGHT_S + 1.2, FRIEND_X, 'smooth'],
    ],
  },
  // While the friend leans, the rabbit on his hand goes with him.
  {
    part: 'rabbit',
    prop: 'x',
    keys: [
      ...rabbitHops.x,
      [HELP_S, RABBIT_AT_HAND[0]],
      [HELP_S + 0.7, RABBIT_AT_HAND[0] + LEAN_HAND_X, 'smooth'],
      [RIGHT_S + 0.4, RABBIT_AT_HAND[0] + LEAN_HAND_X],
      [RIGHT_S + 1.2, RABBIT_AT_HAND[0], 'smooth'],
    ],
  },
  // The boy's rabbit comes right, and nods back.
  { part: 'boy-rabbit', prop: 'opacity', keys: [[RIGHT_S, 0], [RIGHT_S + 0.4, 1, 'out'], ...fadeOut(1)] },
  {
    part: 'boy-rabbit',
    prop: 'scale',
    keys: [
      [RIGHT_S, RABBIT_SMALL * 0.6],
      [RIGHT_S + 0.5, RABBIT_SMALL, 'out'],
    ],
  },
  {
    part: 'boy-rabbit',
    prop: 'y',
    keys: [
      [RIGHT_S + 1.3, BOY_HAND[1]],
      [RIGHT_S + 1.55, BOY_HAND[1] + 0.012, 'out'],
      [RIGHT_S + 1.8, BOY_HAND[1], 'in'],
    ],
  },
  {
    part: 'friend-head',
    prop: 'angle',
    keys: [
      // He looks at the boy's lump, then laughs with his head back (he faces right, so back is counter-clockwise).
      [LUMP_S + 0.6, 0],
      [LUMP_S + 1.2, -0.12, 'smooth'],
      [RIGHT_S + 1.2, -0.12],
      [RIGHT_S + 1.8, 0, 'smooth'],
      [LAUGH_S + 0.15, 0],
      [LAUGH_S + 0.55, 0.3, 'out'],
      [LAUGH_S + LAUGH_LEN_S, 0.3],
      [LAUGH_S + LAUGH_LEN_S + 0.8, 0, 'smooth'],
    ],
  },
  // Laughing shakes them: small quick bobs.
  { part: 'friend-body', prop: 'scale', keys: bobKeys(LAUGH_S + 0.2, LAUGH_S + LAUGH_LEN_S, 0.36, 1, 0.025) },
  { part: 'boy-body', prop: 'scale', keys: bobKeys(LAUGH_S, LAUGH_S + LAUGH_LEN_S - 0.2, 0.4, 1, 0.025) },
];

const wobbles: Wobble[] = [
  // The torch's light breathes; the kids breathe.
  { part: 'torch-light', prop: 'scale', amp: 0.025, period: 2.3 },
  { part: 'torch-light', prop: 'opacity', amp: 0.04, period: 1.7, phase: 1 },
  { part: 'friend-body', prop: 'angle', amp: 0.012, period: 3.6 },
  { part: 'boy-body', prop: 'angle', amp: 0.012, period: 3.9, phase: 2 },
];

/** The lullaby's first note as the rabbit comes off the player's hand, and as the boy's rabbit comes right; two as they laugh. */
const cues: Cue[] = [
  { t: 0.1, kind: 'note', note: 0 },
  { t: RIGHT_S + 0.1, kind: 'note', note: 2 },
  { t: LAUGH_S, kind: 'note', note: 3 },
  { t: LAUGH_S + 0.6, kind: 'note', note: 4 },
];

export const HOW_THEY_MET_SCENE: PuppetScene = {
  id: 'how-they-met',
  length: HOW_THEY_MET_LENGTH_S,
  parts,
  tracks,
  wobbles,
  cues,
};
