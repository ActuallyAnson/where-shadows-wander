# Simulation and gameplay

This is the design doc for the simulation and gameplay layer, owned by Teammate A: `src/engine/sim`, `src/engine/stage` and `src/game`. [ARCHITECTURE.md](ARCHITECTURE.md) explains where this layer sits in the frame. This doc explains how it works inside, and how to extend it. Each module gets a section here when it lands.

All code here is pure TypeScript: no IWSDK, no three.js and no browser globals. ESLint enforces this. Time comes in as an argument, so all of it runs and is tested in Node.

## Rules every module follows

- **Deterministic.** The sim only changes state inside a fixed step. Randomness comes from `Rng`, never `Math.random()`. It never reads the wall clock. With the same seed and the same inputs, a run is identical at any display rate; `determinism.test.ts` checks this bit for bit.
- **No per-frame allocation.**
  - Everything is allocated in a constructor or on puzzle load.
  - Per-step code reuses typed arrays and pooled objects, and builds no objects or arrays.
  - Each per-step module has an `*.alloc.test.ts` (measured with `src/engine/sim/alloc-measure.ts`). The bytes left over are V8 boxing numbers across calls it didn't inline, as in the hand pipeline's test. The budget is 64 B for the sim modules and about 1.5 times the measured figure for a whole game frame.
- **Budget:** 2.0 ms of CPU per frame on the headset for all sim and gameplay steps together. That is roughly 0.5 ms on a desktop; check it with `npm run perf`.
- **Units.**
  - Stage space is 2D metres on the paper wall. The origin is the stage centre, x is along the wall's `right` axis and y along its `up` axis.
  - Scene space is IWSDK's 3D metres.
  - Time is in seconds.

## Frame flow

`Game` is driven with one call a frame: `game.frame(input)`. It is not wired into `main.ts` yet, which still runs the tutorial (`src/game/tutorial-flow.ts`) on its own store, solver and loop. Inside `game.frame`:

