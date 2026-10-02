import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT, type Handedness, type Vec3 } from './hand';
import { handFeatures } from './hand-features';
import { GestureDetector } from './gesture-detector';
import { ShapeRecognizer } from './shape-recognizer';
import { SHAPES_SCRIPT, ShapeScript } from './shape-script';
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

const FPS = 60;
const W: Vec3 = [0.1, 1, -0.4];

/** A relaxed hand with the thumb `amount` (0..1) of the way onto the index tip. */
function pinch(amount = 1): HandPose {
  const p = clonePose(PRESETS.relaxed);
  p.thumb.pinch = amount;
  p.thumb.pinchTo = 'index';
  return p;
}

type PoseAt = HandPose | PresetName | null;

/** Runs a detector at 60 fps with the right hand following `pose(t)`, the left following `left(t)`. */
function drive(
  seconds: number,
  pose: (t: number) => PoseAt,
  opts: { lantern?: Vec3 | null; wrist?: (t: number) => Vec3; left?: (t: number) => PoseAt; jitter?: number } = {},
) {
  const d = new GestureDetector();
  d.setLantern(opts.lantern ?? null);
  const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
  const random = seededRandom(9);
  const events: { type: string; hand: Handedness; t: number; position: Vec3 }[] = [];
  const write = (side: Handedness, p: PoseAt, wrist: Vec3) => {
    if (p === null) {
      hands[side].tracked = false;
      hands[side].validJoints = 0;
      return;
    }
    writeHandPose(typeof p === 'string' ? PRESETS[p] : p, wrist, hands[side]);
    if (opts.jitter) jitterHand(hands[side], opts.jitter, random);
  };
  for (let i = 0; i <= seconds * FPS; i++) {
    const t = i / FPS;
    write('right', pose(t), opts.wrist?.(t) ?? W);
    write('left', opts.left?.(t) ?? null, [-0.1, 1, -0.4]);
    d.update(hands, t);
    for (let k = 0; k < d.events.count; k++) {
      const e = d.events.at(k);
      events.push({ type: e.type, hand: e.hand, t: e.t, position: [...e.position] as Vec3 });
    }
  }
  return { d, events, hands };
}

/** A pinch held from `from` to `to` seconds, relaxed otherwise. */
const pinchBetween = (from: number, to: number) => (t: number) => (t >= from && t < to ? pinch() : 'relaxed');

/** Where the right hand's palm is for a preset at W, to put the lantern under it. */
function palmOf(preset: PresetName): Vec3 {
  return [...handFeatures(writeHandPose(PRESETS[preset], W, createHandFrame('right')))!.palm.position] as Vec3;
}

describe('pinch-and-release', () => {
  it('fires one pinch-release on release after a 150 ms pinch, where the fingertips met', () => {
    const { events, hands } = drive(1.5, pinchBetween(0.5, 0.8));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'pinch-release', hand: 'right' });
    expect(events[0].t).toBeCloseTo(0.8, 1);
    // The tips' midpoint on a pinched hand at W.
    writeHandPose(pinch(), W, hands.right);
    const p = hands.right.positions,
      a = JOINT['thumb-tip'] * 3,
      b = JOINT['index-finger-tip'] * 3;
    for (let i = 0; i < 3; i++) expect(events[0].position[i]).toBeCloseTo((p[a + i] + p[b + i]) / 2, 3);
  });

  it("doesn't fire for a 120 ms tap, or while the pinch is still held", () => {
    expect(drive(1, pinchBetween(0.5, 0.62)).events).toEqual([]);
    expect(drive(3, pinchBetween(0.5, 99)).events).toEqual([]);
  });

  it('never fires for a half pinch between the enter and exit gaps', () => {
    // Find a thumb position whose gap is between the thresholds.
    let amount = 0;
    for (let a = 0; a <= 1; a += 0.01) {
      const gap = handFeatures(writeHandPose(pinch(a), W, createHandFrame('right')))!.tipGap[0];
      if (gap > 0.22 && gap < 0.33) amount = a;
    }
    expect(amount).toBeGreaterThan(0);
    expect(drive(2, (t) => (t < 0.5 ? 'relaxed' : pinch(amount))).events).toEqual([]);
  });

  it('releases once with tracking noise around the release', () => {
    const { events } = drive(2, pinchBetween(0.5, 1), { jitter: 0.003 });
    expect(events).toHaveLength(1);
  });

  it("doesn't take a fist, or the rabbit's thumb on the ring finger, for a pinch", () => {
    expect(drive(2, (t) => (t >= 0.5 && t < 1.2 ? 'fist' : 'relaxed')).events).toEqual([]);
    expect(drive(2, (t) => (t >= 0.5 && t < 1.2 ? 'rabbit' : 'relaxed')).events).toEqual([]);
  });

  it('fires once for two pinches 0.3 s apart (cooldown), twice for 1.2 s apart', () => {
    const twoPinches = (gap: number) => (t: number) =>
      (t >= 0.2 && t < 0.5) || (t >= 0.5 + gap && t < 0.8 + gap) ? pinch() : 'relaxed';
    expect(drive(2, twoPinches(0.3)).events).toHaveLength(1);
    expect(drive(3, twoPinches(1.2)).events).toHaveLength(2);
  });

  it('keeps a pinch through a 0.1 s tracking dropout, and drops it silently after 0.3 s', () => {
    // Pinch from 0.3 s; tracking drops at 0.6 s; the fingers are open again by the time it returns.
    const dropout = (len: number) => (t: number) =>
      t >= 0.6 && t < 0.6 + len ? null : t >= 0.3 && t < 0.6 + len ? pinch() : 'relaxed';
    expect(drive(2, dropout(0.1)).events).toHaveLength(1);
    expect(drive(2, dropout(0.3)).events).toEqual([]);
  });

  it('places the release where the hand is', () => {
    const { events } = drive(1.5, pinchBetween(0.5, 0.8), { wrist: () => [0.3, 1.2, -0.2] });
    expect(events[0].position[0]).toBeGreaterThan(0.2);
    expect(events[0].position[1]).toBeGreaterThan(1.1);
  });
});

