# Spike: IWSDK for Where Shadows Wander

| | |
|---|---|
| Date | 1 Oct 2026 (week 1 of 7; deadline 19 Nov 2026 04:00 SGT) |
| Question | Can Meta's Immersive Web SDK (IWSDK) carry the GDD's technical design, and on what terms? |
| Version tested | `@iwsdk/*` **1.0.0-rc.2** (what `npm create @iwsdk@latest` installs today), three = `super-three@0.181.0`, IWER 2.5.0, Node 20.20, Chromium (Playwright) on an Apple-silicon Mac |
| Device | **None.** Every result below comes from the IWER emulator or desktop Chromium. Nothing here proves device performance or real tracking quality. |
| Code | `spikes/iwsdk/` on branch `spike/iwsdk` (throwaway) |

## Recommendation: **GO, conditionally.** Use IWSDK as a thin view and XR-session layer, not as the game architecture.

All ten checks passed or partly passed in the emulator. None of them blocks the GDD plan. Three things make the GO conditional:

1. **Keep gameplay outside the ECS.** The spike's game code (hand reader, plane frame, shadow, stage sim, fixed-step loop) uses only three.js and raw WebXR. It touches IWSDK in exactly three places: `World.create`, one driver system, and `scene.add`. Porting it to plain three.js took a 50-line `fallback/main.ts`, and the port runs with identical results (see "Fallback").
2. **Fix the bundle.** The default first load is 1.7 MB gzipped, and 64 % of that is an icon set we never use. One Vite alias brings it down to 0.7 MB (#9). The plain three.js fallback is 0.2 MB.
3. **Pin the exact version and get on a device in week 1.** IWSDK 1.0.0 is one week old. npm's `latest` tag still points at rc.2, and 18 versions shipped in 12 months (#10).

Why not just use plain three.js? The competition rules describe IWSDK for WebXR entries, and the GDD rates "Babylon WebXR link not accepted" as a **High** risk. Building on `@iwsdk/core` removes that risk at low cost. The plain three.js + `@iwsdk/xr-input` fallback would probably raise the same eligibility question as Babylon, so ask on the forum before relying on it. The other strong argument for IWSDK is the emulator plus its scriptable CLI. With no headset, it is how we test every day.

**GDD impact:** the Engine row ("Babylon.js") and the week-1 milestone need updating to three.js/IWSDK if this is accepted.

---

## What IWSDK provides (from docs + source)

- **`@iwsdk/core`**: a `World` (built on the `elics` ECS) that owns the three.js `WebGLRenderer`, `Scene`, `PerspectiveCamera`, the XR session lifecycle and the render loop. It ships systems for input, grabbing (one/two-hand, distance), locomotion, Havok physics, scene understanding (planes, meshes, anchors), environment raycast (hit-test), depth occlusion, layers, spatial audio, levels, and spatial UI (UIKit / UIKitML).
- **`@iwsdk/xr-input`**: a standalone XR input layer for three.js (peer `three >=0.160`). It provides an `XROrigin` rig with head/ray/grip/index-tip spaces, controller and hand visuals, pointers, gaze and stateful gamepads.
- **`@iwsdk/locomotor`**: a movement engine. Not relevant to a seated game.
- **`@iwsdk/vite-plugin-dev` + `@iwsdk/cli`**: a CLI-managed Vite dev server with HTTPS and a self-signed cert. It injects the **IWER** emulator (Quest 3 profile, synthetic "living_room" with labelled planes and meshes, DevUI). It also runs a managed Chromium plus an MCP/CLI command surface (`iwsdk xr enter|set-transform|set-input-mode`, `iwsdk browser screenshot|logs|run`, `iwsdk ecs …`) for scripted and agent testing.
- **`@iwsdk/create`**: the scaffold. Besides the app, it writes AI-agent adapter files (`AGENTS.md`, `.claude/`, `.cursor/`, `.codex/`, `.mcp.json`, `opencode.json`, `.github/instructions/`).
- **Project model**: `iwsdk.config.json` is the authority for XR features and world features. Scenes are JSON that reference manifest IDs from `src/assets.ts`, components are declared in `src/components.ts`, and systems are registered in `src/index.ts`. Three.js must be imported **from `@iwsdk/core`**, never from `three`.

## Results

| # | Check | Result |
|---|---|---|
| 1 | Dev server + desktop emulation | **PASS** (pointer-lock look and WASD not exercised) |
| 2 | immersive-ar with passthrough (emulated) | **PASS** |
| 3 | Hand joints per frame from our own code, world space | **PASS**, but WebXR has **25** joints, not 26 |
| 4 | Plane detection / anchors / anchor persistence | Planes **PASS**, anchors **PASS**, persistence **PARTIAL** (emulator fakes it) |
| 5 | Planar shadow with perspective→ortho blend | **PASS** |
| 6 | 500 instanced quads, frame time | **PASS** on desktop; Quest numbers unknown |
| 7 | Own fixed-timestep loop; IWSDK as view layer only | **PASS** |
| 8 | HTTPS on LAN; static production build on GitHub Pages | **PASS** (Pages simulated locally; not deployed, since no push was allowed) |
| 9 | First-load size and time to first render | Measured. **Concern**: 1.7 MB gzip by default, 0.7 MB with a fix |
| 10 | Conflicts with our plan | No blockers; 8 frictions listed |

### 1. Dev server and desktop emulation: PASS

- The scaffold command: `npx @iwsdk/create@latest iwsdk -y --target ar --language ts --no-grabbing --no-physics --scene-understanding --no-environment-raycast`. It took 34 s including `npm install` (260 packages).
  - With `--target ar`, the CLI rejects `--no-locomotion` ("Supported targets: vr, browser"). Locomotion is simply off in AR.
  - There are no CLI flags for individual XR features. The config came out with `handTracking`, `anchors`, `planeDetection` and `meshDetection` all set to `true`, as we wanted.
- `npm run dev` / `npx iwsdk dev up` serves `https://localhost:8081/` and `https://<LAN-IP>:8081/`, and opens a managed Chromium.
- Desktop emulation (IWER DevUI), driven with real mouse clicks in Playwright (`scripts/desktop-emulation.mjs`):
  - The toolbar opens the Input setup menu. Choosing **Hands** switched the session's input sources from `left:controller, right:controller` to `left:hand, right:hand`, and our code then read 25/25 joints per hand.
  - Hand panels offer pose presets, a pinch value and transform gizmos. See `img/desktop-devui.png` and `img/desktop-devui-hands.png`.
- Programmatic emulation through the CLI also works: `xr enter`, `xr set-input-mode hand`, `xr set-transform hand-right …`. This is how the rest of this spike was automated.
- **Not verified:** pointer-lock "play mode" (mouse-look, Shift+WASD headset move). Headless Chromium doesn't grant pointer lock, so the keys had no effect. *To check (2 min):* `npm run dev`, then in the headed window press ▶ in the IWER toolbar and use the mouse plus Shift+W.
- The managed browser runs IWER in "Remote Control" mode, which hides the DevUI toolbar. That is fine for automation; open the page in your own browser to use the toolbar.

### 2. immersive-ar with passthrough (emulated): PASS

`iwsdk xr status` and our own session report show:

```
sessionMode: immersive-ar   environmentBlendMode: alpha-blend   visibilityState: visible
enabledFeatures: local-floor, bounded-floor, hand-tracking, anchors, plane-detection, mesh-detection, viewer, local
```

IWER renders a synthetic room behind the transparent framebuffer (see `img/emulator-ar-hands-default.png`). This is emulated passthrough only; real passthrough needs a device. Config `true` flags become **optional** features (`buildSessionInit`), so a missing feature won't fail session start.

### 3. Hand joints from our own code: PASS, with a correction

- **WebXR exposes 25 joints per hand, not 26.** The WebXR Hand Input spec lists wrist + 4 thumb + 5×4 finger joints. OpenXR's 26th joint (`palm`) is not exposed in WebXR on any browser. If the classifier needs a palm pose, derive it, for example from the wrist and middle-finger metacarpal/proximal joints. Palm normal is the cross product of the index and pinky metacarpal directions.
- `src/spike/hands.ts` reads joints with **raw WebXR only**: `frame.fillPoses(jointSpaces, refSpace, Float32Array(16·25))` plus `frame.fillJointRadii`, with a `getJointPose` fallback. It doesn't use IWSDK's input, grab or gesture systems.
- Poses are converted to **three.js world space** by premultiplying `world.player.matrixWorld` (the XR origin).
- Evidence from an emulator run (both hands, every frame):

```
left : tracked 25/25  wrist [-0.299, 1.502, -0.283]
right: tracked 25/25  wrist [ 0.299, 1.502, -0.283]  indexTip [0.216, 1.564, -0.433]
readMethod: fillPoses 626 frames, getJointPose 0
|our right index-tip − IWSDK indexTipSpaces.right| = 0.000 m
```

- The same file runs unchanged in the plain three.js fallback and gives identical wrist poses.
- `@types/webxr` lacks `fillPoses` and `fillJointRadii`, so the code uses a local type cast.

### 4. Plane detection and anchors

**Planes: PASS.** IWER's living_room exposes 17 planes through `frame.detectedPlanes`, with `orientation`, `semanticLabel` and a polygon (5 vertices each). Extents are polygon bounds in plane space, and positions are in world space:

| label | orientation | centre (m) | extent X × Z (m) |
|---|---|---|---|
| wall | vertical | (-0.84, 1.94, -2.46) | 4.11 × 3.89 |
| window | vertical | (-0.21, 1.77, -2.45) | 2.77 × 1.95 |
| wall | vertical | (-2.94, 1.94, -0.23) | 4.51 × 3.89 |
| wall | vertical | (3.00, 1.94, 0.22) | 3.83 × 3.89 |
| wall | vertical | (-0.03, 1.94, 2.08) | 5.92 × 3.89 |
| wall | vertical | (2.15, 1.94, -1.74) | 1.89 × 3.89 |
| wall | vertical | (1.20, 1.94, -2.12) | 0.65 × 3.89 |
| window | vertical | (-2.26, 1.77, -2.47) | 1.23 × 1.95 |
| wall art | vertical | (2.10, 1.77, -1.74) | 1.06 × 1.61 |
| wall art | vertical | (-0.51, 2.18, 2.08) | 0.65 × 1.48 |
| table | horizontal | (1.26, 0.46, -0.40) | 1.12 × 0.61 |
| table | horizontal | (-1.54, 0.79, 0.20) | 1.30 × 0.75 |
| table | horizontal | (-1.53, 0.78, -1.19) | 1.31 × 0.72 |
| table | horizontal | (2.52, 0.61, 1.02) | 0.90 × 0.49 |
| couch | horizontal | (2.26, 0.47, -0.17) | 1.75 × 0.53 |
| floor | horizontal | (0.05, 0.00, -0.18) | 4.56 × 5.99 |
| ceiling | horizontal | (0.02, 3.88, -0.17) | 4.63 × 6.00 |

- **Wall-stage selection works.** The spike casts the viewer's horizontal gaze and takes the nearest facing vertical plane 0.5–3.5 m away whose polygon contains the hit point. It chose the front wall/window at **2.45 m** and built a 2D stage frame there (origin, right, up, normal).
- **Gotcha:** the sign of the plane normal (+Y in plane space) is not "into the room". IWER reports floor and table normals as (0,-1,0) and the front wall as (0.01,0,-1), pointing away from the viewer. `PlaneFrame.setFrom` flips the normal toward the viewer. Re-check this on device.
- IWSDK's own `XRPlane` ECS entities exist too, but we didn't need them.

**Anchors: create PASS.** `frame.createAnchor(XRRigidTransform, refSpace)` at the stage origin worked, and `getPose(anchor.anchorSpace)` tracks it at (0, 1.4, -2.45).

**Persistence: PARTIAL.** It round-trips in the emulator, but the emulator fakes it:

```
run 1 (key cleared): created, requestPersistentHandle() -> d334d6a4-…, pose [0, 1.4, -2.45]
page reload, new session
run 2: session.persistentAnchors includes d334d6a4-…; restorePersistentAnchor() -> same uuid, pose [0, 1.4, -2.45]
```

IWER implements `requestPersistentHandle` and `restorePersistentAnchor` with `localStorage` (`@immersive-web-emulation-runtime/persistent-anchors`). This shows the API shape and our code path. **It says nothing about Quest Browser**, which is still the GDD's open question. Keep the GDD fallback: store the gallery relative to the detected table/wall.

What IWSDK itself offers for anchors:
- The `XRAnchor` component reparents entities under **one** world anchor group that IWSDK creates at the origin. IWSDK persists that anchor automatically under `localStorage['iwsdk_scene_anchor_uuid']`.
- There is no API for several app-owned anchors, so we use raw WebXR as the spike does.
- IWSDK's automatic anchor uses up one persistent anchor; harmless, but worth knowing.

### 5. Planar shadow, perspective→ortho blend: PASS

See `src/spike/shadow.ts`.
- **Hand proxy:** instanced spheres (25 per hand, joint radii) plus instanced bone cylinders, 98 instances in total.
- **Shadow:** the same instanced geometry is drawn a second time with a custom `ShaderMaterial`. Its vertex shader applies `uShadow · (modelMatrix · instanceMatrix · p)`, does the homogeneous divide, lifts the result 2 mm along the plane normal and outputs solid black. That is two extra draw calls, as the GDD predicted.
- **Blend as one matrix:** the light is the homogeneous point `Lh = ((1−k)·L + k·n, 1−k)` and `M = (π·Lh)·I − Lh ⊗ π` with `π = (n, d)`.
  - At k=0 this is a perspective projection from the lantern L.
  - At k=1 it is an orthographic projection along the plane normal.
  - In between, it is a perspective projection from a light dollied back toward infinity, so the shader stays one `mat4`.
- **Measured shadow width of one hand** (true width 0.132 m) as the wall moves away from the lantern. Lantern is 0.45 m below and 0.15 m in front of the eyes:

| wall distance from lantern | k=0 (perspective) | k=0.6 | k=0.9 | k=1 (ortho) |
|---|---|---|---|---|
| 1.0 m | 1.53 m | 0.19 m | 0.14 m | 0.13 m |
| 1.5 m | 2.30 m | 0.23 m | 0.15 m | 0.13 m |
| 2.0 m | 3.06 m | 0.27 m | 0.16 m | 0.13 m |
| 3.0 m | 4.60 m | 0.35 m | 0.17 m | 0.13 m |

  This confirms the GDD's reasoning. A pure point light at lantern distance makes the shadow size swing 3× across 1–3 m, while k≈0.9 keeps it within ±10 %. A "shadow size" setting is just a scale on the ortho term.
- **Screenshot:** `img/emulator-ar-shadow-k09.png` shows a palm shadow on the paper stage at k=0.9.
- **Not done (game work, not a risk):** clipping the shadow to the stage rectangle and the distance-dependent edge blur. *Update (#9): both done; the shadow is now drawn from the collision capsules with a soft-edged shader (`src/engine/shadow`), and k = 0.9 is the default.*

### 6. 500 instanced quads: PASS on desktop; Quest unknown

See `src/spike/stage.ts`. The quads are simulated in 2D plane space by the fixed-step sim, interpolated, and written to one `InstancedMesh` every frame (1 draw call). Measured in an emulated XR session, headless Chromium at 60 Hz vsync, M-series Mac:

| quads | our CPU / frame (avg, max) | `renderer.render` CPU (avg, p95) | draw calls | frame interval avg / p95 |
|---|---|---|---|---|
| 0 | 0.10 / 0.3 ms | 0.31 / 0.9 ms | 22 | 16.68 / 19.2 ms |
| 500 | 0.18 / 0.4 ms | 0.30 / 0.7 ms | 24 | 16.66 / 19.1 ms |
| 5000 | 0.92 / 1.3 ms | 0.31 / 0.5 ms | 24 | 16.68 / 18.9 ms |

- 500 quads cost about 0.08 ms of CPU per frame. The frame interval is vsync-capped, so GPU time is not measured here.
- On Quest, expect 3–5× the CPU cost. That is still far below the 11–14 ms budget, but **this must be re-measured on device** (use `npx metavr` / OVR Metrics).
- Of the 24 draw calls, IWSDK's own **hand visuals** (2 skinned meshes per hand) account for 8. In MR the real hands are visible, so we will hide them; the workaround is in #10.

### 7. Own fixed-timestep loop; IWSDK only as view layer: PASS

`StageSim` is plain TypeScript (typed arrays, no three.js, no ECS) and steps at a fixed `1/hz` with an accumulator plus render interpolation. The spike tested two drivers (`src/index.ts`):

- **`?loop=system` (default, recommended):** IWSDK keeps `renderer.setAnimationLoop`. One `createSystem({})` at priority 10 calls `game.frame(dt, world.xrFrame, world.xrReferenceSpace)`. It runs after IWSDK's input (-4) and scene understanding (-1) systems and before render. Result: 59.96 sim steps/s at 60 fps.
- **`?loop=own&hz=50`:** we replace `renderer.setAnimationLoop` and call `world.update(dt, t)`, `world.runXRFrameCallbacks` and `renderer.render` ourselves. Result: **49.90 sim steps/s at 59.88 fps**, hands 25/25 and planes still detected.
  - This works, but it duplicates IWSDK's private loop body (including setting `world.visibilityState`), so it is fragile across versions.
  - The system driver gives the same decoupling, because the accumulator is ours, so prefer it.
- **View layer only:** all spike visuals are plain three.js objects added with `world.scene.add(...)`. There are zero app entities or components; `src/components.ts` and `src/assets.ts` are empty, and the scene JSON has no nodes.
  - IWSDK's conventions doc says to use `createTransformEntity` instead of `scene.add`. Nothing broke, but expect IWSDK tooling (editor, `ecs` CLI) not to see our objects.
- **Systems IWSDK still registers with everything optional turned off:** `InputSystem@-4, CanvasPointerSystem@-3.5, SceneUnderstandingSystem@-1, TransformSystem, VisibilitySystem, EnvironmentSystem, LightSystem, LevelSystem, AudioSystem`. They are cheap; our whole frame was well under 1 ms.

### 8. HTTPS on LAN and GitHub Pages: PASS

**LAN HTTPS:**
- The dev server serves HTTPS on `0.0.0.0:8081`. `curl -k https://192.168.1.95:8081/` returned `200`.
- The cert is IWSDK's cached self-signed one: `CN=IWSDK Development`, SAN covering `localhost`/`127.0.0.1` only. The headset will show a warning to click through, which is the documented flow and also the case on Pico.
- To avoid the warning, Vite's own `server.https` (for example an mkcert cert covering the LAN IP) takes precedence over IWSDK's cert. The plugin's `https: { domains: [...] }` option only adds DNS names, so a bare LAN IP may still warn. ADB port-forwarding to `localhost` is the documented alternative.

**Static production build:**
- `vite build` with `base: './'` emits relative URLs only (`./assets/index-….js`).
- `scripts/serve-pages.mjs` mimics GitHub Pages: a project subpath `/WhereShadowsWander/`, gzip, no rewrites. Served that way, the default, slim and fallback builds all loaded and rendered with **0 failed requests and 0 page errors**.
- The production bundle contains **no IWER or emulator code** (grep for `immersive-web-emulation-runtime`: 0 files).
- **Gotcha:** the build emits `assets/_virtual_iwsdk-disabled-bundled-fonts-*.js`. Classic (Jekyll) GitHub Pages ignores files that start with `_`. It isn't requested at startup with spatial UI off, but deploy with the **Actions** Pages workflow, or keep `public/.nojekyll` (added in the spike).
- **Not done:** an actual Pages deploy, because no remote or push was allowed.

### 9. First-load cost and time to first render: measured, concern

**Bundle size** (production, `NODE_ENV=production vite build`):

| build | main chunk raw / gzip | transferred on cold load |
|---|---|---|
| Untouched scaffold (spatial UI on, sample scene) | 6,575 KB / 1,682 KB | ≈1.7 MB **+ sample GLTFs from jsDelivr CDN** |
| Spike, spatial UI off | 6,587 KB / 1,686 KB | **1,733 KB** |
| Spike + lucide stub (`vite.config.slim.ts`) | 2,354 KB / 647 KB | **718 KB** |
| Fallback: plain three.js + `@iwsdk/xr-input` | 989 KB / 202 KB | ≈205 KB (chunk size; IWER chunk is dev-only) |

Where the 6.6 MB comes from (source-map-explorer):

| package | share | size |
|---|---|---|
| `@pmndrs/uikit-lucide` | 64 % | 4.2 MB |
| three | 16 % | 1.06 MB |
| `@iwsdk/xr-input` | 5 % | 346 KB |
| yoga-layout | — | 128 KB |
| uikit | — | 125 KB |
| zod | — | 97 KB |
| everything else | — | small |

- Lucide arrives through `@drawcall/uikitml/dist/kits.js` (`import * as Lucide` plus a component set built at module top level). It therefore can't be tree-shaken, **even with `spatialUI: false`**.
- Locomotion, grab, physics glue, depth and layers code are also bundled while disabled, because `world-initializer` imports them statically. Only Havok is dynamically imported.
- The slim build replaces lucide with a 2-icon re-export (`src/stubs/empty-lucide.ts`). That is a hack: if we ever enable UIKitML with lucide icons, revert it.

**Time to first rendered frame** (cold load, cache disabled, served Pages-style; `performance.mark` at our first `frame()` call; headless Chromium; Quest approximated by 4× CPU throttle, which is rough):

| profile | default build | slim build |
|---|---|---|
| Mac, no throttle | 472 ms | 297 ms |
| 4× CPU | 1,031 ms | 546 ms |
| 4× CPU, 50 Mbps / 40 ms | 1,377 ms | 750 ms |
| 4× CPU, 15 Mbps / 60 ms | 2,093 ms | 1,077 ms |

`World.create` itself takes about 150–350 ms after the script starts. Both builds fit the GDD's "< 5 s to the lantern" target on paper. The slim build leaves headroom for audio and art, which should stream after the lantern appears, as the GDD says. **Measure on a fresh Quest 3S.**

### 10. Conflicts with our plan: no blockers, 8 frictions

1. **Version churn.**
   - `@iwsdk/core` has had 18 versions since 17 Sep 2025, going from 0.4 to 0.5 to 1.0.0-rc.0, rc.1, rc.2 and 1.0.0 within 4 months. 1.0.0 was published 24 Sep 2026, one week before this spike.
   - **npm `latest` = 1.0.0-rc.2, `next` = 1.0.0**, so `npm create @iwsdk@latest` scaffolds rc.2.
   - The spike typechecks and builds unchanged against 1.0.0 (same bundle size), but I didn't re-run it on 1.0.0.
   - → **Pin exact versions** (no `^`) and upgrade only deliberately.
2. **three.js is pinned to a fork.** 1.0 pins `three` to `npm:super-three@0.181.0` through `overrides`, and `three` must be imported from `@iwsdk/core`. Any three add-on we pull in must be compatible with r181. Earlier versions accepted any `three`.
3. **IWSDK owns the render loop** (`renderer.setAnimationLoop` inside `World.create`). This is not a problem for us; see #7.
4. **Forced systems.** Nine systems always run (listed in #7), plus a world anchor whenever `anchors` is on. They are cheap and none of them interferes.
5. **IWSDK hand visuals are on by default.** `visualAdapters.hand[*].visual.toggle(false)` and `toggleVisual(false)` did **not** hide them in rc.2. Setting `visible = false` on the `SkinnedMesh`es works and stays off, cutting 24 draw calls to 16. We need a proper switch, or else `inputDevices` config through `XRInputManager`.
6. **An opinionated project model we won't use.** Scene JSON, asset and component manifests evaluated in two JS realms, an editor, a CLI-managed dev server, and AI adapter files in the repo. All of it can be bypassed (the spike does), but the scaffold's docs and lint-like conventions assume it.
   - Delete the `.claude/`, `.cursor/`, `.codex/`, `opencode.json` and `.github/instructions` adapters from the real repo unless we want them.
   - The scaffolded `.claude/settings.json` lives inside the project folder, not the repo root.
7. **Bundle bloat** (#9). It needs the lucide alias, or an upstream fix (worth filing).
8. **Node engine range** `>=20.19 <21 || >=22.12 <23 || >=24`.

What did **not** conflict:
- No XR feature is forced to *required*.
- Hands, planes, anchors and frame access are all reachable raw (`world.xrFrame`, `world.xrReferenceSpace`, `world.onXRFrame`, `world.renderer/scene/camera`).
- A custom `ShaderMaterial` + `InstancedMesh` works as normal three.js.
- Nothing pushed us toward controllers.

## Fallback: plain three.js + `@iwsdk/xr-input` (built and run)

`spikes/iwsdk/fallback/` plus `vite.fallback.config.ts`:
- **No `@iwsdk/core`, no ECS, no IWSDK Vite plugin.** It uses a `WebGLRenderer` with `xr.enabled`, an `XRInputManager({scene, camera})` whose `XROrigin` stands in for `world.player`, our own `setAnimationLoop`, and a direct `navigator.xr.requestSession('immersive-ar', …)`.
- **Spike modules reused unchanged** by aliasing `@iwsdk/core` to `three`.
- **Emulator:** `iwer` is installed manually in dev or with `?emulate`. It needs `installRuntime({ forceInstall: true })` because desktop Chrome already has a native `navigator.xr`.

Result in the emulator (`scripts/fallback-check.mjs`):
- `immersive-ar`, `alpha-blend`, hand-tracking/anchors/plane-detection enabled.
- Both hands tracked, 25/25 joints, through `fillPoses`, with wrist poses identical to the IWSDK run.
- 98 shadow instances; hand shadow width at k=1 is 0.131 m.
- 59.8 sim steps/s.
- 0 errors and 0 failed requests.
- Main chunk 202 KB gzip.

What the fallback loses:
- IWER's DevUI and synthetic room. Planes and meshes would need `@iwer/devui` and `@iwer/sem` wired in by hand (not tried).
- The `iwsdk` CLI automation.
- Possibly the "built with IWSDK" eligibility argument.

Switching cost is about 50 lines, as long as gameplay code keeps to three.js and raw WebXR.

## Must verify on a Quest 3S (no emulator can answer these)

1. Real passthrough plus `alpha-blend`, and the cold-start time to first frame on Quest Browser over Wi-Fi.
2. Frame time with the shadow and 500 quads at 72/90 Hz. Check whether `multiviewStereo: true` is in effect.
3. Hand joint jitter and occlusion, and how often the tracking confidence drops. This drives the classifier hysteresis.
4. Quest plane quality: does the room setup provide `wall` and `table` planes near the player? What are the normal-sign conventions?
5. `requestPersistentHandle` and `restorePersistentAnchor` across browser restarts in Quest Browser.
6. Self-signed LAN cert click-through on Quest Browser (and Pico, if used).

## How to reproduce

```sh
cd spikes/iwsdk
npm install
npm run typecheck
npx iwsdk dev up --headless --open --allow-browser-automation  # or: npm run dev (headed)
npx iwsdk xr enter && npx iwsdk xr set-input-mode --input-json '{"mode":"hand"}'
npx iwsdk browser run scripts/report.mjs        # window.__spike.report: hands, planes, anchor, loop, shadow, perf
npx iwsdk browser run scripts/census.mjs        # what is drawn, ours vs IWSDK; systems
RELOAD_QS='?loop=own&hz=50' npx iwsdk browser run scripts/reload.mjs   # other drivers / ?quads=N / CLEAR_ANCHOR=1
node scripts/desktop-emulation.mjs              # IWER DevUI via real mouse input (needs dev server)
NODE_ENV=production npx vite build [-c vite.config.slim.ts]
node scripts/serve-pages.mjs dist 4173 &        # GitHub Pages-like subpath server
node scripts/load-timing.mjs http://localhost:4173/WhereShadowsWander/ 4 15 60
npx vite build -c vite.fallback.config.ts && node scripts/serve-pages.mjs dist-fallback 4175 &
node scripts/fallback-check.mjs
```

URL params: `?loop=system|own`, `?hz=60`, `?quads=500`, `?proxy=0` (hide hand proxy). Keys `[` and `]` change the blend k in steps of 0.1.

Spike source map:

| file | what it does |
|---|---|
| `src/index.ts` | `World.create` + the two loop drivers |
| `src/spike/hands.ts` | raw WebXR joints → world space |
| `src/spike/plane-frame.ts` | 2D stage frame on a detected plane |
| `src/spike/shadow.ts` | shadow matrix + black instanced shadow |
| `src/spike/stage.ts` | 2D sim + 500 instanced quads |
| `src/spike/game.ts` | fixed-step loop, plane pick, anchors, metrics |
