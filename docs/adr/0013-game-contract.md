# ADR 0013: One `Game` object behind one call a frame, talking to the app through plain data

Status: proposed 10 Oct 2026 (Teammate A). For review at the end of A's work; needs Anson (main.ts) and Teammate B (render, anim, services) to agree.

Not wired yet (25 Oct 2026): `Game` is built and tested headless, but `main.ts` still runs its own store, solver and loop for the tutorial (`src/game/tutorial-flow.ts`). Switching `main.ts` over to `Game` waits until the bedroom puzzles are in `Game`.

## Context

The simulation and gameplay (`src/engine/sim`, `src/engine/stage`, `src/game`) are pure TypeScript. They are tested in Node and may not import IWSDK, three.js or engine-facing folders. Until now `main.ts` constructed a `FixedStepLoop` with an empty step, and nothing read sim state.

Three owners meet at the boundary:
- **Anson's frame driver** has the hands, shape events and shadows each frame.
- **Teammate B's code** needs something to draw, animate, play sounds for and save:
  - the renderer and animation
  - audio
  - the save service
- **A's code** is everything in between.

The boundary has to hold several properties:
- **Allocation-free.**
- **Deterministic.** Display-rate independent.
- **Narrow.** No team should have to know another's internals.

## Decision

**One object, one call.** `main.ts` builds `new Game({ puzzles, save, caster })` once. Each frame it calls `game.frame(input)`, after the shadows are projected, in place of `sim.advance`. It returns the interpolation factor `alpha`.

**Input** is a plain `GameInput`:
- `dt` and `paused`
- `left` and `right`: the `HandShadow`s, in stage space
- `shapeEvents`: the `ShapeEventQueue`
- `gestureEvents` (optional)
- `leftTracked` and `rightTracked` (optional): each hand's own tracking, for the tracking-loss rules in `docs/SIMULATION.md`

The game copies what it needs. Shape events go through `InputLatch`, so each event reaches exactly one fixed step at any display rate. Pausing is an input: while `paused`, no time passes, and on resume the remainder is dropped.

**Outputs** are plain data, read after `frame()` returns:
- **`game.store`** (the `EntityStore` columns) plus `alpha`, for sprites: draw kind `k` from `kindStart[k]` to `kindEnd[k]` at `px + (x - px) * alpha`.
- **`game.fixtures`:** puzzle objects that aren't entities (drip, wind, drawbridge, plate, window).
- **`game.events`:** a `GameEventQueue` of one frame's events with constant-string ids. It is cleared at the start of the next `frame()`. Its consumers are audio, effects, the save service and the hint UI.
- **Readable state for animation:**
  - `game.traveller.state` and `stateT`
  - `game.abilities.hands[h].role`
- **`game.save`:** a JSON-safe `SaveState` the game keeps current. `SaveBridge` (`src/game/save-bridge.ts`) writes the service's save on `puzzle-start`, `puzzle-solved` and `chapter-complete`, and `saveStateFrom(store, ids)` builds the `SaveState` passed back in on launch.

**Stage space throughout.** The game never sees scene space. `StageFrame` (`src/engine/stage`) converts at the edges, so the renderer turns stage positions into scene positions with `stageFrame.toScene`.

## Update (25 Oct 2026)

- The companions are cut, so `game.companions` and the `creature-discovered` event are gone.
- The bedroom puzzles bring their own layouts and props (ADR 0014), so `chapter` is only needed for puzzles laid out in the chapter file. `caster` turns props' shadows into ground.
- The session flow around the game (title, tutorial, pause, solved, ending) is `GameFlow` (`src/game/flow.ts`). The app passes `paused: !flow.simRuns`.

## Consequences

- **Wiring is a few lines per owner,** drafted as issues in `docs/handoff/`.
  - **Anson:** construct the `Game`, pass `projector.shadows` and `shapes.events`, use `StageFrame` for the stage, add a `sim` timing slot, and expose `game` on `window.__wsw`.
  - **B:** the sprite renderer reads the store, effects and audio read events, and the save service stores `game.save`.
- **Nothing in A's folders depends on how it is drawn or saved,** and nothing outside them needs the puzzle code. Puzzles, abilities and the solver can change freely behind the contract.
- **The whole game runs headless** (`src/game/headless.ts`): every puzzle is tested end to end in Node, solved each way it should be.
- **The frame's events are a pull, not callbacks.** Consumers must read them every frame. That keeps the sim free of listener lists and of re-entrancy while stepping.
