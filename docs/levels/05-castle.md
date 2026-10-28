# Puzzle 5: The castle (finale)

| | |
|---|---|
| New idea | Combine what you learned: puzzle 1's bridge and puzzle 2's fist |
| Intended | A flat hand over the moat and a fist on the counterweight, in either order |
| Alternative | The other order (both are recorded, so a replay can find the one not yet used) |
| Target time | 90 s |
| Mood | 0.85, then 1.0 at the return |
| Code | `src/game/puzzles/n5-castle.ts`, id `n5-castle` |

## What the player sees

A toy castle at the right end of the wall, behind a moat, its gate shut. On a little shelf above the path hangs the gate's counterweight, a small plate. The traveller walks to the moat and stops. A flat bridge gets it across (the tutorial's lesson), but then it waits at the shut gate. Resting a fist on the counterweight opens the gate with a clank, and it stays open, so the player can let go and use the same hand for the bridge. Inside the castle, the window lights: the night is over.

## Layout

```
 y
 0.5 ┌──────────────────────────────────────────────────────────┐
     │                                            ┌─┐ ┌─┐ ┌─┐   │
     │                                            │  castle │   │
     │                                            │ (drawn) │   │
-0.02│            ▭ plate                         │  [win]  │   │
     │           ═══ shelf                     ┃  │         │   │
-0.26│  T ─►                                   ┃gate  [G]   │   │
     │█████████████████████        ██████████████████████████████│
-0.40│███████ path ████████  moat  ███████ castle floor █████████│
-0.5 └──────────────────────────────────────────────────────────┘
    -0.8         -0.3      -0.1    0.12        0.44  0.62      0.8  x
```

| Prop | Shape | Where | Ground or drawn |
|---|---|---|---|
| Path | box 0.7 × 0.14 m | x −0.8 to −0.1, top −0.26 | ground |
| Castle floor | box 0.68 × 0.14 m | x 0.12 to 0.8, top −0.26 | ground |
| Castle | box 0.3 × 0.5 m | centre (0.62, 0.1) | drawn |

| Piece or marker | Where |
|---|---|
| `gap` (the moat) | x −0.1 to 0.12 (0.22 m, the tutorial's width) |
| `plate` (the counterweight) | centre (−0.3, −0.02), 0.14 × 0.03 m, on a thin shelf of its own, above the path so a fist on it never blocks the traveller |
| Gate | upright at x 0.44, from the floor up 0.2 m; terrain tagged `Gate`, solid while shut |
| Traveller start / goal | x −0.7 on the path / x 0.62 inside the castle |
| Window | lit above the goal on the last win (`window` fixture, (0.62, 0.05)) |

## Obstacles and solutions

- **Obstacle 1, the moat:** 0.22 m, wider than the traveller can step.
- **Obstacle 2, the gate:** solid until a fist (rock role) has rested on the counterweight plate for 0.3 s. Then it opens for good (`puzzle-event` `gate-open`).
- **Both are needed.** The solution recorded is the order:
  - `gate-first` (intended): fist on the counterweight first, then the bridge. Natural for a player who reads the plate before the moat.
  - `bridge-first`: bridge first; the traveller crosses and waits at the gate; then the fist.
- **How the code decides:** which side of the moat the traveller is on when the gate opens.
- **Doesn't work (tested):** the bridge alone (it waits at the gate), the counterweight alone (the moat is still there), a flat hand on the counterweight (only a rock has weight), a fist under the plate rather than resting on it.

## Hints

The hint follows what the traveller needs next (`hintShapeAt`): the moat's bridge until it is across, then the gate's fist.

| Rung | When stuck for | Before the moat | At the gate |
|---|---|---|---|
| Outline | 30 s | flat hand over the moat, at (0.01, −0.26) | fist on the counterweight, at (−0.3, 0.06) |
| Kindred | — | skipped: the kindred is away from the dimming until the return | skipped |
| Look back | 3 s | the traveller looks back at the player | it looks back, then up at the plate |
| Ease | 110 s | none: the outline is the help | the gate swings open by itself |

## Feedback

| Moment | Sound | Visual |
|---|---|---|
| Fist rests on the plate | a soft press | the plate dips (`plate` fixture value 1) |
| Gate opens | a wooden clank and a chain rattle | the gate swings up (`gate` fixture inactive, value 1) |
| Traveller reaches the goal | chime, and the lullaby resolves | the castle window lights (`window` fixture active), the wall warms to 1.0 |
| Then | the return and the end cutscenes play (see [the night](night.md)) | |

## Notes

- The castle is drawn, but it is only a shadow: its towers stand above the floor, clear of the traveller's head.
- The order is saved per puzzle (`save.solutions['n5-castle']`), which "Reason to come back" uses: a replay can nudge the player toward the order they haven't tried.
