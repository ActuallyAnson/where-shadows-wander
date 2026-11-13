// Scene 2, "How they met" (docs/STORY.md): the first chapter of the story's puppet show (story-stage.ts), played once the player
// has copied the friend's rabbit. The player's rabbit becomes a puppet rabbit, and the fort slides in around it: two small kids
// under a blanket fort with a torch between them. The rabbit hops onto the friend's raised hand; the new kid tries, makes a lumpy
// shape, the friend leans over to help, and his rabbit comes right; the two rabbits nod at each other, and the kids laugh. Then
// the rabbit hops down onto the blanket, and the friend raises her hand again for the next shape: the chapter ends on that, and
// the story holds the picture while the friend's hand shows the fox. Every time is in seconds from the chapter's start.
import { OFF_WALL_X, slideKeys, type Chapter } from '../puppet/chapters';
import { bobKeys, swingKeys, type Cue, type PuppetPart, type Track, type Wobble } from '../puppet/puppet-scene';
import { ROOM_WALL_HEIGHT_M, ROOM_WALL_WIDTH_M, STORY_SCALE } from '../stage-frame';
import { ARM_DOWN, ARM_UP, FLOOR_Y, KID_SCALE, handAt, hops, sittingKid } from './story-kit';

export { FLOOR_Y };

/** Where each kid sits: the friend on the left facing right, the boy on the right facing left. */
export const FRIEND_X = -0.3;
const BOY_X = 0.3;

/** The puppet rabbit: from the player's shadow (the handoff) to its first place, then hopping to the friend's raised hand. */
export const RABBIT_FROM: readonly [number, number] = [0.04, 0.06];
const RABBIT_HOPS_S = 5.0;
const RABBIT_HOP_S = 0.55;
const RABBIT_SMALL = 0.7;

/** The fort and the kids slide in from the right around the sitting rabbit (the fort, further back, a little behind them). */
const SLIDE_IN_S = 1.6;
const SLIDE_S = 2.6;
/** The boy raises his hand and makes a lump, the friend leans over to help, and the boy's rabbit comes right. */
const BOY_ARM_UP_S = 7.6;
const LUMP_S = 8.8;
const HELP_S = 11.0;
const RIGHT_S = 12.6;
/** They laugh. */
const LAUGH_S = 15.0;
const LAUGH_LEN_S = 3.2;
/** The boy lowers his hand (his rabbit gone), the rabbit hops down to the blanket, and the friend's arm goes down... */
const SETTLE_S = 19.4;
/** ...and comes up again: the next shape. The chapter ends with it raised. */
const ASK_S = 21.4;
export const HOW_THEY_MET_LENGTH_S = 22.6;
/** Where the rabbit sits on the blanket at the end, between the kids: where the fox finds it. */
export const RABBIT_REST: readonly [number, number] = [0.02, FLOOR_Y];
export const RABBIT_REST_SCALE = 0.85;

const RABBIT_AT_HAND = handAt(FRIEND_X, 1);
const BOY_HAND = handAt(BOY_X, -1);
/** How far the friend leans over to help, and her hand with her. */
const LEAN_X = 0.04 * KID_SCALE;
const LEAN_HAND_X = 0.07 * KID_SCALE;

/** How far back the fort stands (PuppetPart.depth): a paler, softer shadow behind the kids, the torch and the rabbits. */
export const FORT_DEPTH = 0.6;
/** Half the wall's width and height in stage metres: the fort fills the wall, so the kids are inside it with the player. */
const WALL_HALF_W = ROOM_WALL_WIDTH_M / 2 / STORY_SCALE;
const WALL_HALF_H = ROOM_WALL_HEIGHT_M / 2 / STORY_SCALE;
/** The fort's size: its chair backs just past the wall's sides, and its blanket's peak just past the wall's top. */
const FORT_W = 2 * WALL_HALF_W + 0.12;
const FORT_BASE_Y = FLOOR_Y - 0.01;
const FORT_H = (WALL_HALF_H - FORT_BASE_Y) / 0.94;
/** How far the fort slides to be off the wall: it is wider than the other places, so it starts and ends further out. */
export const FORT_OFF_X = WALL_HALF_W + FORT_W / 2 + 0.02;

