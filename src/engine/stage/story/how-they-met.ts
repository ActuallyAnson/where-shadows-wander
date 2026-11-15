// Scene 2, "How they met" (docs/STORY.md): the story's second chapter (story-stage.ts), played once the player has copied the
// friend's rabbit. The night they met (the-storm.ts) has put the two small kids under the blanket fort with a torch between
// them; the player's rabbit becomes a puppet rabbit in it. The rabbit hops onto the friend's raised hand; the new kid tries, makes a lumpy
// shape, the friend leans over to help, and his rabbit comes right; the two rabbits nod at each other, and the kids laugh. Then
// the rabbit hops down onto the blanket. Then the hush: footsteps creak outside, a door's line of light opens at the wall's edge,
// and she claps her hand over the torch (the room's candle dims with it) until the footsteps go; they giggle. Then the friend
// raises her hand again for the next shape: the chapter ends on that, and the story holds the picture while the friend's hand
// shows the fox. Every time is in seconds from the chapter's start.
import type { Chapter } from '../puppet/chapters';
import { bobKeys, swingKeys, type Cue, type PuppetPart, type Track } from '../puppet/puppet-scene';
import { ROOM_WALL_HEIGHT_M, ROOM_WALL_WIDTH_M, STORY_SCALE } from '../stage-frame';
import { ARM_DOWN, ARM_UP, FLOOR_Y, KID_SCALE, SHOULDER, SIT_REACH, handAt, hops } from './story-kit';

export { FLOOR_Y };

/** Where each kid sits: the friend on the left facing right, the boy on the right facing left. */
export const FRIEND_X = -0.3;
export const BOY_X = 0.3;

/** The puppet rabbit: from the player's shadow (the handoff) to its first place, then hopping to the friend's raised hand. */
export const RABBIT_FROM: readonly [number, number] = [0.04, 0.06];
const RABBIT_HOPS_S = 2.4;
const RABBIT_HOP_S = 0.55;
const RABBIT_SMALL = 0.7;

/** The boy raises his hand and makes a lump, the friend leans over to help, and the boy's rabbit comes right. */
const BOY_ARM_UP_S = 5.0;
const LUMP_S = 6.2;
const HELP_S = 8.4;
const RIGHT_S = 10.0;
/** They laugh. */
const LAUGH_S = 12.4;
const LAUGH_LEN_S = 3.2;
/** The boy lowers his hand (his rabbit gone), the rabbit hops down to the blanket, and the friend's arm goes down... */
const SETTLE_S = 16.8;
/**
 * The hush (docs/STORY.md, scene 2, "The hush"), once the rabbit is on the blanket and her arm is down: footsteps outside, a
 * door's line of light, and she claps her hand over the torch until they pass. Times within it are from HUSH_S.
 */
export const HUSH_S = 19.0;
export const HUSH_LEN_S = 7.6;
/** Footsteps coming (four) and going (three), from the door's side. */
const STEPS_IN = [0, 0.6, 1.2, 1.8];
const STEPS_OUT = [4.0, 4.6, 5.2];
/** Both look up at the sound. */
const H_LOOK = 0.5;
/** The door's line of light opens, and later narrows and closes. */
const H_DOOR = 1.5;
const H_DOOR_SHUT = 3.9;
/** She scoots over and leans in, her hand going to the torch, and claps it over: the torch goes dark, and so does the room. */
const H_REACH = 1.9;
export const H_CLAP = 2.25;
/** She lifts her hand: the torch and the room come back. Then the giggles. */
export const H_LIFT = 5.3;
const H_GIGGLE = 5.8;
const H_GIGGLE_END = 7.3;
/** How dim the room's candle goes while her hand is on the torch (LightHush), and how fast it goes and comes back. */
export const HUSH_LEVEL = 0.4;
const HUSH_DOWN_S = 0.2;
const HUSH_UP_S = 0.5;
/** The torch's glow at rest (the-storm.ts) and under her hand. */
const TORCH_GLOW = 0.55;
const TORCH_HUSHED = 0.03;
/** Where the torch stands (between the kids, on the scenery that slid in) and the door's line of light (the wall's right edge). */
export const TORCH_X = 0;
const DOOR_X = 0.74;
/**
 * Her arm reaching forward and down (radians from straight up, on her body) and her body leaning right in over the torch (its
 * angle, clockwise as she faces right): a lunge, so a sitting kid's short arm reaches the floor.
 */
