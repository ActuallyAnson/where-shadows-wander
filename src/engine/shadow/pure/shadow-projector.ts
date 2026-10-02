// Projects both hands onto the stage each frame, filling HandShadow (the
// collision solver's input) without allocating. Plain TypeScript.
import { JOINT, JOINT_COUNT, JOINT_PARENT, type HandFrame, type Handedness } from '../../hands/hand';
import { CAPSULES_PER_HAND, CAPSULE_STRIDE, createHandShadow, type HandShadow } from '../../hands/hand-shadow';
import { convexHull } from './hull';
import { magnification, projectToStage, shadowMatrix } from './projection';
import { distanceToPlane, type StagePlane } from './stage-plane';

type V3 = Readonly<ArrayLike<number>>;

export interface ShadowSettings {
  /** 0 = perspective from the lantern, 1 = orthographic; 0.9 keeps size steady over 1–3 m (GDD). */
  blend: number;
  /** Accessibility "shadow size": scales each hand's shadow about its palm. 1 = natural. */
  size: number;
  /** Edge blur per metre of distance from the stage, and its limits, metres. */
  blurPerM: number;
  minBlurM: number;
  maxBlurM: number;
}

export const DEFAULT_SHADOW_SETTINGS: Readonly<ShadowSettings> = {
  blend: 0.9,
  size: 1,
  blurPerM: 0.03,
  minBlurM: 0.002,
  maxBlurM: 0.02,
};

/** Joint pairs for each capsule: the 24 bones (joint to parent), then 4 webs across the palm. */
// prettier-ignore
export const CAPSULE_JOINTS: readonly number[] = [
  ...Array.from({ length: JOINT_COUNT - 1 }, (_, i) => [i + 1, JOINT_PARENT[i + 1]]).flat(),
  6, 11,   11, 16,   16, 21,   // knuckle to knuckle: index-middle, middle-ring, ring-pinky
  1, 5,                        // thumb base to index base
];
const MIN_RADIUS_M = 0.004;
const PALM_A = JOINT['middle-finger-metacarpal'];
const PALM_B = JOINT['middle-finger-phalanx-proximal'];
const HANDS: readonly Handedness[] = ['left', 'right'];

export class ShadowProjector {
  readonly shadows: Record<Handedness, HandShadow> = {
    left: createHandShadow('left'),
    right: createHandShadow('right'),
  };
  readonly settings: ShadowSettings;
  /** The shadow matrix used this frame (column-major), for the debug overlay. */
  readonly matrix = new Float64Array(16);
  private readonly xy = new Float64Array(2);
  private readonly mag = new Float64Array(JOINT_COUNT);
  private readonly height = new Float64Array(JOINT_COUNT);
  private readonly order = new Uint8Array(JOINT_COUNT);

  constructor(settings: Partial<ShadowSettings> = {}) {
    this.settings = { ...DEFAULT_SHADOW_SETTINGS, ...settings };
  }

  /** Projects both hands from the lantern `light` onto `stage`. */
  update(hands: Readonly<Record<Handedness, HandFrame>>, stage: StagePlane, light: V3): void {
    shadowMatrix(stage, light, this.settings.blend, this.matrix);
    const lightD = distanceToPlane(stage, light[0], light[1], light[2]);
    for (let i = 0; i < HANDS.length; i++) this.project(hands[HANDS[i]], stage, lightD, this.shadows[HANDS[i]]);
  }

  private project(hand: HandFrame, stage: StagePlane, lightD: number, out: HandShadow): void {
    // A partly tracked hand keeps stale positions for its missing joints: no shadow rather than a wrong one.
    out.active = false;
    if (!hand.tracked || hand.validJoints < JOINT_COUNT) return;
    const s = this.settings;
    const p = hand.positions;
    let heightSum = 0;
    for (let j = 0; j < JOINT_COUNT; j++) {
      const x = p[j * 3],
        y = p[j * 3 + 1],
        z = p[j * 3 + 2];
      if (!(projectToStage(this.matrix, stage, x, y, z, this.xy) > 1e-9)) return; // behind the light
      out.joints[j * 2] = this.xy[0];
      out.joints[j * 2 + 1] = this.xy[1];
      const h = distanceToPlane(stage, x, y, z);
      this.height[j] = h;
      // A joint pushed through the stage casts no smaller shadow than one on it.
      this.mag[j] = magnification(lightD, Math.max(h, 0), s.blend);
      heightSum += h;
    }
    out.distanceM = heightSum / JOINT_COUNT;

    // Shadow size: scale about the palm's shadow (between the middle finger's base and knuckle, where
    // derivePalm puts the palm), so a bigger shadow stays under the hand.
    if (s.size !== 1) {
      const cx = (out.joints[PALM_A * 2] + out.joints[PALM_B * 2]) / 2,
        cy = (out.joints[PALM_A * 2 + 1] + out.joints[PALM_B * 2 + 1]) / 2;
      for (let j = 0; j < JOINT_COUNT; j++) {
        out.joints[j * 2] = cx + (out.joints[j * 2] - cx) * s.size;
        out.joints[j * 2 + 1] = cy + (out.joints[j * 2 + 1] - cy) * s.size;
      }
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let c = 0; c < CAPSULES_PER_HAND; c++) {
      const a = CAPSULE_JOINTS[c * 2],
        b = CAPSULE_JOINTS[c * 2 + 1];
      const r =
        Math.max(((hand.radii[a] || MIN_RADIUS_M) + (hand.radii[b] || MIN_RADIUS_M)) / 2, MIN_RADIUS_M) *
        ((this.mag[a] + this.mag[b]) / 2) *
        s.size;
      const o = c * CAPSULE_STRIDE;
      const ax = out.joints[a * 2],
        ay = out.joints[a * 2 + 1],
        bx = out.joints[b * 2],
        by = out.joints[b * 2 + 1];
      out.capsules[o] = ax;
      out.capsules[o + 1] = ay;
      out.capsules[o + 2] = bx;
      out.capsules[o + 3] = by;
      out.capsules[o + 4] = r;
      const h = Math.max((this.height[a] + this.height[b]) / 2, 0);
      out.blur[c] = Math.min(Math.max(h * s.blurPerM, s.minBlurM), s.maxBlurM) * s.size;
      minX = Math.min(minX, ax - r, bx - r);
      maxX = Math.max(maxX, ax + r, bx + r);
      minY = Math.min(minY, ay - r, by - r);
      maxY = Math.max(maxY, ay + r, by + r);
    }
    out.bounds[0] = minX;
    out.bounds[1] = minY;
    out.bounds[2] = maxX;
    out.bounds[3] = maxY;
    const hw = stage.width / 2,
      hh = stage.height / 2;
    out.onStage = maxX > -hw && minX < hw && maxY > -hh && minY < hh;
    out.outlineCount = convexHull(out.joints, JOINT_COUNT, out.outline, this.order);
    out.active = true;
  }
}
