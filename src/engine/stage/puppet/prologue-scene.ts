// The prologue, as shadow theatre on the bedroom wall: the wordless opening film (commit f847103) remade in cut-out puppets.
// A castle on a hill with five sleepers' lights over it; a small traveller walks in with an unlit lantern on a staff and stops;
// the lights go out one by one, last sleeper first, a falling note with each; the traveller looks down, an ember lights in its
// lantern (the first note, alone); the title writes itself on the wall, then one line, and the scene fades.
import {
  bobKeys,
  swingKeys,
  type Cue,
  type Key,
  type PuppetPart,
  type PuppetScene,
  type Track,
  type Wobble,
} from './puppet-scene';

/** Where the ground's path runs, metres up the wall from its centre (the traveller's feet): just above the panelling's rail, which is 0.2 m below the centre and too dark for a shadow to read on. */
export const PATH_Y = -0.12;
/** The castle's place on its hill. */
const CASTLE_X = 0.42;
const CASTLE_Y = -0.09;

/** The walk: from off the left of the stage to where the traveller stops, with a stride every STRIDE_S. */
export const WALK_FROM_S = 3;
export const WALK_TO_S = 8;
const WALK_X0 = -0.95;
const WALK_X1 = -0.26;
const STRIDE_S = 0.5;

/** The five sleepers' lights (lamp, bunting, pictures, globe, window): when each goes out, last sleeper first. */
export const WISP_OUT_FROM_S = 7.6;
export const WISP_OUT_EVERY_S = 0.8;
const WISP_OUT_S = 0.6;
const WISP_COLOURS: readonly (readonly [number, number, number])[] = [
  [1, 0.75, 0.35],
  [1, 0.55, 0.58],
  [0.55, 0.72, 1],
  [0.45, 0.95, 0.78],
  [0.72, 0.9, 1],
];
/** The ember lights in the lantern at this moment. */
export const EMBER_S = 12.2;
export const PROLOGUE_LENGTH_S = 21.5;
/** The whole scene fades off the wall over its last seconds. */
const FADE_OUT_FROM_S = 19.6;

const wispOut = (i: number) => WISP_OUT_FROM_S + WISP_OUT_EVERY_S * (4 - i);

const parts: PuppetPart[] = [
  // The scenery, fading up first. The castle stands behind its hill, so the hill is drawn over its foot. Each stands further
  // back than the traveller, so it casts a paler, softer shadow: the castle furthest, then the tree, then the near hill.
  { id: 'scenery', art: '', w: 1, h: 1, opacity: 0 },
  {
    id: 'castle',
    art: 'castle',
    parent: 'scenery',
    w: 0.38,
    h: 0.4,
    pivot: [0.5, 0],
    x: CASTLE_X,
    y: CASTLE_Y,
    depth: 0.85,
  },
  { id: 'tree', art: 'tree', parent: 'scenery', w: 0.18, h: 0.26, pivot: [0.5, 0], x: 0.82, y: -0.13, depth: 0.5 },
  { id: 'hills', art: 'hills', parent: 'scenery', w: 2.2, h: 0.12, pivot: [0.5, 0], x: 0, y: -0.192, depth: 0.3 },
  // The five lights over the castle.
  ...WISP_COLOURS.map((tint, i): PuppetPart => ({
    id: `wisp-${i}`,
    art: 'orb',
    look: 'glow',
    tint,
    w: 0.13,
    h: 0.13,
    x: CASTLE_X + (i - 2) * 0.11,
    y: 0.36 + 0.04 * Math.cos((i - 2) * 0.55),
    opacity: 0,
  })),
  // The traveller: an invisible root at its feet, two legs from the hip, a cloak, a hooded head, a staff held forward, and a
  // lantern hanging from the staff's tip with the ember inside it.
  { id: 'traveller', art: '', w: 1, h: 1, x: WALK_X0, y: PATH_Y, scale: 1.35, opacity: 0 },
  { id: 'leg-back', art: 'leg', parent: 'traveller', w: 0.022, h: 0.085, pivot: [0.5, 1], x: -0.006, y: 0.085 },
  { id: 'leg-front', art: 'leg', parent: 'traveller', w: 0.022, h: 0.085, pivot: [0.5, 1], x: 0.006, y: 0.085 },
  { id: 'body', art: 'cloak', parent: 'traveller', w: 0.1, h: 0.13, pivot: [0.5, 0], x: 0, y: 0.068 },
  { id: 'head', art: 'hood', parent: 'body', w: 0.068, h: 0.072, pivot: [0.45, 0.12], x: 0.006, y: 0.122 },
  { id: 'staff', art: 'staff', parent: 'body', w: 0.012, h: 0.17, pivot: [0.5, 0.2], x: 0.034, y: 0.075, angle: -0.55 },
  { id: 'lantern', art: 'lantern', parent: 'staff', w: 0.036, h: 0.052, pivot: [0.5, 1], x: 0, y: 0.135, angle: 0.55 },
  {
    id: 'ember',
    art: 'orb',
    look: 'glow',
    tint: [1, 0.78, 0.4],
    parent: 'lantern',
    w: 0.1,
    h: 0.1,
    x: 0,
    y: -0.03,
    opacity: 0,
  },
];

