import { describe, expect, it } from 'vitest';
import { FrameTimings, SLOT } from './frame-timings';

describe('frame timings', () => {
  it('averages and keeps the worst frame per slot over a window', () => {
    let t = 0;
    const timings = new FrameTimings(() => t, 4);
    // Shadow costs 1, 1, 1, 5 ms; read costs 0.5 ms every frame.
    for (const cost of [1, 1, 1, 5]) {
      timings.begin(SLOT.read);
      t += 0.5;
      timings.end(SLOT.read);
      timings.begin(SLOT.shadow);
      t += cost;
      timings.end(SLOT.shadow);
      timings.endFrame();
    }
    const r = timings.toJSON();
    expect(r.frames).toBe(4);
    expect(r.msAvg.shadow).toBe(2);
    expect(r.msWorst.shadow).toBe(5);
    expect(r.msAvg.read).toBe(0.5);
    expect(r.msAvg.classify).toBe(0);
  });

  it('reports the last full window and starts the next one clean', () => {
    let t = 0;
    const timings = new FrameTimings(() => t, 2);
    expect(timings.toJSON().frames).toBe(0);
    for (const cost of [2, 2, 10]) {
      timings.begin(SLOT.total);
      t += cost;
      timings.end(SLOT.total);
      timings.endFrame();
    }
    // The third frame is only the start of a new window: the report still shows frames 1 and 2.
    expect(timings.toJSON().msAvg.total).toBe(2);
    expect(timings.toJSON().msWorst.total).toBe(2);
  });

  it('averages a slot over the frames it ran in, not every frame', () => {
    let t = 0;
    const timings = new FrameTimings(() => t, 4);
    // The shadow only runs in two of the four frames, costing 2 ms each time.
    for (const runs of [false, true, false, true]) {
      if (runs) {
        timings.begin(SLOT.shadow);
        t += 2;
        timings.end(SLOT.shadow);
      }
      timings.endFrame();
    }
    const r = timings.toJSON();
    expect(r.msAvg.shadow).toBe(2);
    expect(r.frameShare.shadow).toBe(0.5);
    expect(r.frameShare.lab).toBe(0);
  });
});
