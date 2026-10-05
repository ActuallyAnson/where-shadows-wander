# Where Shadows Wander: Pico 4 WebXR Testing Findings & Investigation Report

**Document Date:** October 5, 2026  
**Target Hardware:** Pico 4 Standalone VR Headset (PICO OS 5.13.8)  
**Tested Browsers:** PicoBrowser 3.3.54 (Chromium 105.0.5195.68), Wolvic Browser 1.10 (Gecko 153.0), Wolvic Browser 1.4 (Chromium Generic Release APK)  
**Host Environment:** Windows PC (`192.168.0.7`), Node.js, Vite 8081 (HTTPS), Cloudflare Secure Tunnel (`trycloudflare.com`), Pico Drop Companion 3000  
**Project Architecture:** Meta VR Start Developer Competition 2026 project built on `@iwsdk/core` 1.0.0, Three.js (`super-three@0.181.0`), and TypeScript.

---

## Executive Summary

Over the course of testing on physical Pico 4 hardware, we systematically investigated why bare-hand skeletal tracking, joint dots, and projected hand shadows were not appearing inside the WebXR session.

The investigation uncovered the following core technical realities:
1. **The Headset's Optical Tracking Works**: The Pico 4's physical cameras and AI algorithms actively track the tester's bare hands throughout testing (visible via the native system reticle in passthrough).
2. **Built-in PicoBrowser 3.3 Limitation**: PicoBrowser 3.3 is based on **Chromium 105** (August 2022). In Chromium 105, WebXR Hand Input was behind experimental flags, and Pico's firmware did not bridge bare hands into WebXR sessions (`session.inputSources` returned 0 items).
3. **The Controller Emulation Trap**: When physical controllers were powered off, Pico OS and older Wolvic Gecko runtimes defaulted to backward-compatibility "Controller Emulation Mode". The system wrapped bare hands in virtual Pico-4 controllers (`profiles: ["pico-4"]`, `source.hand = null`), allowing pointing and clicking but hiding the 25 skeletal joints.
4. **The Engine Breakthrough (Wolvic Chromium 1.4 APK)**: True 25-joint bare-hand skeletal tracking was unlocked by installing the official **Wolvic Chromium generic release APK** (`Wolvic-picoxr-arm64-chromium-generic-release.apk`). Unlike the Pico Store Gecko build, this engine provides native OpenXR WebXR Hand Input API bindings.
5. **The SSL Nuance & Cloudflare Tunnel Resolution**: Wolvic Chromium lacks standard 2D Chrome error interstitials. Accessing self-signed HTTPS IP addresses (`https://192.168.0.7:8081`) silently failed with a blank white page. We solved this with a secure **Cloudflare Tunnel (`cloudflared`)**, exposing the local dev server over a globally trusted SSL certificate (`trycloudflare.com`), allowing seamless in-headset navigation via the Pico Drop companion page.
6. **Feature Negotiation & W3C Parity**: In Wolvic Chromium, requesting `requiredFeatures: ['hand-tracking']` or IWSDK's default feature pollution (`anchors`, `mesh-detection`, `layers`) caused silent session rejections. By matching the official W3C specification (`optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']` with automatic `XRWebGLLayer` fallback) and mounting an on-screen live diagnostics console, the game entered VR presentation with **100% of joints tracked across 230/231 frames, 0 errors, and <1 ms CPU overhead**.

---

## Stage-by-Stage Investigation & Findings

### Stage 1: Initial Launch & Black Screen / Missing Button
- **Video Reference:** `ScreenRecording_2026.10.04-01.15.24.mp4`
- **Initial Behavior:**
  - Launching the site on PicoBrowser resulted in a white/blank screen before XR, followed by an inability to enter VR/AR.
  - The default IWSDK implementation relies on `navigator.xr.offerSession()`, a Chrome feature that automatically shows an "Enter" prompt in the browser toolbar. PicoBrowser does not support `offerSession()`.
- **Diagnostic Setup:**
  - Created `pico-drop` companion server (`http://192.168.0.3:3000`) allowing the Pico headset to upload diagnostic reports directly to `pico-drop/drops/`.
- **Fixes Applied:**
  - Added background styling (`#14161c`) in `index.html` to eliminate canvas clear flashes.
  - Created `src/app/enter-ar-button.ts` to mount an explicit in-DOM launcher button when `navigator.xr.offerSession` is absent.

