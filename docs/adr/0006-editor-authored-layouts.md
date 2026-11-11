# ADR 0006: Puzzle layouts and the room are authored in IWSDK's scene editor and read by a small loader

Status: superseded by [ADR 0016](0016-story-shadow-theatre.md) on 11 Nov 2026 (the puzzle gameplay was removed). Was: accepted 7 Oct 2026 (Anson; Damon agreed to the loader approach in chat). Trial results below; some items are still open.

## Context

[ADR 0001](0001-iwsdk-as-xr-and-view-layer.md) kept game state out of IWSDK's ECS, so IWSDK's visual scene editor could not see anything the game owns, and the room and puzzles would have been placed by typing numbers in code. We want a visual editor. Registering our entities with the ECS would put IWSDK into the pure folders (`sim`, `stage`, `game`), which ESLint forbids and which would end the Node-only unit tests, the cheap plain-three.js fallback ([ADR 0002](0002-plain-threejs-fallback.md)) and the no-allocation entity store.

## Decision

- The editor edits **scene files** in `public/scenes/` (`*.iwsdk.scene.json`). The room (`main.iwsdk.scene.json`, Teammate B) and the chapters' puzzle layouts (`chapter-1.iwsdk.scene.json` and so on) are such files.
- Game state stays in our entity store. A small pure loader, `src/engine/sim/scene-layout.ts`, reads a scene file as plain JSON (it imports nothing from IWSDK) and creates entities. **Everything is set with the editor's own fields**; the inspector does not show a node's `metadata`, so none of it lives there:
  - **Asset** is what the node is. `piece-<kind>` (`piece-rock`, `piece-crow`, and one per `Kind`) is an entity. `marker-<tag>` (`marker-gap`, `marker-goal`, `marker-plate`) is a named spot for puzzle code. Any other asset, or none, is ignored (the room, groups).
  - **Position** x and y, in metres, are the stage position; z is ignored.
  - **Scale** is the size: a piece's radius is its scale (the stand-in is a unit sphere, so the size drawn is the size used), and a marker's width and height are its scale x and y.
  - **The `Piece` component** (Add Component in the inspector) holds starting speed `vx`, `vy` and the flags `isStatic`, `isSensor`, `hidden`. It is declared in `src/app/components.ts` only so the editor can show it; nothing reads it from the ECS.
  - **Visible** off skips the node and everything under it.
  - Groups nest and their translations add up; a parent's rotation or scale is ignored and reported. One chapter file holds several puzzles as groups (`puzzle-1`, `puzzle-2`); `parseLayout(doc, 'puzzle-1')` reads one.
- The stand-in shapes are in `src/app/assets.ts`, one per `Kind` plus the markers. `src/app/scene-files.test.ts` checks that every `Kind` has one, that every piece or marker a scene file uses exists, and runs every file in `public/scenes/` through IWSDK's own validator (the one the editor uses) and our loader.
- `public/scenes/` is in `.prettierignore`: the editor writes its own format.

## Trial results (IWSDK 1.0.0, dev server and its managed browser)

- Our scene file opens in the editor and validates with no diagnostics; the scene graph, viewport, transform inspector and asset panel work, and the running game loads the nodes into its runtime hierarchy.
- The inspector shows Asset, Visibility, Transform and Components for a node, and no metadata, which is why the settings use those fields.
- A custom component declared in `src/app/components.ts` is registered with the editor (the registered list grew from 41 to 42).

## Verified by hand (7 Oct 2026, in the editor window)

Moving a piece, resizing it, changing its asset, adding the `Piece` component, adding a new piece from the Assets panel (named `piece-crow-1` and so on), undo and redo, and resizing a marker all work, and the editor saves automatically. The saved file passes IWSDK's validator and our loader reads it: the rock came out at the edited position, with radius 0.1 from its scale, `vx` and `vy` 0.5 and the `isStatic` flag from the `Piece` component, and the gap marker's width from its scale. The editor sorts keys alphabetically and writes every `Piece` field (`hidden`, `isSensor`, `isStatic`, `vx`, `vy`) and a `rotationDeg` on every node it touches, which the loader accepts (it reports a non-zero rotation on a piece or marker as ignored). The editor's Validation panel shows "No validation result yet" until something is validated; it is not an error.

## Update (11 Oct 2026): prefabs and patterns

The editor draws prefab instances and repeated patterns (a row, grid or circle of copies) from a scene file, but has no controls to make them, so they would have to be written by hand. The loader does not expand them. It reports an `instance` or `pattern` node in `problems` (and the scene-file test fails on it) rather than letting the pieces in it silently never spawn. Expanding patterns is possible later, in the pure loader, if a puzzle needs a repeated prop. The editor's full feature list, checked against a running editor, is in `docs/getting-started.md` section 12.

## Not yet verified

- **Switching a node off.** The editor's Visible toggle in the inspector worked by eye, but the file saved afterwards had it switched back on, so a saved `"visible": false` has not been seen. IWSDK's scene patch code writes that key and the loader reads it. The scene-graph hide (`set-preview-visibility`) is preview-only and is not saved.
- Nothing runs this on a headset yet, and nothing in the game calls the loader yet: Teammate A's puzzle code will.
- The stage is the editor's x and y plane (a wall); dragging a piece on the floor also changes z, which the game ignores.

## Consequences

- Visual editing of the room and puzzle layouts, with game logic, tests and the fallback unchanged.
- The loader and `src/app/assets.ts` are the only code that know the asset-name convention. A new `Kind` needs its entry in `entity-kinds.ts`, a capacity in `DEFAULT_CAPACITIES` (the store throws if the lengths differ) and a colour in `assets.ts` (a test fails if the asset is missing).
- `src/app/components.ts` is no longer empty (ADR 0001 said it would stay empty); it holds the one editor-only component.
- IWSDK's editor still cannot see live game objects (shadows, rain, the traveller's path); those stay in code. The editor sets where things start.
