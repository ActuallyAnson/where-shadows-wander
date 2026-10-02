// Composition root. IWSDK owns the XR session, renderer and display loop; one
// driver system hands each frame to our code. Pure code (src/engine/hands,
// src/engine/sim, src/engine/stage, src/game) never imports IWSDK or three.js;
// this is enforced by ESLint (eslint.config.js). See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
import { World, createSystem } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { Diagnostics } from '../debug/diagnostics';
import { mountReportPanel } from '../debug/report-panel';
import { FixedStepLoop } from '../engine/sim/fixed-step';
import { HandRecorder, offerDownload } from '../engine/xr/hand-recorder';
import { disableIwsdkRays, hideIwsdkHandMeshes } from '../engine/xr/iwsdk-input-visuals';
import { JointDots } from '../engine/xr/joint-dots';
import { PromptPanel } from '../engine/xr/prompt-panel';
import { XRHandReader } from '../engine/xr/xr-hands';
import { HandLab } from '../input-mock/hand-lab';
import { createMockSource, MockMode, mockOptionsFromUrl } from '../input-mock/mock-mode';
import { SyntheticSource } from '../input-mock/synthetic-source';
import { mountLabLink } from './lab-link';
import { showNoXrNoticeIfNeeded } from './no-xr-notice';

const SIM_HZ = 60;

const mockOptions = mockOptionsFromUrl(location.search);
const diagnostics = new Diagnostics();
mountReportPanel(diagnostics);
// Mock mode runs on any browser, so it skips the "open this on a headset" notice.
if (!mockOptions) void showNoXrNoticeIfNeeded();
if (!mockOptions && import.meta.env.DEV) mountLabLink();

// No top-level await here: IWSDK lazily imports a chunk that imports back from
// this one, and a suspended top-level await deadlocks that in production builds.
start().catch((e) => diagnostics.error(`start failed: ${String(e)}`));

async function start(): Promise<void> {
  const world = await World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions);
  diagnostics.mark('worldCreated');
  disableIwsdkRays(world);

  const hands = new XRHandReader();
  // Mock mode (?mock=1): a HandSource fills the same HandFrames instead of WebXR.
  let mock: MockMode | null = null;
  let lab: HandLab | null = null;
  if (mockOptions) {
    const source = await createMockSource(mockOptions).catch((e) => {
      diagnostics.error(`mock source "${mockOptions.source}" failed, using synthetic hands: ${String(e)}`);
      return new SyntheticSource();
    });
    mock = new MockMode(source);
    lab = new HandLab(mock, hands.hands, {
      scene: world.scene,
      camera: world.camera,
      canvas: world.renderer.domElement,
    });
  }
  const handList = [hands.hands.left, hands.hands.right];
  const sim = new FixedStepLoop(SIM_HZ, () => {
    // Game simulation steps go here (week 2+).
  });
  const dots = new JointDots();
  world.scene.add(dots.mesh);

  diagnostics.addSource(() => ({
    sim: { hz: SIM_HZ, steps: sim.steps },
    handReadMethod: { ...hands.method },
    mock: mock ? { source: mock.source.name } : null,
  }));
  world.renderer.xr.addEventListener('sessionstart', () => {
    const session = world.renderer.xr.getSession();
    if (session) diagnostics.sessionStarted(session, world.renderer);
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    diagnostics.sessionEnded();
    recorder?.finish();
  });

  const recorder = HandRecorder.fromUrl(!mock);
  if (recorder) recorder.onFinished = offerDownload;
  const head: [number, number, number] = [0, 0, 0];
  const headTurn = { x: 0, y: 0, z: 0, w: 1 };
  // Guided recording on a headset: prompts on a panel in front of the wearer,
  // placed on the first XR frame and again when recording starts.
  const panel = recorder?.script ? new PromptPanel() : null;
  // The head pose is in reference space, which is the XR origin's space.
  if (panel) world.player.add(panel.mesh);
  let panelAtStart = false;

  // The only IWSDK system we register. Priority 10 runs after IWSDK's input (-4)
  // and scene understanding (-1) systems and before render.
  class FrameDriverSystem extends createSystem({}) {
    update(delta: number) {
      const t0 = performance.now();
      diagnostics.mark('firstFrame');
      const frame = this.world.xrFrame;
      const refSpace = this.world.xrReferenceSpace;
      if (mock) mock.update(delta, hands.hands.left, hands.hands.right);
      else if (frame && refSpace) hands.update(frame, refSpace, this.world.player.matrixWorld);
      if (frame && refSpace) hideIwsdkHandMeshes(this.world);
      if (recorder) {
        const pose = frame && refSpace ? frame.getViewerPose(refSpace) : undefined;
        const viewer = pose?.transform.position;
        if (viewer) [head[0], head[1], head[2]] = [viewer.x, viewer.y, viewer.z];
        recorder.frame(performance.now(), hands.hands.left, hands.hands.right, viewer ? head : null);
        if (panel && pose && recorder.script) {
          const o = pose.transform.orientation;
          headTurn.x = o.x;
          headTurn.y = o.y;
          headTurn.z = o.z;
          headTurn.w = o.w;
          if (!panel.placed || (recorder.started && !panelAtStart)) {
            panel.anchor(head, headTurn);
            panelAtStart = recorder.started;
          }
          const prompt = recorder.prompt;
          if (recorder.finished) panel.show(recorder.script.doneText, 0);
          else if (prompt) panel.show(prompt.text, prompt.remaining);
          else panel.show(recorder.script.waitText, 0);
        }
      }
      sim.advance(delta);
      dots.update(handList);
      lab?.frame();
      diagnostics.frame(frame, refSpace, hands.hands, performance.now() - t0);
    }
  }
  world.registerSystem(FrameDriverSystem, { priority: 10 });

  // Dev-only handle for the iwsdk CLI scripts in scripts/.
  if (import.meta.env.DEV) Object.assign(window, { __wsw: { world, hands, diagnostics, recorder, mock, lab } });
}
