import { describe, expect, it } from 'vitest';
import type { LanternLight } from './pure/lantern-light';
import {
  castShadow,
  paintBookcase,
  paintMoonPatch,
  paintNight,
  paintQuilt,
  paintRug,
  paintSill,
  paintSnow,
  paintWall,
  paintWallThings,
  paintWood,
} from './room-art';
import { RenderOrder } from './pure/render-order';
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
    ['wall', (g: CanvasRenderingContext2D) => paintWall(g, 1024, 640), 100],
    ['side wall', (g: CanvasRenderingContext2D) => paintWall(g, 1280, 640), 100],
    ['wall pictures', (g: CanvasRenderingContext2D) => paintWallThings(g, 1024, 320, 'pictures'), 40],
    ['wall shelves', (g: CanvasRenderingContext2D) => paintWallThings(g, 1024, 320, 'shelves'), 40],
    ['wood', (g: CanvasRenderingContext2D) => paintWood(g, 128, 128), 20],
    ['night sky', (g: CanvasRenderingContext2D) => paintNight(g, 400, 460, 'sky'), 50],
    ['night hills', (g: CanvasRenderingContext2D) => paintNight(g, 520, 600, 'hills'), 30],
    ['night village', (g: CanvasRenderingContext2D) => paintNight(g, 520, 600, 'village'), 30],
    ['night near ground', (g: CanvasRenderingContext2D) => paintNight(g, 520, 600, 'near'), 20],
    ['night curtains', (g: CanvasRenderingContext2D) => paintNight(g, 440, 520, 'curtains'), 20],
    ['bookcase', (g: CanvasRenderingContext2D) => paintBookcase(g, 400, 720), 100],
    ['quilt', (g: CanvasRenderingContext2D) => paintQuilt(g, 256, 256), 100],
    ['rug', (g: CanvasRenderingContext2D) => paintRug(g, 512, 360), 100],
    ['snow', (g: CanvasRenderingContext2D) => paintSnow(g, 256, 256, 3, 34, 5.5), 30],
    ['moon patch', (g: CanvasRenderingContext2D) => paintMoonPatch(g, 256, 256), 30],
    ['sill', (g: CanvasRenderingContext2D) => paintSill(g, 300, 180), 60],
  ])('paints the %s without throwing, and draws a fair amount', (_name, paint, min) => {
    const { g, calls } = recordingContext();
    expect(() => paint(g)).not.toThrow();
    expect(calls()).toBeGreaterThan(min);
  });

  it('casts a shadow of a layer without drawing the layer on the wall itself', () => {
    const { g, calls } = recordingContext();
    const store = g as unknown as { shadowBlur: number; shadowOffsetX: number };
    castShadow(g, {} as CanvasImageSource, 0, 120, 6, 9, 7, 0.5);
    expect(calls()).toBeGreaterThan(0);
    expect(store.shadowBlur).toBe(7);
    expect(store.shadowOffsetX).toBeGreaterThan(6); // the layer is drawn off to the side, the shadow is brought back
  });
});

