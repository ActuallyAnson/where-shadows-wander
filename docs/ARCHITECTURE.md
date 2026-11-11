# Architecture

How Where Shadows Wander is put together: the layers, what runs each frame, which module does what, and the frame budget. The decisions behind it are in the [ADRs](adr/).

## Layers

```
IWSDK + three.js        XR session, renderer, display loop, emulator
        │
Engine-facing code      src/app, src/engine/xr, src/engine/shadow, src/engine/render,
        │               src/engine/anim (adapters), src/engine/services, src/ui, src/debug, src/input-mock
        │
Pure code               src/engine/hands, src/engine/stage, src/engine/shadow/pure
                        (plain TypeScript; no IWSDK, three.js or browser globals)
```

- **IWSDK** owns the XR session, the renderer and the display loop. We use it for the session and the emulator, and nothing else: v1 is a virtual room, so no scene understanding, planes or anchors, and sound is plain Web Audio ([ADR 0008](adr/0008-audio.md)); IWSDK's own audio system is still registered and makes its own audio context, so the page has two. Game state never goes into IWSDK's ECS ([ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md)).
- **Engine-facing code** talks to IWSDK, three.js, WebXR and the DOM. It turns the outside world into plain data, and plain data into things on screen.
- **Pure code** holds the logic: hand maths and the classifier, shadow projection and stage geometry. It's unit-tested in Node and can't see the engine, which ESLint enforces. This is also why the plain three.js fallback stays cheap ([ADR 0002](adr/0002-plain-threejs-fallback.md)).

## One frame

IWSDK calls `renderer.setAnimationLoop` and runs its systems in priority order. We register exactly one system, `FrameDriverSystem` in `src/app/main.ts`, at priority 10. It runs after IWSDK's input (−4) and scene understanding (−1) systems and before rendering. Everything of ours runs inside it, in this order:

```mermaid
flowchart LR
  XR["XR frame<br/>(IWSDK)"] --> Hands["Read hands<br/>engine/xr"]
  Hands --> Classify["Classify shapes,<br/>detect gestures<br/>engine/hands"]
  Classify --> Shadow["Project and draw<br/>hand shadows<br/>engine/shadow"]
  Shadow --> Light["Light the room<br/>engine/shadow, render"]
  Classify -->|"shape events"| Audio["Audio<br/>engine/services"]
  Light --> Draw["three.js render<br/>(IWSDK)"]
```

1. **Read hands and capabilities** (`engine/xr`): raw WebXR joints into `HandFrame`, 25 joints per hand in scene space ([ADR 0004](adr/0004-webcam-bench-and-hand-recordings.md)). In mock mode the webcam or a recording fills the same `HandFrame`. `CapabilityDetector` keeps one `Capabilities` object up to date (hands, passthrough, planes, meshes, anchors) and the detected planes as `DetectedPlane` records in scene space, normals toward the viewer, for StageFrame.
2. **Classify** (`engine/hands`): features, then the shape classifier with hold-to-commit and hysteresis, which emits shape events (`ShapeRecognizer`). Then the lantern gestures on the same features (`GestureDetector`): pinch-and-release to place or relight, a closed hand over the flame to pause.
3. **Shadows** (`engine/shadow`): `ShadowProjector` (pure, in `shadow/pure`) projects each hand onto the stage from the lantern with one matrix blended toward orthographic (k = 0.9), filling `HandShadow` (in `engine/hands`): 28 capsules per hand in 2D stage space, an outline and an edge blur. `ShadowRenderer` draws both hands from those capsules in one draw call, soft-edged and clipped to the stage. The stage is A's `StageFrame`, in a headset and in the Hand Lab alike, and the candle stands on the bed tray's saucer (`placeRig` in `main.ts`).
4. **Light the room** (`engine/shadow`, `engine/render`): the lantern light follows the candle's flame and flicker, and the paper wall, the bedroom, its dressing and the candle read it. The room's light spreads out from the flame once the candle is lit and draws back while the flame is covered (the pause).
5. **Audio** (`engine/services`): the shape events rustle and thump from where that hand's shadow is, and the candle crackles, lifts and sets down. Saves are written only on events (the headset coming off, the session ending, the page hidden), never per frame.
6. IWSDK renders the scene.