---

### Stage 2: Feature Negotiation & Session Rejection
- **Video Reference:** `Can_enter_vr.mp4`
- **Telemetry Artifact:** `pico_2026-10-04_02-40-46.json`
- **Observations:**
  - Attempting to require `handTracking: { required: true }` in `iwsdk.config.json` caused clicking "Enter AR" to fail completely.
  - Browser threw: `NotSupportedError: Failed to execute 'requestSession' on 'XRSystem': ...`.
  - The report showed:
    - `"session": null`
    - `"planes": "detectedPlanes unsupported"`
    - `"anchors": { "error": "NotSupportedError: Failed to execute 'createAnchor' on 'XRFrame': Anchors feature is not supported by the session." }`
- **Findings:**
  - PicoBrowser in `immersive-ar` mode does not support `anchors`, `plane-detection`, or `hand-tracking` as mandatory/required session features.
  - To allow the session to start in PicoBrowser, features had to remain in `optionalFeatures`.

---

### Stage 3: Controller Mesh Artifacts vs. Optical Hands
- **Video Reference:** `can_seee_hand.mp4`
- **Observations:**
  - The user successfully entered AR passthrough mode.
  - However, large black controller models appeared floating in the scene.
  - The user clarified the core goal: the physical controllers must NOT be represented as plastic models. Instead, the headset's cameras must track physical bare hands, displaying skeletal dots and projecting live hand shadows onto the table stage.
- **Fixes Applied:**
  - Updated `src/engine/xr/iwsdk-input-visuals.ts` to traverse and hide `world.input.xr.visualAdapters.controller` meshes as well as hand skinned meshes.
  - Tester removed batteries from physical controllers to prevent controller override.

---

### Stage 4: Silent Joint Reader Failures
- **Telemetry Artifact:** `pico_2026-10-04_03-17-33.json`
- **Observations:**
  - 2,582 XR display frames rendered smoothly at 47–60 FPS over 36.9 seconds.
  - Physical controllers were disconnected; the tester moved bare hands and observed native Pico OS selection circles.
  - However, no joint dots or shadows appeared:
    - `"hands": { "left": { "framesMissing": 2582 }, "right": { "framesMissing": 2582 } }`
    - `"handReadMethod": { "fillPoses": 0, "getJointPose": 0 }`
    - `"perf": { "msAvg": { "read": 0.004 } }`
- **Code Audit & Improvements:**
  - Audited `XRHandReader` in `src/engine/xr/xr-hands.ts`:
    - The reader previously skipped any source where `!source.hand || (source.handedness !== 'left' && source.handedness !== 'right')`.
    - If a runtime reported bare hands under `session.trackedSources` (documented in IWSDK) or returned `handedness: 'none'`, they were dropped.
    - Updated reader to inspect both `session.inputSources` and `session.trackedSources`, support `handedness: 'none'` fallback via wrist coordinates, and query joints through Map iteration, `.get()`, and `.forEach()`.
    - Updated `src/engine/xr/joint-dots.ts` with a 6 mm fallback radius so dots render even if joint radii report zero.

---

### Stage 5: The "Zero Input Sources" Discovery in PicoBrowser
- **Telemetry Artifact:** `pico_2026-10-04_03-44-23.json`
- **Observations:**
  - 4,437 XR frames rendered over 63 seconds.
  - Enhanced telemetry revealed the root cause:
    ```json
    "xrInput": {
      "readerUpdateCalls": 4437,
      "readerSourcesSeen": 0,
      "readerSources": [],
      "readerEvents": [],
      "iwsdkAdapters": {
        "handLeft": false, "handRight": false,
        "controllerLeft": false, "controllerRight": false
      }
    }
    ```
- **Findings:**
  - For all 4,437 frames, `session.inputSources` had an array length of **0**.
  - PicoBrowser's User-Agent string is:
    `PicoBrowser/3.3.54 Chrome/105.0.5195.68`
  - In Chromium 105, WebXR Hand Input was behind experimental Chromium flags (`chrome://flags#webxr-hand-input`).
  - Pico's official documentation states native, out-of-the-box WebXR Hand Input was stabilized in **Chromium 125+** (PICO OS 6).
  - On PICO OS 5.13, PicoBrowser does not route bare-hand optical tracking into WebXR sessions.

---

