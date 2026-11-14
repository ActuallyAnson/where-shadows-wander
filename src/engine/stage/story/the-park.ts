// Scene 3, "The park" (docs/STORY.md): the chapter after the friend's fox. The player's fox lands in the fort, crouches and
// pounces at the rabbit on the blanket, and the rabbit bolts. They run, the fox after the rabbit, and the fort slides off to the
// left while the park's trees slide in from the right, the light warming into spring. Mid-run the rabbit and the fox become the
// two kids, still running, the friend chasing the boy; she catches him, and they tumble over into the grass and lie there
// laughing. The light goes to dusk, and a single firefly blinks over them; the friend reaches up towards it: the chapter ends on
// that, and the story holds the picture while the friend's hand shows the cup. Every time is in seconds from the chapter's start.
import { OFF_WALL_X, slideKeys, type Chapter } from '../puppet/chapters';
import {
  bobKeys,
  swingKeys,
  type Cue,
  type Key,
  type PuppetPart,
  type Track,
  type Wobble,
} from '../puppet/puppet-scene';
import { FORT_DEPTH, FORT_OFF_X, RABBIT_REST } from './how-they-met';
import { ROOM_DEPTH, ROOM_OFF_X } from './the-storm';
import {
  FLOOR_Y,
  LYING_LIFT,
  RUN,
  STAND_ARM_DOWN,
  fadeKeys,
  firefly,
  fireflyWobbles,
  standingKid,
  stepTracks,
} from './story-kit';

/** The puppet fox: from the player's shadow (the handoff) to where it lands, behind the rabbit on the blanket. */
export const FOX_LANDS: readonly [number, number] = [-0.16, FLOOR_Y];
/** It crouches, then pounces to where the rabbit was. */
const CROUCH_S = 1.9;
const POUNCE_S = 2.4;
const POUNCE_LEN_S = 0.45;
const FOX_POUNCED_X = -0.03;
/** The rabbit jumps, startled, and bolts right; the fox goes after it. */
const STARTLE_S = POUNCE_S + 0.15;
const BOLT_S = STARTLE_S + 0.35;
const BOLT_LEN_S = 1.1;
const FOX_CHASE_S = POUNCE_S + POUNCE_LEN_S + 0.1;
const FOX_CHASE_LEN_S = 1.2;
/** Where they run on the spot while the stage goes by: the rabbit ahead, the fox close behind. */
const RABBIT_RUN_X = 0.3;
const FOX_RUN_X = 0.11;
/** The fort and the kids slide off to the left... */
const SLIDE_OUT_S = BOLT_S + 0.6;
const SLIDE_S = 3.0;
/** ...and the park slides in from the right, a little behind them, slower: the stage turning a long way. */
const PARK_IN_S = SLIDE_OUT_S + 0.9;
const PARK_SLIDE_S = 4.2;
/** How far right of its place each piece of the park starts. */
export const PARK_FROM_DX = 2.1;
/** Mid-run, the rabbit becomes the boy and the fox the friend. */
const CHANGE_S = 7.4;
const CHANGE_LEN_S = 0.7;
/** While the stage still turns, they drift back a little: the park going by faster than they run. */
const DRIFT_TO_S = 9.6;
const BOY_DRIFT_X = 0.24;
const FRIEND_DRIFT_X = 0.0;
/** The friend puts on speed and catches him... */
const CATCH_S = 10.6;
const FRIEND_CATCH_X = 0.17;
const BOY_CAUGHT_X = 0.28;
/** ...and they tumble over backwards into the grass: the boy where he was, the friend skidding back past him. */
const FALL_S = CATCH_S + 0.25;
const FALL_LEN_S = 0.7;
const ROLL_LEN_S = 1.2;
/** Where each lies (the feet: each lies on his back with his head to the left). */
export const BOY_LIES_X = 0.22;
export const FRIEND_LIES_X = -0.26;
/** They laugh, lying there. */
const LAUGH_S = FALL_S + ROLL_LEN_S + 0.2;
const LAUGH_LEN_S = 3.4;
/** The sky goes to dusk, and a firefly comes and blinks over them. */
const DUSK_S = LAUGH_S + 1.2;
const FIREFLY_S = LAUGH_S + LAUGH_LEN_S + 0.8;
const FIREFLY_LEN_S = 4.2;
export const FIREFLY_HOVER: readonly [number, number] = [-0.21, 0.13];
/** The friend reaches up towards it: the chapter ends with her arm up. */
const REACH_S = FIREFLY_S + FIREFLY_LEN_S + 0.4;
export const THE_PARK_LENGTH_S = REACH_S + 1.4;

