# ADR 0003: Pico as the stand-in test device until we have a Quest

| | |
|---|---|
| Status | Accepted |
| Date | 2 Oct 2026 |

## Context

The game targets Meta Quest 3 / 3S in Quest Browser, and judging happens there. We don't have a Quest. We do have a Pico headset (model not yet confirmed; the diagnostics report's user agent will show it).

According to [PlayCanvas's platform table](https://developer.playcanvas.com/user-manual/xr/platforms/), Pico's WebXR supports AR (passthrough), hand tracking, plane detection, anchors, persistent anchors and hit testing. Mesh detection isn't listed. This is a third-party source, so the first Pico run confirms it.

## Decision

**Develop and test on the Pico now; confirm on a Quest before each milestone that matters, and always before submission.** The rule is: if it works on Pico, it will *probably* work on Quest, but only a Quest run proves it.

To keep that rule true, the code follows the WebXR standard, not one headset:
- **Raw WebXR, feature-detected.** Every XR feature is optional at session start (IWSDK's default). Code checks for an API before using it and has a fallback. Example: `XRHandReader` uses `fillPoses` when present and `getJointPose` otherwise.
- **No device-specific code paths without a fallback.** If a Quest-only or Pico-only workaround is ever needed, it is keyed on a detected capability (or, as a last resort, the user agent), noted in this ADR, and the other device keeps working.
- **Don't trust names or signs from one device.** Plane `semanticLabel`s and plane-normal directions may differ between Pico and Quest. Pick stages by orientation, size and distance; use labels only as a hint. The normal is already flipped toward the viewer in code.
- **Build target `es2022` / Chrome 100**, not `esnext`, in case Pico's browser runs an older Chromium than Quest Browser.

### Test ladder

| Layer | Tool | Answers | When |
|---|---|---|---|
| Logic | IWER emulator, unit tests | Does our code work? | Every change |
| Hand shapes | Webcam hand bench (`webcam.html`, see [ADR 0004](0004-webcam-bench-and-hand-recordings.md)) | Does the classifier recognise real hand shapes? | Daily from week 3 |
| Real device | **Pico** | Passthrough, real hand jitter and dropouts, real room planes, anchors, frame rate, comfort | Several times a week |
| Target device | Remote Quest tester (or a borrowed Quest) | Quest Browser quirks, Quest tracking, Quest 3S performance | End of each milestone, and before submission |

### Getting the build onto the Pico

- **Over Wi-Fi from the dev server:** `npm run dev` on the laptop, then open `https://<laptop LAN IP>:8081` in the Pico browser and accept the self-signed certificate warning once.
- **From GitHub Pages:** the same HTTPS link the Quest tester uses.

## What Pico can't tell us

- **Quest performance.** A Pico 4 has an older chip than the Quest 3S (a Pico 4 Ultra is the same generation). Smooth on a Pico 4 is a good sign for a Quest 3S, not a guarantee.
- **Quest hand tracking.** It's a different tracker with different noise and failure cases. Tune the classifier with margin to spare, not to the Pico's exact behaviour.
- **Quest Browser behaviour,** such as persistent anchors across restarts, cold-start time, and permission prompts.

## Consequences

- The remote Quest tester's role shrinks from "our only device" to periodic confirmation.
- Each Quest check compares its diagnostics report against the latest Pico report. Differences there are where Quest-specific bugs will come from.
- When we get a Quest, it becomes the main device and this ADR is superseded.

## Update (3 Oct 2026): first Pico report

The first Pico report came from a PICO 4 (OS 5.13.8) running PicoBrowser 3.3.54 on Chrome 105. Its user agent contains "like Quest" and "OculusBrowser/7.0", so never detect a headset from the user agent. It supports `immersive-ar` and `immersive-vr`, and starts the game in about 2.7 s over the local network from a dev build. It has no `navigator.xr.offerSession`, which is the only way IWSDK offers a session (it draws no button itself), so the page added its own **Enter AR** button (`src/app/enter-ar-button.ts`) for browsers like this. Hand tracking, planes and anchors on the Pico are still unknown until a report is taken inside a session.


## Update 2 (5 Oct 2026): hand data on the Pico

Damon's testing (full write-up merged in PR #40 as `docs/TESTING_FINDINGS.md`, removed 12 Nov 2026 and kept in git history) found how to get real hand joints on this Pico 4 (OS 5.13.8):

- **Browser.** PicoBrowser 3.3 (Chrome 105) and the Pico Store's Wolvic 1.10 (Gecko) do not give a page `XRHand` joints: the first has no input sources at all, the second runs the Pico's hands-as-controllers mode (`profiles: ["pico-4", ...]`, `hand` null). The **Wolvic Chromium 1.4 generic release APK**, sideloaded, does, and the official [WebXR hands sample](https://immersive-web.github.io/webxr-samples/immersive-hands.html) shows the joints in it.
- **Session request.** Our page originally asked for seven optional features. The Pico rejected or broke on `anchors`, `plane-detection`, `mesh-detection` and `layers`, and three.js's `XRWebGLBinding.createProjectionLayer` fails on the Pico's runtime. What works: a **VR** session asking only for `local-floor`, `bounded-floor` and `hand-tracking` (all optional), with a fallback to a plain `XRWebGLLayer`. The earlier idea that `hand-tracking` must be *required* was wrong (required makes `requestSession` fail on the Pico).
- **Result** (report `pico_2026-10-05_18-14-51.json`): both hands tracked in 230 of 231 frames with all 25 joints, 460 `fillPoses` calls, 0 errors, 72 FPS, about 0.9 ms of our CPU a frame, shadows on the wall, and a `spread` shape recognised.
- **Self-signed HTTPS.** Wolvic Chromium shows a blank page for a self-signed `https://192.168...` address (it has no certificate warning screen). Use a trusted address: the GitHub Pages link, or a tunnel to the dev server (a public address: it also exposes the dev server's recording-upload route, so do not leave it running).
- **Not established.** That a Quest behaves the same (Meta documents WebXR hand input as supported in Quest Browser; still to confirm on a Quest), and whether the projection-layer fallback was actually needed in the successful run.
- **Open observation.** With a straight hand there is a gap between the index and middle fingers in the skeleton and shadow; to be tuned from a Pico recording (shadow capsule thickness).

Follow-ups for the code merged in PR #40: the launcher's debug console is shown on every browser; it deletes `XRWebGLBinding.prototype.createProjectionLayer` and writes IWSDK internals as a workaround; the hand reader allocates an array each frame and its event log is unbounded; `src/debug/diagnostics.ts` replaces `console.error` page-wide.