```
Game.frame(input)                                   once per display frame
  events.clear()                                    (kept once after a load between frames)
  latch.capture(shape events, gesture events)       even while paused: a commit made then counts
  paused?  -> stop here (on resume, loop.reset(): no catch-up)
  abilities.setShadows(left, right)                 hand capsules -> solver.hands, hand velocity
  alpha = loop.advance(dt)                          0..4 fixed steps of 1/60 s
    step:  shape events -> abilities (roles)                then latch.consume()
           store.beginStep()                                 px/py <- x/y
           abilities.beforeSolve                             hand masks from roles
           puzzle.step                                       hazards, wind, holds
           creatures / traveller think                       speeds
           solver.step
           abilities.afterSolve                              catching, splashes on hands
           puzzle.afterStep                                  contacts, gates, credit
           traveller / creatures after                       goal, falls, crows leaving
           runner.update                                     credit, hint, win, outro -> next puzzle
  return alpha                                      renderer draws px + (x - px) * alpha
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
- About 5 B of number boxing a step, and no objects (`solver.alloc.test.ts`).
- The hot paths pass values through typed-array scratch instead of number arguments, because V8 boxes doubles across calls it doesn't inline. Keep that pattern when editing them.

## Puzzle layouts: `src/game/level.ts`

A puzzle's layout comes from one of two places:
- **TypeScript, with its props** ([ADR 0014](adr/0014-props-and-layouts-in-typescript.md)). `PuzzleDef.layout` is a `LevelLayout` in stage space: the traveller's start, the goal, and any markers and pieces. `PuzzleDef.props` are the invisible props whose shadows are its ground (next section). The bedroom puzzles are written this way.
- **The scene editor** ([ADR 0006](adr/0006-editor-authored-layouts.md)). `PuzzleDef.layoutId` names a group in `public/scenes/chapter-1.iwsdk.scene.json`, which holds `puzzle-1` to `puzzle-6`. The rest of this section is about those groups.

### Coordinates

- **Inside a group,** positions are stage metres relative to the group's own position. That position is the centre of the 1.6 × 1.0 m wall, so x runs from −0.8 to 0.8 and y from −0.5 to 0.5.
- **Groups sit 2 m apart in the editor** so they don't overlap.
- **The loader adds a group's translation,** and `loadLayout` subtracts it again. A puzzle comes out in stage space wherever it sits in the file.

### The ground

- A puzzle has a ground line with its top at `GROUND_Y` (−0.3 m, 0.2 m above the bottom of the wall), unless it sets `ground: false`. It runs 0.3 m past each side of the wall.
- **Each `marker-gap` cuts a hole** as wide as the marker. The marker's height and y are only for the editor's view.
- The ground is a capsule 0.1 m thick, so its ends are rounded: the walkable top slopes away over the last few centimetres before a hole.
- Terrain capsules carry a `TerrainTag`: Ground (1), Gate (2) or Wall (5); a prop's capsules carry `PROP_TAG_BASE` (16) plus its index. Gameplay uses the tag to tell what something stood on.

### What lives where

- **The scene file** holds the pieces (the traveller's start, crows, fireflies) and the markers (`gap`, `goal`, `plate`).
- **Puzzle code** in `src/game/puzzles/` holds everything that moves or reacts: rain, wind, gates and ropes.
- **`content/levels` stays unused,** per ADR 0006.
- **Adding a marker tag or a `Kind`** needs a stand-in asset in `src/app/assets.ts`. That file is Anson's, and a test enforces it.

### Loading

`loadLevel(doc, def, store, solver, caster)` does it all in one call (`loadPuzzle` is the same for a chapter-file group with no props):
1. Clears the store and the solver's terrain.
2. Loads the layout in stage space, from `def.layout` or the chapter file's `def.layoutId`.
3. Builds the ground line, unless `def.ground` is false.
4. Adds each solid prop's ground through the caster.
5. Spawns the pieces.

It runs on puzzle load, never per frame. `markerOf` and `markersOf` find markers by tag.

## Props as ground: `src/game/props.ts`

The landscape is the shadows of invisible props (GDD). A `LevelProp` is authored in stage space:
- `x`, `y`: its centre as seen on the wall
- `depth`: how far it stands in front of the wall (default 5 cm)
- `size`: a box's full width, height and depth; a sphere's radius; a cylinder's radius and height
- `tilt`: a turn in the wall's plane, for a ramp
- `solid: false`: a shadow that is only drawn, never walked on

A prop close to the wall casts a shadow about its own size, so a puzzle is drawn as the shadow it needs. Keep props thin (a few centimetres deep) so the real shadow matches.

### Casting

`addProps` hands each solid prop to a `PropCaster`, which adds one capsule per edge of its shadow to the terrain, tagged `PROP_TAG_BASE + index`. A prop that adds no ground (no shadow, or the pool is full) is listed in the layout's `problems`, and `Game` warns.

- **In the app** the caster places the prop in scene space with `propToScene(prop, stage, out)`. It then calls Anson's `addPropTerrain` (`src/engine/shadow/pure/prop-terrain.ts`) with the flame's position, the stage, and the blend from the shadow settings the hands use. That simplifies each silhouette to at most 8 edges.
- **Headless and in tests** `Game` defaults to `orthoCaster`: the fully orthographic shadow, which is the prop's outline (a box's 4 edges, a sphere's 8, a standing cylinder's 4).

Pure code may not import `src/engine/shadow` (the lint rule covers its `pure` folder too), so the real projection reaches the game only through the caster.

### Budgets

- The game's terrain pool is 128 capsules (`TERRAIN_CAPACITY`).
- A puzzle has at most 32 props (`MAX_PROPS`).
- Props are projected once, when the puzzle loads, and cost nothing per step beyond their capsules.

### Tests

`src/engine/sim/scene-layout.test.ts` now reads a small fixed fixture, `src/engine/sim/fixtures/sample-chapter.scene.json` (the first editor trial's file), so re-authoring the real chapter doesn't break the loader's tests. `level.test.ts` checks that every chapter-1 puzzle loads cleanly and fits on the wall.

`props.test.ts` covers the props:
- placing a prop against a tilted wall, and the orthographic caster
- the tags, and the problems the loader reports
- a puzzle whose only ground is one box: the traveller stands on its shadow and walks to the goal, and with no prop under it, it falls
- a stand-in point light: loading with the lantern elsewhere builds different ground, and the ground stays still while the puzzle plays

## The game: `src/game/game.ts`

`Game` is the one object `main.ts` will drive (see [ADR 0013](adr/0013-game-contract.md)). It owns:
- the loop, store, solver and RNG
- the traveller, abilities and creatures
- the puzzle runner and the save

It also implements `GameContext` (`src/game/context.ts`), the view of the world every gameplay module receives.

### Input and output

```ts
const game = new Game({ chapter: chapterDoc, puzzles: createChapter1(), save: readSave(stored) });
// every display frame:
const alpha = game.frame({ dt, paused, left: shadows.left, right: shadows.right, shapeEvents: shapes.events });
// then read game.events, game.store (+ alpha), game.fixtures, game.traveller.state, game.save
```

| Input | From |
|---|---|
| `dt`, `paused` | the frame delta; `SessionVisibility.paused` or the cover-flame pause |
| `left`, `right` | `ShadowProjector.shadows` (stage space) |
| `shapeEvents` | `ShapeRecognizer.events` |
| `gestureEvents` | `GestureDetector.events` (latched; not used by gameplay yet) |

| Output | For |
|---|---|
| `alpha` and `store` (`x/y/px/py/radius/kind/flags`) | the sprite renderer (B) |
| `events` (`GameEventQueue`): one frame of events, cleared at the next `frame()` | audio, saves, UI, effects |
| `fixtures` | the renderer: cloud, wind, gate, plate, window |
| `traveller.state`/`stateT`, `abilities.hands[h].role` | animation (B) |
| `save` (`SaveState`), changed on `puzzle-solved` and `chapter-complete` | the save service (B) |

### Control

- Events from a load made between frames (the constructor, `restart`, `goto`) are delivered by the next `frame()`. A reload also takes down a visible hint (`hint-hide`).
- `restart()` reloads the current puzzle.
- `goto(i)` jumps to puzzle `i`.
- `complete` is true once the last puzzle is solved: the final scene stays painted and the window is lit.

### Fixed steps

The loop runs at 60 Hz, at most 4 steps a frame.

Pausing stops time completely. On resume the remainder is dropped, so the world never jumps.

### Solver tuning: `gameSolverConfig()`

- **Flyers:** crows and fireflies ignore gravity.
- **Raindrops** fall at half gravity, on top of their starting speed.
- **What collides:**
  - Walkers (the traveller and rocks) collide with each other and with drops.
  - Crows collide only with the traveller, as sensors.
  - Fireflies collide with nothing except a cup.
  - Crows and fireflies ignore terrain.

## Game events: `src/game/game-events.ts`

`GameEventQueue` holds 128 pooled `GameEvent { type, id, hand, value, x, y, t }`. `id` is always a constant string.

| type | id | value |
|---|---|---|
| `puzzle-start` | puzzle id | puzzle index |
| `puzzle-solved` | the solution used | puzzle index; `x` = 1 if the solution is new |
| `chapter-complete` | chapter id | |
| `ability-start` / `ability-end` | role name (`bridge`, `rock`, `catcher`, `wall`) | |
| `traveller-state` | the new state | |
| `traveller-fell` | | |
| `hint-show` / `hint-hide` | the shape to make (show) | `x`, `y`: where |
| `caught` | `raindrop` / `firefly` | how many the cup holds |
| `splash` | `ground` / `hand` / `traveller` | |
| `puzzle-event` | `crows-flee`, `gate-open`, `gate-close`, `cup-overflow` | |

## The traveller: `src/game/traveller.ts`

The traveller walks on its own at `WALK_SPEED` (0.12 m/s) toward the goal. The player never steers it.

### States

| State | When |
|---|---|
| `walk` | ground ahead (within a 3 cm step up or 5 cm step down), and no wall or rock at stride height |
| `blocked` | otherwise; it stands still |
| `look-back` | blocked for 3 s: it looks at the player, the cue to help |
| `held` | a puzzle called `hold(reason)` this step (rain ahead, crows on the path) |
| `pushed` | wind (`push`) beats its stride |
| `falling` | no ground for 0.15 s |
| `goal` | inside the goal marker |

### Probes

It looks for ground with `solver.supportBelow` and for walls with `solver.blocked`. Hands count only when their role makes them solid to it.

### Rocks

It stops for a rock in its way, as for a wall, rather than shoving it along.

### No fail state

If it falls (a bridge pulled away mid-crossing), it is put back at its start with `traveller-fell`. This is a design call, listed below.

## Shape abilities: `src/game/abilities.ts`

A `commit` gives the hand a role. The role ends on that shape's `release`, and a new shape's commit replaces it with no gap (GDD).

| Shape | Role | The hand's shadow… | Solid to |
|---|---|---|---|
| flat | bridge | is a plank to walk on, and a roof that bursts rain | walkers, raindrops |
| fist | rock | is a heavy solid; it presses plates and anchors the traveller in wind | walkers, raindrops, crows |
| cup | catcher | catches raindrops (counted, `CUP_CAPACITY` 60, then it overflows) and fireflies (carried in the bowl until the cup is released) | walkers, raindrops, fireflies |
| spread | wall | is a windbreak (`wallShelters`) and blocks rain and crows | walkers, raindrops, crows |
| any other shape (rabbit, fox) | none | ends the hand's role; passes through everything | nothing |

### How it works

- **No role, no collision.** A hand with no role passes through everything, so moving a hand into place never knocks things over.
- **Roles survive a puzzle load.** The classifier keeps its commits through the outro, so a shape held into the next puzzle keeps its role. Cups are emptied.
- **Hand velocity uses the display frame.** It is measured per display frame, so the same motion reads slightly differently at 72 and 120 Hz. Replays are exact, because frame times are recorded.
- **The live outline collides.** Bridge and rock use the shadow's actual capsules, so a slightly imperfect shape still works (GDD).
- **Hand velocity.** It comes from the shadow's centre, frame to frame, smoothed and capped at 3 m/s. A moving hand carries what rests on it and shoves what it hits.

## Companions: cut (25 Oct 2026)

The rabbit and fox companions, and the creature discovery that came with them, are cut: complicated shapes are out, and the classifier is weakest on them. `src/game/companions.ts` and `discovery.ts` are gone. The classifier still knows the two shapes (`src/engine/hands/shapes.ts` is Anson's); a commit of either gives no role. `Kind.Rabbit` and `Kind.Fox` stay in `entity-kinds.ts` (kinds are append-only, and the sprite atlas names them), but gameplay never spawns them.

## Creatures: `src/game/creatures.ts`

- **Fireflies** drift in slow loops around where the layout placed them, unless carried.
- **Crows** perch, then do one of two things:
  - flee up and away when `Scared`, and are removed off the stage
  - fly toward `lureX/lureY` when `Lured`

  Puzzles set those flags (`src/game/flags.ts`, bits 8 and up).

## Puzzles and the runner: `src/game/puzzle.ts`

### A puzzle

A `PuzzleDef` has:
- `id`, `layoutId` and `title`
- `solutions`: the intended one first
- `hintShape`, plus an optional `hintDelayS`, `hintAt` and `groundY`
- hooks: `setup` (on load), `step` (before the traveller and solver) and `afterStep` (after the solver)

### The runner

- **Solution credit.**
  - The puzzle calls `ctx.credit(id)` with evidence while the player plays. The runner adds credit for the role of the hand the traveller stands on.
  - At the win, the solution with the most credit is recorded. A win nothing was credited for is a way nobody designed (for example, two fists side by side as stepping stones over the tutorial's gap). It is recorded as `other` (`OTHER_SOLUTION`), not mislabelled as the intended solution.
  - Credit for an id that isn't a solution is ignored.
- **Hint.** After the traveller has been stuck (blocked, looking back, held or pushed) for `hintDelayS`, `hint-show` names the shape and a stage position. The default is 20 s (GDD); the tutorial uses 0.5 s. `hint-hide` follows once it has walked for 0.5 s.
- **Win and outro.** The traveller reaching the goal emits `puzzle-solved` and saves the solution. After a 2.5 s outro the next puzzle loads, between frames. After the last puzzle comes `chapter-complete`, with the window lit.

### Chapter 1: `src/game/puzzles/`

| # | Puzzle | Obstacle | Solutions (intended first) | How the code decides |
|---|---|---|---|---|
| 1 | `p1-gap` (tutorial) | a 0.22 m gap | `bridge` | standing on a bridge hand |
| 2 | `p2-rain` | a cloud rains on the path (seeded drops); the traveller waits while drops land just ahead or hit it | `cup`, `roof` | which cover is over it under the cloud |
| 3 | `p3-wind` | wind from the right, stronger than its stride | `wall` (a spread hand on its windward side), `anchor` (a fist just above it) | sheltered by `wallShelters`, or a rock hand within 0.15 m above |
| 4 | `p4-chasm` | a 0.5 m chasm, wider than one hand | `two-bridges`, `ferry` (one flat hand carried across with the traveller on it) | standing on both bridge hands, or on a bridge hand moving at 4 cm/s or more |
| 5 | `p5-crows` | three crows on the path | `fireflies` (a cup of 3 or more lures the flock, then lift it away), `shoo` (a spread hand swept past them at 0.5 m/s or more, within 0.25 m) | crows lured or scared |
| 6 | `p6-gate` | a gate that opens while its plate (on a shelf above the path) is pressed | `rock` (a fist on the plate); one solution until the bedroom rework | plate pressed by a rock hand |

Each puzzle's test also checks one way that should not work: an animal shape over the gap, a cup beside the rain, a windbreak on the sheltered side, one bridge held still over the chasm, a still spread hand by the crows, a flat hand on the weight plate.

### Adding a puzzle

1. **Layout.** In the scene editor, add a `puzzle-N` group to `public/scenes/chapter-1.iwsdk.scene.json` with:
   - a `piece-traveller` at its start
   - a `marker-goal`
   - any `marker-gap` holes, `marker-plate` plates and pieces

   Keep positions inside the 1.6 × 1.0 m stage around the group's origin.
2. **Code.** Write a factory, `createXPuzzle(): PuzzleDef`, in `src/game/puzzles/`. Keep the puzzle's state inside it (each `Game` gets its own, so a replay beside the live game can't disturb it) and reset that state in `setup`. Build terrain and fixtures in `setup`; never allocate in `step` or `afterStep`.
3. **Register it.** Add it to `createChapter1()` in `src/game/puzzles/index.ts`.
4. **Test it.** Add a headless test to `chapter-1.test.ts` that solves it every way it should be solvable, and checks the recorded solution.

## Saves: `src/game/save-state.ts`

### The save

`SaveState` is plain JSON:
- `version` and `chapter`
- `puzzle`: where to resume
- `solutions`: per puzzle id, the solution ids found
- `creatures`: the gallery; nothing adds to it since the companions were cut
- `chapterComplete`

`readSave(unknown)` turns untrusted stored data into a valid save. It never throws, and it is where future migrations go. Storage itself belongs to B's save service.

## Fixtures: `src/game/fixtures.ts`

Puzzle objects that aren't entities, for the renderer. Each has a `kind`, centre and size in stage metres, `active` and a kind-specific `value`.

| kind | active means | value |
|---|---|---|
| `cloud` | | |
| `wind` | | how hard it reaches the traveller (1, or 0.2 when sheltered) |
| `gate` | shut | 1 while open |
| `plate` | | 1 while pressed |
| `window` | lit (chapter end) | |

## Headless runner: `src/game/headless.ts`

`Headless` plays the game from scripted hands:
- `pose(hand, shape, x, y)`, `move` and `hide`
- `run(seconds, each?)` and `runUntil(done, max)`
- `saw(type, id)` checks the event log

A stand-in classifier commits a shape after the GDD hold time (0.4 s) and releases it on exit or switch. Shadows come from `shadow-shapes.ts`. Every puzzle test uses it, and it is handy for trying a puzzle idea before building it in the editor.

## Debug tools: `src/game/debug-snapshot.ts`, `src/game/replay.ts`

Drawing belongs to Teammate B's `src/debug`. These modules provide the data, and they are pure.

### Snapshot

- `fillSnapshot(game, snap)` copies the game's state into a reused `DebugSnapshot` without building anything, so it is safe to call every frame:
  - the puzzle and its phase
  - the traveller's state and position, and how long it has been stuck
  - each hand's role, water and fireflies
  - entity counts per kind
  - solution credit
  - contacts, overflow, and dropped time and events
- `describe(snap, game)` turns it into lines of text for a panel or a bug report. It allocates, so call it only while the panel is open.

### Replay

- `InputRecorder` records exactly what `game.frame()` was given each frame:
  - `dt` and `paused`
  - both shadows' capsules and bounds
  - the shape events

  It is allocated once (about 0.6 KB a frame; 60 s at 72 Hz is about 2.5 MB), and it stops when full.
- Call `recordCommand('restart' | 'goto', i)` alongside `game.restart()` / `game.goto(i)`, so the replay does the same.
- `replay(recording, freshGame)` plays it back. Build the fresh game from the same options; `Game` copies the save it is given, so the options stay as they were. The sim is deterministic, so the fresh game reaches the same state bit for bit, across puzzle loads (`debug.test.ts`).
- Uses: turning a bug seen in the headset into a test, and checking a fix. `Headless` takes a `recorder` too.

### Commands

- `game.restart()` reloads the current puzzle.
- `game.goto(i)` jumps to puzzle `i`.

### Several games at once

Puzzles are factories (`createChapter1()`), so each `Game` has its own puzzle state. A replay can run beside the live game without disturbing it (`game.test.ts`).

## Cost of a game frame

- **Time:** `game.perf.ts` measures 0.02–0.03 ms a frame on a desktop, in the rain puzzle (shower, cup and roof) and the crows puzzle (crows, fireflies in a cup). The budget is about 0.5 ms.
- **Allocation:** `game.alloc.test.ts` measures about 210 B a frame in the rain puzzle, against a budget of 320 B. That is number boxing; no objects or arrays are built.

## Entity store, layouts, 2D maths

These already exist; see the header comments in `entity-store.ts`, `entity-kinds.ts`, `scene-layout.ts` and `vec2.ts`, and [ADR 0006](adr/0006-editor-authored-layouts.md) for how layouts are authored.

## Design calls open for team review

The GDD doesn't specify these, so A's code makes them. They are flagged here so the team can overrule them.

- **No fail state.**
  - The traveller never dies. Hazards stop it or push it back, and it waits.
  - A fall puts it back at the puzzle start (`traveller-fell`).
- **A hand with no role is not solid.** Only a committed shape's shadow touches the world. It still always mirrors the hand visually.
- **The traveller won't walk into rain or past crows.** In puzzles 2 and 5 it is the traveller's caution, not damage, that makes the obstacle.
- **Puzzle 3 anchor:** the GDD's "fist rock as an anchor" is read as a fist held just above the traveller, which it holds on to.
- **Puzzle 6 plate:** the weight plate sits on a shelf above the path, so a fist resting on it doesn't block the traveller.
- **A custom 2D solver rather than a library:** see [ADR 0007](adr/0007-custom-2d-solver.md).
- **`content/levels` stays unused.** Per ADR 0006, layouts live in the scene file and puzzle logic in `src/game/puzzles/`.
- **Stage size** uses the GDD's constants (about 2 m away, 1.6 m wide) until it is tuned in the headset. Puzzle sizes assume a hand shadow about 0.3 m long on the stage.
