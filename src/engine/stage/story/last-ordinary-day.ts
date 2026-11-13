// Scene 5, "The last ordinary day" (docs/STORY.md): the chapter after the friend's wave. At the school gate the boy waves back,
// as on any day, and they go opposite ways: the boy off the right edge of the wall with his jar, the friend off the left. Just
// before the edge the friend turns back and waves again, but the boy is already gone; the wave hangs there, unanswered, and then
// the friend walks off too. The gate slides away to the right, and the hill slides back in from the left, the wrong way, the
// candle's light cooling and dimming: the hill and the jar from scene 4, with only the boy sitting there. Then the hill slides
// slowly away, until the wall is empty for the first time since the candle was lit. Every time is in seconds from its start.
import { slideKeys, type Chapter } from '../puppet/chapters';
import { swingKeys, type Cue, type Key, type Track, type Wobble } from '../puppet/puppet-scene';
import {
  AUTUMN_TREE_X,
  BOY_GATE_X,
  FRIEND_GATE_X,
  GATE_DEPTH,
  GATE_OFF_DX,
  GATE_X,
  HILL_DEPTH,
  HILL_OFF_DX,
  HILL_X,
  JAR_LAP_DX,
  JAR_LAP_DY,
  LEAVES,
  SIT_BOY_DX,
} from './fireflies';
import { ARM_DOWN, STAND_ARM_DOWN, STAND_ARM_UP, WALK, stepTracks } from './story-kit';

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
/** The gate slides away to the right, and the hill comes back in from the left, with only the boy on it. */
const GATE_OUT_S = TURN_AWAY_S + 2.0;
const GATE_OUT_LEN_S = 4.5;
const HILL_BACK_S = GATE_OUT_S + 1.0;
const HILL_BACK_LEN_S = 5.5;
/** He sits there, alone, and bows his head... */
const BOW_S = HILL_BACK_S + HILL_BACK_LEN_S + 1.5;
/** ...and the hill slides slowly away, leaving the wall empty. */
const HILL_AWAY_S = BOW_S + 4.5;
const HILL_AWAY_LEN_S = 7.0;
export const LAST_ORDINARY_DAY_LENGTH_S = HILL_AWAY_S + HILL_AWAY_LEN_S * 1.1 + 1.2;

/** The jar on the ground beside him, where the friend used to sit. */
const JAR_BESIDE_DX = SIT_BOY_DX - 0.13;

const move = (t0: number, v: number, t1: number, to: number, ease: Key[2] = 'smooth'): Key[] => [
  [t0, v],
  [t1, to, ease],
];
const step = (t: number, to: number): Key => [t, to, 'step'];

const tracks: Track[] = [
  // The boy waves back with his free hand, and the friend's raised hand waves too.
  {
    part: 'walk-boy-arm-back',
    prop: 'angle',
    keys: [
      [WAVE_S, -STAND_ARM_DOWN],
      ...swingKeys(WAVE_S + 0.4, WAVE_S + WAVE_LEN_S - 0.4, 0.8, 0.3, -0.35, -0.35),
      [WAVE_S + WAVE_LEN_S, -STAND_ARM_DOWN, 'smooth'],
    ],
  },
  {
    part: 'walk-friend-back-arm-front',
    prop: 'angle',
    keys: [
      ...swingKeys(WAVE_S, WAVE_S + WAVE_LEN_S - 0.3, 0.9, 0.28, STAND_ARM_UP, STAND_ARM_UP),
      [PART_S, STAND_ARM_DOWN, 'smooth'],
    ],
  },
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
  // The hill comes back from the left: the boy alone on it, the jar on the grass beside him where the friend sat.
  { part: 'hill-boy', prop: 'opacity', keys: [step(HILL_BACK_S - 0.2, 1)] },
  { part: 'hill-friend', prop: 'opacity', keys: [step(HILL_BACK_S - 0.2, 0)] },
  { part: 'hill-jar', prop: 'opacity', keys: [step(HILL_BACK_S - 0.2, 1)] },
  { part: 'hill-jar', prop: 'x', keys: [[HILL_BACK_S - 0.3, JAR_LAP_DX], step(HILL_BACK_S - 0.2, JAR_BESIDE_DX)] },
  { part: 'hill-jar', prop: 'y', keys: [[HILL_BACK_S - 0.3, JAR_LAP_DY], step(HILL_BACK_S - 0.2, 0)] },
  { part: 'hill-boy-arm', prop: 'angle', keys: [[HILL_BACK_S - 0.3, -1.75], step(HILL_BACK_S - 0.2, -ARM_DOWN)] },
  {
    part: 'hill-boy-head',
    prop: 'angle',
    keys: [
      [HILL_BACK_S - 0.3, 0],
      [BOW_S, 0],
      [BOW_S + 1.6, -0.2, 'smooth'],
    ],
  },
  {
    part: 'hill',
    prop: 'x',
    keys: [
      ...slideKeys(HILL_BACK_S, HILL_BACK_LEN_S, HILL_X - HILL_OFF_DX, HILL_X, HILL_DEPTH),
      ...slideKeys(HILL_AWAY_S, HILL_AWAY_LEN_S, HILL_X, HILL_X + HILL_OFF_DX, HILL_DEPTH, true),
    ],
  },
];

const wobbles: Wobble[] = [];

/** The tune thins out: a note as they wave, one as the friend waves alone, one as the hill comes back, then none. */
const cues: Cue[] = [
  { t: WAVE_S, kind: 'note', note: 2 },
  { t: PART_S, kind: 'note', note: 1 },
  { t: WAVE2_S + 0.6, kind: 'note', note: 1 },
  { t: GATE_OUT_S, kind: 'mood', mood: 'low', seconds: 9 },
  { t: HILL_BACK_S + 1, kind: 'note', note: 0 },
];

export const LAST_ORDINARY_DAY: Chapter = {
  id: 'last-ordinary-day',
  length: LAST_ORDINARY_DAY_LENGTH_S,
  parts: [],
  tracks,
  wobbles,
  cues,
};
