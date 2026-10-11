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

## Entity store, layouts, 2D maths

These already exist; see the header comments in `entity-store.ts`, `entity-kinds.ts`, `scene-layout.ts` and `vec2.ts`, and [ADR 0006](adr/0006-editor-authored-layouts.md) for how layouts are authored.

## Design calls open for team review

These choices are made in A's code because the GDD doesn't specify them. They are flagged here so the team can overrule them.

- **No fail state.** The traveller never dies; hazards stop it or push it back, and it waits.
- **A custom 2D solver rather than a library.** The ADR will follow with the solver.
- **`content/levels` stays unused.** Per ADR 0006, layouts live in the scene file and puzzle logic lives in `src/game/puzzles/`.
- **Stage size uses the GDD's constants** (about 2 m away, 1.6 m wide) until it is tuned in the headset.
