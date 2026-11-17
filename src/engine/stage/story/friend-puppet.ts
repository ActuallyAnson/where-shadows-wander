// The friend's hand as the wall shows it (docs/STORY.md, "How a memory starts"): a painted shadow of a child's hand making the
// shape, the way the old shadow-puppet plates draw one, rather than a posed skeleton cast like the player's (whose shadow is
// a hand's bones and reads as a hand, not a rabbit). It forms the shape from a loose hand, holds it, and now and then eases half
// out of it and back, as if showing it again. One small puppet scene per shape, played by time (scene time loops after forming).
import { swingKeys, type PuppetScene } from '../puppet/puppet-scene';

/** Seconds to form the shape, then the length of each showing-again cycle: held, eased half out over LOOSEN_S, back over REFORM_S. */
export const FORM_S = 1.4;
export const CYCLE_S = 5.5;
const LOOSEN_S = 0.7;
const REFORM_S = 0.9;
const HOLD_S = CYCLE_S - LOOSEN_S - REFORM_S;

/** Scene time for `t` seconds after the hand appeared: the forming once, then the cycle over and over. */
export function friendSceneTime(t: number): number {
  return t < FORM_S ? Math.max(t, 0) : FORM_S + ((t - FORM_S) % CYCLE_S);
}

/** How big the friend's hands are drawn: a little bigger than the player's hand's shadow, so they read from the bed. */
const FRIEND_SCALE = 1.35;

/**
 * The rest of her arm: a child's forearm going on down from the painted one, long enough to run off the bottom of the wall
 * wherever the hand waits, so the hand is always held up from below, like a real hand's shadow, and never floats. `x`, `y` is
 * where it joins the painted forearm (a little up inside it, so the join does not show) and `tilt` the radians it leans,
 * its foot to the left. Drawn first, under the hand.
 */
export const ARM_LENGTH = 0.8;
const ARM_W = 0.09;
function arm(x: number, y: number, tilt: number): PuppetScene['parts'][number] {
  return { id: 'arm', art: 'friend-arm', parent: 'hand', w: ARM_W, h: ARM_LENGTH, pivot: [0.5, 1], x, y, angle: -tilt };
}

/** The rabbit: the hand (head, muzzle, forearm) and two finger ears that rise from folded as it forms, and droop a little. */
const RABBIT_W = 0.24;
const RABBIT_H = 0.26;
/** Ear angles: folded forward over the head (a loose hand), standing and leaning back, and the droop when showing again. */
const EAR_FOLDED = -1.5;
const EAR_DROOP = 0.45;
function ear(id: string, x: number, y: number, up: number, len: number, w = 0.042): PuppetScene['parts'][number] {
  return { id, art: 'friend-ear', parent: 'hand', w, h: len, pivot: [0.5, 0.05], x, y, angle: up };
}
function earTrack(id: string, up: number): PuppetScene['tracks'][number] {
  const droop = up + (EAR_FOLDED - up) * EAR_DROOP;
  const c = FORM_S + HOLD_S;
  return {
    part: id,
    prop: 'angle',
    keys: [
      [0, EAR_FOLDED],
      [FORM_S, up, 'smooth'],
      [c, up],
      [c + LOOSEN_S, droop, 'smooth'],
      [c + LOOSEN_S + REFORM_S, up, 'smooth'],
    ],
  };
}
/** Like earTrack, for a finger that forms from `from` (not folded over the head) to `up`. */
function earTrackFrom(id: string, from: number, up: number): PuppetScene['tracks'][number] {
  const droop = up + (from - up) * EAR_DROOP;
  const c = FORM_S + HOLD_S;
  return {
    part: id,
    prop: 'angle',
    keys: [
      [0, from],
      [FORM_S, up, 'smooth'],
      [c, up],
      [c + LOOSEN_S, droop, 'smooth'],
      [c + LOOSEN_S + REFORM_S, up, 'smooth'],
    ],
  };
}
const BACK_EAR_UP = 0.5;
const FRONT_EAR_UP = 0.3;

