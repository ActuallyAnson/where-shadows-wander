// Scene 4, "Fireflies" (docs/STORY.md): the chapter after the friend's cup. The firefly settles into the player's cupped shadow
// and glows there, then goes back to hover over the kids, still lying in the park's grass at dusk. More fireflies come up out
// of the grass; the boy reaches up too, and the fireflies come down, one at a time, to settle on their two raised hands, which
// glow with them. They open their hands and let them go, a few at a time, up and away over the top of the wall; all but the
// first, the player's, which lingers over them. They sit up in the grass, turned to each other; the friend takes out a jar,
// the lingering firefly comes down into it, and she holds it out to the boy, glowing, and he takes it into his lap. They stand
// and walk on; the park slides off to the left and a school gate slides in from the right in a pale autumn morning (the firefly
// still glowing in the jar, softer in the daylight), leaves falling. At the gate the boy turns round to face the friend, and she raises her hand:
// the chapter ends on that, and the story holds the picture while the friend's hand waves. Every time is in seconds from the
// chapter's start.
import type { Chapter } from '../puppet/chapters';
import type { Cue, Key, PuppetPart, Track, Wobble } from '../puppet/puppet-scene';
import {
  ARM_DOWN,
  FIREFLY_TINT,
  FLOOR_Y,
  KID_SCALE,
  SIT_REACH,
  STAND_ARM_DOWN,
  STAND_ARM_UP,
  WALK,
  type Gait,
  fadeKeys,
  firefly,
  fireflyWobbles,
  handAtArm,
  sittingKid,
  standingKid,
  stepTracks,
} from './story-kit';
import {
  BOY_FACING,
  FIREFLY_HOVER,
  FRIEND_LIES_X,
  GRASS_W,
  LYING_ARM,
  PARK_FROM_DX,
  PARK_TREES,
  STARS,
  starId,
} from './the-park';

/** The firefly sits in the player's cup this long (the handoff), glowing brighter, then goes back to hover over the kids. */
export const CUP_HOLD_S = 2.6;
/** More fireflies come up out of the grass... */
const RISE_S = 3.0;
const RISE_EVERY_S = 0.35;
const RISE_LEN_S = 2.6;
/** ...and the boy reaches up too, beside her. */
const BOY_REACH_S = 3.4;
const REACH_LEN_S = 1.0;
/** The fireflies come down to their hands, a firefly at a time, turn and turn about. */
export const GATHER_S = 5.2;
const GATHER_EVERY_S = 0.8;
const INTO_HAND_S = 1.4;
/** They hold them a moment, then open their hands and let them go, a few at a time. */
const RELEASE_S = GATHER_S + 8 * GATHER_EVERY_S + INTO_HAND_S + 1.6;
const RELEASE_GROUP_S = 1.8;
const RELEASE_LEN_S = 3.4;
/** Their arms come down... */
const ARMS_DOWN_S = RELEASE_S + 2 * RELEASE_GROUP_S + 1.4;
const ARMS_DOWN_LEN_S = 1.2;
/** ...and they sit up in the grass, turned to each other (the lying kids give way to sitting ones). */
const SIT_S = ARMS_DOWN_S + ARMS_DOWN_LEN_S + 0.4;
const CROSS_S = 0.6;
/** The friend takes out a jar and holds it in her lap... */
const JAR_S = SIT_S + 0.9;
/** ...and the first firefly, the one that would not go, comes down into it. */
const INTO_JAR_S = JAR_S + 0.9;
const INTO_JAR_LEN_S = 1.4;
/** She holds it out, he reaches for it, takes it, and brings it in to his lap. */
const GIVE_S = INTO_JAR_S + INTO_JAR_LEN_S + 0.8;
const OFFER_LEN_S = 0.9;
export const HANDOVER_S = GIVE_S + OFFER_LEN_S + 0.3;
const TAKE_LEN_S = 0.9;
/** They stand and walk on; the park slides away and the school gate slides in, in a pale morning. */
const STAND_S = HANDOVER_S + TAKE_LEN_S + 1.4;
export const WALK_S = STAND_S + 0.55;
/**
 * They walk on the spot while the ground goes by under them, off to the left: the park's grass and trees leave and the school
 * gate comes in, all at the pace of their stride, so their feet never skate. (The kids themselves barely move on the wall: the boy
 * drifts the little way from where he sat to where he stops.)
 */
