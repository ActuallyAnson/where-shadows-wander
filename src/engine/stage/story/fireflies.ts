// Scene 4, "Fireflies" (docs/STORY.md): the chapter after the friend's cup. The firefly settles into the player's cupped shadow
// and glows there, then goes back to hover over the kids. They get up, and walk on as the park slides away to the left and a
// long hill slides in under them from the right, more fireflies rising out of its grass. They sit on its top side by side, a jar
// between them; they fill it, a firefly at a time, and then let them go, a few at a time, until it is empty. The friend puts the
// empty jar in the boy's hands. They stand and walk on, the boy carrying the jar; the hill slides off to the left and a school
// gate slides in from the right in a pale autumn morning, leaves falling. At the gate the friend turns to go her own way and
// raises her hand: the chapter ends on that, and the story holds the picture while the friend's hand waves.
// Every time is in seconds from the chapter's start.
import { slideKeys, type Chapter } from '../puppet/chapters';
import type { Cue, Key, PuppetPart, Track, Wobble } from '../puppet/puppet-scene';
import {
  ARM_DOWN,
  FLOOR_Y,
  LYING_LIFT,
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
/** The kids get up, and the friend's reaching arm comes down. */
const GETUP_S = 1.2;
const GETUP_LEN_S = 0.9;
/** They walk on while the park slides off and the hill slides in. */
const WALK_S = GETUP_S + GETUP_LEN_S + 0.1;
const PARK_OUT_S = 3.0;
const PARK_OUT_LEN_S = 3.6;
const HILL_IN_S = 3.8;
const HILL_IN_LEN_S = 4.4;
/** More fireflies come up out of the grass. */
const RISE_S = 5.4;
/** They sit down on the hill's top... */
const SIT_S = 9.0;
const CROSS_S = 0.6;
/** ...the friend sets the jar between them... */
const JAR_S = SIT_S + 0.9;
/** ...and they fill it, a firefly at a time... */
const FILL_S = JAR_S + 1.4;
const FILL_EVERY_S = 0.7;
const INTO_JAR_S = 1.0;
/** ...and let them go, a few at a time. */
const RELEASE_S = FILL_S + 9 * FILL_EVERY_S + 1.6;
const RELEASE_GROUP_S = 2.2;
const RELEASE_LEN_S = 3.4;
/** The friend gives the boy the empty jar. */
const GIVE_S = RELEASE_S + 3 * RELEASE_GROUP_S + 1.2;
const GIVE_LEN_S = 1.4;
/** They stand and walk on; the hill slides away and the school gate slides in, in a pale morning. */
const STAND_S = GIVE_S + GIVE_LEN_S + 1.4;
const WALK2_S = STAND_S + 0.6;
const HILL_OUT_S = WALK2_S + 0.4;
const HILL_OUT_LEN_S = 4.0;
const GATE_IN_S = HILL_OUT_S + 1.4;
const GATE_IN_LEN_S = 4.0;
const STOP_S = GATE_IN_S + GATE_IN_LEN_S + 0.8;
/** At the gate the friend turns to go her own way, and raises her hand. */
const TURN_S = STOP_S + 0.8;
const TURN_LEN_S = 0.3;
const RAISE_S = TURN_S + 0.7;
export const FIREFLIES_LENGTH_S = RAISE_S + 1.6;

/** The hill: its top's middle (the kids' seat, where its pivot is) and size, and how far back it stands. */
export const HILL_X = 0.09;
export const HILL_Y = FLOOR_Y + 0.016;
const HILL_W = 2.1;
const HILL_H = 0.2;
export const HILL_DEPTH = 0.2;
/** How far off the wall the hill is when it is not there (its middle, either side). */
export const HILL_OFF_DX = 2.15;
/** Where they sit on the hill, relative to its top's middle: the friend on the left, the boy on the right, both looking right. */
const SIT_FRIEND_DX = -0.17;
export const SIT_BOY_DX = 0.17;
/** Where the walkers stop to sit (the sitting kids' places, on the wall). */
const FRIEND_SIT_X = HILL_X + SIT_FRIEND_DX - 0.005;
const BOY_SIT_X = HILL_X + SIT_BOY_DX - 0.005;
/** The jar's place on the hill: between them, then in the boy's lap. */
const JAR_DX = 0;
export const JAR_LAP_DX = SIT_BOY_DX + 0.05;
export const JAR_LAP_DY = 0.055;
/** The jar's mouth on the wall, where the fireflies go in and come out. */
const JAR_MOUTH: readonly [number, number] = [HILL_X + JAR_DX, HILL_Y + 0.075];

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

/** The fireflies that rise from the hill's grass: where each comes up and where it hovers. */
const FLIES: readonly { x: number; y: number }[] = [
  { x: -0.52, y: 0.06 },
  { x: -0.3, y: 0.26 },
  { x: -0.12, y: 0.12 },
  { x: 0.02, y: 0.32 },
  { x: 0.22, y: 0.2 },
  { x: 0.38, y: 0.34 },
  { x: 0.5, y: 0.1 },
  { x: 0.66, y: 0.24 },
];
/** Every firefly in the order they go into the jar: the first one (scene 3's) and then the risen ones. */
const ALL_FLIES = ['firefly', ...FLIES.map((_, i) => `fly-${i}`)];
/** Where each goes when it is let go: up and away over the top of the wall. */
const flyAway = (i: number): [number, number] => [-0.7 + (i * 1.5) / 8 + 0.08 * Math.sin(i * 2.3), 0.62];

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

const parts: PuppetPart[] = [
  // The hill, the gate and its tree stand back; the hill's two sitting kids and the jar go with it.
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
  {
    id: 'hill',
    art: 'hill',
    w: HILL_W,
    h: HILL_H,
    pivot: [0.5, 0.92],
    x: HILL_X + HILL_OFF_DX,
    y: HILL_Y,
    depth: HILL_DEPTH,
  },
  ...sittingKid('hill-friend', SIT_FRIEND_DX, 1, { parent: 'hill', opacity: 0, girl: true }),
  ...sittingKid('hill-boy', SIT_BOY_DX, 1, { parent: 'hill', opacity: 0 }),
  {
    id: 'hill-jar',
    art: 'jar',
    parent: 'hill',
    w: 0.055,
    h: 0.075,
    pivot: [0.5, 0],
    x: JAR_DX,
    y: 0,
    opacity: 0,
    depth: 0,
  },
  {
    id: 'jar-glow',
    art: 'orb',
    look: 'glow',
    tint: [0.85, 1, 0.45],
    parent: 'hill-jar',
    w: 0.2,
    h: 0.2,
    y: 0.035,
    opacity: 0,
  },
  // The fireflies from the grass.
  ...FLIES.flatMap((f, i) => firefly(`fly-${i}`, f.x, -0.2, 0.06)),
  // The walk to school: the kids again, the boy carrying the jar; and the friend turned the other way, to go her own.
  ...standingKid('walk-friend', FRIEND_SIT_X, 1, { opacity: 0, girl: true }),
  ...standingKid('walk-boy', BOY_SIT_X, 1, { opacity: 0 }),
  { id: 'walk-jar', art: 'jar', parent: 'walk-boy', w: 0.04, h: 0.054, pivot: [0.5, 0], x: 0.05, y: 0.11 },
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
  const inAt = FILL_S + i * FILL_EVERY_S;
  const group = Math.floor(i / 3);
  const outAt = RELEASE_S + group * RELEASE_GROUP_S + (i % 3) * 0.35;
  const [ax, ay] = flyAway(i);
  // The first firefly is already over the kids; the others rise from the grass to their places first.
  const hover: readonly [number, number] = i === 0 ? FIREFLY_HOVER : [FLIES[i - 1].x, FLIES[i - 1].y];
  const rise = RISE_S + (i - 1) * 0.35;
  const x: Key[] = i === 0 ? [[CUP_HOLD_S, hover[0]]] : [[rise, hover[0]]];
  const y: Key[] =
    i === 0
      ? [[CUP_HOLD_S, hover[1]]]
      : [
          [rise, -0.2],
          [rise + 2.6, hover[1], 'out'],
        ];
  const opacity: Key[] =
    i === 0
      ? [[0, 1]]
      : [
          [rise, 0],
          [rise + 0.8, 1, 'smooth'],
        ];
  x.push([inAt, hover[0]], [inAt + INTO_JAR_S, JAR_MOUTH[0], 'smooth']);
  y.push([inAt, hover[1]], [inAt + INTO_JAR_S, JAR_MOUTH[1], 'smooth']);
  opacity.push([inAt + INTO_JAR_S - 0.2, 1], [inAt + INTO_JAR_S, 0, 'in']);
  // Let go: out of the jar's mouth, up and away over the top of the wall.
  x.push([outAt, JAR_MOUTH[0]], [outAt + RELEASE_LEN_S, ax, 'smooth']);
  y.push([outAt, JAR_MOUTH[1]], [outAt + RELEASE_LEN_S, ay, 'in']);
  opacity.push([outAt, 0], [outAt + 0.3, 1, 'out'], [outAt + RELEASE_LEN_S - 0.6, 1], [outAt + RELEASE_LEN_S, 0]);
  return [
    { part: id, prop: 'x', keys: x },
    { part: id, prop: 'y', keys: y },
    { part: id, prop: 'opacity', keys: opacity },
  ];
});

