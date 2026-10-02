# ADR 0001: IWSDK as the XR and view layer, not the game architecture

| | |
|---|---|
| Status | Accepted |
| Date | 1 Oct 2026 |
| Evidence | [IWSDK spike](../spikes/iwsdk-spike.md) (conditional GO), branch `spike/iwsdk` |

## Context

The GDD originally planned Babylon.js. The competition rules describe IWSDK for WebXR entries, so a Babylon link risked not being accepted. The spike tested IWSDK against every technical need in the GDD. All checks passed in the IWER emulator. Nothing was tested on a Quest.

IWSDK is young: 1.0.0 shipped on 24 Sep 2026, npm's `latest` tag still points at 1.0.0-rc.2, and 18 versions shipped in 12 months. It pins three.js to a fork, `super-three@0.181.0`. It also brings an opinionated project model (ECS, scene JSON, manifests, editor) that the game doesn't need.

## Decision

### What IWSDK does

- The XR session (`immersive-ar` with passthrough), the renderer, scene, camera and display loop.
- The IWER emulator and the `iwsdk` CLI for daily testing without a headset.
- Scene understanding: plane and mesh detection, and anchors (we call the raw WebXR anchor API ourselves, because IWSDK only manages one world anchor).
- Possibly spatial audio, decided when audio work starts.

### What IWSDK does not do

- **Gameplay and simulation never import IWSDK or three.js.** `src/engine/hands`, `src/engine/sim`, `src/engine/stage` and `src/game` are plain TypeScript. ESLint (`npm run lint`, rules in `eslint.config.js`) fails the build if they import `@iwsdk/*`, `three`, `iwer`, MediaPipe or an engine-facing folder, or use browser globals.
- **No game state in the ECS.** `src/components.ts` and the scene JSON stay empty. The view layer uses plain three.js objects (`InstancedMesh`, custom `ShaderMaterial`) added with `world.scene.add`. Use an IWSDK ECS feature only when it clearly saves work. The trade-off is that IWSDK's editor and `ecs` CLI don't see our objects.
- **Hand data comes from raw WebXR** (`frame.fillPoses`), not IWSDK's input, grab or gesture systems.

### Hands: 25 joints, derived palm

WebXR Hand Input exposes **25 joints** per hand. OpenXR's 26th joint (`palm`) is not exposed in any browser. The hand data format (`src/engine/hands/hand.ts`) and the classifier use the 25 joints, and `derivePalm()` computes the palm from joint positions:

- position: midpoint of the middle-finger metacarpal and proximal joints
- forward: wrist to the middle-finger knuckle
- across: index knuckle to pinky knuckle
- normal: their cross product, signed per hand so it points out of the palm

### One driver system, our own fixed step

IWSDK keeps `renderer.setAnimationLoop`. We register exactly one system (`FrameDriverSystem` in `src/app/main.ts`) at **priority 10**. That is after IWSDK's input (-4) and scene understanding (-1) systems, and before render. It reads the frame and advances `FixedStepLoop` (`src/engine/sim/fixed-step.ts`), which steps the sim at a fixed rate with an accumulator and returns an interpolation factor for rendering.

The spike also tried taking over `setAnimationLoop` and calling `world.update` ourselves. That works, but it copies IWSDK's private loop body, so it would break across versions. Rejected.

### Versions: exact pins, one three.js

- All `@iwsdk/*` packages are pinned to **exactly `1.0.0`** (no `^` or `~`), and `package-lock.json` is committed. Upgrade only on purpose, then re-run the emulator checks.
  - The spike ran on 1.0.0-rc.2 and only typechecked and built against 1.0.0. This skeleton was re-run on 1.0.0 in the emulator: hands 25/25 joints through `fillPoses`, 17 planes, anchor create, persist and restore, and 60 sim steps/s.
  - We chose the stable 1.0.0 over rc.2 because npm's `next` tag is 1.0.0 and further fixes will land on 1.0.x.
- `three` is `npm:super-three@0.181.0`, both as a dependency and in `overrides`. Import three.js through `@iwsdk/core`, as IWSDK requires. Any three.js add-on must work with r181.
- **Never add a second copy of three.** `npm run check:three` fails unless exactly one `super-three@0.181.0` is installed. `vite.config.ts` also dedupes `three` and `@pmndrs/uikit`.

### Build: drop the unused icon set

`@drawcall/uikitml` imports all of `@pmndrs/uikit-lucide` (4.2 MB raw) at module top level. It can't be tree-shaken, even with `spatialUI: false`. `vite.config.ts` aliases `@pmndrs/uikit-lucide` to `src/app/stubs/lucide-subset.ts`, which re-exports only the two icons `@pmndrs/uikit-horizon` uses.

| | main chunk gzip | cold-load transfer |
|---|---|---|
| Without alias (spike) | 1,686 KB | 1,733 KB |
| With alias (this repo, 1.0.0) | 646 KB | 717 KB |

If we ever turn on spatial UI with lucide icons, remove the alias. The upstream fix is worth filing.

### Hide IWSDK's input visuals

In passthrough the player sees their real hands and never points at anything, so IWSDK's input visuals must not draw. Both fixes are in `src/engine/xr/iwsdk-input-visuals.ts`:

- **Hand models:** `visualAdapters.hand[*].toggleVisual(false)` and `visual.toggle(false)` did not hide them in the spike. We set `visible = false` on the hand `SkinnedMesh`es every frame, because the visuals are rebuilt when a hand reconnects. Re-check IWSDK's own toggle when upgrading.
- **Far-ray pointers:** IWSDK draws one ray per hand. `multiPointers[hand].toggleSubPointer('ray', false)`, called once after `World.create`, hides them and turns off ray interaction, which the game doesn't use.

In the emulator on 1.0.0, with both hands tracked, every IWSDK hand and ray mesh is hidden. The only thing drawn is our joint-dot `InstancedMesh`: 2 draw calls, one per eye. The spike's scene had 24.

### Other rules

- The project model files (`iwsdk.config.json`, `src/assets.ts`, `src/components.ts`, `public/scenes/main.iwsdk.scene.json`) exist because the IWSDK Vite plugin needs them. Keep them minimal.
- IWSDK's AI-agent adapter files (`AGENTS.md`, `.claude/`, `.cursor/`, `.codex/`, `opencode.json`, `.github/instructions/`) are not part of this repo. The CLI's generated MCP configs are gitignored.
- No top-level `await` in `src/app/main.ts`. IWSDK lazily imports a chunk that imports back from the entry chunk, so a top-level `await World.create(...)` deadlocks in production builds; dev mode doesn't show it.
- Deploy with the GitHub Actions Pages flow. The build emits `assets/_virtual_iwsdk-*.js`, and classic Jekyll Pages ignores files starting with `_`. `public/.nojekyll` covers the classic flow too.

## Consequences

- Switching to plain three.js costs about one entry file, as long as the boundary check holds. See [ADR 0002](0002-plain-threejs-fallback.md).
- We give up IWSDK's editor, scene JSON and ECS tooling for game objects.
- Every IWSDK upgrade needs: re-check the pins, `npm run check`, the emulator run, the lucide alias, and the hand-mesh workaround.
- Device-only questions stay open until a Quest run. See the Risks table in the [GDD](../GDD.md#risks).