describe('RoomDressingView', () => {
  it('has the wall, two side walls, the four outside layers of the window and curtains with two layers of snow, the sill, the moon patch, the bookcase front and box, the rug, and the pictures and shelves held off the wall', () => {
    const v = new RoomDressingView();
    expect(v.group.children).toHaveLength(25);
    v.dispose();
  });

  it('puts the wallpaper wall just behind the stage (the stage is on it), never nearer than 1.5 m', () => {
    const v = new RoomDressingView();
    v.place(2.0);
    expect(v.wall.position.z).toBeCloseTo(-2.02 + 0.012, 3);
    expect(v.wall.position.z).toBeLessThan(-2.0); // behind the stage, not through it
    v.place(0.75); // the tabletop stage: the wall stays behind it
    expect(v.wall.position.z).toBeCloseTo(-1.52 + 0.012, 3);
    v.dispose();
  });

  it('holds the pictures and then the shelves off the wall, further out each, and moves them with the wall', () => {
    const v = new RoomDressingView();
    const [pictures, shelves] = [v.group.children[14], v.group.children[16]];
    v.place(2.0);
    expect(pictures.position.z).toBeGreaterThan(v.wall.position.z + 0.02);
    expect(shelves.position.z).toBeGreaterThan(pictures.position.z + 0.04);
    v.place(0.75);
    expect(shelves.position.z).toBeCloseTo(v.wall.position.z + 0.1, 3);
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

  it('lights the room from the flame: bright near it, dark far from it, and evenly when there is no flame', () => {
    const v = new RoomDressingView();
    const vertexColour = (i: number) =>
      (v.wall.geometry.attributes.color as unknown as { getX: (n: number) => number }).getX(i);
    for (let i = 0; i < 200; i++) v.spread(true, 0.1); // the light has spread all the way
    v.update(light(true, 1), 1, [0, 1.2, -1.9]); // the flame just in front of the wall
    const near = vertexColour(0);
    v.update(light(true, 1), 1, [0, 1.2, 3]); // the flame far behind the player
    const far = vertexColour(0);
    expect(near).toBeGreaterThan(far * 1.5);
    expect(far).toBeGreaterThan(0.05); // never pitch black
    v.update(light(false), 0);
    expect(vertexColour(0)).toBe(1);
    v.dispose();
  });

  it('spreads the candlelight out from the flame once lit, and draws it back when the flame goes out', () => {
    const v = new RoomDressingView();
    const vertexColour = (i: number) =>
      (v.wall.geometry.attributes.color as unknown as { getX: (n: number) => number }).getX(i);
    v.update(light(true, 1), 1, [0, 1.2, -1.2]); // the flame a metre from the wall
    const first = vertexColour(0);
    expect(v.spreadAmount).toBe(0);
    for (let i = 0; i < 40; i++) v.spread(true, 0.1); // half way
    const half = vertexColour(0);
    expect(half).toBeGreaterThan(first);
    for (let i = 0; i < 60; i++) v.spread(true, 0.1); // all the way (SPREAD_S)
    const full = vertexColour(0);
    expect(v.spreadAmount).toBe(1);
    expect(full).toBeGreaterThan(half);
    for (let i = 0; i < 20; i++) v.spread(false, 0.1); // covered: dark again in DARKEN_S
    expect(v.spreadAmount).toBe(0);
    expect(vertexColour(0)).toBeCloseTo(first, 3);
    v.dispose();
  });

  it('flickers with the flame, differently from piece to piece, and holds steady without one', () => {
    const v = new RoomDressingView();
    const wallColour = () => (v.wall.material as unknown as { color: { r: number } }).color.r;
    const seen = new Set<number>();
    for (let i = 0; i < 30; i++) {
      v.update(light(true, 1), 1, [0, 1.2, -1.9]);
      seen.add(Math.round(wallColour() * 1000));
      v.tick(0.05);
    }
    expect(seen.size).toBeGreaterThan(5); // it moves
    const lo = Math.min(...seen) / 1000;
    const hi = Math.max(...seen) / 1000;
    expect(hi / lo).toBeLessThan(1.4); // but only a little
    seen.clear();
    for (let i = 0; i < 10; i++) {
      v.update(light(false), 0);
      seen.add(Math.round(wallColour() * 1000));
      v.tick(0.05);
    }
    expect(seen.size).toBe(1);
    v.dispose();
  });

  it('lights the wonders of the room one by one as the night goes, and puts them out again on a restart', () => {
    const v = new RoomDressingView();
    const glow = () => {
      const mesh = v.group.children.find(
        (c) =>
          c.renderOrder === RenderOrder.wonder &&
          (c as unknown as { geometry: { attributes: { color?: unknown } } }).geometry.attributes.color,
      ) as unknown as {
        geometry: { attributes: { color: { array: Float32Array } } };
      };
      return Array.from(mesh.geometry.attributes.color.array).reduce((a, b) => a + b, 0);
    };
    v.update(light(true, 1), 1, [0, 1.2, -1]);
    v.tick(0.1);
    expect(glow()).toBe(0); // nothing is lit yet
    v.setAwake(1);
    for (let i = 0; i < 80; i++) v.tick(0.05);
    const one = glow();
    expect(one).toBeGreaterThan(0);
    v.setAwake(3);
    for (let i = 0; i < 80; i++) v.tick(0.05);
    const three = glow();
    expect(three).toBeGreaterThan(one * 1.5);
    v.setAwake(99); // more than there are: all of them
    for (let i = 0; i < 200; i++) v.tick(0.05);
    expect(glow()).toBeGreaterThan(three);
    v.setAwake(0);
    for (let i = 0; i < 200; i++) v.tick(0.05);
    expect(glow()).toBeCloseTo(0, 5);
    v.setAwake(NaN);
    v.dispose();
  });

  it('keeps the window one cool colour whatever the room does, and dims the moon patch under the candle', () => {
    const v = new RoomDressingView();
    const meshes = v.group.children as unknown as { material: { color: { r: number; g: number; b: number } } }[];
    const night = meshes[3].material.color;
    const patch = meshes[11].material.color;
    v.update(light(false), 1);
    const nightDark = { ...night };
    const patchDark = { ...patch };
    v.update(light(true, 1), 1);
    expect({ ...night }).toEqual(nightDark);
    expect(patch.b).toBeLessThan(patchDark.b);
    v.dispose();
  });

  it('slides the far outside layers more than the near ones as the head moves, and never past the painted margin', () => {
    const v = new RoomDressingView();
    const tex = (v as unknown as { outside: { offset: { x: number; y: number } }[] }).outside;
    expect(tex).toHaveLength(4);
    v.tick(0, { x: 0, y: 1.45, z: -0.8 }); // in front of the window's middle: nothing slides
    const mid = tex.map((t) => t.offset.x);
    v.tick(0, { x: 0, y: 1.45, z: 0.4 });
    const moved = tex.map((t, i) => Math.abs(t.offset.x - mid[i]));
    expect(moved[0]).toBeGreaterThan(moved[1]);
    expect(moved[1]).toBeGreaterThan(moved[2]);
    expect(moved[2]).toBeGreaterThan(moved[3]);
    v.tick(0, { x: 0, y: 1.45, z: 500 }); // far away: stops at the margin
    for (const t of tex) expect(Math.abs(t.offset.x - 24 / 268)).toBeLessThanOrEqual((24 / 268) * 0.9 + 1e-9);
    v.dispose();
  });

  it('moves the snow down and side to side, and stays finite for any frame time', () => {
    const v = new RoomDressingView();
    const tiles = (v as unknown as { snow: { offset: { x: number; y: number } }[] }).snow;
    expect(tiles).toHaveLength(2);
    const y0 = tiles.map((t) => t.offset.y);
    for (let i = 0; i < 120; i++) v.tick(1 / 60);
    tiles.forEach((t, i) => expect(t.offset.y).toBeGreaterThan(y0[i]));
    v.tick(1e9);
    v.tick(NaN);
    tiles.forEach((t) => expect(Number.isFinite(t.offset.x)).toBe(true));
    v.dispose();
  });

  it('disposes cleanly', () => {
    const v = new RoomDressingView();
    expect(() => v.dispose()).not.toThrow();
  });

  it('has live bunting that sways, can be blown by the wind, and rippled when the spark lands', () => {
    const v = new RoomDressingView();
    const motion = () => (v as unknown as { bunting: { motion: number } }).bunting.motion;
    for (let i = 0; i < 240; i++) v.tick(1 / 60);
    expect(motion()).toBeGreaterThan(0);
    v.setWind(0);
    for (let i = 0; i < 60 * 25; i++) v.tick(1 / 60);
    const quiet = motion();
    v.rippleBunting();
    for (let i = 0; i < 20; i++) v.tick(1 / 60);
    expect(motion()).toBeGreaterThan(quiet);
    v.dispose();
  });
});
