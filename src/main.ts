// Composition root. IWSDK owns the XR session, renderer and display loop; one
// driver system hands each frame to our code. Gameplay and sim (src/sim,
// src/hands, later src/game) never import IWSDK or three.js; this is
// enforced by scripts/check-boundaries.mjs. See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
import { World, createSystem } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { FixedStepLoop } from './sim/fixed-step';
import { Diagnostics, mountReportPanel } from './platform/diagnostics';
import { disableIwsdkRays, hideIwsdkHandMeshes } from './platform/iwsdk-input-visuals';
import { HandRecorder, offerDownload } from './platform/hand-recorder';
import { showNoXrNoticeIfNeeded } from './platform/no-xr-notice';
import { XRHandReader } from './platform/xr-hands';
import { JointDots } from './view/joint-dots';

const SIM_HZ = 60;

const diagnostics = new Diagnostics();
mountReportPanel(diagnostics);
void showNoXrNoticeIfNeeded();

// No top-level await here: IWSDK lazily imports a chunk that imports back from
// this one, and a suspended top-level await deadlocks that in production builds.
start().catch((e) => diagnostics.error(`start failed: ${String(e)}`));

async function start(): Promise<void> {
  const world = await World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions);
  diagnostics.mark('worldCreated');
  disableIwsdkRays(world);

  const hands = new XRHandReader();
  const handList = [hands.hands.left, hands.hands.right];
  const sim = new FixedStepLoop(SIM_HZ, () => {
    // Game simulation steps go here (week 2+).
  });
  const dots = new JointDots();
  world.scene.add(dots.mesh);

  diagnostics.addSource(() => ({
    sim: { hz: SIM_HZ, steps: sim.steps },
    handReadMethod: { ...hands.method },
  }));
  world.renderer.xr.addEventListener('sessionstart', () => {
    const session = world.renderer.xr.getSession();
    if (session) diagnostics.sessionStarted(session, world.renderer);
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    diagnostics.sessionEnded();
    recorder?.finish();
  });

  const recorder = HandRecorder.fromUrl();
  if (recorder) recorder.onFinished = offerDownload;
  const head: [number, number, number] = [0, 0, 0];

  // The only IWSDK system we register. Priority 10 runs after IWSDK's input (-4)
  // and scene understanding (-1) systems and before render.
  class FrameDriverSystem extends createSystem({}) {
    update(delta: number) {
      const t0 = performance.now();
      diagnostics.mark('firstFrame');
      const frame = this.world.xrFrame;
      const refSpace = this.world.xrReferenceSpace;
      if (frame && refSpace) {
        hands.update(frame, refSpace, this.world.player.matrixWorld);
        hideIwsdkHandMeshes(this.world);
        if (recorder) {
          const viewer = frame.getViewerPose(refSpace)?.transform.position;
          if (viewer) [head[0], head[1], head[2]] = [viewer.x, viewer.y, viewer.z];
          recorder.frame(performance.now(), hands.hands.left, hands.hands.right, viewer ? head : null);
        }
      }
      sim.advance(delta);
      dots.update(handList);
      diagnostics.frame(frame, refSpace, hands.hands, performance.now() - t0);
    }
  }
  world.registerSystem(FrameDriverSystem, { priority: 10 });

  // Dev-only handle for the iwsdk CLI scripts in scripts/.
  if (import.meta.env.DEV) Object.assign(window, { __wsw: { world, hands, diagnostics, recorder } });
}
