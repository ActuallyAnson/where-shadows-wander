// Dev only. Sets where the IWER emulator's headset and hands are, for the Hand Lab's Steps tab: a reset that works, and a
// step that sits the player at the candle with the right hand's match over the wick.
//
// The emulator's own reset (its panel's "Reset device transforms") moves its gizmos back but not the headset's position: it
// leaves the panel's remembered camera position as it was, and the next frame puts the headset back there. Here the pose is
// set on the device itself, then the control mode is turned programmatic and back so the panel reads it from the device
// (its syncFromDevice), the same way useEmulatorHands makes it read the input mode.
import type { Handedness } from '../engine/hands/hand';
import type { EmulatedDeviceLike } from './emulator-hands';

export type Vec3 = [number, number, number];
/** A quaternion as [x, y, z, w]. */
export type Quat = [number, number, number, number];

export interface Pose {
  position: Vec3;
  quaternion: Quat;
}

interface Vec3Like {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): unknown;
}
interface QuatLike {
  x: number;
  y: number;
  z: number;
  w: number;
  set(x: number, y: number, z: number, w: number): unknown;
}
interface TrackedLike {
  position: Vec3Like;
  quaternion: QuatLike;
}

/** The parts of IWER's XRDevice (and, if it is there, its panel) this uses. */
export interface EmulatedRigLike extends EmulatedDeviceLike {
  position: Vec3Like;
  quaternion: QuatLike;
  hands: Partial<Record<Handedness, TrackedLike>>;
  controllers: Partial<Record<Handedness, TrackedLike>>;
  notifyStateChange?(): void;
  /** The panel: its defaults are read from here when it has them (a pose saved with its "save pose" button). */
  devui?: unknown;
}

/** What the emulator starts with when nothing else says: IWER's default headset pose. */
const IWER_HEAD: Pose = { position: [0, 1.6, 0], quaternion: [0, 0, 0, 1] };

// ---- Small rigid-transform math (no three.js, so it tests in Node) ----

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatInvert(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

export function rotate(q: Quat, v: ArrayLike<number>): Vec3 {
  const [qx, qy, qz, qw] = q;
  const [x, y, z] = [v[0], v[1], v[2]];
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
}

/** The orientation of eyes at `from` looking at `to` (looking down -Z, no roll). */
export function lookAt(from: ArrayLike<number>, to: ArrayLike<number>): Quat {
  const dx = to[0] - from[0],
    dy = to[1] - from[1],
    dz = to[2] - from[2];
  const yaw = Math.atan2(-dx, -dz);
  const pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const qYaw: Quat = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  const qPitch: Quat = [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)];
  return quatMultiply(qYaw, qPitch);
}

/**
 * The transform from the game's world to the emulator's own space, found from the one thing both know: the head. The game's
 * world can sit offset or turned from the emulator's (the reference space is taken where the headset was at session start).
 */
export class GameToDevice {
  private q: Quat = [0, 0, 0, 1];
  private p: Vec3 = [0, 0, 0];

  /** `game`: the head as the game's camera has it; `device`: the same head as the emulator has it. */
  set(game: Pose, device: Pose): void {
    this.q = quatMultiply(device.quaternion, quatInvert(game.quaternion));
    const r = rotate(this.q, game.position);
    this.p = [device.position[0] - r[0], device.position[1] - r[1], device.position[2] - r[2]];
  }

  point(v: ArrayLike<number>): Vec3 {
    const r = rotate(this.q, v);
    return [r[0] + this.p[0], r[1] + this.p[1], r[2] + this.p[2]];
  }

  direction(v: ArrayLike<number>): Vec3 {
    return rotate(this.q, v);
  }

  orientation(q: Quat): Quat {
    return quatMultiply(this.q, q);
  }
}

// ---- The device ----

function readPose(t: TrackedLike): Pose {
  return {
    position: [t.position.x, t.position.y, t.position.z],
    quaternion: [t.quaternion.x, t.quaternion.y, t.quaternion.z, t.quaternion.w],
  };
}

function writePose(t: TrackedLike, p: Pose): void {
  t.position.set(p.position[0], p.position[1], p.position[2]);
  t.quaternion.set(p.quaternion[0], p.quaternion[1], p.quaternion[2], p.quaternion[3]);
}

export function headPose(device: EmulatedRigLike): Pose {
  return readPose(device);
}

export function handPose(device: EmulatedRigLike, side: Handedness): Pose | null {
  const h = device.hands[side];
  return h ? readPose(h) : null;
}

/**
 * Sets the headset's and hands' poses (in the emulator's space) and makes its panel follow them. Without the panel
 * following, its next frame would write its own gizmos' poses back over these.
 */
export function setEmulatorPose(
  device: EmulatedRigLike,
  head: Pose | null,
  hands: Partial<Record<Handedness, Pose>>,
): void {
  if (head) writePose(device, head);
  for (const side of ['left', 'right'] as const) {
    const pose = hands[side];
    const input = device.hands[side];
    if (pose && input) writePose(input, pose);
  }
  if (device.controlMode === 'manual') {
    device.controlMode = 'programmatic'; // the panel reads the device (syncFromDevice) ...
    device.controlMode = 'manual'; // ... and gives the mouse back
  } else device.notifyStateChange?.(); // a script drives it: the panel follows on a state change
}

