import { FrontSide, Mesh, MeshBasicMaterial, Vector3 } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import type { LanternLight } from './pure/lantern-light';
import { castShadow, paintMoonPatch, paintNight, paintQuilt, paintRain, paintWall } from './room-art';
import { RoomDressingView } from './room-dressing-view';
import { emptyRoomLayout, placement } from '../stage/room-layout';
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
    ['wall', (g: CanvasRenderingContext2D) => paintWall(g, 1024, 640), 60],
    ['side wall', (g: CanvasRenderingContext2D) => paintWall(g, 1280, 640), 60],
    ['night sky', (g: CanvasRenderingContext2D) => paintNight(g, 400, 460, 'sky'), 50],
    ['night hills', (g: CanvasRenderingContext2D) => paintNight(g, 520, 600, 'hills'), 30],
    ['night village', (g: CanvasRenderingContext2D) => paintNight(g, 520, 600, 'village'), 30],
    ['night near ground', (g: CanvasRenderingContext2D) => paintNight(g, 520, 600, 'near'), 20],
    ['night curtains', (g: CanvasRenderingContext2D) => paintNight(g, 440, 520, 'curtains'), 20],
    ['quilt', (g: CanvasRenderingContext2D) => paintQuilt(g, 256, 256), 100],
    ['rain', (g: CanvasRenderingContext2D) => paintRain(g, 256, 256, 3, 38, 46), 30],
    ['moon patch', (g: CanvasRenderingContext2D) => paintMoonPatch(g, 256, 256), 30],
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
  it('has the wall, two side walls, the back wall, the four outside layers of the window and curtains with two layers of rain, and the moon patch, and nothing else (the furniture is models)', () => {
    const v = new RoomDressingView();
    expect(v.group.children).toHaveLength(12);
    v.dispose();
  });

  it('has one-sided walls facing into the room, so from outside (the room editor) the near ones drop away', () => {
    const v = new RoomDressingView();
    v.group.updateMatrixWorld(true);
    const walls = v.group.children.filter((o): o is Mesh => o instanceof Mesh && o.renderOrder === v.wall.renderOrder);
    expect(walls).toHaveLength(4); // the wall behind the stage, the two side walls and the back wall
    const normal = new Vector3();
    const inward = new Vector3();
    for (const w of walls) {
      expect((w.material as MeshBasicMaterial).side).toBe(FrontSide);
      normal.set(0, 0, 1).transformDirection(w.matrixWorld);
      inward.set(0, 1.25, -0.4).sub(w.position); // towards the middle of the room
      expect(normal.dot(inward)).toBeGreaterThan(0);
    }
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
  it('lights the room with the candle as a light: on where the flame is, off with it out, and its walls registered', () => {
    const v = new RoomDressingView();
    const candle = new CandleLight();
    const lit: unknown[] = [];
    const cast: unknown[] = [];
    candle.light = (m) => void lit.push(m);
    candle.cast = (m) => void cast.push(m);
    v.useCandleLight(candle);
    expect(lit).toContain(v.wall.material);
    expect(cast).toEqual([]); // nothing painted stands in the light: the models cast the shadows
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
    for (let i = 0; i < 7; i++) v.spread(true, 0.1); // about half way
    const half = v.reach;
    expect(half).toBeGreaterThan(first);
    for (let i = 0; i < 20; i++) v.spread(true, 0.1); // all the way (SPREAD_S)
    expect(v.spreadAmount).toBe(1);
    expect(v.reach).toBeCloseTo(CANDLE_REACH_M, 5);
    expect(v.reach).toBeGreaterThan(half);
    for (let i = 0; i < 20; i++) v.spread(false, 0.1); // covered: dark again in DARKEN_S
    expect(v.spreadAmount).toBe(0);
    expect(v.reach).toBeCloseTo(first, 5);
    v.dispose();
  });
  it('grows the light with the hold on the wick, so the room is lit as the candle catches, with no dip after', () => {
    const v = new RoomDressingView();
    const candle = new CandleLight();
    v.useCandleLight(candle);
    const intensity = () => candle.uniforms.uCandleIntensity.value;
    const flame = [0, 1.2, -1.9];
    let lastReach = v.reach;
    let lastGlow = 0;
    for (let i = 1; i <= 10; i++) {
      v.ignition = i / 10;
      v.update(light(false), 0, flame);
      v.spread(false, 0.1);
      expect(v.reach).toBeGreaterThan(lastReach);
      expect(intensity()).toBeGreaterThan(lastGlow);
      lastReach = v.reach;
      lastGlow = intensity();
    }
    expect(v.reach).toBeCloseTo(CANDLE_REACH_M, 5); // the whole room by the time it catches
    expect(lastGlow).toBeGreaterThan(0.8);
    v.ignition = 0;
    v.update(light(true, 0), 1, flame); // caught: the flame's own light is only starting to fade in
    expect(intensity()).toBeGreaterThan(0.8 * lastGlow);
    v.spread(true, 0.1);
    expect(v.reach).toBeCloseTo(CANDLE_REACH_M, 5);
    candle.dispose();
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
  it('keeps the window and the moonlight on the floor as they are whatever the candle does', () => {
    const v = new RoomDressingView();
    const meshes = v.group.children as unknown as { material: { color: { r: number; g: number; b: number } } }[];
    const night = meshes[4].material.color;
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

  it('moves the rain down along its lean, the near layer faster, keeps the offsets small, and stays finite for any frame time', () => {
    const v = new RoomDressingView();
    const tiles = (v as unknown as { rain: { offset: { x: number; y: number } }[] }).rain;
    expect(tiles).toHaveLength(2);
    const y0 = tiles.map((t) => t.offset.y);
    const x0 = tiles.map((t) => t.offset.x);
    for (let i = 0; i < 10; i++) v.tick(1 / 60);
    tiles.forEach((t, i) => {
      expect(t.offset.y).toBeGreaterThan(y0[i]);
      expect(t.offset.x).toBeGreaterThan(x0[i]); // along the lean
    });
    expect(tiles[0].offset.y - y0[0]).toBeGreaterThan(tiles[1].offset.y - y0[1]);
    for (let i = 0; i < 72 * 600; i++) v.tick(1 / 72);
    v.tick(1e9);
    v.tick(NaN);
    tiles.forEach((t) => {
      expect(Number.isFinite(t.offset.x)).toBe(true);
      expect(Math.abs(t.offset.y)).toBeLessThan(1);
    });
    v.dispose();
  });

  it('brightens the window and the moonlight on the floor with a lightning flash, and lets them go after', () => {
    const v = new RoomDressingView();
    const outdoor = (v as unknown as { outdoor: { color: { r: number } }[] }).outdoor;
    const patch = (v as unknown as { moonPatch: { color: { b: number } } }).moonPatch;
    v.update(light(false));
    const calm = [outdoor[0].color.r, patch.color.b];
    v.lightning = 1;
    v.update(light(false));
    expect(outdoor[0].color.r).toBeGreaterThan(calm[0] * 2);
    expect(patch.color.b).toBeGreaterThan(calm[1] * 2);
    v.lightning = 0;
    v.update(light(false));
    expect(outdoor[0].color.r).toBeCloseTo(calm[0]);
    expect(patch.color.b).toBeCloseTo(calm[1]);
    v.dispose();
  });

  it('disposes cleanly', () => {
    const v = new RoomDressingView();
    expect(() => v.dispose()).not.toThrow();
  });
});

describe('RoomDressingView and the room layout', () => {
  it('puts the moonlight where the layout says, and keeps the children in order', () => {
    const layout = emptyRoomLayout();
    layout.room['moon-patch'] = placement([-0.8, 0.008, -0.6], [-90, 0, 0]);
    const v = new RoomDressingView(layout);
    expect(v.editables().map((p) => p.id)).toEqual(['moon-patch']);
    const patch = v.editables()[0];
    expect(patch.object.name).toBe('moon-patch');
    expect(patch.object.position.x).toBeCloseTo(-0.8, 6);
    expect(patch.fallback.pos).toEqual([-0.95, 0.008, -0.8]);
    expect(v.group.children).toHaveLength(new RoomDressingView().group.children.length);
  });
});
