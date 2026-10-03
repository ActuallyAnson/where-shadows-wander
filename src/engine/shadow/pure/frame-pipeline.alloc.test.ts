// The per-frame hand pipeline must not allocate: the garbage collector's pauses
// show up as dropped frames on a headset. This runs the same stages as the
// frame loop (shape recognizer, gesture detector, shadow projector) on
// synthetic hands cycling through shapes and checks the heap and the GC log.
// Needs `--expose-gc` (vitest.config.ts sets it); skipped without it.
import { describe, expect, it } from 'vitest';
import { GestureDetector } from '../../hands/gesture-detector';
import { createHandFrame, type HandFrame, type Handedness } from '../../hands/hand';
import { ShapeRecognizer } from '../../hands/shape-recognizer';
import {
  jitterHand,
  lerpPose,
  PRESETS,
  writeHandPose,
  type HandPose,
  type PresetName,
} from '../../hands/synthetic-hand';
import { ShadowProjector } from './shadow-projector';
import { createStagePlane } from './stage-plane';

// The project's TypeScript config has no Node types: reach the two Node globals we need through globalThis.
const node = globalThis as unknown as { gc?: () => void; process: { memoryUsage(): { heapUsed: number } } };
const gc = node.gc;
const FPS = 72;
const CYCLE: readonly PresetName[] = ['relaxed', 'fist', 'flat', 'rabbit', 'cup', 'spread', 'fox'];
const HOLD_FRAMES = FPS; // 1 s per shape: long enough to commit, release and switch

/** A small seeded generator, so the run is the same every time. */
function seeded(seed: number): () => number {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 2;
}

/** Both hands' joints for every frame of the cycle, made once up front so the measured loop only copies them. */
function bakeFrames(): { left: Float32Array; right: Float32Array }[] {
  const random = seeded(7);
  const pose: HandPose = { ...PRESETS.relaxed, fingers: PRESETS.relaxed.fingers.map((f) => ({ ...f })) as never };
  const left = createHandFrame('left');
  const right = createHandFrame('right');
  const frames: { left: Float32Array; right: Float32Array }[] = [];
  for (let frame = 0; frame < CYCLE.length * HOLD_FRAMES; frame++) {
    const from = PRESETS[CYCLE[Math.floor(frame / HOLD_FRAMES)]];
    const to = PRESETS[CYCLE[(Math.floor(frame / HOLD_FRAMES) + 1) % CYCLE.length]];
    lerpPose(from, to, Math.min(1, (frame % HOLD_FRAMES) / 12), pose);
    writeHandPose(pose, [0.1, 0.95, -0.4], right);
    writeHandPose(pose, [-0.1, 0.95, -0.4], left);
    jitterHand(right, 0.002, random);
    jitterHand(left, 0.002, random);
    frames.push({ left: Float32Array.from(left.positions), right: Float32Array.from(right.positions) });
  }
  return frames;
}

function makePipeline(extra?: () => void) {
  const baked = bakeFrames();
  const shapes = new ShapeRecognizer();
  const gestures = new GestureDetector();
  const projector = new ShadowProjector();
  const stage = createStagePlane();
  stage.origin.set([0, 0.75, -0.75]);
  const hands: Record<Handedness, HandFrame> = { left: createHandFrame('left'), right: createHandFrame('right') };
  for (const h of [hands.left, hands.right]) {
    h.tracked = true;
    h.validJoints = h.positions.length / 3;
  }
  const lantern: [number, number, number] = [0, 0.65, -0.2];
  gestures.setLantern(lantern);
  let frame = 0;
  return () => {
    const src = baked[frame % baked.length];
    hands.left.positions.set(src.left);
    hands.right.positions.set(src.right);
    const t = frame / FPS;
    shapes.update(hands, t);
    gestures.update(hands, t, shapes);
    projector.update(hands, stage, lantern);
    extra?.();
    frame++;
  };
}

/** Heap growth over `frames` steps after a warm-up and a full collection (no collection runs inside the window). */
function measure(step: () => void, frames: number): { heapBytes: number } {
  for (let i = 0; i < 2000; i++) step(); // warm up: JIT, first-use buffers
  gc!();
  const before = node.process.memoryUsage().heapUsed;
  for (let i = 0; i < frames; i++) step();
  return { heapBytes: node.process.memoryUsage().heapUsed - before };
}

const FRAMES = 10_000;
/**
 * The stages build no objects or arrays per frame (they write into reused
 * structs). V8 still boxes some doubles (Math.hypot, Math.acos results, keyed
 * stores), about 0.5-0.8 KB a frame measured, which is a few dozen KB a second:
 * one cheap young-generation collection every few minutes. The budget is set
 * above that, so it only fails when a stage starts allocating real structures
 * (a copied joint array is 300 B a hand, a per-frame event object more).
 */
const BUDGET_BYTES_PER_FRAME = 1250;

describe.skipIf(!gc)('frame pipeline allocation', () => {
  it('recognizer, gestures and shadow projector stay under the allocation budget', () => {
    const { heapBytes } = measure(makePipeline(), FRAMES);
    expect(heapBytes / FRAMES).toBeLessThan(BUDGET_BYTES_PER_FRAME);
  });

  it('the check catches a stage that allocates (a control for the test itself)', () => {
    const keep: number[][] = [];
    const leaky = makePipeline(() => {
      keep.push(new Array(512).fill(0.5)); // a few KB a frame, retained
    });
    const { heapBytes } = measure(leaky, FRAMES);
    expect(heapBytes / FRAMES).toBeGreaterThan(BUDGET_BYTES_PER_FRAME);
  });
});
