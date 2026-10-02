import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT_COUNT, type Vec3 } from './hand';
import { handFeatures } from './hand-features';
import { ShapeClassifier } from './shape-classifier';
import { ShapeEventQueue } from './shape-events';
import { FEATURE_COUNT, packFeatures, SHAPE_RANGES, shapeMargin } from './shape-ranges';
import { ShapeRecognizer } from './shape-recognizer';
import {
  clonePose,
  jitterHand,
  lerpPose,
  PRESETS,
  seededRandom,
  writeHandPose,
  type HandPose,
  type PresetName,
} from './synthetic-hand';

const FPS = 72;
const W: Vec3 = [0.1, 1, -0.4];

/** Runs a recognizer at 72 fps; `pose(t)` gives the right hand's pose (null hides it). Returns every event. */
function drive(
  seconds: number,
  pose: (t: number) => HandPose | PresetName | null,
  opts: { jitter?: number; partial?: (t: number) => boolean; recognizer?: ShapeRecognizer } = {},
) {
  const r = opts.recognizer ?? new ShapeRecognizer();
  const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
  const random = seededRandom(5);
  const events: { type: string; shape: string; t: number; reason: string | null }[] = [];
  for (let i = 0; i <= seconds * FPS; i++) {
    const t = i / FPS;
    const p = pose(t);
    if (p === null) hands.right.tracked = false;
    else {
      writeHandPose(typeof p === 'string' ? PRESETS[p] : p, W, hands.right);
      if (opts.jitter) jitterHand(hands.right, opts.jitter, random);
      if (opts.partial?.(t)) hands.right.validJoints = JOINT_COUNT - 1;
    }
    r.update(hands, t);
    for (let k = 0; k < r.events.count; k++) {
      const e = r.events.at(k);
      events.push({ type: e.type, shape: e.shape, t: e.t, reason: e.reason });
    }
  }
  return { r, events };
}

const kinds = (events: { type: string; shape: string }[]) => events.map((e) => `${e.type} ${e.shape}`);

/** A pose between `a` and `b` where `shape`'s margin is `target` units, found by bisection. */
function poseAtMargin(a: PresetName, b: PresetName, shape: 'flat', target: number): HandPose {
  const out = clonePose(PRESETS[a]);
  const packed = new Float32Array(FEATURE_COUNT);
  const marginAt = (k: number) => {
    lerpPose(PRESETS[a], PRESETS[b], k, out);
    const f = handFeatures(writeHandPose(out, W, createHandFrame('right')))!;
    return shapeMargin(packFeatures(f, packed), SHAPE_RANGES[shape]);
  };
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (marginAt(mid) > target) lo = mid;
    else hi = mid;
  }
  marginAt(lo);
  return clonePose(out);
}

