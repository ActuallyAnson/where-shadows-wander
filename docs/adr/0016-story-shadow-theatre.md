# ADR 0016: A story told in shadow puppets replaces the puzzle gameplay

Status: accepted 11 Nov 2026. Supersedes [ADR 0006](0006-editor-authored-layouts.md), [ADR 0007](0007-custom-2d-solver.md), [ADR 0013](0013-game-contract.md) and [ADR 0014](0014-props-and-layouts-in-typescript.md).

## Context

The game was a physics puzzle: a little traveller walked across the wall, and the player's hand shadows became bridges, roofs and walls for it, with invisible props casting ground. Played in the headset, it felt bland. The shadows on the wall were simple shapes on a timeline, the puzzles asked for a narrow set of hand poses, and the story only showed in short captions between puzzles.

What does work is the candle, the room and seeing your own hands' shadows on the wall. The new direction builds on that: the wall shows a story, played as a shadow-puppet theatre in detail, and the player moves it on by making a named shape with their hands (a rabbit, a bird, a flat hand). The team does not use Blender, so the puppets are 2D cut-outs (AI-generated silhouette art, in parts with pivots) placed between the candle and the wall and cast from the flame, so their shadows grow, blur and flicker like real ones.

## Decision

- **The puzzle gameplay is deleted, not just unwired.** Gone:
  - `src/game` (the night, the puzzles, the traveller, the props, the story beats, the game's save) and `src/engine/sim` (the solver, the entity store, scene layouts, the fixed-step loop, the old cutscene data);
  - the night driver, prologue, opening, ending and journal in `src/app`;
  - the views only the night used (stage renderer and sprites, kindred, rabbits, stickers, glows, rewards, sparks, the reading page, prop shadows and sketches, the cinematic and travel scenes);
  - the level editor, the debug tools' time control and collider overlay, and the scene editor's piece and marker stand-ins.

  Git history keeps all of it. The prologue goes too: it was a separate painted 3D scene, and it will come back as the first scene of the puppet story.
- **What stays** is the frame the story needs:
  - the bedroom and its room editor (ADR 0015);
  - the VR title and lighting the candle;
  - the hands' shadows on the wall (projector, renderer, StageFrame, the light pool);
  - the shape recogniser and gestures;
  - covering the flame to pause (the wall menu: Resume, Settings); since [ADR 0020](0020-pause-from-the-system-menu.md) the headset's system menu opens that menu instead, and covering the flame counts only in scene 7;
  - the Hand Lab, saves, settings, menus, audio, diagnostics and the debug tools.
- **The session is three states:** `title_vr` → `playing` (the candle lit, the shadows on) ⇄ `paused`.
- **Saves move to version 3:** the settings and the day last played. A v2 save migrates without loss of either (ADR 0010's machinery is unchanged).
- **Kept for the story, not yet wired:** `fade-view.ts` (fade to black), `pure/skip-touch.ts` (poke to skip) and the sound definitions in `sounds.ts` (chime, notes, music, ambience) as a palette for scenes.

## What comes next

These are planned, not built:
- A cut-out puppet format (parts, pivots, keyframes).
- A caster that renders the puppets from the flame onto the wall.
- A scene player with markers for captions and sounds.
- A story graph: play a scene, wait for a shape, play the next.

Each gets its own ADR when it is built.

## Consequences

- The game has no gameplay until the story system lands; the build shows the room, the candle and your shadows.
- About 25,000 lines and their tests are gone, and with them the 2.0 ms simulation budget in ARCHITECTURE.md.
- Docs that described the puzzles are removed: SIMULATION.md, DESIGN-WORKSHEET.md and `docs/levels/`. The GDD and the architecture describe the new premise.