/** A running stride for the animals: a bob up at each bound. */
const RABBIT_STRIDE_S = 0.42;
const FOX_STRIDE_S = 0.38;

/** How far back the park's pieces stand: the far tree palest, the grass nearly as dark as the kids. */
const GRASS_DEPTH = 0.25;
/** The park: its grass along the floor and three trees, each with its place, size and depth. */
export const PARK_TREES: readonly { id: string; x: number; h: number; depth: number }[] = [
  { id: 'park-tree-1', x: -0.6, h: 0.62, depth: 0.45 },
  { id: 'park-tree-2', x: 0.04, h: 0.48, depth: 0.75 },
  { id: 'park-tree-3', x: 0.62, h: 0.66, depth: 0.5 },
];
export const GRASS_W = 2.2;

const parts: PuppetPart[] = [
  // The park, behind everything: the far tree first.
  ...[...PARK_TREES]
    .sort((a, b) => b.depth - a.depth)
    .map((t): PuppetPart => ({
      id: t.id,
      art: 'leafy-tree',
      w: t.h * 0.8,
      h: t.h,
      pivot: [0.5, 0],
      x: t.x + PARK_FROM_DX,
      y: FLOOR_Y - 0.01,
      depth: t.depth,
    })),
  {
    id: 'grass',
    art: 'grass',
    w: GRASS_W,
    h: 0.07,
    pivot: [0.5, 0.7],
    x: PARK_FROM_DX,
    y: FLOOR_Y,
    depth: GRASS_DEPTH,
  },
  // The player's fox: over the fort, as the rabbit was.
  { id: 'fox', art: 'fox', w: 0.22, h: 0.15, pivot: [0.5, 0], x: FOX_LANDS[0], y: FOX_LANDS[1], opacity: 0 },
  // The two kids, standing and running, brought on as the rabbit and the fox turn into them.
  ...standingKid('run-friend', FOX_RUN_X, 1, { opacity: 0, girl: true }),
  ...standingKid('run-boy', RABBIT_RUN_X, 1, { opacity: 0 }),
  // The firefly: a small green-gold light (its root holds where it is and whether it is there; the light blinks).
  ...firefly('firefly', 0.5, 0.32),
];

const ROLL_BACK = Math.PI / 2;

