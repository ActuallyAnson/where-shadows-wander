import { describe, expect, it } from 'vitest';
import { FadeView } from './fade-view';

const head = { x: 1, y: 1.2, z: -3 };
const run = (f: FadeView, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.02) f.update(0.02, head);
};

describe('FadeView', () => {
  it('starts clear and hidden', () => {
    const f = new FadeView();
    expect(f.alpha).toBe(0);
    expect(f.fading).toBe(false);
    f.dispose();
  });

  it('fades to black and back over the time asked, calling back once each time', () => {
    const f = new FadeView();
    let done = 0;
    f.fadeTo(1, 1, () => done++);
    expect(f.fading).toBe(true);
    run(f, 0.5);
    expect(f.alpha).toBeGreaterThan(0.3);
    expect(f.alpha).toBeLessThan(0.7);
    expect(done).toBe(0);
    run(f, 1);
    expect(f.alpha).toBe(1);
    expect(done).toBe(1);
    expect(f.fading).toBe(false);
    f.fadeTo(0, 0.5, () => done++);
    run(f, 1);
    expect(f.alpha).toBe(0);
    expect(done).toBe(2);
    f.dispose();
  });

  it('follows the head while it is dark, and never gets darker than black or clearer than clear', () => {
    const f = new FadeView();
    f.fadeTo(5, 0.2);
    run(f, 0.5);
    expect(f.alpha).toBe(1);
    const sphere = (f.group.children[0] as unknown as { position: { x: number; y: number; z: number } }).position;
    expect(sphere).toMatchObject({ x: 1, y: 1.2, z: -3 });
    f.fadeTo(-3, 0.2);
    run(f, 0.5);
    expect(f.alpha).toBe(0);
    f.dispose();
  });

  it('does a zero-length fade at once, can cut to black, and drops the callback of a fade that is replaced', () => {
    const f = new FadeView();
    let a = 0;
    let b = 0;
    f.fadeTo(1, 0, () => a++);
    expect(f.alpha).toBe(1);
    expect(a).toBe(1);
    f.setBlack(false);
    expect(f.alpha).toBe(0);
    f.fadeTo(1, 1, () => a++);
    run(f, 0.3);
    f.fadeTo(0, 0.3, () => b++);
    run(f, 1);
    expect(a).toBe(1);
    expect(b).toBe(1);
    f.dispose();
  });

  it('ignores a frame time that is negative or not a number', () => {
    const f = new FadeView();
    f.fadeTo(1, 1);
    expect(() => {
      f.update(-1, head);
      f.update(NaN, head);
    }).not.toThrow();
    expect(f.alpha).toBe(0);
    f.dispose();
  });
});
