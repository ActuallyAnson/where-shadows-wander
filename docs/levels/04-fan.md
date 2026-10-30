# Puzzle 4: The fan

| | |
|---|---|
| New idea | Shapes can block |
| Intended | A spread hand on the windward side as a windbreak |
| Alternative | A fist held just above the traveller as an anchor to hold on to |
| Target time | 60 s |
| Mood | 0.45 (after the dimming) |
| Code | `src/game/puzzles/n4-fan.ts`, id `n4-fan` |

## What the player sees

After the dimming the room is cooler and the kindred is gone. A desk fan stands at the right end of the shelf, its blades humming. The traveller walks into its wind, leans, and is blown back. A spread hand standing upright ahead of it, between the traveller and the fan, breaks the wind and lets it walk on; the player walks the windbreak along with it. A fist just above its head is something to hold on to: the traveller leans into the wind and inches forward.

## Layout

```
 y
 0.5 ┌──────────────────────────────────────────────────────────┐
     │                                                   ╭───╮  │
0.00 │                    ◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄ │fan│  │
     │                    ◄◄◄◄◄◄ wind ◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄ ╰─┬─╯  │
-0.26│  T ─►              ◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄◄  [G]│   │
     │███████████████████████████████████████████████████████████│
-0.40│████████████████████████ shelf ████████████████████████████│
-0.5 └──────────────────────────────────────────────────────────┘
    -0.8               -0.25                           0.72  0.8  x
```

| Prop | Shape | Where | Ground or drawn |
|---|---|---|---|
| Shelf | box 1.62 × 0.14 m | x −0.81 to 0.81, top −0.26 | ground |
| Fan head | sphere, radius 0.12 m | centre (0.72, 0.0) | drawn |
| Fan stand | cylinder, radius 0.015 m, 0.18 m tall | centre (0.72, −0.17) | drawn |

| Fixture | Where |
|---|---|
| `wind` | from x −0.25 to the right edge, half a metre tall above the shelf; its value is how hard the wind reaches the traveller (low when sheltered) |
| Traveller start / goal | x −0.7 / x 0.7, on the shelf |

## Obstacle and solutions

- **Obstacle:** from x −0.25 onward the wind pushes the traveller back at 0.22 m/s, faster than it walks (0.12 m/s). On its own it never gets through.
- **Solution `wall` (intended):** a spread hand standing upright on the traveller's windward (right) side shelters it. It has to be carried along as the traveller walks.
- **Solution `anchor` (alternative):** a fist held within 0.25 m above the traveller's centre; it holds on and feels only a quarter of the wind, so it inches forward. Too low and the fist stands in its way.
- **How the code decides:** each step, whether it is sheltered by a wall-role hand (`wallShelters`) or anchored by a rock-role hand.
- **Doesn't work:** a windbreak on the sheltered side (behind the traveller) (tested).

## Hints

| Rung | When stuck for | What |
|---|---|---|
| Outline | 20 s | a spread hand where the wind starts, at (−0.1, −0.11) |
| Kindred | — | skipped: the kindred is hiding after the dimming |
| Look back | 3 s | the traveller, holding its cloak against the wind, looks back at the player |
| Ease | 100 s | the fan slows to a breeze (`EASED_WIND_PUSH`, 0.05 m/s) the traveller walks through on its own |

## Feedback

| Moment | Sound | Visual |
|---|---|---|
| The fan | a steady hum from the fan's place on the wall | dust and paper scraps streaming left; the traveller's cloak flapping |
| Sheltered | the wind sound muffles near the traveller | the cloak settles |
| Anchored | a small grunt | the traveller leans into the wind, holding on |
| Solved | chime | the wall warms toward 0.85; the fan spins down |

## Notes

- The fist anchor's reach was widened from 0.15 to 0.25 m: a fist lower than about 0.13 m above the traveller's centre stands in its way, so the old reach left a band only 2 cm tall.
