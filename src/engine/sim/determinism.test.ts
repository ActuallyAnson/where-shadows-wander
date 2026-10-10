// The sim's contract: step N's state depends only on the seed and the inputs, never on the display
// rate that grouped the steps into frames. This drives a small rain-and-crows toy sim (EntityStore,
// Rng, InputLatch, FixedStepLoop together) at four display rates and compares the columns bit for bit.
import { describe, expect, it } from 'vitest';
import { ShapeEventQueue } from '../hands/shape-events';
import { DEFAULT_CAPACITIES, Kind } from './entity-kinds';
import { EntityStore } from './entity-store';
import { FixedStepLoop } from './fixed-step';
import { InputLatch } from './input-latch';
import { Rng } from './rng';

const STEPS = 10_000;

function run(displayHz: number): EntityStore {
  const store = new EntityStore(DEFAULT_CAPACITIES);
  const rng = new Rng(1234);
  const latch = new InputLatch();
  const src = new ShapeEventQueue();
  let wind = 0;
  const loop = new FixedStepLoop(60, (dt) => {
    if (loop.steps >= STEPS) return;
    // Inputs are keyed to the step that consumes them, so they are display-rate independent.
    for (let i = 0; i < latch.shapes.count; i++) if (latch.shapes.at(i).type === 'commit') wind = -wind + 0.5;
    latch.consume();
    store.beginStep();
    if (rng.next() < 0.3) store.create(Kind.Raindrop, rng.range(-0.8, 0.8), 0.6, 0.01, 0, -0.5);
    for (let s = 0; s < store.capacity; s++) {
      if (!store.alive[s]) continue;
      store.vx[s] += wind * dt;
      store.vy[s] -= 9.8 * dt;
      store.x[s] += store.vx[s] * dt;
      store.y[s] += store.vy[s] * dt;
      if (store.y[s] < -0.6) store.destroy(store.handleAt(s));
    }
  });
  let f = 0;
  while (loop.steps < STEPS) {
    src.clear();
    // One commit per simulated second, delivered on whichever frame first crosses it.
    if (Math.floor((f + 1) / displayHz) > Math.floor(f / displayHz)) src.push('commit', 'right', 'spread', f, 0, 0.4);
    latch.capture(src, null);
    loop.advance(1 / displayHz);
    f++;
  }
  return store;
}

describe('simulation determinism', () => {
  it('reaches bit-identical state after the same steps at 72, 90 and 120 Hz', () => {
    const ref = run(60);
    expect(ref.count).toBeGreaterThan(0);
    for (const hz of [72, 90, 120]) {
      const other = run(hz);
      expect(other.count).toBe(ref.count);
      for (const col of ['x', 'y', 'vx', 'vy', 'px', 'py'] as const) {
        expect(new Uint8Array(other[col].buffer)).toEqual(new Uint8Array(ref[col].buffer));
      }
      expect(Array.from(other.alive)).toEqual(Array.from(ref.alive));
    }
  });
});
