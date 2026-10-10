# Simulation and gameplay

This is the design doc for the simulation and gameplay layer, owned by Teammate A: `src/engine/sim`, `src/engine/stage` and `src/game`. [ARCHITECTURE.md](ARCHITECTURE.md) explains where this layer sits in the frame. This doc explains how it works inside, and how to extend it. Each module gets a section here when it lands.

All code here is pure TypeScript: no IWSDK, no three.js and no browser globals. ESLint enforces this. Time comes in as an argument, so all of it runs and is tested in Node.

## Rules every module follows

- **Deterministic.** The sim only changes state inside a fixed step. Randomness comes from `Rng`, never `Math.random()`. It never reads the wall clock. With the same seed and the same inputs, a run is identical at any display rate; `determinism.test.ts` checks this bit for bit.
- **No per-frame allocation.**
  - Everything is allocated in a constructor or on puzzle load.
  - Per-step code reuses typed arrays and pooled objects.
  - Each per-step module has an `*.alloc.test.ts`, with a budget of 64 B a frame.
- **Budget:** 2.0 ms of CPU per frame on the headset for all sim and gameplay steps together. That is roughly 0.5 ms on a desktop; check it with `npm run perf`.
- **Units.**
  - Stage space is 2D metres on the paper wall. The origin is the stage centre, x is along the wall's `right` axis and y along its `up` axis.
  - Scene space is IWSDK's 3D metres.
  - Time is in seconds.

## Frame flow

```
display frame (main.ts FrameDriverSystem)
  hands → shape/gesture events → shadows (HandShadow capsules in stage space)
  latch.capture(shape events, gesture events)      once per frame
  alpha = loop.advance(delta)                      0..N fixed steps
      step(dt):  read + latch.consume()            first step after a capture sees the events
                 store.beginStep()                 px/py ← x/y
                 gameplay, then solver             (later modules)
  renderer draws px + (x - px) * alpha
```

## Fixed-step loop: `src/engine/sim/fixed-step.ts`

`FixedStepLoop(hz, onStep, maxStepsPerFrame = Infinity)` runs at `SIM_HZ = 60` (see `main.ts`).

- **`advance(frameDt)`** runs whole steps, then returns `alpha`, the interpolation factor in [0, 1). The last value is also kept in `loop.alpha`.
- **Caps.**
  - A frame longer than 0.25 s is clamped.
  - With `maxStepsPerFrame` set, whole steps beyond the cap are dropped rather than carried, so one slow frame can't snowball into slower ones.
  - Dropped time is counted in `droppedS`, for the profiler.
- **Pause.**
  - The caller pauses by not calling `advance`; `main.ts` already skips it while `SessionVisibility.paused`.
  - On resume, call `reset()` so the first frame back doesn't replay a stale remainder.
  - `reset()` also zeroes `steps` and `droppedS`.
- **Determinism.** Steps always get `dt === step`. Step N's state therefore depends only on the inputs it read, not on how frames grouped the steps.

## Random numbers: `src/engine/sim/rng.ts`

`Rng(seed)` is mulberry32.

- **Methods:** `next()` in [0, 1), `range(min, max)` and `int(n)`.
- **State:** the whole generator is one 32-bit `state`. Save it in snapshots and replays, and set it back to resume the sequence exactly.
- **Ownership:** each puzzle seeds its own `Rng` on load, so a restart replays the same rain.
- **Allocation:** the state lives in a `Uint32Array`, because an unsigned 32-bit field would box a heap number on every call.

## Hand events into the sim: `src/engine/sim/input-latch.ts`

The problem:
- The classifier's `ShapeEventQueue` and the `GestureEventQueue` hold one display frame's events, and they are cleared on the next update.
- The sim steps 0..N times per frame.
- If every step read those queues directly, a frame with two steps would see a `commit` twice. A frame with no step would miss it entirely; at 120 Hz display and 60 Hz sim, that is every other frame.

`InputLatch` fixes this:

1. **Once per display frame,** after classification, the caller runs `latch.capture(shapes.events, gestures.events)`. This copies the events into the latch's own queues, which reuse the same pooled classes.
2. **The next sim step** reads `latch.shapes` and `latch.gestures` in order, then calls `latch.consume()`.
3. **Events wait** across frames that take no step.
4. **Overflow:** the capacity is 64 shape and 32 gesture events. Past that, the oldest drop, counted in `latch.shapes.dropped`.

Hand *shadows* (`HandShadow`) need no latch. They describe the hand's current state, not a one-off event, and every step in a frame sees the same, latest shadow.

## Stage frame: `src/engine/stage/stage-frame.ts`

`StageFrame` is the 2D coordinate system the game lives in, laid on the paper wall of the virtual room ([ADR 0005](adr/0005-virtual-room.md)).

- **Spaces.**
  - The origin is the wall's centre.
  - Stage +x runs along `right`, and stage +y along `up` the wall, so gravity is -y.
  - `normal` points out of the wall, toward the player and the lantern.
  - The basis is orthonormal and right-handed (`right × up = normal`), with the same axes as the stand-in `placeTestRig('wall', ...)`.
