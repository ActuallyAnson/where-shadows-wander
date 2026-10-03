# ADR 0004: Webcam hand bench and hand recordings as test inputs

| | |
|---|---|
| Status | Accepted |
| Date | 2 Oct 2026 |

## Context

The pose classifier (GDD, week 3) needs real hands making real shapes: flat hand, cup, fist, pinch. The IWER emulator only has a few hand poses plus an open-to-pinch blend, and its hands never jitter. We have no Quest, and headset time on the Pico is limited (see [ADR 0003](0003-pico-as-stand-in-test-device.md)). We need a way to work on shapes at a desk, and a way to keep real hand data so tests can replay it.

## Decision

### 1. Every hand source produces the same `HandFrame`

The classifier only reads `HandFrame` (`src/engine/hands/hand.ts`: 25 WebXR joints in metres, scene space). Each source converts into it:

| Source | Code | Where it runs |
|---|---|---|
| Headset (Pico, Quest), emulator | `src/engine/xr/xr-hands.ts` (raw WebXR) | The game, `index.html` |
| Webcam | `src/input-mock/mediapipe-hands.ts` (MediaPipe) | The webcam bench, `webcam.html` |
| Recording | `replayInto()` in `src/engine/hands/hand-recording.ts` | Unit tests, and later the classifier tuning tools |

Shape features live in `src/engine/hands/hand-features.ts` (finger curl, thumb–index gap, finger spread) and `derivePalm()` in `hand.ts`. They are pure TypeScript, so the game, the bench and tests all compute exactly the same numbers.

### 2. Webcam hand bench (`webcam.html`)

- Uses Google's MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`, pinned to exactly **1.0.1**). The runtime (about 3.4 MB gzipped) is bundled only into the bench page, never into the game. The hand model (about 8 MB) downloads from Google's model storage the first time the bench starts.
- Open it with `npm run dev`, then https://localhost:8081/webcam.html. Video stays in the browser; nothing is uploaded.
- It shows each hand's skeleton over a mirrored preview, plus palm direction, thumb–index gap, finger spread, per-finger curl, and a rough shape label. The label is a first guess for the bench only; the real classifier adds palm direction, hold time and hysteresis.
- **Record** saves the same `.handrec.json` format as the headset recorder.

**Converting 21 landmarks to 25 joints.** MediaPipe has the wrist, the four thumb points, and the knuckle, middle joint, end joint and tip of each finger. Those map directly to WebXR joints. WebXR's four finger *metacarpal* joints (near the wrist) don't exist in MediaPipe, so they are placed 15 % of the way from the wrist to each knuckle. MediaPipe's world axes (x right, y down, z away from the camera) become scene axes by flipping y and z. That is a rotation, not a mirror, so left and right hands keep their true shape, which `derivePalm()` depends on.

**Handedness: MediaPipe's label is used as is.** MediaPipe's docs say the label assumes a mirrored (selfie) image, which suggested swapping it for raw camera frames. On a real photo of a person holding up both hands, swapping gave the wrong hand names *and* flipped both palm normals away from the visible palms. Without the swap, both names and both palm directions are right. Only the on-screen preview is mirrored, with CSS; the frames given to MediaPipe are not. If a MediaPipe upgrade changes this, `src/input-mock/mediapipe-hands.test.ts` and a photo check will show it.

### 3. Hand recordings (`.handrec.json`)

