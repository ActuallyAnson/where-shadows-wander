// Scene 3, "The park" (docs/STORY.md): the chapter after the friend's fox. The player's fox lands in the fort, crouches and
// pounces at the rabbit on the blanket, and the rabbit bolts. They run, the fox after the rabbit, and the fort slides off to the
// left while the park's trees slide in from the right, the light warming into spring. The animals fade away as the stage turns,
// and the two kids come on from the wall's left edge: the boy first, then the friend, walking right at an easy pace, the
// ground's pace of their stride, side by side but for a step. At the middle he stops, turns round to face her as she comes up,
// and they sit down in the grass and lie back, head to head with their feet together, looking up. The light goes to dusk and the
// stars come out, and a single firefly blinks over them; the friend reaches up towards it: the chapter ends on that, and the
// story holds the picture while the friend's hand shows the cup. Every time is in seconds from the chapter's start.
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
  KID_SCALE,
  STAND_ARM_DOWN,
  WALK,
  fadeKeys,
  firefly,
  fireflyWobbles,
  standingKid,
  stepTracks,
  type Gait,
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
/** Where each lies (the feet: she with her head to the left, he with his to the right, their feet a little apart in the middle). */
export const BOY_LIES_X = 0.18;
export const FRIEND_LIES_X = 0.02;
/** He faces left, so every turn of his body and limbs is the friend's mirrored (the angles' sign). */
export const BOY_FACING = -1;
/** A kid's root (the point under the hips) lying: this far left of the feet, and this high, so the back rests on the grass. */
const HIPS_FROM_FEET = 0.14;
const LIE_Y = FLOOR_Y - 0.075;
/** Sitting on the grass before rolling back: the root that far down puts the bottom on the grass. */
const SIT_Y = FLOOR_Y - 0.12;
/** Where each stops walking, from its feet's lying place: the hips drop a little back as they sit. */
const STOP_FROM_FEET = HIPS_FROM_FEET - 0.03;
/** The animals run on while the stage turns, and fade away when it is nearly done. */
const CHANGE_S = 7.4;
const CHANGE_LEN_S = 0.7;
/**
 * The kids come on at the wall's left edge, the boy first and the friend a moment behind, each fading in as they walk. The walk's
 * gait is the one that carries a kid along the ground at WALK_PACE_M_S with its stance foot standing still on it (a leg is
 * 0.1 * KID_SCALE long, and its stance foot goes back 4 * leg * sin(legs) / stride a second), so their feet never skate.
 */
const WALK_GAIT: Gait = { ...WALK, legs: 0.44 };
export const WALK_PACE_M_S = (4 * 0.1 * KID_SCALE * Math.sin(WALK_GAIT.legs)) / WALK_GAIT.stride;
const BOY_IN_S = CHANGE_S + CHANGE_LEN_S - 0.2;
const KID_FADE_S = 0.8;
export const BOY_START_X = -0.66;
export const FRIEND_START_X = -0.78;
/**
 * Where each stops to sit: the boy a little past the middle, the friend a few steps behind him. (They lie down on the spot:
 * the root moves back a little as they sit, STOP_FROM_FEET to HIPS_FROM_FEET.)
 */
const BOY_STOP_X = BOY_LIES_X + STOP_FROM_FEET;
const FRIEND_STOP_X = FRIEND_LIES_X - STOP_FROM_FEET;
/** He reaches his place first by a little: she reaches hers a tenth of a second after him, a step behind. */
const BOY_ARRIVE_S = BOY_IN_S + (BOY_STOP_X - BOY_START_X) / WALK_PACE_M_S;
const FRIEND_ARRIVE_S = BOY_ARRIVE_S + 0.1;
/** She comes on a moment after him, at the pace that has her at her place as he reaches his. */
const FRIEND_IN_S = FRIEND_ARRIVE_S - (FRIEND_STOP_X - FRIEND_START_X) / WALK_PACE_M_S;
/** He waits a beat for her, then turns round to face her (a quick cross-fade to the kid standing the other way about). */
const TURN_S = BOY_ARRIVE_S + 0.3;
const TURN_LEN_S = 0.3;
/**
 * Then they sit down together where they stand: down onto the bottom, legs stretched out in front, a moment to look up at the sky,
 * and then slowly back onto their backs. He faces her, so he lies the other way about: head to the right, his feet toward hers.
 * Nobody tumbles, slides or tips over stiff as a plank.
 */
