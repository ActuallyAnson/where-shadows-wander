import { describe, expect, it } from 'vitest';
import { fakeFrame, fakePlane, fakeRefSpace, fakeSession, IDENTITY, poseMatrix } from './fake-xr';
import { flipAboutX, MAX_PLANES, MIN_REREAD_MS, mulMat4, PlaneTracker } from './plane-tracker';

const SQUARE: [number, number][] = [
  [-0.5, -0.4],
  [0.5, -0.4],
  [0.5, 0.4],
  [-0.5, 0.4],
];
const session = fakeSession();

function setup(planes: ReturnType<typeof fakePlane>[], viewer: [number, number, number] = [0, 1.6, 0]) {
  const tracker = new PlaneTracker();
  const ref = fakeRefSpace();
  const set = new Set(planes);
  const frame = fakeFrame(session, { planes: set, viewer });
  return { tracker, ref, set, frame, run: (now = 0) => tracker.update(set, frame, ref, IDENTITY, now) };
}

/** Array copy with -0 turned into 0, for exact comparisons. */
function plain(a: ArrayLike<number>): number[] {
  return Array.from(a, (v) => v + 0);
}

function det3(m: ArrayLike<number>): number {
  return m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
}

describe('plane tracker', () => {
  it('turns a normal that points away from the viewer toward it', () => {
    // A table at 0.7 m whose plane space +Y points down; the viewer is above it.
    const { tracker, run } = setup([fakePlane({ matrix: poseMatrix(0, 0.7, -0.5, -1), polygon: SQUARE })]);
    run();
    const p = tracker.active[0];
    expect(plain(p.normal)).toEqual([0, 1, 0]);
    expect(det3(p.matrix)).toBeCloseTo(1);
    // Flipping about X negates local Z, so the polygon's z values flip too.
    expect([...p.polygon.slice(0, 2)]).toEqual([-0.5, 0.4].map((v) => Math.fround(v)));
    expect([...p.extent]).toEqual([-0.5, 0.5, -0.4, 0.4].map((v) => Math.fround(v)));
  });

  it('keeps a normal that already faces the viewer', () => {
    const { tracker, run } = setup([fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE })]);
    run();
    expect([...tracker.active[0].normal]).toEqual([0, 1, 0]);
    expect([...tracker.active[0].polygon.slice(0, 2)]).toEqual([-0.5, -0.4].map((v) => Math.fround(v)));
  });

  it('places planes in scene space using the origin matrix', () => {
    const { tracker, set, frame, ref } = setup([fakePlane({ matrix: poseMatrix(0.2, 0.7, -0.5), polygon: SQUARE })]);
    const origin = [...IDENTITY];
    origin[12] = 1; // XR origin moved 1 m along X
    tracker.update(set, frame, ref, origin, 0);
    expect(tracker.active[0].centre[0]).toBeCloseTo(1.2);
  });

  it("doesn't re-read a plane whose lastChangedTime is unchanged", () => {
    const { frame, run } = setup([fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE, time: 5 })]);
    run(0);
    const calls = frame.poseCalls;
    run(1000);
    expect(frame.poseCalls).toBe(calls);
  });

  it("doesn't bump versions when lastChangedTime changes but the content doesn't (the emulator)", () => {
    const plane = fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE, time: 0 });
    const { tracker, frame, run } = setup([plane]);
    run(0);
    const [version, planeVersion] = [tracker.version, tracker.active[0].version];
    for (let i = 1; i <= 10; i++) {
      plane.lastChangedTime = i * 16;
      run(i * 100);
    }
    expect(tracker.version).toBe(version);
    expect(tracker.active[0].version).toBe(planeVersion);
    // Re-read at most once per MIN_REREAD_MS: 1 s of updates → about 4 reads, not 10.
    expect(frame.poseCalls).toBeLessThanOrEqual(1 + Math.ceil(1000 / MIN_REREAD_MS));
  });

  it('bumps versions when the polygon changes', () => {
    const plane = fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE, time: 0 });
    const { tracker, run } = setup([plane]);
    run(0);
    const version = tracker.version;
    plane.polygon = [...plane.polygon, { x: 0, y: 0, z: 0.6, w: 1 } as DOMPointReadOnly];
    plane.lastChangedTime = 1;
    expect(run(MIN_REREAD_MS)).toBe(true);
    expect(tracker.version).toBe(version + 1);
    expect(tracker.active[0].vertexCount).toBe(5);
  });

  it('retries a plane whose pose is not available yet', () => {
    const plane = fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE });
    const tracker = new PlaneTracker();
    const ref = fakeRefSpace();
    const set = new Set([plane]);
    tracker.update(set, fakeFrame(session, { planes: set, noPose: new Set([plane]) }), ref, IDENTITY, 0);
    expect(tracker.active[0].vertexCount).toBe(0);
    tracker.update(set, fakeFrame(session, { planes: set }), ref, IDENTITY, 16);
    expect(tracker.active[0].vertexCount).toBe(4);
  });

  it('drops planes that disappear and reuses their records', () => {
    const a = fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE });
    const b = fakePlane({ matrix: poseMatrix(0, 0, 0), polygon: SQUARE });
    const { tracker, set, run } = setup([a, b]);
    run();
    const recA = tracker.active.find((p) => p.centre[1] > 0.5)!;
    const idA = recA.id;
    set.delete(a);
    const c = fakePlane({ matrix: poseMatrix(1, 1, 1), polygon: SQUARE });
    set.add(c);
    // c reuses a's record only after a has been swept, so remove first, then add.
    set.delete(c);
    run(16);
    expect(tracker.active).toHaveLength(1);
    set.add(c);
    run(32);
    expect(tracker.active).toHaveLength(2);
    const recC = tracker.active.find((p) => p.centre[0] > 0.5)!;
    expect(recC).toBe(recA);
    expect(recC.id).not.toBe(idA);
  });

  it('caps planes at MAX_PLANES and counts the rest', () => {
    const planes = Array.from({ length: MAX_PLANES + 8 }, (_, i) =>
      fakePlane({ matrix: poseMatrix(i, 0, 0), polygon: SQUARE }),
    );
    const { tracker, run } = setup(planes);
    run();
    expect(tracker.active).toHaveLength(MAX_PLANES);
    expect(tracker.overflow).toBe(8);
  });

  it('re-reads every plane when the origin or reference space changes', () => {
    const { tracker, set, frame, ref, run } = setup([
      fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE, time: 1 }),
    ]);
    run(0);
    const calls = frame.poseCalls;
    const moved = [...IDENTITY];
    moved[13] = 0.1;
    tracker.update(set, frame, ref, moved, 10);
    expect(frame.poseCalls).toBe(calls + 1);
    tracker.update(set, frame, fakeRefSpace(), moved, 20);
    expect(frame.poseCalls).toBe(calls + 2);
    ref.listeners.get('reset')!(); // the old space's reset still marks planes
    expect(tracker.active[0].centre[1]).toBeCloseTo(0.8);
  });

  it('grows polygon storage only for a bigger polygon', () => {
    const plane = fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE, time: 0 });
    const { tracker, run } = setup([plane]);
    run(0);
    const before = tracker.active[0].polygon;
    plane.polygon = Array.from({ length: 12 }, (_, i) => ({ x: i * 0.01, y: 0, z: 0, w: 1 }) as DOMPointReadOnly);
    plane.lastChangedTime = 1;
    run(MIN_REREAD_MS);
    expect(tracker.active[0].polygon).not.toBe(before);
    const grown = tracker.active[0].polygon;
    plane.polygon = plane.polygon.slice(0, 5);
    plane.lastChangedTime = 2;
    run(2 * MIN_REREAD_MS);
    expect(tracker.active[0].polygon).toBe(grown);
  });

  it('forgets everything on clear', () => {
    const { tracker, run } = setup([fakePlane({ matrix: poseMatrix(0, 0.7, -0.5), polygon: SQUARE })]);
    run();
    const version = tracker.version;
    tracker.clear();
    expect(tracker.active).toHaveLength(0);
    expect(tracker.version).toBe(version + 1);
  });
});

describe('matrix helpers', () => {
  it('mulMat4 matches a hand-computed product', () => {
    const a = poseMatrix(1, 2, 3);
    const b = poseMatrix(0.5, 0, 0, -1);
    const out = new Float32Array(16);
    mulMat4(a, b, out);
    expect([...out]).toEqual([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, -1, 0, 1.5, 2, 3, 1]);
  });

  it('flipAboutX negates the Y and Z axes', () => {
    const m = new Float32Array(poseMatrix(1, 2, 3));
    flipAboutX(m);
    expect(plain(m)).toEqual(poseMatrix(1, 2, 3, -1));
  });
});
