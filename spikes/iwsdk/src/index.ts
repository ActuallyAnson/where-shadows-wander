import { Clock, World, createSystem, VisibilityState } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { SpikeGame } from './spike/game.js';

performance.mark('spike-script-start');
const params = new URLSearchParams(location.search);
// ?loop=system (default): IWSDK owns setAnimationLoop; one ECS system calls game.frame().
// ?loop=own: we take over renderer.setAnimationLoop and call world.update() ourselves.
const driver = params.get('loop') === 'own' ? 'own' : 'system';
(window as unknown as { __spikeDriver: string }).__spikeDriver = driver;

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  performance.mark('spike-world-created');
  const game = new SpikeGame(world, {
    hz: Number(params.get('hz') ?? 60),
    quads: Number(params.get('quads') ?? 500),
    showProxy: params.get('proxy') !== '0',
  });
  (window as unknown as Record<string, unknown>).__spike = { world, game, report: game.report };

  if (driver === 'system') {
    // Runs after IWSDK's input (-4) and scene understanding (-1) systems.
    class SpikeDriverSystem extends createSystem({}) {
      update(delta: number) {
        game.frame(delta, this.world.xrFrame, this.world.xrReferenceSpace);
      }
    }
    world.registerSystem(SpikeDriverSystem, { priority: 10 });
  } else {
    const renderer = world.renderer;
    const clock = new Clock();
    renderer.setAnimationLoop((_t, frame) => {
      const dt = clock.getDelta();
      world.visibilityState.value =
        (world.session?.visibilityState as VisibilityState | undefined) ?? VisibilityState.NonImmersive;
      world.update(dt, clock.elapsedTime);
      if (frame) world.runXRFrameCallbacks(frame, dt, clock.elapsedTime);
      game.frame(dt, frame ?? null, renderer.xr.getReferenceSpace());
      renderer.render(world.scene, world.camera);
    });
  }
});