export const FRIEND_RABBIT: PuppetScene = {
  id: 'friend-rabbit',
  length: FORM_S + CYCLE_S,
  parts: [
    // Placed by the middle of the head: the story's x, y (moved there through the player's offset on this part).
    { id: 'hand', art: '', w: 0.01, h: 0.01, scale: FRIEND_SCALE },
    arm(-0.067, -0.102, 0.33),
    // The back ear first, so the front one draws over it.
    ear('ear-back', -0.03, 0.07, BACK_EAR_UP, 0.13),
    { id: 'head', art: 'friend-rabbit', parent: 'hand', w: RABBIT_W, h: RABBIT_H, pivot: [0.5, 0.5], x: 0, y: 0 },
    ear('ear-front', 0.0, 0.065, FRONT_EAR_UP, 0.15),
  ],
  tracks: [earTrack('ear-back', BACK_EAR_UP), earTrack('ear-front', FRONT_EAR_UP)],
};

/** The fox: the hand (head, the long snout of two fingers and the thumb, forearm) and two short pointed finger ears. */
const FOX_W = 0.28;
const FOX_H = 0.24;
const FOX_BACK_EAR_UP = 0.32;
const FOX_FRONT_EAR_UP = 0.08;

export const FRIEND_FOX: PuppetScene = {
  id: 'friend-fox',
  length: FORM_S + CYCLE_S,
  parts: [
    { id: 'hand', art: '', w: 0.01, h: 0.01, scale: FRIEND_SCALE },
    arm(-0.081, -0.092, 0.37),
    ear('ear-back', -0.05, 0.05, FOX_BACK_EAR_UP, 0.085, 0.036),
    { id: 'head', art: 'friend-fox', parent: 'hand', w: FOX_W, h: FOX_H, pivot: [0.5, 0.5], x: 0, y: 0 },
    ear('ear-front', -0.02, 0.06, FOX_FRONT_EAR_UP, 0.09, 0.036),
  ],
  tracks: [earTrack('ear-back', FOX_BACK_EAR_UP), earTrack('ear-front', FOX_FRONT_EAR_UP)],
};

/** The cup: a hand held palm up, the thumb standing at one side and the fingers curling up at the other to make a hollow. */
const CUP_W = 0.26;
const CUP_H = 0.2;
/** The fingers' angle: laid out flat forward (an open hand), and curled up into the cup's far wall. */
const CUP_FINGERS_FLAT = -1.5;
const CUP_FINGERS_UP = -0.25;

export const FRIEND_CUP: PuppetScene = {
  id: 'friend-cup',
  length: FORM_S + CYCLE_S,
  parts: [
    { id: 'hand', art: '', w: 0.01, h: 0.01, scale: FRIEND_SCALE },
    arm(-0.074, -0.08, 0.6),
    { id: 'palm', art: 'friend-cup', parent: 'hand', w: CUP_W, h: CUP_H, pivot: [0.5, 0.5], x: 0, y: 0 },
    ear('fingers', 0.075, -0.003, CUP_FINGERS_UP, 0.075, 0.05),
  ],
  tracks: [earTrackFrom('fingers', CUP_FINGERS_FLAT, CUP_FINGERS_UP)],
};

/** The flat hand held up: the palm and fingers together, the thumb easing out from its side as it opens. */
const PALM_W = 0.2;
const PALM_H = 0.3;
/** Where the palm's bottom edge is, below the wrist the hand is placed by. */
const PALM_Y = -0.1;
const THUMB_IN = 0.15;
const THUMB_OUT = 0.85;
const palmParts = (): PuppetScene['parts'] => [
  // Placed by its wrist: the hand rises above the story's x, y.
  { id: 'hand', art: '', w: 0.01, h: 0.01, scale: FRIEND_SCALE },
  arm(0, -0.075, 0.1),
  { id: 'palm', art: 'friend-palm', parent: 'hand', w: PALM_W, h: PALM_H, pivot: [0.5, 0], x: 0, y: PALM_Y },
  ear('thumb', -0.045, 0.045, THUMB_OUT, 0.075, 0.045),
];