There is no gameplay step yet. The puzzle game and its fixed-step simulation were removed ([ADR 0016](adr/0016-story-shadow-theatre.md)); a story told in shadow puppets, advanced by the player's hand shapes, is planned in their place, and will get its own place in the frame when it is built.

The stage is a 2D world on one surface, the fixed virtual wall of the room. `StageFrame` (`engine/stage`) converts between 3D scene space and 2D stage space; a real table or wall (a possible later mode) would only supply a different frame.

## Stage frame: `src/engine/stage/stage-frame.ts`

`StageFrame` is the 2D coordinate system on the paper wall of the virtual room ([ADR 0005](adr/0005-virtual-room.md)). The hands' shadows are projected into it.

- **Spaces.**
  - The origin is the wall's centre.
  - Stage +x runs along `right`, and stage +y along `up` the wall.
  - `normal` points out of the wall, toward the player and the candle.
  - The basis is orthonormal and right-handed (`right × up = normal`), with the same axes as the stand-in `placeTestRig('wall', ...)`.
- **Placing it.**
  - `placeInFront(head, yaw)` places the wall once when the room is built. It sits `WALL_DISTANCE_M` (2 m) ahead and `WALL_CENTRE_BELOW_EYES_M` (0.2 m) below the eyes, upright, at `WALL_WIDTH_M × WALL_HEIGHT_M` (1.6 × 1.0 m). These are constants to tune in the headset.
  - `setWall(centre, normal, upHint, w, h)` takes any plane. It is there for a possible real-surface mode later.
  - Every change bumps `version`.
- **Converting.**
  - `toStage(x, y, z, out)` projects a scene point straight onto the wall. It returns the point's distance in front of the wall.
  - `toScene(sx, sy, out, offset)` goes the other way, `offset` metres in front of the paper.
  - `contains(sx, sy, margin)` tests whether a stage point is on the wall.
  - None of these allocate.
- **With the shadow projector.** `StageFrame` has exactly the fields of `StagePlane`/`MutableStagePlane` in `src/engine/shadow/pure/stage-plane.ts`, so it is passed straight to the projector. Pure code may not import `shadow/`, so the match is structural; `main.ts`'s typecheck enforces it.
- **Dropped by ADR 0005:** choosing a table or wall, snapping to detected planes, and a placement fallback.

## Modules

| Folder | Owner | Pure | Responsibility |
|---|---|---|---|
| `src/app` | Anson | No | Entry point: `World.create`, the driver system, wiring, the no-AR notice, IWSDK manifests |
| `src/engine/xr` | Anson | No | WebXR hand reading, capability detection, IWSDK workarounds, hand recorder, the hand visual (glove) |
| `src/engine/hands` | Anson | Yes | `HandFrame`, derived palm, shape features, classifier, gestures, recording format |
| `src/engine/shadow` | Anson | No (`pure/` yes) | Projected-shadow renderer; `pure/`: projection maths, capsules, stand-in rig |
| `src/input-mock` | Anson | No | Hand Lab (chosen on the page: `src/app/launch-mode.ts`) and its hand sources, webcam bench, MediaPipe conversion and worker |
| `src/engine/stage` | A | Yes | `StageFrame`: 3D ↔ 2D for the fixed virtual wall (a real surface in a later mode); the room layout file |
| `src/engine/render` | B | No | The candle, the title lighter, the bedroom and the bed tray |
| `src/engine/anim` | B | Core yes | Procedural rod-puppet animation |
| `src/engine/services` | Anson (B owns the content: sounds) | Adapters no | Saves (`saves/`: two checksummed slots, migrations, ADR 0010), settings (`settings/`: the accessibility settings table and the store that applies them live, ADR 0011), assets (`assets/`: budgets, manifest-from-files, loader; ADR 0009), audio |
| `src/ui` | B (settings panel: Anson) | No | Onboarding, lantern flow, placement, chapter flow, the settings panel (`settings-panel/`, ADR 0011) |
| `src/debug` | B (debug tools: Anson) | No | Diagnostics report, anchor probe, profiler, Copy report panel; the debug tools (overlays, system switches, replay, keys, menu pages), dev and tester builds only ([ADR 0012](adr/0012-debug-tools.md)) |

"Adapters no" means only the thin layer that talks to IWSDK or three.js may import them; the logic behind it stays pure.

