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
import { CANDLE_REACH_M, CandleLight } from './candle-light';

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

  it('has one lighting model: the art keeps its own colour, and the candle light glows as it is lit, then burns', () => {
    const v = new RoomDressingView();
    const candle = new CandleLight();
    v.useCandleLight(candle);
    const intensity = () => candle.uniforms.uCandleIntensity.value;
    const wallColour = () => (v.wall.material as unknown as { color: { r: number; b: number } }).color;
    const flame = [0, 1.2, -1.9];
    v.update(light(false), 0, flame);
    expect(intensity()).toBe(0); // only the moon
    const own = { ...wallColour() };
    v.ignition = 0.5;
    v.update(light(false), 0, flame);
    const holding = intensity();
    expect(holding).toBeGreaterThan(0); // it glows as the wick is held
    v.ignition = 1;
    v.update(light(false), 0, flame);
    expect(intensity()).toBeGreaterThan(holding);
    v.update(light(true, 1), 1, flame);
    expect(intensity()).toBeGreaterThan(0.9); // it burns
    expect(wallColour()).toEqual(own); // the light changes, never the art's colour
    v.update(light(true, 1), 0, flame); // covered
    expect(intensity()).toBe(0);
    candle.dispose();
    v.dispose();
  });
  it('lights the room with the candle as a light: on where the flame is, off with it out, and its art and props registered', () => {
    const v = new RoomDressingView();
    const candle = new CandleLight();
    const lit: unknown[] = [];
    const cast: unknown[] = [];
    candle.light = (m) => void lit.push(m);
    candle.cast = (m) => void cast.push(m);
    v.useCandleLight(candle);
    expect(lit).toContain(v.wall.material);
    expect(cast.length).toBeGreaterThanOrEqual(8); // the pictures and shelves, the bookcase and the bed's four parts
    v.update(light(true, 1), 1, [0, 1.2, -1.9]);
    expect(candle.uniforms.uCandleIntensity.value).toBeGreaterThan(0.5);
    expect(candle.uniforms.uCandlePos.value.z).toBeCloseTo(-1.9, 5);
    v.update(light(false), 0, [0, 1.2, -1.9]);
    expect(candle.uniforms.uCandleIntensity.value).toBe(0);
    candle.dispose();
    v.dispose();
  });

  it('spreads the candlelight out from the flame once lit, and draws it back when the flame goes out', () => {
    const v = new RoomDressingView();
    const first = v.reach;
    expect(v.spreadAmount).toBe(0);
    for (let i = 0; i < 40; i++) v.spread(true, 0.1); // half way
    const half = v.reach;
    expect(half).toBeGreaterThan(first);
    for (let i = 0; i < 60; i++) v.spread(true, 0.1); // all the way (SPREAD_S)
    expect(v.spreadAmount).toBe(1);
    expect(v.reach).toBeCloseTo(CANDLE_REACH_M, 5);
    expect(v.reach).toBeGreaterThan(half);
    for (let i = 0; i < 20; i++) v.spread(false, 0.1); // covered: dark again in DARKEN_S
    expect(v.spreadAmount).toBe(0);
    expect(v.reach).toBeCloseTo(first, 5);
    v.dispose();
  });
  it('flickers with the flame (the light follows the lantern), and holds steady without one', () => {
    const v = new RoomDressingView();
    const candle = new CandleLight();
    v.useCandleLight(candle);
    const intensity = () => candle.uniforms.uCandleIntensity.value;
    v.update(light(true, 1), 1, [0, 1.2, -1.9]);
    const full = intensity();
    v.update(light(true, 0.8), 1, [0, 1.2, -1.9]);
    expect(intensity()).toBeLessThan(full);
    expect(intensity() / full).toBeGreaterThan(0.75); // only a little
    v.update(light(false), 0);
    expect(intensity()).toBe(0);
    candle.dispose();
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

  it('keeps the window and the moonlight on the floor as they are whatever the candle does', () => {
    const v = new RoomDressingView();
    const meshes = v.group.children as unknown as { material: { color: { r: number; g: number; b: number } } }[];
    const night = meshes[3].material.color;
    const patch = meshes[11].material.color;
    v.update(light(false), 1);
    const nightDark = { ...night };
    const patchDark = { ...patch };
    v.update(light(true, 1), 1);
    expect({ ...night }).toEqual(nightDark);
    expect({ ...patch }).toEqual(patchDark); // the candle adds light; it never takes the moon's away
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
