// Composition root. IWSDK owns the XR session, renderer and display loop; one
// driver system hands each frame to our code. Pure code (src/engine/hands,
// src/engine/sim, src/engine/stage, src/game) never imports IWSDK or three.js;
// this is enforced by ESLint (eslint.config.js). See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
import { AmbientLight, Color, Matrix4, Quaternion, SessionMode, Vector3, World, createSystem } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { DEBUG_TOOLS } from '../debug/debug-flag';
import type { DebugTools } from '../debug/debug-tools';
import { Diagnostics } from '../debug/diagnostics';
import { mountReportPanel } from '../debug/report-panel';
import { CandleView } from '../engine/render/candle-view';
import { GestureDetector } from '../engine/hands/gesture-detector';
import { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { LanternLightModel } from '../engine/shadow/pure/lantern-light';
import { ShadowSharpen } from '../engine/shadow/pure/shadow-sharpen';
import { ShadowProjector } from '../engine/shadow/pure/shadow-projector';
import { REAL_WALL_SHADOW_SETTINGS } from '../engine/shadow/pure/real-wall';
import { createStagePlane, type StagePlane } from '../engine/shadow/pure/stage-plane';
import { MOCK_HEAD, placeLantern, placeTestRig, yawOf, type StageMode } from '../engine/shadow/pure/test-rig';
import { DEFAULT_SHADOW_OPACITY, ShadowRenderer } from '../engine/shadow/shadow-renderer';
import { TestStageView } from '../engine/shadow/test-stage-view';
import { GameAudio } from '../engine/services/audio/game-audio';
import { AudioEngine, type SessionEvents } from '../engine/services/audio/web-audio-engine';
import { attachSaveHooks } from '../engine/services/saves/save-hooks';
import { SaveManager } from '../engine/services/saves/save-manager';
import { browserStore, MemoryStore } from '../engine/services/saves/storage';
import { FixedStepLoop } from '../engine/sim/fixed-step';
import { StageFrame } from '../engine/stage/stage-frame';
import { SettingsStore } from '../engine/services/settings/settings-store';
import { shortenAssetTimeout } from '../engine/services/assets/iwsdk-assets';
import { CapabilityDetector } from '../engine/xr/capabilities';
import { HandOccluder } from '../engine/xr/hand-occluder';
import { CapsuleHandVisual, type HandVisual } from '../engine/xr/hand-visual';
import { HandsStatus, MAX_STEP_S } from '../engine/xr/hands-status';
import { HandRecorder, offerDownload } from '../engine/xr/hand-recorder';
import { disableIwsdkRays, hideIwsdkHandMeshes } from '../engine/xr/iwsdk-input-visuals';
import { PromptPanel } from '../engine/xr/prompt-panel';
import { clearFor, occluderDefault, sessionModeOf, xrModeFromUrl } from '../engine/xr/session-mode';
import { SessionVisibility } from '../engine/xr/session-visibility';
import { XRHandReader } from '../engine/xr/xr-hands';
import { HandLab } from '../input-mock/hand-lab';
import { MOCK_LANTERN } from '../input-mock/hand-source';
import { createMockSource, MockMode, mockOptionsFromUrl } from '../input-mock/mock-mode';
import { SyntheticSource } from '../input-mock/synthetic-source';
import { SettingsPanel } from '../ui/settings-panel/settings-panel';
import { probePixels } from './composite-probe';
import { FailureReporter } from './failure-reporter';
import { FrameTimings, SLOT } from './frame-timings';
import { mountEnterArButtonIfNeeded } from './enter-ar-button';
import { mountLabLink } from './lab-link';
import { reportSource } from './report-source';
import { showNoXrNoticeIfNeeded } from './no-xr-notice';
import { showStartFailure } from './start-failure';

const SIM_HZ = 60;
const HANDS_STATE_NAMES = ['tracking', 'lost', 'unavailable'] as const;

const mockOptions = mockOptionsFromUrl(location.search);
// The game is a virtual room (immersive-vr, ADR 0005). ?xr=ar starts the passthrough mode instead.
const xrMode = xrModeFromUrl(location.search);
const diagnostics = new Diagnostics();
// One part of the frame throwing must not stop the rest, or the next frame (failure-reporter.ts).
const failures = new FailureReporter((message) => diagnostics.error(message));
mountReportPanel(diagnostics);
// Mock mode runs on any browser, so it skips the "open this on a headset" notice.
if (!mockOptions) void showNoXrNoticeIfNeeded(location.search);
if (!mockOptions && import.meta.env.DEV) mountLabLink();

// No top-level await here: IWSDK lazily imports a chunk that imports back from
// this one, and a suspended top-level await deadlocks that in production builds.
start().catch((e) => {
  diagnostics.error(`start failed: ${String(e)}`);
  showStartFailure(e);
});

async function start(): Promise<void> {
  // iwsdk.config.json says VR; ?xr=ar overrides the session mode before the world (and its enter offer) is made.
  const worldOptions =
    projectOptions.xr && xrMode === 'ar'
      ? { ...projectOptions, xr: { ...projectOptions.xr, sessionMode: SessionMode.ImmersiveAR } }
      : projectOptions;
  const world = await World.create(document.getElementById('scene-container') as HTMLDivElement, worldOptions);
  // Dev only: the IWER emulator starts with controllers; this game is hands-only, so start it with hands.
  if (import.meta.env.DEV) {
    const emulated = (window as { IWER_DEVICE?: { primaryInputMode: string } }).IWER_DEVICE;
    if (emulated) emulated.primaryInputMode = 'hand';
  }
  // The critical assets have loaded; from here IWSDK gives up on any one request after 8 s, not 30 s.
  shortenAssetTimeout();
  diagnostics.mark('worldCreated');
  // The page's own Enter VR / Enter AR buttons: the only way in on browsers with no enter prompt (Pico Browser).
  if (!mockOptions) void mountEnterArButtonIfNeeded(world);
  disableIwsdkRays(world);

  const hands = new XRHandReader();
  // What the session provides (hands, passthrough, planes, anchors), and the detected planes for StageFrame.
  const capabilities = new CapabilityDetector();
  // Whether hand data is arriving (tracking, lost, or unavailable), for the in-scene "Show me your hands" message.
  const handsStatus = new HandsStatus();
  // The session's visibility: the simulation pauses on it (Teammate A) and saves can listen to it (Teammate B).
  const visibility = new SessionVisibility();
  // The save (progress, the creature gallery, solutions found): read once now, written only on events (headset
  // off, page hidden, a puzzle ending), never per frame. Teammate A's puzzle code calls saves.puzzleEnded.
  // The Hand Lab (?mock=1) keeps its own save, so a development session never touches a real one.
  const saves = new SaveManager({
    store: browserStore() ?? new MemoryStore(),
    prefix: mockOptions ? 'wsw.save.mock' : 'wsw.save',
    onError: (message) => diagnostics.error(`save: ${message}`),
  });
  saves.load();
  saves.touchDay(); // saves.previousDay is the night before, to tell a new night from a return the same evening
  attachSaveHooks(saves, visibility, { window, document });

  // Shape recognition on both hands every frame. Its events go to the simulation (Teammate A) once it exists.
  const shapes = new ShapeRecognizer();
  // Lantern gestures for Teammate B's lantern flow. Mock mode has a stand-in lantern; in XR it waits for B's.
  const gestures = new GestureDetector();
  gestures.setLantern(mockOptions ? MOCK_LANTERN : null);
  let clock = 0;

  // Hand shadows land on the stage. In a headset it is Teammate A's StageFrame: the virtual room's paper wall,
  // 2 m ahead and 1.6 x 1.0 m (ADR 0005). The Hand Lab (?mock=1) keeps the stand-in tabletop theatre by default;
  // ?stage=wall is a bigger stand-in and ?stage=real the real wall, to look at it on a desktop.
  // ?debug=shadow shows the capsules. The lantern is placed by the same stand-in rule in both until the lantern flow exists.
  const params = new URLSearchParams(location.search);
  const stageChoice: 'real' | StageMode =
    !mockOptions || params.get('stage') === 'real' ? 'real' : params.get('stage') === 'wall' ? 'wall' : 'table';
  const stageFrame = new StageFrame();
  const standInStage = createStagePlane();
  const stage: StagePlane = stageChoice === 'real' ? stageFrame : standInStage;
  const lantern = new Float64Array(3);
  // On the real wall the shadow settings are in real-wall.ts (blend 0.65, a low edge blur); the near, small
  // tabletop theatre was tuned with full perspective (blend 0).
  const projector = new ShadowProjector(stageChoice === 'real' ? REAL_WALL_SHADOW_SETTINGS : { blend: 0.0 });
  const shadowRenderer = new ShadowRenderer();
  // Each hand's shadow sharpens as its shape is recognised (candidate), and snaps crisp on commit.
  const sharpen = new ShadowSharpen();
  // Each hand's classifier state, made once: a new object here every frame is garbage in a headset.
  const handStates = { left: shapes.left.state, right: shapes.right.state };
  // The lantern's flicker: ?flicker=0..1 sets how much (0 is steady); the default is gentler under reduced motion.
  const flickerRaw = params.get('flicker');
  const flickerParam = flickerRaw === null || flickerRaw.trim() === '' ? NaN : Number(flickerRaw); // ?flicker with no value is ignored, not 0
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lanternLight = new LanternLightModel({
    amplitude: Number.isFinite(flickerParam) ? Math.min(Math.max(flickerParam, 0), 1) : reduceMotion ? 0.3 : 1,
  });
  // Follow the OS reduced-motion setting while the page is open, unless ?flicker= was given.
  if (!Number.isFinite(flickerParam) && typeof matchMedia === 'function')
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      lanternLight.settings.amplitude = e.matches ? 0.3 : 1;
    });
  const cameraQuat = new Quaternion();
  const stageView = new TestStageView();
  stageView.flameVisible = false; // Retired stand-in flame; CandleView renders the procedural candle & flame
  const candleView = new CandleView();
  const ambientLight = new AmbientLight(0x1a1410, 0.04);
  // ?debug=shadow,joints (or repeat ?debug=...): each named view on.
  const debugViews = new Set(params.getAll('debug').flatMap((v) => v.split(',').map((x) => x.trim())));
  world.scene.add(stageView.group, shadowRenderer.mesh, candleView.group, ambientLight);
  let rigPlaced = false;
  let rigCalibratedFromHead = false;
  let everPlaced = false;
  const timings = new FrameTimings();
  // Sound: plain Web Audio (docs/adr/0008-audio.md). It unlocks on the first gesture on the page, or when a
  // headset session starts (which a button press or the browser's enter prompt began).
  const audio = new AudioEngine();
  audio.attachGestureUnlock(document);
  const gameAudio = new GameAudio(audio);
  // Where the listener is: the head's position, forward and up, read from the camera's matrix each frame.
  const audioPose = new Float64Array(9);
  // Sound holds still with the game: the system menu, the headset off, or the page hidden.
  const syncAudioPause = () => audio.setPaused(visibility.paused || document.hidden);
  visibility.subscribe(syncAudioPause);
  document.addEventListener('visibilitychange', syncAudioPause);
  // The accessibility settings (docs/adr/0010-saves.md): loaded from the save, applied live to the recognizer,
  // shadows, lantern and mixer, and saved on change. The lantern flicker follows the device's reduced-motion
  // default until the player moves its slider, and ?flicker= overrides the setting for testing.
  const settings = new SettingsStore(
    { recognizer: shapes, projector, sharpen, lantern: lanternLight, mixer: audio.mixer },
    { applyOnlyWhenChosen: ['flicker'], neverApply: Number.isFinite(flickerParam) ? ['flicker'] : [] },
    saves.data.settings,
  );
  settings.subscribe(() => saves.setSettings(settings.value));
  // High contrast: a bright white wall and fully solid shadows (the room art, when it exists, reads the same setting).
  const applyContrast = () => {
    stageView.highContrast = settings.value.highContrast;
    shadowRenderer.baseOpacity = settings.value.highContrast ? 1 : DEFAULT_SHADOW_OPACITY;
  };
  settings.subscribe((key) => {
    if (key === null || key === 'highContrast') applyContrast();
  });
  applyContrast();
  // The settings screen: pressed with a fingertip. The Hand Lab has a Settings button; in a headset the Testing switch opens it
  // (the lantern flow will).
  // The debug menu (when the debug tools are on) is extra pages after the settings, built the first time it opens.
  const settingsPanel = new SettingsPanel(world, settings, () => debug?.controller.pages() ?? []);
  const settingsHead = new Vector3();
  const settingsLook = new Vector3();
  const openSettings = () => {
    world.camera.getWorldPosition(settingsHead);
    world.camera.getWorldDirection(settingsLook);
    return settingsPanel.open([settingsHead.x, settingsHead.y, settingsHead.z], settingsLook.x, settingsLook.z);
  };
  let badPoseReported = false;
  /** Places the stage and lantern for a head at `head` facing `yaw`. Returns false, placing nothing, if the pose is not usable. */
  const placeRig = (head: ArrayLike<number>, yaw: number): boolean => {
    // A head pose that is not finite would make StageFrame throw, and a throw in the frame loop would stop every later frame.
    if (!(Number.isFinite(yaw) && Number.isFinite(head[0]) && Number.isFinite(head[1]) && Number.isFinite(head[2]))) {
      if (!badPoseReported) {
        badPoseReported = true;
        diagnostics.error(
          `placeRig: ignoring a head pose that is not finite (${head[0]}, ${head[1]}, ${head[2]}, yaw ${yaw})`,
        );
      }
      return false;
    }
    if (stageChoice === 'real') {
      stageFrame.placeInFront(head, yaw);
      placeLantern(head, yaw, lantern);
    } else placeTestRig(stageChoice, head, yaw, standInStage, lantern);
    stageView.place(stage, lantern);
    candleView.place(lantern);
    // Cover-flame only aims at the stand-in lantern in mock mode. In XR it waits for Teammate B's
    // lantern: a guessed spot near the chest would read a resting fist as "pause".
    if (mockOptions) gestures.setLantern([lantern[0], lantern[1], lantern[2]]);
    rigPlaced = true;
    everPlaced = true;
    return true;
  };
  const headMatrix = new Matrix4();
  const headPos = new Vector3();
  const headRot = new Quaternion();
  const headScale = new Vector3();
  let resetWatched: XRReferenceSpace | null = null;
  // In mock mode the player's eyes are the desktop camera; in XR initialize with a default seated rig so the scene is immediately visible.
  if (mockOptions) placeRig(MOCK_HEAD, 0);
  else placeRig([0, 1.2, 0], 0);
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
      settings: {
        toggle: () => (settingsPanel.isOpen ? settingsPanel.close() : void openSettings()),
        isOpen: () => settingsPanel.isOpen,
      },
    });
  }
  const handList = [hands.hands.left, hands.hands.right];
  let simWasPaused = false;
  const sim = new FixedStepLoop(SIM_HZ, () => {
    // Game simulation steps go here (week 2+).
  });
  // The hands as the player sees them in the room (swap this one line for another look). Shown in VR and
  // mock mode; over passthrough the real hands are visible, so it hides itself.
  const handVisual: HandVisual = new CapsuleHandVisual();
  let passthrough = false; // set from the session's blend mode: over passthrough the real hands are visible
  world.scene.add(handVisual.object);
  // Debug tools (src/debug, ADR 0012, getting-started section 17): only when DEBUG_TOOLS is on (the dev server, or a build made with
  // `vite build --mode tester`), and loaded on demand, so a normal build does not contain them. `debug` is null otherwise.
  // ?debug=shadow,joints,colliders still turns the overlays on at start.
  const handFlags = { handVisual: true };
  let debug: DebugTools | null = null;
  if (DEBUG_TOOLS) {
    const { DebugTools } = await import('../debug/debug-tools');
    debug = new DebugTools({
      scene: world.scene,
      handFrames: hands.hands,
      handList,
      projector,
      stage,
      shadowMesh: shadowRenderer.mesh,
      sharpen,
      lantern: lanternLight,
      candleLight: candleView.pointLight,
      settings,
      flags: handFlags,
      flame: () => (rigPlaced ? candleView.flamePosition : null),
    });
    debug.controller.subscribe(() => settingsPanel.refreshExtra()); // a key press changes the menu's text too
    for (const [view, overlay] of [
      ['shadow', 'capsules'],
      ['colliders', 'colliders'],
      ['joints', 'joints'],
    ] as const)
      if (debugViews.has(view)) debug.showOverlay(overlay);
  }
  // The occluder keeps real hands in front of the paper over passthrough. It follows the session: off in VR
  // (it would cut a hole in the room), on over passthrough. ?occlude=1 or 0 overrides it for testing.
  const occluder = new HandOccluder();
  const occludeParam = params.get('occlude');
  occluder.enabled = occluderDefault(undefined, !!mockOptions, occludeParam);
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
    saves: { ...saves.status },
    settings: { ...settings.value, panelOpen: settingsPanel.isOpen, panelError: settingsPanel.lastError },
    frameErrors: failures.toJSON(),
    shapes: { commits: { ...shapes.commits }, droppedEvents: shapes.events.dropped },
    gestures: { ...gestures.counts, droppedEvents: gestures.events.dropped },
    perf: timings.toJSON(),
    render: renderReport(),
    shadow: {
      stage: stageChoice,
      placed: rigPlaced,
      everPlaced,
      // Where the real wall landed, to read from a headset report.
      wall: {
        origin: [stage.origin[0], stage.origin[1], stage.origin[2]],
        version: stageChoice === 'real' ? stageFrame.version : null,
      },
      onStage: [projector.shadows.left.onStage, projector.shadows.right.onStage],
    },
    candle: {
      placed: rigPlaced,
      position: [lantern[0], lantern[1], lantern[2]],
      flamePosition: [candleView.flamePosition[0], candleView.flamePosition[1], candleView.flamePosition[2]],
      lit: lanternLight.light.lit,
      intensity: lanternLight.light.intensity,
      pointLightIntensity: candleView.lightIntensity,
      state: candleView.state,
      isHeld: candleView.isHeld,
    },
    xrInput: {
      handsStatus: { state: HANDS_STATE_NAMES[handsStatus.state], showMessage: handsStatus.showMessage },
      visibility: visibility.state,
      readerUpdateCalls: hands.debug.updateCalls,
      readerSourcesSeen: hands.debug.sourcesSeen,
      readerSources: hands.debug.sources,
      readerEvents: hands.debug.inputSourceEvents,
      readerLastError: hands.debug.lastError,
      iwsdkAdapters: {
        handLeft: world.input.xr.visualAdapters.hand.left.connected,
        handRight: world.input.xr.visualAdapters.hand.right.connected,
        controllerLeft: world.input.xr.visualAdapters.controller.left.connected,
        controllerRight: world.input.xr.visualAdapters.controller.right.connected,
      },
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
      urlMode: sessionModeOf(xrMode),
    };
  };
  // Each step of a session start or end is guarded on its own: a throw in one (say the diagnostics) must not skip
  // the others (the pause signal, the hands cue).
  const guard = (label: string, fn: () => void): void => {
    try {
      fn();
    } catch (e) {
      failures.report(label, e);
    }
  };
  world.renderer.xr.addEventListener('sessionstart', () => {
    const session = world.renderer.xr.getSession();
    guard('sessionstart: audio', () => audio.unlock());
    // A session started from the browser's own enter prompt gives the page no click; a pinch in it still unlocks.
    if (session)
      guard('sessionstart: audio session unlock', () => audio.attachSessionUnlock(session as unknown as SessionEvents));
    if (session) {
      guard('sessionstart: display', () => {
        occluder.enabled = occluderDefault(session.environmentBlendMode, !!mockOptions, occludeParam);
        passthrough = session.environmentBlendMode !== undefined && session.environmentBlendMode !== 'opaque';
        const clear = clearFor(session.environmentBlendMode, xrMode);
        world.scene.background = clear.background === null ? null : new Color(clear.background);
        world.renderer.setClearColor(clear.background ?? 0x000000, clear.alpha);
      });
      guard('sessionstart: diagnostics', () => diagnostics.sessionStarted(session, world.renderer));
    }
    // Mock hands don't come from the session, so in mock mode capabilities stay at "no session".
    if (session && !mock) {
      guard('sessionstart: capabilities', () => capabilities.sessionStarted(session));
      guard('sessionstart: hands status', () => handsStatus.start());
    }
    if (session) guard('sessionstart: visibility', () => visibility.attach(session));
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    guard('sessionend: display', () => {
      world.scene.background = null;
      world.renderer.setClearColor(0x000000, 0);
      occluder.enabled = occluderDefault(undefined, !!mockOptions, occludeParam);
      passthrough = false;
    });
    if (!mock) {
      guard('sessionend: wall', () => {
        rigCalibratedFromHead = false;
        placeRig([0, 1.2, 0], 0);
      });
    }
    guard('sessionend: diagnostics', () => diagnostics.sessionEnded());
    guard('sessionend: capabilities', () => capabilities.sessionEnded());
    guard('sessionend: hands status', () => handsStatus.stop());
    // Hands are only read inside a session, so without this they would keep their last pose on the 2D page.
    if (!mock)
      guard('sessionend: hands', () => {
        for (const h of handList) {
          h.tracked = false;
          h.validJoints = 0;
        }
      });
    guard('sessionend: visibility', () => visibility.detach());
    guard('sessionend: saves', () => saves.flush()); // leaving VR does not hide the page, so no page event would save it
    guard('sessionend: hands panel', () => handsPanel?.hide());
    guard('sessionend: recorder', () => {
      recorder?.finish();
      recorder = null; // the next session starts a new one if recording is armed (Testing)
      if (panel) world.player.remove(panel.mesh);
      panel = null;
    });
  });

  let recorder: HandRecorder | null = HandRecorder.fromUrl(!mock);
  if (recorder) recorder.onFinished = offerDownload;
  const head: [number, number, number] = [0, 0, 0];
  const headTurn = { x: 0, y: 0, z: 0, w: 1 };
  // Guided recording on a headset: prompts on a panel in front of the wearer,
  // placed on the first XR frame and again when recording starts.
  let panel: PromptPanel | null = recorder?.script ? new PromptPanel() : null;
  // The head pose is in reference space, which is the XR origin's space.
  if (panel) world.player.add(panel.mesh);
  let panelAtStart = false;
  /** Starts a hand recording for the session that is starting (armed by the launcher's Testing panel, no address needed). */
  const armRecording = (choice: 'off' | 'free' | 'shapes') => {
    if (recorder || choice === 'off') return;
    recorder = HandRecorder.make(choice === 'shapes');
    recorder.onFinished = offerDownload;
    if (recorder.script) {
      panel = new PromptPanel();
      world.player.add(panel.mesh);
      panelAtStart = false;
    }
  };
  // The Testing switches (debug tools only): the overlays change live as a switch is pressed, and the settings panel and
  // the recording begin when VR starts. All remembered in the browser, so no address is ever typed.
  if (DEBUG_TOOLS && debug) {
    const tools = debug;
    const { loadTesting, TESTING_EVENT } = await import('./testing-options');
    const applyOverlays = (t: { joints: boolean; shadow: boolean }) => {
      tools.showOverlay('capsules', t.shadow || debugViews.has('shadow'));
      tools.showOverlay('joints', t.joints || debugViews.has('joints'));
    };
    applyOverlays(loadTesting());
    window.addEventListener(TESTING_EVENT, (e) =>
      applyOverlays((e as CustomEvent<ReturnType<typeof loadTesting>>).detail),
    );
    world.renderer.xr.addEventListener('sessionstart', () => {
      const t = loadTesting();
      if (t.settings) setTimeout(() => void openSettings(), 1000);
      armRecording(t.record);
    });
  }
  // The "Show me your hands" message: a second panel, in front of the wearer when it appears.
  const handsPanel = mock ? null : new PromptPanel();
  if (handsPanel) world.player.add(handsPanel.mesh);
  let handsPanelVersion = handsStatus.version;

  // The only IWSDK system we register. Priority 10 runs after IWSDK's input (-4)
  // and scene understanding (-1) systems and before render.
  class FrameDriverSystem extends createSystem({}) {
    update(delta: number) {
      // Nothing in the frame may throw out of here: the browser and IWSDK do not catch it, and the next frame
      // would never be scheduled (the headset freezes). Parts that can fail on their own are also guarded below,
      // so one failing part does not skip the others.
      try {
        this.frame(delta);
      } catch (e) {
        failures.report('frame', e);
      }
    }

    private frame(delta: number) {
      const t0 = performance.now();
      timings.begin(SLOT.total);
      diagnostics.mark('firstFrame');
      const frame = this.world.xrFrame;
      const refSpace = this.world.xrReferenceSpace;
      // The headset's system menu (visible-blurred) or a hidden page: no hand data arrives and the game holds still.
      const paused = visibility.paused;
      // The first frame after the headset was off carries the whole gap; the sim loop clamps its own, these do not.
      const step = Math.min(delta, MAX_STEP_S);
      timings.begin(SLOT.read);
      if (debug?.replay.active) {
        // A recorded session stands in for the hands (the debug menu, Alt+R); the hands cue sees them as tracked.
        debug.replay.fill(step, hands.hands.left, hands.hands.right);
        handsStatus.update(step, true, 1);
      } else if (mock) mock.update(delta, hands.hands.left, hands.hands.right);
      else if (frame && refSpace && !paused) {
        hands.update(frame, refSpace, this.world.player.matrixWorld);
        capabilities.update(frame, refSpace, hands.hands, this.world.player.matrixWorld.elements, performance.now());
        handsStatus.update(step, hands.hands.left.tracked || hands.hands.right.tracked, hands.handSources);
      }
      if (frame && refSpace) hideIwsdkHandMeshes(this.world);
      timings.end(SLOT.read);
      // Mock time in mock mode, so pausing the Hand Lab freezes holds too.
      if (!paused) clock += step;
      const handsT = mock ? mock.time : clock;
      if (!paused) {
        timings.begin(SLOT.classify);
        shapes.update(hands.hands, handsT);
        timings.end(SLOT.classify);
        timings.begin(SLOT.gestures);
        gestures.update(hands.hands, handsT, shapes);
        timings.end(SLOT.gestures);
        sharpen.update(handStates, shapes.events, step);
      }
      if (handsPanel && handsStatus.version !== handsPanelVersion) {
        if (!handsStatus.showMessage) {
          handsPanel.hide();
          handsPanelVersion = handsStatus.version;
        } else {
          const pose = frame && refSpace ? frame.getViewerPose(refSpace) : undefined;
          if (handsPanel.placed || pose) {
            if (pose && !handsPanel.placed) {
              const p = pose.transform.position;
              head[0] = p.x;
              head[1] = p.y;
              head[2] = p.z;
              handsPanel.anchor(head, pose.transform.orientation);
            }
            handsPanel.show(handsStatus.message, 0);
            handsPanelVersion = handsStatus.version;
          }
        }
      }
      if (!mock && frame && refSpace && refSpace !== resetWatched) {
        // Recentring moves the player's frame: recalibrate the rig from the new head pose.
        refSpace.addEventListener('reset', () => (rigCalibratedFromHead = false));
        resetWatched = refSpace;
      }
      if (!rigCalibratedFromHead && !mock && frame && refSpace) {
        const pose = frame.getViewerPose(refSpace);
        if (pose) {
          headMatrix.fromArray(pose.transform.matrix).premultiply(this.world.player.matrixWorld);
          headMatrix.decompose(headPos, headRot, headScale);
          const placed = placeRig([headPos.x, headPos.y, headPos.z], yawOf(headRot.x, headRot.y, headRot.z, headRot.w));
          if (placed && !pose.emulatedPosition) rigCalibratedFromHead = true;
        }
      }
      if (rigPlaced) {
        try {
          const tableY = headPos.y - 0.45;
          const candleAction = candleView.updateInteraction(hands.hands, delta, tableY);
          if (candleAction.state === 'held' || candleAction.justPlaced) {
            lantern[0] = candleView.group.position.x;
            lantern[1] = candleView.group.position.y;
            lantern[2] = candleView.group.position.z;
          }
        } catch (e) {
          failures.report('candle pickup', e);
        }
        timings.begin(SLOT.shadow);
        try {
          projector.update(hands.hands, stage, candleView.flamePosition);
          if (!paused) gameAudio.onShapeEvents(shapes.events, projector.shadows, stage);
          shadowRenderer.update(projector.shadows, stage, sharpen.look, candleView.occlusion);
          debug?.frame(rigPlaced);
        } catch (e) {
          failures.report('shadows', e);
        }
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
      if (paused) simWasPaused = true;
      else {
        try {
          // Back from a pause (headset off, system menu): drop the stale remainder, so the first frame back does not
          // replay it (docs/SIMULATION.md).
          if (simWasPaused) {
            simWasPaused = false;
            sim.reset();
          }
          if (debug) debug.time.advance(sim, delta);
          else sim.advance(delta);
        } catch (e) {
          failures.report('simulation', e);
        }
      }
      // The stand-in lantern burns once the rig is placed; Teammate B's lantern flow will set `lit` and the position.
      try {
        lanternLight.update(clock, rigPlaced ? candleView.flamePosition : null, true);
        world.camera.getWorldQuaternion(cameraQuat);
        stageView.applyLight(lanternLight.light, cameraQuat, candleView.occlusion);
        candleView.update(lanternLight.light, cameraQuat);
        lab?.applyLight(lanternLight.light, cameraQuat);
      } catch (e) {
        failures.report('lighting', e);
      }
      timings.begin(SLOT.audio);
      try {
        world.camera.updateWorldMatrix(true, false);
        const m = world.camera.matrixWorld.elements;
        audioPose[0] = m[12];
        audioPose[1] = m[13];
        audioPose[2] = m[14];
        audioPose[3] = -m[8];
        audioPose[4] = -m[9];
        audioPose[5] = -m[10];
        audioPose[6] = m[4];
        audioPose[7] = m[5];
        audioPose[8] = m[6];
        gameAudio.setFlame(rigPlaced && lanternLight.light.lit, candleView.flamePosition);
        audio.update(audioPose);
      } catch (e) {
        failures.report('audio', e);
      }
      timings.end(SLOT.audio);
      try {
        occluder.update(handList);
        timings.begin(SLOT.handVisual);
        handVisual.object.visible = !passthrough && handFlags.handVisual;
        handVisual.update(handList, step, rigPlaced ? candleView.flamePosition : null, !paused);
        timings.end(SLOT.handVisual);
      } catch (e) {
        failures.report('hands drawing', e);
      }
      timings.begin(SLOT.lab);
      try {
        lab?.frame();
      } catch (e) {
        failures.report('hand lab', e);
      }
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
        handsStatus,
        visibility,
        saves,
        settings,
        settingsPanel,
        stageView,
        shadowRenderer,
        openSettings,
        shapes,
        gestures,
        projector,
        stage,
        stageFrame,
        occluder,
        sharpen,
        lanternLight,
        candleView,
        audio,
        gameAudio,
        debug,
        sim,
        getRecorder: () => recorder,
        handVisual,
        probe: (points: readonly (readonly number[])[]) =>
          probePixels(world.renderer, world.scene, world.camera, points),
      },
    });
}