- Format in `src/engine/hands/hand-recording.ts`: joint positions in whole millimetres per frame (null when a hand isn't fully tracked), joints tracked per hand, headset position, a timestamp, the browser's user agent and a free-text note. About 45 KB per second for two hands.
- **On a headset:** add `?record=<seconds>` (and optionally `&note=...`) to the game URL. Recording starts when the first hand is tracked. After leaving XR, the page offers **Download recording**.
- **On the webcam bench or in the Hand Lab (`?mock=1`):** **Record**, then **Stop and download**.
- **Viewing:** the Hand Recording Player page opens any `.handrec.json` and replays it in 3D with feature traces over time.
- Recordings go in `recordings/`, which is gitignored. Small fixtures that tests depend on should be kept elsewhere, or in Git LFS.

### 4. Update (3 Oct 2026): webcam hands in the Hand Lab

Mock mode (`?mock=1`, issue #6) added the Hand Lab, which has a webcam source next to synthetic, scripted and replayed hands. Two recordings from it changed how webcam hands are processed. The bench and the Hand Lab share all of this.

- **One MediaPipe run per camera frame.** It is triggered by `requestVideoFrameCallback`. `video.currentTime` moves every display frame even without a new picture, so checking it ran MediaPipe several times on the same image.
- **Hands keep their side when the label flips.** The label is still used as is (above), but MediaPipe sometimes flips it for a frame or two: a recording showed the right hand jumping 28 cm onto the left hand's spot. `HandAssigner` (`src/input-mock/hand-assigner.ts`) keeps each hand on the side it was on during the last 300 ms, and only goes against the label when that is clearly closer (by 5 cm). With no recent history, the label decides.
- **In the Hand Lab, MediaPipe runs in a worker, on the CPU** (`hand-landmarker.worker.ts`), with 640×360 camera frames. On the main thread it took 8–38 ms per frame and stalled drawing. With the GPU delegate in a worker, it still stalled the page (16.7 ms frames became 72 ms in a headless test), because it competes with the page's WebGL for the GPU. On the CPU in a worker the page kept 16.7 ms. The bench still runs MediaPipe on its own page.
- **Webcam hands are smoothed for display.** Each camera frame goes through a One Euro filter (`src/engine/hands/one-euro.ts`; it keeps about 28 % of jitter at rest and lags about 1 cm behind a 0.5 m/s move). The hand then glides between camera frames, which adds at most one camera frame of delay. Recordings made from the webcam source therefore hold smoothed hands. Headset hands are never filtered this way.
- In the Hand Lab, webcam hands are turned 180° about a point 0.5 m in front of the view, so you see them from your own side as a headset would. Turning, unlike mirroring, keeps each hand's true shape.

### 5. Update (3 Oct 2026): shape labels (#7)

Recordings can now say which shape each hand was making, so the classifier can be scored against them (#12).

- **Format version 2** adds `labels: { start, end, hand, shape }[]`, with times in seconds like frame times and `shape` one of the v1 shapes or `none` (relaxed). Version 1 files still load, as recordings with no labels.
- **Labels come from a guided recording** (`src/engine/hands/shape-script.ts`, `guided-recording.ts`): a script prompts each shape for a fixed time, and each prompt is labelled. On a headset use `?record&script=shapes` (a panel in the scene shows the prompts); at a desk, **Guided recording** in the Hand Lab or on the webcam bench.
- **A label is what the wearer was asked to do, not what the hand did.** Someone who misses a prompt is still labelled with it, so spot-check recordings by replaying them in the Hand Lab.
- **Only the settled middle of each prompt is labelled:** 0.5 s is left out at both ends, the time it takes to read a prompt and change shape. Relaxed rests between shapes are labelled `none`, so #12 can count false triggers. A hand that isn't being prompted has no label for that time; leave it out of accuracy counts rather than treating it as `none`.
- The script (`SHAPES_SCRIPT`) prompts every shape on the right hand, then the left: a 3 s relaxed lead-in, then each shape for 4.5 s with 2 s rests. 84 s in all, so each shape gets a 3.5 s label. (It was 3 s per shape at first, which was too quick to settle into a shape.)
- If a recording stops early, labels that end after its last frame are left out.

### 6. Update (3 Oct 2026): scoring and regression fixtures (#12)

- `npm run eval` scores the classifier against every labelled recording in `recordings/` (see getting-started, section 9). Scores are kept per source, because webcam and headset noise differ.
- Recordings stay out of git. Small clips that exposed a bug go into `src/engine/hands/fixtures/` (under 256 KB each, 2 MB in all), listed in `manifest.ts` with the result they must keep giving; `npm test` replays them.

## What each source is good for

| | Emulator | Webcam | Pico | Quest |
|---|---|---|---|---|
| Real hand shapes | No (few presets) | **Yes** | Yes | Yes |
| Real tracking noise and dropouts | No | Webcam's own, not a headset's | Pico's | **Quest's** |
| Viewpoint like the game | Yes | No (camera faces you; a headset looks down from your head) | Yes | Yes |
| Accurate depth | Yes | Approximate (one camera) | Yes | Yes |

So the webcam is for **shapes and classifier logic**. Headset recordings are for **tuning thresholds and hysteresis against real tracking noise**. Thresholds tuned only on the webcam must be checked against a headset recording before they're trusted.

## Consequences

- Classifier work in week 3 can start at a desk, daily, without a headset, and can include other people (the GDD asks for at least 3 testers).
- Bugs found in recordings become regression tests: save the recording and add a test that replays it.
- The bench depends on Google's hosted model file at first start. If that becomes a problem, copy the model into `public/` and point `MODEL_URL` at it.

## Update 7 (3 Oct 2026): first calibrated webcam runs

Three calibrated guided webcam runs by one person, both hands, scored 60.7 % frame accuracy before the change and 70.3 % after (flat 32 → 75 %, cup 47 → 63 %, fox 0 → 40 %; fist 89 %, spread 88 %, rabbit 64 %, no flicker). Findings and changes:

- On a webcam the thumb angle can't separate a flat hand from a fox: a flat right hand measured about 47° and the fox thumb about 42°, so flat read as fox. Palm direction does separate them (flat about −0.9, fox about 0 to −0.2). Fox now needs the palm sideways (−0.7 to 0.7 against the stage normal) and a thumb of at least 38°; flat allows a thumb up to 50°.
- Cup's least-curled finger may be 0.15 (was 0.2).
- A palm-down fox with the thumb out is now a flat hand, by design; the synthetic fox fixture was regenerated with the palm sideways.
- One person is not enough to tune on: these are geometry fixes, not threshold fitting. Rabbit (64 %) and fox (40 %) are the weakest; wait for more people and the Pico before moving the curl and thumb bounds.