const FRIEND_FALL_S = TURN_S + 0.9;
const BOY_FALL_S = FRIEND_FALL_S + 0.3;
/** Down onto the bottom, easing, a beat looking up, then slowly back onto the back, the legs settling down. */
const SIT_LEN_S = 0.9;
const SAT_BEAT_S = 0.6;
const ROLL_LEN_S = 1.8;
const FALL_LEN_S = SIT_LEN_S + SAT_BEAT_S + ROLL_LEN_S;
/** They lie there, giggling softly. */
const LAUGH_S = BOY_FALL_S + FALL_LEN_S + 0.2;
const LAUGH_LEN_S = 3.4;
/** The sky goes to dusk, the stars come out one by one, and a firefly comes and blinks over them. */
const DUSK_S = LAUGH_S + 1.2;
const FIREFLY_S = LAUGH_S + LAUGH_LEN_S + 0.8;
const FIREFLY_LEN_S = 4.2;
export const FIREFLY_HOVER: readonly [number, number] = [-0.25, 0.15];
/** The friend reaches up towards it: the chapter ends with her arm up. */
const REACH_S = FIREFLY_S + FIREFLY_LEN_S + 0.4;
export const THE_PARK_LENGTH_S = REACH_S + 1.4;

/**
 * The stars they lie looking at: small, pale and still (a firefly is a green-gold light that wanders and blinks), high in the sky
 * behind the trees and clear of where the firefly hovers and the friend's cupped hand rises. Scene 4 puts them out at morning.
 */
export const STARS: readonly { x: number; y: number; size: number }[] = [
  { x: -0.66, y: 0.42, size: 0.022 },
  { x: -0.5, y: 0.31, size: 0.016 },
  { x: -0.38, y: 0.46, size: 0.02 },
  { x: -0.12, y: 0.4, size: 0.018 },
  { x: 0.1, y: 0.47, size: 0.024 },
  { x: 0.28, y: 0.41, size: 0.016 },
  { x: 0.46, y: 0.48, size: 0.02 },
  { x: 0.58, y: 0.37, size: 0.018 },
  { x: 0.72, y: 0.45, size: 0.022 },
];
/** A star's light: cool white. */
const STAR_TINT: readonly [number, number, number] = [0.82, 0.9, 1];
/** The stars come out from here, one every so often, each taking a while to come. */
const STARS_S = DUSK_S + 0.6;
const STAR_EVERY_S = 0.5;
const STAR_FADE_S = 2.2;
export const starId = (i: number): string => `star-${i}`;

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
  // The stars, behind the park.
  ...STARS.map((st, i): PuppetPart => ({
    id: starId(i),
    art: 'orb',
    look: 'glow',
    tint: STAR_TINT,
    w: st.size,
    h: st.size,
    x: st.x,
    y: st.y,
    opacity: 0,
  })),
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
  // The two kids, walking on from the left; he turns to face her and they lie down (the lying boy faces left).
  ...standingKid('run-friend', FRIEND_START_X, 1, { opacity: 0, girl: true }),
  ...standingKid('come-boy', BOY_START_X, 1, { opacity: 0 }),
  ...standingKid('run-boy', BOY_STOP_X, BOY_FACING, { opacity: 0 }),
  // The firefly: a small green-gold light (its root holds where it is and whether it is there; the light blinks).
  ...firefly('firefly', 0.5, 0.32),
];