/** The jar's light: brighter with each firefly in it, and dimmer with each let go. */
const jarGlow: Key[] = [[0, 0]];
ALL_FLIES.forEach((_, i) => {
  const t = FILL_S + i * FILL_EVERY_S + INTO_JAR_S;
  jarGlow.push([t - 0.05, (0.85 * i) / ALL_FLIES.length], [t + 0.25, (0.85 * (i + 1)) / ALL_FLIES.length, 'out']);
});
ALL_FLIES.forEach((_, i) => {
  const t = RELEASE_S + Math.floor(i / 3) * RELEASE_GROUP_S + (i % 3) * 0.35;
  const n = ALL_FLIES.length;
  jarGlow.push([t, (0.85 * (n - i)) / n], [t + 0.3, (0.85 * (n - i - 1)) / n, 'smooth']);
});

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
  // The kids get up off the grass: the friend's reaching arm comes down, and they stand.
  {
    part: 'run-friend-arm-front',
    prop: 'angle',
    keys: move(0.4, -1.45, GETUP_S + GETUP_LEN_S, -STAND_ARM_DOWN),
  },
  { part: 'run-boy', prop: 'angle', keys: move(GETUP_S, Math.PI / 2, GETUP_S + GETUP_LEN_S, 0) },
  {
    part: 'run-friend',
    prop: 'angle',
    keys: move(GETUP_S, Math.PI / 2 + 2 * Math.PI, GETUP_S + GETUP_LEN_S, 2 * Math.PI),
  },
  { part: 'run-boy', prop: 'y', keys: move(GETUP_S, FLOOR_Y + LYING_LIFT, GETUP_S + GETUP_LEN_S, FLOOR_Y) },
  { part: 'run-friend', prop: 'y', keys: move(GETUP_S, FLOOR_Y + LYING_LIFT, GETUP_S + GETUP_LEN_S, FLOOR_Y) },
  { part: 'run-boy-torso', prop: 'angle', keys: move(GETUP_S, -0.12, GETUP_S + GETUP_LEN_S, 0) },
  // They walk on to the hill's top, the park sliding away under them and the hill coming in.
  ...stepTracks('run-boy', 1, WALK_S, SIT_S, WALK),
  ...stepTracks('run-friend', 1, WALK_S, SIT_S, WALK, { girl: true }),
  { part: 'run-boy', prop: 'x', keys: move(WALK_S, BOY_LIES_X, SIT_S, BOY_SIT_X, 'linear') },
  { part: 'run-friend', prop: 'x', keys: move(WALK_S, FRIEND_LIES_X, SIT_S, FRIEND_SIT_X, 'linear') },
  ...PARK_TREES.map((t): Track => ({
    part: t.id,
    prop: 'x',
    keys: slideKeys(PARK_OUT_S, PARK_OUT_LEN_S, t.x, t.x - PARK_FROM_DX, t.depth, true),
  })),
  { part: 'grass', prop: 'x', keys: slideKeys(PARK_OUT_S, PARK_OUT_LEN_S, 0, -GRASS_W, 0.25, true) },
  { part: 'hill', prop: 'x', keys: slideKeys(HILL_IN_S, HILL_IN_LEN_S, HILL_X + HILL_OFF_DX, HILL_X, HILL_DEPTH) },
  // They sit: the standing kids give way to the sitting ones.
  { part: 'run-boy', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 1, 0) },
  { part: 'run-friend', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 1, 0) },
  { part: 'hill-boy', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 0, 1) },
  { part: 'hill-friend', prop: 'opacity', keys: fadeKeys(SIT_S, CROSS_S, 0, 1) },
  // The friend reaches over and sets the jar down between them; later she takes it up and puts it in the boy's lap.
  {
    part: 'hill-friend-arm',
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
  { part: 'hill-jar', prop: 'opacity', keys: fadeKeys(JAR_S, 0.5, 0, 1) },
  {
    part: 'hill-jar',
    prop: 'x',
    keys: move(GIVE_S, JAR_DX, GIVE_S + GIVE_LEN_S, JAR_LAP_DX),
  },
  {
    part: 'hill-jar',
    prop: 'y',
    keys: [
      [GIVE_S, 0],
      [GIVE_S + GIVE_LEN_S / 2, JAR_LAP_DY + 0.04, 'out'],
      [GIVE_S + GIVE_LEN_S, JAR_LAP_DY, 'in'],
    ],
  },
  // The boy's hands come up to take it.
  {
    part: 'hill-boy-arm',
    prop: 'angle',
    keys: move(GIVE_S + 0.6, -ARM_DOWN, GIVE_S + GIVE_LEN_S, -1.75),
  },
  { part: 'jar-glow', prop: 'opacity', keys: jarGlow },
  // They watch the fireflies go: heads up.
  { part: 'hill-boy-head', prop: 'angle', keys: lookUp(RELEASE_S, GIVE_S - 0.6) },
  { part: 'hill-friend-head', prop: 'angle', keys: lookUp(RELEASE_S + 0.3, GIVE_S - 0.8) },
  // They stand and walk on, the boy with the jar.
  { part: 'hill-boy', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  { part: 'hill-friend', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  { part: 'hill-jar', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 1, 0) },
  { part: 'walk-boy', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 0, 1) },
  { part: 'walk-friend', prop: 'opacity', keys: fadeKeys(STAND_S, CROSS_S, 0, 1) },
  {
    part: 'walk-boy-arm-front',
    prop: 'angle',
    keys: [[0, -1.7]],
  },
  ...stepTracks('walk-boy', 1, WALK2_S, STOP_S, WALK, { armsBusy: 'front' }),
  ...stepTracks('walk-friend', 1, WALK2_S, STOP_S, WALK, { girl: true }),
  { part: 'walk-boy', prop: 'x', keys: move(WALK2_S, BOY_SIT_X, STOP_S, BOY_GATE_X, 'linear') },
  { part: 'walk-friend', prop: 'x', keys: move(WALK2_S, FRIEND_SIT_X, STOP_S, FRIEND_GATE_X, 'linear') },
  {
    part: 'hill',
    prop: 'x',
    keys: slideKeys(HILL_OUT_S, HILL_OUT_LEN_S, HILL_X, HILL_X - HILL_OFF_DX, HILL_DEPTH, true),
  },
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
  // At the gate, the friend turns to go her own way (she is the other way about now)...
  {
    part: 'walk-friend',
    prop: 'opacity',
    keys: [
      [TURN_S, 1],
      [TURN_S + TURN_LEN_S, 0],
    ],
  },
  {
    part: 'walk-friend-back',
    prop: 'opacity',
    keys: [
      [TURN_S, 0],
      [TURN_S + TURN_LEN_S, 1],
    ],
  },
  // ...and raises his hand.
  {
    part: 'walk-friend-back-arm-front',
    prop: 'angle',
    keys: move(RAISE_S, STAND_ARM_DOWN, RAISE_S + 0.9, STAND_ARM_UP),
  },
  // The boy, at the gateway, looks back at her.
  { part: 'walk-boy-head', prop: 'angle', keys: move(TURN_S, 0, TURN_S + 0.6, 0.12) },
];

