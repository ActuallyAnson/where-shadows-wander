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