const parts: PuppetPart[] = [
  // The fort, standing back and filling the wall, and in front of it the torch and the two kids (the scenery), sliding in together.
  {
    id: 'fort',
    art: 'fort',
    w: FORT_W,
    h: FORT_H,
    pivot: [0.5, 0],
    x: FORT_OFF_X,
    y: FORT_BASE_Y,
    depth: FORT_DEPTH,
  },
  { id: 'scenery', art: '', w: 1, h: 1, x: OFF_WALL_X },
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
  {
    id: 'torch',
    art: 'torch',
    parent: 'scenery',
    w: 0.06,
    h: 0.025,
    pivot: [0.5, 0],
    y: FLOOR_Y,
    angle: 0.15,
  },
  ...sittingKid('friend', FRIEND_X, 1, { parent: 'scenery', y: FLOOR_Y, armUp: true, girl: true }),
  ...sittingKid('boy', BOY_X, -1, { parent: 'scenery', y: FLOOR_Y }),
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

const rabbitHops = hops(RABBIT_HOPS_S, 3, RABBIT_HOP_S, RABBIT_FROM, RABBIT_AT_HAND, 0.05);
const hopsEnd = RABBIT_HOPS_S + 3 * RABBIT_HOP_S;
/** At the end, it hops down off the friend's hand to sit on the blanket between them. */
const DOWN_HOPS_S = SETTLE_S + 0.4;
const DOWN_HOP_S = 0.5;
const downHops = hops(DOWN_HOPS_S, 2, DOWN_HOP_S, RABBIT_AT_HAND, RABBIT_REST, 0.06);
const downEnd = DOWN_HOPS_S + 2 * DOWN_HOP_S;

const tracks: Track[] = [
  { part: 'fort', prop: 'x', keys: slideKeys(SLIDE_IN_S, SLIDE_S, FORT_OFF_X, 0, FORT_DEPTH) },
  { part: 'scenery', prop: 'x', keys: slideKeys(SLIDE_IN_S, SLIDE_S, OFF_WALL_X, 0) },
  // The rabbit comes off the player's shadow, sits, hops to the friend's hand and shrinks to sit on it.
  {
    part: 'rabbit',
    prop: 'opacity',
    keys: [
      [0, 0],
      [0.5, 1, 'out'],
    ],
  },
  {
    part: 'rabbit',
    prop: 'y',
    keys: [
      ...rabbitHops.y,
      // It nods at the boy's rabbit when that one comes right.
      [RIGHT_S + 0.6, RABBIT_AT_HAND[1]],
      [RIGHT_S + 0.85, RABBIT_AT_HAND[1] + 0.012, 'out'],
      [RIGHT_S + 1.1, RABBIT_AT_HAND[1], 'in'],
      ...downHops.y,
    ],
  },
  {
    part: 'rabbit',
    prop: 'scale',
    keys: [
      [hopsEnd - 0.8, 1],
      [hopsEnd + 0.4, RABBIT_SMALL, 'smooth'],
      [DOWN_HOPS_S, RABBIT_SMALL],
      [downEnd, RABBIT_REST_SCALE, 'smooth'],
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
      // And once on the blanket, looking up at the friend's hand rising.
      [ASK_S + 0.3, 0],
      [ASK_S + 0.5, 0.16, 'out'],
      [ASK_S + 0.9, 0.1, 'smooth'],
    ],
  },
  // The boy raises his hand; a lump wobbles on it while he tilts his head at it. He lowers it at the end.
  {
    part: 'boy-arm',
    prop: 'angle',
    keys: [
      [BOY_ARM_UP_S, ARM_DOWN],
      [BOY_ARM_UP_S + 1.0, ARM_UP, 'smooth'],
      [SETTLE_S, ARM_UP],
      [SETTLE_S + 0.9, ARM_DOWN, 'smooth'],
    ],
  },
  // The friend's hand, the rabbit's perch: down once the rabbit has hopped off, and up again for the next shape.
  {
    part: 'friend-arm',
    prop: 'angle',
    keys: [
      [downEnd - 0.2, -ARM_UP],
      [downEnd + 0.5, -ARM_DOWN + 0.5, 'smooth'],
      [ASK_S, -ARM_DOWN + 0.5],
      [ASK_S + 0.8, -ARM_UP - 0.15, 'smooth'],
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
  // While the friend leans, the rabbit on her hand goes with her.
  {
    part: 'rabbit',
    prop: 'x',
    keys: [
      ...rabbitHops.x,
      [HELP_S, RABBIT_AT_HAND[0]],
      [HELP_S + 0.7, RABBIT_AT_HAND[0] + LEAN_HAND_X, 'smooth'],
      [RIGHT_S + 0.4, RABBIT_AT_HAND[0] + LEAN_HAND_X],
      [RIGHT_S + 1.2, RABBIT_AT_HAND[0], 'smooth'],
      ...downHops.x,
    ],
  },
  // The boy's rabbit comes right, and nods back; his hand opens as he lowers it.
  {
    part: 'boy-rabbit',
    prop: 'opacity',
    keys: [
      [RIGHT_S, 0],
      [RIGHT_S + 0.4, 1, 'out'],
      [SETTLE_S, 1],
      [SETTLE_S + 0.4, 0, 'in'],
    ],
  },
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
      // She looks at the boy's lump, then laughs with her head back (she faces right, so back is counter-clockwise).
      [LUMP_S + 0.6, 0],
      [LUMP_S + 1.2, -0.12, 'smooth'],
      [RIGHT_S + 1.2, -0.12],
      [RIGHT_S + 1.8, 0, 'smooth'],
      [LAUGH_S + 0.15, 0],
      [LAUGH_S + 0.55, 0.3, 'out'],
      [LAUGH_S + LAUGH_LEN_S, 0.3],
      [LAUGH_S + LAUGH_LEN_S + 0.8, 0, 'smooth'],
      // She looks up at her raised hand: now this one.
      [ASK_S + 0.2, 0],
      [ASK_S + 0.9, 0.18, 'smooth'],
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

/**
 * The lullaby's first note as the rabbit comes off the player's hand, and as the boy's rabbit comes right; two as they laugh;
 * one as the friend's hand goes up again.
 */
const cues: Cue[] = [
  { t: 0.1, kind: 'note', note: 0 },
  { t: RIGHT_S + 0.1, kind: 'note', note: 2 },
  { t: LAUGH_S, kind: 'note', note: 3 },
  { t: LAUGH_S + 0.6, kind: 'note', note: 4 },
  { t: ASK_S + 0.6, kind: 'note', note: 1 },
];

export const HOW_THEY_MET: Chapter = {
  id: 'how-they-met',
  length: HOW_THEY_MET_LENGTH_S,
  parts,
  tracks,
  wobbles,
  cues,
};
