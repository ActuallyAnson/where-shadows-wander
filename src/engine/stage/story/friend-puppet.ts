// The friend's hand as the wall shows it (docs/STORY.md, "How a memory starts"): a painted shadow of a child's hand making the
// shape, the way the old shadow-puppet plates draw one, rather than a posed skeleton cast like the player's (whose shadow is
// a hand's bones and reads as a hand, not a rabbit). It forms the shape from a loose hand, holds it, and now and then eases half
// out of it and back, as if showing it again. One small puppet scene per shape, played by time (scene time loops after forming).
import type { Shape } from '../../hands/shapes';
import type { PuppetScene } from '../puppet/puppet-scene';

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
const BACK_EAR_UP = 0.5;
const FRONT_EAR_UP = 0.3;

export const FRIEND_RABBIT: PuppetScene = {
  id: 'friend-rabbit',
  length: FORM_S + CYCLE_S,
  parts: [
    // Placed by the middle of the head: the story's x, y (moved there through the player's offset on this part).
    { id: 'hand', art: '', w: 0.01, h: 0.01, scale: FRIEND_SCALE },
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
    ear('ear-back', -0.05, 0.05, FOX_BACK_EAR_UP, 0.085, 0.036),
    { id: 'head', art: 'friend-fox', parent: 'hand', w: FOX_W, h: FOX_H, pivot: [0.5, 0.5], x: 0, y: 0 },
    ear('ear-front', -0.02, 0.06, FOX_FRONT_EAR_UP, 0.09, 0.036),
  ],
  tracks: [earTrack('ear-back', FOX_BACK_EAR_UP), earTrack('ear-front', FOX_FRONT_EAR_UP)],
};

/** Each shape's friend puppet, as it is built; a shape without one shows no hand yet. */
export const FRIEND_PUPPETS: Partial<Record<Shape, PuppetScene>> = { rabbit: FRIEND_RABBIT, fox: FRIEND_FOX };
