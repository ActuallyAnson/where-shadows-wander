// Shared heap measurement for the sim's *.alloc.test.ts files (test support, not game code).
//
// Method (as frame-pipeline.alloc.test.ts): warm the code up so the engine optimises it, collect
// garbage, then run a window of frames and read how much the heap grew. A collection inside the
// window would hide garbage, so the young generation is made large (vitest.config.ts); a window in
// which the heap shrank is thrown away, and it is an error only if every window shrank.
//
// Under a busy test run the optimiser can lag, and code that is still running unoptimised boxes
// every number it touches, which inflates the count. That noise only ever adds bytes, so the
// result is the smallest of up to `attempts` windows: the steady state, not the warm-up.

// The project's TypeScript config has no Node types: reach the Node globals we need through globalThis.
const node = globalThis as unknown as {
  gc?: () => void;
  process: { memoryUsage(): { heapUsed: number }; env: Record<string, string | undefined> };
};

/** Node's `gc`, when the test process runs with `--expose-gc` (vitest.config.ts sets it). */
export const gc = node.gc;
/** Running under CI, where `gc` must be available. */
export const inCI = !!node.process.env.CI;

/**
 * Bytes the heap grows per frame over `frames` calls of `frame`, after `warmup` calls.
 * Stops early once a window comes in under `goodBelow`.
 */
export function bytesPerFrame(
  frame: () => void,
  { frames = 3000, warmup = 20000, attempts = 3, goodBelow = 0 } = {},
): number {
  if (!gc) throw new Error('needs --expose-gc');
  let best = Infinity;
  let collections = 0;
  for (let a = 0; a < attempts; a++) {
    for (let i = 0; i < (a === 0 ? warmup : warmup / 4); i++) frame();
    gc();
    const before = node.process.memoryUsage().heapUsed;
    let last = before;
    let collected = false;
    for (let i = 0; i < frames && !collected; i++) {
      frame();
      if (i % 100 === 99) {
        const now = node.process.memoryUsage().heapUsed;
        collected = now < last;
        last = now;
      }
    }
    if (collected) {
      // Another window may be clean; only a run where every window saw a collection is an error.
      collections++;
      continue;
    }
    const perFrame = (node.process.memoryUsage().heapUsed - before) / frames;
    if (perFrame < best) best = perFrame;
    if (best < goodBelow) break;
  }
  if (collections === attempts)
    throw new Error('a collection ran in every window: the young generation is too small for this window');
  return best;
}
