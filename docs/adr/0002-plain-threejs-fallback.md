# ADR 0002: Fallback to plain three.js + @iwsdk/xr-input

| | |
|---|---|
| Status | Accepted (as a fallback; not in use) |
| Date | 1 Oct 2026 |
| Evidence | [IWSDK spike, "Fallback"](../spikes/iwsdk-spike.md#fallback-plain-threejs--iwsdkxr-input-built-and-run), branch `spike/iwsdk`, `spikes/iwsdk/fallback/` |

## Context

[ADR 0001](0001-iwsdk-as-xr-and-view-layer.md) builds on `@iwsdk/core`, which is one week past 1.0.0. If an IWSDK release breaks us, or `@iwsdk/core` turns out too heavy or buggy on Quest, we need a way out that doesn't touch gameplay.

## Decision

Keep a known, tested fallback: **plain three.js (`super-three@0.181.0`) + `@iwsdk/xr-input`**, with no `@iwsdk/core`, no ECS and no IWSDK Vite plugin. We don't build it now. We keep it cheap by holding the ADR 0001 boundary: gameplay, sim and the shared hand code never import IWSDK or three.js, and hand data comes from raw WebXR (`frame.fillPoses`).

### What the fallback replaces

| `@iwsdk/core` provides | Fallback uses |
|---|---|
| `World.create` (renderer, scene, camera, loop) | `WebGLRenderer` with `xr.enabled`, our own `setAnimationLoop` |
| `world.player` (XR origin) | `XRInputManager({ scene, camera }).xrOrigin` |
| XR session offer and enter button | `navigator.xr.requestSession('immersive-ar', { optionalFeatures })` |
| `FrameDriverSystem` at priority 10 | The same calls inside our `setAnimationLoop`, after `input.update` |
| IWER emulator through the Vite plugin | `iwer` installed by hand in dev, with `installRuntime({ forceInstall: true })` because desktop Chrome already has a native `navigator.xr` |

### The entry file (spike, 54 lines, ran in the emulator)

From `spikes/iwsdk/fallback/main.ts` on branch `spike/iwsdk`. It reused every spike module unchanged by aliasing `@iwsdk/core` to `three`. For this repo, swap `SpikeGame` for our `XRHandReader`, `FixedStepLoop`, `JointDots` and `Diagnostics`, the same objects `src/main.ts` wires into its driver system.

```ts
// Fallback architecture: plain three.js + @iwsdk/xr-input, no @iwsdk/core / ECS.
// Reuses the spike modules unchanged; vite.fallback.config.ts aliases '@iwsdk/core' -> 'three'.
import { PerspectiveCamera, Scene, WebGLRenderer, Clock } from 'three';
import { XRInputManager } from '@iwsdk/xr-input';
import { SpikeGame } from '../src/spike/game.js';

performance.mark('spike-script-start');
const params = new URLSearchParams(location.search);

if (import.meta.env.DEV || params.has('emulate')) {
  // Dev only: IWER emulated Quest 3 with hands (IWSDK's vite plugin does this for us).
  const { XRDevice, metaQuest3 } = await import('iwer');
  const device = new XRDevice(metaQuest3);
  device.primaryInputMode = 'hand';
  device.installRuntime({ forceInstall: true });
}

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new Scene();
const camera = new PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 50);
camera.position.set(0, 1.6, 0);

const input = new XRInputManager({ scene, camera });
scene.add(input.xrOrigin);
input.xrOrigin.add(camera);

// The spike only needs these World fields.
const world = { scene, camera, renderer, player: input.xrOrigin, playerSpaceEntities: undefined };
const game = new SpikeGame(world as never, {
  hz: Number(params.get('hz') ?? 60),
  quads: Number(params.get('quads') ?? 500),
  showProxy: params.get('proxy') !== '0',
});
(window as unknown as Record<string, unknown>).__spike = { world, game, report: game.report };

const clock = new Clock();
renderer.setAnimationLoop((_t, frame) => {
  const dt = clock.getDelta();
  input.update(renderer.xr, dt, clock.elapsedTime);
  game.frame(dt, frame ?? null, renderer.xr.getReferenceSpace());
  renderer.render(scene, camera);
});

(window as unknown as Record<string, unknown>).__enterXR = async () => {
  const session = await navigator.xr!.requestSession('immersive-ar', {
    optionalFeatures: ['local-floor', 'hand-tracking', 'anchors', 'plane-detection', 'mesh-detection'],
  });
  renderer.xr.setReferenceSpaceType('local-floor');
  await renderer.xr.setSession(session);
};
```

Its Vite config (`vite.fallback.config.ts`):

```ts
// Fallback build: plain three.js + @iwsdk/xr-input. No IWSDK vite plugin, no ECS.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'fallback',
  base: './',
  resolve: { alias: { '@iwsdk/core': 'three' }, dedupe: ['three'] },
  server: { port: 8082 },
  build: { outDir: '../dist-fallback', emptyOutDir: true, target: 'esnext' },
  esbuild: { target: 'esnext' },
});
```

Result in the emulator:
- `immersive-ar` with `alpha-blend`; hand tracking, anchors and plane detection enabled.
- Both hands tracked, 25/25 joints, through `fillPoses`, with wrist poses identical to the IWSDK run.
- The shadow worked: hand shadow width at k=1 was 0.131 m.
- 59.8 sim steps/s.
- 0 errors and 0 failed requests.
- Main chunk **202 KB gzipped**, against 646 KB for the IWSDK build with the lucide alias.

### What we would lose

- IWER's DevUI and synthetic room. Planes and meshes would need `@iwer/devui` and `@iwer/sem` wired in by hand (not tried).
- The `iwsdk` CLI automation (`xr enter`, `browser run`, screenshots), which is how we test without a headset.
- Possibly **competition eligibility**. The rules describe IWSDK for WebXR entries. A build using only `@iwsdk/xr-input` might raise the same question the GDD raised about Babylon.js. Ask on the Meta Developer Forum before switching (see GDD, Open questions).

## When to switch

Only if at least one of these holds and can't be worked around within a day:
- An `@iwsdk/core` bug blocks a GDD feature on device.
- `@iwsdk/core` overhead breaks the 72 fps target on Quest 3S, and the fallback measurably fixes it.
- An IWSDK release we need can't be adopted without large changes.

Before switching, get a forum answer on eligibility.

## Consequences

- `scripts/check-boundaries.mjs` is what keeps this fallback cheap. Don't weaken it.
- Code in `src/platform` and `src/view` may use `@iwsdk/core`, but should stick to its three.js re-exports and raw WebXR wherever possible, so that aliasing `@iwsdk/core` to `three` still compiles. Today only `src/main.ts`, `src/platform/iwsdk-input-visuals.ts` and the IWSDK manifests (`src/assets.ts`, `src/components.ts`) use IWSDK-specific APIs; the fallback drops the manifests.