export const WALK_LEN_S = 8.85;
/** The ground picks up its pace, and slows to a stop, over this long (the legs do too). */
const WALK_RAMP_S = 0.45;
const PARK_OUT_S = WALK_S;
/** The gate comes into view about here (for its sound). */
const GATE_IN_S = WALK_S + 3.8;
const STOP_S = WALK_S + WALK_LEN_S;
/**
 * The walk's gait: a stride's stance foot goes back 4 * leg * sin(legs) / stride along the ground (a leg is 0.1 * KID_SCALE long),
 * 0.265 m/s here, which is the pace of the grass under them (GRASS_W over the walk).
 */
const WALK_ON: Gait = { ...WALK, legs: 0.44 };
/** At the gate the boy turns round to face the friend, and she raises her hand. */
const TURN_S = STOP_S + 2.2;
const TURN_LEN_S = 0.3;
const RAISE_S = TURN_S + 0.7;
export const FIREFLIES_LENGTH_S = RAISE_S + 1.6;

/**
 * Where their raised hands are on the wall while the fireflies come to them (the tips of their front arms, lying on their backs;
 * fireflies.test.ts checks these against the puppets).
 */
export const FRIEND_HAND: readonly [number, number] = [-0.255, 0.031];
export const BOY_HAND: readonly [number, number] = [0.442, 0.047];
/** The fireflies' light on a lying kid's hand, along the arm from the shoulder (unscaled). */
const LYING_HAND_ALONG = 0.07;

/** The sitting kids' arms, radians from straight up, forward: the jar in her lap, held out between them, and in his lap. */
const LAP_ARM = 2.4;
const OFFER_ARM = 1.75;
export const BOY_HOLD_ARM = 2.3;
/**
 * Where they sit up, on the grass (it is at 0 when the park is there, so these are on the wall too), turned to each other:
 * the friend on the left looking right, the boy on the right looking left, just so far apart that their hands meet when both
 * reach out (the jar passes from hers to his there).
 */
export const FRIEND_SIT_X = FRIEND_LIES_X - 0.08;
export const BOY_SIT_X = FRIEND_SIT_X + 2 * handAtArm(0, 1, OFFER_ARM)[0];
/** Where the jar is held: in her lap, and where their hands meet (on the wall). */
export const JAR_IN_LAP = handAtArm(FRIEND_SIT_X, 1, LAP_ARM);
export const JAR_HANDED = handAtArm(FRIEND_SIT_X, 1, OFFER_ARM);
/** The jar, as the kids hold it (its middle at the hand). */
const JAR_W = 0.04;
const JAR_H = 0.054;
/** The jar's mouth in her lap, where the firefly goes in (the jar is scaled with the kid). */
const JAR_MOUTH: readonly [number, number] = [JAR_IN_LAP[0], JAR_IN_LAP[1] + 0.4 * JAR_H * KID_SCALE];
/** Where the first firefly lingers when the others go: just over her. */
const LINGER: readonly [number, number] = [FIREFLY_HOVER[0] + 0.1, FIREFLY_HOVER[1] - 0.02];

/** The school gate: its middle and size. The kids stop at it, the boy at its gateway, the friend on the near side. */
export const GATE_X = 0.24;
const GATE_W = 0.9;
const GATE_H = 0.46;
export const GATE_DEPTH = 0.35;
export const GATE_OFF_DX = 2.1;
export const AUTUMN_TREE_X = -0.58;
const AUTUMN_TREE_DEPTH = 0.55;
export const BOY_GATE_X = 0.3;
export const FRIEND_GATE_X = -0.06;

/** The fireflies that rise from the grass: where each comes up and where it hovers. */
const FLIES: readonly { x: number; y: number }[] = [
  { x: -0.52, y: 0.06 },
  { x: -0.3, y: 0.26 },
  { x: -0.12, y: 0.22 },
  { x: 0.02, y: 0.32 },
  { x: 0.22, y: 0.2 },
  { x: 0.38, y: 0.34 },
  { x: 0.5, y: 0.16 },
  { x: 0.66, y: 0.24 },
];
/** Every firefly in the order they come to a hand: the first one (scene 3's, the player's) and then the risen ones. */
const ALL_FLIES = ['firefly', ...FLIES.map((_, i) => `fly-${i}`)];
/** Whose hand each goes to: the friend's first (it was over her), then turn and turn about. */
const toFriend = (i: number): boolean => i % 2 === 0;
/** Where each goes when it is let go: up and away over the top of the wall. */
const flyAway = (i: number): [number, number] => [-0.7 + (i * 1.5) / 8 + 0.08 * Math.sin(i * 2.3), 0.62];
const gatherAt = (i: number): number => GATHER_S + i * GATHER_EVERY_S;
const releaseAt = (i: number): number => RELEASE_S + Math.floor(i / 3) * RELEASE_GROUP_S + (i % 3) * 0.35;

