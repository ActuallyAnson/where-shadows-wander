# ADR 0005: A virtual room instead of the player's real one

Status: accepted 5 Oct 2026. Revisit after the first Quest test.

## Context

The first design put the game in the player's real room: a lantern on their real table, a tabletop theatre or their real wall as the stage, in passthrough (`immersive-ar`). That needs a detected table or wall, plane and anchor support that differs between headsets (the Pico browser gave neither reliably), passthrough compositing, and a hand occluder so the paper did not cover real hands. It also made the look depend on every player's room.

## Decision

The game is set in a small **virtual room** in an `immersive-vr` session. A lantern on a table lights a paper wall; the player's hands, which they cannot see in VR, are drawn as simple hand models; their shadows (cast from the tracked joints) land on the wall, and the traveller walks across it. The stage is a fixed, known wall, so there is no surface detection and no fallback.

Considered and not chosen: keeping the real room (original plan), and a middle path (real table and hands in passthrough with a virtual backdrop behind the stage). The middle path keeps the "your room is the stage" idea and needs no hand model; it remains the recommended fallback if the VR-only scoring risk proves too high.

## Consequences

- Needed: a hand model (rig and mapping from the 25 joints: `engine/xr`; art: B), the room scene (B), an in-scene "no hands" cue and a pause on `visibilityState`.
- Reused as built: hand tracking, shape recognition, gestures, shadows, sharpen, lantern light and flicker, performance work, the Hand Lab.
- Switched off, kept in the repository for a possible real-room mode: `HandOccluder` (it must default to off in VR), plane detection and the plane tracker, passthrough compositing rules, the composite probe. Work-plan item #13 is not needed for v1.
- Easier: art, lighting and testing are the same for every player; nothing depends on the room. Simpler for A: the stage frame is a constant.
- Risks: the judging criteria reward passthrough, scene understanding and anchoring for entries that use them, and the Boldest Original Concept award favours ideas that depend on the real world; we compensate with hands-first design, the first five minutes, accessibility and polish, and ask the organisers how a VR-only entry is scored. The hand model and room are more art than flat paper. The Pico browser does not yet give our page hand joints in either mode (see ADR 0003), so the first real test of this design needs Wolvic on the Pico or a Quest.

## Update (11 Oct 2026): the real wall

The headset now uses Teammate A's `StageFrame` (2 m ahead, 1.6 × 1.0 m, 0.2 m below the eyes) instead of the stand-in stage; the stand-in stays for the Hand Lab's tabletop theatre and tests (`?mock=1&stage=real` shows the real wall on a desktop). Numbers below are measured with `stage-frame-geometry.test.ts` (an upright "puppet" hand, a flat hand pitched 90° up or down, and a flat hand pointing at the wall, which casts only an edge-on sliver), the lantern where the rig puts it (15 cm ahead of and 35 cm below the eyes) and hands 0.3 to 0.6 m ahead.

- **Full perspective (blend 0, what the tabletop theatre uses) does not work on this wall:** a puppet hand's shadow is 0.4 to 1.0 m wide and 0.8 to 2.5 m tall, and mostly off the wall.
- **Blend 0.9 (the GDD value) makes them too small:** 0.10 × 0.24 m, about 3° of a wall that spans 43° at the eye (13° for the Hand Lab's theatre). The 0.9 rationale (steady size when the wall's distance varies) does not apply to a fixed wall; only the hand's distance from the lantern varies.
- **So the real wall uses blend 0.65 and a low edge blur** (`shadow/pure/real-wall.ts`): a puppet hand's shadow is 0.14 to 0.16 m wide and 0.32 to 0.37 m tall, steady within about ±8 % as the hand moves, with a blur of 0.7 to 0.8 cm (about 5 % of the width; the default would be 2 cm, 20 %, and close the gaps between fingers).
- **Where hands reach:** with a wrist 0.15 to 0.3 m below the eyes and 0.4 to 0.5 m ahead, shadows span about y −0.35 to +0.5 on a wall that spans ±0.5, and a hand 0.2 m to either side puts its shadow 0.27 to 0.43 m off centre, so the middle 0.86 m of the 1.6 m width is used. A hand with the fingers up less than about 0.1 m below the eyes overflows the top (at eye level the shadow top reaches 0.66), and fingers down 0.3 m below the eyes touch the bottom edge. Whether the wall should be smaller or nearer is a headset question.
- **The bedroom proposal (PR #47)** puts the light behind the player: the blend and blur above assume the lantern in front of the player and would need re-tuning.
- **Paper brightness:** the candle's point light falls off with distance squared, so the wall at 1.85 m got about a seventh of the light the tabletop paper did (dark brown, shadow contrast about 2:1 instead of 5:1). The stand-in paper now gives off a little light of its own so the far wall stays readable; B's room art replaces it.
- **Shape rules:** the recogniser still compares palm direction with world up, so `flat` means palm down, which on this wall is the edge-on pose that casts the thinnest shadow. Using the wall's normal would change what `flat`, `cup` and `fox` mean and invalidate the labelled recordings: a decision for the shape rules, not made here. ([ADR 0021](0021-flat-faces-the-wall.md) has since let flat face the wall as well.)