const tracks: Track[] = [
  // The park slides in from the right, the near pieces ahead of the far ones.
  ...PARK_TREES.map((t): Track => ({
    part: t.id,
    prop: 'x',
    keys: slideKeys(PARK_IN_S, PARK_SLIDE_S, t.x + PARK_FROM_DX, t.x, t.depth),
  })),
  { part: 'grass', prop: 'x', keys: slideKeys(PARK_IN_S, PARK_SLIDE_S, PARK_FROM_DX, 0, GRASS_DEPTH) },
  // The fox.
  {
    part: 'fox',
    prop: 'opacity',
    keys: [[0, 0], [0.5, 1, 'out'], ...fadeKeys(CHANGE_S, CHANGE_LEN_S, 1, 0)],
  },
  {
    part: 'fox',
    prop: 'x',
    keys: [
      [POUNCE_S, FOX_LANDS[0]],
      [POUNCE_S + POUNCE_LEN_S, FOX_POUNCED_X, 'smooth'],
      [FOX_CHASE_S, FOX_POUNCED_X],
      [FOX_CHASE_S + FOX_CHASE_LEN_S, FOX_RUN_X, 'smooth'],
    ],
  },
  {
    part: 'fox',
    prop: 'y',
    keys: [
      [POUNCE_S, FLOOR_Y],
      [POUNCE_S + POUNCE_LEN_S / 2, FLOOR_Y + 0.07, 'out'],
      [POUNCE_S + POUNCE_LEN_S, FLOOR_Y, 'in'],
      ...bobKeys(FOX_CHASE_S, CHANGE_S + CHANGE_LEN_S, FOX_STRIDE_S, FLOOR_Y, 0.025).slice(1),
    ],
  },
  // It crouches, leaning forward (it faces right, so forward is clockwise), and straightens as it springs.
  {
    part: 'fox',
    prop: 'angle',
    keys: [
      [CROUCH_S, 0],
      [CROUCH_S + 0.4, -0.14, 'smooth'],
      [POUNCE_S, -0.14],
      [POUNCE_S + 0.15, 0.12, 'out'],
      [POUNCE_S + POUNCE_LEN_S, 0, 'smooth'],
      ...swingKeys(FOX_CHASE_S + 0.2, CHANGE_S + CHANGE_LEN_S, FOX_STRIDE_S, 0.05).slice(1),
    ],
  },
  // The rabbit: up with a start, then bolting right, and running on the spot until it is the boy.
  {
    part: 'rabbit',
    prop: 'x',
    keys: [
      [BOLT_S, RABBIT_REST[0]],
      [BOLT_S + BOLT_LEN_S, RABBIT_RUN_X, 'smooth'],
    ],
  },
  {
    part: 'rabbit',
    prop: 'y',
    keys: [
      [STARTLE_S, RABBIT_REST[1]],
      [STARTLE_S + 0.15, RABBIT_REST[1] + 0.05, 'out'],
      [STARTLE_S + 0.32, RABBIT_REST[1], 'in'],
      ...bobKeys(BOLT_S, CHANGE_S + CHANGE_LEN_S, RABBIT_STRIDE_S, RABBIT_REST[1], 0.04).slice(1),
    ],
  },
  {
    part: 'rabbit',
    prop: 'angle',
    // Its head was tipped up at the friend's hand (scene 2's last picture); it comes down as it starts.
    keys: [
      [STARTLE_S, 0.1],
      [BOLT_S, 0, 'smooth'],
      ...swingKeys(BOLT_S, CHANGE_S + CHANGE_LEN_S, RABBIT_STRIDE_S, 0.08).slice(1),
    ],
  },
  { part: 'rabbit', prop: 'opacity', keys: fadeKeys(CHANGE_S, CHANGE_LEN_S, 1, 0) },
  // The fort and the kids slide away to the left behind them (the fort, standing back, a little behind).
  { part: 'fort', prop: 'x', keys: slideKeys(SLIDE_OUT_S, SLIDE_S, 0, -FORT_OFF_X, FORT_DEPTH, true) },
  { part: 'scenery', prop: 'x', keys: slideKeys(SLIDE_OUT_S, SLIDE_S, 0, -OFF_WALL_X, 0, true) },
  // His room (the window and the boxes) goes with the fort.
  { part: 'room', prop: 'x', keys: slideKeys(SLIDE_OUT_S, SLIDE_S, 0, -ROOM_OFF_X, ROOM_DEPTH, true) },
  // The kids come in where the animals were, running.
  { part: 'run-boy', prop: 'opacity', keys: fadeKeys(CHANGE_S, CHANGE_LEN_S, 0, 1) },
  { part: 'run-friend', prop: 'opacity', keys: fadeKeys(CHANGE_S, CHANGE_LEN_S, 0, 1) },
  ...stepTracks('run-boy', 1, CHANGE_S - 0.2, FALL_S, RUN),
  ...stepTracks('run-friend', 1, CHANGE_S - 0.2, CATCH_S, RUN, { girl: true }),
  {
    part: 'run-boy',
    prop: 'x',
    keys: [
      [CHANGE_S, RABBIT_RUN_X],
      [DRIFT_TO_S, BOY_DRIFT_X, 'smooth'],
      [CATCH_S, BOY_CAUGHT_X, 'smooth'],
      // Falling back, he slides a little along the grass.
      [FALL_S + FALL_LEN_S, BOY_LIES_X, 'out'],
    ],
  },
  {
    part: 'run-friend',
    prop: 'x',
    keys: [
      [CHANGE_S, FOX_RUN_X],
      [DRIFT_TO_S, FRIEND_DRIFT_X, 'smooth'],
      [CATCH_S, FRIEND_CATCH_X, 'in'],
      // She topples back and skids along the grass past the boy's head, coming to rest on her back.
      [FALL_S + ROLL_LEN_S, FRIEND_LIES_X, 'smooth'],
    ],
  },
  // Catching him, the friend's arms go forward.
  {
    part: 'run-friend-arm-front',
    prop: 'angle',
    keys: [
      [CATCH_S, -STAND_ARM_DOWN],
      [CATCH_S + 0.25, -1.45, 'out'],
      [FALL_S + FALL_LEN_S, -1.2],
      [LAUGH_S, -STAND_ARM_DOWN + 0.4, 'smooth'],
      // Lying on her back, she reaches up to the firefly (her body turned a quarter, so straight up is a quarter clockwise).
      [REACH_S, -STAND_ARM_DOWN + 0.4],
      [REACH_S + 1.0, -1.45, 'smooth'],
    ],
  },
  // Over they go, backwards, onto their backs: one gentle quarter turn each, no spinning.
  {
    part: 'run-boy',
    prop: 'angle',
    keys: [
      [FALL_S, 0],
      [FALL_S + FALL_LEN_S, ROLL_BACK, 'in'],
    ],
  },
  {
    part: 'run-friend',
    prop: 'angle',
    keys: [
      [FALL_S, 0],
      [FALL_S + ROLL_LEN_S * 0.75, ROLL_BACK, 'smooth'],
    ],
  },
  // On their backs, they laugh: small quick shakes, heads tipped back.
  {
    part: 'run-boy',
    prop: 'y',
    keys: [
      [FALL_S + FALL_LEN_S, FLOOR_Y + LYING_LIFT],
      ...bobKeys(LAUGH_S, LAUGH_S + LAUGH_LEN_S, 0.4, FLOOR_Y + LYING_LIFT, 0.008).slice(1),
    ],
  },
  {
    part: 'run-friend',
    prop: 'y',
    keys: [
      [FALL_S, FLOOR_Y],
      [FALL_S + ROLL_LEN_S / 2, FLOOR_Y + 0.04, 'out'],
      [FALL_S + ROLL_LEN_S, FLOOR_Y + LYING_LIFT, 'in'],
      ...bobKeys(LAUGH_S + 0.15, LAUGH_S + LAUGH_LEN_S, 0.36, FLOOR_Y + LYING_LIFT, 0.008).slice(1),
    ],
  },
  { part: 'run-boy-head', prop: 'angle', keys: laughHead(LAUGH_S) },
  { part: 'run-friend-head', prop: 'angle', keys: laughHead(LAUGH_S + 0.15) },
  // The firefly drifts in from the right, wandering, and comes to hover over them.
  {
    part: 'firefly',
    prop: 'opacity',
    keys: [
      [FIREFLY_S, 0],
      [FIREFLY_S + 0.8, 1, 'smooth'],
    ],
  },
  {
    part: 'firefly',
    prop: 'x',
    keys: [
      [FIREFLY_S, 0.5],
      [FIREFLY_S + FIREFLY_LEN_S * 0.4, 0.3, 'smooth'],
      [FIREFLY_S + FIREFLY_LEN_S * 0.7, 0.12, 'smooth'],
      [FIREFLY_S + FIREFLY_LEN_S, FIREFLY_HOVER[0], 'smooth'],
    ],
  },
  {
    part: 'firefly',
    prop: 'y',
    keys: [
      [FIREFLY_S, 0.32],
      [FIREFLY_S + FIREFLY_LEN_S * 0.4, 0.2, 'smooth'],
      [FIREFLY_S + FIREFLY_LEN_S * 0.7, 0.26, 'smooth'],
      [FIREFLY_S + FIREFLY_LEN_S, FIREFLY_HOVER[1], 'smooth'],
    ],
  },
  // Both heads turn up to watch it.
  {
    part: 'run-boy-torso',
    prop: 'angle',
    keys: [
      [FIREFLY_S + 1.5, 0],
      [FIREFLY_S + 2.5, -0.12, 'smooth'],
    ],
  },
];

