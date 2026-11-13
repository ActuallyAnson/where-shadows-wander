// The story's stock puppets and moves (docs/STORY.md): the two kids sitting (scene 2's fort, scene 4's hill) and standing (running
// in the park, walking to school), and the keys that make them walk, run and hop. Every memory builds its kids from here, so the
// boy and the friend look the same in all of them. Plain data, built on load.
import { bobKeys, swingKeys, type Key, type PuppetPart, type Track, type Wobble } from '../puppet/puppet-scene';

/** The floor of the story's places, metres up the wall from its centre (above the panelling's rail). */
export const FLOOR_Y = -0.12;
/** The kids' size: their parts are drawn at 1 and scaled up together by this (1 is about 23 cm sitting). */
export const KID_SCALE = 1.4;

/** A sitting kid's arm rests down along its side at this angle, and is raised to the other (times -facing). */
export const ARM_DOWN = 2.7;
export const ARM_UP = 0.62;
/** A sitting kid's shoulder on its body (unscaled; x towards where the kid faces), its arm's length, and its hand along it. */
export const SHOULDER: readonly [number, number] = [0.016, 0.112];
export const ARM_LEN = 0.085;
const HAND_ALONG = 0.86;

/** Where a sitting kid's raised hand is on the wall: what a rabbit sits on. */
export function handAt(x: number, facing: 1 | -1, floor = FLOOR_Y): [number, number] {
  const reach = ARM_LEN * (HAND_ALONG - 0.06);
  return [
    x + KID_SCALE * facing * (SHOULDER[0] + Math.sin(ARM_UP) * reach),
    floor + KID_SCALE * (SHOULDER[1] + Math.cos(ARM_UP) * reach),
  ];
}

export interface KidOptions {
  /** The part it hangs from (it slides with it). */
  readonly parent?: string;
  /** Its feet's height (relative to the parent, if any). Default FLOOR_Y, or 0 with a parent. */
  readonly y?: number;
  /** Its opacity at rest (0: it is brought on by a track). Default 1. */
  readonly opacity?: number;
  /** Whether its arm is raised at rest. */
  readonly armUp?: boolean;
}

/**
 * A kid sitting with knees up, side on, facing right (1) or left (-1): `id` (an invisible root at its seat), `id-body`,
 * `id-head` and `id-arm`.
 */
export function sittingKid(id: string, x: number, facing: 1 | -1, o: KidOptions = {}): PuppetPart[] {
  return [
    {
      id,
      art: '',
      parent: o.parent,
      w: 1,
      h: 1,
      x,
      y: o.y ?? (o.parent ? 0 : FLOOR_Y),
      scale: KID_SCALE,
      opacity: o.opacity,
      depth: 0,
    },
    { id: `${id}-body`, art: 'kid', parent: id, w: 0.13, h: 0.15, pivot: [0.5, 0], mirror: facing < 0 },
    {
      id: `${id}-head`,
      art: 'kid-head',
      parent: `${id}-body`,
      w: 0.08,
      h: 0.08,
      pivot: [0.5, 0.12],
      x: 0.012 * facing,
      y: 0.135,
      mirror: facing < 0,
    },
    {
      id: `${id}-arm`,
      art: 'arm',
      parent: `${id}-body`,
      w: 0.02,
      h: ARM_LEN,
      pivot: [0.5, 0.06],
      x: SHOULDER[0] * facing,
      y: SHOULDER[1],
      angle: (o.armUp ? -ARM_UP : -ARM_DOWN) * facing,
      mirror: facing < 0,
    },
  ];
}

/** A standing kid's measurements, unscaled: legs from the hip, the torso above, the shoulder on it, and its whole height. */
const LEG_H = 0.1;
const TORSO_H = 0.1;
const STAND_SHOULDER_Y = 0.088;
/** How tall a standing kid is on the stage (feet to the top of its head), metres. */
export const STANDING_H = KID_SCALE * (LEG_H + TORSO_H + 0.075);
/** A standing kid's arm down along its side, and raised up and forward, clear of his head (both times -facing, like the sitting kid's). */
export const STAND_ARM_DOWN = 2.95;
export const STAND_ARM_UP = 0.8;
/** How far a lying kid's root (its feet) is lifted so its back rests on the ground and does not sink into it. */
export const LYING_LIFT = 0.045;

/**
 * A kid standing, side on, facing right (1) or left (-1): `id` (an invisible root at its feet, which it turns about to lie down),
 * `id-leg-back`, `id-leg-front`, `id-torso`, `id-head`, `id-arm-back` and `id-arm-front`.
 */
export function standingKid(id: string, x: number, facing: 1 | -1, o: KidOptions = {}): PuppetPart[] {
  const m = facing < 0;
  const arm = (side: 'back' | 'front', dx: number): PuppetPart => ({
    id: `${id}-arm-${side}`,
    art: 'arm',
    parent: `${id}-torso`,
    w: 0.02,
    h: 0.082,
    pivot: [0.5, 0.06],
    x: dx * facing,
    y: STAND_SHOULDER_Y,
    angle: (o.armUp && side === 'front' ? -STAND_ARM_UP : -STAND_ARM_DOWN) * facing,
    mirror: m,
  });
  const leg = (side: 'back' | 'front', dx: number): PuppetPart => ({
    id: `${id}-leg-${side}`,
    art: 'leg',
    parent: id,
    w: 0.028,
    h: LEG_H,
    pivot: [0.5, 1],
    x: dx * facing,
    y: LEG_H,
    mirror: m,
  });
  return [
    {
      id,
      art: '',
      parent: o.parent,
      w: 1,
      h: 1,
      x,
      y: o.y ?? (o.parent ? 0 : FLOOR_Y),
      scale: KID_SCALE,
      opacity: o.opacity,
      depth: 0,
    },
    // The far arm and leg first, so the body draws over them.
    leg('back', -0.006),
    {
      id: `${id}-torso`,
      art: 'kid-torso',
      parent: id,
      w: 0.075,
      h: TORSO_H,
      pivot: [0.5, 0],
      y: LEG_H - 0.012,
      mirror: m,
    },
    arm('back', -0.004),
    leg('front', 0.006),
    {
      id: `${id}-head`,
      art: 'kid-head',
      parent: `${id}-torso`,
      w: 0.08,
      h: 0.08,
      pivot: [0.5, 0.12],
      x: 0.008 * facing,
      y: TORSO_H - 0.006,
      mirror: m,
    },
    arm('front', 0.004),
  ];
}

