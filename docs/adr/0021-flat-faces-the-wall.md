# ADR 0021: A flat hand may face the wall

Status: accepted 18 Nov 2026. Settles the shape-rules question left open in [ADR 0005](0005-virtual-room.md).

## Context

The recogniser compared the palm's direction only with world up, so `flat` meant palm down (palm · up ≤ −0.5). The story shows flat the other way: the friend's hand at the opening, her wave at the school gate (end of scene 4) and the goodbye (scene 6) are upright palms facing the wall, and the outlines are drawn the same way. A player who copied them held a palm the recogniser could not accept: an upright palm reads 0 against up, 3.3 tolerance units outside flat, and still 1.3 outside at the highest tolerance setting. Flat only committed once the hand happened to tip about 30° toward palm down, which in play felt like the gate's wave taking a long time to be recognised.

## Decision

- **Flat accepts the palm facing down or facing the wall.** A new feature, `palmWall`, is the palm normal · the wall's normal (toward the player), so −1 is a palm to the wall. Flat's palm bound is on `palmFlat`, the smaller of `palmStage` and `palmWall`, at ≤ −0.5 as before. A palm-down flat hand reads exactly as it did, so the labelled recordings still pass.
- **The wall's normal comes from the stage.** `ShapeRecognizer.setWallNormal` is called with `StageFrame.normal` whenever the wall is placed (`main.ts`); until then it is +z, a wall straight ahead.
- **Fox may not face the wall:** it also needs `palmWall` ≥ −0.8, so an upright palm with the thumb out stays a flat hand (as a palm-down one does). The bound is −0.8, not −0.7, so a fox turned 45° to the side still reads.
- Cup is unchanged: palm up against world up.

## Consequences

- The flat waits in scenes 1, 4 and 6 accept the pose they show.
- A palm facing the player is still not flat; nor is a flat hand facing a wall off to one side.
- Headset recordings of an upright wave would make a useful fixture; there are none yet.
