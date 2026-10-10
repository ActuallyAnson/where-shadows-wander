// A whole game frame must build no objects or arrays: here, the busiest scene in the chapter (the
// rain puzzle: a shower spawning and bursting drops, a moving cup catching some of them, the
// traveller waiting at the edge of the rain) for thousands of frames. What remains is the engine
// boxing numbers across calls it didn't inline (see the note in src/engine/sim/solver.ts); the
// budget follows frame-pipeline.alloc.test.ts: about 1.5 times the measured figure (212 B).
import { describe, expect, it } from 'vitest';
import chapter1 from '../../public/scenes/chapter-1.iwsdk.scene.json';
import { createHandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import { bytesPerFrame, gc, inCI } from '../engine/sim/alloc-measure';
import { cupShadow } from '../engine/sim/shadow-shapes';
import { Game, type GameInput } from './game';
import { createChapter1 } from './puzzles/index';
import { newSave } from './save-state';

const FRAMES = 2_000;
const BUDGET_BYTES_PER_FRAME = 320;
const TIMEOUT_MS = 120_000;

function makeFrame(extra?: () => void) {
  const save = newSave();
  save.puzzle = 1;
  const game = new Game({ chapter: chapter1, puzzles: createChapter1(), save });
  const right = createHandShadow('right');
  const queue = new ShapeEventQueue();
  const input: GameInput = { dt: 1 / 72, paused: false, left: null, right, shapeEvents: queue };
  let frame = 0;
  return () => {
    queue.clear();
    if (frame === 1) queue.push('commit', 'right', 'cup', 0, 0.5, 0.4);
    // Sweep the cup over the far half of the cloud: it catches drops, but the near half keeps
    // raining on the path, so the traveller waits and the puzzle never ends (a load would allocate).
    const cx = 0.12 + Math.sin(frame * 0.01) * 0.05;
    cupShadow(right, cx, -0.05);
    game.frame(input);
    extra?.();
    frame++;
  };
}

it('has garbage collection exposed when running in CI', () => {
  expect(gc !== undefined || !inCI).toBe(true);
});

describe.skipIf(!gc)('game frame allocation', () => {
  it(
    'a busy frame of the rain puzzle stays under the allocation budget',
    () => {
      const bytes = bytesPerFrame(makeFrame(), { frames: FRAMES, warmup: 6000, goodBelow: BUDGET_BYTES_PER_FRAME / 2 });
      console.info(`game frame allocates ${bytes.toFixed(1)} B a frame`);
      expect(bytes).toBeLessThan(BUDGET_BYTES_PER_FRAME);
    },
    TIMEOUT_MS,
  );
});