### Stage 6: Virtual Reality Mode & Wolvic Testing
- **Telemetry Artifacts:**
  - `pico_2026-10-04_03-52-42.json` (PicoBrowser in `immersive-vr` mode)
  - `pico_2026-10-04_04-08-53.json` (Wolvic 1.10 Browser in `immersive-vr` mode)
- **Observations:**
  - Added dual launcher buttons: `[Enter AR (Passthrough)]` and `[Enter VR (Virtual Mode)]`.
  - In PicoBrowser VR mode, `readerSourcesSeen` remained 0.
  - Tester installed **Wolvic 1.10** (Firefox/Gecko 153.0 engine) from the Pico Store.
  - In Wolvic, the virtual 3D paper stage and lantern rendered clearly. The tester noticed the paper and lantern light changing brightness/color when hands entered and exited view.
  - Wolvic telemetry showed:
    ```json
    "readerSources": [
      {
        "targetRayMode": "tracked-pointer",
        "handedness": "right",
        "profiles": ["pico-4", "generic-trigger-squeeze-thumbstick"],
        "hasHand": false
      },
      {
        "targetRayMode": "tracked-pointer",
        "handedness": "left",
        "profiles": ["pico-4", "generic-trigger-squeeze-thumbstick"],
        "hasHand": false
      }
    ],
    "readerEvents": [
      "+(right:tracked-pointer:ctl,left:tracked-pointer:ctl) -()",
      "+() -(right:tracked-pointer:ctl,left:tracked-pointer:ctl)",
      "+() -(right:tracked-pointer:ctl,left:tracked-pointer:ctl)",
      "+() -(right:tracked-pointer:ctl,left:tracked-pointer:ctl)"
    ]
    ```

---

### Stage 7: The Breakthrough — Controller Emulation Explained
- **The Decisive Insight:**
  - The tester clarified: **The physical controllers had their batteries removed 3 test runs ago.**
  - Therefore, the `tracked-pointer:ctl` sources with `profiles: ["pico-4"]` were **not** physical hardware.
  - **Pico's OpenXR runtime was emulating virtual Pico 4 controllers using the tester's bare hands!**
- **Underlying Architecture:**
  - When a WebXR session is launched with `hand-tracking` as an *optional* feature (or omitted), Pico OS / OpenXR defaults to backward-compatibility "Controller Emulation".
  - In this mode:
    - The index finger is mapped to a ray pointer with a selection circle.
    - A thumb-index pinch is mapped to trigger button index 0.
    - When hands are raised into view, the virtual controller "connects".
    - When hands leave view, the virtual controller "disconnects".
    - Pinching interacts with the 3D scene (lighting/paper tone adjustments).
    - **Crucially: `source.hand` is set to `null`!** OpenXR does not expose the skeletal joints.
- **The Solution:**
  - To disable controller emulation and force Pico's OpenXR backend to pass the true 25-joint `XRHand` skeleton (`source.hand`), the session **must request `hand-tracking` as a required feature**:
    ```javascript
    navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['hand-tracking'],
    });
    ```
  - Added dedicated launcher buttons:
    - **`[Enter VR (Hands Required)]`** (green button)
    - **`[Enter AR (Hands Required)]`** (orange button)
  - Hooked `console.error` in `Diagnostics` so any launch rejections or permission denials are preserved in the drop logs.

---

### Stage 8: The Wolvic Chromium Engine Shift, SSL Blank Screen Nuance, Cloudflare Secure Tunnel, and True 25-Joint Resolution
- **Video Reference:** `vr_browser.mp4`
- **Telemetry Artifact:** `pico_2026-10-05_18-14-51.json`
- **Background & Engine Switch:**
  - While Wolvic 1.10 (Gecko engine) recognized hand presence, its Gecko OpenXR backend lacked the WebXR Hand Input API bindings required to expose the 25 individual skeletal joint spaces (`XRHand`).
  - The tester downloaded and sideloaded **Wolvic Chromium 1.4 Generic Release** (`Wolvic-picoxr-arm64-chromium-generic-release.apk`).
  - Tested the official W3C WebXR sample (`immersive-hands.html`), confirming that Wolvic Chromium 1.4 natively delivers 25-joint optical bare-hand tracking via OpenXR.