## Frame budget

At 72 fps a frame has **13.9 ms**. Judges require at least 60 fps (16.7 ms), so 72 gives margin. These are **CPU** budgets per frame. GPU time is separate, so measure it on the Pico.

| Module | Owner | Budget |
|---|---|---|
| IWSDK systems and three.js render submission | (engine) | 4.0 ms |
| Read hands, capabilities | Anson | 0.4 ms |
| Features, classifier, gestures | Anson | 0.7 ms |
| Shadow projection and capsules | Anson | 0.9 ms |
| Hand visual | Anson | 0.2 ms |
| Room lighting and views | B | 2.3 ms |
| Services (audio, saves, asset streaming) | B | 0.5 ms |
| Diagnostics and profiler | B | 0.3 ms |
| **Headroom** | | **4.6 ms** |
| **Total** | | **13.9 ms** |

These are starting estimates. Desktop measurements so far: our whole frame was about 0.06 ms, and 500 instanced quads about 0.08 ms. Expect a headset to be 3–5× slower. Teammate B's profiler (`src/debug`) will measure each module against this table on the Pico, and the table should be updated from real numbers.

### Measuring it

| What | How | What it tells you |
|---|---|---|
| Our stages on a headset | `perf` in the diagnostics report (Copy report): `msAvg` and `msWorst` per stage (`read`, `classify`, `gestures`, `shadow`, `handVisual`, `audio`, `lab`, `total`; the shape-event sounds are timed inside `shadow`; `frameErrors` counts any part of the frame that threw) over the last 300 frames | Compare each stage with the table above. Browsers coarsen timers on Pages, so trust averages, not single frames |
| Our stages on a desktop | `npm run perf` | Per-stage time per frame. Headset budget divided by 4 is the desktop guide: read 0.1 ms, classify and gestures 0.175 ms, shadow 0.225 ms. Measured 3 Oct 2026: recognizer 3.4 µs, shadow 4.3 µs per frame |
| Allocation | `frame-pipeline.alloc.test.ts`, part of `npm test` | Runs recognizer, gestures and projector for 3,000 frames with no garbage collection inside the window (it fails if one runs) and fails above 700 B a frame. The stages build no objects or arrays. Measured about 530 B a frame (recognizer, gestures, projector, sharpen and lantern light), which is the engine boxing numbers returned by small helpers; it was 6.9 KB until `Math.hypot` (which allocates) was replaced with `Math.sqrt` in the hot paths |
| GPU time | Pico or Quest performance overlay | Not visible from JavaScript. Check with both shadows covering the stage and the Developer panel's shadow capsules on |

## The virtual room (v1)

The game runs in an `immersive-vr` session, seated (`local-floor`), and, beyond the `local-floor` and `bounded-floor` reference spaces, asks the headset for one feature: `hand-tracking`. The decision and its trade-offs are in [ADR 0005](adr/0005-virtual-room.md).

**How the session starts.** `iwsdk.config.json` sets `xr.mode` to `vr`, so IWSDK's own enter offer (`navigator.xr.offerSession`, which a headset browser may show as its own enter prompt; not yet seen on a Quest) and `world.launchXR` both ask for `immersive-vr`. The page launcher (`src/app/enter-ar-button.ts`) mounts whenever the browser has `navigator.xr`, next to any native prompt, and its title screen's BEGIN asks for exactly `local-floor`, `bounded-floor` and `hand-tracking`. On a browser with no enter prompt of its own, such as the Pico's, it is the only way in. Every build has the other two ways in (compatibility mode and IWSDK's own launch) behind "Trouble starting?" and a plain message if a start fails; the **Developer** panel (modes, testing switches, the launch log and "Copy logs") and the "Copy report" panel are debug tools (`src/debug/debug-flag.ts`), shown only in dev and tester builds and kept out of the judges' bundle by `npm run check:debug-free`. IWSDK adds one more optional feature, `layers`, to the requests it makes itself, whatever the config says. The passthrough (AR) mode is gone ([ADR 0017](adr/0017-one-address.md)). On an opaque display (VR) the scene has a solid dark background and the frame clears opaque (`src/engine/xr/session-mode.ts`); a see-through display would clear to transparent. The `render` section of the diagnostics report shows `blendMode` (what the session actually got).

