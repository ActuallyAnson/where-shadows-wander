# Puzzle 2: The ledge

| | |
|---|---|
| New idea | Shapes can be a step: a shape can carry the traveller up |
| Intended | A fist in the gap, lifted with the traveller standing on it |
| Alternative | A flat hand held low in the gap and lifted the same way |
| Target time | 60 s |
| Mood | 0.55 |
| Code | `src/game/puzzles/n2-ledge.ts`, id `n2-ledge` |

## What the player sees

The stack of books runs out a hand's width short of the bedside table, and the table is taller than the books: the traveller can't step up to it. The player has just learnt to make a bridge, so they will likely try a flat hand first; it gets the traveller off the books and up against the table's side, where it stops and looks up. The new idea is to **raise** the hand with the traveller on it. A fist is the shape the hint shows: it is a sturdy block to stand on, and it introduces the fist before the castle needs it.

## Layout

```
 y
 0.5 ┌──────────────────────────────────────────────────────────┐
     │                                                          │
     │                                                          │
-0.14│                            ███████████████████████  [G]  │
     │                      ●     ██████ bedside table ██████████│
-0.26│  T ─►              (fist)  ███████████████████████████████│
     │█████████████████████     ███████████████████████████████│
-0.40│█████████████████████     ███████████████████████████████│
-0.5 └──────────────────────────────────────────────────────────┘
    -0.8               -0.06  0.06                           0.8  x
           books
```

| Prop | Shape | Spans (x) | Top (y) | Ground or drawn |
|---|---|---|---|---|
| Books | box 0.74 × 0.14 m | −0.8 to −0.06 | −0.26 | ground |
| Bedside table | box 0.74 × 0.26 m | 0.06 to 0.8 | −0.14 | ground |

| Marker | Where |
|---|---|
| Traveller start | x −0.7, on the books |
| Goal | x 0.6, on the bedside table |
| `gap` | x −0.06 to 0.06 (0.12 m, about a fist's shadow wide), the hint's spot |

The table's top is 0.12 m above the books'; the traveller steps up at most 0.03 m.

## Obstacle and solutions

- **Obstacle:** the gap, then a 0.12 m rise. The traveller stops at the books' edge, and if it gets onto a hand in the gap, it stops again at the table's side.
- **Solution `rock` (intended):** a fist in the gap with its top level with the books (centre about y −0.325). The traveller walks onto it and waits against the table. The player lifts the fist about 12 cm; once the fist's top is within 3 cm of the table's, the traveller walks off onto the table.
- **Solution `bridge` (alternative):** the same with a flat hand.
- **How the code decides:** the runner credits the role of the hand the traveller stands on. The only way up is on a hand, so whichever it rode is the solution.
- **Doesn't work:** a fist held still at the books' height. The traveller stands on it and waits at the table's side (tested).

## Hints

| Rung | When stuck for | What |
|---|---|---|
| Outline | 20 s | a fist in the gap, at (0, −0.26) |
| Kindred | 40 s | perches just above the outline, in the gap |
| Look back | 3 s | the traveller looks back, then up at the table |
| Ease | 100 s | not built yet: the outline should drift up from the gap to the table's top and back, showing the lift |

The outline only shows the shape and where; rung 5's drifting outline is what shows the lifting motion. If playtests show players don't think of lifting, bring the drift forward to rung 2.

## Feedback

| Moment | Sound | Visual |
|---|---|---|
| Traveller steps onto the hand | soft step | — |
| Hand rises with the traveller on it | a small creak, rising in pitch | the traveller crouches, arms out, as on a lift |
| Traveller steps onto the table | soft step, a little "hup" | — |
| Solved | chime | the wall warms toward 0.7 |

## Notes

- **New sound and animation** for the lift (B): the game doesn't emit an event for it yet. The view can tell from the traveller standing on a hand (`traveller.standingOn`) whose shadow is moving up; if that is awkward, A can add a `puzzle-event` `lifting`.
- Fist shadows are round, so standing on one is a little less stable than on a plank. The headless tests use a stand-in blob; check it on the headset with a real fist.

## Stages

The page above is stage 1. Level 2 has two harder stages after it (`src/game/puzzles/n2-ledge.ts`).

| Stage | Id | Layout | Solutions | Hint | Doesn't work |
|---|---|---|---|---|---|
| 2 The stair | `n2-stair` | books, a 0.12 m gap, the bedside table 0.12 m up, a 0.12 m gap, the dresser 0.12 m higher again | `rock` or `bridge`: lifted up twice | fist, in the next gap, below its near ledge | one lift: the traveller waits below the dresser |
| 3 The bridge and the step | `n2-step-bridge` | books, a 0.22 m gap, more books, a 0.12 m gap, the table 0.12 m up | a flat bridge over the gap, then `rock` or `bridge` up the step (recorded by what carried it up: time on a hand at the step counts five times over) | flat at the gap, then fist at the step | the bridge alone: the traveller waits below the table |
