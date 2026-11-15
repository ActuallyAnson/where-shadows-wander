import { describe, expect, it } from 'vitest';
import {
  STORY_SCALE,
  StageFrame,
  WALL_CENTRE_BELOW_EYES_M,
  WALL_DISTANCE_M,
  WALL_HEIGHT_M,
  WALL_WIDTH_M,
} from './stage-frame';

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: ArrayLike<number>) => Math.sqrt(dot(a, a));

function expectOrthonormal(f: StageFrame) {
  for (const v of [f.right, f.up, f.normal]) expect(len(v)).toBeCloseTo(1, 12);
  expect(dot(f.right, f.up)).toBeCloseTo(0, 12);
  expect(dot(f.right, f.normal)).toBeCloseTo(0, 12);
  expect(dot(f.up, f.normal)).toBeCloseTo(0, 12);
  // Right-handed: right × up = normal.
  const r = f.right,
    u = f.up;
  expect(r[1] * u[2] - r[2] * u[1]).toBeCloseTo(f.normal[0], 12);
  expect(r[2] * u[0] - r[0] * u[2]).toBeCloseTo(f.normal[1], 12);
  expect(r[0] * u[1] - r[1] * u[0]).toBeCloseTo(f.normal[2], 12);
}

describe('StageFrame', () => {
  it('places the wall in front of a player facing -Z', () => {
    const f = new StageFrame();
    f.placeInFront([0, 1.6, 0], 0);
    expect(Array.from(f.origin)).toEqual([0, 1.6 - WALL_CENTRE_BELOW_EYES_M, -WALL_DISTANCE_M]);
    expect(Array.from(f.normal).map((v) => v + 0)).toEqual([0, 0, 1]);
    expect(Array.from(f.right).map((v) => v + 0)).toEqual([1, 0, 0]);
    expect(Array.from(f.up)).toEqual([0, 1, 0]);
    expect([f.width, f.height]).toEqual([WALL_WIDTH_M, WALL_HEIGHT_M]);
    expectOrthonormal(f);
  });

  it('matches the stand-in test rig axes for any yaw (right = (-fz, 0, fx))', () => {
    const f = new StageFrame();
    for (const yaw of [0.3, -1.2, Math.PI / 2, 2.9]) {
      f.placeInFront([0.5, 1.2, -0.3], yaw);
      const fx = -Math.sin(yaw),
        fz = -Math.cos(yaw);
      expect(f.right[0]).toBeCloseTo(-fz, 12);
      expect(f.right[2]).toBeCloseTo(fx, 12);
      expect(f.normal[0]).toBeCloseTo(-fx, 12);
      expect(f.normal[2]).toBeCloseTo(-fz, 12);
      expectOrthonormal(f);
    }
  });

  it('makes a tilted up hint orthonormal', () => {
    const f = new StageFrame();
    f.setWall([1, 2, 3], [0, 0, 2], [0.3, 1, 0.5], 1, 0.5);
    expectOrthonormal(f);
    expect(f.up[2]).toBeCloseTo(0, 12);
  });

  it('round-trips stage → scene → stage, with the offset as distance', () => {
    const f = new StageFrame();
    f.placeInFront([0.2, 1.5, 0.4], 0.8);
    const p = new Float64Array(3);
    const s = new Float64Array(2);
    for (const [sx, sy, off] of [
      [0, 0, 0],
      [0.7, -0.4, 0],
      [-0.3, 0.2, 0.35],
    ]) {
      f.toScene(sx, sy, p, off);
      const d = f.toStage(p[0], p[1], p[2], s);
      expect(s[0]).toBeCloseTo(sx, 12);
      expect(s[1]).toBeCloseTo(sy, 12);
      expect(d).toBeCloseTo(off, 12);
    }
  });

  it('puts stage +y up the wall, so gravity is -y', () => {
    const f = new StageFrame();
    f.placeInFront([0, 1.6, 0], 1.1);
    const s = new Float64Array(2);
    const above = f.toStage(f.origin[0], f.origin[1] + 0.1, f.origin[2], s);
    expect(s[1]).toBeCloseTo(0.1, 12);
    expect(s[0]).toBeCloseTo(0, 12);
    expect(above).toBeCloseTo(0, 12);
  });

  it('tells points on the wall from points off it, with a margin', () => {
    const f = new StageFrame();
    f.setWall([0, 0, 0], [0, 0, 1], [0, 1, 0], 1.6, 1);
    expect(f.contains(0.79, 0.49)).toBe(true);
    expect(f.contains(0.81, 0)).toBe(false);
    expect(f.contains(0.75, 0, 0.1)).toBe(false);
    expect(f.contains(0.85, 0, -0.1)).toBe(true);
  });

  it('bumps the version on every change', () => {
    const f = new StageFrame();
    const v = f.version;
    f.placeInFront([0, 1.6, 0], 0);
    expect(f.version).toBe(v + 1);
  });

  it('rejects a degenerate wall', () => {
    const f = new StageFrame();
    expect(() => f.setWall([0, 0, 0], [0, 0, 0], [0, 1, 0], 1, 1)).toThrow(RangeError);
    expect(() => f.setWall([0, 0, 0], [0, 1, 0], [0, 2, 0], 1, 1)).toThrow(RangeError);
    expect(() => f.setWall([0, 0, 0], [0, 0, 1], [0, 1, 0], 0, 1)).toThrow(RangeError);
  });
});

describe('StageFrame.setStoryArea', () => {
  it('is the stage, scaled and moved up the same wall', () => {
    const stage = new StageFrame();
    stage.placeInFront([0.3, 1.2, -0.4], 0.6);
    const story = new StageFrame();
    story.setStoryArea(stage, STORY_SCALE, 0.25);
    expect(story.width).toBeCloseTo(stage.width * STORY_SCALE, 12);
    expect(story.height).toBeCloseTo(stage.height * STORY_SCALE, 12);
    for (let i = 0; i < 3; i++) {
      expect(story.normal[i]).toBeCloseTo(stage.normal[i], 12);
      expect(story.right[i]).toBeCloseTo(stage.right[i], 12);
      expect(story.origin[i]).toBeCloseTo(stage.origin[i] + stage.up[i] * 0.25, 12);
    }
  });

  it('fills 95 percent of the room wall each way', () => {
    expect((WALL_WIDTH_M * STORY_SCALE) / 4).toBeCloseTo(0.95, 6);
    expect((WALL_HEIGHT_M * STORY_SCALE) / 2.5).toBeCloseTo(0.95, 6);
  });
});
