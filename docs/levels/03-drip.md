# Puzzle 3: The dripping plant

| | |
|---|---|
| New idea | Shapes can shelter |
| Intended | A cup carried over the traveller to catch the drips |
| Alternative | A flat hand held up as a roof |
| Target time | 60 s |
| Mood | 0.7 |
| Code | `src/game/puzzles/n3-drip.ts`, id `n3-drip` |

## What the player sees

A long shelf with a freshly watered plant hanging above it. Water drips steadily from the leaves onto the middle of the shelf. The traveller walks up to the drips, holds its little lantern close, and won't walk into the water that would put it out. It walks on during a dry moment and stops again when drops land just ahead. A cup held over the traveller fills with drops as it walks under; a flat hand held high works as a roof.

## Layout

```
 y
 0.5 ┌──────────────────────────────────────────────────────────┐
0.38 │                    ✿ plant (drawn)                       │
0.30 │                 ' ' ' ' ' ' ' '                          │
     │                 '  drips   '  '                          │
     │                 ' ' ' ' ' ' ' '                          │
-0.26│  T ─►           '  ' ' '  ' '                       [G]  │
     │███████████████████████████████████████████████████████████│
-0.40│████████████████████████ shelf ████████████████████████████│
-0.5 └──────────────────────────────────────────────────────────┘
    -0.8            -0.1          0.2                        0.8  x
```

| Prop | Shape | Where | Ground or drawn |
|---|---|---|---|
| Shelf | box 1.62 × 0.14 m | x −0.81 to 0.81, top −0.26 | ground |
| Plant | cylinder, radius 0.07 m, 0.12 m tall | centre (0.05, 0.38) | drawn |

| Fixture | Where |
|---|---|
| `drip` | the drips' source, x −0.1 to 0.2 at y 0.3 |
| Traveller start / goal | x −0.7 / x 0.7, on the shelf |

## Obstacle and solutions

- **Obstacle:** 14 drops a second fall from y 0.3 at random x between −0.1 and 0.2 (seeded, so a restart drips the same). The traveller is held while a drop has landed within 12 cm ahead of it (or 3 cm behind) in the last half second, or while drops hit it.
- **Solution `cup` (intended):** a cup over the traveller catches the drops before they land. The player has to carry it along as the traveller walks; a cup holds 60 drops before it overflows and spills.
- **Solution `roof` (alternative):** a flat hand held up over the path stops the drops.
- **How the code decides:** while the traveller is under the drips, whichever cover (cup or flat) is over it gets the credit.
- **Doesn't work:** a cup held off to the side of the drips (tested).

## Hints

| Rung | When stuck for | What |
|---|---|---|
| Outline | 20 s | a cup just before the drips, at (−0.15, −0.06) |
| Kindred | 40 s | perches just above the outline, where the cup would go |
| Look back | 3 s | the traveller holds its lantern up toward the player |
| Ease | 100 s | the dripping slows to a third (`EASED_DRIP_SHARE`), so a roof or a cup held still is enough |

## Feedback

| Moment | Sound | Visual |
|---|---|---|
| Drops land | soft patter on the shelf, from the drips' place on the wall | small splashes |
| Drop caught in the cup | tiny plink, a little higher as it fills | the cup's water level (cup water count) |
| Cup overflows | splash (`puzzle-event` `cup-overflow`) | water spills |
| Solved | chime | the wall warms toward 0.7, then the dimming plays |

## Notes

- This is the last puzzle before **the dimming** (see [the night](night.md)): its outro hands over to that cutscene instead of straight to the fan.
- One of the two puzzles that keeps a hand up for a while (about 10–15 s): the alternative roof lets a tired player hold still.

## Stages

The page above is stage 1. Level 3 has two harder stages after it (`src/game/puzzles/n3-drip.ts`; the drips themselves are in `drips.ts`).

| Stage | Id | Layout | Solutions | Hint | Doesn't work |
|---|---|---|---|---|---|
| 2 The hanging plant | `n3-hanging` | a 0.6 m strip of drips (26 a second) that sways 4 cm each way over 5 s | `cup` or `roof`, carried along over the traveller | cup, beside the drips | a roof held still in the middle: it covers half the strip |
| 3 Drips and a gap | `n3-drip-gap` | drips from x −0.45 to −0.15, then a 0.22 m gap in the shelf | `cup` or `roof` through the drips (a flat hand can be the roof and then the bridge), then a bridge | cup beside the drips, then flat over the gap | the cover alone: the traveller waits at the gap |

**Change to every drip stage, stage 1 included:** the traveller no longer steps under the leaves unless the spot just ahead (0.12 m) is covered by a cup or a flat hand, with 3 cm to spare. It used to stop wherever the last drops happened to land, so it crept forward in dry moments, and each creep counted as progress and set the hint ladder back. Once the ladder eases the drips, only real landings stop it, so it can walk between the sparse drops.