- **Placing it.**
  - `placeInFront(head, yaw)` places the wall once when the room is built. It sits `WALL_DISTANCE_M` (2 m) ahead and `WALL_CENTRE_BELOW_EYES_M` (0.2 m) below the eyes, upright, at `WALL_WIDTH_M × WALL_HEIGHT_M` (1.6 × 1.0 m). These are constants to tune in the headset.
  - `setWall(centre, normal, upHint, w, h)` takes any plane. It is there for a possible real-surface mode later.
  - Every change bumps `version`.
- **Converting.**
  - `toStage(x, y, z, out)` projects a scene point straight onto the wall. It returns the point's distance in front of the wall.
  - `toScene(sx, sy, out, offset)` goes the other way, `offset` metres in front of the paper.
  - `contains(sx, sy, margin)` tests whether a stage point is on the wall.
  - None of these allocate.
- **With the shadow projector.** `StageFrame` has exactly the fields of `StagePlane`/`MutableStagePlane` in `src/engine/shadow/pure/stage-plane.ts`, so it can be passed straight to the projector in place of the test rig's plane. Pure code may not import `shadow/`, so the match is structural. It was checked with a one-off typecheck, and `main.ts`'s typecheck enforces it once it uses a `StageFrame`.
- **Dropped by ADR 0005:** choosing a table or wall, snapping to detected planes, and a placement fallback.

## Collision solver: `src/engine/sim/solver.ts`

The reasoning is in [ADR 0007](adr/0007-custom-2d-solver.md). The solver is a small custom one for circles against capsules.

### What collides

| Thing | Shape | Who sets it |
|---|---|---|
| Entities | circles in the `EntityStore`. `Static` ones never move. `Sensor` ones report overlaps and push nothing. | gameplay, layouts |
| Terrain | `solver.terrain`: up to 64 capsules, each with a `tag` and an `enabled` switch | puzzle load (ground, gates, ropes) |
| Hands | `solver.hands[LEFT/RIGHT]`: 28 capsules copied from `HandShadow` each frame, with `mask` (bit `1 << kind` per kind the hand is solid to) and the hand's velocity `vx`, `vy` | gameplay (abilities) |

`config` holds:
- gravity, plus a per-kind scale (`kindGravity`, which is 0 for flyers)
- `kindCollides`: a per-kind bitmask of the kinds each collides with; keep it symmetric
- `terrainMask`
- `groundFriction`
- `iterations` (2)

### One step

Call `solver.step(store, dt)` after `store.beginStep()` and after gameplay has set velocities. It runs:

1. Gravity, then integrate (semi-implicit Euler).
2. `iterations` passes of push-out, each over every non-static entity in slot order:
   - terrain capsules
   - the deepest capsule of each hand whose mask includes the entity's kind
   - entity pairs through a uniform grid; a dynamic pair splits the push, and a static partner takes none
3. Each push removes the velocity into the surface, relative to the surface's own velocity. On ground (normal y > 0.6) a friction term along the surface means a moving hand carries what stands on it.

### Outputs

- **`Flag.Grounded`** on each entity, plus `groundType[slot]` (a `Touch`: Terrain, Hand or Entity) and `groundId[slot]` (the terrain index, hand index or slot).
- **Contacts:** the first pass's contacts are in `contactSlot/contactType/contactId/contactNx/contactNy[0..contactCount)`. Gameplay reads these to make a raindrop splash or the cup catch it.

### Queries

- **`supportBelow(x, top, bottom, kindBit, out)`** finds the highest walkable surface under `x`, among terrain and the hands solid to that kind. The traveller uses it to see whether there is ground ahead.
- **`blocked(store, x, y, r, kindBit)`** tests whether a circle overlaps terrain, a solid hand or a static entity. This is the wall-ahead check.

### Testing helpers

`src/engine/sim/shadow-shapes.ts` fills a `HandShadow` with scripted stand-ins: a flat plank, a fist blob, a cup U and a spread fan, all about 0.3 m long like a real magnified shadow. It drives the solver and gameplay in tests and in the headless runner without a tracked hand.

### Cost

- 0.15 ms a step on a desktop with about 200 entities and two solid hands (`solver.perf.ts`).
- About 40 B of number boxing a step, and no objects (`solver.alloc.test.ts`).
- The hot paths pass values through typed-array scratch instead of number arguments, because V8 boxes doubles across calls it doesn't inline. Keep that pattern when editing them.

## Entity store, layouts, 2D maths

These already exist; see the header comments in `entity-store.ts`, `entity-kinds.ts`, `scene-layout.ts` and `vec2.ts`, and [ADR 0006](adr/0006-editor-authored-layouts.md) for how layouts are authored.

## Design calls open for team review

These choices are made in A's code because the GDD doesn't specify them. They are flagged here so the team can overrule them.

- **No fail state.** The traveller never dies; hazards stop it or push it back, and it waits.
- **A custom 2D solver rather than a library:** see [ADR 0007](adr/0007-custom-2d-solver.md).
- **`content/levels` stays unused.** Per ADR 0006, layouts live in the scene file and puzzle logic lives in `src/game/puzzles/`.
- **Stage size uses the GDD's constants** (about 2 m away, 1.6 m wide) until it is tuned in the headset.
