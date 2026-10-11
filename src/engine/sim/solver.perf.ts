// Times one solver step on a busy stage (`npm run perf`): a full rain shower (128 drops), 64
// fireflies, the traveller, rocks and crows, both hands solid, and a puzzle's terrain. The sim and
// gameplay together get 2.0 ms a frame on the headset (docs/ARCHITECTURE.md), about 0.5 ms on a
// desktop; at 72 Hz display and 60 Hz sim that is about one step a frame, so the solver should
// stay well under 0.3 ms here to leave room for gameplay. Landed drops are removed and respawned,
// as the rain puzzle does.
import { bench, describe } from 'vitest';
import { createHandShadow } from '../hands/hand-shadow';
import { DEFAULT_CAPACITIES, Flag, Kind } from './entity-kinds';
import { EntityStore } from './entity-store';
import { Rng } from './rng';
import { cupShadow, flatShadow } from './shadow-shapes';
import { LEFT, RIGHT, Solver, Touch } from './solver';

const store = new EntityStore(DEFAULT_CAPACITIES);
const solver = new Solver(store.capacity);
const rng = new Rng(3);
solver.terrain.add(-0.8, -0.35, -0.15, -0.35, 0.05);
solver.terrain.add(0.15, -0.35, 0.8, -0.35, 0.05);
solver.terrain.add(0.4, -0.3, 0.4, 0, 0.03);
const left = createHandShadow('left');
const right = createHandShadow('right');
flatShadow(left, 0, -0.32);
cupShadow(right, 0.3, 0.1);
solver.hands[LEFT].copyFrom(true, left.capsules, left.bounds);
solver.hands[RIGHT].copyFrom(true, right.capsules, right.bounds);
solver.hands[LEFT].mask = solver.hands[RIGHT].mask = 0xffff;
store.create(Kind.Traveller, -0.6, -0.25, 0.04);
for (let i = 0; i < 6; i++) store.create(Kind.Rock, -0.5 + i * 0.1, 0, 0.04);
for (let i = 0; i < 5; i++) store.create(Kind.Crow, 0.5, 0.1 * i, 0.04, 0, 0, Flag.Sensor);
for (let i = 0; i < 64; i++) store.create(Kind.Firefly, rng.range(-0.7, 0.7), rng.range(0, 0.4), 0.01);
// A game-like table: drops and fireflies pass through each other, flyers ignore gravity.
const cfg = solver.config;
cfg.kindGravity[Kind.Firefly] = 0;
cfg.kindGravity[Kind.Crow] = 0;
const solid = (1 << Kind.Traveller) | (1 << Kind.Rock) | (1 << Kind.Rabbit) | (1 << Kind.Fox);
for (const k of [Kind.Traveller, Kind.Rock, Kind.Rabbit, Kind.Fox]) cfg.kindCollides[k] = solid | (1 << Kind.Raindrop);
cfg.kindCollides[Kind.Raindrop] = solid;
cfg.kindCollides[Kind.Firefly] = 0;
cfg.kindCollides[Kind.Crow] = 1 << Kind.Traveller;
cfg.kindCollides[Kind.Traveller] |= 1 << Kind.Crow;

describe('solver', () => {
  bench('one step, ~200 entities, two solid hands', () => {
    store.beginStep();
    // Keep the shower full: a drop that lands anywhere (ground, hand, traveller) splashes and respawns.
    for (let s = store.kindStart[Kind.Raindrop]; s < store.kindEnd[Kind.Raindrop]; s++) {
      if (store.alive[s] && (solver.groundType[s] !== Touch.None || store.y[s] < -0.6))
        store.destroy(store.handleAt(s));
    }
    while (store.countOf(Kind.Raindrop) < 128) store.create(Kind.Raindrop, rng.range(-0.6, 0.6), 0.45, 0.01, 0, -0.6);
    solver.step(store, 1 / 60);
  });
});