/** The leaves falling at the gate as the kids arrive: where each starts, when (after the ground slows), and where it lands. */
/** Seconds a leaf takes to fall: they are all down before the friend raises her hand. */
const LEAF_FALL_S = 2.4;
/** They start to fall this long before the ground comes to rest. */
const LEAVES_BEFORE_STOP_S = 1.0;
export const LEAVES: readonly { x: number; t: number; land: number }[] = [
  { x: -0.5, t: 0.0, land: -0.38 },
  { x: -0.66, t: 0.4, land: -0.7 },
  { x: -0.42, t: 0.8, land: -0.2 },
  { x: -0.6, t: 1.1, land: -0.52 },
  { x: -0.36, t: 1.4, land: -0.1 },
];

/** The light of the fireflies held on a lying kid's raised hand. */
const handGlow = (kid: string): PuppetPart => ({
  id: `${kid}-hand-glow`,
  art: 'orb',
  look: 'glow',
  tint: FIREFLY_TINT,
  parent: `${kid}-arm-front`,
  w: 0.075,
  h: 0.075,
  y: LYING_HAND_ALONG,
  opacity: 0,
});

/** A firefly's light in a jar. */
const jarGlow = (jar: string, y = 0, size = 0.1): PuppetPart => ({
  id: `${jar}-glow`,
  art: 'orb',
  look: 'glow',
  tint: FIREFLY_TINT,
  parent: jar,
  w: size,
  h: size,
  ...(y !== 0 ? { y } : {}),
  opacity: 0,
});

/** The jar in a sitting kid's hand: hung from the arm at the hand, its middle there (it is turned against the arm, below). */
const heldJar = (kid: string): PuppetPart[] => [
  {
    id: `${kid}-jar`,
    art: 'jar',
    parent: `${kid}-arm`,
    w: JAR_W,
    h: JAR_H,
    pivot: [0.5, 0.5],
    y: SIT_REACH,
    opacity: 0,
  },
  jarGlow(`${kid}-jar`),
];

const parts: PuppetPart[] = [
  // The gate and its tree stand back.
  {
    id: 'autumn-tree',
    art: 'autumn-tree',
    w: 0.5,
    h: 0.66,
    pivot: [0.5, 0],
    x: AUTUMN_TREE_X + GATE_OFF_DX,
    y: FLOOR_Y - 0.01,
    depth: AUTUMN_TREE_DEPTH,
  },
  {
    id: 'gate',
    art: 'school-gate',
    w: GATE_W,
    h: GATE_H,
    pivot: [0.5, 0],
    x: GATE_X + GATE_OFF_DX,
    y: FLOOR_Y - 0.01,
    depth: GATE_DEPTH,
  },
  // The light on their hands.
  handGlow('run-friend'),
  handGlow('run-boy'),
  // Sitting up in the grass, turned to each other (they go with it when the park slides), and the jar in their hands; and
  // the jar set down in the grass, for scene 5.
  ...sittingKid('park-friend', FRIEND_SIT_X, 1, { parent: 'grass', opacity: 0, girl: true }),
  ...heldJar('park-friend'),
  ...sittingKid('park-boy', BOY_SIT_X, -1, { parent: 'grass', opacity: 0 }),
  ...heldJar('park-boy'),
  {
    id: 'park-jar',
    art: 'jar',
    parent: 'grass',
    w: 0.055,
    h: 0.075,
    pivot: [0.5, 0],
    x: BOY_SIT_X,
    y: 0,
    opacity: 0,
    depth: 0,
  },
  jarGlow('park-jar', 0.45 * 0.075, 0.12),
  // The fireflies from the grass.
  ...FLIES.flatMap((f, i) => firefly(`fly-${i}`, f.x, -0.2, 0.06)),
  // The walk to school: the kids again, the boy carrying the jar.
  ...standingKid('walk-friend', FRIEND_SIT_X, 1, { opacity: 0, girl: true }),
  ...standingKid('walk-boy', BOY_SIT_X, 1, { opacity: 0 }),
  {
    id: 'walk-jar',
    art: 'jar',
    parent: 'walk-boy',
    w: JAR_W,
    h: JAR_H,
    pivot: [0.5, 0.5],
    x: 0.05,
    y: 0.11 + JAR_H / 2,
  },
  jarGlow('walk-jar', -0.08 * JAR_H, 0.08),
  // At the gate, each turned the other way about: the boy to face her (the jar still in his arm), then her to go her own way.
  ...standingKid('walk-boy-back', BOY_GATE_X, -1, { opacity: 0 }),
  {
    id: 'walk-boy-back-jar',
    art: 'jar',
    parent: 'walk-boy-back',
    w: 0.04,
    h: 0.054,
    pivot: [0.5, 0],
    x: -0.05,
    y: 0.11,
  },
  jarGlow('walk-boy-back-jar', 0.42 * JAR_H, 0.08),
  ...standingKid('walk-friend-back', FRIEND_GATE_X, -1, { opacity: 0, girl: true }),
  // The leaves.
  ...LEAVES.map((l, i): PuppetPart => ({
    id: `leaf-${i}`,
    art: 'leaf',
    w: 0.03,
    h: 0.04,
    x: l.x,
    y: 0.62,
    opacity: 0,
  })),
];

