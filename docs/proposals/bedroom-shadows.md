# Proposal: a bedroom at night, and a world cast by objects

Status: draft for discussion, 10 Oct 2026. Nothing here is decided. Please comment on the PR; once we agree, this becomes a Direction paragraph in the GDD and an ADR, and this file is removed.

## The pitch

A kid can't fall asleep. It's late, the house is quiet, and he lies in bed with a torch, playing with the shadows on his bedroom wall until he drifts off. The player is that kid: their hands make the shadows, and the shadows help a little traveller wander across the wall. One chapter is one night; it ends when he falls asleep.

The tone is **cozy and calm**, not scary: a warm, familiar room, soft night sounds, and the small magic of shadow play. The kid is a little restless or unsettled, and playing is how he winds down; the game is about comfort, not fear.

## What changes from the current GDD

Today the traveller walks on a landscape that would be **drawn** on the paper wall. In this proposal, the landscape is the **shadow of real objects in the bedroom**: the shelf, the toy box, a chair with clothes over it, a plant on the windowsill. Their shadows become the hills, ledges and gaps of each level.

- **The room** is the kid's bedroom instead of the lantern-lit room. Still one virtual room, still seated, still hands only (ADR 0005 stands).
- **The light** is the kid's torch or night light instead of the lantern.
- **The levels come from the room.** Each puzzle is a different corner of the bedroom. Between puzzles, the light turns to the next corner and its objects' shadows become the next level.
- **Nothing in the room moves.** Every object stays where it is all night; only the light moves between puzzles, and only the hands change things during a puzzle. That keeps the room believable: it's just a kid shining a torch around a dark room.

## What stays the same

- **Pillar 1: your hands are the toolkit.** The player never grabs or moves objects; every action is still a hand shape.
- The shape vocabulary, companions, hold-to-commit, and how hand shadows are made.
- The simulation and gameplay code: the solver doesn't care whether a shadow came from a hand or an object. An object's shadow is worked out once when the puzzle starts and becomes ordinary terrain, so there is no extra per-frame cost.
- Session length, one chapter per night, one polished chapter for v1.

## Why

- **The room and the stage become one picture.** The player can look from a shadow to the thing casting it ("the mountain is my toy box"), which is a small moment of surprise in every puzzle.
- **It gives the game a story and a reason to exist,** in a few lines, without cutscenes.
- **Cheap to build.** One room, a handful of static props, no prop interaction, no per-frame cost for their shadows.
- **The designer controls shadow size.** Where a prop sits sets how big its shadow is, so puzzles can be sized to fit the hand shadows.

## Options we considered

| Option | Why not (for v1) |
|----|----|
| Keep drawn silhouettes on the wall (current GDD) | Works, but the room and the stage stay separate, and there's no link between what you see and what you play on |
| Invisible objects that only cast shadows | Players can't tell this from drawn silhouettes, so the 3D work buys nothing; if we want this, drawing 2D shapes is cheaper and gives more control |
| Moving props between puzzles in view | Breaks the room's realism |
| Moving the light during a puzzle | Reshapes the whole level at once; hard to design and hard to read |

Ideas to keep for later, not v1:

- **Drift into a dream.** As the kid gets sleepier, the room bends a little (a shadow lingers, a shelf is taller than it was). The final puzzle could let things move, because by then he's asleep.
- **Things that really move in a bedroom:** a ceiling mobile, a curtain in the breeze, a rotating star night-light. Good for one special puzzle.

## Open questions for the team

1. **Do we like the bedroom setting?** Does it still fit the competition pitch and the cozy audience?
2. **Who is the traveller?** A toy of the kid's, his dream self, or a little shadow creature that lives on the wall?
3. **Torch or night light?** A torch the kid points (light moves between corners) or a lamp on the bedside table (the camera turns instead)?
4. **How do we move between corners?** The light swings over, or a soft blink (eyes closing) hides the change.
5. **Art style of the props:** paper-cut or simple low-poly; how many per chapter (a rough guess: 8 to 12 for the room).
6. **Scope:** about 6 weeks to 19 Nov. Is the bedroom plus props affordable on top of the current plan?

## What it means for each of us

- **A (simulation & gameplay):** turn each prop's shadow into terrain when a puzzle starts; rework the chapter-1 puzzles around the bedroom's corners. Small, mostly reuses existing code.
- **Anson (engine, hands, shadows):** project prop meshes from the light onto the wall the same way as hands; the light changes position between puzzles.
- **B (render, art, UI):** the bedroom and its props instead of the lantern room; drawing the props' shadows; the transition between corners.

If we agree, the next step is a prototype: one corner of the bedroom with one prop, its shadow as the level, and one puzzle solved with a hand shape.
