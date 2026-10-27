import { describe, expect, it } from 'vitest';
import type { LanternLight } from './pure/lantern-light';
import { paintBookcase, paintNight, paintRug, paintWall } from './room-art';
import { RoomDressingView } from './room-dressing-view';

/** A 2D context that accepts any call and counts the drawing ones, with gradients that take colour stops. */
function recordingContext(): { g: CanvasRenderingContext2D; calls: () => number } {
  let n = 0;
  const store: Record<string | symbol, unknown> = {};
  const g = new Proxy(store, {
    get(t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop in t) return t[prop];
      return () => {
        n++;
      };
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { g, calls: () => n };
}

const light = (lit: boolean, intensity = 1) => ({ lit, intensity }) as unknown as Readonly<LanternLight>;

describe('room art painters', () => {
  it.each([
    ['wall', (g: CanvasRenderingContext2D) => paintWall(g, 1024, 640)],
    ['plain wall', (g: CanvasRenderingContext2D) => paintWall(g, 1280, 640, false)],
    ['night', (g: CanvasRenderingContext2D) => paintNight(g, 440, 520)],
    ['bookcase', (g: CanvasRenderingContext2D) => paintBookcase(g, 400, 720)],
    ['rug', (g: CanvasRenderingContext2D) => paintRug(g, 512, 360)],
  ])('paints the %s without throwing, and draws a lot', (_name, paint) => {
    const { g, calls } = recordingContext();
    expect(() => paint(g)).not.toThrow();
    expect(calls()).toBeGreaterThan(100);
  });

  it('paints the furnished wall with more than the plain one', () => {
    const a = recordingContext();
    const b = recordingContext();
    paintWall(a.g, 1024, 640, true);
    paintWall(b.g, 1024, 640, false);
    expect(a.calls()).toBeGreaterThan(b.calls());
  });
});

describe('RoomDressingView', () => {
  it('has the wall, two side walls, the window night, the bookcase and the rug', () => {
    const v = new RoomDressingView();
    expect(v.group.children).toHaveLength(6);
    v.dispose();
  });

  it('puts the wallpaper wall just in front of the stage-side wall, never nearer than 1.5 m plus its margin', () => {
    const v = new RoomDressingView();
    v.place(2.0);
    expect(v.wall.position.z).toBeCloseTo(-2.35 + 0.012, 3);
    v.place(0.75); // the tabletop stage: the wall stays behind it
    expect(v.wall.position.z).toBeCloseTo(-1.85 + 0.012, 3);
    v.dispose();
  });

  it('is dark and blue unlit, and warmer and brighter with the candle', () => {
    const v = new RoomDressingView();
    const colour = () => (v.wall.material as unknown as { color: { r: number; g: number; b: number } }).color;
    v.update(light(false), 1);
    const dark = { ...colour() };
    expect(dark.b).toBeGreaterThan(dark.r); // blue by moonlight
    v.update(light(true, 1), 1);
    const warm = { ...colour() };
    expect(warm.r).toBeGreaterThan(dark.r * 2);
    expect(warm.r).toBeGreaterThan(warm.b); // warm by candlelight
    v.update(light(true, 1), 0); // the flame covered: back to the dark
    expect(colour().r).toBeLessThan(warm.r);
    v.dispose();
  });

  it('disposes cleanly', () => {
    const v = new RoomDressingView();
    expect(() => v.dispose()).not.toThrow();
  });
});
