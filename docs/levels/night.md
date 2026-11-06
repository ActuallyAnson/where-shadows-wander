# The night: level overview

The whole game is one night in the kid's bedroom: five levels, one new idea each, and three stages per level, each harder than the last. That is fifteen puzzles, about 10–14 minutes. This page is the arc and the shared rules; each level has its own page with its layout, triggers, hints and feedback. The first stage is described in full, and the harder stages are under "Stages" at the end. The theme and the reasons behind it are in the [GDD](../GDD.md); open design questions are in the [design worksheet](../DESIGN-WORKSHEET.md).

| # | Puzzle | New idea | Intended | Alternative | Target | Page | Code |
|---|---|---|---|---|---|---|---|
| 1 | The books (tutorial) | your shadow is a bridge | flat | — | 45 s | [01-books](01-books.md) | `src/game/puzzles/n1-books.ts` |
| 2 | The ledge | shapes can be a step | fist, lifted | flat, lifted | 60 s | [02-ledge](02-ledge.md) | `n2-ledge.ts` |
| 3 | The dripping plant | shapes can shelter | cup | flat roof | 60 s | [03-drip](03-drip.md) | `n3-drip.ts` |
| — | *The dimming* (cutscene) | | | | ≤ 15 s | below | |
| 4 | The fan | shapes can block | spread | fist anchor | 60 s | [04-fan](04-fan.md) | `n4-fan.ts` |
| 5 | The castle | combine what you learned | flat + fist, either order | (the other order) | 90 s | [05-castle](05-castle.md) | `n5-castle.ts` |

The table lists each level's first stage. Its two harder stages, in order:

| Level | Stage 2 | Stage 3 |
|---|---|---|
| 1 The books | `n1-stones`: two gaps, one bridge moved between them | `n1-wide`: a gap wider than a hand, crossed by carrying the traveller |
| 2 The ledge | `n2-stair`: two lifts | `n2-step-bridge`: a bridge, then a lift |
| 3 The dripping plant | `n3-hanging`: a long, swaying strip of drips, the cover carried along | `n3-drip-gap`: shelter, then a bridge |
| 4 The fan | `n4-two-fans`: two winds, the second stronger | `n4-fan-step`: a windbreak, then a lift |
| 5 The castle | `n5-wide-moat`: carried over the moat, and the counterweight | `n5-keep`: counterweight, moat, then a lift up to the keep |

The puzzles are built and tested headless (`src/game/puzzles/night.test.ts`, each solved every way it should be and failed one way it shouldn't). The app plays them (`src/app/night-driver.ts` turns the game's events into the room): the props' shadows, the hint ladder, the mood, the dimming, the return and the ending. What is still a first look or missing is under "What is left to build".

## The flow of the night

```
title (cold, dark) ─► lighting ritual (3 s at the wick) ─► OPENING ─► 1 books ─► 2 ledge ─► 3 drip
   ─► THE DIMMING ─► 4 fan ─► 5 castle ─► THE RETURN ─► THE END ─► "Begin again"
```

Between stages of a level: the traveller reaches the goal, `puzzle-solved` fires (the chime and the reward), a 2.5 s outro holds the scene, then the next stage's props swap in. Between levels, the last stage's solve also wakes the level's sleeper and warms the wall one step, and the travel scene walks the traveller into the next land. Because the props are invisible, nothing in the room is seen moving; only the wall's shadows change. The traveller walks in from the left edge of each scene.

Pausing (flame covered 3 s, or headset off) holds the world mid-puzzle. "Begin this puzzle again" reloads the current puzzle from its layout.

## Story beats (cutscenes)

Wordless apart from a few short captions, each under 15 s and skippable. Cutscene data is a list of timed beats (`CutsceneData` in `src/engine/sim/cutscene.ts`): captions and puppets moving from one stage position to another.

