# ADR 0004: Webcam hand bench and hand recordings as test inputs

| | |
|---|---|
| Status | Accepted |
| Date | 2 Oct 2026 |

## Context

The pose classifier (GDD, week 3) needs real hands making real shapes: flat hand, cup, fist, pinch. The IWER emulator only has a few hand poses plus an open-to-pinch blend, and its hands never jitter. We have no Quest, and headset time on the Pico is limited (see [ADR 0003](0003-pico-as-stand-in-test-device.md)). We need a way to work on shapes at a desk, and a way to keep real hand data so tests can replay it.

## Decision

### 1. Every hand source produces the same `HandFrame`

The classifier only reads `HandFrame` (`src/contracts/hand.ts`: 25 WebXR joints in metres, scene space). Each source converts into it:

| Source | Code | Where it runs |
|---|---|---|
| Headset (Pico, Quest), emulator | `src/platform/xr-hands.ts` (raw WebXR) | The game, `index.html` |
| Webcam | `src/platform/mediapipe-hands.ts` (MediaPipe) | The webcam bench, `webcam.html` |
| Recording | `replayInto()` in `src/contracts/hand-recording.ts` | Unit tests, and later the classifier tuning tools |

Shape features live in `src/contracts/hand-features.ts` (finger curl, thumb–index gap, finger spread) and `derivePalm()` in `hand.ts`. They are pure TypeScript, so the game, the bench and tests all compute exactly the same numbers.

### 2. Webcam hand bench (`webcam.html`)

- Uses Google's MediaPipe Hand Landmarker (`@mediapipe/tasks-vision`, pinned to exactly **1.0.1**). The runtime (about 3.4 MB gzipped) is bundled only into the bench page, never into the game. The hand model (about 8 MB) downloads from Google's model storage the first time the bench starts.
- Open it with `npm run dev`, then https://localhost:8081/webcam.html. Video stays in the browser; nothing is uploaded.
- It shows each hand's skeleton over a mirrored preview, plus palm direction, thumb–index gap, finger spread, per-finger curl, and a rough shape label. The label is a first guess for the bench only; the real classifier adds palm direction, hold time and hysteresis.
- **Record** saves the same `.handrec.json` format as the headset recorder.

**Converting 21 landmarks to 25 joints.** MediaPipe has the wrist, the four thumb points, and the knuckle, middle joint, end joint and tip of each finger. Those map directly to WebXR joints. WebXR's four finger *metacarpal* joints (near the wrist) don't exist in MediaPipe, so they are placed 15 % of the way from the wrist to each knuckle. MediaPipe's world axes (x right, y down, z away from the camera) become scene axes by flipping y and z. That is a rotation, not a mirror, so left and right hands keep their true shape, which `derivePalm()` depends on.

**Handedness: MediaPipe's label is used as is.** MediaPipe's docs say the label assumes a mirrored (selfie) image, which suggested swapping it for raw camera frames. On a real photo of a person holding up both hands, swapping gave the wrong hand names *and* flipped both palm normals away from the visible palms. Without the swap, both names and both palm directions are right. Only the on-screen preview is mirrored, with CSS; the frames given to MediaPipe are not. If a MediaPipe upgrade changes this, `src/platform/mediapipe-hands.test.ts` and a photo check will show it.

### 3. Hand recordings (`.handrec.json`)

- Format in `src/contracts/hand-recording.ts`: joint positions in whole millimetres per frame (null when a hand isn't fully tracked), joints tracked per hand, headset position, a timestamp, the browser's user agent and a free-text note. About 45 KB per second for two hands.
- **On a headset:** add `?record=<seconds>` (and optionally `&note=...`) to the game URL. Recording starts when the first hand is tracked. After leaving XR, the page offers **Download recording**.
- **On the webcam bench:** **Record**, then **Stop and download**.
- **Viewing:** the Hand Recording Player page opens any `.handrec.json` and replays it in 3D with feature traces over time.
- Recordings go in `recordings/`, which is gitignored. Small fixtures that tests depend on should be kept elsewhere, or in Git LFS.

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