interface PanelDefaults {
  inputLayer?: {
    headsetDefaultPosition?: { x: number; y: number; z: number };
    headsetDefaultQuaternion?: { x: number; y: number; z: number; w: number };
    transformHandles?: Map<string, { userData?: { defaultPosition?: number[]; defaultQuaternion?: number[] } }>;
  };
}

/**
 * Where the emulator's reset would put things: its panel's defaults (which a pose saved with its "save pose" button
 * changes) when the panel has them, else IWER's default head with the hands where its controllers start.
 */
export function defaultEmulatorPose(device: EmulatedRigLike): { head: Pose; hands: Partial<Record<Handedness, Pose>> } {
  const layer = (device.devui as PanelDefaults | undefined)?.inputLayer;
  const hp = layer?.headsetDefaultPosition;
  const hq = layer?.headsetDefaultQuaternion;
  const head: Pose =
    hp && hq ? { position: [hp.x, hp.y, hp.z], quaternion: [hq.x, hq.y, hq.z, hq.w] } : structuredClone(IWER_HEAD);
  const hands: Partial<Record<Handedness, Pose>> = {};
  for (const side of ['left', 'right'] as const) {
    const d = layer?.transformHandles?.get(side)?.userData;
    if (d?.defaultPosition?.length === 3 && d.defaultQuaternion?.length === 4) {
      // The panel keeps them relative to the default head.
      const local = rotate(head.quaternion, d.defaultPosition);
      hands[side] = {
        position: [head.position[0] + local[0], head.position[1] + local[1], head.position[2] + local[2]],
        quaternion: quatMultiply(head.quaternion, d.defaultQuaternion as Quat),
      };
    } else {
      const c = device.controllers[side];
      if (c) hands[side] = readPose(c);
    }
  }
  return { head, hands };
}

// ---- The candle step ----

/** What the candle step reads from the game, all in the game's world. */
export interface CandleStepGame {
  /** The head as the game's camera has it. */
  head(): Pose;
  /** Where the rig was placed from: the eyes the room expects. */
  rigHead(): ArrayLike<number>;
  /** The candle's flame (its wick). */
  candleFlame(): ArrayLike<number>;
  /** The flame of the match the right hand holds, or null when it shows none (the candle is lit, or no right hand). */
  matchFlame(): ArrayLike<number> | null;
}

/** How far above the wick the match's flame is held (well inside the 15 cm the candle lights within). */
const ABOVE_WICK_M = 0.02;
/** Close enough: the match's flame is this near where it is aimed. */
const SETTLED_M = 0.005;
/** Frames between moving the hand and measuring the match again (the pose reaches the game a frame or two later). */
const SETTLE_FRAMES = 2;
const MAX_TRIES = 8;

/**
 * Sits the player where the rig was placed, looking down at the candle, and moves the right hand until the match it holds
 * is just above the wick. The match is drawn from the hand through a grip the emulator does not know about, so the hand is
 * moved, the match measured in the game, and the hand moved again by what is left (a few frames).
 */
export class CandleStep {
  private readonly toDevice = new GameToDevice();
  private wait = 0;
  private tries = 0;
  private active = false;
  /** What the step last did, for the panel. */
  status = '';

  constructor(
    private readonly device: EmulatedRigLike,
    private readonly game: CandleStepGame,
  ) {}

  get running(): boolean {
    return this.active;
  }

  start(): void {
    this.toDevice.set(this.game.head(), headPose(this.device));
    const eyes = this.game.rigHead();
    const head: Pose = {
      position: this.toDevice.point(eyes),
      quaternion: this.toDevice.orientation(lookAt(eyes, this.game.candleFlame())),
    };
    setEmulatorPose(this.device, head, {});
    this.active = true;
    this.wait = SETTLE_FRAMES;
    this.tries = 0;
    this.status = 'Moving the hand to the candle…';
  }

  cancel(): void {
    this.active = false;
  }

  /** Call once per frame, after the match has been drawn for this frame's hands. */
  frame(): void {
    if (!this.active) return;
    if (this.wait > 0) {
      this.wait--;
      return;
    }
    const hand = handPose(this.device, 'right');
    const match = this.game.matchFlame();
    if (!hand || !match) return this.stop('No match to move: the right hand holds none (is the candle already lit?).');
    const wick = this.game.candleFlame();
    const ex = wick[0] - match[0],
      ey = wick[1] + ABOVE_WICK_M - match[1],
      ez = wick[2] - match[2];
    if (Math.hypot(ex, ey, ez) < SETTLED_M)
      return this.stop('The match is over the wick: hold still and the candle lights in 3 s.');
    if (++this.tries > MAX_TRIES) return this.stop('Could not bring the match to the wick.');
    const d = this.toDevice.direction([ex, ey, ez]);
    const p = hand.position;
    setEmulatorPose(this.device, null, {
      right: { position: [p[0] + d[0], p[1] + d[1], p[2] + d[2]], quaternion: hand.quaternion },
    });
    this.wait = SETTLE_FRAMES;
  }

  private stop(status: string): void {
    this.active = false;
    this.status = status;
  }
}