| Beat | Plays | What happens | Mood | Status |
|---|---|---|---|---|
| **Opening** | the candle is lit | The title on the wall, the kindred drifts in out of the dark, caption "Hold your hands to the light", the kindred fades. 11.5 s. | 0.4 | Built: `src/app/opening.ts` (captions are placeholders) |
| **The dimming** | after puzzle 3's outro, before puzzle 4 loads | The candle gutters (the flame shrinks, the flicker deepens for 2–3 s), the kindred darts behind the edge of the wall and hides, the room cools. No caption. Then the fan's scene fades in. The kindred stays away through puzzle 4, so its hint rung there is skipped (the traveller's look-back comes earlier instead). | 0.7 → 0.45 | Built simply: the mood drops and the kindred darts off and stays away. The candle's gutter is not built |
| **The return** | puzzle 5 solved, the traveller inside the castle | The kindred flies back in from the dark and circles the castle window, which lights; the room fills with warm light. | 0.85 → 1.0 | Built: the window lights, the kindred perches by it, the mood goes to 1.0, and the ending follows 3.5 s later |
| **The end** | after the return | Caption "The candle burns low.", the kindred flies to the traveller, the traveller cheers, "The light found its way home.", "Sleep well.", then the "The End" screen with "Begin again". | 1.0 → 0.3 | Built: `src/app/ending.ts` |

## Colour script (the wall's mood)

The paper wall has a mood value from 0 (cold, blue-grey) to 1 (warm amber), set by the game. Each solve warms it one step; the change eases in over the outro.

| When | Mood |
|---|---|
| Candle lit, puzzle 1 | 0.4 |
| Puzzle 2 | 0.55 |
| Puzzle 3 | 0.7 |
| The dimming, puzzle 4 | 0.45 |
| Puzzle 5 | 0.85 |
| The return | 1.0 |
| The end | settles to 0.3 (dim and quiet, not dark) |

## The hint ladder (every puzzle)

Help comes in steps while the traveller is stuck. The time counts from its first stop (blocked, looking back, held or pushed) and restarts only when it gets 10 cm past the furthest it has been, so creeping between drips or being blown back by the fan still adds up. Nothing is ever said in words, and the player never fails.

| Rung | When stuck for | What happens | Status |
|---|---|---|---|
| 1 | 0–20 s | nothing | — |
| 2 | 20 s | the ghost outline of the wanted shape, where it goes (`hint-show` with the shape and a stage position) | Built in the game; the outline view is built (`ghostTarget`) |
| 3 | 40 s | the kindred flies to the spot and perches just above the outline (`hint-kindred`) | Built |
| 4 | — | the traveller looks back at the player | Built differently: it looks back after 3 s blocked (`LOOK_BACK_S`), well before the outline, so there is no separate rung |
| 5 | 100 s | the obstacle eases (`hint-ease` and the puzzle's `ease` hook; see each page) | Built for the drips, the fan and the castle gate. The outline doesn't pulse yet |

Exceptions: the tutorial shows its outline after 0.5 s; the castle waits 30 s for its outline (and shifts the later rungs by 10 s). Each puzzle page names its hint spot, its kindred perch spot and how its obstacle eases.

## Shared conventions for the puzzle pages

- **Coordinates** are stage metres from the centre of the wall: x to the right (−0.8 to 0.8), y up (−0.5 to 0.5).
- **Ledges:** the shelf line every puzzle walks along has its top at y = −0.26 (`LEDGE_TOP`), 0.14 m tall. Props are 4 cm deep and stand just in front of the wall, so each shadow is about the prop's own size.
- **Ground or drawn:** a prop's shadow is ground (the traveller walks on it) unless the page marks it *drawn*, which is scenery only.
- **No ground line:** where there is no prop, the traveller falls and is put back at its start, unhurt, with no counter.
- **The traveller** is a circle of radius 0.04 m, walks at 0.12 m/s, steps up at most 0.03 m and down 0.05 m. It starts at x = −0.7 on every puzzle.
- **A flat hand's shadow** is a plank about 0.3 m long; a fist's is a round blob about 0.14 m across.

## Who builds what

| Part | Owner |
|---|---|
| Puzzle logic, triggers, credit, hints, saves (`src/game`) | Teammate A |
| Wiring `Game` into the app, cutscene data and playback, the kindred (`src/app`, `src/engine/shadow`) | Anson |
| Drawing the props' shadows, fixtures (drips, wind, gate, plate, window), traveller animation, sounds, menus (`render`, `anim`, `services`, `ui`) | Teammate B |

## What is left to build

1. **Art (B):** the fixtures view (`src/engine/render/fixtures-view.ts`) is a first look: black bars for the gate and plate, a warm rectangle for the window, thin streaks for the wind. The hint outline is one hand drawing for every shape (rotated for flat); fist, cup and spread need their own outlines.
2. **The dimming (Anson):** the candle guttering for 2–3 s. Today only the mood and the kindred change.
3. **The outline pulse** at the last rung, and the ledge's drifting outline that shows the lift.
4. **Sounds (B):** the ledge's lift and the gate opening (today a soft twinkle).
5. **Headset check:** the night has only been played in the Hand Lab (`?mock=1&stage=real`) and headless tests.
