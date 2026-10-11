# ADR 0007: A small custom 2D solver for the stage, not a physics library

Status: proposed 10 Oct 2026 (Teammate A). For review at the end of A's work.

## Context

The GDD left the stage physics open: "Lightweight 2D library or a small custom solver in plane space." The stage needs only a little:
- Circles (the traveller, rocks, raindrops, crows, companions, fireflies) fall and rest on ground.
- They rest on, or are pushed by, hand shadows.
- Gameplay hears what touched what.

The hand shadows are 28 capsules per hand, in stage space, rebuilt every frame by the projector (`HandShadow.capsules`). They are not rigid bodies: they teleport, deform and change topology every frame.

The constraints are strict:
- Pure TypeScript in `src/engine/sim`.
- Deterministic.
- Nothing allocated per frame.
- 2.0 ms of headset CPU for all sim and gameplay.

## Decision

Write our own solver, `src/engine/sim/solver.ts`, of about 450 lines.

- **What collides.**
  - Entities are circles in the existing `EntityStore`. There is no second body list.
  - Terrain is a fixed list of capsules, each with a tag and an on/off switch (ground, a gate, a rope).
  - Each hand shadow is a `HandCollider`: a copy of the 28 capsules plus a per-kind mask, so gameplay decides what a hand is solid to. A flat-hand bridge holds the traveller up, and a hand with no role passes through everything.
- **What a step does.**
  1. Gravity, scaled per kind, then semi-implicit Euler.
  2. Two passes of push-out: terrain, the deepest hand capsule, then entity pairs through a uniform grid.
  3. Velocity into a surface is removed. Ground friction is relative to the surface, so a moving hand carries what rests on it.
  4. `Grounded` and what an entity stands on are set, and the first pass's contacts are listed in fixed arrays.
- **Queries for gameplay:**
  - `supportBelow` finds the highest walkable surface under a point.
  - `blocked` checks whether a circle hits a wall.

## Why not a library

- **Hand shadows don't fit rigid bodies.** Libraries such as planck.js, matter.js and Rapier's 2D build expect rigid bodies with stable shapes. Hand shadows would have to be rebuilt as fixtures every frame (which allocates) or driven as kinematic compound bodies with 56 parts that change shape. Both cost more than the whole custom step.
- **Allocation and determinism.** Most JS libraries allocate per step (contacts, manifolds, islands). Rapier is deterministic but WASM, and it adds a download and a copy across the WASM boundary every frame for the capsules.
- **We need almost nothing a library offers.** There are no joints, rotation or stacking stability. A circle-only world with capsule obstacles is a few hundred lines we can test and tune.

## Consequences

- **Measured on a desktop** (`npm run perf`): one step with about 200 entities (a full rain shower, 64 fireflies, rocks, crows), two solid hands and terrain costs 0.15 ms mean. The budget is about 0.5 ms for all sim and gameplay. `solver.alloc.test.ts` measures about 5 B a step, which is the engine boxing numbers. No objects or arrays are built.
- **Allocation-aware code.** The hot paths pass circles, normals and depths through small typed arrays rather than number arguments. Otherwise V8 boxes a double at every call it doesn't inline; that cost 340–700 B a step before the change.
- **Known limits:**
  - Circles only, so rocks don't tumble.
  - Push-out is position-based, so a very fast hand can pass through a small drop in one step.
  - Pairs are solved in slot order, so tall stacks are soft.
  - The puzzles avoid needing more than this.
- **Escape hatch:** if a puzzle ever needs real rigid bodies, the entity store and gameplay don't depend on the solver's internals, only on `step`, the ground and contact arrays, and the two queries.
