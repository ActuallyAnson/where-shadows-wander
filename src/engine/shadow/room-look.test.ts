import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Material } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { CandleLight } from './candle-light';
import { toRoomLook } from './room-look';

const model = (material: Material | Material[]): Group => {
  const g = new Group();
  g.add(new Mesh(new BoxGeometry(1, 1, 1), material));
  return g;
};

describe('toRoomLook', () => {
  it("gives every surface the room's material, keeping its colour and how see-through it is", () => {
    const candle = new CandleLight();
    const made: Material[] = [];
    const glass = new MeshStandardMaterial({ color: 0x336699, transparent: true, opacity: 0.4, depthWrite: false });
    const cutout = new MeshStandardMaterial({ color: 0xffffff, alphaTest: 0.5 });
    const m = model([glass, cutout]);
    toRoomLook(m, candle, made);
    const mesh = m.children[0] as Mesh;
    const [a, b] = mesh.material as MeshBasicMaterial[];
    expect(a).toBeInstanceOf(MeshBasicMaterial);
    expect(a.color.getHex()).toBe(0x336699);
    expect(a.transparent).toBe(true);
    expect(a.opacity).toBeCloseTo(0.4);
    expect(a.depthWrite).toBe(false);
    expect(b.transparent).toBe(false);
    expect(b.alphaTest).toBe(0.5);
    expect(made).toEqual([a, b]);
    // It casts the candle's shadows: it is on the layer the bake draws.
    expect(mesh.layers.mask).not.toBe(1);
    candle.dispose();
  });

  it('reuses the materials of a model met before when given a cache', () => {
    const candle = new CandleLight();
    const made: Material[] = [];
    const cache = new Map<Material, MeshBasicMaterial>();
    const shared = new MeshStandardMaterial({ color: 0xff0000 });
    const first = model(shared),
      second = model(shared);
    toRoomLook(first, candle, made, cache);
    toRoomLook(second, candle, made, cache);
    expect((first.children[0] as Mesh).material).toBe((second.children[0] as Mesh).material);
    expect(made).toHaveLength(1);
    candle.dispose();
  });
});