/** Keys that hold `v` from `t0`, then move to `to` at `t1` with `ease`. */
const move = (t0: number, v: number, t1: number, to: number, ease: Key[2] = 'smooth'): Key[] => [
  [t0, v],
  [t1, to, ease],
];

const step = (t: number, to: number): Key => [t, to, 'step'];

/**
 * Keys for the ground going by to the left, `dist` of it over the walk: it picks up its pace and slows to a stop as the legs do,
 * and goes at one steady pace between, which is what the stride is made to match.
 */
function groundKeys(from: number, dist: number): Key[] {
  const v = dist / (WALK_LEN_S - WALK_RAMP_S);
  return [
    [WALK_S, from],
    [WALK_S + WALK_RAMP_S, from - (v * WALK_RAMP_S) / 2, 'in'],
    [STOP_S - WALK_RAMP_S, from - v * (WALK_LEN_S - 1.5 * WALK_RAMP_S), 'linear'],
    [STOP_S, from - dist, 'out'],
  ];
}
/** How bright the firefly in the jar is: at night, and in the morning light (softer, but still there). */
export const JAR_GLOW = 0.8;
const JAR_MORNING_GLOW = 0.55;

/**
 * A sitting kid's arm moving through `keys` (radians from straight up, forward), and the jar in its hand turned the other way
 * by just as much, with the same eases, so it stays upright however the arm swings.
 */
function armWithJar(kid: string, facing: 1 | -1, keys: readonly Key[]): Track[] {
  const at = (sign: number): Key[] =>
    keys.map(([t, v, e]): Key => (e === undefined ? [t, sign * -v * facing] : [t, sign * -v * facing, e]));
  return [
    { part: `${kid}-arm`, prop: 'angle', keys: at(1) },
    { part: `${kid}-jar`, prop: 'angle', keys: at(-1) },
  ];
}

