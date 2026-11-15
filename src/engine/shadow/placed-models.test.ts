import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from '@iwsdk/core';
import { describe, expect, it, vi } from 'vitest';
import { assetIdOf } from '../services/assets/budgets.mjs';
import { emptyRoomLayout, modelIdsOf, placement } from '../stage/room-layout';
import { readBedroomLayout } from './bedroom-layout';
import { CandleLight } from './candle-light';
import { PlacedModels, type ModelLoader } from './placed-models';
import { readPlacement } from './room-placement';

/** A model 1 x 2 x 1 m whose origin is at a corner of its base (as Kenney's are). */
function cornerModel(): Group {
  const g = new Group();
  const box = new Mesh(new BoxGeometry(1, 2, 1), new MeshStandardMaterial({ color: 0x884422 }));
  box.position.set(0.5, 1, -0.5);
  g.add(box);
  return g;
}

const loaderOf =
  (models: Record<string, () => Object3D>): ModelLoader =>
  (id) =>
    Promise.resolve(models[id] ? models[id]() : null);

function setup(loader: ModelLoader, layout = emptyRoomLayout()) {
  const room = new Group(),
    lap = new Group();
  const placed = new PlacedModels({ room, lap }, loader, layout);
  return { room, lap, placed, candle: new CandleLight() };
}

describe('PlacedModels', () => {
  it('loads every layout entry with a model, in its section, at its placement, keeping its own size', async () => {
    const layout = emptyRoomLayout();
    layout.room.bed = placement([0, 0, 0]); // a built-in piece: not this class's
    layout.room['chair-2'] = { ...placement([1, 0, -0.5], [0, 90, 0], [2, 2, 2]), model: 'chair' };
    layout.lap.mug = { ...placement([0, 0.02, 0]), model: 'chair' };
    const { room, lap, placed, candle } = setup(loaderOf({ chair: cornerModel }), layout);
    expect(await placed.load(candle)).toBe(2);
    expect(placed.editables().map((p) => `${p.section}:${p.id}`)).toEqual(['room:chair-2', 'lap:mug']);
    const chair = placed.editables()[0];
    expect(chair.object.parent).toBe(room);
    expect(placed.editables()[1].object.parent).toBe(lap);
    expect(chair.model).toBe('chair');
    expect(chair.object.name).toBe('chair-2');
    expect(readPlacement(chair.object).rotDeg[1]).toBeCloseTo(90);
    // The middle of its base is at the origin: the model inside is moved back by half its width and depth.
    const inner = chair.object.children[0];
    expect(inner.position.x).toBeCloseTo(-0.5);
    expect(inner.position.y).toBeCloseTo(0);
    expect(inner.position.z).toBeCloseTo(0.5);
    expect(inner.scale.x).toBe(1); // not fitted to a size
    candle.dispose();
  });

  it('leaves out a model that is not there or fails to load, and keeps going', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const layout = emptyRoomLayout();
    layout.room.a = { ...placement([0, 0, 0]), model: 'missing' };
    layout.room.b = { ...placement([0, 0, 0]), model: 'broken' };
    layout.room.c = { ...placement([0, 0, 0]), model: 'chair' };
    const loader: ModelLoader = (id) =>
      id === 'broken' ? Promise.reject(new Error('bad file')) : loaderOf({ chair: cornerModel })(id);
    const { placed, candle } = setup(loader, layout);
    expect(await placed.load(candle)).toBe(1);
    expect(placed.editables().map((p) => p.id)).toEqual(['c']);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    candle.dispose();
  });

  it('adds, takes out and puts back a piece, baking the shadows again each time', async () => {
    const { room, placed, candle } = setup(loaderOf({ chair: cornerModel }));
    await placed.load(candle);
    const rebake = vi.spyOn(candle, 'rebake');
    const piece = await placed.add('room', 'chair', 'chair', placement([0.3, 0, 0]));
    expect(piece).not.toBeNull();
    expect(room.children).toContain(piece!.object);
    placed.detach(piece!);
    expect(room.children).not.toContain(piece!.object);
    expect(placed.editables()).toEqual([]);
    placed.reattach(piece!);
    expect(placed.editables()).toEqual([piece]);
    expect(readPlacement(piece!.object).pos[0]).toBeCloseTo(0.3);
    expect(rebake.mock.calls.length).toBeGreaterThanOrEqual(3);
    candle.dispose();
  });

  it('shares materials between copies of one model', async () => {
    const material = new MeshStandardMaterial();
    const make = () => {
      const g = new Group();
      g.add(new Mesh(new BoxGeometry(1, 1, 1), material));
      return g;
    };
    const { placed, candle } = setup(loaderOf({ cube: make }));
    await placed.load(candle);
    const a = await placed.add('room', 'cube', 'cube', placement([0, 0, 0]));
    const b = await placed.add('room', 'cube-2', 'cube', placement([1, 0, 0]));
    const meshOf = (o: Object3D) => o.children[0].children[0] as Mesh;
    expect(meshOf(a!.object).material).toBe(meshOf(b!.object).material);
    candle.dispose();
  });
});

describe("the bedroom's layout file", () => {
  it('only places models that have a file under src/assets', () => {
    const ids = new Set(Object.keys(import.meta.glob('../../assets/**/*.glb')).map((path) => assetIdOf(path)));
    for (const model of modelIdsOf(readBedroomLayout().layout)) expect(ids.has(model), model).toBe(true);
  });
});
