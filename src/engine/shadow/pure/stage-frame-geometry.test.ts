// The real wall (A's StageFrame, GDD sizes) against the shadow projector: where a hand's shadow lands with the candle where the
// room puts it (on the lap tray) and the shadows cast from real-wall.ts's castPoint, behind and above the flame. These tests are
// why the shadows are not cast from the flame itself.
// Poses: a flat hand turned 90° so the fingers point up or down (a puppet hand, palm to the wall), and a flat hand
// with the fingers pointing at the wall (pitch 0), which casts only an edge-on sliver.
import { describe, expect, it } from 'vitest';
import { createHandFrame, type Handedness, type HandFrame } from '../../hands/hand';
import { clonePose, PRESETS, writeHandPose } from '../../hands/synthetic-hand';
import { StageFrame } from '../../stage/stage-frame';
import { ROOM_WALL_HEIGHT_M, ROOM_WALL_WIDTH_M } from '../stage-edge-glsl';
import { castPoint, REAL_WALL_SHADOW_SETTINGS } from './real-wall';
import { ShadowProjector } from './shadow-projector';

const HEAD = [0, 1.2, 0] as const;
// The candle on the lap tray (main.ts: TRAY_AHEAD_M 0.38, TRAY_BELOW_EYES_M 0.55), its flame 9.5 cm above the saucer.
const flame = [0, HEAD[1] - 0.55 + 0.095, -0.38];
/** The room's wall, in stage metres: the stage is centred across it, its centre 1 m above the floor (HEAD 1.2 m, 0.2 m below). */
const STAGE_Y_M = 1;
const WALL = {
  left: -ROOM_WALL_WIDTH_M / 2,
  right: ROOM_WALL_WIDTH_M / 2,
  bottom: -STAGE_Y_M,
  top: ROOM_WALL_HEIGHT_M - STAGE_Y_M,
};

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

/** Where the hand's shadow lands, cast from `light` ('cast': castPoint; 'flame': the flame itself). */
function shadowOf(
  wrist: readonly [number, number, number],
  pitchDeg: number,
  light: 'cast' | 'flame' = 'cast',
): Shadow {
  const stage = new StageFrame();
  stage.placeInFront(HEAD, 0);
  const projector = new ShadowProjector(REAL_WALL_SHADOW_SETTINGS);
  const hand: HandFrame = createHandFrame('right');
  const pose = clonePose(PRESETS.flat);
  pose.pitchDeg = pitchDeg;
  writeHandPose(pose, [wrist[0], wrist[1], wrist[2]], hand);
  hand.tracked = true;
  hand.validJoints = 25;
  const hands: Record<Handedness, HandFrame> = { left: createHandFrame('left'), right: hand };
  projector.update(hands, stage, light === 'cast' ? castPoint(stage, flame, new Float64Array(3)) : flame);
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
const whollyOnWall = (s: Shadow) =>
  s.minX > WALL.left && s.maxX < WALL.right && s.minY > WALL.bottom && s.maxY < WALL.top;

/** Wrists 0.15 to 0.25 m below the eyes and 0.4 to 0.45 m ahead, and 0.2 m to either side: where seated hands rest while making shapes. */
const REST: readonly [number, number, number][] = [
  wristAt(0.2, 0.4),
  wristAt(0.15, 0.45),
  wristAt(0.25, 0.4, 0.2),
  wristAt(0.25, 0.4, -0.2),
];

describe('the real wall, shadows cast from behind the flame', () => {
  it("a puppet hand (fingers up or down) casts a shadow wholly on the room's wall, about 20 cm wide and 45 cm tall", () => {
    for (const pitch of [90, -90]) {
      for (const wrist of REST) {
        const s = shadowOf(wrist, pitch);
        expect(whollyOnWall(s), `pitch ${pitch} wrist ${wrist}`).toBe(true);
        expect(s.width).toBeGreaterThan(0.15);
        expect(s.width).toBeLessThan(0.25);
        expect(s.height).toBeGreaterThan(0.35);
        expect(s.height).toBeLessThan(0.55);
      }
    }
  });

  it('a resting hand casts on the middle of the stage', () => {
    const s = shadowOf(wristAt(0.2, 0.4), 90);
    expect(s.onStage).toBe(true);
    expect(Math.abs((s.minX + s.maxX) / 2)).toBeLessThan(0.05);
    expect(Math.abs((s.minY + s.maxY) / 2)).toBeLessThan(0.3);
  });

  it("grows as the hand nears the light and shrinks as it moves toward the wall, as a near light's shadow does", () => {
    const aheads = [0.42, 0.5, 0.6, 0.75, 0.9];
    const widths = aheads.map((ahead) => shadowOf(wristAt(0.2, ahead), 90).width);
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1]);
    expect(widths[0] / widths[widths.length - 1]).toBeGreaterThan(1.2);
  });

  it('moves up the wall as the hand rises, and stays on it across the resting range', () => {
    // Wrists from 0.3 m to 0.1 m below the eyes in 2 cm steps (counted, not accumulated, so both ends are tested).
    let last = -Infinity;
    for (let i = 0; i <= 10; i++) {
      const s = shadowOf(wristAt(0.3 - i * 0.02, 0.45), 90);
      expect(s.onStage).toBe(true);
      expect(s.minY).toBeGreaterThan(last);
      last = s.minY;
      expect(whollyOnWall(s)).toBe(true);
    }
  });

  it('a flat hand pointing at the wall casts only a thin sliver (why palm-down "flat" reads small here)', () => {
    const s = shadowOf(wristAt(0.2, 0.4), 0);
    expect(s.height).toBeLessThan(0.12);
    expect(s.width).toBeGreaterThan(0.1);
  });
});

describe('why not cast from the flame', () => {
  it('the flame is low and just behind resting hands: their shadows would be thrown metres up, off the wall', () => {
    for (const wrist of REST) {
      const s = shadowOf(wrist, 90, 'flame');
      expect(s.minY, `wrist ${wrist}`).toBeGreaterThan(WALL.top);
    }
  });
});