describe('cover-flame', () => {
  const lantern = palmOf('fist');

  it('fires once at the palm after a closed hand covers the lantern for 0.5 s', () => {
    const { events } = drive(1.5, (t) => (t < 0.5 ? 'relaxed' : 'fist'), { lantern });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('cover-flame');
    expect(events[0].t - 0.5).toBeCloseTo(0.5, 1);
    for (let i = 0; i < 3; i++) expect(events[0].position[i]).toBeCloseTo(lantern[i], 3);
  });

  it("doesn't fire after 0.45 s, or 1 cm outside the radius", () => {
    expect(drive(1.5, (t) => (t >= 0.5 && t < 0.95 ? 'fist' : 'relaxed'), { lantern }).events).toEqual([]);
    const away: Vec3 = [lantern[0] + 0.13, lantern[1], lantern[2]];
    expect(drive(1.5, () => 'fist', { lantern: away }).events).toEqual([]);
  });

  it("doesn't fire for an open or cupped hand over the lantern", () => {
    expect(drive(1.5, () => 'flat', { lantern: palmOf('flat') }).events).toEqual([]);
    expect(drive(1.5, () => 'cup', { lantern: palmOf('cup') }).events).toEqual([]);
  });

  it('fires once while held, and again only after leaving and the cooldown', () => {
    expect(drive(4, () => 'fist', { lantern }).events).toHaveLength(1);
    const twice = drive(4, (t) => (t >= 1.5 && t < 2 ? 'relaxed' : 'fist'), { lantern });
    expect(twice.events).toHaveLength(2);
  });

  it('gives one event when both hands cover it', () => {
    // Put both palms within the radius: the left hand mirrored at -x, the lantern between them.
    const mid: Vec3 = [0, lantern[1], lantern[2]];
    const { events } = drive(1.5, () => 'fist', {
      lantern: mid,
      wrist: () => [0.05, 1, -0.4],
      left: () => 'fist',
    });
    expect(events.filter((e) => e.type === 'cover-flame')).toHaveLength(1);
  });

  it('is off without a lantern, and follows the lantern when it moves', () => {
    expect(drive(1.5, () => 'fist', { lantern: null }).events).toEqual([]);
    const d = new GestureDetector();
    d.setLantern([9, 9, 9]);
    const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
    writeHandPose(PRESETS.fist, W, hands.right);
    for (let i = 0; i < FPS; i++) {
      if (i === 10) d.setLantern(lantern);
      d.update(hands, i / FPS);
    }
    expect(d.counts['cover-flame']).toBe(1);
  });
});

describe('gesture detector', () => {
  it('reuses its event objects and stamps them with the caller clock', () => {
    const { d } = drive(0.1, () => 'relaxed');
    const seen = new Set<object>();
    const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
    for (let i = 0; i < 20; i++) {
      for (let k = 0; k < 60; k++) {
        writeHandPose(k >= 10 && k < 30 ? pinch() : PRESETS.relaxed, W, hands.right);
        d.update(hands, 100 + i * 2 + k / FPS);
        for (let e = 0; e < d.events.count; e++) {
          seen.add(d.events.at(e));
          expect(d.events.at(e).t).toBeGreaterThan(100);
        }
      }
    }
    expect(d.counts['pinch-release']).toBe(20);
    expect(seen.size).toBeLessThanOrEqual(d.events.capacity);
  });

  it('uses the shape recognizer features when given them, and pauses with them', () => {
    const shapes = new ShapeRecognizer();
    const d = new GestureDetector();
    const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
    for (let i = 0; i <= 90; i++) {
      const t = i / FPS;
      writeHandPose(t >= 0.3 && t < 0.8 ? pinch() : PRESETS.relaxed, W, hands.right);
      shapes.update(hands, t);
      d.update(hands, t, shapes);
    }
    expect(d.counts['pinch-release']).toBe(1);
    hands.right.validJoints = 20;
    shapes.update(hands, 2);
    d.update(hands, 2, shapes);
    expect(d.state.right.paused).toBe(true);
  });

  it('makes no gestures while playing every shape, with the lantern on the table in front', () => {
    const script = new ShapeScript(SHAPES_SCRIPT);
    const pose = clonePose(PRESETS.relaxed);
    const tableLantern: Vec3 = [0, 0.78, -0.1]; // on the table, below the hands
    const { events } = drive(
      script.duration,
      (t) => {
        const i = script.lastStepFor('right', t);
        const shape = i < 0 ? null : script.steps[i].shape;
        if (shape === null) return null;
        return lerpPose(PRESETS[shape], PRESETS[shape], 0, pose);
      },
      { lantern: tableLantern, jitter: 0.002 },
    );
    expect(events).toEqual([]);
  });
});
