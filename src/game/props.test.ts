// Props as ground: placing a stage-space prop in the scene, the orthographic stand-in caster, the
// loader adding each prop's ground with its own tag, and a puzzle whose only ground is one box.
import { describe, expect, it } from 'vitest';
import { CAPSULE_STRIDE } from '../engine/hands/hand-shadow';
import { DEFAULT_CAPACITIES, Kind } from '../engine/sim/entity-kinds';
import { EntityStore } from '../engine/sim/entity-store';
import { Solver, Touch } from '../engine/sim/solver';
import { StageFrame } from '../engine/stage/stage-frame';
import { Headless } from './headless';
import { addProps, loadLevel, type LevelLayout } from './level';
import {
  createSceneProp,
  DEFAULT_DEPTH_M,
  orthoCaster,
  PROP_TAG_BASE,
  propToScene,
  type LevelProp,
  type PropCaster,
} from './props';
import type { PuzzleDef } from './puzzle';

/** Rotates v by the unit quaternion q (x, y, z, w). */
function rotate(q: ArrayLike<number>, v: [number, number, number]): number[] {
  const [x, y, z, w] = [q[0], q[1], q[2], q[3]];
  const [vx, vy, vz] = v;
  // t = 2 (q.xyz × v); v' = v + w t + q.xyz × t
  const tx = 2 * (y * vz - z * vy),
    ty = 2 * (z * vx - x * vz),
    tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

/** Each terrain capsule as [ax, ay, bx, by, radius, tag]. */
function capsules(solver: Solver): number[][] {
  const t = solver.terrain;
  const out: number[][] = [];
  for (let i = 0; i < t.count; i++) {
    const o = i * CAPSULE_STRIDE;
    out.push([t.data[o], t.data[o + 1], t.data[o + 2], t.data[o + 3], t.data[o + 4], t.tag[i]]);
  }
  return out;
}

/** The highest point of the ground with a given tag. */
function topOf(solver: Solver, tag: number): number {
  return Math.max(
    ...capsules(solver)
      .filter((c) => c[5] === tag)
      .flatMap((c) => [c[1], c[3]]),
  );
}

const BED: LevelProp = { id: 'bed', shape: 'box', x: 0, y: -0.3, size: [1.4, 0.16, 0.3] };

/** A puzzle with no ground line: the bed's shadow is all the ground, and the goal is at its far end. */
function bedPuzzle(): PuzzleDef {
  const layout: LevelLayout = {
    traveller: { x: -0.6, y: -0.18 },
    goal: { x: 0.6, y: -0.18, width: 0.1, height: 0.12 },
  };
  return {
    id: 'test-bed',
    title: 'The bed',
    layout,
    props: [BED],
    ground: false,
    solutions: ['walk'],
    hintShape: 'flat',
  };
}

describe('propToScene', () => {
  it('places a prop in front of a tilted wall, turned with it', () => {
    const stage = new StageFrame();
    // A wall facing back along +z, its up tipped a little: right, up and normal are not the axes.
    stage.setWall([0.2, 1.3, -2], [0, 0.2, 1], [0, 1, 0], 1.6, 1.0);
    const p = propToScene({ ...BED, x: 0.3, y: 0.1, tilt: 0.4, depth: 0.2 }, stage, createSceneProp());
    for (let i = 0; i < 3; i++) {
      const want = stage.origin[i] + stage.right[i] * 0.3 + stage.up[i] * 0.1 + stage.normal[i] * 0.2;
      expect(p.position[i]).toBeCloseTo(want, 9);
    }
    const q = p.rotation;
    expect(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2).toBeCloseTo(1, 9);
    // Local x is the wall's right turned by the tilt about the normal; local z is the normal.
    const c = Math.cos(0.4),
      s = Math.sin(0.4);
    const localX = rotate(q, [1, 0, 0]);
    const localZ = rotate(q, [0, 0, 1]);
    for (let i = 0; i < 3; i++) {
      expect(localX[i]).toBeCloseTo(stage.right[i] * c + stage.up[i] * s, 9);
      expect(localZ[i]).toBeCloseTo(stage.normal[i], 9);
    }
    expect(Array.from(p.size)).toEqual([1.4, 0.16, 0.3]);
  });

  it('puts a prop at the default depth when none is given', () => {
    const stage = new StageFrame();
    stage.setWall([0, 1, -2], [0, 0, 1], [0, 1, 0], 1.6, 1.0);
    const p = propToScene(BED, stage, createSceneProp());
    expect(p.position[2]).toBeCloseTo(-2 + DEFAULT_DEPTH_M, 9);
  });
});

describe('orthoCaster', () => {
  it("adds a box's outline as four edges, counter-clockwise", () => {
    const solver = new Solver(8);
    expect(orthoCaster.cast(BED, 20, solver.terrain)).toBe(4);
    const c = capsules(solver);
    expect(c[0].slice(0, 4).map((v) => +v.toFixed(3))).toEqual([-0.7, -0.38, 0.7, -0.38]);
    expect(c[2].slice(0, 4).map((v) => +v.toFixed(3))).toEqual([0.7, -0.22, -0.7, -0.22]);
    expect(c.every((k) => k[5] === 20)).toBe(true);
  });

  it('turns a tilted box into a ramp', () => {
    const solver = new Solver(8);
    orthoCaster.cast({ id: 'plank', shape: 'box', x: 0, y: 0, size: [0.4, 0.02, 0.1], tilt: 0.3 }, 1, solver.terrain);
    const top = capsules(solver)[2];
    expect(top[1]).toBeGreaterThan(top[3]); // the top edge runs right to left, rising to the right
  });

  it('casts a sphere as an octagon and a standing cylinder as its side view', () => {
    const solver = new Solver(8);
    expect(orthoCaster.cast({ id: 'ball', shape: 'sphere', x: 0, y: 0, size: [0.1] }, 1, solver.terrain)).toBe(8);
    solver.terrain.clear();
    expect(orthoCaster.cast({ id: 'cup', shape: 'cylinder', x: 0, y: 0, size: [0.05, 0.1] }, 1, solver.terrain)).toBe(
      4,
    );
    const xs = capsules(solver).flatMap((k) => [k[0], k[2]]);
    expect(Math.max(...xs)).toBeCloseTo(0.05, 6);
  });

  it('adds nothing for a prop with no size', () => {
    const solver = new Solver(8);
    expect(orthoCaster.cast({ id: 'none', shape: 'box', x: 0, y: 0, size: [0, 0.1, 0.1] }, 1, solver.terrain)).toBe(0);
  });
});

describe('addProps', () => {
  it('tags each prop by its index, skips shadows that are only drawn, and reports props with no ground', () => {
    const solver = new Solver(8, undefined, 64);
    const problems: string[] = [];
    const props: LevelProp[] = [
      BED,
      { id: 'curtain', shape: 'box', x: 0, y: 0.3, size: [0.2, 0.4, 0.1], solid: false },
      { id: 'flat-book', shape: 'box', x: 0, y: 0, size: [0.2, 0, 0.1] },
      { id: 'books', shape: 'box', x: 0.3, y: 0, size: [0.2, 0.1, 0.1] },
    ];
    expect(addProps(solver, props, orthoCaster, problems)).toBe(8);
    const tags = new Set(capsules(solver).map((c) => c[5]));
    expect([...tags]).toEqual([PROP_TAG_BASE, PROP_TAG_BASE + 3]);
    expect(problems).toEqual([expect.stringContaining('flat-book')]);
  });

  it('reports the props that no longer fit when the terrain pool is full', () => {
    const solver = new Solver(8, undefined, 4);
    const problems: string[] = [];
    addProps(solver, [BED, { ...BED, id: 'second-bed' }], orthoCaster, problems);
    expect(problems).toEqual([expect.stringContaining('second-bed')]);
  });
});

describe('a puzzle whose only ground is a box prop', () => {
  it('loads with no ground line: all its terrain is the bed', () => {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const solver = new Solver(store.capacity);
    const loaded = loadLevel(undefined, bedPuzzle(), store, solver, orthoCaster);
    expect(loaded.layout.problems).toEqual([]);
    expect(solver.terrain.count).toBe(4);
    expect(store.kindEnd[Kind.Traveller] - store.kindStart[Kind.Traveller]).toBe(1);
  });

  it("stands the traveller on the bed's shadow and walks it to the goal", () => {
    const h = new Headless({ puzzles: [bedPuzzle()] });
    h.run(1);
    const g = h.game;
    const s = g.traveller.slot(g);
    expect(g.traveller.standingOn(g)).toBe(Touch.Terrain);
    expect(g.solver.terrain.tag[g.traveller.standingOnId(g)]).toBe(PROP_TAG_BASE);
    // Resting on the top edge (y -0.22, plus the edge's 1 cm thickness), not falling through.
    expect(g.store.y[s] - g.store.radius[s]).toBeCloseTo(-0.21, 2);
    expect(h.runUntil(() => h.saw('puzzle-solved'), 20)).toBe(true);
    expect(h.saw('traveller-fell')).toBe(false);
  });

  it('drops the traveller where there is no prop under it', () => {
    const p = bedPuzzle();
    const h = new Headless({ puzzles: [{ ...p, layout: { ...p.layout!, traveller: { x: -0.75, y: 0.2 } } }] });
    // It starts past the bed's left end, falls off the stage, and is put back: no ground line catches it.
    expect(h.runUntil(() => h.saw('traveller-fell'), 5)).toBe(true);
  });
});

describe('static props are projected once, from where the lantern is at load', () => {
  /**
   * A stand-in for the real projection, with a point light straight out from the wall at (lx, ly)
   * and `dist` metres away: each point of a prop is scaled away from the light's foot by
   * dist / (dist - depth). An unturned box's shadow is the rectangle around its front face.
   */
  function pointLight(lx: number, ly: number, dist: number): PropCaster {
    return {
      cast(p, tag, sink) {
        const front = (p.depth ?? DEFAULT_DEPTH_M) + p.size[2] / 2;
        const k = dist / (dist - front);
        const x0 = lx + (p.x - p.size[0] / 2 - lx) * k,
          x1 = lx + (p.x + p.size[0] / 2 - lx) * k;
        const y0 = ly + (p.y - p.size[1] / 2 - ly) * k,
          y1 = ly + (p.y + p.size[1] / 2 - ly) * k;
        sink.add(x0, y0, x1, y0, 0.01, tag);
        sink.add(x1, y0, x1, y1, 0.01, tag);
        sink.add(x1, y1, x0, y1, 0.01, tag);
        sink.add(x0, y1, x0, y0, 0.01, tag);
        return 4;
      },
    };
  }

  it('builds different ground when the puzzle loads with the lantern somewhere else', () => {
    const low = new Headless({ puzzles: [bedPuzzle()], caster: pointLight(0, -0.6, 1.5) });
    const high = new Headless({ puzzles: [bedPuzzle()], caster: pointLight(0, 0.4, 1.5) });
    // A light below the bed throws its shadow up the wall; one above throws it down.
    expect(topOf(low.game.solver, PROP_TAG_BASE)).toBeGreaterThan(topOf(high.game.solver, PROP_TAG_BASE));
  });

  it('keeps the ground still while the puzzle plays (the props do not move)', () => {
    const h = new Headless({ puzzles: [bedPuzzle()], caster: pointLight(0, -0.6, 1.5) });
    const before = capsules(h.game.solver);
    h.run(3);
    expect(capsules(h.game.solver)).toEqual(before);
  });
});
