import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../hands/hand-shadow';
import { DEFAULT_CAPACITIES, Flag, Kind } from './entity-kinds';
import { EntityStore } from './entity-store';
import { cupShadow, flatShadow, spreadShadow } from './shadow-shapes';
import { LEFT, Solver, Touch, type Support } from './solver';

const DT = 1 / 60;
const ALL = 0xffff;

function world() {
  const store = new EntityStore(DEFAULT_CAPACITIES);
  const solver = new Solver(store.capacity);
  return { store, solver };
}

function run(store: EntityStore, solver: Solver, steps: number, before?: () => void) {
  for (let i = 0; i < steps; i++) {
    store.beginStep();
    before?.();
    solver.step(store, DT);
  }
}

/** Ground from -0.8 to 0.8 with its top at y = -0.3. */
function ground(solver: Solver, from = -0.8, to = 0.8) {
  return solver.terrain.add(from, -0.35, to, -0.35, 0.05);
}

function setHand(solver: Solver, sh: ReturnType<typeof createHandShadow>, mask = ALL, vx = 0, vy = 0) {
  const h = solver.hands[LEFT];
  h.copyFrom(sh.active, sh.capsules, sh.bounds);
  h.mask = mask;
  h.vx = vx;
  h.vy = vy;
}

describe('Solver', () => {
  it('drops an entity onto the ground and keeps it there, grounded', () => {
    const { store, solver } = world();
    ground(solver);
    const h = store.create(Kind.Rock, 0, 0.2, 0.05);
    run(store, solver, 240);
    const s = store.slotOf(h);
    expect(store.y[s]).toBeCloseTo(-0.25, 2);
    expect(store.flags[s] & Flag.Grounded).toBeTruthy();
    expect(solver.groundType[s]).toBe(Touch.Terrain);
    expect(Math.abs(store.vy[s])).toBeLessThan(0.05);
  });

  it('holds the traveller up on a flat-hand bridge over a gap, and lets it fall when the hand has no role', () => {
    const { store, solver } = world();
    ground(solver, -0.8, -0.15);
    ground(solver, 0.15, 0.8);
    const sh = createHandShadow('left');
    flatShadow(sh, 0, -0.32);
    setHand(solver, sh);
    const t = store.create(Kind.Traveller, 0, -0.2, 0.04);
    run(store, solver, 120);
    const s = store.slotOf(t);
    expect(solver.groundType[s]).toBe(Touch.Hand);
    expect(store.y[s]).toBeGreaterThan(-0.32);
    solver.hands[LEFT].mask = 0;
    run(store, solver, 60);
    expect(store.y[s]).toBeLessThan(-0.5);
  });

  it('only stops the kinds in the hand mask', () => {
    const { store, solver } = world();
    const sh = createHandShadow('left');
    flatShadow(sh, 0, 0);
    setHand(solver, sh, 1 << Kind.Traveller);
    const rock = store.create(Kind.Rock, 0, 0.1, 0.03);
    const trav = store.create(Kind.Traveller, 0.05, 0.1, 0.03);
    run(store, solver, 90);
    expect(store.y[store.slotOf(rock)]).toBeLessThan(-0.1);
    expect(store.y[store.slotOf(trav)]).toBeGreaterThan(0);
  });

  it('lets a rising hand lift what rests on it', () => {
    const { store, solver } = world();
    const sh = createHandShadow('left');
    const r = store.create(Kind.Rock, 0, 0.05, 0.03);
    let y = 0;
    run(store, solver, 120, () => {
      y += 0.3 * DT;
      flatShadow(sh, 0, y);
      setHand(solver, sh, ALL, 0, 0.3);
    });
    const s = store.slotOf(r);
    expect(store.y[s]).toBeGreaterThan(y);
    expect(store.vy[s]).toBeGreaterThan(0.2);
  });

  it('carries a resting entity sideways with a moving hand (friction)', () => {
    const { store, solver } = world();
    const sh = createHandShadow('left');
    const r = store.create(Kind.Rock, 0, 0.05, 0.03);
    let x = 0;
    run(store, solver, 120, () => {
      x += 0.1 * DT;
      flatShadow(sh, x, 0, 0.6);
      setHand(solver, sh, ALL, 0.1, 0);
    });
    expect(store.x[store.slotOf(r)]).toBeGreaterThan(0.1);
  });

  it('keeps a raindrop in a cup', () => {
    const { store, solver } = world();
    const sh = createHandShadow('left');
    cupShadow(sh, 0, 0);
    setHand(solver, sh);
    const d = store.create(Kind.Raindrop, 0, 0.2, 0.01, 0, -0.5);
    run(store, solver, 180);
    const s = store.slotOf(d);
    expect(store.y[s]).toBeGreaterThan(-0.06);
    expect(Math.abs(store.x[s])).toBeLessThan(0.1);
  });

  it('reports a static sensor overlap without pushing either side', () => {
    const { store, solver } = world();
    ground(solver);
    const plate = store.create(Kind.Rock, 0, -0.3, 0.05, 0, 0, Flag.Static | Flag.Sensor);
    const rock = store.create(Kind.Rock, 0, 0, 0.04);
    let touched = false;
    run(store, solver, 120, () => {
      for (let i = 0; i < solver.contactCount; i++)
        if (solver.contactType[i] === Touch.Entity && solver.contactId[i] === store.slotOf(plate)) touched = true;
    });
    expect(touched).toBe(true);
    expect(store.x[store.slotOf(plate)]).toBe(0);
    expect(store.y[store.slotOf(rock)]).toBeCloseTo(-0.26, 2);
  });

  it('separates two overlapping bodies and lets a static one stand firm', () => {
    const { store, solver } = world();
    solver.config.gravity = 0;
    const a = store.create(Kind.Rock, 0, 0, 0.05);
    const b = store.create(Kind.Rock, 0.04, 0, 0.05);
    const wall = store.create(Kind.Rock, 0.3, 0, 0.05, 0, 0, Flag.Static);
    const c = store.create(Kind.Rock, 0.26, 0, 0.05);
    run(store, solver, 10);
    const dx = store.x[store.slotOf(b)] - store.x[store.slotOf(a)];
    expect(dx).toBeGreaterThanOrEqual(0.0999);
    expect(store.x[store.slotOf(wall)]).toBe(0.3);
    expect(store.x[store.slotOf(c)]).toBeLessThanOrEqual(0.2 + 1e-9);
  });

  it('finds the walkable surface below a point, on terrain and on a solid hand', () => {
    const { solver } = world();
    ground(solver, -0.8, -0.15);
    const out: Support = { y: 0, type: Touch.None, id: -1 };
    expect(solver.supportBelow(-0.5, 0, -0.5, 1, out)).toBe(true);
    expect(out.y).toBeCloseTo(-0.3, 6);
    expect(out.type).toBe(Touch.Terrain);
    expect(solver.supportBelow(0, 0, -0.5, 1, out)).toBe(false);
    const sh = createHandShadow('left');
    flatShadow(sh, 0, -0.32);
    setHand(solver, sh, 1);
    expect(solver.supportBelow(0, 0, -0.5, 1, out)).toBe(true);
    expect(out.type).toBe(Touch.Hand);
    expect(out.y).toBeCloseTo(-0.3, 3);
    expect(solver.supportBelow(0, 0, -0.5, 2, out)).toBe(false);
  });

  it('sees a spread-hand wall ahead', () => {
    const { store, solver } = world();
    const sh = createHandShadow('left');
    spreadShadow(sh, 0.2, 0);
    setHand(solver, sh, 1 << Kind.Traveller);
    expect(solver.blocked(store, 0.2, 0, 0.04, 1 << Kind.Traveller)).toBe(true);
    expect(solver.blocked(store, -0.3, 0, 0.04, 1 << Kind.Traveller)).toBe(false);
    expect(solver.blocked(store, 0.2, 0, 0.04, 1 << Kind.Rock)).toBe(false);
  });

  it('is deterministic', () => {
    const runOnce = () => {
      const { store, solver } = world();
      ground(solver);
      for (let i = 0; i < 40; i++)
        store.create(Kind.Raindrop, -0.4 + i * 0.02, 0.2 + (i % 5) * 0.03, 0.012, 0.05, -0.3);
      const sh = createHandShadow('left');
      run(store, solver, 300, () => {
        flatShadow(sh, Math.sin(store.y[0]) * 0.1, -0.1);
        setHand(solver, sh, ALL, 0.02, 0);
      });
      return store;
    };
    const a = runOnce(),
      b = runOnce();
    expect(new Uint8Array(a.x.buffer)).toEqual(new Uint8Array(b.x.buffer));
    expect(new Uint8Array(a.y.buffer)).toEqual(new Uint8Array(b.y.buffer));
  });
});