const flyTracks: Track[] = ALL_FLIES.flatMap((id, i): Track[] => {
  const inAt = gatherAt(i);
  const outAt = releaseAt(i);
  const [ax, ay] = flyAway(i);
  const [hx, hy] = toFriend(i) ? FRIEND_HAND : BOY_HAND;
  // The first firefly is already over the kids; the others rise from the grass to their places first.
  const hover: readonly [number, number] = i === 0 ? FIREFLY_HOVER : [FLIES[i - 1].x, FLIES[i - 1].y];
  const rise = RISE_S + (i - 1) * RISE_EVERY_S;
  const x: Key[] = i === 0 ? [[CUP_HOLD_S, hover[0]]] : [[rise, hover[0]]];
  const y: Key[] =
    i === 0
      ? [[CUP_HOLD_S, hover[1]]]
      : [
          [rise, -0.2],
          [rise + RISE_LEN_S, hover[1], 'out'],
        ];
  const opacity: Key[] =
    i === 0
      ? [[0, 1]]
      : [
          [rise, 0],
          [rise + 0.8, 1, 'smooth'],
        ];
  // Down to a hand, where its light joins the hand's.
  x.push([inAt, hover[0]], [inAt + INTO_HAND_S, hx, 'smooth']);
  y.push([inAt, hover[1]], [inAt + INTO_HAND_S, hy, 'smooth']);
  opacity.push([inAt + INTO_HAND_S - 0.2, 1], [inAt + INTO_HAND_S, 0, 'in']);
  if (i === 0) {
    // The first, the player's, will not go: off the open hand it lingers over her, and then comes down into her jar.
    const inJar = INTO_JAR_S + INTO_JAR_LEN_S;
    x.push([outAt, hx], [outAt + 2, LINGER[0], 'smooth'], [INTO_JAR_S, LINGER[0]], [inJar, JAR_MOUTH[0], 'smooth']);
    y.push([outAt, hy], [outAt + 2, LINGER[1], 'smooth'], [INTO_JAR_S, LINGER[1]], [inJar, JAR_MOUTH[1], 'smooth']);
    opacity.push([outAt, 0], [outAt + 0.3, 1, 'out'], [inJar - 0.2, 1], [inJar, 0, 'in']);
  } else {
    // Let go: off the open hand, up and away over the top of the wall.
    x.push([outAt, hx], [outAt + RELEASE_LEN_S, ax, 'smooth']);
    y.push([outAt, hy], [outAt + RELEASE_LEN_S, ay, 'in']);
    opacity.push([outAt, 0], [outAt + 0.3, 1, 'out'], [outAt + RELEASE_LEN_S - 0.6, 1], [outAt + RELEASE_LEN_S, 0]);
  }
  return [
    { part: id, prop: 'x', keys: x },
    { part: id, prop: 'y', keys: y },
    { part: id, prop: 'opacity', keys: opacity },
  ];
});

/** A hand's light: brighter with each firefly that comes to it, and dimmer with each let go. */
function handGlowKeys(friend: boolean): Key[] {
  const mine = ALL_FLIES.map((_, i) => i).filter((i) => toFriend(i) === friend);
  const keys: Key[] = [[0, 0]];
  mine.forEach((i, k) => {
    const t = gatherAt(i) + INTO_HAND_S;
    keys.push([t - 0.05, (0.9 * k) / mine.length], [t + 0.25, (0.9 * (k + 1)) / mine.length, 'out']);
  });
  mine.forEach((i, k) => {
    const t = releaseAt(i);
    keys.push(
      [t, (0.9 * (mine.length - k)) / mine.length],
      [t + 0.3, (0.9 * (mine.length - k - 1)) / mine.length, 'smooth'],
    );
  });
  return keys;
}

