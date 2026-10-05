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