const fadeOut = (from: number): Key[] => [
  [FADE_OUT_FROM_S, from],
  [PROLOGUE_LENGTH_S - 0.3, 0, 'smooth'],
];

const tracks: Track[] = [
  {
    part: 'scenery',
    prop: 'opacity',
    keys: [[0, 0], [2.6, 1, 'smooth'], ...fadeOut(1)],
  },
  ...WISP_COLOURS.map((_, i): Track => ({
    part: `wisp-${i}`,
    prop: 'opacity',
    keys: [
      [0.8 + 0.4 * i, 0],
      [1.8 + 0.4 * i, 0.9, 'smooth'],
      [wispOut(i), 0.9],
      [wispOut(i) + WISP_OUT_S, 0, 'in'],
    ],
  })),
  // The traveller comes on as it walks in, and goes with the scenery.
  { part: 'traveller', prop: 'opacity', keys: [[WALK_FROM_S - 0.2, 0], [WALK_FROM_S + 0.5, 1], ...fadeOut(1)] },
  {
    part: 'traveller',
    prop: 'x',
    keys: [
      [WALK_FROM_S, WALK_X0],
      [WALK_FROM_S + 0.4, WALK_X0 + 0.035, 'in'],
      [WALK_TO_S - 0.4, WALK_X1 - 0.035],
      [WALK_TO_S, WALK_X1, 'out'],
    ],
  },
  { part: 'traveller', prop: 'y', keys: bobKeys(WALK_FROM_S, WALK_TO_S, STRIDE_S, PATH_Y, 0.005) },
  { part: 'leg-front', prop: 'angle', keys: swingKeys(WALK_FROM_S, WALK_TO_S, STRIDE_S, 0.34, 0, 0, 1) },
  { part: 'leg-back', prop: 'angle', keys: swingKeys(WALK_FROM_S, WALK_TO_S, STRIDE_S, 0.34, 0, 0, -1) },
  // It leans into the walk, then stands up straight when it stops.
  {
    part: 'body',
    prop: 'angle',
    keys: [
      [WALK_FROM_S, 0],
      [WALK_FROM_S + 0.6, -0.07, 'smooth'],
      [WALK_TO_S - 0.3, -0.07],
      [WALK_TO_S + 0.4, 0, 'smooth'],
    ],
  },
  // The lantern swings with the steps and settles; it jolts once when the ember catches.
  {
    part: 'lantern',
    prop: 'angle',
    keys: [
      ...swingKeys(WALK_FROM_S, WALK_TO_S + 0.6, STRIDE_S, 0.2, 0.55, 0.55, -1),
      [EMBER_S - 0.05, 0.55],
      [EMBER_S + 0.15, 0.68, 'out'],
      [EMBER_S + 0.55, 0.47, 'smooth'],
      [EMBER_S + 1.0, 0.55, 'smooth'],
    ],
  },
  // It looks up at the lights as they go, holds there in the dark, looks down at its lantern as the ember catches, then
  // lifts the lantern a little and looks ahead to the castle.
  {
    part: 'head',
    prop: 'angle',
    keys: [
      [WALK_TO_S - 0.6, 0],
      [WALK_TO_S + 0.3, 0.38, 'smooth'],
      [11.2, 0.38],
      [11.9, -0.32, 'smooth'],
      [14.0, -0.32],
      [14.9, 0.08, 'smooth'],
    ],
  },
  {
    part: 'staff',
    prop: 'angle',
    keys: [
      [11.2, -0.55],
      [11.9, -0.42, 'smooth'],
      [14.0, -0.42],
      [14.9, -0.75, 'smooth'],
    ],
  },
  {
    part: 'ember',
    prop: 'opacity',
    keys: [[EMBER_S - 0.2, 0], [EMBER_S + 0.3, 1, 'out'], [EMBER_S + 1.3, 0.8, 'smooth'], ...fadeOut(0.8)],
  },
  {
    part: 'ember',
    prop: 'scale',
    keys: [
      [EMBER_S - 0.2, 0.2],
      [EMBER_S + 0.4, 1.25, 'out'],
      [EMBER_S + 1.3, 1, 'smooth'],
    ],
  },
];

const wobbles: Wobble[] = [
  // The lights drift, each to its own beat; the ember flickers.
  ...WISP_COLOURS.map((_, i): Wobble => ({
    part: `wisp-${i}`,
    prop: 'y',
    amp: 0.008,
    period: 4.8 + 0.4 * i,
    phase: i,
  })),
  ...WISP_COLOURS.map((_, i): Wobble => ({
    part: `wisp-${i}`,
    prop: 'scale',
    amp: 0.06,
    period: 3 + 0.5 * i,
    phase: 2 * i,
  })),
  { part: 'ember', prop: 'scale', amp: 0.07, period: 0.7 },
  // The traveller breathes while it stands.
  { part: 'body', prop: 'scale', amp: 0.008, period: 3.4 },
];

const cues: Cue[] = [
  { t: 13.6, kind: 'line', slot: 'title', text: 'WHERE SHADOWS WANDER', hold: 4.4 },
  { t: 16.2, kind: 'line', slot: 'line', text: 'Help it wake them.', hold: 1.9 },
];

export const PROLOGUE_SCENE: PuppetScene = {
  id: 'prologue',
  length: PROLOGUE_LENGTH_S,
  parts,
  tracks,
  wobbles,
  cues,
};