/** Lying back: the torso a quarter turn back from upright, the legs a quarter turn forward from hanging down. */
const ROLL_BACK = Math.PI / 2;
/** A lying kid's arm resting by its side (a little off the body). */
export const LYING_ARM = -STAND_ARM_DOWN + 0.4;

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
  // The kids walk on from the left, fading in as they come: the boy first, then the friend a step behind him.
  {
    part: 'come-boy',
    prop: 'opacity',
    keys: [...fadeKeys(BOY_IN_S, KID_FADE_S, 0, 1), ...fadeKeys(TURN_S, TURN_LEN_S, 1, 0)],
  },
  { part: 'run-boy', prop: 'opacity', keys: fadeKeys(TURN_S, TURN_LEN_S, 0, 1) },
  { part: 'run-friend', prop: 'opacity', keys: fadeKeys(FRIEND_IN_S, KID_FADE_S, 0, 1) },
  ...stepTracks('come-boy', 1, BOY_IN_S, BOY_ARRIVE_S, WALK_GAIT),
  // Her front arm swings with the walk, and rests when she stops.
  ...stepTracks('run-friend', 1, FRIEND_IN_S, FRIEND_ARRIVE_S, WALK_GAIT, { girl: true, armsBusy: 'front' }),
  // At a steady pace, so the feet stay on the ground (the keys are straight lines).
  {
    part: 'come-boy',
    prop: 'x',
    keys: [
      [BOY_IN_S, BOY_START_X],
      [BOY_ARRIVE_S, BOY_STOP_X],
    ],
  },
  {
    part: 'run-friend',
    prop: 'x',
    keys: [
      [FRIEND_IN_S, FRIEND_START_X],
      [FRIEND_ARRIVE_S, FRIEND_STOP_X],
      // She sits down where she stands, her root moving back a little as she does.
      [FRIEND_FALL_S, FRIEND_STOP_X],
      [FRIEND_FALL_S + SIT_LEN_S, FRIEND_LIES_X - HIPS_FROM_FEET, 'out'],
    ],
  },
  {
    part: 'run-boy',
    prop: 'x',
    keys: [
      [TURN_S, BOY_STOP_X],
      [BOY_FALL_S, BOY_STOP_X],
      [BOY_FALL_S + SIT_LEN_S, BOY_LIES_X + HIPS_FROM_FEET, 'out'],
    ],
  },
  {
    part: 'run-friend-arm-front',
    prop: 'angle',
    keys: [
      ...swingKeys(FRIEND_IN_S, FRIEND_ARRIVE_S, WALK_GAIT.stride, WALK_GAIT.arms, -STAND_ARM_DOWN, -STAND_ARM_DOWN, 1),
      // Sitting, her arms come in to lean back on, and settle by her side as she lies back.
      [FRIEND_FALL_S, -STAND_ARM_DOWN],
      [FRIEND_FALL_S + SIT_LEN_S, -2.1, 'smooth'],
      [FRIEND_FALL_S + FALL_LEN_S, LYING_ARM, 'smooth'],
      // Lying on her back, she reaches up to the firefly (her body turned a quarter, so straight up is a quarter clockwise).
      [REACH_S, LYING_ARM],
      [REACH_S + 1.0, -1.45, 'smooth'],
    ],
  },
  // Down they go: onto their bottoms, then slowly back onto their backs, side by side. Their heads tip back to the sky, and a
  // couple of slow, small heaves as they giggle, not a shake.
  ...fallTracks('run-friend', FRIEND_FALL_S, LAUGH_S + 0.25, 1),
  ...fallTracks('run-boy', BOY_FALL_S, LAUGH_S, BOY_FACING),
  // His arms come in to lean back on as he sits, and settle by his sides as he lies back (turned the other way about).
  ...(['front', 'back'] as const).map((side): Track => ({
    part: `run-boy-arm-${side}`,
    prop: 'angle',
    keys: [
      [BOY_FALL_S, -STAND_ARM_DOWN * BOY_FACING],
      [BOY_FALL_S + SIT_LEN_S, (side === 'front' ? -2.1 : -2.3) * BOY_FACING, 'smooth'],
      [BOY_FALL_S + FALL_LEN_S, LYING_ARM * BOY_FACING, 'smooth'],
    ],
  })),
  { part: 'run-boy-head', prop: 'angle', keys: gazeHead(BOY_FALL_S, LAUGH_S, BOY_FACING) },
  { part: 'run-friend-head', prop: 'angle', keys: gazeHead(FRIEND_FALL_S, LAUGH_S + 0.15, 1) },
  // The stars come out as it darkens.
  ...STARS.map((st, i): Track => ({
    part: starId(i),
    prop: 'opacity',
    keys: fadeKeys(STARS_S + i * STAR_EVERY_S, STAR_FADE_S, 0, 0.85),
  })),
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
      [FIREFLY_S + 1.5, ROLL_BACK * BOY_FACING],
      [FIREFLY_S + 2.5, (ROLL_BACK - 0.12) * BOY_FACING, 'smooth'],
    ],
  },
];

