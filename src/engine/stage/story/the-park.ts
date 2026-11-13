// Scene 3, "The park" (docs/STORY.md): the chapter after the friend's fox. So far only its opening is built: the player's fox
// lands in the fort, crouches and pounces at the rabbit on the blanket, and the rabbit bolts. They run, the fox after the rabbit,
// and the fort and the kids slide off to the left behind them while they keep running in the middle of the wall, then the two
// run off its right edge. (Next: the trees slide in from the right as the fort goes, and mid-run the rabbit and fox become the
// two boys running between them.) Every time is in seconds from the chapter's start.
import { OFF_WALL_X, slideKeys, type Chapter } from '../puppet/chapters';
import { bobKeys, swingKeys, type Cue, type PuppetPart, type Track } from '../puppet/puppet-scene';
import { FLOOR_Y, FORT_DEPTH, RABBIT_REST } from './how-they-met';

/** The puppet fox: from the player's shadow (the handoff) to where it lands, behind the rabbit on the blanket. */
export const FOX_LANDS: readonly [number, number] = [-0.16, FLOOR_Y];
const FOX_SCALE = 1;
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
/** The fort and the kids slide off to the left. */
const SLIDE_OUT_S = BOLT_S + 0.6;
const SLIDE_S = 3.0;
/** Then the two run off the wall's right edge. */
const RUN_OFF_S = 8.4;
const RUN_OFF_LEN_S = 1.5;
export const THE_PARK_LENGTH_S = RUN_OFF_S + RUN_OFF_LEN_S + 0.8;
/** A running stride: a bob up at each bound. */
const RABBIT_STRIDE_S = 0.42;
const FOX_STRIDE_S = 0.38;

const parts: PuppetPart[] = [
  // The player's fox: over everything, as the rabbit was.
  {
    id: 'fox',
    art: 'fox',
    w: 0.22,
    h: 0.15,
    pivot: [0.5, 0],
    x: FOX_LANDS[0],
    y: FOX_LANDS[1],
    scale: FOX_SCALE,
    opacity: 0,
  },
];

const runEnd = RUN_OFF_S + RUN_OFF_LEN_S;

const tracks: Track[] = [
  {
    part: 'fox',
    prop: 'opacity',
    keys: [
      [0, 0],
      [0.5, 1, 'out'],
    ],
  },
  {
    part: 'fox',
    prop: 'x',
    keys: [
      [POUNCE_S, FOX_LANDS[0]],
      [POUNCE_S + POUNCE_LEN_S, FOX_POUNCED_X, 'smooth'],
      [FOX_CHASE_S, FOX_POUNCED_X],
      [FOX_CHASE_S + FOX_CHASE_LEN_S, FOX_RUN_X, 'smooth'],
      [RUN_OFF_S + 0.2, FOX_RUN_X],
      [runEnd + 0.3, OFF_WALL_X, 'in'],
    ],
  },
  {
    part: 'fox',
    prop: 'y',
    keys: [
      [POUNCE_S, FLOOR_Y],
      [POUNCE_S + POUNCE_LEN_S / 2, FLOOR_Y + 0.07, 'out'],
      [POUNCE_S + POUNCE_LEN_S, FLOOR_Y, 'in'],
      ...bobKeys(FOX_CHASE_S, runEnd + 0.3, FOX_STRIDE_S, FLOOR_Y, 0.025).slice(1),
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
      ...swingKeys(FOX_CHASE_S + 0.2, runEnd, FOX_STRIDE_S, 0.05).slice(1),
    ],
  },
  // The rabbit: up with a start, then bolting right, and running on the spot.
  {
    part: 'rabbit',
    prop: 'x',
    keys: [
      [BOLT_S, RABBIT_REST[0]],
      [BOLT_S + BOLT_LEN_S, RABBIT_RUN_X, 'smooth'],
      [RUN_OFF_S, RABBIT_RUN_X],
      [runEnd, OFF_WALL_X, 'in'],
    ],
  },
  {
    part: 'rabbit',
    prop: 'y',
    keys: [
      [STARTLE_S, RABBIT_REST[1]],
      [STARTLE_S + 0.15, RABBIT_REST[1] + 0.05, 'out'],
      [STARTLE_S + 0.32, RABBIT_REST[1], 'in'],
      ...bobKeys(BOLT_S, runEnd, RABBIT_STRIDE_S, RABBIT_REST[1], 0.04).slice(1),
    ],
  },
  {
    part: 'rabbit',
    prop: 'angle',
    keys: [[STARTLE_S, 0], ...swingKeys(BOLT_S, runEnd, RABBIT_STRIDE_S, 0.08).slice(1)],
  },
  // The fort and the kids slide away to the left behind them (the fort, standing back, a little behind).
  { part: 'fort', prop: 'x', keys: slideKeys(SLIDE_OUT_S, SLIDE_S, 0, -OFF_WALL_X, FORT_DEPTH, true) },
  { part: 'scenery', prop: 'x', keys: slideKeys(SLIDE_OUT_S, SLIDE_S, 0, -OFF_WALL_X, 0, true) },
];

/** A note as the fox lands, one as it pounces, and one as they run off. */
const cues: Cue[] = [
  { t: 0.1, kind: 'note', note: 1 },
  { t: POUNCE_S, kind: 'note', note: 3 },
  { t: RUN_OFF_S, kind: 'note', note: 4 },
];

export const THE_PARK: Chapter = { id: 'the-park', length: THE_PARK_LENGTH_S, parts, tracks, cues };