/** How a kid moves its legs: a walk's easy stride, or a run's long one with the arms pumping. */
export interface Gait {
  /** Seconds a full stride takes (two steps). */
  readonly stride: number;
  /** How far each leg swings either side, radians. */
  readonly legs: number;
  /** How far the arms swing, radians either side of down. */
  readonly arms: number;
  /** How high the body lifts at each step, stage metres. */
  readonly lift: number;
}

export const WALK: Gait = { stride: 0.9, legs: 0.32, arms: 0.3, lift: 0.006 };
export const RUN: Gait = { stride: 0.46, legs: 0.6, arms: 0.75, lift: 0.02 };

export interface StepOptions {
  /** The feet's height to bob from. Default FLOOR_Y. */
  readonly y?: number;
  /** Leave its arms alone (they are doing something else: waving, carrying). */
  readonly armsBusy?: boolean | 'front' | 'back';
}

/**
 * Tracks that step a standing kid's legs (and arms, and a bob) from `t0` to `t1` with `gait`, settling them back to rest at the
 * end. The kid's x is moved by its own track; this is only the stepping.
 */
export function stepTracks(
  id: string,
  facing: 1 | -1,
  t0: number,
  t1: number,
  gait: Gait,
  o: StepOptions = {},
): Track[] {
  const y = o.y ?? FLOOR_Y;
  const down = -STAND_ARM_DOWN * facing;
  const tracks: Track[] = [
    { part: `${id}-leg-back`, prop: 'angle', keys: swingKeys(t0, t1, gait.stride, gait.legs, 0, 0, 1) },
    { part: `${id}-leg-front`, prop: 'angle', keys: swingKeys(t0, t1, gait.stride, gait.legs, 0, 0, -1) },
    { part: id, prop: 'y', keys: bobKeys(t0, t1, gait.stride / 2, y, gait.lift) },
  ];
  // The arms swing against the legs: the back arm with the front leg.
  if (o.armsBusy !== true && o.armsBusy !== 'back')
    tracks.push({
      part: `${id}-arm-back`,
      prop: 'angle',
      keys: swingKeys(t0, t1, gait.stride, gait.arms, down, down, -1),
    });
  if (o.armsBusy !== true && o.armsBusy !== 'front')
    tracks.push({
      part: `${id}-arm-front`,
      prop: 'angle',
      keys: swingKeys(t0, t1, gait.stride, gait.arms, down, down, 1),
    });
  return tracks;
}

/** Hops from `from` to `to`, `n` of them of `hop` seconds each, starting at `t0`: the x keys and the y keys (a lift at each). */
export function hops(
  t0: number,
  n: number,
  hop: number,
  from: readonly [number, number],
  to: readonly [number, number],
  lift: number,
): { x: Key[]; y: Key[] } {
  const x: Key[] = [[t0, from[0]]];
  const y: Key[] = [[t0, from[1]]];
  for (let i = 1; i <= n; i++) {
    const t = t0 + i * hop;
    const k = i / n;
    x.push([t, from[0] + (to[0] - from[0]) * k, 'smooth']);
    const base = from[1] + (to[1] - from[1]) * k;
    y.push([t - hop / 2, base + lift, 'out']);
    y.push([t, base, 'in']);
  }
  return { x, y };
}

/** Keys that bring a part's opacity from `from` to `to` over `seconds` starting at `t0` (a cross-fade's half). */
export function fadeKeys(t0: number, seconds: number, from: number, to: number): Key[] {
  return [
    [t0, from],
    [t0 + seconds, to, 'smooth'],
  ];
}

/** A firefly's colour: green-gold. */
export const FIREFLY_TINT: readonly [number, number, number] = [0.85, 1, 0.45];

/**
 * A firefly: `id`, an invisible root that holds where it is and whether it is there (opacity 0 at rest), and `id-glow`, its
 * light, which blinks and hovers (fireflyWobbles). A wobble adds to a value, so the blink is on the light, never on the root.
 */
export function firefly(id: string, x: number, y: number, size = 0.07): PuppetPart[] {
  return [
    { id, art: '', w: 0.01, h: 0.01, x, y, opacity: 0 },
    { id: `${id}-glow`, art: 'orb', look: 'glow', tint: FIREFLY_TINT, parent: id, w: size, h: size, opacity: 0.7 },
  ];
}

/** A firefly's blink and hover, `seed` setting it apart from the others. */
export function fireflyWobbles(id: string, seed: number): Wobble[] {
  return [
    { part: `${id}-glow`, prop: 'opacity', amp: 0.3, period: 1.7 + 0.37 * (seed % 5), phase: seed * 1.3 },
    { part: `${id}-glow`, prop: 'x', amp: 0.012, period: 2.5 + 0.31 * (seed % 4), phase: seed * 0.7 },
    { part: `${id}-glow`, prop: 'y', amp: 0.01, period: 2.0 + 0.29 * (seed % 3), phase: 1 + seed },
  ];
}
