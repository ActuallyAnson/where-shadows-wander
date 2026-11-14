// Scene 4, "Fireflies" (docs/STORY.md): the chapter after the friend's cup. The firefly settles into the player's cupped shadow
// and glows there, then goes back to hover over the kids, still lying in the park's grass at dusk. More fireflies come up out
// of the grass; the boy reaches up too, and the fireflies come down, one at a time, to settle on their two raised hands, which
// glow with them. They open their hands and let them go, a few at a time, up and away over the top of the wall. Then they sit
// up in the grass, and the friend gives the boy an empty jar, to catch them next time. They stand and walk on; the park slides
// off to the left and a school gate slides in from the right in a pale autumn morning, leaves falling. At the gate the boy
// turns round to face the friend, and she raises her hand: the chapter ends on that, and the story holds the picture while
// the friend's hand waves. Every time is in seconds from the chapter's start.
import { slideKeys, type Chapter } from '../puppet/chapters';
import type { Cue, Key, PuppetPart, Track, Wobble } from '../puppet/puppet-scene';
import {
  ARM_DOWN,
  FIREFLY_TINT,
  FLOOR_Y,
  STAND_ARM_DOWN,
  STAND_ARM_UP,
  WALK,
  fadeKeys,
  firefly,
  fireflyWobbles,
  sittingKid,
  standingKid,
  stepTracks,
} from './story-kit';
import { BOY_LIES_X, FIREFLY_HOVER, FRIEND_LIES_X, GRASS_W, PARK_FROM_DX, PARK_TREES } from './the-park';

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
/** ...and they sit up in the grass (the lying kids give way to sitting ones). */
const SIT_S = ARMS_DOWN_S + ARMS_DOWN_LEN_S + 0.4;
const CROSS_S = 0.6;
/** The friend sets a jar down beside her... */
const JAR_S = SIT_S + 0.9;
/** ...and gives it to the boy, empty. */
const GIVE_S = JAR_S + 2.0;
const GIVE_LEN_S = 1.4;
/** They stand and walk on; the park slides away and the school gate slides in, in a pale morning. */
const STAND_S = GIVE_S + GIVE_LEN_S + 1.4;
const WALK_S = STAND_S + 0.6;
const PARK_OUT_S = WALK_S + 0.4;
const PARK_OUT_LEN_S = 4.0;
const GATE_IN_S = PARK_OUT_S + 1.4;
const GATE_IN_LEN_S = 4.0;
const STOP_S = GATE_IN_S + GATE_IN_LEN_S + 0.8;
/** At the gate the boy turns round to face the friend, and she raises her hand. */
const TURN_S = STOP_S + 0.8;
const TURN_LEN_S = 0.3;
const RAISE_S = TURN_S + 0.7;
export const FIREFLIES_LENGTH_S = RAISE_S + 1.6;

/**
 * Where their raised hands are on the wall while the fireflies come to them (the tips of their front arms, lying on their backs;
 * fireflies.test.ts checks these against the puppets).
 */
export const FRIEND_HAND: readonly [number, number] = [-0.048, 0.028];
export const BOY_HAND: readonly [number, number] = [0.375, 0.043];
/** A firefly's light on a hand, along the arm from the shoulder (unscaled). */
const HAND_ALONG = 0.07;

/**
 * Where they sit up, on the grass (it is at 0 when the park is there, so these are on the wall too): a little closer than
 * they lay, the friend on the left, the boy on the right, both looking right.
 */
export const FRIEND_SIT_X = FRIEND_LIES_X - 0.08;
export const BOY_SIT_X = BOY_LIES_X - 0.17;
/** The jar's place on the grass: beside the friend, then in the boy's lap. */
const JAR_X = FRIEND_SIT_X + 0.15;
export const JAR_LAP_X = BOY_SIT_X + 0.05;
export const JAR_LAP_DY = 0.055;

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

