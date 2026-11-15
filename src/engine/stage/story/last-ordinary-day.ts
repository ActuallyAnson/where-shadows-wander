// Scene 5, "The last ordinary day" (docs/STORY.md): the chapter after the friend's wave. At the school gate the boy waves back,
// as on any day, and they go opposite ways: the boy off the right edge of the wall with his jar, the friend off the left. Just
// before the edge the friend turns back and waves again, but the boy is already gone; the wave hangs there, unanswered, and then
// the friend walks off too. The gate slides away to the right, and the park slides back in from the left, the wrong way, the
// candle's light cooling and dimming: the park and the jar from scene 4, with only the boy sitting there. Then the park slides
// slowly away, until the wall is empty for the first time since the candle was lit. Every time is in seconds from its start.
import { slideKeys, type Chapter } from '../puppet/chapters';
import { swingKeys, type Cue, type Key, type Track, type Wobble } from '../puppet/puppet-scene';
import {
  AUTUMN_TREE_X,
  BOY_GATE_X,
  BOY_HOLD_ARM,
  BOY_SIT_X,
  FRIEND_GATE_X,
  GATE_DEPTH,
  GATE_OFF_DX,
  GATE_X,
  LEAVES,
} from './fireflies';
import { GRASS_W, PARK_FROM_DX, PARK_TREES } from './the-park';
import { ARM_DOWN, STAND_ARM_DOWN, STAND_ARM_UP, WALK, fadeKeys, stepTracks } from './story-kit';

/** The boy waves back at the gate. */
const WAVE_S = 0.4;
const WAVE_LEN_S = 2.2;
/** They go their ways: the boy off the right edge, the friend towards the left one. */
const PART_S = WAVE_S + WAVE_LEN_S + 0.3;
const BOY_GONE_S = PART_S + 4.0;
const FRIEND_STOPS_S = PART_S + 3.6;
const FRIEND_STOP_X = -0.5;
/** Near the edge the friend turns back and waves again; nobody is there. */
const TURN_BACK_S = FRIEND_STOPS_S + 0.3;
const TURN_LEN_S = 0.3;
const WAVE2_S = TURN_BACK_S + 0.5;
const WAVE2_LEN_S = 2.8;
/** She lowers her hand, turns away and walks off. */
const TURN_AWAY_S = WAVE2_S + WAVE2_LEN_S + 1.0;
const FRIEND_GONE_S = TURN_AWAY_S + 3.4;
/** The gate slides away to the right, and the park comes back in from the left, with only the boy in its grass. */
const GATE_OUT_S = TURN_AWAY_S + 2.0;
const GATE_OUT_LEN_S = 4.5;
const PARK_BACK_S = GATE_OUT_S + 1.0;
const PARK_BACK_LEN_S = 5.5;
/** He sits there, alone, and bows his head... */
const BOW_S = PARK_BACK_S + PARK_BACK_LEN_S + 1.5;
/** ...and the park slides slowly away, leaving the wall empty. */
const PARK_AWAY_S = BOW_S + 4.5;
const PARK_AWAY_LEN_S = 7.0;
export const LAST_ORDINARY_DAY_LENGTH_S = PARK_AWAY_S + PARK_AWAY_LEN_S * 1.1 + 1.2;

/** The jar in the grass in front of him (he faces left), towards where the friend sat. */
const JAR_BESIDE_X = BOY_SIT_X - 0.12;

const move = (t0: number, v: number, t1: number, to: number, ease: Key[2] = 'smooth'): Key[] => [
  [t0, v],
  [t1, to, ease],
];
const step = (t: number, to: number): Key => [t, to, 'step'];
/** How far back the park's grass stands (as in scenes 3 and 4). */
const GRASS_DEPTH = 0.25;