export const HUSH_ARM = 2.4;
export const HUSH_LEAN = -0.45;
/** She comes up onto her knees for the lunge, so leaning does not sink her body's front into the floor. */
export const HUSH_RISE = 0.02;
/** At the first footsteps the rabbit scampers off the torch to the boy, and hops back to its place in the giggles. */
const H_SCAMPER = 0.4;
const H_BACK = 6.0;
const RABBIT_HIDE: readonly [number, number] = [0.17, FLOOR_Y];
/** Where the torch's top is: her hand comes down just over it. */
export const TORCH_TOP_Y = FLOOR_Y + 0.025;

/**
 * Where a sitting kid facing right at `x` has its hand, its body leaning by `lean` (its angle; negative is forward) and its arm
 * at `arm` from straight up on the body. The body turns about its base, and the arm hangs from the shoulder on it.
 */
export function leaningHand(x: number, arm: number, lean: number): [number, number] {
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  const shoulderX = SHOULDER[0] * c - SHOULDER[1] * s;
  const shoulderY = SHOULDER[0] * s + SHOULDER[1] * c;
  const a = arm - lean;
  return [
    x + KID_SCALE * (shoulderX + Math.sin(a) * SIT_REACH),
    FLOOR_Y + KID_SCALE * (shoulderY + Math.cos(a) * SIT_REACH),
  ];
}

/** Where she scoots to, so her hand comes down over the torch. */
export const HUSH_FRIEND_X = TORCH_X - leaningHand(0, HUSH_ARM, HUSH_LEAN)[0];
/** Where her hand is while it is over the torch (with the rise). */
export const HUSH_HAND: readonly [number, number] = [TORCH_X, leaningHand(0, HUSH_ARM, HUSH_LEAN)[1] + HUSH_RISE];
/** ...and her arm comes up again: the next shape. The chapter ends with it raised. */
const ASK_S = HUSH_S + HUSH_LEN_S + 0.2;
export const HOW_THEY_MET_LENGTH_S = ASK_S + 1.2;
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
export const WALL_HALF_H = ROOM_WALL_HEIGHT_M / 2 / STORY_SCALE;
/** The fort's size: its chair backs just past the wall's sides, and its blanket's peak just past the wall's top. */
export const FORT_W = 2 * WALL_HALF_W + 0.12;
export const FORT_BASE_Y = FLOOR_Y - 0.01;
export const FORT_H = (WALL_HALF_H - FORT_BASE_Y) / 0.94;
/** How far the fort slides to be off the wall: it is wider than the other places, so it starts and ends further out. */
export const FORT_OFF_X = WALL_HALF_W + FORT_W / 2 + 0.02;