- **The Self-Signed SSL Nuance (Blank White Screen):**
  - When accessing the local dev server at `https://192.168.0.7:8081/`, Wolvic Chromium loaded an empty, persistent white screen (identical to navigating to a non-existent IP or unreachable host).
  - In standard desktop Chrome, navigating to a self-signed HTTPS certificate displays an interstitial warning ("Your connection is not private") with an "Advanced -> Proceed" button.
  - In Wolvic Chromium's immersive VR environment, this 2D certificate warning interstitial is completely unimplemented; the browser aborts navigation silently, leaving a permanent white void.
  - Meanwhile, plain HTTP (`http://192.168.0.7:3000`) loaded cleanly because no TLS handshake occurred.
- **The Cloudflare Secure Tunnel Breakthrough:**
  - Standard WebXR (`navigator.xr`) strictly mandates a Secure Context (`window.isSecureContext === true`). It cannot run over unencrypted `http://`.
  - To provide a fully trusted, globally valid SSL certificate without requiring root CA installations on the headset, we stood up a secure Cloudflare Tunnel using `cloudflared.exe`.
  - The tunnel dynamically proxied local `https://localhost:8081` to a public URL: `https://dial-roy-humanities-mathematics.trycloudflare.com/`.
  - Updated the Pico Drop dashboard (`http://192.168.0.7:3000/`) with a direct green launcher card pointing to the Cloudflare URL with `target="_self"` (avoiding VR popup blocking).
  - Result: Wolvic Chromium loaded the game page instantly, with a green padlock and full Secure Context.
- **The Silent Launch Trap & Feature Pollution in IWSDK:**
  - Initial tests in Wolvic Chromium showed launcher buttons that appeared completely unresponsive when clicked.
  - Investigation of `@iwsdk/core` revealed two critical issues:
    1. **Silent Error Swallowing**: In `world.launchXR()`, session request errors were caught and routed solely to `console.error()`. Inside the headset without USB debugging, this made any failure look like a dead button.
    2. **Default Feature Pollution**: `iwsdk.config.json` had `"anchors": true, "planeDetection": true, "meshDetection": true`. Furthermore, IWSDK's default session builder automatically injected `['local-floor', 'bounded-floor', 'layers', 'anchors', 'plane-detection', 'mesh-detection']`.
    3. Pico's OpenXR backend immediately rejected session requests containing unsupported features (`anchors`, `mesh-detection`) or failed during Three.js `XRWebGLBinding.createProjectionLayer()` because WebXR projection layers are unsupported on Pico's OpenXR driver.
- **The Resolution (W3C Parity & On-Screen Diagnostics):**
  1. Built an interactive on-screen floating debug console in `src/app/enter-ar-button.ts` displaying live timestamps, browser UserAgent, WebXR capability checks, and real-time step-by-step progress. Hooked `window.onerror` and `window.onunhandledrejection`.
  2. Implemented **`▶ Enter VR (Direct Hands)`** directly requesting `optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']` (exact match to working W3C demo) with an automatic fallback from `createProjectionLayer` to standard `XRWebGLLayer`.
  3. Set `anchors`, `planeDetection`, and `meshDetection` to `false` in `iwsdk.config.json`.
- **Validation Results & Telemetry Verification:**
  - **Video `vr_browser.mp4` [00:05–00:34]**:
    - The virtual dark slate grey void (`#14161c`) and warm lantern light render cleanly.
    - Full 25-joint colored skeletal dots (cyan left, orange right) track knuckles, joints, and fingertips with optical precision.
    - Hand shadows cast dynamically onto the virtual paper stage as the player moves and gestures.
    - Shape recognition committed `spread: 2` at timestamp `00:26`.
  - **Telemetry Artifact `pico_2026-10-05_18-14-51.json`**:
    - `hands.left`: 230/231 frames tracked, 0 missing, min valid joints: **25**.
    - `hands.right`: 230/231 frames tracked, 0 missing, min valid joints: **25**.
    - `handReadMethod`: **460 calls to `fillPoses`**, 0 fallback calls.
    - `shadow`: `placed: true`, `onStage: [true, true]`.
    - `perf`: `intervalMsAvg: 13.99 ms` (71.5 FPS / native 72 Hz lock); `ourCpuMsAvg: 0.909 ms` (less than 7% CPU utilization).
    - `errors`: `[]` (0 errors).

---

## Technical Architecture & State Matrix

