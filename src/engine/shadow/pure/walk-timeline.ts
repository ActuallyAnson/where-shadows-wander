// The timing of a travel scene, as plain functions of time: how the traveller stands, turns and walks, how the land wakes. The scene's view
// (walk-scene-view.ts) asks this each frame; nothing here draws. Two scenes: the ARRIVAL (the traveller turns and walks into a land that
// is still asleep) and the WAKING (the sleeper wakes and the day sweeps out from the lantern).

/** How the arrival goes, in seconds: a moment standing, the quick hop-turn, then the walk. */
export const STAND_S = 0.5;
export const TURN_S = 0.26;
export const WALK_S = 8;
/** How far the road runs, metres, and so how fast the traveller walks. */
export const ROAD_END_M = 18;
export const START_Z = 3;
export const SPEED_MPS = (ROAD_END_M - START_Z - 1) / WALK_S;
export const ARRIVAL_S = STAND_S + TURN_S + WALK_S + 0.4;

/** How the waking goes: a beat of quiet, a flash of gold, then the day spreading out. */
export const WAKE_BEAT_S = 0.6;
export const WAKE_SWEEP_S = 2.4;
export const WAKING_S = WAKE_BEAT_S + WAKE_SWEEP_S + 0.8;

export type TravellerLook = 'stand' | 'hop' | 'turned' | 'walk';

export interface ArrivalState {
  look: TravellerLook;
  /** Where the traveller is along the road, metres. */
  z: number;
  /** How far through the walk, 0 to 1. */
  progress: number;
  /** A little lift in the hop, 0 to 1. */
  hop: number;
  done: boolean;
}

export function createArrivalState(): ArrivalState {
  return { look: 'stand', z: START_Z, progress: 0, hop: 0, done: false };
}

/** The arrival at `t` seconds. */
export function arrivalAt(t: number, out: ArrivalState): ArrivalState {
  const time = t > 0 ? t : 0;
  out.done = time >= ARRIVAL_S;
  if (time < STAND_S) {
    out.look = 'stand';
    out.hop = 0;
    out.z = START_Z;
    out.progress = 0;
  } else if (time < STAND_S + TURN_S) {
    const u = (time - STAND_S) / TURN_S;
    out.look = u < 0.5 ? 'hop' : 'turned';
    out.hop = Math.sin(u * Math.PI);
    out.z = START_Z;
    out.progress = 0;
  } else {
    const w = Math.min(WALK_S, time - STAND_S - TURN_S);
    out.look = w >= WALK_S ? 'turned' : 'walk';
    out.hop = 0;
    out.z = START_Z + SPEED_MPS * w;
    out.progress = w / WALK_S;
  }
  return out;
}

export interface WakingState {
  /** How awake the land is, 0 to 1 (the day's colour, and how far it has spread). */
  wake: number;
  /** A flash of gold at the moment, 0 to 1. */
  flash: number;
  done: boolean;
}

export function createWakingState(): WakingState {
  return { wake: 0, flash: 0, done: false };
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The waking at `t` seconds. */
export function wakingAt(t: number, out: WakingState): WakingState {
  const time = t > 0 ? t : 0;
  out.wake = smooth((time - WAKE_BEAT_S) / WAKE_SWEEP_S);
  const f = (time - WAKE_BEAT_S - 0.2) / 0.5;
  out.flash = Math.exp(-f * f);
  out.done = time >= WAKING_S;
  return out;
}
