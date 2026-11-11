# ADR 0014: The bedroom puzzles' props and layouts are written in TypeScript, in stage space

Status: superseded by [ADR 0016](0016-story-shadow-theatre.md) on 11 Nov 2026 (the puzzle gameplay was removed). Was: proposed 25 Oct 2026 (Teammate A). Needs Anson to agree (his projector and converter are what the app's caster calls).

## Context

The bedroom direction (GDD, 17 Oct) makes the landscape out of the shadows of invisible props. Anson's `projectProp` (#65) and `addPropTerrain` (#68, `src/engine/shadow/pure/prop-terrain.ts`) turn a prop in scene space into a silhouette and then into solver capsules. Something has to say which props each puzzle has, and where.

[ADR 0006](0006-editor-authored-layouts.md) puts puzzle layouts in the scene editor's files. That works for pieces and markers, which are points and rectangles on the wall. A prop is different:
- It is a 3D shape with a size, a depth in front of the wall and a turn, and its shadow is what matters, not the shape itself.
- The editor has no prop assets, and adding them means stand-in shapes in `src/app/assets.ts` (Anson's).
- The editor would show the prop, not its shadow, so it can't help with "design backwards from the shadow" (GDD). How the editor might show a prop's shadow is still an open question in the GDD.

Two smaller facts matter too:
- **Where the wall is decides where a prop is.** The wall's place in the scene is only known once the room is set up. A prop stored in scene space would be tied to one room layout.
- **The lint rule keeps pure code out of the shadow folder.** It forbids `**/shadow/**`, which also catches `src/engine/shadow/pure`. So `src/game` cannot call Anson's projector directly, even from its tests.

## Decision

- **Props are written in TypeScript, beside the puzzle that uses them** (`PuzzleDef.props`, a list of `LevelProp` in `src/game/props.ts`). So is the bedroom puzzles' layout: the traveller's start, the goal and any markers (`PuzzleDef.layout`, a `LevelLayout` in `src/game/level.ts`). A puzzle can also go without the ground line along the bottom (`ground: false`), so its props are all the ground there is.
- **A prop is authored in stage space:**
  - `x` and `y` are its centre as seen on the wall.
  - `depth` is how far in front of the wall it stands (default 5 cm).
  - `tilt` turns it in the wall's plane.
  - `size` is the full size for a box. A sphere gives its radius; a cylinder gives its radius and its height.

  A prop close to the wall casts a shadow about its own size, so a level is drawn as the shadow it needs. `propToScene(prop, stage, out)` places it in scene space against the stage frame when the puzzle loads.
- **The level loader calls a `PropCaster`.** It is the one seam between gameplay and the projection.
  - The app's caster converts each prop with `propToScene` and calls Anson's `addPropTerrain` with the lantern's flame position, the stage, and the blend from the same shadow settings the hands use.
  - Headless play and the tests use `orthoCaster`: the fully orthographic shadow, which is exactly the prop's outline on the wall.
- **Each prop's capsules get their own tag:** `PROP_TAG_BASE` (16) plus the prop's index in its puzzle. Gameplay can tell which prop the traveller stands on, and the older tags (ground 1, gate 2, wall 5) stay as they were.
- **The game's terrain pool is 128 capsules** (`TERRAIN_CAPACITY` in `game.ts`), up from the solver's default 64.
- **Props are static and projected once, on load.** A moving prop would re-project only itself; nothing needs that yet.
- The older puzzles keep reading their layout from the chapter file, unchanged.

## Consequences

- **The tests cover the loader, not the projection.** Puzzle tests run against the orthographic stand-in. The real perspective-blended projection is tested in Anson's own suite. If the lint rule allowed `src/engine/shadow/pure` (a one-line exception in `eslint.config.js`), a test here could also run the real projection over every puzzle's props. That is worth adding.
- **Real shadows grow a little with depth.** With the real wall's blend of 0.65 and the lantern about 1.8 m from the wall, a prop's real shadow is slightly larger than its orthographic outline. It is about 1 % larger when the prop's front face is 5 cm from the wall, and about 4 % at 20 cm. So the bedroom puzzles use thin props (a few centimetres deep) close to the wall, and the two agree.
- **Scene files could carry props later without changing the game.** A loader would read `prop-<shape>` nodes into `LevelProp` records, once the editor can show what a prop's shadow looks like.
