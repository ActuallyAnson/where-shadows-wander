// Composition root. IWSDK owns the XR session, renderer and display loop; one
// driver system hands each frame to our code. Pure code (src/engine/hands,
// src/engine/stage) never imports IWSDK or three.js; this is enforced by
// ESLint (eslint.config.js). See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
//
// What runs (docs/adr/0016-story-shadow-theatre.md): the bedroom, lighting the candle, the hands' shadows on the
// wall, and covering the flame to pause. The story told in shadow puppets on the wall comes next.
import {
  AmbientLight,
  AssetManager,
  AssetType,
  Color,
  Matrix4,
  Quaternion,
  Vector3,
  World,
  createSystem,
} from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { DEBUG_TOOLS } from '../debug/debug-flag';
import type { DebugTools } from '../debug/debug-tools';
import { Diagnostics } from '../debug/diagnostics';
import { CandleView } from '../engine/render/candle-view';
import { TitleLighterView } from '../engine/render/title-lighter-view';
import { BedTrayView } from '../engine/render/room/bed-tray-view';
import { BedroomView } from '../engine/render/room/bedroom-view';
import { RoomDressingView } from '../engine/shadow/room-dressing-view';
import { GestureDetector } from '../engine/hands/gesture-detector';
import { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { LanternLightModel } from '../engine/shadow/pure/lantern-light';
import { ShadowSharpen } from '../engine/shadow/pure/shadow-sharpen';
import { ShadowProjector } from '../engine/shadow/pure/shadow-projector';
import { REAL_WALL_SHADOW_SETTINGS } from '../engine/shadow/pure/real-wall';
import { loadTesting, MENU_CHOICES, nextChoice, TESTING_EVENT, type MenuChoice } from './testing-options';
import { MenuPanel } from '../ui/menu-panel/menu-panel';
import { WallPauseView } from '../ui/menu-panel/wall-pause-view';
import type { MenuScreenId } from '../ui/menu-panel/screens';
import type { StagePlane } from '../engine/shadow/pure/stage-plane';
import { JOINT } from '../engine/hands/hand';
import { MOCK_HEAD, placeLantern, yawOf } from '../engine/shadow/pure/test-rig';
import { FrameInspector } from './frame-inspector';
import { HandTrailView } from '../engine/shadow/hand-trail-view';
import { QualityGovernor } from '../engine/shadow/pure/quality-governor';
import { StoryLineView } from '../engine/shadow/story-line-view';
import { PuppetView } from '../engine/shadow/puppet-view';
import { SkipTouch } from '../engine/shadow/pure/skip-touch';
import { ScenePlayer } from '../engine/stage/puppet/scene-player';
import { PROLOGUE_SCENE } from '../engine/stage/puppet/prologue-scene';
import type { Cue } from '../engine/stage/puppet/puppet-scene';
import { Bus } from '../engine/services/audio/mixer';
import { DEFAULT_SHADOW_OPACITY, ShadowRenderer } from '../engine/shadow/shadow-renderer';
import { BACKDROP, TestStageView } from '../engine/shadow/test-stage-view';
import { GameAudio } from '../engine/services/audio/game-audio';
import { CaptioningPlayer } from '../engine/services/audio/sound-captions';
import { startSoundPrerender } from '../engine/services/audio/sound-prerender';
import { renderJob, type RenderedSound, type RenderJob } from '../engine/services/audio/sound-render-job';
import { TaskPool, type WorkerLike } from '../engine/services/workers/task-pool';
import { AudioEngine, type SessionEvents } from '../engine/services/audio/web-audio-engine';
import { attachSaveHooks } from '../engine/services/saves/save-hooks';
import { SaveManager } from '../engine/services/saves/save-manager';
import { browserStore, MemoryStore } from '../engine/services/saves/storage';
import { StageFrame } from '../engine/stage/stage-frame';
import { lightArea } from '../engine/shadow/stage-edge-glsl';
import { CandleLight } from '../engine/shadow/candle-light';
import { SettingsStore } from '../engine/services/settings/settings-store';
import { shortenAssetTimeout } from '../engine/services/assets/iwsdk-assets';
import { RoomModels } from '../engine/shadow/room-models';
import { PlacedModels, type ModelLoader } from '../engine/shadow/placed-models';
import { BEDROOM_LAYOUT_FILE, BEDROOM_PIECE_IDS, readBedroomLayout } from '../engine/shadow/bedroom-layout';
import assetManifest, { assetFiles } from './assets';
import { CapabilityDetector } from '../engine/xr/capabilities';
import { CapsuleHandVisual, type HandVisual } from '../engine/xr/hand-visual';
import { HandsStatus, MAX_STEP_S } from '../engine/xr/hands-status';
import { HandRecorder, offerDownload } from '../engine/xr/hand-recorder';
import { disableIwsdkRays, hideIwsdkHandMeshes } from '../engine/xr/iwsdk-input-visuals';
import { PromptPanel } from '../engine/xr/prompt-panel';
import { clearFor } from '../engine/xr/session-mode';
import { SessionVisibility } from '../engine/xr/session-visibility';
import { XRHandReader } from '../engine/xr/xr-hands';
import { DeskFrame } from '../input-mock/desk-frame';
import { HandLab } from '../input-mock/hand-lab';
import { MockMode } from '../input-mock/mock-mode';
import { SyntheticSource } from '../input-mock/synthetic-source';
import { createSettingsPage } from '../ui/settings-panel/settings-page';
import { SettingsScreen } from '../ui/settings-panel/settings-screen';
import { FailureReporter } from './failure-reporter';
import { FrameTimings, SLOT } from './frame-timings';
import { mountEnterArButtonIfNeeded, type LauncherHooks } from './enter-ar-button';
import { captureOptions, loadCaptureChoice } from './capture-mode';
import { createUiSound } from './ui-sound';
import { HAND_LAB_EVENT, isDeskMode, loadLaunch, switchLaunch, updateLaunch } from './launch-mode';
import { reportSource } from './report-source';
import { showNoXrNoticeIfNeeded } from './no-xr-notice';
import { hideEmulatorOfferBar } from './emulator-offer';
import { hideEmulatorInputSwitch, useEmulatorHands, type EmulatedDeviceLike } from './emulator-hands';
import { showStartFailure } from './start-failure';

const HANDS_STATE_NAMES = ['tracking', 'lost', 'unavailable'] as const;

// What the page starts as (launch-mode.ts, ADR 0018): the game, always in a session (a headset, or the emulator at a desk),
// played by the device's hands or, switched live in the Hand Lab panel, by mock ones; or the dev room editor, the one desk
// mode, with no session. The address is always the plain page; the choice is kept in the tab and changed from the page.
const launch = loadLaunch(DEBUG_TOOLS);
const desk = isDeskMode(launch.mode);

/** The rate the browser will run audio at, so the sounds made ahead are made at it (a mismatch would waste them). */
function audioContextRate(): number {
  try {
    const probe = new AudioContext();
    const rate = probe.sampleRate;
    void probe.close();
    return rate;
  } catch {
    return 48000;
  }
}
const diagnostics = new Diagnostics();
// One part of the frame throwing must not stop the rest, or the next frame (failure-reporter.ts).
const failures = new FailureReporter((message) => diagnostics.error(message));
// The "Copy report" panel is a debug tool: only in dev and tester builds (src/debug/debug-flag.ts).
if (DEBUG_TOOLS) void import('../debug/report-panel').then((m) => m.mountReportPanel(diagnostics));
// The room editor runs on any browser, so it skips the "open this on a headset" notice.
if (!desk) void showNoXrNoticeIfNeeded();

// No top-level await here: IWSDK lazily imports a chunk that imports back from
// this one, and a suspended top-level await deadlocks that in production builds.
start().catch((e) => {
  diagnostics.error(`start failed: ${String(e)}`);
  showStartFailure(e);
});

async function start(): Promise<void> {
  // The game is a virtual room: iwsdk.config.json asks for immersive-vr (ADR 0005).
  const world = await World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions);
  // Dev only: the IWER emulator starts with controllers; this game is hands-only, so start it, and its panel, with hands.
  const emulatedDevice = import.meta.env.DEV ? (window as { IWER_DEVICE?: EmulatedDeviceLike }).IWER_DEVICE : undefined;
  const emulated = !!emulatedDevice;
  if (emulatedDevice) {
    useEmulatorHands(emulatedDevice);
    hideEmulatorInputSwitch(document); // and no switching it to controllers
    // Its "Enter XR" bar repeats the launcher's BEGIN (and the room editor never enters XR): hide it.
    hideEmulatorOfferBar(document);
  }
  // The critical assets have loaded; from here IWSDK gives up on any one request after 8 s, not 30 s.
  shortenAssetTimeout();
  diagnostics.mark('worldCreated');
  // The page's own title screen and Enter VR buttons: the only way in on browsers with no enter prompt (Pico Browser).
  // The title screen's sounds play through the audio engine, which is made further down.
  let uiAudio: AudioEngine | null = null;
  const uiSound = createUiSound(() => uiAudio);
  const launcherHooks: LauncherHooks = {};
  if (!desk) void mountEnterArButtonIfNeeded(world, uiSound, launcherHooks);
  disableIwsdkRays(world);

  const hands = new XRHandReader();
  // What the session provides (hands, passthrough, planes, anchors), and the detected planes for StageFrame.
  const capabilities = new CapabilityDetector();
  // Whether hand data is arriving (tracking, lost, or unavailable), for the in-scene "Show me your hands" message.
  const handsStatus = new HandsStatus();
  // The session's visibility: the frame holds still on it and saves can listen to it.
  const visibility = new SessionVisibility();
  // The save (the settings), read once now and written only on events (headset off, page hidden), never per frame.
  // A desk session (the emulator, mock hands, the room editor) keeps its own save, so development never touches a real one.
  const saves = new SaveManager({
    store: browserStore() ?? new MemoryStore(),
    prefix: emulated || desk || launch.hands !== 'device' ? 'wsw.save.mock' : 'wsw.save',
    onError: (message) => diagnostics.error(`save: ${message}`),
  });
  saves.load();
  saves.touchDay();
  attachSaveHooks(saves, visibility, { window, document });

  // Shape recognition on both hands every frame; the story will listen to its commits.
  const shapes = new ShapeRecognizer();
  // Lantern gestures. The cover-flame gesture waits for the lantern flow: the candle sits in the lap, where a resting fist
  // would read as "pause" (covering the flame is read by CandleView instead).
  const gestures = new GestureDetector();
  gestures.setLantern(null);
  let clock = 0;

  // Hand shadows land on the stage: StageFrame, the virtual room's paper wall, 2 m ahead and 1.6 x 1.0 m (ADR 0005). The
  // room editor uses the same wall as a headset; only where the head comes from differs.
  // Capture mode (five taps on the title's emblem, or the Testing panel): a clean session for recording the demo video (capture-mode.ts). The eye buffers' scale has to be set
  // before the session starts, so it is set here; the foveation is set when the session starts.
  const capture = captureOptions(loadCaptureChoice());
  if (capture.enabled && capture.scale !== null) world.renderer.xr.setFramebufferScaleFactor(capture.scale);
  const lastHead = new Float64Array(3);
  const saucerPos = new Float64Array(3);
  let lastYaw = 0;
  const stageFrame = new StageFrame();
  const stage: StagePlane = stageFrame;
  const lantern = new Float64Array(3);
  // The wall's shadow settings are in real-wall.ts (blend 0.65, a low edge blur).
  const projector = new ShadowProjector(REAL_WALL_SHADOW_SETTINGS);
  const shadowRenderer = new ShadowRenderer();
  // On the room's wall the stage is the middle of the candle's round pool of light, drawn over most of the wall (stage-edge-glsl.ts).
  const lightPoolArea = new Float64Array(4);
  // Each hand's shadow sharpens as its shape is recognised (candidate), and snaps crisp on commit.
  const sharpen = new ShadowSharpen();
  // Each hand's classifier state, made once: a new object here every frame is garbage in a headset.
  const handStates = { left: shapes.left.state, right: shapes.right.state };
  // The lantern's flicker: the Developer panel's flicker switch (0..1, 0 is steady) overrides it for testing; the default is
  // gentler under reduced motion.
  const flickerTest = DEBUG_TOOLS ? loadTesting().flicker : null;
  const flickerParam = flickerTest ?? NaN;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lanternLight = new LanternLightModel({
    amplitude: Number.isFinite(flickerParam) ? Math.min(Math.max(flickerParam, 0), 1) : reduceMotion ? 0.3 : 1,
  });
  // Follow the OS reduced-motion setting while the page is open, unless the flicker switch is set.
  if (!Number.isFinite(flickerParam) && typeof matchMedia === 'function')
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      lanternLight.settings.amplitude = e.matches ? 0.3 : 1;
    });
  const cameraQuat = new Quaternion();
  const stageView = new TestStageView();
  stageView.flameVisible = false; // Retired stand-in flame; CandleView renders the procedural candle & flame
  stageView.mood = 0.4; // the wall's warmth: a still evening (the story may set it later)
  const candleView = new CandleView();
  candleView.lit = false;
  const titleLighter = new TitleLighterView();
  // Where the room's static pieces stand (content/rooms/bedroom.json); the dev room editor edits this same object.
  const bedroomLayout = readBedroomLayout();
  for (const p of bedroomLayout.problems) console.warn(`room layout: ${p}`);
  const bedTray = new BedTrayView(bedroomLayout.layout);
  const bedroomView = new BedroomView(bedroomLayout.layout);
  // The room's painted art (wallpaper, shelves, the night in the window, a bookcase, a rug), over Damon's bare room.
  const roomDressing = new RoomDressingView(bedroomLayout.layout);
  bedroomView.group.add(roomDressing.group);
  bedroomView.setWallsCovered(true); // the dressing's painted walls cover them
  bedroomView.strawPalletGroup.visible = false; // the dressing has a fuller bed in its place
  // The candle as a real light for the room: everything in it is lit per pixel by the flame, and the props cast baked shadows.
  const candleLight = new CandleLight();
  roomDressing.useCandleLight(candleLight);
  bedroomView.useCandleLight(candleLight);
  bedTray.useCandleLight(candleLight);
  // Real furniture (Kenney's Furniture Kit, CC0) wherever its .glb is in src/assets/models; the painted pieces stay where one is not.
  const roomModels = new RoomModels(
    (id) => id in assetManifest,
    (part) => roomDressing.hideStandIn(part),
    bedroomLayout.layout,
  );
  roomDressing.group.add(roomModels.group);
  // The globe's glow on the bookcase follows the bookcase model wherever the layout puts it.
  void roomModels.load(candleLight).then(() => {
    for (const piece of roomModels.editables()) roomDressing.follow(piece);
  });
  // Models placed with the room editor (layout entries that name a `model`), loaded through the asset manifest, in the
  // room or on the lap.
  const manifestModels: ModelLoader = async (id) => {
    const entry = (assetManifest as Record<string, { type?: unknown } | undefined>)[id];
    if (!entry || entry.type !== AssetType.GLTF) return null;
    await AssetManager.loadGLTFById(id);
    return AssetManager.getGLTF(id)?.scene ?? null;
  };
  const placedModels = new PlacedModels(
    { room: roomDressing.group, lap: bedTray.group },
    manifestModels,
    bedroomLayout.layout,
  );
  void placedModels.load(candleLight);
  type SessionState = 'title_vr' | 'playing' | 'paused';
  let sessionState: SessionState = 'title_vr';
  let ignitionHoldTimer = 0;
  /**
   * Before the candle is first lit, the moon's light is this many times its night level (below 1: darker than the night, so
   * the waiting candle's small pool of light stands out more; above 1: lighter). Once the candle catches it eases to the night
   * level over MOON_SETTLE_S, under the candle's own light spreading out. The candle's pool: WAITING_GLOW in
   * room-dressing-view.ts.
   */
  const START_MOON_LIFT = 0.35;
  const MOON_SETTLE_S = 3;
  let moonLift = START_MOON_LIFT;
  // The moon's faint blue light, the same all night (the candle adds its own light; it never replaces this).
  const ambientLight = new AmbientLight(0x101422, 0.008);
  // The captions (a setting): a small line of ink low on the wall that names the sounds.
  const captionLine = new StoryLineView({ y: 0.27, width: 0.4 });
  // The puppet story (ADR 0016): for now its first scene, the prologue, played on the wall a moment after the candle is lit, once
  // a session (and again from `__wsw.playPrologue()` in dev). Its title and line are written in ink by two lines of their own.
  const prologue = new ScenePlayer(PROLOGUE_SCENE);
  const puppets = new PuppetView();
  puppets.load(PROLOGUE_SCENE);
  const storyTitle = new StoryLineView({ y: 0.42, width: 0.72 });
  const storyLine = new StoryLineView({ y: 0.3, width: 0.36 });
  const storySkip = new SkipTouch();
  /** Seconds left before the prologue starts (it waits for the candle's light to spread), or -1: not waiting. */
  const PROLOGUE_AFTER_LIGHT_S = 1.8;
  let prologueWait = -1;
  let prologuePlayed = false;
  const onStoryCue = (cue: Cue) => {
    if (cue.kind === 'note') gameAudio.storyNote(cue.note, stage, 0.42, 0.38);
    else (cue.slot === 'title' ? storyTitle : storyLine).say(cue.text, 0, cue.hold);
  };
  const startPrologue = () => {
    prologueWait = -1;
    prologuePlayed = true;
    storyTitle.clear();
    storyLine.clear();
    prologue.start(onStoryCue);
  };
  const stopPrologue = () => {
    prologueWait = -1;
    prologue.skip();
    storyTitle.clear();
    storyLine.clear();
    puppets.hide();
  };
  const skipTips = new Float32Array(6);
  // The quality governor: when a headset's frames keep running over what its display allows, the decoration switches off a step at a
  // time (and comes back slowly), and the inspector gives the debug bar a line of what a frame costs. It watches only in a headset
  // session: on the desktop the software renderer would trip it for no reason.
  const governor = new QualityGovernor();
  const inspector = new FrameInspector(world.renderer.info, governor);
  let governorOn = false;
  let appliedLevel = 0;
  const handTrail = new HandTrailView();
  /** What the quality level means: the paper's scenery and the rings are switched by it here; the trail is checked where it is used. */
  const applyGovernor = () => {
    appliedLevel = governor.level;
    stageView.backdrop = governor.isOn('backdrop') ? BACKDROP : 0;
    handTrail.ringsOn = governor.isOn('ring');
  };
  const wallPauseView = new WallPauseView();
  world.scene.add(
    stageView.group,
    wallPauseView.group,
    bedroomView.group,
    shadowRenderer.mesh,
    puppets.group,
    storyTitle.group,
    storyLine.group,
    captionLine.group,
    handTrail.group,
    candleView.group,
    titleLighter.group,
    bedTray.group,
    ambientLight,
  );
  let rigPlaced = false;
  let rigCalibratedFromHead = false;
  let everPlaced = false;
  const timings = new FrameTimings();
  // Sound: plain Web Audio (docs/adr/0008-audio.md). It unlocks on the first gesture on the page, or when a
  // headset session starts (which a button press or the browser's enter prompt began).
  const audio = new AudioEngine();
  audio.attachGestureUnlock(document);
  uiAudio = audio;
  // The sounds are made in code; rendering them takes real time on a headset's CPU, so a worker does it ahead while the title
  // screen sits idle, and the engine finds each ready. Without workers the pool does the same on the main thread.
  const whenIdle = (window as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback;
  const soundPool = new TaskPool<RenderJob, RenderedSound>({
    create: () =>
      typeof Worker === 'undefined'
        ? null
        : (new Worker(new URL('../engine/services/audio/sound-render-worker.ts', import.meta.url), {
            type: 'module',
          }) as unknown as WorkerLike),
    size: 1,
    fallback: renderJob,
  });
  (whenIdle ? whenIdle.bind(window) : (fn: () => void) => void setTimeout(fn, 2000))(() => {
    void startSoundPrerender(soundPool, audioContextRate()).then(() => soundPool.dispose());
  });
  const gameAudio = new GameAudio(
    new CaptioningPlayer(
      audio,
      () => settings.value.captions,
      (text) => {
        if (sessionState !== 'playing') return false;
        captionLine.say(text, 0, 1.6);
        return true;
      },
      () => performance.now() / 1000,
    ),
  );
  // Where the listener is: the head's position, forward and up, read from the camera's matrix each frame.
  const audioPose = new Float64Array(9);
  // Sound holds still with the game: the system menu, the headset off, or the page hidden.
  const syncAudioPause = () => audio.setPaused(visibility.paused || document.hidden);
  visibility.subscribe(syncAudioPause);
  document.addEventListener('visibilitychange', syncAudioPause);
  // The accessibility settings (docs/adr/0010-saves.md): loaded from the save, applied live to the recognizer,
  // shadows, lantern and mixer, and saved on change. The lantern flicker follows the device's reduced-motion
  // default until the player moves its slider, and the Developer panel's flicker switch overrides the setting for testing.
  const settings = new SettingsStore(
    { recognizer: shapes, projector, sharpen, lantern: lanternLight, mixer: audio.mixer },
    { applyOnlyWhenChosen: ['flicker'], neverApply: Number.isFinite(flickerParam) ? ['flicker'] : [] },
    saves.data.settings,
  );
  settings.subscribe(() => saves.setSettings(settings.value));
  wallPauseView.setSettingsStore(settings);
  // The title screen's SETTINGS item opens the same settings as a page, before the headset is on.
  const settingsPage = createSettingsPage(settings);
  launcherHooks.openSettings = () => settingsPage.open();
  const applyTextSize = () => {
    captionLine.scale = settings.value.textSize;
  };
  settings.subscribe((key) => {
    if (key === null || key === 'textSize') applyTextSize();
  });
  applyTextSize();
  // High contrast: a bright white wall and fully solid shadows (the room art, when it exists, reads the same setting).
  const applyContrast = () => {
    stageView.highContrast = settings.value.highContrast;
    shadowRenderer.baseOpacity = settings.value.highContrast ? 1 : DEFAULT_SHADOW_OPACITY;
  };
  settings.subscribe((key) => {
    if (key === null || key === 'highContrast') applyContrast();
  });
  applyContrast();
  // The settings screen: pressed with a fingertip. The Hand Lab has a Settings button; in a headset the Testing switch opens it.
  // The debug menu (when the debug tools are on) is extra pages after the settings, built the first time it opens.
  const menu = new MenuPanel(settings);
  world.scene.add(menu.group);
  const settingsPanel = new SettingsScreen(menu, settings, () => debug?.controller.pages() ?? []);
  settingsPanel.onVisibilityChange = (open) => {
    if (!open && sessionState === 'paused') {
      wallPauseView.show();
    }
  };
  const settingsHead = new Vector3();
  const settingsLook = new Vector3();
  const gazeAt = new Vector3();
  const handEye = new Float32Array(3); // where the eyes are, for fading the drawn hands near them
  const gazeDir = new Vector3();
  const openSettings = () => {
    world.camera.getWorldPosition(settingsHead);
    world.camera.getWorldDirection(settingsLook);
    return settingsPanel.open([settingsHead.x, settingsHead.y, settingsHead.z], settingsLook.x, settingsLook.z);
  };
  // The pause screen in the room, shown from the Hand Lab's Menu button or the launcher's Testing panel; a press on Settings opens
  // the settings panel, Resume closes the screen and Leave ends the session.
  const menuTips = new Float32Array(6);
  let menuChoice: MenuChoice = 'off';
  const showMenuChoice = (choice: MenuChoice) => {
    menuChoice = choice;
    if (choice === 'off') menu.hide();
    else void showMenu(choice);
  };
  menu.onReach = () => uiSound.hover();
  menu.onPress = (screen, button) => {
    uiSound.press();
    if (button === 'settings') {
      menu.hide();
      menuChoice = 'off';
      void openSettings();
    } else if (screen === 'pause' && button === 'resume') {
      menu.hide();
      menuChoice = 'off';
      sessionState = 'playing';
      candleView.setLocked(true);
    } else if (screen === 'pause' && button === 'exit') {
      // Back to the browser page: the session ends, and the title is there again.
      menu.hide();
      menuChoice = 'off';
      void world.renderer.xr.getSession()?.end();
    }
  };
  const showMenu = (id: MenuScreenId, line?: string) => {
    world.camera.getWorldPosition(settingsHead);
    world.camera.getWorldDirection(settingsLook);
    return menu.show(id, [settingsHead.x, settingsHead.y, settingsHead.z], settingsLook.x, settingsLook.z, line);
  };
  /** Where mock hands go: the rig placeRig last placed (made with the Hand Lab). */
  let deskFrame: DeskFrame | null = null;
  let badPoseReported = false;
  let headY = 1.2; // the eye height the rig was last placed for; the candle's table is 0.45 m below it
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
    headY = head[1];
    lastHead[0] = head[0];
    lastHead[1] = head[1];
    lastHead[2] = head[2];
    lastYaw = yaw;
    stageFrame.placeInFront(head, yaw);
    placeLantern(head, yaw, lantern);

    const sdx = stage.origin[0] - head[0],
      sdz = stage.origin[2] - head[2];
    const stageDist = Math.sqrt(sdx * sdx + sdz * sdz);
    bedroomView.place(head, yaw, stageDist > 0.5 ? stageDist : 2.0);
    roomDressing.place(stageDist > 0.5 ? stageDist : 2.0);

    // Position bed tray and lap blanket across player's lap
    const trayDist = 0.45;
    const trayX = head[0] - Math.sin(yaw) * trayDist;
    const trayY = Math.max(0.4, head[1] - 0.5);
    const trayZ = head[2] - Math.cos(yaw) * trayDist;
    bedTray.place(trayX, trayY, trayZ, yaw);
    candleLight.rebake(); // the room and the tray moved: their shadows are cast again
    candleLight.aimAt(stage.origin); // its light is thrown at the wall the shadows play on

    bedTray.getCandleSaucerPosition(saucerPos);
    lantern[0] = saucerPos[0];
    lantern[1] = saucerPos[1];
    lantern[2] = saucerPos[2];

    stageView.setPool(lightArea(true, stage.origin[1], stage.width, stage.height, lightPoolArea));
    stageView.place(stage, lantern);
    candleView.place(lantern);

    // The pause menu is drawn on the wall: it lives in the stage's frame.
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    // prettier-ignore
    wallPauseView.group.matrix.set(
      r[0], u[0], n[0], o[0],
      r[1], u[1], n[1], o[1],
      r[2], u[2], n[2], o[2],
      0, 0, 0, 1,
    );
    wallPauseView.group.matrixWorldNeedsUpdate = true;
    deskFrame?.set(head, yaw); // mock hands follow the rig
    rigPlaced = true;
    everPlaced = true;
    return true;
  };
  wallPauseView.group.matrixAutoUpdate = false;
  const headMatrix = new Matrix4();
  const headPos = new Vector3();
  const headRot = new Quaternion();
  const headScale = new Vector3();
  let resetWatched: XRReferenceSpace | null = null;
  // At the desk (the room editor) the player's eyes are the desktop camera; in XR initialize with a default seated rig so the
  // scene is immediately visible, until the head pose places it.
  if (desk) placeRig(MOCK_HEAD, 0);
  else placeRig([0, 1.2, 0], 0);
  // The Hand Lab (debug builds only, in the game): its panel picks whose hands play, live. With a mock source, a HandSource fills
  // the same HandFrames in the session in place of the device's, posed for the desk rig and moved into the wearer's
  // (desk-frame.ts). Made the first time the panel is asked for (the Developer panel, or a reload that had it).
  let mock: MockMode | null = null;
  let lab: HandLab | null = null;
  const openLab = (): HandLab => {
    if (lab) return lab;
    mock = new MockMode(new SyntheticSource());
    deskFrame = new DeskFrame();
    deskFrame.set(lastHead, lastYaw);
    // The lab's lantern is the candle on the tray: `lantern` is where placeRig (and picking the candle up) put it.
    lab = new HandLab(mock, hands.hands, shapes, gestures, lantern, deskFrame, {
      settings: {
        toggle: () => (settingsPanel.isOpen ? settingsPanel.close() : void openSettings()),
        isOpen: () => settingsPanel.isOpen,
      },
      menu: {
        cycle: () => showMenuChoice(nextChoice(MENU_CHOICES, menuChoice)),
        label: () => menuChoice,
      },
      // The lab remembers its source and whether it shows, for the next reload in this tab.
      onSourceKind: (kind) => updateLaunch({ hands: kind }, DEBUG_TOOLS),
      hide: () => showLab(false),
    });
    return lab;
  };
  const showLab = (on: boolean) => {
    if (on) openLab().show(true);
    else lab?.show(false);
    updateLaunch({ lab: on }, DEBUG_TOOLS);
  };
  if (DEBUG_TOOLS && !desk) {
    if (launch.lab || launch.hands !== 'device') {
      const l = openLab();
      l.show(launch.lab);
      void l.start(launch.hands);
    }
    window.addEventListener(HAND_LAB_EVENT, (e) => showLab((e as CustomEvent<boolean>).detail));
  }
  const handList = [hands.hands.left, hands.hands.right];
  // The hands as the player sees them in the room (swap this one line for another look). Shown in VR (whoever's hands they
  // are); over passthrough the real hands are visible, so it hides itself.
  const handVisual: HandVisual = new CapsuleHandVisual();
  let passthrough = false; // set from the session's blend mode: over passthrough the real hands are visible
  world.scene.add(handVisual.object);
  // Debug tools (src/debug, ADR 0012, getting-started section 17): only when DEBUG_TOOLS is on (the dev server, or a build made with
  // `vite build --mode tester`), and loaded on demand, so a normal build does not contain them. `debug` is null otherwise.
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
      readout: () => (inspector.line ? `${timings.line} · ${inspector.line}` : timings.line),
      flame: () => (rigPlaced ? candleView.flamePosition : null),
    });
    debug.controller.subscribe(() => settingsPanel.refreshExtra()); // a key press changes the menu's text too
  }
  // The room editor (src/debug/room-editor.ts), chosen in the Developer panel: arranges the bedroom's static pieces in the
  // Hand Lab and saves them to content/rooms/bedroom.json. Debug builds only, loaded on demand like the other debug tools.
  let roomEditor: import('../debug/room-editor').RoomEditor | null = null;
  if (DEBUG_TOOLS && launch.mode === 'room-editor') {
    const { RoomEditor } = await import('../debug/room-editor');
    roomEditor = new RoomEditor({
      camera: world.camera,
      canvas: world.renderer.domElement,
      scene: world.scene,
      room: bedroomView.group,
      eyeHeight: () => lastHead[1],
      sources: [
        { label: 'Furniture', source: roomModels },
        { label: 'Dressing', source: roomDressing },
        { label: 'Room', source: bedroomView },
        { label: 'Tray', source: bedTray },
      ],
      placed: placedModels,
      knownIds: BEDROOM_PIECE_IDS,
      layout: bedroomLayout.layout,
      fileName: BEDROOM_LAYOUT_FILE,
      assetFiles,
      roomRoots: [bedroomView.group, bedTray.group, candleView.group],
      // Closing the editor leaves for the game (its desk has nothing else on it).
      suspendDesk: (on) => {
        if (!on) switchLaunch('game', DEBUG_TOOLS);
      },
    });
    // The candle stands on the tray: when the tray moves, the rig is placed again so the candle (the light) follows it.
    bedTray.onPieceMoved = () => {
      if (rigPlaced) placeRig(lastHead, lastYaw);
    };
    roomEditor.show();
  }

  // addSource keeps only one source, so everything we report goes through it.
  diagnostics.addSource(() => ({
    ...reportSource({
      handReadMethod: hands.method,
      mockSource: mock ? mock.source.name : null,
      capabilities,
    }),
    saves: { ...saves.status },
    capture: capture.enabled ? { foveation: capture.foveation, scale: capture.scale } : null,
    settings: { ...settings.value, panelOpen: settingsPanel.isOpen, panelError: settingsPanel.lastError },
    frameErrors: failures.toJSON(),
    interaction: {
      sessionState,
      candleLocked: candleView.isLocked,
      palmOverFlame: candleView.isCovered,
      coverProgress: candleView.coverProgress,
      wallPauseActive: wallPauseView.visible,
      titleLighterActive: titleLighter.visible,
      handVisualScale: 0.68,
    },
    shapes: { commits: { ...shapes.commits }, droppedEvents: shapes.events.dropped },
    gestures: { ...gestures.counts, droppedEvents: gestures.events.dropped },
    perf: timings.toJSON(),
    render: renderReport(),
    shadow: {
      stage: 'real',
      placed: rigPlaced,
      everPlaced,
      // Where the real wall landed, to read from a headset report.
      wall: {
        origin: [stage.origin[0], stage.origin[1], stage.origin[2]],
        version: stageFrame.version,
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
    guard('sessionstart: quality', () => {
      governor.reset();
      governor.setRefreshRate((session as { frameRate?: number } | null)?.frameRate ?? 72);
      // Not under the emulator: a desktop's display rate (60 Hz, under the headset's 72) would trip it for no reason, and the
      // desk would then show less of the room than a headset does.
      governorOn = !!session && !emulated;
      applyGovernor();
    });
    if (capture.enabled) guard('sessionstart: capture', () => world.renderer.xr.setFoveation?.(capture.foveation));
    // A session started from the browser's own enter prompt gives the page no click; a pinch in it still unlocks.
    if (session)
      guard('sessionstart: audio session unlock', () => audio.attachSessionUnlock(session as unknown as SessionEvents));
    if (session) {
      guard('sessionstart: display', () => {
        passthrough = session.environmentBlendMode !== undefined && session.environmentBlendMode !== 'opaque';
        const clear = clearFor(session.environmentBlendMode);
        world.scene.background = clear.background === null ? null : new Color(clear.background);
        world.renderer.setClearColor(clear.background ?? 0x000000, clear.alpha);
      });
      guard('sessionstart: diagnostics', () => diagnostics.sessionStarted(session, world.renderer));
    }
    if (session) {
      guard('sessionstart: capabilities', () => capabilities.sessionStarted(session));
      guard('sessionstart: hands status', () => handsStatus.start());
    }
    if (session) guard('sessionstart: visibility', () => visibility.attach(session));
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    guard('sessionend: quality', () => {
      governorOn = false;
      governor.reset();
      applyGovernor();
    });
    guard('sessionend: display', () => {
      world.scene.background = null;
      world.renderer.setClearColor(0x000000, 0);
      passthrough = false;
    });
    guard('sessionend: wall', () => {
      rigCalibratedFromHead = false;
      placeRig([0, 1.2, 0], 0);
    });
    guard('sessionend: state', () => {
      sessionState = 'title_vr';
      ignitionHoldTimer = 0;
      moonLift = START_MOON_LIFT;
      candleView.ignitionProgress = 0;
      candleView.lit = false;
      candleView.setLocked(false);
      titleLighter.visible = false;
      wallPauseView.hide();
      stopPrologue();
      prologuePlayed = false;
    });
    guard('sessionend: diagnostics', () => diagnostics.sessionEnded());
    guard('sessionend: capabilities', () => capabilities.sessionEnded());
    guard('sessionend: hands status', () => handsStatus.stop());
    // Hands are only read inside a session, so without this they would keep their last pose on the 2D page.
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

  let recorder: HandRecorder | null = null;
  const head: [number, number, number] = [0, 0, 0];
  const headTurn = { x: 0, y: 0, z: 0, w: 1 };
  // Guided recording on a headset: prompts on a panel in front of the wearer,
  // placed on the first XR frame and again when recording starts.
  // The head pose is in reference space, which is the XR origin's space.
  let panel: PromptPanel | null = null;
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
    const applyOverlays = (t: { joints: boolean; shadow: boolean }) => {
      tools.showOverlay('capsules', t.shadow);
      tools.showOverlay('joints', t.joints);
    };
    applyOverlays(loadTesting());
    showMenuChoice(loadTesting().menu);
    window.addEventListener(TESTING_EVENT, (e) => {
      const t = (e as CustomEvent<ReturnType<typeof loadTesting>>).detail;
      applyOverlays(t);
      showMenuChoice(t.menu);
    });
    world.renderer.xr.addEventListener('sessionstart', () => {
      const t = loadTesting();
      if (t.settings) setTimeout(() => void openSettings(), 1000);
      armRecording(t.record);
    });
  }
  // The "Show me your hands" message: a second panel, in front of the wearer when it appears.
  // Capture mode keeps this message out of a recording: it would show whenever tracking drops mid-take.
  const handsPanel = capture.enabled ? null : new PromptPanel();
  if (handsPanel) world.player.add(handsPanel.mesh);
  let handsPanelVersion = handsStatus.version;

  /** True while any controller button is down. Indexed loops, so no iterator or closure is made in the frame. */
  const controllerPressed = (frame: XRFrame): boolean => {
    const sources = frame.session.inputSources;
    for (let i = 0; i < sources.length; i++) {
      const buttons = sources[i].gamepad?.buttons;
      if (!buttons) continue;
      for (let j = 0; j < buttons.length; j++) if (buttons[j].pressed) return true;
    }
    return false;
  };
  /** Lights the candle: the room warms and the hands' shadows come onto the wall. */
  const igniteCandle = () => {
    sessionState = 'playing';
    ignitionHoldTimer = 0;
    candleView.ignitionProgress = 0;
    roomDressing.ignition = 0;
    candleView.lit = true;
    candleView.setLocked(true);
    titleLighter.visible = false;
    gameAudio.candleIgnited(candleView.flamePosition);
    if (!prologuePlayed) prologueWait = PROLOGUE_AFTER_LIGHT_S;
  };

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
      // Only the room editor draws with no session.
      if (!frame && !desk) {
        timings.end(SLOT.total);
        timings.endFrame();
        return;
      }
      // What the frame cost, and whether it is time to switch some decoration off (or back on).
      inspector.update(delta * 1000);
      if (governorOn && !visibility.paused) governor.update(delta * 1000);
      if (governor.level !== appliedLevel) applyGovernor();
      // The headset's system menu (visible-blurred) or a hidden page: no hand data arrives and the game holds still.
      const paused = visibility.paused;
      // The first frame after the headset was off carries the whole gap; these do not clamp their own.
      const step = Math.min(delta, MAX_STEP_S);
      const shadowsVisible = candleView.lit && sessionState === 'playing';
      timings.begin(SLOT.read);
      if (debug?.replay.active) {
        // A recorded session stands in for the hands (the debug menu, Alt+R); the hands cue sees them as tracked.
        debug.replay.fill(step, hands.hands.left, hands.hands.right);
        handsStatus.update(step, true, 1);
      } else if (mock && lab?.mockActive && frame) {
        // The Hand Lab's hands, in the session in place of the device's: the lab records them as posed (the desk rig's space),
        // then they move into the wearer's rig. The hands cue sees them like any tracked hands.
        if (!paused) {
          mock.update(delta, hands.hands.left, hands.hands.right);
          try {
            lab?.frame();
          } catch (e) {
            failures.report('hand lab', e);
          }
          deskFrame?.toRig(hands.hands.left);
          deskFrame?.toRig(hands.hands.right);
          handsStatus.update(step, hands.hands.left.tracked || hands.hands.right.tracked, 1);
        }
      } else if (frame && refSpace && !paused) {
        hands.update(frame, refSpace, this.world.player.matrixWorld);
        capabilities.update(frame, refSpace, hands.hands, this.world.player.matrixWorld.elements, performance.now());
        handsStatus.update(step, hands.hands.left.tracked || hands.hands.right.tracked, hands.handSources);
      }
      if (frame && refSpace) hideIwsdkHandMeshes(this.world);
      timings.end(SLOT.read);
      // Mock time with mock hands, so pausing the Hand Lab freezes holds too.
      if (!paused) clock += step;
      const handsT = mock && lab?.mockActive ? mock.time : clock;
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
      if (frame && refSpace && refSpace !== resetWatched) {
        // Recentring moves the player's frame: recalibrate the rig from the new head pose.
        refSpace.addEventListener('reset', () => (rigCalibratedFromHead = false));
        resetWatched = refSpace;
      }
      if (!rigCalibratedFromHead && frame && refSpace) {
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
          const candleAction = candleView.updateInteraction(hands.hands, step, headY - 0.45);
          if (candleAction.justPickedUp || candleAction.justPlaced)
            gameAudio.candleMoved(candleAction.justPickedUp, candleAction.justPlaced, candleView.flamePosition);
          if (candleAction.state === 'held' || candleAction.justPlaced) {
            lantern[0] = candleView.group.position.x;
            lantern[1] = candleView.group.position.y;
            lantern[2] = candleView.group.position.z;
          }
        } catch (e) {
          failures.report('candle pickup', e);
        }
        world.camera.getWorldQuaternion(cameraQuat);
        if (sessionState === 'title_vr') {
          titleLighter.visible = true;
          titleLighter.update(hands.hands.right, cameraQuat, clock);

          // Only the matchstick's flame lights the candle: a bare hand near the wick does not.
          let handTouchingWick = false;
          if (hands.hands.right.tracked && hands.hands.right.validJoints >= 5) {
            const lfx = titleLighter.flamePosition[0];
            const lfy = titleLighter.flamePosition[1];
            const lfz = titleLighter.flamePosition[2];
            const cfx = candleView.flamePosition[0];
            const cfy = candleView.flamePosition[1];
            const cfz = candleView.flamePosition[2];
            const dlx = lfx - cfx,
              dly = lfy - cfy,
              dlz = lfz - cfz;
            if (dlx * dlx + dly * dly + dlz * dlz < 0.15 * 0.15) {
              handTouchingWick = true;
            }
          }
          // The room editor has no hands: its room is lit, as the editor needs to see it.
          if (!handTouchingWick && desk) handTouchingWick = true;

          if (handTouchingWick) {
            ignitionHoldTimer = Math.min(3.0, ignitionHoldTimer + step);
          } else {
            ignitionHoldTimer = Math.max(0.0, ignitionHoldTimer - step * 2.0);
          }

          const ignitionProgress = ignitionHoldTimer / 3.0;
          candleView.ignitionProgress = ignitionProgress;
          roomDressing.ignition = ignitionProgress; // the room starts to glow as the wick is held

          if (ignitionHoldTimer >= 3.0) igniteCandle();
        } else {
          titleLighter.visible = false;
          if (sessionState === 'playing') {
            if (candleView.isCovered) {
              sessionState = 'paused';
              candleView.lit = false;
              candleView.resetCover();
              audio.mixer.setLift(Bus.Ambience, 0.15);
              audio.mixer.setLift(Bus.Music, 0.25);
              wallPauseView.show();
            }
          } else if (sessionState === 'paused') {
            const isControllerTrigger = frame ? controllerPressed(frame) : false;
            const action = wallPauseView.update(handList, stage, isControllerTrigger, step);
            if (action === 'resume') {
              wallPauseView.hide();
              sessionState = 'playing';
              candleView.resetCover();
              candleView.lit = true;
              candleView.setLocked(true);
              audio.mixer.setLift(Bus.Ambience, 1.0);
              audio.mixer.setLift(Bus.Music, 1.0);
              gameAudio.candleIgnited(candleView.flamePosition);
            } else if (action === 'settings') {
              wallPauseView.showSettings();
            }
          }
        }
        timings.begin(SLOT.shadow);
        try {
          shadowRenderer.mesh.visible = shadowsVisible;
          projector.update(hands.hands, stage, candleView.flamePosition);
          if (!paused) {
            gameAudio.onShapeEvents(shapes.events, projector.shadows, stage);
            handTrail.onShapeEvents(shapes.events, projector.shadows);
          }
          shadowRenderer.setPool(lightPoolArea, stageView.flameOnWall.x, stageView.flameOnWall.y);
          shadowRenderer.update(projector.shadows, stage, sharpen.look, shadowsVisible ? candleView.occlusion : 0);
          // The debug tools' shadow switch (Alt+1) holds it hidden: the lines above show it again every frame.
          if (debug && !debug.controller.systems.shadow) shadowRenderer.mesh.visible = false;
          handTrail.update(
            paused ? 0 : step,
            stage,
            projector.shadows,
            shadowsVisible && governor.isOn('trail') ? shadowRenderer.baseOpacity * candleView.occlusion : 0,
          );
          // The captions' line on the wall: it waits while paused and is not shown under a menu.
          const lineOpacity =
            shadowsVisible && !menu.group.visible ? shadowRenderer.baseOpacity * candleView.occlusion : 0;
          captionLine.update(paused || sessionState !== 'playing' ? 0 : step, stage, lineOpacity);
          // The puppet story: it holds still while paused (the flame covered) and its shadows go with the candle's light.
          const storyStep = paused || sessionState !== 'playing' ? 0 : step;
          if (prologueWait >= 0 && storyStep > 0) {
            prologueWait -= storyStep;
            if (prologueWait < 0) startPrologue();
          }
          if (prologue.playing) {
            // A fingertip held on the wall's lower right corner skips it.
            let tips = 0;
            for (const h of handList) {
              if (!h.tracked) continue;
              const o = JOINT['index-finger-tip'] * 3;
              skipTips[tips * 3] = h.positions[o];
              skipTips[tips * 3 + 1] = h.positions[o + 1];
              skipTips[tips * 3 + 2] = h.positions[o + 2];
              tips++;
            }
            if (storyStep > 0 && storySkip.update(storyStep, skipTips, tips, stage)) stopPrologue();
            else {
              prologue.update(storyStep);
              puppets.update(prologue, stage, lineOpacity);
            }
          } else puppets.hide();
          storyTitle.update(storyStep, stage, lineOpacity);
          storyLine.update(storyStep, stage, lineOpacity);
          if (menu.group.visible) {
            // The fingertips that can reach the menu: each tracked hand's index tip.
            let tips = 0;
            for (const h of handList) {
              if (!h.tracked) continue;
              const o = JOINT['index-finger-tip'] * 3;
              menuTips[tips * 3] = h.positions[o];
              menuTips[tips * 3 + 1] = h.positions[o + 1];
              menuTips[tips * 3 + 2] = h.positions[o + 2];
              tips++;
            }
            menu.gazeOn = settings.value.gazeMenus;
            if (menu.gazeOn) {
              world.camera.getWorldPosition(gazeAt);
              world.camera.getWorldDirection(gazeDir);
              menu.setGaze(gazeAt.x, gazeAt.y, gazeAt.z, gazeDir.x, gazeDir.y, gazeDir.z);
            }
            menu.update(step, menuTips, tips);
          }
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
      try {
        lanternLight.update(clock, rigPlaced ? candleView.flamePosition : null, candleView.lit);
        world.camera.getWorldQuaternion(cameraQuat);
        stageView.applyLight(lanternLight.light, cameraQuat, candleView.occlusion, candleView.flamePosition, step);
        world.camera.getWorldPosition(settingsHead);
        stageView.setHead(settingsHead);
        bedroomView.update(lanternLight.light, cameraQuat, candleView.lit ? candleView.occlusion : 0);
        // Waiting to be lit, the candle holds a small, bright pool of light round itself, to draw the eye to it.
        roomDressing.waiting = sessionState === 'title_vr';
        roomDressing.update(lanternLight.light, candleView.lit ? candleView.occlusion : 0, candleView.flamePosition);
        // The room is dark until the candle is lit; then its light spreads out from the flame to the walls, and draws
        // back when the flame is covered (the pause).
        roomDressing.spread(candleView.lit, step);
        if (sessionState !== 'title_vr' && moonLift !== 1) {
          const settle = (step * Math.abs(START_MOON_LIFT - 1)) / MOON_SETTLE_S;
          moonLift = moonLift > 1 ? Math.max(1, moonLift - settle) : Math.min(1, moonLift + settle);
        }
        candleLight.setMoon(moonLift);
        candleLight.bakeIfDirty(world.renderer, world.scene);
        // While paused the snow holds still (the head still moves the layers), and the dust, shaft and sparkles are skipped.
        roomDressing.tick(sessionState === 'paused' ? 0 : step, settingsHead);
        candleView.update(lanternLight.light, cameraQuat);
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
        timings.begin(SLOT.handVisual);
        handVisual.object.visible = !passthrough && handFlags.handVisual;
        world.camera.getWorldPosition(settingsHead);
        handEye[0] = settingsHead.x;
        handEye[1] = settingsHead.y;
        handEye[2] = settingsHead.z;
        const activeHands = sessionState === 'title_vr' ? [] : handList;
        handVisual.update(
          activeHands,
          step,
          rigPlaced && candleView.lit ? candleView.flamePosition : null,
          !paused && sessionState !== 'title_vr',
          handEye,
        );
        timings.end(SLOT.handVisual);
      } catch (e) {
        failures.report('hands drawing', e);
      }
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
        get mock() {
          return mock;
        },
        get lab() {
          return lab;
        },
        capabilities,
        handsStatus,
        visibility,
        saves,
        settings,
        settingsPanel,
        menu,
        showMenu,
        stageView,
        shadowRenderer,
        captionLine,
        soundPool,
        governor,
        inspector,
        handTrail,
        openSettings,
        shapes,
        gestures,
        projector,
        stage,
        stageFrame,
        sharpen,
        lanternLight,
        candleView,
        candleLight,
        audio,
        gameAudio,
        debug,
        getRecorder: () => recorder,
        handVisual,
        bedTray,
        bedroomView,
        roomDressing,
        roomModels,
        placedModels,
        roomEditor,
        wallPauseView,
        sessionState: () => sessionState,
        igniteCandle: () => {
          if (sessionState === 'title_vr') igniteCandle();
        },
        prologue,
        puppets,
        /** Plays the prologue now (the candle must be lit to see it). */
        playPrologue: () => startPrologue(),
      },
    });
}
