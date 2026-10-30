import { describe, expect, it } from 'vitest';
import chapter1 from '../../public/scenes/chapter-1.iwsdk.scene.json';
import { DEFAULT_CAPACITIES, Kind } from '../engine/sim/entity-kinds';
import { EntityStore } from '../engine/sim/entity-store';
import { Solver, Touch, type Support } from '../engine/sim/solver';
import { WALL_HEIGHT_M, WALL_WIDTH_M } from '../engine/stage/stage-frame';
import { buildGround, GROUND_Y, loadLayout, loadPuzzle, markerOf, TerrainTag, terrainSpan } from './level';

const PUZZLES = ['puzzle-1', 'puzzle-2', 'puzzle-3', 'puzzle-4', 'puzzle-5', 'puzzle-6'];

describe('chapter 1 layouts', () => {
  for (const id of PUZZLES) {
    it(`${id} loads cleanly and fits on the wall in stage space`, () => {
      const { layout } = loadLayout(chapter1, id);
      expect(layout.problems).toEqual([]);
      expect(layout.entities.filter((e) => e.kind === Kind.Traveller)).toHaveLength(1);
      expect(markerOf(layout, 'goal')).not.toBeNull();
      for (const p of [...layout.entities, ...layout.markers]) {
        expect(Math.abs(p.x), p.id).toBeLessThanOrEqual(WALL_WIDTH_M / 2);
        expect(Math.abs(p.y), p.id).toBeLessThanOrEqual(WALL_HEIGHT_M / 2);
      }
    });
  }

  it('subtracts the puzzle group position (puzzle-2 is placed 2 m along in the editor)', () => {
    const { layout, originX } = loadLayout(chapter1, 'puzzle-2');
    expect(originX).toBe(2);
    expect(layout.entities[0].x).toBeCloseTo(-0.7, 9);
  });
});

describe('buildGround', () => {
  it('lays one ground line when there is no gap', () => {
    const solver = new Solver(10);
    const { layout } = loadLayout(chapter1, 'puzzle-2');
    expect(buildGround(solver, layout)).toBe(1);
    expect(solver.terrain.tag[0]).toBe(TerrainTag.Ground);
  });

  it('cuts a hole exactly under the gap marker', () => {
    const solver = new Solver(10);
    const { layout } = loadLayout(chapter1, 'puzzle-1');
    const gap = markerOf(layout, 'gap')!;
    expect(buildGround(solver, layout)).toBe(2);
    const span: [number, number] = [0, 0];
    expect(terrainSpan(solver, 0, span)[1]).toBeCloseTo(gap.x - gap.params.width / 2, 6);
    expect(terrainSpan(solver, 1, span)[0]).toBeCloseTo(gap.x + gap.params.width / 2, 6);
    const out: Support = { y: 0, type: Touch.None, id: -1 };
    expect(solver.supportBelow(gap.x, 0, -1, 1, out)).toBe(false);
    // The capsule's round end slopes away in the last few centimetres; probe past it.
    expect(solver.supportBelow(gap.x - gap.params.width / 2 - 0.06, 0, -1, 1, out)).toBe(true);
    expect(out.y).toBeCloseTo(GROUND_Y, 3);
  });
});

describe('loadPuzzle', () => {
  it('clears what was there and spawns the puzzle on the ground', () => {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const solver = new Solver(store.capacity);
    store.create(Kind.Rock, 0, 0, 0.1);
    loadPuzzle(chapter1, 'puzzle-5', store, solver);
    expect(store.countOf(Kind.Rock)).toBe(0);
    expect(store.countOf(Kind.Crow)).toBe(3);
    expect(store.countOf(Kind.Firefly)).toBe(6);
    const t = store.kindStart[Kind.Traveller];
    for (let i = 0; i < 60; i++) {
      store.beginStep();
      solver.step(store, 1 / 60);
    }
    expect(store.y[t]).toBeCloseTo(GROUND_Y + 0.04, 2);
  });
});