describe('shape classifier', () => {
  it('commits a verb 0.4 s and a companion 1 s after the pose appears', () => {
    for (const [shape, hold] of [
      ['fist', 0.4],
      ['rabbit', 1],
    ] as const) {
      const { events } = drive(2, (t) => (t < 0.5 ? 'relaxed' : shape));
      const commit = events.find((e) => e.type === 'commit')!;
      expect(commit.shape).toBe(shape);
      expect(commit.t - 0.5).toBeCloseTo(hold, 1);
      expect(Math.abs(commit.t - 0.5 - hold)).toBeLessThanOrEqual(1.5 / FPS);
    }
  });

  it('emits candidate then commit, and cancel when the pose drops early', () => {
    expect(kinds(drive(1, (t) => (t < 0.2 ? 'relaxed' : 'cup')).events)).toEqual(['candidate cup', 'commit cup']);
    expect(kinds(drive(1, (t) => (t >= 0.2 && t < 0.4 ? 'cup' : 'relaxed')).events)).toEqual([
      'candidate cup',
      'cancel cup',
    ]);
  });

  it('a different shape during the hold restarts the hold', () => {
    const { events } = drive(2, (t) => (t < 0.3 ? 'fist' : 'cup'));
    expect(kinds(events)).toEqual(['candidate fist', 'cancel fist', 'candidate cup', 'commit cup']);
    expect(events[3].t - 0.3).toBeCloseTo(0.4, 1);
  });

  it('switching shapes emits release(switch) then commit in one update', () => {
    // A switch happens where the committed shape's widened (keep) ranges overlap a new shape:
    // cup is committed, then the fingers curl to 0.69 with the palm still up, which is a clear
    // fist (0.4 units in) while still just inside cup's keep range (0.1 units).
    const c = new ShapeClassifier('right');
    const q = new ShapeEventQueue();
    const cup = handFeatures(writeHandPose(PRESETS.cup, W, createHandFrame('right')))!;
    const events: string[] = [];
    const run = (seconds: number, t0: number) => {
      for (let i = 0; i < seconds * FPS; i++) {
        q.clear();
        c.update(cup, 25, 1 / FPS, t0 + i / FPS, q);
        for (let k = 0; k < q.count; k++)
          events.push(`${q.at(k).type} ${q.at(k).shape} ${q.at(k).reason ?? ''}`.trim());
      }
    };
    run(1, 0);
    cup.minCurl = cup.maxCurl = cup.meanCurl = 0.69;
    cup.curl.index = cup.curl.middle = cup.curl.ring = cup.curl.pinky = 0.69;
    run(1, 1);
    expect(events).toEqual(['candidate cup', 'commit cup', 'candidate fist', 'release cup switch', 'commit fist']);
  });

  it("doesn't re-commit the committed shape when a switch is abandoned", () => {
    // Cup committed; the fingers curl toward fist (fist starts its hold), then come back:
    // cup leads again, so fist is cancelled and cup simply stays committed.
    const c = new ShapeClassifier('right');
    const q = new ShapeEventQueue();
    const f = handFeatures(writeHandPose(PRESETS.cup, W, createHandFrame('right')))!;
    const events: string[] = [];
    const run = (seconds: number, t0: number, curl: number | null) => {
      if (curl !== null) {
        f.minCurl = f.maxCurl = f.meanCurl = curl;
        f.curl.index = f.curl.middle = f.curl.ring = f.curl.pinky = curl;
      }
      for (let i = 0; i < seconds * FPS; i++) {
        q.clear();
        c.update(f, 25, 1 / FPS, t0 + i / FPS, q);
        for (let k = 0; k < q.count; k++) events.push(`${q.at(k).type} ${q.at(k).shape}`);
      }
    };
    run(1, 0, null);
    run(0.2, 1, 0.69);
    run(1, 1.2, 0.45);
    expect(events).toEqual(['candidate cup', 'commit cup', 'candidate fist', 'cancel fist']);
    expect(c.state.committed).toBe('cup');
  });

  it('keeps a hold through small dips outside the ranges (noise), not through large ones', () => {
    const c = new ShapeClassifier('right');
    const q = new ShapeEventQueue();
    const f = handFeatures(writeHandPose(PRESETS.fox, W, createHandFrame('right')))!;
    const events: string[] = [];
    const step = (meanCurl: number, i: number) => {
      f.meanCurl = meanCurl;
      q.clear();
      c.update(f, 25, 1 / FPS, i / FPS, q);
      for (let k = 0; k < q.count; k++) events.push(`${q.at(k).type} ${q.at(k).shape}`);
    };
    // fox needs mean curl <= 0.19 (0.1 per unit): 0.22 is 0.3 units out, within the 0.5 slack.
    for (let i = 0; i < FPS * 1.2; i++) step(i % 10 === 5 ? 0.22 : 0.05, i);
    expect(events).toEqual(['candidate fox', 'commit fox']);
    const c2 = new ShapeClassifier('right');
    events.length = 0;
    for (let i = 0; i < FPS * 1.2; i++) {
      f.meanCurl = i === 20 ? 0.3 : 0.05; // 1.1 units out: cancels
      q.clear();
      c2.update(f, 25, 1 / FPS, i / FPS, q);
      for (let k = 0; k < q.count; k++) events.push(`${q.at(k).type} ${q.at(k).shape}`);
    }
    expect(events.slice(0, 3)).toEqual(['candidate fox', 'cancel fox', 'candidate fox']);
  });

  it("drops a hold that's outside its ranges while another shape matches", () => {
    // At tolerance 2 flat allows a thumb up to 43° and fox from 42°. Flat starts its hold; then
    // the thumb sits at 43.2°: flat is 0.025 units out (inside the slack) and fox 0.15 in, not
    // enough of a lead to switch. The flat hold must drop rather than commit flat.
    const c = new ShapeClassifier('right', { tolerance: 2 });
    const q = new ShapeEventQueue();
    const f = handFeatures(writeHandPose(PRESETS.flat, W, createHandFrame('right')))!;
    const events: string[] = [];
    for (let i = 0; i < FPS; i++) {
      f.thumbFwdDeg = i === 0 ? 10 : 43.2;
      q.clear();
      c.update(f, 25, 1 / FPS, i / FPS, q);
      for (let k = 0; k < q.count; k++) events.push(`${q.at(k).type} ${q.at(k).shape}`);
    }
    expect(events.slice(0, 3)).toEqual(['candidate flat', 'cancel flat', 'candidate fox']);
    expect(events).not.toContain('commit flat');
  });

  it('commits on time at 60 fps despite float rounding', () => {
    const r = new ShapeRecognizer();
    const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
    writeHandPose(PRESETS.fist, W, hands.right);
    let commitFrame = -1;
    for (let i = 0; i <= 60 && commitFrame < 0; i++) {
      r.update(hands, i / 60);
      for (let k = 0; k < r.events.count; k++) if (r.events.at(k).type === 'commit') commitFrame = i;
    }
    expect(commitFrame).toBe(24); // 0.4 s at 60 fps
  });

  it('a jump to a distant shape releases the old one first (exit), then holds the new one', () => {
    const { events } = drive(2, (t) => (t < 1 ? 'fist' : 'spread'));
    expect(kinds(events)).toEqual([
      'candidate fist',
      'commit fist',
      'release fist',
      'candidate spread',
      'commit spread',
    ]);
    expect(events[2].reason).toBe('exit');
  });

  it('releases with reason exit when the hand leaves the shape', () => {
    const { events } = drive(2, (t) => (t < 1 ? 'flat' : 'fist'));
    // Fist is far from flat: flat lets go as soon as the hand closes, before fist commits.
    expect(events.find((e) => e.type === 'release')).toMatchObject({ shape: 'flat', reason: 'exit' });
  });

  it("doesn't flicker at a pose between the enter and keep ranges, with tracking noise", () => {
    const boundary = poseAtMargin('flat', 'relaxed', 'flat', -0.5);
    const { events } = drive(11, (t) => (t < 1 ? 'flat' : boundary), { jitter: 0.002 });
    expect(kinds(events)).toEqual(['candidate flat', 'commit flat']);
  });

  it('commits at most once at a boundary pose from idle', () => {
    const boundary = poseAtMargin('flat', 'relaxed', 'flat', 0.05);
    const { events } = drive(10, () => boundary, { jitter: 0.002 });
    expect(events.filter((e) => e.type === 'commit').length).toBeLessThanOrEqual(1);
  });

  it('pauses the hold while a joint is missing and resumes after', () => {
    // 0.1 s of partial tracking in the middle of a fist's hold.
    const { r, events } = drive(1, () => 'fist', { partial: (t) => t >= 0.2 && t < 0.3 });
    const commit = events.find((e) => e.type === 'commit')!;
    expect(commit.t).toBeGreaterThan(0.45);
    expect(commit.t).toBeLessThan(0.55);
    expect(r.right.state.committed).toBe('fist');
  });

  it('cancels a candidate after 0.2 s without tracking, and releases a committed shape after 0.5 s', () => {
    const cancelled = drive(1, (t) => (t >= 0.1 && t < 0.45 ? null : 'fist')).events;
    expect(kinds(cancelled).slice(0, 2)).toEqual(['candidate fist', 'cancel fist']);
    const released = drive(2, (t) => (t >= 0.6 && t < 1.3 ? null : 'fist')).events;
    const release = released.find((e) => e.type === 'release')!;
    expect(release.reason).toBe('lost');
    expect(release.t).toBeGreaterThan(1.05); // 0.5 s after tracking was lost at 0.6 s
  });

  it('never commits while paused', () => {
    const { events, r } = drive(2, () => 'fist', { partial: () => true });
    expect(events).toEqual([]);
    expect(r.right.state.phase).toBe('paused');
  });

  it('picks no candidate when two shapes match about equally', () => {
    // At tolerance 2, a thumb at 42.5° is just inside both flat (<= 43°) and fox (>= 42°).
    const c = new ShapeClassifier('right', { tolerance: 2 });
    const q = new ShapeEventQueue();
    const f = handFeatures(writeHandPose(PRESETS.flat, W, createHandFrame('right')))!;
    f.thumbFwdDeg = 42.5;
    for (let i = 0; i < 100; i++) c.update(f, 25, 1 / FPS, i / FPS, q);
    expect(c.margins[0]).toBeGreaterThan(0); // flat matches
    expect(c.margins[5]).toBeGreaterThan(0); // fox matches
    expect(c.state.phase).toBe('idle');
  });

  it('hold times and tolerance can change at runtime', () => {
    const r = new ShapeRecognizer();
    r.setHoldTimes(0.2, 0.5);
    const { events } = drive(1, (t) => (t < 0.5 ? 'relaxed' : 'fist'), { recognizer: r });
    expect(events.find((e) => e.type === 'commit')!.t - 0.5).toBeCloseTo(0.2, 1);
    // Tolerance changes results: a flat hand with the thumb out at 38° (flat allows 35°, fox needs 50°)
    // is no shape normally, but flat with one more unit of tolerance (flat allows 43°, fox needs 42°).
    const f = handFeatures(writeHandPose(PRESETS.flat, W, createHandFrame('right')))!;
    f.thumbFwdDeg = 38;
    const strict = new ShapeClassifier('right');
    const lenient = new ShapeClassifier('right', { tolerance: 2 });
    const q = new ShapeEventQueue();
    strict.update(f, 25, 0, 0, q);
    lenient.update(f, 25, 0, 0, q);
    expect(strict.state.candidate).toBeNull();
    expect(lenient.state.candidate).toBe('flat');
    r.setTolerance(10);
    expect(r.left.config.tolerance).toBe(3); // capped
  });

  it('reuses its event objects', () => {
    const r = new ShapeRecognizer();
    const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
    const seen = new Set<object>();
    for (let i = 0; i < 1000; i++) {
      writeHandPose(PRESETS[i % 100 < 50 ? 'fist' : 'cup'], W, hands.right);
      r.update(hands, i / FPS);
      for (let k = 0; k < r.events.count; k++) seen.add(r.events.at(k));
    }
    expect(seen.size).toBeLessThanOrEqual(r.events.capacity);
  });

  it("stamps events with the caller's clock", () => {
    const r = new ShapeRecognizer();
    const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
    writeHandPose(PRESETS.fist, W, hands.right);
    r.update(hands, 1000.25);
    expect(r.events.at(0)).toMatchObject({ type: 'candidate', t: 1000.25 });
  });

  it('counts commits per shape', () => {
    const { r } = drive(2, (t) => (t < 1 ? 'fist' : 'cup'));
    expect(r.commits.fist).toBe(1);
    expect(r.commits.cup).toBe(1);
  });
});
