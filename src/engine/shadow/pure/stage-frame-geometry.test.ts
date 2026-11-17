// The real wall (A's StageFrame, GDD sizes) against the shadow projector: where a hand's shadow lands when the
// lantern is where the rig puts it. These tests are why the real wall uses the settings in real-wall.ts (blend 0.65,
// a low edge blur) and not full perspective (the small tabletop theatre's 0) or the GDD's 0.9 (too small to read).
// Poses: a flat hand turned 90° so the fingers point up or down (a puppet hand, palm to the wall), and a flat hand
// with the fingers pointing at the wall (pitch 0), which casts only an edge-on sliver.
import { describe, expect, it } from 'vitest';
import { createHandFrame, type Handedness, type HandFrame } from '../../hands/hand';
import { clonePose, PRESETS, writeHandPose } from '../../hands/synthetic-hand';
import { StageFrame, WALL_HEIGHT_M, WALL_WIDTH_M } from '../../stage/stage-frame';
import { REAL_WALL_SHADOW_SETTINGS } from './real-wall';
import { ShadowProjector, type ShadowSettings } from './shadow-projector';
import { placeLantern } from './test-rig';

const HEAD = [0, 1.2, 0] as const;
const lantern = new Float64Array(3);
placeLantern(HEAD, 0, lantern);
// The flame sits on the candle (CandleView puts the flame 9.5 cm above the candle's base).
const FLAME_ABOVE_BASE_M = 0.095;
const flame = [lantern[0], lantern[1] + FLAME_ABOVE_BASE_M, lantern[2]];
const HALF_W = WALL_WIDTH_M / 2;
const HALF_H = WALL_HEIGHT_M / 2;

interface Shadow {
  onStage: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  maxBlur: number;
}

function shadowOf(
  settings: Partial<ShadowSettings>,
  wrist: readonly [number, number, number],
  pitchDeg: number,
): Shadow {
  const stage = new StageFrame();
  stage.placeInFront(HEAD, 0);
  const projector = new ShadowProjector(settings);
  const hand: HandFrame = createHandFrame('right');
  const pose = clonePose(PRESETS.flat);
  pose.pitchDeg = pitchDeg;
  writeHandPose(pose, [wrist[0], wrist[1], wrist[2]], hand);
  hand.tracked = true;
  hand.validJoints = 25;
  const hands: Record<Handedness, HandFrame> = { left: createHandFrame('left'), right: hand };
  projector.update(hands, stage, flame);
  const s = projector.shadows.right;
  const [minX, minY, maxX, maxY] = [s.bounds[0], s.bounds[1], s.bounds[2], s.bounds[3]];
  return {
    onStage: s.onStage,
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    maxBlur: Math.max(...s.blur),
  };
}

const wristAt = (below: number, ahead: number, across = 0): [number, number, number] => [
  across,
  HEAD[1] - below,
  -ahead,
];
const whollyOnWall = (s: Shadow) => s.minX > -HALF_W && s.maxX < HALF_W && s.minY > -HALF_H && s.maxY < HALF_H;

/** Wrists 0.15 to 0.25 m below the eyes and 0.4 to 0.45 m ahead, and 0.2 m to either side: where seated hands rest while making shapes. */
const REST: readonly [number, number, number][] = [
  wristAt(0.2, 0.4),
  wristAt(0.15, 0.45),
  wristAt(0.25, 0.4, 0.2),
  wristAt(0.25, 0.4, -0.2),
];

