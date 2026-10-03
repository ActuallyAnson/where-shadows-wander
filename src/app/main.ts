// Composition root. IWSDK owns the XR session, renderer and display loop; one
// driver system hands each frame to our code. Pure code (src/engine/hands,
// src/engine/sim, src/engine/stage, src/game) never imports IWSDK or three.js;
// this is enforced by ESLint (eslint.config.js). See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
import { Matrix4, Quaternion, Vector3, World, createSystem } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { Diagnostics } from '../debug/diagnostics';
import { mountReportPanel } from '../debug/report-panel';
import { GestureDetector } from '../engine/hands/gesture-detector';
import { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { LanternLightModel } from '../engine/shadow/pure/lantern-light';
import { ShadowSharpen } from '../engine/shadow/pure/shadow-sharpen';
import { ShadowProjector } from '../engine/shadow/pure/shadow-projector';
import { createStagePlane } from '../engine/shadow/pure/stage-plane';
import { MOCK_HEAD, placeTestRig, yawOf, type StageMode } from '../engine/shadow/pure/test-rig';
import { ShadowDebug } from '../engine/shadow/shadow-debug';
import { ShadowRenderer } from '../engine/shadow/shadow-renderer';
import { TestStageView } from '../engine/shadow/test-stage-view';
import { FixedStepLoop } from '../engine/sim/fixed-step';
import { CapabilityDetector } from '../engine/xr/capabilities';
import { HandOccluder } from '../engine/xr/hand-occluder';
import { HandRecorder, offerDownload } from '../engine/xr/hand-recorder';
import { disableIwsdkRays, hideIwsdkHandMeshes } from '../engine/xr/iwsdk-input-visuals';
import { JointDots } from '../engine/xr/joint-dots';
import { PromptPanel } from '../engine/xr/prompt-panel';
import { XRHandReader } from '../engine/xr/xr-hands';
import { HandLab } from '../input-mock/hand-lab';
import { MOCK_LANTERN } from '../input-mock/hand-source';
import { createMockSource, MockMode, mockOptionsFromUrl } from '../input-mock/mock-mode';
import { SyntheticSource } from '../input-mock/synthetic-source';
import { probePixels } from './composite-probe';
import { FrameTimings, SLOT } from './frame-timings';
import { mountEnterArButtonIfNeeded } from './enter-ar-button';
import { mountLabLink } from './lab-link';
import { reportSource } from './report-source';
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
  // Dev only: the IWER emulator starts with controllers; this game is hands-only, so start it with hands.
  if (import.meta.env.DEV) {
    const emulated = (window as { IWER_DEVICE?: { primaryInputMode: string } }).IWER_DEVICE;
    if (emulated) emulated.primaryInputMode = 'hand';
  }
  diagnostics.mark('worldCreated');
  // Browsers that never offer an AR session (Pico Browser) get an Enter AR button.
  if (!mockOptions) void mountEnterArButtonIfNeeded(world);
  disableIwsdkRays(world);

  const hands = new XRHandReader();
  // What the session provides (hands, passthrough, planes, anchors), and the detected planes for StageFrame.
  const capabilities = new CapabilityDetector();

  // Shape recognition on both hands every frame. Its events go to the simulation (Teammate A) once it exists.
  const shapes = new ShapeRecognizer();
  // Lantern gestures for Teammate B's lantern flow. Mock mode has a stand-in lantern; in XR it waits for B's.
  const gestures = new GestureDetector();
  gestures.setLantern(mockOptions ? MOCK_LANTERN : null);
  let clock = 0;

  // Hand shadows, on a stand-in stage and lantern until StageFrame (A) and the lantern (B) exist:
  // ?stage=table (the tabletop theatre, default) or ?stage=wall. ?debug=shadow shows the capsules.
  const params = new URLSearchParams(location.search);
  const stageMode: StageMode = params.get('stage') === 'wall' ? 'wall' : 'table';
  const stage = createStagePlane();
  const lantern = new Float64Array(3);
  const projector = new ShadowProjector();
  const shadowRenderer = new ShadowRenderer();
  // Each hand's shadow sharpens as its shape is recognised (candidate), and snaps crisp on commit.
  const sharpen = new ShadowSharpen();
  // The lantern's flicker: ?flicker=0..1 sets how much (0 is steady); the default is gentler under reduced motion.
  const flickerParam = Number(params.get('flicker'));
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lanternLight = new LanternLightModel({
    amplitude:
      params.has('flicker') && Number.isFinite(flickerParam)
        ? Math.min(Math.max(flickerParam, 0), 1)
        : reduceMotion
          ? 0.3
          : 1,
  });
  // Follow the OS reduced-motion setting while the page is open, unless ?flicker= was given.
  if (!params.has('flicker') && typeof matchMedia === 'function')
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      lanternLight.settings.amplitude = e.matches ? 0.3 : 1;
    });
  const cameraQuat = new Quaternion();
  const stageView = new TestStageView();
  stageView.flameVisible = !mockOptions; // the Hand Lab draws its own lantern
  const shadowDebug = params.get('debug') === 'shadow' ? new ShadowDebug() : null;
  world.scene.add(stageView.group, shadowRenderer.mesh);
  if (shadowDebug) world.scene.add(shadowDebug.group);
  let rigPlaced = false;
  const timings = new FrameTimings();
  const placeRig = (head: ArrayLike<number>, yaw: number) => {
    placeTestRig(stageMode, head, yaw, stage, lantern);
    stageView.place(stage, lantern);
    // Cover-flame only aims at the stand-in lantern in mock mode. In XR it waits for Teammate B's
    // lantern: a guessed spot near the chest would read a resting fist as "pause".
    if (mockOptions) gestures.setLantern([lantern[0], lantern[1], lantern[2]]);
    rigPlaced = true;
  };
  const headMatrix = new Matrix4();
  const headPos = new Vector3();
  const headRot = new Quaternion();
  const headScale = new Vector3();
  let resetWatched: XRReferenceSpace | null = null;
  // In mock mode the player's eyes are the desktop camera; in XR the rig is placed on the first frame.
  if (mockOptions) placeRig(MOCK_HEAD, 0);
  // Mock mode (?mock=1): a HandSource fills the same HandFrames instead of WebXR.
  let mock: MockMode | null = null;
  let lab: HandLab | null = null;
  if (mockOptions) {
    const source = await createMockSource(mockOptions).catch((e) => {
      diagnostics.error(`mock source "${mockOptions.source}" failed, using synthetic hands: ${String(e)}`);
      return new SyntheticSource();
    });
    mock = new MockMode(source);
    lab = new HandLab(mock, hands.hands, shapes, gestures, MOCK_LANTERN, {
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
  // Real hands stay visible in front of the paper and shadow. On in a headset (?occlude=0 turns it off to compare);
  // off in mock mode, where there is no passthrough, unless ?occlude=1 (for the composite probe).
  const occluder = new HandOccluder();
  occluder.enabled = mockOptions ? params.get('occlude') === '1' : params.get('occlude') !== '0';
  world.scene.add(...occluder.meshes);

  // addSource keeps only one source, so everything we report goes through it.
  diagnostics.addSource(() => ({
    ...reportSource({
      simHz: SIM_HZ,
      simSteps: sim.steps,
      handReadMethod: hands.method,
      mockSource: mock ? mock.source.name : null,
      capabilities,
    }),
    shapes: { commits: { ...shapes.commits }, droppedEvents: shapes.events.dropped },
    gestures: { ...gestures.counts, droppedEvents: gestures.events.dropped },
    perf: timings.toJSON(),
    render: renderReport(),
    shadow: {
      stage: stageMode,
      placed: rigPlaced,
      onStage: [projector.shadows.left.onStage, projector.shadows.right.onStage],
    },
  }));
  // What the compositor receives from us. Read lazily, at report time.
  const TONE_MAPPING = ['none', 'linear', 'reinhard', 'cineon', 'aces', 'custom', 'agx', 'neutral'];
  const renderReport = () => {
    const session = world.renderer.xr.getSession();
    const layers = session?.renderState.layers;
    return {
      clearAlpha: world.renderer.getClearAlpha(),
      toneMapping: TONE_MAPPING[world.renderer.toneMapping] ?? String(world.renderer.toneMapping),
      outputColorSpace: world.renderer.outputColorSpace,
      blendMode: session?.environmentBlendMode ?? null,
      layer: session ? (layers && layers.length ? 'projection' : 'webgl') : null,
      handOccluder: occluder.enabled,
    };
  };
  world.renderer.xr.addEventListener('sessionstart', () => {
    const session = world.renderer.xr.getSession();
    if (session) diagnostics.sessionStarted(session, world.renderer);
    // Mock hands don't come from the session, so in mock mode capabilities stay at "no session".
    if (session && !mock) capabilities.sessionStarted(session);
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    if (!mock) {
      rigPlaced = false; // placed again from the head at the next session
      stageView.group.visible = shadowRenderer.mesh.visible = false;
    }
    diagnostics.sessionEnded();
    capabilities.sessionEnded();
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
      timings.begin(SLOT.total);
      diagnostics.mark('firstFrame');
      const frame = this.world.xrFrame;
      const refSpace = this.world.xrReferenceSpace;
      timings.begin(SLOT.read);
      if (mock) mock.update(delta, hands.hands.left, hands.hands.right);
      else if (frame && refSpace) {
        hands.update(frame, refSpace, this.world.player.matrixWorld);
        capabilities.update(frame, refSpace, hands.hands, this.world.player.matrixWorld.elements, performance.now());
      }
      if (frame && refSpace) hideIwsdkHandMeshes(this.world);
      timings.end(SLOT.read);
      // Mock time in mock mode, so pausing the Hand Lab freezes holds too.
      clock += delta;
      const handsT = mock ? mock.time : clock;
      timings.begin(SLOT.classify);
      shapes.update(hands.hands, handsT);
      timings.end(SLOT.classify);
      timings.begin(SLOT.gestures);
      gestures.update(hands.hands, handsT, shapes);
      timings.end(SLOT.gestures);
      sharpen.update({ left: shapes.left.state, right: shapes.right.state }, shapes.events, delta);
      if (!mock && frame && refSpace && refSpace !== resetWatched) {
        // Recentring moves the player's frame: place the rig again from the new head pose.
        refSpace.addEventListener('reset', () => (rigPlaced = false));
        resetWatched = refSpace;
      }
      if (!rigPlaced && !mock && frame && refSpace) {
        const pose = frame.getViewerPose(refSpace);
        // Skip poses the browser estimates (tracking not ready yet); hands are in scene space, so the head is too.
        if (pose && !pose.emulatedPosition) {
          headMatrix.fromArray(pose.transform.matrix).premultiply(this.world.player.matrixWorld);
          headMatrix.decompose(headPos, headRot, headScale);
          placeRig([headPos.x, headPos.y, headPos.z], yawOf(headRot.x, headRot.y, headRot.z, headRot.w));
        }
      }
      if (rigPlaced) {
        timings.begin(SLOT.shadow);
        projector.update(hands.hands, stage, lantern);
        shadowRenderer.update(projector.shadows, stage, sharpen.look);
        shadowDebug?.update(projector.shadows, hands.hands, stage, projector.matrix);
        timings.end(SLOT.shadow);
      }
      if (recorder) {
        const pose = frame && refSpace ? frame.getViewerPose(refSpace) : undefined;
        const viewer = pose?.transform.position;
        if (viewer) {
          head[0] = viewer.x;
          head[1] = viewer.y;
          head[2] = viewer.z;
        }
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
          else if (prompt) panel.show(prompt.text, prompt.remaining, recorder.script.shapeAt(prompt.index));
          else panel.show(recorder.script.waitText, 0);
        }
      }
      sim.advance(delta);
      // The stand-in lantern burns once the rig is placed; Teammate B's lantern flow will set `lit` and the position.
      lanternLight.update(clock, rigPlaced ? lantern : null, true);
      world.camera.getWorldQuaternion(cameraQuat);
      stageView.applyLight(lanternLight.light, cameraQuat);
      lab?.applyLight(lanternLight.light, cameraQuat);
      occluder.update(handList);
      dots.update(handList);
      timings.begin(SLOT.lab);
      lab?.frame();
      timings.end(SLOT.lab);
      timings.end(SLOT.total);
      timings.endFrame();
      diagnostics.frame(frame, refSpace, hands.hands, performance.now() - t0);
    }
  }
  world.registerSystem(FrameDriverSystem, { priority: 10 });

  // Dev-only handle for the iwsdk CLI scripts in scripts/.
  if (import.meta.env.DEV)
    Object.assign(window, {
      __wsw: {
        world,
        hands,
        diagnostics,
        recorder,
        mock,
        lab,
        capabilities,
        shapes,
        gestures,
        projector,
        stage,
        occluder,
        sharpen,
        lanternLight,
        dots,
        probe: (points: readonly (readonly number[])[]) =>
          probePixels(world.renderer, world.scene, world.camera, points),
      },
    });
}