const tracks: Track[] = [
  // The firefly in the player's cup: brighter while it sits there.
  {
    part: 'firefly-glow',
    prop: 'scale',
    keys: [
      [0, 1],
      [0.6, 1.8, 'out'],
      [CUP_HOLD_S - 0.6, 1.8],
      [CUP_HOLD_S, 1, 'smooth'],
    ],
  },
  ...flyTracks,
  // The boy reaches up beside her; their hands fill with light, empty again, and come down.
  {
    part: 'run-boy-arm-front',
    prop: 'angle',
    keys: [
      // He lies facing left (scene 3), so his turns are hers mirrored.
      ...move(BOY_REACH_S, LYING_ARM * BOY_FACING, BOY_REACH_S + REACH_LEN_S, -1.45 * BOY_FACING),
      ...move(ARMS_DOWN_S + 0.2, -1.45 * BOY_FACING, ARMS_DOWN_S + 0.2 + ARMS_DOWN_LEN_S, LYING_ARM * BOY_FACING),
    ],
  },
  {
    part: 'run-friend-arm-front',
    prop: 'angle',
    keys: move(ARMS_DOWN_S, -1.45, ARMS_DOWN_S + ARMS_DOWN_LEN_S, LYING_ARM),
  },
  { part: 'run-friend-hand-glow', prop: 'opacity', keys: handGlowKeys(true) },
  { part: 'run-boy-hand-glow', prop: 'opacity', keys: handGlowKeys(false) },
  // They watch them go, heads back.
  { part: 'run-friend-head', prop: 'angle', keys: move(RELEASE_S, 0, RELEASE_S + 0.8, 0.2) },
  { part: 'run-boy-head', prop: 'angle', keys: move(RELEASE_S + 0.3, 0, RELEASE_S + 1.1, 0.2 * BOY_FACING) },
  // They sit up: the lying kids give way to the sitting ones.
  { part: 'run-boy', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 1, 0) },
  { part: 'run-friend', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 1, 0) },
  { part: 'park-boy', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 0, 1) },
  { part: 'park-friend', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 0, 1) },
  // The friend takes out the jar and holds it in her lap; the firefly comes down into it, and it glows. She holds it out,
  // and the boy reaches for it, takes it from her hand (it passes from her jar to his, in the same place), and brings it in
  // to his lap. Each jar hangs from its kid's hand, turned against the arm so it stays upright.
  ...armWithJar('park-friend', 1, [
    [JAR_S - 0.4, ARM_DOWN],
    [JAR_S, LAP_ARM, 'smooth'],
    [GIVE_S, LAP_ARM],
    [GIVE_S + OFFER_LEN_S, OFFER_ARM, 'smooth'],
    [HANDOVER_S + 0.3, OFFER_ARM],
    [HANDOVER_S + 1.0, ARM_DOWN, 'smooth'],
  ]),
  ...armWithJar('park-boy', -1, [
    [GIVE_S + 0.2, ARM_DOWN],
    [GIVE_S + 0.2 + OFFER_LEN_S, OFFER_ARM, 'smooth'],
    [HANDOVER_S, OFFER_ARM],
    [HANDOVER_S + TAKE_LEN_S, BOY_HOLD_ARM, 'smooth'],
  ]),
  {
    part: 'park-friend-jar',
    prop: 'opacity',
    keys: [[JAR_S - 0.3, 0], [JAR_S + 0.2, 1, 'smooth'], step(HANDOVER_S, 0)],
  },
  { part: 'park-boy-jar', prop: 'opacity', keys: [[0, 0], step(HANDOVER_S, 1)] },
  {
    part: 'park-friend-jar-glow',
    prop: 'opacity',
    keys: [
      [INTO_JAR_S + INTO_JAR_LEN_S - 0.1, 0],
      [INTO_JAR_S + INTO_JAR_LEN_S + 0.4, JAR_GLOW, 'out'],
    ],
  },
  { part: 'park-boy-jar-glow', prop: 'opacity', keys: [[0, JAR_GLOW]] },
  // They stand and walk on, the boy with the jar, as the park slides away under them; in the morning light the firefly in the
  // jar glows softer, but it is still there (it leaves the jar in scene 5).
  { part: 'park-boy', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  { part: 'park-friend', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  {
    part: 'walk-jar-glow',
    prop: 'opacity',
    keys: [
      [PARK_OUT_S, JAR_GLOW],
      [PARK_OUT_S + 6.5, JAR_MORNING_GLOW, 'smooth'],
    ],
  },
  { part: 'walk-boy-back-jar-glow', prop: 'opacity', keys: [[0, JAR_MORNING_GLOW]] },
  {
    part: 'walk-boy',
    prop: 'opacity',
    keys: [...fadeKeys(STAND_S, CROSS_S, 0, 1), [TURN_S, 1], [TURN_S + TURN_LEN_S, 0]],
  },
  { part: 'walk-friend', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 0, 1) },
  { part: 'walk-boy-arm-front', prop: 'angle', keys: [[0, -1.7]] },
  // They walk on the spot, the ground going by under them (see WALK_LEN_S): the friend stays where she sat, and the boy drifts
  // the little way to where he stops.
  ...stepTracks('walk-boy', 1, WALK_S, STOP_S, WALK_ON, { armsBusy: 'front' }),
  ...stepTracks('walk-friend', 1, WALK_S, STOP_S, WALK_ON, { girl: true }),
  {
    part: 'walk-boy',
    prop: 'x',
    keys: [
      [WALK_S, BOY_SIT_X],
      [STOP_S, BOY_GATE_X, 'linear'],
    ],
  },
  {
    part: 'walk-friend',
    prop: 'x',
    keys: [
      [WALK_S, FRIEND_SIT_X],
      [STOP_S, FRIEND_GATE_X, 'linear'],
    ],
  },
  ...PARK_TREES.map((t): Track => ({ part: t.id, prop: 'x', keys: groundKeys(t.x, PARK_FROM_DX) })),
  { part: 'grass', prop: 'x', keys: groundKeys(0, GRASS_W) },
  // The stars go out with the night, as the morning comes.
  ...STARS.map((_, i): Track => ({ part: starId(i), prop: 'opacity', keys: fadeKeys(PARK_OUT_S, 3, 0.85, 0) })),
  { part: 'gate', prop: 'x', keys: groundKeys(GATE_X + GATE_OFF_DX, GATE_OFF_DX) },
  { part: 'autumn-tree', prop: 'x', keys: groundKeys(AUTUMN_TREE_X + GATE_OFF_DX, GATE_OFF_DX) },
  // Leaves fall from the tree as the ground comes to rest.
  ...LEAVES.flatMap((l, i): Track[] => {
    const t0 = STOP_S - LEAVES_BEFORE_STOP_S + l.t;
    const fall = LEAF_FALL_S;
    return [
      { part: `leaf-${i}`, prop: 'opacity', keys: fadeKeys(t0, 0.4, 0, 1) },
      { part: `leaf-${i}`, prop: 'y', keys: move(t0, 0.3, t0 + fall, FLOOR_Y + 0.008, 'linear') },
      { part: `leaf-${i}`, prop: 'x', keys: move(t0, l.x, t0 + fall, l.land) },
      {
        part: `leaf-${i}`,
        prop: 'angle',
        keys: [
          [t0, 0],
          [t0 + fall * 0.33, 0.9, 'smooth'],
          [t0 + fall * 0.66, -0.6, 'smooth'],
          [t0 + fall, 1.4, 'smooth'],
        ],
      },
    ];
  }),
  // At the gate the boy turns round to face her (he is the other way about now, the jar still in his arm)...
  {
    part: 'walk-boy-back',
    prop: 'opacity',
    keys: [
      [TURN_S, 0],
      [TURN_S + TURN_LEN_S, 1],
    ],
  },
  { part: 'walk-boy-back-arm-front', prop: 'angle', keys: [[0, 1.7]] },
  // ...and she, facing him, raises her hand.
  {
    part: 'walk-friend-arm-front',
    prop: 'angle',
    keys: move(RAISE_S, -STAND_ARM_DOWN, RAISE_S + 0.9, -STAND_ARM_UP),
  },
];