const tracks: Track[] = [
  // Facing each other at the gate, the boy waves back with his free hand, and the friend's raised hand waves too.
  {
    part: 'walk-boy-back-arm-back',
    prop: 'angle',
    keys: [
      [WAVE_S, STAND_ARM_DOWN],
      ...swingKeys(WAVE_S + 0.4, WAVE_S + WAVE_LEN_S - 0.4, 0.8, 0.3, 0.35, 0.35),
      [WAVE_S + WAVE_LEN_S, STAND_ARM_DOWN, 'smooth'],
    ],
  },
  {
    part: 'walk-friend-arm-front',
    prop: 'angle',
    keys: [
      ...swingKeys(WAVE_S, WAVE_S + WAVE_LEN_S - 0.3, 0.9, 0.28, -STAND_ARM_UP, -STAND_ARM_UP),
      [PART_S, -STAND_ARM_DOWN, 'smooth'],
    ],
  },
  // Then each turns away, to go their own way: the boy through the gate, the friend back the way they came.
  { part: 'walk-boy-back', prop: 'opacity', keys: fadeKeys(PART_S - 0.2, TURN_LEN_S, 1, 0) },
  { part: 'walk-boy', prop: 'opacity', keys: fadeKeys(PART_S - 0.2, TURN_LEN_S, 0, 1) },
  { part: 'walk-friend', prop: 'opacity', keys: fadeKeys(PART_S - 0.1, TURN_LEN_S, 1, 0) },
  { part: 'walk-friend-back', prop: 'opacity', keys: fadeKeys(PART_S - 0.1, TURN_LEN_S, 0, 1) },
  // They go their ways.
  ...stepTracks('walk-boy', 1, PART_S + 0.1, BOY_GONE_S, WALK, { armsBusy: 'front' }),
  { part: 'walk-boy', prop: 'x', keys: move(PART_S + 0.1, BOY_GATE_X, BOY_GONE_S, 1.25, 'linear') },
  ...stepTracks('walk-friend-back', -1, PART_S + 0.2, FRIEND_STOPS_S, WALK, { girl: true }),
  {
    part: 'walk-friend-back',
    prop: 'x',
    keys: move(PART_S + 0.2, FRIEND_GATE_X, FRIEND_STOPS_S, FRIEND_STOP_X, 'linear'),
  },
  // He turns back...
  {
    part: 'walk-friend-back',
    prop: 'opacity',
    keys: [
      [TURN_BACK_S, 1],
      [TURN_BACK_S + TURN_LEN_S, 0],
      [TURN_AWAY_S, 0],
      [TURN_AWAY_S + TURN_LEN_S, 1],
    ],
  },
  { part: 'walk-friend', prop: 'x', keys: [step(TURN_BACK_S - 0.1, FRIEND_STOP_X)] },
  {
    part: 'walk-friend',
    prop: 'opacity',
    keys: [
      [TURN_BACK_S, 0],
      [TURN_BACK_S + TURN_LEN_S, 1],
      [TURN_AWAY_S, 1],
      [TURN_AWAY_S + TURN_LEN_S, 0],
    ],
  },
  // ...and waves once more, at nobody; and holds his hand up a moment before it comes down.
  {
    part: 'walk-friend-arm-front',
    prop: 'angle',
    keys: [
      [WAVE2_S, -STAND_ARM_DOWN],
      [WAVE2_S + 0.6, -STAND_ARM_UP, 'smooth'],
      ...swingKeys(WAVE2_S + 0.6, WAVE2_S + WAVE2_LEN_S - 0.8, 0.9, 0.28, -STAND_ARM_UP, -STAND_ARM_UP).slice(1),
      [WAVE2_S + WAVE2_LEN_S, -STAND_ARM_UP],
      [TURN_AWAY_S - 0.1, -STAND_ARM_DOWN, 'smooth'],
    ],
  },
  { part: 'walk-friend-head', prop: 'angle', keys: move(WAVE2_S + WAVE2_LEN_S, 0, WAVE2_S + WAVE2_LEN_S + 0.8, -0.12) },
  // Then she walks off the left edge.
  ...stepTracks('walk-friend-back', -1, TURN_AWAY_S + 0.3, FRIEND_GONE_S, WALK, { girl: true }),
  {
    part: 'walk-friend-back',
    prop: 'x',
    keys: move(TURN_AWAY_S + 0.3, FRIEND_STOP_X, FRIEND_GONE_S, -1.25, 'linear'),
  },
  // The gate and its tree slide away to the right, the wrong way, with the leaves on the ground.
  {
    part: 'gate',
    prop: 'x',
    keys: slideKeys(GATE_OUT_S, GATE_OUT_LEN_S, GATE_X, GATE_X + GATE_OFF_DX, GATE_DEPTH, true),
  },
  {
    part: 'autumn-tree',
    prop: 'x',
    keys: slideKeys(GATE_OUT_S, GATE_OUT_LEN_S, AUTUMN_TREE_X, AUTUMN_TREE_X + GATE_OFF_DX, 0.55, true),
  },
  ...LEAVES.map(({ land: x }, i): Track => ({
    part: `leaf-${i}`,
    prop: 'x',
    keys: slideKeys(GATE_OUT_S, GATE_OUT_LEN_S, x, x + GATE_OFF_DX, 0, true),
  })),
  // The park comes back from the left: the boy alone in its grass, turned to where the friend sat, the jar (dark now) set
  // down in the grass in front of him.
  { part: 'park-boy', prop: 'opacity', keys: [step(PARK_BACK_S - 0.2, 1)] },
  { part: 'park-friend', prop: 'opacity', keys: [step(PARK_BACK_S - 0.2, 0)] },
  { part: 'park-boy-jar', prop: 'opacity', keys: [[PARK_BACK_S - 0.3, 1], step(PARK_BACK_S - 0.2, 0)] },
  { part: 'park-jar', prop: 'opacity', keys: [step(PARK_BACK_S - 0.2, 1)] },
  { part: 'park-jar', prop: 'x', keys: [step(PARK_BACK_S - 0.2, JAR_BESIDE_X)] },
  // (He faces left, so his arm's angles are the other way about.)
  {
    part: 'park-boy-arm',
    prop: 'angle',
    keys: [[PARK_BACK_S - 0.3, BOY_HOLD_ARM], step(PARK_BACK_S - 0.2, ARM_DOWN)],
  },
  {
    part: 'park-boy-head',
    prop: 'angle',
    keys: [
      [PARK_BACK_S - 0.3, 0],
      [BOW_S, 0],
      [BOW_S + 1.6, 0.2, 'smooth'],
    ],
  },
  // The trees and the grass (the boy and the jar in it), each piece at its own depth.
  ...PARK_TREES.map((t): Track => ({
    part: t.id,
    prop: 'x',
    keys: [
      ...slideKeys(PARK_BACK_S, PARK_BACK_LEN_S, t.x - PARK_FROM_DX, t.x, t.depth),
      ...slideKeys(PARK_AWAY_S, PARK_AWAY_LEN_S, t.x, t.x + PARK_FROM_DX, t.depth, true),
    ],
  })),
  {
    part: 'grass',
    prop: 'x',
    keys: [
      ...slideKeys(PARK_BACK_S, PARK_BACK_LEN_S, -GRASS_W, 0, GRASS_DEPTH),
      ...slideKeys(PARK_AWAY_S, PARK_AWAY_LEN_S, 0, GRASS_W, GRASS_DEPTH, true),
    ],
  },
];

const wobbles: Wobble[] = [];

/**
 * The gate creaks as he goes through it, the light lowers as they leave the gate, and as the park slides away a thin wind comes
 * up on the emptying wall, and stays through the goodbye.
 */
const cues: Cue[] = [
  { t: PART_S + 0.4, kind: 'sound', sound: 'gate', x: GATE_X, y: 0 },
  { t: GATE_OUT_S, kind: 'mood', mood: 'low', seconds: 9 },
  { t: PARK_AWAY_S + 2, kind: 'bed', bed: 'wind' },
];

export const LAST_ORDINARY_DAY: Chapter = {
  id: 'last-ordinary-day',
  length: LAST_ORDINARY_DAY_LENGTH_S,
  parts: [],
  tracks,
  wobbles,
  cues,
};