/** A lying kid's head tipping back as it laughs (it faces right in its own frame, so back is counter-clockwise), and forward again. */
function laughHead(t0: number): Key[] {
  return [
    [t0, 0],
    [t0 + 0.4, 0.28, 'out'],
    [t0 + LAUGH_LEN_S, 0.28],
    [t0 + LAUGH_LEN_S + 0.8, 0, 'smooth'],
  ];
}

const wobbles: Wobble[] = [
  // The firefly hovers and blinks; the trees stir.
  ...fireflyWobbles('firefly', 0),
  ...PARK_TREES.map((t, i): Wobble => ({ part: t.id, prop: 'angle', amp: 0.006, period: 4.1 + i * 0.7, phase: i })),
];

/** Notes as the fox lands and pounces, as they become the kids, as they tumble, and one as the firefly comes. */
const cues: Cue[] = [
  { t: 0.1, kind: 'note', note: 1 },
  { t: POUNCE_S, kind: 'note', note: 3 },
  { t: PARK_IN_S, kind: 'mood', mood: 'warm', seconds: 4 },
  { t: CHANGE_S, kind: 'note', note: 4 },
  { t: FALL_S + 0.3, kind: 'note', note: 2 },
  { t: LAUGH_S, kind: 'note', note: 3 },
  { t: DUSK_S, kind: 'mood', mood: 'dusk', seconds: 6 },
  { t: FIREFLY_S + 1, kind: 'note', note: 0 },
];

export const THE_PARK: Chapter = { id: 'the-park', length: THE_PARK_LENGTH_S, parts, tracks, wobbles, cues };