const parts: PuppetPart[] = [
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
  // The hush: a door left ajar somewhere outside the fort, its line of light at the wall's right edge (off until then).
  {
    id: 'door-light',
    art: 'door-light',
    look: 'glow',
    tint: [1, 0.86, 0.62],
    w: 0.16,
    h: 0.46,
    pivot: [0.8, 0],
    x: DOOR_X,
    y: FLOOR_Y - 0.06,
    opacity: 0,
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
const scamper = hops(HUSH_S + H_SCAMPER, 2, 0.32, RABBIT_REST, RABBIT_HIDE, 0.03);
const scamperBack = hops(HUSH_S + H_BACK, 2, 0.4, RABBIT_HIDE, RABBIT_REST, 0.04);

const tracks: Track[] = [
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
      ...scamper.y,
      ...scamperBack.y,
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
      // In the hush it crouches low, and sits up again after.
      [HUSH_S + H_LOOK, RABBIT_REST_SCALE],
      [HUSH_S + H_LOOK + 0.3, RABBIT_REST_SCALE * 0.88, 'smooth'],
      [HUSH_S + H_LIFT + 0.2, RABBIT_REST_SCALE * 0.88],
      [HUSH_S + H_LIFT + 0.6, RABBIT_REST_SCALE, 'smooth'],
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
      // Its ears go back at the footsteps.
      [HUSH_S + H_LOOK, 0],
      [HUSH_S + H_LOOK + 0.2, -0.12, 'out'],
      [HUSH_S + H_LIFT + 0.2, -0.12],
      [HUSH_S + H_LIFT + 0.6, 0, 'smooth'],
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
      // The hush: her hand goes to the torch and claps over it, held until the footsteps go.
      [HUSH_S + H_REACH, -ARM_DOWN + 0.5],
      [HUSH_S + H_CLAP, -HUSH_ARM, 'out'],
      [HUSH_S + H_LIFT, -HUSH_ARM],
      [HUSH_S + H_LIFT + 0.6, -ARM_DOWN + 0.5, 'smooth'],
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
      // The hush: his head comes up at the footsteps and holds; then he giggles with it ducked towards her.
      [HUSH_S + H_LOOK, 0],
      [HUSH_S + H_LOOK + 0.3, -0.14, 'out'],
      [HUSH_S + H_LIFT, -0.14],
      [HUSH_S + H_GIGGLE, 0.18, 'smooth'],
      [HUSH_S + H_GIGGLE_END, 0.18],
      [HUSH_S + HUSH_LEN_S, 0, 'smooth'],
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
      // The hush: she leans right in over the torch, and sits back after.
      [HUSH_S + H_REACH, 0],
      [HUSH_S + H_CLAP, HUSH_LEAN, 'out'],
      [HUSH_S + H_LIFT + 0.1, HUSH_LEAN],
      [HUSH_S + H_LIFT + 0.9, 0, 'smooth'],
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
      // The hush: she scoots over to the torch, quick, and back after.
      [HUSH_S + H_REACH, FRIEND_X],
      [HUSH_S + H_CLAP, HUSH_FRIEND_X, 'out'],
      [HUSH_S + H_LIFT + 0.1, HUSH_FRIEND_X],
      [HUSH_S + H_LIFT + 0.9, FRIEND_X, 'smooth'],
    ],
  },
  {
    part: 'friend',
    prop: 'y',
    keys: [
      [HUSH_S + H_REACH, FLOOR_Y],
      [HUSH_S + H_CLAP, FLOOR_Y + HUSH_RISE, 'out'],
      [HUSH_S + H_LIFT + 0.1, FLOOR_Y + HUSH_RISE],
      [HUSH_S + H_LIFT + 0.9, FLOOR_Y, 'smooth'],
    ],
  },
  // The torch goes dark under her hand, and comes back as she lifts it.
  {
    part: 'torch-light',
    prop: 'opacity',
    keys: [
      [HUSH_S + H_CLAP - 0.04, TORCH_GLOW],
      [HUSH_S + H_CLAP + 0.08, TORCH_HUSHED, 'out'],
      [HUSH_S + H_LIFT, TORCH_HUSHED],
      [HUSH_S + H_LIFT + 0.3, TORCH_GLOW, 'smooth'],
    ],
  },
  // The door's line of light: opening, lingering, narrowing, gone.
  {
    part: 'door-light',
    prop: 'opacity',
    keys: [
      [HUSH_S + H_DOOR, 0],
      [HUSH_S + H_DOOR + 0.6, 0.34, 'smooth'],
      [HUSH_S + H_DOOR_SHUT, 0.3],
      [HUSH_S + H_DOOR_SHUT + 0.5, 0.12, 'smooth'],
      [HUSH_S + H_DOOR_SHUT + 0.8, 0, 'in'],
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
      ...scamper.x,
      ...scamperBack.x,
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
      // The hush: her head comes up at the footsteps, then down over the torch; she giggles with it ducked towards him.
      [HUSH_S + H_LOOK, 0],
      [HUSH_S + H_LOOK + 0.3, 0.12, 'out'],
      [HUSH_S + H_REACH, 0.12],
      [HUSH_S + H_CLAP, 0.05, 'smooth'],
      [HUSH_S + H_LIFT, 0.05],
      [HUSH_S + H_GIGGLE, -0.18, 'smooth'],
      [HUSH_S + H_GIGGLE_END, -0.18],
      [HUSH_S + HUSH_LEN_S, 0, 'smooth'],
      // She looks up at her raised hand: now this one.
      [ASK_S + 0.2, 0],
      [ASK_S + 0.9, 0.18, 'smooth'],
    ],
  },
  // Laughing shakes them: small quick bobs; the giggles after the hush, smaller and quicker.
  {
    part: 'friend-body',
    prop: 'scale',
    keys: [
      ...bobKeys(LAUGH_S + 0.2, LAUGH_S + LAUGH_LEN_S, 0.36, 1, 0.025),
      ...bobKeys(HUSH_S + H_GIGGLE + 0.1, HUSH_S + H_GIGGLE_END, 0.28, 1, 0.018),
    ],
  },
  {
    part: 'boy-body',
    prop: 'scale',
    keys: [
      ...bobKeys(LAUGH_S, LAUGH_S + LAUGH_LEN_S - 0.2, 0.4, 1, 0.025),
      ...bobKeys(HUSH_S + H_GIGGLE, HUSH_S + H_GIGGLE_END - 0.1, 0.3, 1, 0.018),
    ],
  },
];

