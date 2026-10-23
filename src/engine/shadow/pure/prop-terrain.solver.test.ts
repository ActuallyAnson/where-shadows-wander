// The converter against the real solver: a rock dropped onto a prop's shadow comes to rest on top of it, and the
// solver's Terrain fits the converter's sink (so a level can pass `solver.terrain` straight in).
import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPACITIES, Flag, Kind } from '../../sim/entity-kinds';
import { EntityStore } from '../../sim/entity-store';
import { Solver, Touch } from '../../sim/solver';
import { createSilhouette, projectProp } from './prop-shadow';
import { addPropTerrain, DEFAULT_EDGE_RADIUS_M, type CapsuleSink, type PropDef } from './prop-terrain';
import { createStagePlane } from './stage-plane';

const frame = createStagePlane();
const light = [0, 0, 0.6];
const BLEND = 0.9;
const bed: PropDef = {
  shape: 'box',
  position: [0, 0.05, 0.3],
  size: [0.2, 0.1, 0.1],
  rotation: [0, 0, 0, 1],
  solid: true,
  tag: 1,
};

describe('prop ground in the real solver', () => {
  it("accepts Terrain as the converter's sink", () => {
    const solver = new Solver(64);
    const sink: CapsuleSink = solver.terrain;
    expect(addPropTerrain(bed, light, frame, BLEND, sink, createSilhouette())).toBeGreaterThanOrEqual(3);
    expect(solver.terrain.count).toBeGreaterThanOrEqual(3);
    expect(solver.terrain.tag[0]).toBe(1);
  });

  it('holds a rock dropped onto the prop shadow on top of it', () => {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const solver = new Solver(store.capacity);
    addPropTerrain(bed, light, frame, BLEND, solver.terrain, createSilhouette());

    const shadow = createSilhouette();
    projectProp(bed, light, frame, BLEND, shadow);
    let top = -Infinity;
    for (let i = 0; i < shadow.count; i++) top = Math.max(top, shadow.points[i * 2 + 1]);

    const radius = 0.02;
    const rock = store.create(Kind.Rock, 0, top + 0.15, radius);
    for (let i = 0; i < 300; i++) {
      store.beginStep();
      solver.step(store, 1 / 60);
    }
    const s = store.slotOf(rock);
    expect(store.flags[s] & Flag.Grounded).toBeTruthy();
    expect(solver.groundType[s]).toBe(Touch.Terrain);
    // Resting on the top edge: the edge's own radius plus the rock's, within the simplification's slack.
    expect(store.y[s]).toBeGreaterThan(top - 0.01);
    expect(store.y[s]).toBeLessThan(top + DEFAULT_EDGE_RADIUS_M + radius + 0.01);
  });
});
