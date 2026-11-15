# ADR 0018: The Hand Lab runs in the game's session; the room editor is the one desk mode

Status: accepted 11 Nov 2026.

## Context

The Hand Lab exists for one thing: so developers can play the game in VR with hands other than the device's (posed, scripted, replayed or from the webcam). It ran as its own desk mode, with no XR session, and that kept producing visual differences from a headset:

- No session meant none of the session-start setup: no room backdrop or opaque clear (the canvas stayed transparent), and no head pose to place the wall from (a fixed desktop camera at (0, 1, 0.5), with an orbit view and a shifted projection for the panel).
- The quality governor and the hands cue were off, the candle lit itself after 3 s, and the cover-flame gesture aimed at the candle only in the lab.
- The lab drew its own bones and a lantern marker into the scene.

Every fix to one of these would have been a copy of something the session already does. Meanwhile the dev server's emulator gives any desktop browser a real `immersive-vr` session, and headless Chromium can enter it (the probes do).

## Decision

- **Mock hands are a choice inside the game, not a mode, and it changes live.** The Hand Lab panel's sources are **Device** (the emulator's or headset's own hands, where it starts), Synthetic, Script, Replay and Webcam; a press switches at once, in the session or out, with no reload (the frame loop asks the lab each frame which to read, as it does Debug Replay; the classifier starts fresh on a switch). The Developer panel's **Hand Lab panel** button shows and hides the panel at once (a `wsw-hand-lab` event; the lab is made the first time it is asked for). `src/app/launch-mode.ts` keeps `{ mode, hands, lab }` in the tab's sessionStorage so a reload comes back the same: `mode` is `game` or `room-editor` (the only choice that reloads), `hands` is `device` or a mock source, `lab` whether the panel shows. All of it is dev and tester only: without the debug tools the page is always the plain game with the device's hands. A tab left in the old `lab` mode opens the game with that source's hands and the panel.
- **The game runs as usual, in its session.** BEGIN starts the session (the emulator at a desk, or a headset) and all of the session-start setup runs. In the frame, a mock source fills the `HandFrame`s in place of `XRHandReader` (as Debug Replay already did), and the hands cue sees them as tracked. Everything else is the same code path as a headset: the head pose places the rig, the "Show me your hands" panel, no auto-lit candle, and the cover-flame gesture waits for the lantern flow.
- **Mock hands are posed for a desk rig and moved into the wearer's.** Every source poses hands for eyes at `MOCK_HEAD` looking down -Z (`MOCK_WRIST` is in that space). `DeskFrame` (`src/input-mock/desk-frame.ts`) moves them into the rig `placeRig` placed: the same offset from the eyes, turned by the rig's yaw. They keep their place relative to the candle and the wall wherever the emulated head is. The lab records hands before they are moved, so its recordings stay in the desk rig's space and replay the same way anywhere.
- **The Hand Lab is only a panel.** It keeps the sources, poses, calibration, the cards, the gesture log and recording. The orbit camera, the bone mesh (`hand-bones.ts`) and the lantern marker (`lantern-marker.ts`) are removed: in a session the camera is the head, and the debug overlays (Alt+J joints, Alt+K capsules) show what they showed. The panel sits above the title screen so a source can be picked before BEGIN. A recording keeps its source (the source buttons lock while it runs), and the lab does not record or pause the device's hands.
- **The quality governor is off under the emulator** (`IWER_DEVICE` present, dev only). A desktop display runs at 60 Hz, under the 72 Hz a headset reports, so the governor would always shed decoration and the desk would show less of the room than a headset does.
- **The room editor is the one desk mode.** It needs a mouse-driven camera, which a session would take over. It runs with no session from the desk rig, its room lit, and its Close returns to the game (there is no lab to return to).
- **The no-headset page no longer offers the Hand Lab.** It is a testing tool for a session; without one there is nothing for it to run in. The page says to open the link in a headset. This narrows [ADR 0017](0017-one-address.md)'s "Try the Hand Lab".
- **Probes enter the session.** `scripts/lib/launch.mjs` gains `enterVr(page)` (presses BEGIN, waits for the session) and `lightCandle(page)`. The audio probe uses a small page: the emulator's session is drawn by the software renderer, and a large page stalls the main thread long enough for its meters to miss short sounds.

## Consequences

- A desk session (the emulator, mock hands or the room editor) keeps its own save, `wsw.save.mock.*`, whatever the hands: they switch live, the save is chosen once at start.
- At a desk, the picture with mock hands is the picture a headset session draws; a difference left is the emulator's own (its field of view, its 60 Hz display), not ours.
- Desk testing needs the dev server (its emulator). A tester build on a desktop has no session unless the Immersive Web Emulator extension is installed; on a headset, mock hands work too (the panel is not visible inside VR there, but the source choice is made before BEGIN).
- `perf-bench.mjs` now measures a session's frame, so its numbers do not compare with runs made before this change.
- Fixed while moving the probes: the debug tools' shadow switch (Alt+1) was undone every frame by the frame loop; it now holds.
