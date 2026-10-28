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
| Kindred | 40 s | perches where the cup would go, just above the traveller's head, at (−0.1, −0.05) |
| Look back | 70 s | the traveller holds its lantern up toward the player |
| Ease | 100 s | the dripping slows to about a third, so a roof or a cup held still is enough |

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
