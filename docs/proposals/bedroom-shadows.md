# Proposal: a bedroom at night, and a world cast by objects

Status: draft for discussion, 10 Oct 2026. Nothing here is decided. Please comment on the PR; once we agree, this becomes a Direction paragraph in the GDD and an ADR, and this file is removed.

## The pitch

A kid can't fall asleep. It's late, the house is quiet, and he sits up in bed playing with the shadows on his bedroom wall until he drifts off. The player is that kid: their hands make the shadows, and the shadows help a little traveller wander across the wall. One chapter is one night; it ends when he falls asleep.

The tone is **cozy and calm**, not scary: a warm, familiar room, soft night sounds, and the small magic of shadow play. The kid is a little restless or unsettled, and playing is how he winds down; the game is about comfort, not fear.

## How it works

Today the traveller walks on a landscape that would be **drawn** on the paper wall. In this proposal the landscape is the **shadow of real objects in the bedroom**, set up the way real shadow puppets are: a light behind you, a wall in front, your hands in between.

- **The player sits in bed facing a bare wall.** All play happens on that wall, in front of them. Nobody stands, walks or turns around (Meta's seated, stationary guideline, see [COMPETITION.md](../COMPETITION.md)).
- **One light, fixed, behind and above the bed:** a night light on the headboard. It doesn't move during the night.
- **The objects that cast the level are behind the player and beside the bed:** toys and books on the headboard shelf, the bedpost, a plant on the windowsill. Their shadows become the hills, ledges and gaps the traveller walks on. Because they are behind the player, they **never block the view of the wall**, which stays clear except for shadows.
- **The hands are in front,** between the light and the wall, so hand shadows work exactly as they do now.
- **The reveal is optional.** A player can glance back and see that the mountain is the teddy bear, but nothing requires it.
- **Between puzzles, the kid dozes.** When a puzzle is solved the scene softly blinks, as if the kid's eyes closed for a moment; when it fades back in, the objects behind him are arranged differently and the wall shows the next level. The player is facing the wall and the change happens in the blink, so nothing is ever seen moving and the room stays believable.

## What stays the same

- **Pillar 1: your hands are the toolkit.** The player never grabs or moves objects; every action is still a hand shape.
- The virtual room, seated, hands only ([ADR 0005](../adr/0005-virtual-room.md) stands).
- The shape vocabulary, companions, hold-to-commit, and how hand shadows are made.
- The simulation and gameplay code: the solver doesn't care whether a shadow came from a hand or an object. An object's shadow is worked out once when the puzzle starts and becomes ordinary terrain, so there is no extra per-frame cost.
- Puzzle layouts are still authored in IWSDK's scene editor ([ADR 0006](../adr/0006-editor-authored-layouts.md)); the props become nodes placed in 3D instead of shapes placed on the wall.
- Session length, one chapter per night, one polished chapter for v1.

## Why

- **The room and the stage become one picture.** The shadows have a real cause in the room, which gives the game a story and a small moment of surprise, without cutscenes.
- **The wall stays clear.** Objects behind the player can't get in the way of the shadows.
- **Believable and calm.** Nothing moves in view; the only change is during a sleepy blink.
- **Cheap to build.** One room, one fixed light, a handful of static props, no prop interaction, no per-frame cost for their shadows.

## The main risk: designing levels from bedroom props

Designing a level means finding props whose shadows make the shape the puzzle needs, which is harder than drawing the shape directly. Ways to keep it manageable:

1. **Design backwards.** Sketch the level first (a ledge here, a gap there), then pick props whose shadows give it.
2. **Use props that behave like building blocks:** books (a flat ledge of any width), toy blocks, boxes, a ruler. A kid's room is full of them, and they make most levels easy to build. Odd shapes (a plant, a teddy bear) are for decoration and the occasional landmark.
3. **See the shadows while editing.** A preview that shows each prop's shadow and the resulting terrain while props are moved in the editor. Most of the projection already exists.
4. **Allow a small cheat.** Where a shadow is almost right, the puzzle can add a little invisible terrain or switch a piece off; players won't notice.
5. **Prototype first.** One puzzle built this way will show how hard it really is before we commit the whole chapter.

## Options we considered

| Option | Why not (for v1) |
|----|----|
| Keep drawn silhouettes on the wall (current GDD) | Works, but the room and the stage stay separate |
| Objects in front of the player, between them and the wall | With the light near the player, each object hides its own shadow and clutters the view of the wall |
| Invisible objects that only cast shadows | Players can't tell this from drawn silhouettes, so the 3D work buys nothing |
| Moving the light between puzzles (moonlight, a door opening, car headlights) | Possible, but a fixed light is simpler to build and design for |
| Moving objects in view | Breaks the room's realism |

Ideas to keep for later, not v1:

- **The kid picks the next toy:** between puzzles the player picks a toy from the bedside table and sets it on the shelf, and its shadow joins the next level (the pinch-and-release gesture already exists).
- **Drift into a dream:** as the kid gets sleepier, the room bends a little; the final puzzle could let things move, because by then he's asleep.
- **Things that really move in a bedroom:** a ceiling mobile or a rotating star night-light, for one special puzzle.

## Open questions for the team

1. **Do we like the bedroom setting?** Does it still fit the competition pitch and the cozy audience?
2. **Who is the traveller?** A toy of the kid's, his dream self, or a little shadow creature that lives on the wall?
3. **What is the light?** A night light on the headboard, a lamp, or a torch propped on the pillow?
4. **Art style of the props:** paper-cut or simple low-poly; how many for the room (a rough guess: 8 to 12).
5. **Scope:** about 6 weeks to 19 Nov. Is the bedroom plus props affordable on top of the current plan?

## What it means for each of us

- **A (simulation & gameplay):** turn each prop's shadow into terrain when a puzzle starts; rework the chapter-1 puzzles around the props. Mostly reuses existing code.
- **Anson (engine, hands, shadows):** the light moves from the lantern on the table to behind the bed; project prop meshes from it onto the wall the same way as hands; check hand-shadow size with the light behind the head.
- **B (render, art, UI):** the bedroom and its props instead of the lantern room; drawing the props' shadows; the blink between puzzles.

If we agree, the next step is a prototype: the light behind the bed, two or three props on the shelf, their shadows as the level, and one puzzle solved with a hand shape.
