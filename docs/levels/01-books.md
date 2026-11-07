# Puzzle 1: The books (tutorial)

| | |
|---|---|
| New idea | Your shadow is a bridge |
| Intended | Flat hand as a bridge over the gap |
| Alternative | none (the tutorial teaches one thing) |
| Target time | 45 s |
| Mood | 0.4 |
| Code | `src/game/puzzles/n1-books.ts`, id `n1-books` |

## What the player sees

Right after the opening: two low stacks of books on the wall, with a gap between them. The traveller walks in from the left and stops at the edge of the gap. Half a second later a faint outline of a flat hand appears over the gap. The player matches it with their own hand's shadow, the shadow sharpens and "takes" (paper rustle, soft thump), and the traveller walks across on it.

## Layout

```
 y
 0.5 ┌──────────────────────────────────────────────────────────┐
     │                                                          │
     │                                                          │
     │                                                          │
     │                  (flat-hand outline)                     │
-0.26│  T ─►                    ═════                       [G] │
     │███████████████████████       ███████████████████████████│
-0.40│███████████████████████       ███████████████████████████│
-0.5 └──────────────────────────────────────────────────────────┘
    -0.8                 -0.11   0.11                         0.8  x
           books                          toy block
```

| Prop | Shape | Spans (x) | Top (y) | Ground or drawn |
|---|---|---|---|---|
| Books | box 0.69 × 0.14 m | −0.8 to −0.11 | −0.26 | ground |
| Toy block | box 0.69 × 0.14 m | 0.11 to 0.8 | −0.26 | ground |

| Marker | Where |
|---|---|
| Traveller start | x −0.7, standing on the books |
| Goal | x 0.7, on the toy block |
| `gap` | x −0.11 to 0.11 (0.22 m), the hint's spot |

## Obstacle and solution

- **Obstacle:** a 0.22 m gap, wider than the traveller can step. It stops at the edge and waits.
- **Solution `bridge`:** any flat hand whose shadow spans the gap level with the books. The shadow's real outline is the collision, so a slightly tilted or short hand still works. Credit comes from the traveller standing on a bridge-role hand.
- **Doesn't work:** an animal shape (rabbit or fox) over the gap has no role, so its shadow passes through. Two fists side by side do get the traveller across; that is recorded as `other`, a way nobody designed, not as a failure.

## Hints

| Rung | When stuck for | What |
|---|---|---|
| Outline | 0.5 s | flat hand over the gap, at (0, −0.26) |
| Kindred | 20.5 s | perches just above the outline, over the gap |
| Look back | 3 s | the traveller turns to the player |
| Ease | — | none: the gap does not narrow (the tutorial should stay a bridge lesson) |

## Feedback

| Moment | Sound | Visual |
|---|---|---|
| Shape recognised | paper rustle | shadow edge sharpens |
| Shape commits | soft thump | shadow at its crispest; it reads as a plank |
| Traveller steps on | soft wooden step | — |
| Solved | chime | the wall warms toward 0.55 over the 2.5 s outro |

## Notes

- `src/game/tutorial-flow.ts` (shared with Anson) plays this same scene on its own today, until the app drives `Game`.
- This is the only puzzle the GDD's "first five minutes" times: the player should solve it within about 60 s of launching.

## Stages

The page above is stage 1. Level 1 has two harder stages after it (`src/game/puzzles/n1-books.ts`). The outline comes after 10 s on both, sooner than later levels, as the night has only just begun.

| Stage | Id | Layout | Solutions | Hint | Doesn't work |
|---|---|---|---|---|---|
| 2 Stepping stones | `n1-stones` | books, a 0.2 m gap, a toy block, a second 0.2 m gap, more books | `bridge`: one flat hand over the first gap, then moved to the second | flat, over the next gap ahead | a bridge left over the first gap: the traveller waits at the second |
| 3 The wide gap | `n1-wide` | a 0.44 m gap, wider than a flat hand's 0.3 m shadow | `bridge`: the traveller steps onto a flat hand at the near edge, stops at its end, and is carried across. `rock`: the same on a fist | flat, at the near edge | a bridge held still: the traveller waits at its far end |

Stage 3 teaches what the later levels rely on: a shape can **move** with the traveller on it.