/**
 * A kid stopping and lying down from `t0`, giggling from `laughAt`: easing down onto the bottom, the legs stretched out in front
 * (the root drops), a beat, then the torso leaning slowly back onto the grass while the legs settle. The root's x is in the
 * kid's own x track. `f` is the way the kid faces (1 right, -1 left): a kid facing left lies the other way about, so every turn
 * of its body and legs has the opposite sign.
 */
function fallTracks(id: string, t0: number, laughAt: number, f: 1 | -1): Track[] {
  const sat = t0 + SIT_LEN_S;
  const rolls = sat + SAT_BEAT_S;
  const down = rolls + ROLL_LEN_S;
  const legs = (side: 'front' | 'back'): Track => ({
    part: `${id}-leg-${side}`,
    prop: 'angle',
    keys: [
      [t0, 0],
      [sat, (ROLL_BACK - 0.12) * f, 'smooth'],
      [rolls, (ROLL_BACK - 0.12) * f],
      [down, ROLL_BACK * f, 'smooth'],
    ],
  });
  return [
    legs('back'),
    legs('front'),
    {
      part: `${id}-torso`,
      prop: 'angle',
      keys: [
        [t0, 0],
        // Sitting down, the body settles a little forward...
        [sat, -0.08 * f, 'smooth'],
        [rolls, -0.08 * f],
        // ...then it leans slowly back, down onto the grass.
        [down, ROLL_BACK * f, 'smooth'],
      ],
    },
    {
      part: id,
      prop: 'y',
      keys: [[t0, FLOOR_Y], [sat, SIT_Y, 'smooth'], [rolls, SIT_Y], [down, LIE_Y, 'smooth'], ...laughKeys(laughAt)],
    },
  ];
}

/** A lying kid laughing: two slow heaves up off the grass, settling back. */
function laughKeys(t0: number): Key[] {
  return bobKeys(t0, t0 + 1.8, 0.9, LIE_Y, 0.005);
}

/**
 * A kid's head: tipping back to look at the sky as it sits and lies down from `t0` (facing right, back is counter-clockwise; `f`
 * mirrors it for a kid facing left), tipping back a little more as it giggles from `laughAt`, and forward again.
 */
function gazeHead(t0: number, laughAt: number, f: 1 | -1): Key[] {
  const gaze = t0 + SIT_LEN_S;
  return [
    [t0, 0],
    [gaze + SAT_BEAT_S + ROLL_LEN_S, 0.18 * f, 'smooth'],
    [laughAt, 0.18 * f],
    [laughAt + 0.4, 0.28 * f, 'out'],
    [laughAt + LAUGH_LEN_S, 0.28 * f],
    [laughAt + LAUGH_LEN_S + 0.8, 0, 'smooth'],
  ];
}

const wobbles: Wobble[] = [
  // The firefly hovers and blinks; the trees stir.
  ...fireflyWobbles('firefly', 0),
  // The stars twinkle, softly and each in its own time.
  ...STARS.map((_, i): Wobble => ({
    part: starId(i),
    prop: 'scale',
    amp: 0.18,
    period: 2.6 + 0.43 * (i % 5),
    phase: i * 1.7,
  })),
  ...PARK_TREES.map((t, i): Wobble => ({ part: t.id, prop: 'angle', amp: 0.006, period: 4.1 + i * 0.7, phase: i })),
];

/**
 * The fort slides off and the park slides in, each with a dry slide of card; birdsong comes in with the park and the light warms,
 * and at dusk the crickets take over from the birds, and stay into scene 4.
 */
const cues: Cue[] = [
  { t: SLIDE_OUT_S, kind: 'sound', sound: 'slide', x: -0.4, y: 0 },
  { t: PARK_IN_S, kind: 'sound', sound: 'slide', x: 0.4, y: 0 },
  { t: PARK_IN_S, kind: 'mood', mood: 'warm', seconds: 4 },
  { t: PARK_IN_S + 1, kind: 'bed', bed: 'birds' },
  // They laugh, lying in the grass: the sound that is missing from the later scenes.
  { t: LAUGH_S, kind: 'sound', sound: 'laugh', x: (FRIEND_LIES_X + BOY_LIES_X) / 2, y: FLOOR_Y },
  { t: DUSK_S, kind: 'mood', mood: 'dusk', seconds: 6 },
  { t: DUSK_S + 1, kind: 'bed', bed: 'crickets' },
];

export const THE_PARK: Chapter = { id: 'the-park', length: THE_PARK_LENGTH_S, parts, tracks, wobbles, cues };