describe('the real wall with the real-wall shadow settings', () => {
  it('a puppet hand (fingers up or down) casts a shadow wholly on the wall, about 15 cm wide and 35 cm tall', () => {
    for (const pitch of [90, -90]) {
      for (const wrist of REST) {
        const s = shadowOf(REAL_WALL_SHADOW_SETTINGS, wrist, pitch);
        expect(whollyOnWall(s), `pitch ${pitch} wrist ${wrist}`).toBe(true);
        expect(s.width).toBeGreaterThan(0.12);
        expect(s.width).toBeLessThan(0.18);
        expect(s.height).toBeGreaterThan(0.28);
        expect(s.height).toBeLessThan(0.42);
      }
    }
  });

  it("grows as the hand nears the candle and shrinks as it moves away, as a near light's shadow does", () => {
    // The candle is about 0.38 m ahead of the eyes: from just past it to arm's length.
    const aheads = [0.42, 0.5, 0.6, 0.75, 0.9];
    const widths = aheads.map((ahead) => shadowOf(REAL_WALL_SHADOW_SETTINGS, wristAt(0.2, ahead), 90).width);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1]);
    expect(widths[0] / widths[widths.length - 1]).toBeGreaterThan(1.6);
    expect(widths[0] / widths[widths.length - 1]).toBeLessThan(2.5);
  });

  it('changes only the size with distance, not where the shadow falls', () => {
    const centreY = (s: Shadow) => (s.minY + s.maxY) / 2;
    const scaled = shadowOf(REAL_WALL_SHADOW_SETTINGS, wristAt(0.2, 0.75), 90);
    const plain = shadowOf({ ...REAL_WALL_SHADOW_SETTINGS, sizeLightBackM: 0 }, wristAt(0.2, 0.75), 90);
    expect(scaled.width).toBeLessThan(plain.width * 0.85);
    expect(Math.abs(centreY(scaled) - centreY(plain))).toBeLessThan(0.05);
  });

  it('keeps the edge blur to a small share of the shadow, so the gaps between fingers stay open', () => {
    for (const pitch of [90, -90]) {
      for (const wrist of REST) {
        const s = shadowOf(REAL_WALL_SHADOW_SETTINGS, wrist, pitch);
        expect(s.maxBlur).toBeLessThanOrEqual(0.008 + 1e-9);
        expect(s.maxBlur / s.width).toBeLessThan(0.08);
      }
    }
  });

  it('moves up the wall as the hand rises, and stays on it across the resting range', () => {
    // Wrists from 0.3 m to 0.1 m below the eyes in 2 cm steps (counted, not accumulated, so both ends are tested).
    let last = -Infinity;
    for (let i = 0; i <= 10; i++) {
      const s = shadowOf(REAL_WALL_SHADOW_SETTINGS, wristAt(0.3 - i * 0.02, 0.45), 90);
      expect(s.onStage).toBe(true);
      expect(s.minY).toBeGreaterThan(last);
      last = s.minY;
      expect(s.maxY).toBeLessThan(HALF_H + 0.05); // the top may just touch the wall's edge at the highest
    }
  });

  it('a hand with the fingers up at eye level overflows the top of the wall (the limit of where hands can reach)', () => {
    const s = shadowOf(REAL_WALL_SHADOW_SETTINGS, wristAt(0, 0.6), 90);
    expect(s.maxY).toBeGreaterThan(HALF_H);
  });

  it('a flat hand pointing at the wall casts only a thin sliver (why palm-down "flat" reads small here)', () => {
    const s = shadowOf(REAL_WALL_SHADOW_SETTINGS, wristAt(0.2, 0.4), 0);
    expect(s.height).toBeLessThan(0.1);
    expect(s.width).toBeGreaterThan(0.1);
  });
});

describe('why not the other settings', () => {
  it('full perspective (blend 0, the tabletop theatre’s setting) makes puppet shadows several times too big', () => {
    const real = shadowOf(REAL_WALL_SHADOW_SETTINGS, wristAt(0.2, 0.4), 90);
    const full = shadowOf({ blend: 0 }, wristAt(0.2, 0.4), 90);
    expect(full.width / real.width).toBeGreaterThan(3);
    expect(whollyOnWall(full)).toBe(false);
  });

  it('the GDD’s 0.9 keeps them steady but about 0.7 of the size, too small to read on a 1.6 m wall', () => {
    const real = shadowOf(REAL_WALL_SHADOW_SETTINGS, wristAt(0.2, 0.4), 90);
    const gdd = shadowOf({ blend: 0.9 }, wristAt(0.2, 0.4), 90);
    expect(gdd.width / real.width).toBeLessThan(0.75);
    expect(gdd.width).toBeLessThan(0.12);
  });
});