/** The flat hand, held up still: it opens, and now and then the fingers ease a little and straighten again. */
export const FRIEND_FLAT: PuppetScene = {
  id: 'friend-flat',
  length: FORM_S + CYCLE_S,
  parts: palmParts().map((p) => (p.id === 'thumb' ? { ...p, parent: 'palm', y: 0.12 } : p)),
  tracks: [
    earTrackFrom('thumb', THUMB_IN, THUMB_OUT),
    {
      part: 'palm',
      prop: 'angle',
      keys: [
        [0, 0.12],
        [FORM_S, 0, 'smooth'],
        [FORM_S + HOLD_S, 0],
        [FORM_S + HOLD_S + LOOSEN_S, 0.04, 'smooth'],
        [FORM_S + CYCLE_S, 0, 'smooth'],
      ],
    },
  ],
};

/** The flat hand waving: it opens, waves side to side from the wrist a few times, rests, and waves again. */
const WAVE_SWING = 0.28;
const WAVE_PERIOD_S = 1.1;
/**
 * As the waving hand goes down (or comes up) its palm turns about the wrist, the fingers leaning away from the middle of the wall
 * like a hand let go of, not held upright all the way down: this many radians at the bottom, eased by how far down it is
 * (story-director's friendLower).
 */
export const WAVE_LOWER_TURN = 0.95;
export const FRIEND_WAVE: PuppetScene = {
  id: 'friend-wave',
  length: FORM_S + CYCLE_S,
  parts: palmParts().map((p) => (p.id === 'thumb' ? { ...p, parent: 'palm', y: 0.12 } : p)),
  tracks: [
    earTrackFrom('thumb', THUMB_IN, THUMB_OUT),
    { part: 'palm', prop: 'angle', keys: swingKeys(FORM_S, FORM_S + 3 * WAVE_PERIOD_S, WAVE_PERIOD_S, WAVE_SWING) },
  ],
};

/** Each friend puppet by name (FriendBeat.puppet, or the shape's own name); a shape without one shows no hand yet. */
export const FRIEND_PUPPETS: Readonly<Record<string, PuppetScene>> = {
  rabbit: FRIEND_RABBIT,
  fox: FRIEND_FOX,
  cup: FRIEND_CUP,
  flat: FRIEND_FLAT,
  wave: FRIEND_WAVE,
};

/**
 * The shape guide's outline of each shape (shape-guide.ts, ghost-outline.ts): not her painted hand, which is a shadow-puppet
 * plate and hard to copy, but the plainest hand that makes the shape as it is recognised (shape-ranges.ts), the hand alone.
 * Rabbit: a V. Fox: a flat hand side on, thumb up. Cup: palm up, cupped. Flat: a flat hand held up. A shape without one has no
 * outline of its own (her hand's is used).
 */
function outline(shape: string, w: number, h: number): PuppetScene {
  return {
    id: `outline-${shape}`,
    length: 1,
    parts: [
      { id: 'hand', art: '', w: 0.01, h: 0.01, scale: FRIEND_SCALE },
      { id: 'shape', art: `outline-${shape}`, parent: 'hand', w, h },
    ],
    tracks: [],
  };
}
export const OUTLINE_SHAPES: Readonly<Record<string, PuppetScene>> = {
  rabbit: outline('rabbit', 0.17, 0.28),
  fox: outline('fox', 0.3, 0.18),
  cup: outline('cup', 0.26, 0.2),
  flat: outline('flat', 0.2, 0.3),
};

/**
 * How far above the place of her flat hand (its wrist) the middle of its palm is drawn, stage metres: where the flat outline,
 * which is drawn about its middle, stands to lie round her palm (scene 6).
 */
export const FLAT_PALM_MID_Y = (PALM_Y + PALM_H / 2) * FRIEND_SCALE;