/** The leaves falling at the gate as the kids arrive: where each starts, when (after the gate is in), and where it lands. */
/** Seconds a leaf takes to fall: they are all down before the friend raises her hand. */
const LEAF_FALL_S = 2.4;
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
  y: HAND_ALONG,
  opacity: 0,
});

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
  // Sitting up in the grass (they go with it when the park slides), and the jar.
  ...sittingKid('park-friend', FRIEND_SIT_X, 1, { parent: 'grass', opacity: 0, girl: true }),
  ...sittingKid('park-boy', BOY_SIT_X, 1, { parent: 'grass', opacity: 0 }),
  {
    id: 'park-jar',
    art: 'jar',
    parent: 'grass',
    w: 0.055,
    h: 0.075,
    pivot: [0.5, 0],
    x: JAR_X,
    y: 0,
    opacity: 0,
    depth: 0,
  },
  // The fireflies from the grass.
  ...FLIES.flatMap((f, i) => firefly(`fly-${i}`, f.x, -0.2, 0.06)),
  // The walk to school: the kids again, the boy carrying the jar.
  ...standingKid('walk-friend', FRIEND_SIT_X, 1, { opacity: 0, girl: true }),
  ...standingKid('walk-boy', BOY_SIT_X, 1, { opacity: 0 }),
  { id: 'walk-jar', art: 'jar', parent: 'walk-boy', w: 0.04, h: 0.054, pivot: [0.5, 0], x: 0.05, y: 0.11 },
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
  // Let go: off the open hand, up and away over the top of the wall.
  x.push([outAt, hx], [outAt + RELEASE_LEN_S, ax, 'smooth']);
  y.push([outAt, hy], [outAt + RELEASE_LEN_S, ay, 'in']);
  opacity.push([outAt, 0], [outAt + 0.3, 1, 'out'], [outAt + RELEASE_LEN_S - 0.6, 1], [outAt + RELEASE_LEN_S, 0]);
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
      ...move(BOY_REACH_S, -STAND_ARM_DOWN, BOY_REACH_S + REACH_LEN_S, -1.45),
      ...move(ARMS_DOWN_S + 0.2, -1.45, ARMS_DOWN_S + 0.2 + ARMS_DOWN_LEN_S, -STAND_ARM_DOWN),
    ],
  },
  {
    part: 'run-friend-arm-front',
    prop: 'angle',
    keys: move(ARMS_DOWN_S, -1.45, ARMS_DOWN_S + ARMS_DOWN_LEN_S, -STAND_ARM_DOWN),
  },
  { part: 'run-friend-hand-glow', prop: 'opacity', keys: handGlowKeys(true) },
  { part: 'run-boy-hand-glow', prop: 'opacity', keys: handGlowKeys(false) },
  // They watch them go, heads back.
  { part: 'run-friend-head', prop: 'angle', keys: move(RELEASE_S, 0, RELEASE_S + 0.8, 0.2) },
  { part: 'run-boy-head', prop: 'angle', keys: move(RELEASE_S + 0.3, 0, RELEASE_S + 1.1, 0.2) },
  // They sit up: the lying kids give way to the sitting ones.
  { part: 'run-boy', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 1, 0) },
  { part: 'run-friend', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 1, 0) },
  { part: 'park-boy', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 0, 1) },
  { part: 'park-friend', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 0, 1) },
  // The friend reaches down and sets the jar beside her; then she takes it up and puts it in the boy's lap.
  {
    part: 'park-friend-arm',
    prop: 'angle',
    keys: [
      [JAR_S - 0.3, -ARM_DOWN],
      [JAR_S + 0.3, -1.9, 'smooth'],
      [JAR_S + 1.0, -1.9],
      [JAR_S + 1.5, -ARM_DOWN, 'smooth'],
      [GIVE_S - 0.4, -ARM_DOWN],
      [GIVE_S, -1.8, 'smooth'],
      [GIVE_S + GIVE_LEN_S, -1.5, 'smooth'],
      [GIVE_S + GIVE_LEN_S + 0.5, -ARM_DOWN, 'smooth'],
    ],
  },
  { part: 'park-jar', prop: 'opacity', keys: fadeKeys(JAR_S, 0.5, 0, 1) },
  { part: 'park-jar', prop: 'x', keys: move(GIVE_S, JAR_X, GIVE_S + GIVE_LEN_S, JAR_LAP_X) },
  {
    part: 'park-jar',
    prop: 'y',
    keys: [
      [GIVE_S, 0],
      [GIVE_S + GIVE_LEN_S / 2, JAR_LAP_DY + 0.04, 'out'],
      [GIVE_S + GIVE_LEN_S, JAR_LAP_DY, 'in'],
    ],
  },
  // The boy's hands come up to take it.
  { part: 'park-boy-arm', prop: 'angle', keys: move(GIVE_S + 0.6, -ARM_DOWN, GIVE_S + GIVE_LEN_S, -1.75) },
  // They stand and walk on, the boy with the jar, as the park slides away under them.
  { part: 'park-boy', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  { part: 'park-friend', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  { part: 'park-jar', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  { part: 'walk-boy', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 0, 1) },
  { part: 'walk-friend', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 0, 1) },
  { part: 'walk-boy-arm-front', prop: 'angle', keys: [[0, -1.7]] },
  ...stepTracks('walk-boy', 1, WALK_S, STOP_S, WALK, { armsBusy: 'front' }),
  ...stepTracks('walk-friend', 1, WALK_S, STOP_S, WALK, { girl: true }),
  { part: 'walk-boy', prop: 'x', keys: move(WALK_S, BOY_SIT_X, STOP_S, BOY_GATE_X, 'linear') },
  { part: 'walk-friend', prop: 'x', keys: move(WALK_S, FRIEND_SIT_X, STOP_S, FRIEND_GATE_X, 'linear') },
  ...PARK_TREES.map((t): Track => ({
    part: t.id,
    prop: 'x',
    keys: slideKeys(PARK_OUT_S, PARK_OUT_LEN_S, t.x, t.x - PARK_FROM_DX, t.depth, true),
  })),
  { part: 'grass', prop: 'x', keys: slideKeys(PARK_OUT_S, PARK_OUT_LEN_S, 0, -GRASS_W, 0.25, true) },
  { part: 'gate', prop: 'x', keys: slideKeys(GATE_IN_S, GATE_IN_LEN_S, GATE_X + GATE_OFF_DX, GATE_X, GATE_DEPTH) },
  {
    part: 'autumn-tree',
    prop: 'x',
    keys: slideKeys(GATE_IN_S, GATE_IN_LEN_S, AUTUMN_TREE_X + GATE_OFF_DX, AUTUMN_TREE_X, AUTUMN_TREE_DEPTH),
  },
  // Leaves fall from the tree once it is there.
  ...LEAVES.flatMap((l, i): Track[] => {
    const t0 = GATE_IN_S + GATE_IN_LEN_S + l.t;
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
    part: 'walk-boy',
    prop: 'opacity',
    keys: [
      [TURN_S, 1],
      [TURN_S + TURN_LEN_S, 0],
    ],
  },
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

const cues: Cue[] = [
  { t: 0.1, kind: 'note', note: 0 },
  { t: RISE_S, kind: 'note', note: 2 },
  { t: GATHER_S, kind: 'note', note: 1 },
  { t: GATHER_S + 4 * GATHER_EVERY_S, kind: 'note', note: 2 },
  { t: RELEASE_S, kind: 'note', note: 3 },
  { t: RELEASE_S + RELEASE_GROUP_S, kind: 'note', note: 4 },
  { t: GIVE_S + GIVE_LEN_S, kind: 'note', note: 1 },
  { t: PARK_OUT_S, kind: 'mood', mood: 'morning', seconds: 6 },
  { t: RAISE_S, kind: 'note', note: 2 },
];

export const FIREFLIES: Chapter = { id: 'fireflies', length: FIREFLIES_LENGTH_S, parts, tracks, wobbles, cues };