| Environment | Mode | `hand-tracking` Config | Resulting Behavior | Hand Data Available |
| :--- | :--- | :--- | :--- | :--- |
| **PicoBrowser 3.3** | `immersive-ar` | `required: true` | Session rejected (`NotSupportedError`) | None |
| **PicoBrowser 3.3** | `immersive-ar` | `optional: true` | Session starts, but 0 input sources delivered | None (`inputSources = []`) |
| **PicoBrowser 3.3** | `immersive-vr` | `optional: true` | Session starts, but 0 input sources delivered | None (`inputSources = []`) |
| **Wolvic 1.10 (Gecko)** | `immersive-vr` | `optional: true` | Session starts, **emulates controllers from hands** | None (`source.hand = null`, `profiles: ["pico-4"]`) |
| **Wolvic 1.4 (Chromium)** | Self-Signed IP (`https://192...`) | Any | Navigation dropped silently with blank white screen | None (SSL warning interstitial missing) |
| **Wolvic 1.4 (Chromium)** | Cloudflare Tunnel | `required: true` | Session rejected (`NotSupportedError` on OpenXR) | None |
| **Wolvic 1.4 (Chromium)** | Cloudflare Tunnel | Default IWSDK (`anchors`, `mesh`, `layers`) | Session rejected / Three.js layer crash into `console.error` | None |
| **Wolvic 1.4 (Chromium)** | **Cloudflare Tunnel** | **Clean W3C Optional (`local-floor`, `hand-tracking`) + `XRWebGLLayer`** | **Session starts, binds optical skeleton** | **Full 25-joint skeleton (`source.hand`), 72 FPS, <1 ms CPU** |

---

## Summary of Code Modifications Made in Repo

1. **`src/app/enter-ar-button.ts`**:
   - Built a live floating on-screen debug console displaying browser UA, WebXR capabilities, and colored logs with automatic `window.onerror` / `unhandledrejection` capture.
   - Implemented direct W3C session launcher (`▶ Enter VR (Direct Hands)`) with automatic `XRWebGLLayer` fallback when `createProjectionLayer` is unsupported.
   - Added `📋 Copy Logs` button for easy telemetry export to clipboard.

2. **`iwsdk.config.json`**:
   - Disabled `anchors`, `planeDetection`, and `meshDetection` so IWSDK defaults do not pollute WebXR session requests on Pico.

3. **`src/app/main.ts`**:
   - In opaque VR mode, explicitly sets `world.scene.background = new Color(0x14161c)` and `world.renderer.setClearColor(0x14161c, 1)` to eliminate white voids.
   - Pre-spawns seated rig at `[0, 1.2, 0]` on startup so the stage and lantern are immediately visible upon entering VR.

4. **`src/engine/xr/xr-hands.ts`**:
   - High-performance bulk `fillPoses` reader for zero-GC 25-joint extraction.
   - Inspects both `session.inputSources` and `session.trackedSources`.
   - Supports fallback handedness and comprehensive joint mapping.

5. **`src/engine/xr/joint-dots.ts`**:
   - Fallback joint radius (`Math.max(r * 0.4, 0.006)`) ensures dots render even if runtime joint radii are zero.

6. **`src/engine/xr/iwsdk-input-visuals.ts`**:
   - Suppresses IWSDK default controller models and skinned meshes so custom colored dots and projected shadows take center stage.

7. **Host Infrastructure & Tooling**:
   - **`pico-drop` companion server** (`http://192.168.0.7:3000`): In-browser dashboard for clipboard sync, log collection, and direct game launch without URL typing.
   - **Cloudflare Tunnel (`cloudflared`)**: Transparent local-to-cloud HTTPS proxy providing trusted SSL certificates to headless/standalone VR browsers.

---

## Status & Next Steps

True 25-joint optical hand tracking, shadow projection, and shape recognition are now **fully functional and verified** on physical Pico 4 hardware.

**Next Polish & Fine-Tuning Areas:**
1. **Stage & Rig Ergonomics**: Adjust stage distance, height, and angle relative to the seated player's viewpoint for optimal reach and shadow casting.
2. **Gesture & Shape Tuning**: Refine recognition tolerances and hold durations for game shapes (rabbit, fox, fist, cup, flat) using live recorded hand frames.
3. **Lantern Interaction**: Integrate pickup, extinguish, and relight mechanics with optical bare hands.