**What the page starts as.** The address is always the plain page: no query options. `src/app/launch-mode.ts` keeps the mode (`game`, `lab`, or `room-editor` in dev and tester builds) in the tab's `sessionStorage`; the Developer panel, the no-headset page's **Try the Hand Lab** and the lab's **Back to the game** save a mode and reload. The testing switches are in `localStorage` (`src/app/testing-options.ts`). Probe scripts set both before the page loads (`scripts/lib/launch.mjs`).

| Part | How it works | Owner |
|---|---|---|
| The room | A small scene: the bed and its tray, the candle, the paper wall, lit by the candle. Opaque geometry; scenery near the shadows stays light and low-contrast | B |
| The stage | The paper wall is a `StageFrame` (`engine/stage`, structurally a `StagePlane`): `placeInFront(head, yaw)` puts it upright 2 m ahead, 1.6 × 1.0 m, 0.2 m below the eyes, facing the player, when the session starts and again on a recentre. `main.ts` uses it in a headset and in the Hand Lab; the old tabletop stand-in stage was removed. The projector blends 0.65 toward orthographic on the real wall with a low edge blur (`shadow/pure/real-wall.ts`), so a puppet hand casts a steady shadow about 15 × 35 cm (`stage-frame-geometry.test.ts`: with full perspective the shadows are several times too big and leave the wall). A bad head pose is ignored, not thrown on (`placeRig`). No plane detection and no fallback. The shadow renderer lifts the shadow 2 mm off the wall as before | A (frame), B (look) |
| The hands | The player cannot see their real hands, so `HandVisual` (`engine/xr/hand-visual.ts`) draws them from the 25 joints. `CapsuleHandVisual` is the first look: a flat dark glove from the shadow's own capsule pairs (`CAPSULE_JOINTS`), 2 instanced draw calls, about 0.01 ms a frame on a desktop, and under 64 bytes a frame in its allocation test. It draws after the paper and before the shadow without writing depth, so the shadow always draws over a hand that overlaps it. Each hand fades in over 0.15 s and out over 0.4 s when tracking is lost or the game is paused, drawn from its last fully tracked pose (the reader leaves stale joints in a partly tracked hand), (`hand-fade.ts`; an ordered dither, not blending, so overlapping joints do not show as blobs), and warms near the flame like the debug dots do (`candle-tint.ts`). It hides itself when the session's blend mode is not opaque (passthrough), whatever `?occlude` says. Known limit: it writes no depth, so the candle's flame shows through a hand held in front of it. A different look (a model, a paper-cut glove) implements `HandVisual` and replaces the one line in `main.ts` that makes it; the shadow comes from the joints, never from the model. The joint dots are a debug view: `?debug=joints` | Anson (rig and mapping), B (art) |
| No-hands cue | `HandsStatus` (`engine/xr/hands-status.ts`) turns the hand reader's output into `tracking`, `lost` or `unavailable`. With no tracked hand for 3 s, or no hand input source at all for 5 s (hand tracking off, controllers held, a browser that does not pass joints), a panel in front of the wearer says "Show me your hands" (`PromptPanel`, a second instance) and goes away the moment a hand is tracked. A frame step is counted up to 0.1 s, so the first frame after the headset was off does not read as a long dropout. This assumes a runtime keeps a hand's input source while the hand is out of view; if one drops it, a player resting their hands for 5 s would see the unavailable text. Check on a Pico by dropping the hands out of view and looking for `-(…:hand)` in `xrInput.readerEvents` in the diagnostics report. The thresholds and the two short texts are constants at the top of the file | Anson (signal), B (text) |
| Pause | `SessionVisibility` (`engine/xr/session-visibility.ts`) follows `session.visibilityState` (IWSDK also keeps `world.visibilityState`; this copy is Node-testable and survives the plain three.js fallback). `paused` is true for `hidden` and `visible-blurred` (the system menu has focus and no hand data arrives); `subscribe(fn)` is called on each change, for saves. The driver system skips hand reading and classification while `paused`, so nothing runs ahead of a game that is not being played. Other code reads `paused` (or subscribes) | Anson (signal), A, B |