const wobbles: Wobble[] = [
  ...ALL_FLIES.slice(1).flatMap((id, i) => fireflyWobbles(id, i + 1)),
  // The light on their hands breathes; the sitting kids breathe; the tree's leaves stir.
  { part: 'run-friend-hand-glow', prop: 'scale', amp: 0.06, period: 2.4 },
  { part: 'run-boy-hand-glow', prop: 'scale', amp: 0.06, period: 2.7, phase: 1 },
  { part: 'park-friend-body', prop: 'angle', amp: 0.01, period: 3.6 },
  { part: 'park-boy-body', prop: 'angle', amp: 0.01, period: 3.9, phase: 2 },
  { part: 'autumn-tree', prop: 'angle', amp: 0.008, period: 4.6 },
  { part: 'walk-friend-torso', prop: 'angle', amp: 0.01, period: 3.4 },
];

/**
 * A soft shimmer as the firefly settles in the player's cup, and as each firefly comes down to the kids' hands; a small clink
 * of glass as it settles in her jar. The crickets go with the night as the park slides off into morning, and as the school gate
 * slides in the morning birds start and a bell rings far off.
 */
const cues: Cue[] = [
  { t: 0.1, kind: 'sound', sound: 'firefly', x: FIREFLY_HOVER[0], y: FIREFLY_HOVER[1] },
  ...ALL_FLIES.map((_, i): Cue => {
    const hand = toFriend(i) ? FRIEND_HAND : BOY_HAND;
    return { t: gatherAt(i) + INTO_HAND_S, kind: 'sound', sound: 'firefly', x: hand[0], y: hand[1] };
  }),
  { t: INTO_JAR_S + INTO_JAR_LEN_S, kind: 'sound', sound: 'jar', x: JAR_IN_LAP[0], y: JAR_IN_LAP[1] },
  { t: PARK_OUT_S, kind: 'sound', sound: 'slide', x: -0.4, y: 0 },
  { t: PARK_OUT_S, kind: 'mood', mood: 'morning', seconds: 6 },
  { t: PARK_OUT_S, kind: 'bed', bed: null },
  { t: GATE_IN_S, kind: 'sound', sound: 'slide', x: 0.4, y: 0 },
  { t: GATE_IN_S + 0.5, kind: 'bed', bed: 'birds' },
  { t: GATE_IN_S + 1.2, kind: 'sound', sound: 'bell', x: 0.6, y: 0.2 },
];

export const FIREFLIES: Chapter = { id: 'fireflies', length: FIREFLIES_LENGTH_S, parts, tracks, wobbles, cues };