/** A sitting kid's head turning up to the sky (it faces right: up is counter-clockwise), and back down. */
function lookUp(t0: number, t1: number): Key[] {
  return [
    [t0, 0],
    [t0 + 0.7, 0.35, 'smooth'],
    [t1, 0.35],
    [t1 + 0.7, 0, 'smooth'],
  ];
}

const wobbles: Wobble[] = [
  ...ALL_FLIES.slice(1).flatMap((id, i) => fireflyWobbles(id, i + 1)),
  // The jar's light breathes; the sitting kids breathe; the tree's leaves stir.
  { part: 'jar-glow', prop: 'scale', amp: 0.05, period: 2.4 },
  { part: 'hill-friend-body', prop: 'angle', amp: 0.01, period: 3.6 },
  { part: 'hill-boy-body', prop: 'angle', amp: 0.01, period: 3.9, phase: 2 },
  { part: 'autumn-tree', prop: 'angle', amp: 0.008, period: 4.6 },
  { part: 'walk-friend-back-torso', prop: 'angle', amp: 0.01, period: 3.4 },
];

const cues: Cue[] = [
  { t: 0.1, kind: 'note', note: 0 },
  { t: RISE_S, kind: 'note', note: 2 },
  { t: FILL_S, kind: 'note', note: 1 },
  { t: FILL_S + 4 * FILL_EVERY_S, kind: 'note', note: 2 },
  { t: RELEASE_S, kind: 'note', note: 3 },
  { t: RELEASE_S + RELEASE_GROUP_S, kind: 'note', note: 4 },
  { t: GIVE_S + GIVE_LEN_S, kind: 'note', note: 1 },
  { t: HILL_OUT_S, kind: 'mood', mood: 'morning', seconds: 6 },
  { t: RAISE_S, kind: 'note', note: 2 },
];

export const FIREFLIES: Chapter = { id: 'fireflies', length: FIREFLIES_LENGTH_S, parts, tracks, wobbles, cues };