/** Where the window is in the memory (the-storm.ts's room, still on the wall behind the fort): the far thunder comes from there. */
const WINDOW_X = 0.5;
const WINDOW_Y = 0.24;
/** A far roll of thunder outside, while the friend shows him the rabbit: the storm they met in goes on. */
const RUMBLE_S = 3.2;

/**
 * The storm going on outside, the kids laughing, and the hush: a grown-up's footsteps outside the fort, and the room's candle
 * dimmed with the torch while they pass, then giggles.
 */
const cues: Cue[] = [
  { t: RUMBLE_S, kind: 'sound', sound: 'rumble', x: WINDOW_X, y: WINDOW_Y },
  { t: LAUGH_S + 0.1, kind: 'sound', sound: 'laugh', x: TORCH_X, y: FLOOR_Y },
  // The hush: footsteps coming, the room's candle dimmed with the torch, footsteps going, the light back.
  ...STEPS_IN.map((s, i): Cue => ({ t: HUSH_S + s, kind: 'step', variant: (i % 2) as 0 | 1, x: DOOR_X, y: FLOOR_Y })),
  { t: HUSH_S + H_CLAP, kind: 'hush', level: HUSH_LEVEL, seconds: HUSH_DOWN_S },
  ...STEPS_OUT.map((s, i): Cue => ({ t: HUSH_S + s, kind: 'step', variant: (i % 2) as 0 | 1, x: DOOR_X, y: FLOOR_Y })),
  { t: HUSH_S + H_LIFT, kind: 'hush', level: 1, seconds: HUSH_UP_S },
  { t: HUSH_S + H_GIGGLE, kind: 'sound', sound: 'laugh', x: TORCH_X, y: FLOOR_Y },
];

export const HOW_THEY_MET: Chapter = {
  id: 'how-they-met',
  length: HOW_THEY_MET_LENGTH_S,
  parts,
  tracks,
  cues,
};
