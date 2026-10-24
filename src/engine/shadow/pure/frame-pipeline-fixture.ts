// Shared by the allocation tests of the per-frame pipeline: synthetic hands cycling through the shapes (baked once),
// the stages of the frame loop that need no engine services (shape recognizer, gesture detector, sharpen, lantern
// light, shadow projector), and a heap measurement that fails if a collection ran in the window.
import { GestureDetector } from '../../hands/gesture-detector';
import { createHandFrame, type HandFrame, type Handedness } from '../../hands/hand';
import { ShapeRecognizer } from '../../hands/shape-recognizer';
import { LanternLightModel } from './lantern-light';
import { ShadowSharpen } from './shadow-sharpen';
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
export const node = globalThis as unknown as {
  gc?: () => void;
  process: { memoryUsage(): { heapUsed: number }; env: Record<string, string | undefined> };
};
export const gc = node.gc;
export const FPS = 72;
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

/** What a frame's later stages (the renderers, the audio) read from the hand pipeline. */
export interface PipelineParts {
  shapes: ShapeRecognizer;
  projector: ShadowProjector;
  sharpen: ShadowSharpen;
  stage: ReturnType<typeof createStagePlane>;
}

export function makePipeline(extra?: (parts: PipelineParts) => void) {
  const baked = bakeFrames();
  const shapes = new ShapeRecognizer();
  const gestures = new GestureDetector();
  const sharpen = new ShadowSharpen();
  const light = new LanternLightModel();
  const states = { left: shapes.left.state, right: shapes.right.state };
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
    sharpen.update(states, shapes.events, 1 / FPS);
    light.update(t, lantern, true);
    projector.update(hands, stage, lantern);
    extra?.({ shapes, projector, sharpen, stage });
    frame++;
  };
}

/**
 * Heap growth over `frames` steps, after a warm-up and a full collection. The young generation is sized
 * (vitest.config.ts) so no collection runs in the window; the heap is sampled as it goes and the test
 * fails if it ever shrinks, because a collection would then have freed exactly the short-lived garbage
 * this test exists to find.
 */
export function measure(step: () => void, frames: number): { heapBytes: number } {
  for (let i = 0; i < 60000; i++) step(); // warm up: JIT, first-use buffers
  gc!();
  const before = node.process.memoryUsage().heapUsed;
  let last = before;
  for (let i = 0; i < frames; i++) {
    step();
    if (i % 100 === 99) {
      const now = node.process.memoryUsage().heapUsed;
      if (now < last)
        throw new Error(`a collection ran at frame ${i}: the young generation is too small for this window`);
      last = now;
    }
  }
  return { heapBytes: node.process.memoryUsage().heapUsed - before };
}