Switched off for v1 (still in the repository for a possible real-room mode): the plane tracker and plane capabilities, and the passthrough compositing rules below. The `HandOccluder` and the composite probe were removed with the AR mode ([ADR 0017](adr/0017-one-address.md)); git history has them. The hand-tracking, shape, gesture, shadow, sharpen, flicker and performance work is used as built.

## Compositing over passthrough (real-room mode only; not used in v1)

The stage and shadows are drawn into the same frame as the room camera image (`immersive-ar`, `alpha-blend`). What we hand the compositor, and how it is kept right:

| Rule | Why |
|---|---|
| The frame clears to transparent black and the scene has no background | IWSDK sets this itself in an AR session (the report's `render.clearAlpha` shows it); three clears to transparent in an `alpha-blend` session anyway |
| Stage materials are `transparent`, `premultipliedAlpha: false` and `toneMapped: false` | Blending `src-alpha` over a transparent clear stores premultiplied colour, which is what the compositor expects. Black stays black whatever tone mapping a scene environment adds |
| Draw order: paper 1, hand visual 1.5, shadow 2, debug and stage sprites 3, joint dots 4 (debug only) | Opaque things draw first, then the transparent paper and shadow, then overlays |
| A real-room mode needs a depth-only hand occluder (removed; see git history for `HandOccluder`) | The paper and shadow cover the camera image, so without it a real hand held in front of the stage would be hidden behind them |
| Any colour shader we add includes `colorspace_fragment` | The XR target is sRGB. Only black-only shaders (the shadow) may skip it |

The lantern's glow (`LanternGlow`) is a camera-facing quad with a bright core and a soft halo, drawn at order 3 with ordinary alpha blending (never additive, which would vanish on a passthrough display) and `colorspace_fragment`. It and the paper's shimmer read one `LanternLight` (position, lit, intensity, colour) from `LanternLightModel`; Teammate B's lantern flow sets `lit` and the position.

The diagnostics report has a `render` section (`clearAlpha`, `toneMapping`, `outputColorSpace`, `blendMode`, `layer`) to read this off a real session. Stop and report if the blend mode is `additive` or `opaque` (black shadows are invisible on an additive display) or the tone mapping is not `none`. `clearAlpha` shows IWSDK's setting; in an `alpha-blend` session three clears to transparent whatever it says, so `blendMode` is the field that matters.

## Rules that keep it working

| Rule | Why |
|---|---|
| Pure code never imports the engine or browser globals | Logic stays unit-testable in Node, and the engine can be swapped ([ADR 0002](adr/0002-plain-threejs-fallback.md)) |
| No objects or arrays built in per-frame code (reuse structs and typed arrays) | Garbage collection pauses cause dropped frames on a headset; `frame-pipeline.alloc.test.ts` guards it |
| One driver system | Our frame runs in a known order; IWSDK's private loop stays untouched ([ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md)) |
| Raw WebXR, every feature optional and feature-detected | Works on Pico, Quest and the emulator alike ([ADR 0003](adr/0003-pico-as-stand-in-test-device.md)) |
| Exact version pins; one three.js | IWSDK is young and pins its own three.js fork ([ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md)) |
| Debug code is reached only through `if (DEBUG_TOOLS)` and a dynamic import | The judges' build must not contain it; `scripts/check-debug-free.mjs` builds both ways and looks ([ADR 0012](adr/0012-debug-tools.md)) |
| Lucide icon set aliased out | First load 0.7 MB instead of 1.7 MB ([ADR 0001](adr/0001-iwsdk-as-xr-and-view-layer.md)) |
| No top-level `await` in entry files | Deadlocks IWSDK's lazy chunk in production builds |
| IWSDK's hand meshes hidden every frame, its rays turned off | Players see their real hands in passthrough and never point at anything; IWSDK's own hand toggle doesn't work |

## Builds and deploys

- `npm run dev`: IWSDK's dev server with HTTPS and the IWER emulator (Quest 3, synthetic living room).
- `npm run build`: production build in `dist/`, with two pages: `index.html` (the game, and the Hand Lab, chosen on the page) and `webcam.html` (the webcam bench). MediaPipe loads only on the bench and in the Hand Lab's webcam worker, never in the game's first load. Relative URLs, so it works under a GitHub Pages subpath.
- CI (`.github/workflows/ci.yml`) runs `npm run check` and a build on every PR. Merging to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`).
