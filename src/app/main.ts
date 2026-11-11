// Composition root. IWSDK owns the XR session, renderer and display loop; one
// driver system hands each frame to our code. Pure code (src/engine/hands,
// src/engine/sim, src/engine/stage, src/game) never imports IWSDK or three.js;
// this is enforced by ESLint (eslint.config.js). See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
import {
  AmbientLight,
  Color,
  Group,
  Matrix4,
  Quaternion,
  SessionMode,
  Vector3,
  World,
  createSystem,
} from '@iwsdk/core';
import type { Object3D } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { DEBUG_TOOLS } from '../debug/debug-flag';
import type { DebugTools } from '../debug/debug-tools';
import { Diagnostics } from '../debug/diagnostics';
import { CandleView } from '../engine/render/candle-view';
import { TitleLighterView } from '../engine/render/title-lighter-view';
import { BedTrayView } from '../engine/render/room/bed-tray-view';
import { BedroomView } from '../engine/render/room/bedroom-view';
import { VrTitleView } from '../ui/title-screen/vr-title-view';
import { RoomDressingView } from '../engine/shadow/room-dressing-view';
import { FixturesView } from '../engine/render/fixtures-view';
import { GhostTargetView } from '../engine/render/ghost-target-view';
import { StageRenderer } from '../engine/render/stage-renderer';
import { GestureDetector } from '../engine/hands/gesture-detector';
import { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { LanternLightModel } from '../engine/shadow/pure/lantern-light';
import { ShadowSharpen } from '../engine/shadow/pure/shadow-sharpen';
import { ShadowProjector } from '../engine/shadow/pure/shadow-projector';
import { REAL_WALL_SHADOW_SETTINGS } from '../engine/shadow/pure/real-wall';
import { createSilhouette, projectProp, type Prop } from '../engine/shadow/pure/prop-shadow';
import { SIM_HZ } from '../game/game';
import { NightDriver } from './night-driver';
import { MENU_CHOICES, nextChoice, type MenuChoice } from './testing-options';
import { MenuPanel } from '../ui/menu-panel/menu-panel';
import { WallPauseView } from '../ui/menu-panel/wall-pause-view';
import type { MenuScreenId } from '../ui/menu-panel/screens';
import { createStagePlane, type StagePlane } from '../engine/shadow/pure/stage-plane';
import { JOINT } from '../engine/hands/hand';
import { MOCK_HEAD, placeLantern, placeTestRig, yawOf, type StageMode } from '../engine/shadow/pure/test-rig';
import { CutsceneHost } from './cutscene-host';
import type { CutsceneData } from '../engine/sim/cutscene';
import { ENDING_MOOD } from './ending';
import { OPENING, OPENING_S, openingFoxAlpha } from './opening';
import { SkipTouch } from '../engine/shadow/pure/skip-touch';
import { stagePoint } from '../engine/services/audio/stage-point';
import { FINALE_PAGES, hasSeenPrologue, markPrologueSeen, Prologue, PrologueReel, type PrologueHost } from './prologue';
import { Kindred, SCARE_RADIUS_M, shadowSpot } from '../engine/shadow/pure/kindred';
import { KindredView } from '../engine/shadow/kindred-view';
import { nearestJointGap, STICKER_COUNT, TravellerMood, type StickerId } from '../engine/shadow/pure/traveller-mood';
import { StickerView } from '../engine/shadow/sticker-view';
import { CRYSTAL } from '../engine/shadow/cinematic-art';
import { CinematicScene } from '../engine/shadow/cinematic-scene';
import { WalkSceneView } from '../engine/shadow/walk-scene-view';
import { LAND_OF_PUZZLE } from '../engine/shadow/walk-lands';
import { FrameInspector } from './frame-inspector';
import { CALM_WIND, FAN_WIND } from '../engine/shadow/bunting-view';
import { FadeView } from '../engine/shadow/fade-view';
import { HandTrailView } from '../engine/shadow/hand-trail-view';
import { ReadingPageView } from '../engine/shadow/reading-page-view';
import { PropSketchView } from '../engine/shadow/prop-sketch-view';
import { REWARDS, RewardBurstView } from '../engine/shadow/reward-burst-view';
import { QualityGovernor } from '../engine/shadow/pure/quality-governor';
import { SparkFlightView } from '../engine/shadow/spark-flight-view';
import { StoryLineView } from '../engine/shadow/story-line-view';
import { GlowView } from '../engine/shadow/glow-view';
import { AirView } from '../engine/shadow/air-view';
import { RabbitView } from '../engine/shadow/rabbit-view';
import { PropTouch } from '../engine/shadow/pure/prop-touch';
import { SparkleLayer } from '../engine/shadow/sparkle-layer';
import { Follower, nearMissLevel, SolveBloom } from '../engine/shadow/pure/glow';
import { SHAPES } from '../engine/hands/shapes';
import { Bus } from '../engine/services/audio/mixer';
import { CutsceneView } from '../engine/shadow/cutscene-view';
import { PropShadowView } from '../engine/shadow/prop-shadow-view';
import { DEFAULT_SHADOW_OPACITY, ShadowRenderer } from '../engine/shadow/shadow-renderer';
import { BACKDROP, TestStageView } from '../engine/shadow/test-stage-view';
import { GameAudio } from '../engine/services/audio/game-audio';
import { LevelEditor } from '../debug/level-editor';
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
import { BEDROOM_LAYOUT_FILE, readBedroomLayout } from '../engine/shadow/bedroom-layout';
import assetManifest from './assets';
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
import { createSettingsPage } from '../ui/settings-panel/settings-page';
import { SettingsScreen } from '../ui/settings-panel/settings-screen';
import { probePixels } from './composite-probe';
import { FailureReporter } from './failure-reporter';
import { FrameTimings, SLOT } from './frame-timings';
import { mountEnterArButtonIfNeeded, type LauncherHooks } from './enter-ar-button';
import { captureOptions, loadCaptureChoice } from './capture-mode';
import { endLine } from './journal';
import { MENU_SCREENS } from '../ui/menu-panel/screens';
import { createUiSound } from './ui-sound';
import { mountLabLink } from './lab-link';
import { reportSource } from './report-source';
import { showNoXrNoticeIfNeeded } from './no-xr-notice';
import { showStartFailure } from './start-failure';

const HANDS_STATE_NAMES = ['tracking', 'lost', 'unavailable'] as const;

const mockOptions = mockOptionsFromUrl(location.search);

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
// The game is a virtual room (immersive-vr, ADR 0005). ?xr=ar starts the passthrough mode instead.
const xrMode = xrModeFromUrl(location.search);
const diagnostics = new Diagnostics();
// One part of the frame throwing must not stop the rest, or the next frame (failure-reporter.ts).
const failures = new FailureReporter((message) => diagnostics.error(message));
// The "Copy report" panel is a debug tool: only in dev and tester builds (src/debug/debug-flag.ts).
if (DEBUG_TOOLS) void import('../debug/report-panel').then((m) => m.mountReportPanel(diagnostics));
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
  // The title screen's sounds play through the audio engine, which is made further down.
  let uiAudio: AudioEngine | null = null;
  const uiSound = createUiSound(() => uiAudio);
  const launcherHooks: LauncherHooks = {};
  if (!mockOptions) void mountEnterArButtonIfNeeded(world, uiSound, launcherHooks);
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
  // Capture mode (five taps on the title's emblem, or the Testing panel): a clean session for recording the demo video (capture-mode.ts). The eye buffers' scale has to be set
  // before the session starts, so it is set here; the foveation is set when the session starts.
  const capture = captureOptions(loadCaptureChoice());
  if (capture.enabled && capture.scale !== null) world.renderer.xr.setFramebufferScaleFactor(capture.scale);
  const stageChoice: 'real' | StageMode =
    !mockOptions || params.get('stage') === 'real' ? 'real' : params.get('stage') === 'wall' ? 'wall' : 'table';
  // The Hand Lab's stand-in stage can be switched between the tabletop theatre and a wall-sized one (the Stage button).
  let mockStage: StageMode = stageChoice === 'real' ? 'table' : stageChoice;
  const lastHead = new Float64Array(3);
  const saucerPos = new Float64Array(3);
  let lastYaw = 0;
  const stageFrame = new StageFrame();
  const standInStage = createStagePlane();
  const stage: StagePlane = stageChoice === 'real' ? stageFrame : standInStage;
  const lantern = new Float64Array(3);
  // On the real wall the shadow settings are in real-wall.ts (blend 0.65, a low edge blur); the near, small
  // tabletop theatre was tuned with full perspective (blend 0).
  const projector = new ShadowProjector(stageChoice === 'real' ? REAL_WALL_SHADOW_SETTINGS : { blend: 0.0 });
  const shadowRenderer = new ShadowRenderer();
  // On the room's wall the stage is the middle of the candle's round pool of light, drawn over most of the wall (stage-edge-glsl.ts).
  const lightPoolArea = new Float64Array(4);
  // The shadows of the invisible props (the game's level calls propShadows.setProps when a puzzle loads).
  const propShadows = new PropShadowView();
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
  const vrTitle = new VrTitleView();
  /** Seconds on the VR title, with no sign of lighting the candle, before the riddle appears, and before the plainer line replaces it. */
  const TITLE_HINT_AFTER_S = 6;
  const TITLE_HINT_PLAIN_AFTER_S = 16;
  type SessionState = 'title_vr' | 'opening' | 'playing' | 'paused';
  let sessionState: SessionState = 'title_vr';
  let ignitionHoldTimer = 0;
  let titleStallT = 0; // seconds on the title with the candle not being lit; a hint shows after a while
  // The moon's faint blue light, the same all night (the candle adds its own light; it never replaces this).
  const ambientLight = new AmbientLight(0x101422, 0.008);
  // ?debug=shadow,joints (or repeat ?debug=...): each named view on.
  const debugViews = new Set(params.getAll('debug').flatMap((v) => v.split(',').map((x) => x.trim())));
  // Cutscenes (captions and shadow puppets on the stage); the game's flow calls cutscenes.play(data, onDone).
  const cutsceneView = new CutsceneView();
  const cutscenes = new CutsceneHost(cutsceneView);
  // The kindred (a shadow bird that flies about the wall): the Hand Lab's Kindred button, or the Testing panel's switch.
  const kindred = new Kindred();
  const kindredStartX = 0.4;
  const spot = new Float64Array(2);
  const kindredView = new KindredView();
  // The traveller's moods: a sticker over their head (sad after a fall, happy at the goal, surprised by a near hand, puzzled when kept waiting).
  const travellerMood = new TravellerMood();
  const stickerView = new StickerView();
  // The Hand Lab's level editor, for the puzzle being played.
  const levelEditors = new WeakMap<object, LevelEditor>(); // one per puzzle, so a revert always goes back to how it was written
  const storyLine = new StoryLineView();
  // The captions (a setting): a smaller line of ink low on the wall that names the story's sounds.
  const captionLine = new StoryLineView({ y: 0.27, width: 0.4 });
  const spark = new SparkFlightView();
  // The quality governor: when a headset's frames keep running over what its display allows, the decoration switches off a step at a
  // time (and comes back slowly), and the inspector gives the debug bar a line of what a frame costs. It watches only in a headset
  // session: on the desktop the software renderer would trip it for no reason.
  const governor = new QualityGovernor();
  const inspector = new FrameInspector(world.renderer.info, governor);
  let governorOn = false;
  let appliedLevel = 0;
  const handTrail = new HandTrailView();
  /** What the quality level means: the paper's scenery and the rings are switched by it here; the rest are checked where they are used. */
  const applyGovernor = () => {
    appliedLevel = governor.level;
    stageView.backdrop = governor.isOn('backdrop') ? BACKDROP : 0;
    handTrail.ringsOn = governor.isOn('ring');
  };
  const propSketch = new PropSketchView();
  const readingPage = new ReadingPageView();
  const rewards = new RewardBurstView();
  const sparkFrom = new Vector3();
  const sparkTo = new Vector3();
  const sparkStart = { x: 0, y: 0, z: 0 };
  // The prologue: a black void with the story drawn in white calligraphy. While it plays, everything else in the scene is
  // hidden (and put back after), and the pages float where the player was facing.
  const cinematic = new CinematicScene();
  const hiddenForPrologue: { object: Object3D; visible: boolean }[] = [];
  let backgroundBeforePrologue: typeof world.scene.background = null;
  /**
   * What a full-view scene does to the app: the screen fades to black, the room is hidden and the background made black while the
   * scene plays, and the room is put back through another fade after (so neither way is a hard cut).
   */
  const fade = new FadeView();
  let inVoid = false;
  const voidHost = (scene: {
    enter(head: { x: number; y: number; z: number }, dirX: number, dirZ: number): void;
    leave(): void;
  }): PrologueHost => ({
    enter: () => {
      fade.fadeTo(1, 0.6, () => {
        hiddenForPrologue.length = 0;
        for (const child of world.scene.children) {
          if (child === cinematic.group || child === hall.group || child === walkScene.group || child === fade.group)
            continue;
          hiddenForPrologue.push({ object: child, visible: child.visible });
          child.visible = false;
        }
        backgroundBeforePrologue = world.scene.background;
        world.scene.background = new Color(0x000000);
        inVoid = true;
        // The scene is built around the head, facing the way it faces now.
        world.camera.getWorldPosition(prologueHead);
        world.camera.getWorldDirection(prologueAhead);
        scene.enter(prologueHead, prologueAhead.x, prologueAhead.z);
        fade.fadeTo(0, 0.9);
      });
    },
    leave: () => {
      fade.fadeTo(1, 0.5, () => {
        if (inVoid) {
          for (const h of hiddenForPrologue) h.object.visible = h.visible;
          hiddenForPrologue.length = 0;
          world.scene.background = backgroundBeforePrologue;
          inVoid = false;
        }
        scene.leave();
        fade.fadeTo(0, 0.9);
      });
    },
  });
  // The travel scenes between puzzles: the traveller walks into the next land (and the land it has just left wakes), in the same void.
  const walkScene = new WalkSceneView();
  let travelDemo = 0;
  const walkHost = voidHost(walkScene);
  // The walk's sounds: footsteps in time with the traveller (from ahead of where the head faced), and the sleeper's note as its land wakes.
  const walkPoint = new Vector3();
  const walkAt = () => {
    walkPoint.set(prologueHead.x + prologueAhead.x * 3.6, prologueHead.y - 1.2, prologueHead.z + prologueAhead.z * 3.6);
    return walkPoint;
  };
  walkScene.onStep = (alternate) => {
    const p = walkAt();
    gameAudio.stepAtPoint(p.x, p.y, p.z, alternate);
  };
  walkScene.onWake = () => {
    const p = walkAt();
    const index = Math.max(0, travelRun ? LAND_OF_PUZZLE.indexOf(travelRun.segments[travelRun.at].land) : 0);
    gameAudio.lullabyNote(index, p.x, p.y + 1.2, p.z);
  };
  interface TravelRun {
    segments: { land: (typeof LAND_OF_PUZZLE)[number]; mode: 'arrive' | 'wake' }[];
    at: number;
    dipping: boolean;
    leaving: boolean;
    /** Skip was poked: whatever is left of the walk is dropped. */
    skipRest: boolean;
    resume: SessionState;
  }
  let travelRun: TravelRun | null = null;

  const reducedMotion = () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Plays the walk from puzzle `from` (its land wakes) to puzzle `to` (the traveller walks into its land), if travel scenes are on. */
  const travelTo = (from: number, to: number): 'started' | 'busy' | 'off' => {
    if (travelRun || inVoid || prologue.playing || finale.playing) return 'busy';
    if (!settings.value.travelScenes || reducedMotion()) return 'off';
    const segments: TravelRun['segments'] = [];
    if (from >= 0 && LAND_OF_PUZZLE[from]) segments.push({ land: LAND_OF_PUZZLE[from], mode: 'wake' });
    if (LAND_OF_PUZZLE[to]) segments.push({ land: LAND_OF_PUZZLE[to], mode: 'arrive' });
    if (segments.length === 0) return 'off';
    travelRun = { segments, at: 0, dipping: false, leaving: false, skipRest: false, resume: sessionState };
    sessionState = 'opening'; // the game holds still while the traveller walks
    walkScene.prepare(segments[0].land, segments[0].mode);
    walkHost.enter();
    return 'started';
  };
  /** For the Testing switch: waits while another full-view scene (the first-time opening) is playing, and says in the report why it did not play. */
  const travelWhenFree = (from: number, to: number, triesLeft = 60) => {
    const result = travelTo(from, to);
    if (result === 'busy' && triesLeft > 0) later(() => travelWhenFree(from, to, triesLeft - 1), 500);
    else if (result === 'off')
      diagnostics.error(
        `travel scene did not play: ${settings.value.travelScenes ? 'the device asks for less motion' : 'Travel scenes is off in Settings'}`,
      );
  };
  // The finale plays in the hall of the great crystal, the last thing the night shows.
  const hall = new CinematicScene(CRYSTAL, 'hall');
  /** One lullaby note, from ahead of where the head faced as a scene began (the sun, or the crystal). */
  // Delayed story steps (the last notes, the end screen, a fade back up) are kept so a session that ends cancels them.
  const laterTimers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const handle = setTimeout(() => {
      laterTimers.delete(handle);
      fn();
    }, ms);
    laterTimers.add(handle);
  };
  const cancelLater = () => {
    for (const handle of laterTimers) clearTimeout(handle);
    laterTimers.clear();
  };
  const storyNote = (index: number) =>
    gameAudio.lullabyNote(
      index,
      prologueHead.x + prologueAhead.x * 4.5,
      prologueHead.y + 0.3,
      prologueHead.z + prologueAhead.z * 4.5,
    );
  // The opening: a wordless reel in the dusk scene. The lullaby notes fall as the five lights go out, then the first one sounds alone.
  const prologue = new PrologueReel(cinematic, voidHost(cinematic), storyNote);
  const finale = new Prologue(hall, voidHost(hall), FINALE_PAGES, (page) => {
    if (page < FINALE_PAGES.length - 1) storyNote(page);
    else for (let k = 0; k < 5; k++) later(() => storyNote(k), k * 240);
  });
  /** The Skip poke for each (a fingertip held on the ring for a moment). */
  const prologueSkip = new SkipTouch();
  const finaleSkip = new SkipTouch();
  const walkSkip = new SkipTouch();
  const prologueHead = new Vector3();
  const prologueAhead = new Vector3();
  /** Where the traveller is on the stage, read from the game by readTraveller (false before the night starts). */
  const travellerAt = { x: 0, y: 0 };
  const readTraveller = (): boolean => {
    const game = night.game;
    if (!game) return false;
    const slot = game.traveller.slot(game);
    travellerAt.x = game.store.x[slot];
    travellerAt.y = game.store.y[slot];
    return true;
  };
  let stickerNext = 0;
  // The solve moment (the wall's light swells, the kindred bursts) and the near-miss glow round a hand that is almost right.
  const glow = new GlowView();
  const air = new AirView();
  // The shadow animals come alive: a committed rabbit shape hops out of the hand, a committed fox shape calls the kindred.
  const rabbits = new RabbitView();
  // Dust that a hand's shadow shakes off a prop's shadow when it reaches into it.
  const propTouch = new PropTouch();
  const dust = new SparkleLayer(9);
  let summonT = 0; // seconds the kindred stays after a fox shape called it (it is switched on for the visit)
  let perchT = 0;
  const solveBloom = new SolveBloom();
  const nearGlow = [new Follower(), new Follower()];
  let moodNow = 0.4;
  let moodGoal = 0.4;
  // The ending: the room cools and dims as the cutscene plays (the night calls this after the return).
  const playEnding = (onDone?: () => void) => {
    storyLine.clear(); // the finale speaks for itself
    captionLine.clear();
    moodGoal = ENDING_MOOD;
    // When the hall fades away the room stands there, every sleeper awake: a moment on that picture (with one last line) before the
    // end screen comes.
    finale.start(() => {
      storyLine.say('The room dreams on.', 1.6, 3.2);
      later(() => onDone?.(), 6500);
    });
  };
  const playSolve = () => {
    moodGoal = 1;
    solveBloom.trigger();
    if (kindredOn) kindredView.burst(kindred);
    if (rigPlaced) gameAudio.twinkleAt(stage, kindred.x, kindred.y);
  };
  let openingT = -1; // seconds into the opening (title, then the fox drifts in and leaves); -1 when it is not running
  let kindredOn = false;
  let kindredWanted = false; // the Testing panel's switch, which the opening must not leave switched off
  const setKindred = (on: boolean) => {
    if (openingT < 0) kindredWanted = on;
    kindredOn = on;
    if (!on) kindredView.hide();
  };
  // The interludes between the night's scenes (src/game/story.ts): a short cutscene on the wall while the game holds. One that
  // comes while the view is elsewhere (the travel scene's walk) waits until the wall is back.
  let pendingInterlude: { data: CutsceneData; onDone: () => void } | null = null;
  /** The playing interlude's end (not the opening's, which starts the night), so a session that ends can end it too. */
  let interludeDone: (() => void) | null = null;
  const playInterlude = (data: CutsceneData, onDone: () => void) => {
    if (travelRun || inVoid) {
      pendingInterlude = { data, onDone };
      return;
    }
    const done = () => {
      if (interludeDone === done) interludeDone = null;
      onDone();
    };
    const problems = cutscenes.play(data, done);
    if (problems.length > 0) {
      failures.report('interlude', new Error(`${data.id}: ${problems.join('; ')}`));
      onDone();
      return;
    }
    interludeDone = done;
  };
  const playOpening = () => {
    const problems = cutscenes.play(OPENING, () => {
      readingPage.clear();
      openingT = -1;
      setKindred(kindredWanted);
      sessionState = 'playing';
      candleView.setLocked(true);
      night.start();
    });
    if (problems.length > 0) {
      failures.report('opening', new Error(problems.join('; ')));
      sessionState = 'playing';
      candleView.setLocked(true);
      night.start();
      return;
    }
    openingT = 0;
    // The first page of the book, low in front of the player while the night begins: the flat hand that makes the first bridge.
    world.camera.getWorldPosition(prologueHead);
    world.camera.getWorldDirection(prologueAhead);
    readingPage.show(prologueHead, prologueAhead.x, prologueAhead.z, OPENING_S);
    kindred.x = -kindredStartX; // enters from the left edge
    setKindred(true);
  };
  const stageGroup = new Group();
  stageGroup.matrixAutoUpdate = false;
  const stageRenderer = new StageRenderer(stageGroup);
  // The ghost outline of the wanted shape: the first rung of the hint ladder (the night's hint-show events).
  const ghostTarget = new GhostTargetView(stageGroup, {
    targetId: 'hint',
    x: 0.0,
    y: -0.15,
    requiredShape: 'flat',
    active: false,
  });
  // The puzzles' gate, counterweight plate, wind and window (the drops are entities the stage renderer draws).
  const fixturesView = new FixturesView(stageGroup);
  const wallPauseView = new WallPauseView();
  stageGroup.add(wallPauseView.group);
  world.scene.add(
    stageView.group,
    stageGroup,
    bedroomView.group,
    shadowRenderer.mesh,
    propShadows.mesh,
    cutsceneView.group,
    storyLine.group,
    captionLine.group,
    spark.group,
    handTrail.group,
    propSketch.group,
    rewards.group,
    readingPage.group,
    cinematic.group,
    fade.group,
    hall.group,
    walkScene.group,
    glow.group,
    rabbits.group,
    dust.mesh,
    air.group,
    kindredView.group,
    stickerView.group,
    candleView.group,
    titleLighter.group,
    bedTray.group,
    vrTitle.group,
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
  // The music is made while the title screen sits idle, so starting it with the session costs no frame.
  const whenIdle = (window as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback;
  // The sounds are made in code; rendering them takes real time on a headset's CPU (the music alone about a second), so a worker does it
  // ahead (every sound, the room's loops first) and the engine finds each ready. Without workers the pool does the same on the main thread.
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
        // Not while the room is out of sight (the prologue, the finale): the wall is not shown, and the caption would be lost.
        if (inVoid || sessionState !== 'playing') return false;
        captionLine.say(text, 0, 1.6);
        return true;
      },
      () => performance.now() / 1000,
    ),
  );
  // The kindred's visits for the night (a hint's perch, the return): it flies in if it is not about, and stays
  // perched until released. `kindredAway` keeps it hidden from the dimming until the return.
  let kindredAway = false;
  let kindredVisiting = false;
  const visitKindred = (x: number, y: number) => {
    if (kindredAway) return;
    if (!kindredOn) {
      kindred.x = x + (x >= 0 ? 0.6 : -0.6) * stage.width * 0.5; // it flies in from the nearer edge
      kindred.y = y + 0.1;
      kindredOn = true; // for the visit only: the switch's own choice (kindredWanted) is untouched
      kindredVisiting = true;
    }
    kindred.perchAt(x, y);
    perchT = Infinity;
    gameAudio.twinkleAt(stage, x, y);
  };
  const endKindredVisit = () => {
    if (perchT === Infinity) {
      perchT = 0;
      kindred.release();
    }
    if (kindredVisiting) {
      kindredVisiting = false;
      kindredOn = kindredWanted;
      if (!kindredOn) kindredView.hide();
    }
  };
  // The night (src/game) and what it shows: night-driver.ts turns the game's events into these calls.
  const propOutline = createSilhouette();
  const wakeSleeper = (index: number): void => {
    // The spark leaves the traveller (where it stands on the paper), flies across the room to the sleeper, and the room lights it
    // and plays its note when it lands.
    if (!readTraveller()) {
      travellerAt.x = 0;
      travellerAt.y = 0;
    }
    stagePoint(stage, travellerAt.x, travellerAt.y + 0.05, 0.06, sparkStart);
    sparkFrom.set(sparkStart.x, sparkStart.y, sparkStart.z);
    roomDressing.wakePoint(index, sparkTo);
    spark.launch(sparkFrom, sparkTo, () => {
      roomDressing.setAwake(index + 1);
      if (index === 1) roomDressing.rippleBunting(); // the second sleeper hangs under the bunting
      gameAudio.lullabyNote(index, sparkTo.x, sparkTo.y, sparkTo.z);
    });
  };
  const night = new NightDriver({
    stage,
    flame: candleView.flamePosition,
    blend: () => projector.settings.blend,
    saves,
    setProps: (list, light, onStage, blend) => {
      propShadows.setProps(list, light, onStage, blend);
      propSketch.setProps(list, light, onStage, blend); // and a faint painting of each prop, toward the light
      // The dust a hand shakes off a prop's shadow needs the outlines too (on puzzle load only, so it may allocate).
      propTouch.setPolygons(
        list.map((p) => {
          const n = projectProp(p, light, onStage, blend, propOutline);
          return { vertices: propOutline.points.slice(0, n * 2), vertexCount: n };
        }),
      );
    },
    showHint: (shape, x, y) => {
      ghostTarget.setTarget('hint', x, y, shape);
      ghostTarget.active = true;
    },
    hideHint: () => {
      ghostTarget.active = false;
    },
    perchKindred: visitKindred,
    releaseKindred: endKindredVisit,
    dim: () => {
      // The room cools with the mood the night sets; the kindred darts off the wall and stays away. The candle gutters: the whole
      // view dims for a moment (a slow fade to half dark, held, then back up) and a beam creaks overhead.
      if (kindredOn) kindred.scare(kindred.x, kindred.y - 0.05);
      fade.fadeTo(0.55, 1.0, () => later(() => fade.fadeTo(0, 1.8), 1600));
      roomDressing.group.localToWorld(creakPoint.set(0, 2.4, -0.4));
      gameAudio.creak(creakPoint.x, creakPoint.z);
    },
    setKindredAway: (away) => {
      kindredAway = away;
      if (away) {
        endKindredVisit();
        kindredOn = false; // not setKindred: the Testing switch's own choice stays
        kindredView.hide();
      }
    },
    setMood: (goal) => {
      moodGoal = goal;
    },
    say: (text, delay, hold, after) => storyLine.say(text, delay, hold, after),
    scenery: (index) => {
      stageView.setTheme(index);
      roomDressing.setWind(index === 3 ? FAN_WIND : CALM_WIND); // the fan puzzle blows the bunting about
    },
    rewound: () => {
      // The night turns back: a quick dip of the view and a soft chime, so the jump is felt as a rewind, not a glitch.
      fade.fadeTo(0.45, 0.12, () => fade.fadeTo(0, 0.7));
      gameAudio.twinkleAt(stage, 0, 0);
    },
    reward: (index) => {
      // The puzzle's own reward, on the paper where the traveller stands.
      if (governor.isOn('reward') && readTraveller())
        rewards.play(REWARDS[index] ?? 'sparks', travellerAt.x, travellerAt.y);
    },
    wake: (index) => wakeSleeper(index),
    travel: (from, to) => void travelTo(from, to),
    interlude: playInterlude,
    note: (text) => captionLine.say(text, 3.2, 2.6),
    setAwake: (count) => {
      sleepersAwake = count;
      if (count === 0) {
        spark.clear(); // a restart: nothing in flight
        rewards.clear();
      }
      roomDressing.setAwake(count);
    },
    solved: () => {
      // The bloom and the burst, but the wall warms by the night's colour script, not all the way.
      const mood = moodGoal;
      playSolve();
      moodGoal = mood;
      gameAudio.puzzleSolved(stage);
    },
    twinkle: (x, y) => gameAudio.twinkleAt(stage, x, y),
    playEnding: (onDone) => playEnding(onDone),
    nightOver: () => void showMenu('end', endLine(night.waysFound(), MENU_SCREENS.end.line)),
  });
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
  wallPauseView.setSettingsStore(settings);
  // The title screen's SETTINGS item opens the same settings as a page, before the headset is on.
  const settingsPage = createSettingsPage(settings);
  launcherHooks.openSettings = () => settingsPage.open();
  // High contrast: a bright white wall and fully solid shadows (the room art, when it exists, reads the same setting).
  const applyTextSize = () => {
    storyLine.scale = settings.value.textSize;
    captionLine.scale = settings.value.textSize;
  };
  settings.subscribe((key) => {
    if (key === null || key === 'textSize') applyTextSize();
  });
  applyTextSize();
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
  // The pause, solved and end screens. The game flow calls menu.show('pause' | 'solved' | 'end') and reads the
  // presses from menu.onPress; here a press on Settings opens the settings panel and Resume closes the screen.
  const menuTips = new Float32Array(6);
  // The menu screen being looked at from the Hand Lab's Menu button or the launcher's Testing panel (never by the game).
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
    } else if (screen === 'pause' && button === 'restart') {
      menu.hide();
      menuChoice = 'off';
      sessionState = 'playing';
      candleView.setLocked(true);
      night.restart();
    } else if (screen === 'end' && button === 'again') {
      menu.hide();
      menuChoice = 'off';
      moodGoal = 0.4;
      night.again();
    }
  };
  const showMenu = (id: MenuScreenId, line?: string) => {
    world.camera.getWorldPosition(settingsHead);
    world.camera.getWorldDirection(settingsLook);
    return menu.show(id, [settingsHead.x, settingsHead.y, settingsHead.z], settingsLook.x, settingsLook.z, line);
  };
  let badPoseReported = false;
  let headY = 1.2; // the eye height the rig was last placed for; the candle's table is 0.45 m below it
  /** Places the stage and lantern for a head at `head` facing `yaw`. Returns false, placing nothing, if the pose is not usable. */
  // The room's ambient sounds: the clock at the back and the wind at the window follow the room when it is placed round the player;
  // a few flakes tick on the glass and a beam creaks now and then, less as the sleepers wake, and never over a story scene.
  const clockPoint = new Vector3();
  const windPoint = new Vector3();
  const creakPoint = new Vector3();
  const placeAmbientSounds = () => {
    roomDressing.group.updateWorldMatrix(true, false);
    roomDressing.group.localToWorld(clockPoint.set(-1.4, 1.9, 0.8));
    roomDressing.group.localToWorld(windPoint.set(-1.95, 1.4, -0.8));
    gameAudio.placeAmbient(clockPoint, windPoint);
  };
  let ambientOn = false;
  let ambientTimer: ReturnType<typeof setTimeout> | undefined;
  let sleepersAwake = 0;
  const ambientTick = () => {
    ambientTimer = setTimeout(ambientTick, 3500 + Math.random() * 7000);
    if (!ambientOn || inVoid || visibility.paused || sessionState !== 'playing' || !governor.isOn('ambient')) return;
    if (Math.random() < 0.15) {
      roomDressing.group.localToWorld(creakPoint.set((Math.random() - 0.5) * 3, 2.4, -1.6 + Math.random() * 2));
      gameAudio.creak(creakPoint.x, creakPoint.z);
    } else if (Math.random() < 1 - 0.16 * sleepersAwake) gameAudio.snowTick();
  };
  // The traveller's footsteps: one soft step for every stride of ground it walks (not while it waits, and not across a jump).
  /** How close (metres on the paper) a hand's shadow must come to the traveller for it to glance at it. */
  const GLANCE_M = 0.13;
  const STEP_M = 0.045;
  let stepLastX = 0;
  let stepWalked = 0;
  let stepSeen = false;
  let stepAlternate = false;
  const footsteps = () => {
    if (!readTraveller()) {
      stepSeen = false;
      return;
    }
    const dx = Math.abs(travellerAt.x - stepLastX);
    if (stepSeen && night.game!.traveller.state === 'walk' && dx < 0.1) {
      stepWalked += dx;
      if (stepWalked >= STEP_M) {
        stepWalked -= STEP_M;
        stepAlternate = !stepAlternate;
        gameAudio.stepAt(stage, travellerAt.x, travellerAt.y, stepAlternate);
        if (governor.isOn('reward')) rewards.play('puff', travellerAt.x, travellerAt.y - 0.035); // a little dust at its feet
      }
    } else stepWalked = 0;
    stepLastX = travellerAt.x;
    stepSeen = true;
  };
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
    if (stageChoice === 'real') {
      stageFrame.placeInFront(head, yaw);
      placeLantern(head, yaw, lantern);
    } else placeTestRig(mockStage, head, yaw, standInStage, lantern);

    const sdx = stage.origin[0] - head[0],
      sdz = stage.origin[2] - head[2];
    const stageDist = Math.sqrt(sdx * sdx + sdz * sdz);
    bedroomView.place(head, yaw, stageDist > 0.5 ? stageDist : 2.0);
    roomDressing.place(stageDist > 0.5 ? stageDist : 2.0);
    placeAmbientSounds();

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

    stageView.setPool(
      stageChoice === 'real' ? lightArea(true, stage.origin[1], stage.width, stage.height, lightPoolArea) : null,
    );
    stageView.place(stage, lantern);
    candleView.place(lantern);

    // Place floating VR title emblem above the tray
    const titleDist = 0.55;
    const titleX = head[0] - Math.sin(yaw) * titleDist;
    const titleY = head[1] - 0.15;
    const titleZ = head[2] - Math.cos(yaw) * titleDist;
    vrTitle.place(titleX, titleY, titleZ, yaw);
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    // prettier-ignore
    stageGroup.matrix.set(
      r[0], u[0], n[0], o[0],
      r[1], u[1], n[1], o[1],
      r[2], u[2], n[2], o[2],
      0, 0, 0, 1,
    );
    stageGroup.matrixWorldNeedsUpdate = true;
    // The wall or the flame moved: the props' shadows (and the ground they make) are cast again.
    night.relight();
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
      menu: {
        cycle: () => showMenuChoice(nextChoice(MENU_CHOICES, menuChoice)),
        label: () => menuChoice,
      },
      cutscene: { play: () => playOpening() },
      prologue: { play: () => prologue.start() },
      travel: {
        play: () => {
          const from = travelDemo++ % 4;
          void travelTo(from, from + 1);
        },
      },
      rewind: { go: () => night.rewind(3) },
      editor: {
        open: () => {
          // In the lab there is no opening to start the night: opening the editor does it.
          if (night.started) return;
          sessionState = 'playing';
          candleView.setLocked(true);
          night.start();
        },
        current: () => {
          const puzzle = night.game?.puzzle;
          if (!puzzle) return null;
          let editor = levelEditors.get(puzzle);
          if (!editor) levelEditors.set(puzzle, (editor = new LevelEditor(puzzle)));
          return editor;
        },
        changed: () => night.restart(),
      },
      kindred: { toggle: () => setKindred(!kindredOn), isOn: () => kindredOn },
      solve: { play: () => playSolve() },
      ending: { play: () => playEnding() },
      stage:
        stageChoice === 'real'
          ? undefined
          : {
              toggle: () => {
                mockStage = mockStage === 'table' ? 'wall' : 'table';
                if (rigPlaced) placeRig(lastHead, lastYaw);
              },
              label: () => mockStage,
            },
      sticker: {
        // Shows the next sticker over the traveller, to see them all.
        next: () => {
          if (readTraveller()) travellerMood.show(stickerNext as StickerId, travellerAt.x, travellerAt.y);
          stickerNext = (stickerNext + 1) % STICKER_COUNT;
        },
      },
    });
  }
  const handList = [hands.hands.left, hands.hands.right];
  // ?debug=props shows a few demo props' shadows (src/debug/demo-props.ts): dev and tester builds only.
  let demoProps: ((stage: StagePlane) => Prop[]) | null = null;
  const demoKey = new Float64Array(6).fill(NaN);
  if (DEBUG_TOOLS && debugViews.has('props')) demoProps = (await import('../debug/demo-props')).demoProps;
  let simWasPaused = false;
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
      readout: () => (inspector.line ? `${timings.line} · ${inspector.line}` : timings.line),
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
  // The room editor (src/debug/room-editor.ts): ?mock=1&edit=room arranges the bedroom's static pieces in the Hand Lab and
  // saves them to content/rooms/bedroom.json. Debug builds only, loaded on demand like the other debug tools.
  let roomEditor: import('../debug/room-editor').RoomEditor | null = null;
  if (DEBUG_TOOLS && lab && params.get('edit') === 'room') {
    const { RoomEditor } = await import('../debug/room-editor');
    const desk = lab;
    roomEditor = new RoomEditor({
      camera: world.camera,
      canvas: world.renderer.domElement,
      scene: world.scene,
      room: bedroomView.group,
      eyeHeight: () => lastHead[1],
      sources: [roomModels, roomDressing, bedroomView, bedTray],
      layout: bedroomLayout.layout,
      fileName: BEDROOM_LAYOUT_FILE,
      roomRoots: [bedroomView.group, bedTray.group, candleView.group],
      suspendDesk: (on) => {
        desk.suspend(on);
        if (mock) mock.paused = on;
      },
    });
    // The candle stands on the tray: when the tray moves, the rig is placed again so the candle (the light) follows it.
    bedTray.onPieceMoved = () => {
      if (rigPlaced) placeRig(lastHead, lastYaw);
    };
    roomEditor.show();
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
      simSteps: night.steps,
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
    stageRenderer: {
      liveCount: stageRenderer.liveCount,
      drawCalls: 1,
      ghostTargetActive: ghostTarget.active,
    },
    night: night.game
      ? {
          puzzle: night.game.puzzle.id,
          complete: night.game.complete,
          traveller: night.game.traveller.state,
          terrainCapsules: night.game.solver.terrain.count,
          layoutProblems: night.game.layout.problems.length,
          hint: night.game.runner.hintRung,
          waitingForHands: night.game.waitingForHands,
        }
      : null,
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
    guard('sessionstart: room sound', () => gameAudio.setRoom(true));
    guard('sessionstart: quality', () => {
      governor.reset();
      governor.setRefreshRate((session as { frameRate?: number } | null)?.frameRate ?? 72);
      governorOn = !mock && !!session;
      applyGovernor();
    });
    guard('sessionstart: ambient', () => {
      placeAmbientSounds();
      ambientOn = true;
      if (ambientTimer === undefined) ambientTimer = setTimeout(ambientTick, 6000);
    });
    if (capture.enabled) guard('sessionstart: capture', () => world.renderer.xr.setFoveation?.(capture.foveation));
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
    // The first time a headset starts the game, the prologue plays before the candle (once; the Testing switch plays it again).
    if (session && !mock && !hasSeenPrologue()) {
      guard('sessionstart: prologue', () => {
        later(() => {
          markPrologueSeen(); // only once it plays: leaving at once should not use up the first showing
          prologue.start();
        }, 800);
      });
    }
  });
  world.renderer.xr.addEventListener('sessionend', () => {
    guard('sessionend: room sound', () => gameAudio.setRoom(false));
    guard('sessionend: ambient', () => {
      ambientOn = false;
      clearTimeout(ambientTimer); // the chain starts again with the next session
      ambientTimer = undefined;
      governorOn = false;
      governor.reset();
      applyGovernor();
    });
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
    guard('sessionend: story', () => {
      prologue.skip();
      finale.skip();
      pendingInterlude = null;
      // An interlude ends with the session, and the night stops holding for it.
      const done = interludeDone;
      if (done) {
        cutscenes.stop(false);
        done();
      }
      cancelLater(); // skipping runs the end-of-finale step, which must not show the end screen now
      fade.setBlack(false); // and a dim that was waiting to lift must not stay
    });
    guard('sessionend: state', () => {
      sessionState = 'title_vr';
      ignitionHoldTimer = 0;
      titleStallT = 0;
      candleView.ignitionProgress = 0;
      candleView.lit = false;
      candleView.setLocked(false);
      titleLighter.visible = false;
      wallPauseView.hide();
      stageRenderer.mesh.visible = false;
      kindredView.group.visible = false;
      ghostTarget.mesh.visible = false;
    });
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
    night.rewindOnFall = loadTesting().rewindOnFall;
    showMenuChoice(loadTesting().menu);
    setKindred(loadTesting().kindred);
    window.addEventListener(TESTING_EVENT, (e) => {
      const t = (e as CustomEvent<ReturnType<typeof loadTesting>>).detail;
      applyOverlays(t);
      night.rewindOnFall = t.rewindOnFall;
      showMenuChoice(t.menu);
      setKindred(t.kindred);
    });
    world.renderer.xr.addEventListener('sessionstart', () => {
      const t = loadTesting();
      if (t.settings) setTimeout(() => void openSettings(), 1000);
      if (t.cutscene) setTimeout(() => playOpening(), 1000);
      // A story scene, to see it straight away on a headset: the prologue, or the finale (the same one the night ends with).
      if (t.story === 'prologue') later(() => prologue.start(), 1000);
      if (t.story === 'travel') later(() => travelWhenFree(2, 3), 1000);
      if (t.story === 'finale') later(() => finale.start(), 1000);
      setKindred(t.kindred);
      armRecording(t.record);
    });
  }
  // The "Show me your hands" message: a second panel, in front of the wearer when it appears.
  // Capture mode keeps this message out of a recording: it would show whenever tracking drops mid-take.
  const handsPanel = mock || capture.enabled ? null : new PromptPanel();
  if (handsPanel) world.player.add(handsPanel.mesh);
  let handsPanelVersion = handsStatus.version;

  // The only IWSDK system we register. Priority 10 runs after IWSDK's input (-4)
  // and scene understanding (-1) systems and before render.
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
      if (!frame && !mock) {
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
      // The first frame after the headset was off carries the whole gap; the sim loop clamps its own, these do not.
      const step = Math.min(delta, MAX_STEP_S);
      const shadowsVisible =
        candleView.lit &&
        sessionState !== 'paused' &&
        sessionState !== 'title_vr' &&
        !prologue.playing &&
        !finale.playing &&
        !inVoid;
      // The ledges' shadows wait until the opening is over, or they sit over its captions.
      const propsVisible = shadowsVisible && openingT < 0;
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
          const candleAction = candleView.updateInteraction(hands.hands, step, headY - 0.45);
          if (candleAction.justPickedUp || candleAction.justPlaced)
            gameAudio.candleMoved(candleAction.justPickedUp, candleAction.justPlaced, candleView.flamePosition);
          if (candleAction.state === 'held' || candleAction.justPlaced) {
            lantern[0] = candleView.group.position.x;
            lantern[1] = candleView.group.position.y;
            lantern[2] = candleView.group.position.z;
            if (candleAction.justPlaced) night.relight();
          }
        } catch (e) {
          failures.report('candle pickup', e);
        }
        world.camera.getWorldQuaternion(cameraQuat);
        if (sessionState === 'title_vr') {
          vrTitle.update(step);
          titleLighter.visible = true;
          titleLighter.update(hands.hands.right, cameraQuat, clock);

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
          if (!handTouchingWick && candleView.checkIgnition(handList)) {
            handTouchingWick = true;
          }
          if (!handTouchingWick && frame && controllerPressed(frame)) handTouchingWick = true;
          if (!handTouchingWick && mock) {
            handTouchingWick = true;
          }
          // Not while a story scene is playing: the room is hidden and the hands are somewhere else.
          if (prologue.playing || finale.playing) handTouchingWick = false;

          if (handTouchingWick) {
            ignitionHoldTimer = Math.min(3.0, ignitionHoldTimer + step);
          } else {
            ignitionHoldTimer = Math.max(0.0, ignitionHoldTimer - step * 2.0);
          }

          // Nobody told them what to do: after a few seconds with no progress, a riddle under the title says it, and a plainer line later.
          if (ignitionHoldTimer > 0) titleStallT = 0;
          else titleStallT += step;
          vrTitle.setHint(titleStallT > TITLE_HINT_PLAIN_AFTER_S ? 2 : titleStallT > TITLE_HINT_AFTER_S ? 1 : 0);

          const ignitionProgress = ignitionHoldTimer / 3.0;
          candleView.ignitionProgress = ignitionProgress;
          roomDressing.ignition = ignitionProgress; // the room starts to glow as the wick is held

          if (ignitionHoldTimer >= 3.0) {
            sessionState = 'opening';
            candleView.ignitionProgress = 0;
            roomDressing.ignition = 0;
            candleView.lit = true;
            titleLighter.visible = false;
            gameAudio.candleIgnited(candleView.flamePosition);
            vrTitle.ignite();
            playOpening();
          }
        } else {
          titleLighter.visible = false;
          if (sessionState === 'opening') {
            vrTitle.update(step);
          } else if (sessionState === 'playing') {
            if (candleView.isCovered) {
              sessionState = 'paused';
              simWasPaused = true;
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
              simWasPaused = true;
            } else if (action === 'restart') {
              wallPauseView.hide();
              sessionState = 'playing';
              candleView.resetCover();
              candleView.lit = true;
              candleView.setLocked(true);
              audio.mixer.setLift(Bus.Ambience, 1.0);
              audio.mixer.setLift(Bus.Music, 1.0);
              gameAudio.candleIgnited(candleView.flamePosition);
              night.restart();
              simWasPaused = true;
            } else if (action === 'settings') {
              wallPauseView.showSettings();
            }
          }
        }
        timings.begin(SLOT.shadow);
        try {
          shadowRenderer.mesh.visible = shadowsVisible;
          propShadows.mesh.visible = propsVisible;
          fixturesView.group.visible = propsVisible && night.started;
          stageRenderer.mesh.visible = shadowsVisible;
          kindredView.group.visible = shadowsVisible;
          ghostTarget.mesh.visible = shadowsVisible && ghostTarget.active;

          projector.update(hands.hands, stage, candleView.flamePosition);
          if (!paused) {
            gameAudio.onShapeEvents(shapes.events, projector.shadows, stage);
            handTrail.onShapeEvents(shapes.events, projector.shadows);
          }
          shadowRenderer.setPool(
            stageChoice === 'real' ? lightPoolArea : null,
            stageView.flameOnWall.x,
            stageView.flameOnWall.y,
          );
          shadowRenderer.update(projector.shadows, stage, sharpen.look, shadowsVisible ? candleView.occlusion : 0);
          if (demoProps) {
            // ?debug=props: rebuild the demo props' shadows when the stage or the flame moves.
            const o = stage.origin,
              f = candleView.flamePosition;
            if (
              o[0] !== demoKey[0] ||
              o[1] !== demoKey[1] ||
              o[2] !== demoKey[2] ||
              f[0] !== demoKey[3] ||
              f[1] !== demoKey[4] ||
              f[2] !== demoKey[5]
            ) {
              propShadows.setProps(demoProps(stage), f, stage, projector.settings.blend);
              demoKey.set([o[0], o[1], o[2], f[0], f[1], f[2]]);
            }
          }
          propShadows.update(stage, propsVisible ? shadowRenderer.baseOpacity * candleView.occlusion : 0);
          if (night.game)
            fixturesView.update(
              night.game.fixtures,
              propsVisible ? shadowRenderer.baseOpacity * candleView.occlusion : 0,
              paused ? 0 : step,
            );
          if (kindredOn && rigPlaced) {
            // It circles where the flame's light falls on the wall: the flame's position in stage coordinates.
            const f = candleView.flamePosition,
              o = stage.origin,
              r = stage.right,
              up = stage.up;
            const dx = f[0] - o[0],
              dy = f[1] - o[1],
              dz = f[2] - o[2];
            const hw = stage.width / 2,
              hh = stage.height / 2;
            const fx = Math.max(-hw * 0.7, Math.min(hw * 0.7, dx * r[0] + dy * r[1] + dz * r[2]));
            const fy = Math.max(-hh * 0.7, Math.min(hh * 0.7, dx * up[0] + dy * up[1] + dz * up[2]));
            // A hand's shadow coming close startles it (the palm's shadow, from the light through the hand).
            if (kindred.startled <= 0 && openingT < 0 && perchT <= 0) {
              const fl = candleView.flamePosition;
              for (const h of handList) {
                if (!h.tracked) continue;
                const o3 = JOINT['middle-finger-metacarpal'] * 3;
                if (
                  !shadowSpot(
                    stage,
                    fl[0],
                    fl[1],
                    fl[2],
                    h.positions[o3],
                    h.positions[o3 + 1],
                    h.positions[o3 + 2],
                    spot,
                  )
                )
                  continue;
                const ex = spot[0] - kindred.x,
                  ey = spot[1] - kindred.y;
                if (ex * ex + ey * ey < SCARE_RADIUS_M * SCARE_RADIUS_M) {
                  kindred.scare(spot[0], spot[1]);
                  break;
                }
              }
            }
            kindred.update(step, hw, hh, fx, fy, true);
            let foxAlpha = 1;
            if (summonT > 0) foxAlpha = Math.min(1, summonT, (7 - summonT) / 0.6);
            if (openingT >= 0) {
              openingT += step;
              foxAlpha = openingFoxAlpha(openingT);
            }
            kindredView.update(
              kindred,
              stage,
              shadowsVisible ? shadowRenderer.baseOpacity * candleView.occlusion * foxAlpha : 0,
              step,
            );
            if (!shadowsVisible) kindredView.group.visible = false;
          }
          // Dust: a hand's shadow reaching into a prop's shadow shakes a little off it, with a soft rustle.
          for (let i = 0; i < 2; i++) {
            const sh = projector.shadows[i === 0 ? 'left' : 'right'];
            if (
              propTouch.update(i, step, sh.active && sh.onStage, sh.bounds[0], sh.bounds[1], sh.bounds[2], sh.bounds[3])
            ) {
              dust.sparkles.burst(propTouch.touchX, propTouch.touchY, 9, 0.05);
              gameAudio.bridgeActivated(stage, propTouch.touchX, propTouch.touchY);
            }
          }
          dust.sparkles.update(step, 0, 0, 0);
          dust.draw(stage, shadowRenderer.baseOpacity * candleView.occlusion * 0.8);
          // The shadow animals: what a hand just committed comes alive on the wall (visual only, no gameplay).
          for (let i = 0; i < shapes.events.count; i++) {
            const e = shapes.events.at(i);
            if (e.type !== 'commit' || (e.shape !== 'rabbit' && e.shape !== 'fox')) continue;
            const sh = projector.shadows[e.hand];
            if (!sh.active || !sh.onStage) continue;
            const cx = (sh.bounds[0] + sh.bounds[2]) * 0.5;
            const cy = (sh.bounds[1] + sh.bounds[3]) * 0.5;
            if (e.shape === 'rabbit') {
              rabbits.spawn(e.hand === 'left' ? 0 : 1, cx, cy - 0.05, cx >= 0 ? 1 : -1);
              gameAudio.hopAt(stage, cx, cy);
            } else {
              if (!kindredOn) {
                kindred.x = cx + (cx >= 0 ? 0.6 : -0.6) * stage.width * 0.5; // it flies in from the nearer edge
                kindred.y = cy + 0.1;
                summonT = 7;
                kindredOn = true; // for the visit only: the switch's own choice (kindredWanted) is untouched
              }
              kindred.perchAt(cx, cy + 0.09);
              perchT = 3.2;
              gameAudio.twinkleAt(stage, cx, cy + 0.09);
            }
          }
          rabbits.update(step, stage, shadowRenderer.baseOpacity * candleView.occlusion);
          if (perchT > 0 && (perchT -= step) <= 0) kindred.release();
          if (summonT > 0 && (summonT -= step) <= 0) {
            kindredOn = kindredWanted;
            if (!kindredOn) kindredView.hide();
          }
          // Glows on the wall: the solve bloom, and a soft light round a hand that is nearly making the wanted shape.
          {
            const occ = candleView.occlusion;
            solveBloom.update(step);
            stickerView.update(travellerMood, stage, shadowRenderer.baseOpacity * occ);
            audio.mixer.setLift(Bus.Music, 1 + 0.4 * solveBloom.value); // the music swells with the light
            glow.set(0, stage, 0, stage.height * 0.05, stage.width * 0.55, solveBloom.value * 0.7 * occ);
            const wanted = ghostTarget.active ? SHAPES.indexOf(ghostTarget.requiredShape) : -1;
            for (let i = 0; i < 2; i++) {
              const h = i === 0 ? 'left' : 'right';
              const sh = projector.shadows[h];
              let level = 0;
              if (wanted >= 0 && sh.active && sh.onStage && shapes[h].state.committed !== ghostTarget.requiredShape)
                level = nearMissLevel(shapes[h].margins[wanted]);
              const f = nearGlow[i].update(level, step);
              glow.set(
                1 + i,
                stage,
                (sh.bounds[0] + sh.bounds[2]) * 0.5,
                (sh.bounds[1] + sh.bounds[3]) * 0.5,
                0.1,
                f * 0.55 * occ,
              );
            }
          }
          spark.update(paused ? 0 : step);
          readingPage.update(step);
          rewards.update(
            paused ? 0 : step,
            stage,
            shadowsVisible ? shadowRenderer.baseOpacity * candleView.occlusion : 0,
          );
          propSketch.update(
            propsVisible && governor.isOn('propSketch') ? shadowRenderer.baseOpacity * candleView.occlusion : 0,
          );
          handTrail.update(
            paused ? 0 : step,
            stage,
            projector.shadows,
            shadowsVisible && governor.isOn('trail') ? shadowRenderer.baseOpacity * candleView.occlusion : 0,
          );
          world.camera.getWorldPosition(settingsHead);
          fade.update(step, settingsHead);
          prologue.update(step);
          finale.update(step);
          if (travelRun && inVoid) {
            const run = travelRun;
            walkScene.update(step);
            if (walkScene.finished && !run.dipping && !run.leaving) {
              if (run.at + 1 < run.segments.length && !run.skipRest) {
                // The next scene (the walk into the new land) follows the waking: a quick dip to black, so the repaint is not seen.
                run.dipping = true;
                const next = run.segments[run.at + 1];
                fade.fadeTo(1, 0.35, () => {
                  run.at++;
                  world.camera.getWorldPosition(prologueHead);
                  world.camera.getWorldDirection(prologueAhead);
                  walkScene.start(prologueHead, prologueAhead.x, prologueAhead.z, next.land, next.mode);
                  fade.fadeTo(0, 0.5, () => (run.dipping = false));
                });
              } else {
                run.leaving = true;
                walkHost.leave();
                later(() => {
                  sessionState = run.resume;
                  travelRun = null;
                }, 1300);
              }
            }
          }
          // The story's quiet line on the wall: it waits while paused and is not shown under a menu or a cutscene.
          const lineOpacity =
            shadowsVisible && !menu.group.visible && !cutscenes.playing
              ? shadowRenderer.baseOpacity * candleView.occlusion
              : 0;
          // A line said as a scene begins waits out its interlude, so it is not lost under the cutscene.
          const linesWait = paused || sessionState !== 'playing' || cutscenes.playing;
          storyLine.update(linesWait ? 0 : step, stage, lineOpacity);
          captionLine.update(linesWait ? 0 : step, stage, lineOpacity);
          if (pendingInterlude && !travelRun && !inVoid) {
            const waiting = pendingInterlude;
            pendingInterlude = null;
            playInterlude(waiting.data, waiting.onDone);
          }
          if (menu.group.visible || cutscenes.playing || prologue.playing || finale.playing || (travelRun && inVoid)) {
            // The fingertips that can reach the menu or poke Skip: each tracked hand's index tip.
            let tips = 0;
            for (const h of handList) {
              if (!h.tracked) continue;
              const o = JOINT['index-finger-tip'] * 3;
              menuTips[tips * 3] = h.positions[o];
              menuTips[tips * 3 + 1] = h.positions[o + 1];
              menuTips[tips * 3 + 2] = h.positions[o + 2];
              tips++;
            }
            if (menu.group.visible) {
              menu.gazeOn = settings.value.gazeMenus;
              if (menu.gazeOn) {
                world.camera.getWorldPosition(gazeAt);
                world.camera.getWorldDirection(gazeDir);
                menu.setGaze(gazeAt.x, gazeAt.y, gazeAt.z, gazeDir.x, gazeDir.y, gazeDir.z);
              }
              menu.update(step, menuTips, tips);
            }
            if (travelRun && inVoid && !travelRun.leaving) {
              if (walkSkip.update(step, menuTips, tips, walkScene.skipPlane)) {
                travelRun.skipRest = true;
                walkScene.skip();
              }
              walkScene.setSkipProgress(walkSkip.progress);
            }
            if (prologue.playing) {
              if (prologueSkip.update(step, menuTips, tips, cinematic.skipPlane)) prologue.skip();
              cinematic.setSkipProgress(prologueSkip.progress);
            }
            if (finale.playing) {
              if (finaleSkip.update(step, menuTips, tips, hall.skipPlane)) finale.skip();
              hall.setSkipProgress(finaleSkip.progress);
            }
            if (cutscenes.playing)
              cutscenes.update(step, stage, menuTips, tips, shadowRenderer.baseOpacity * candleView.occlusion);
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
      const isSimPaused =
        paused || sessionState === 'paused' || sessionState === 'title_vr' || sessionState === 'opening';
      if (isSimPaused) simWasPaused = true;
      else {
        try {
          if (rigPlaced) {
            // The outline only animates here; the game decides when the puzzle is solved.
            ghostTarget.update(delta, projector.shadows, shapes);
            ghostTarget.mesh.visible = shadowsVisible && ghostTarget.active;
            // The traveller's mood: how near is the nearer hand's shadow?
            if (!readTraveller()) stageRenderer.glance = false;
            else {
              let gap = 1e9;
              for (let i = 0; i < 2; i++) {
                const hs = projector.shadows[i === 0 ? 'left' : 'right'];
                if (hs.active && hs.onStage)
                  gap = Math.min(gap, nearestJointGap(hs.joints, hs.joints.length / 2, travellerAt.x, travellerAt.y));
              }
              stageRenderer.glance = gap < GLANCE_M; // it glances back at a hand that reaches close to it
              const state = night.game!.traveller.state;
              travellerMood.update(
                delta,
                travellerAt.x,
                travellerAt.y,
                state === 'blocked' || state === 'look-back' || state === 'held',
                state === 'goal',
                gap,
              );
            }
          }
          // Back from a pause (the flame covered, the headset off, the system menu): one held frame lets the game
          // drop the time that passed, so nothing jumps (docs/SIMULATION.md).
          const held = simWasPaused;
          simWasPaused = false;
          const shadows = projector.shadows;
          night.frame(
            delta,
            held,
            shadows.left.active ? shadows.left : null,
            shadows.right.active ? shadows.right : null,
            shapes.events,
            hands.hands.left.tracked,
            hands.hands.right.tracked,
          );
          footsteps();
        } catch (e) {
          failures.report('simulation', e);
        }
      }
      try {
        if (shadowsVisible && night.game) {
          stageRenderer.mesh.visible = true;
          stageRenderer.update(night.game.store, night.alpha);
        } else {
          stageRenderer.mesh.visible = false;
        }
      } catch (e) {
        failures.report('stage renderer', e);
      }
      // The stand-in lantern burns once the rig is placed; Teammate B's lantern flow will set `lit` and the position.
      try {
        lanternLight.update(clock, rigPlaced ? candleView.flamePosition : null, candleView.lit);
        world.camera.getWorldQuaternion(cameraQuat);
        stageView.applyLight(lanternLight.light, cameraQuat, candleView.occlusion, candleView.flamePosition, step);
        world.camera.getWorldPosition(settingsHead);
        stageView.setHead(settingsHead);
        bedroomView.update(lanternLight.light, cameraQuat, candleView.lit ? candleView.occlusion : 0);
        roomDressing.update(lanternLight.light, candleView.lit ? candleView.occlusion : 0, candleView.flamePosition);
        // The room is dark until the candle is lit; then its light spreads out from the flame to the walls, and draws
        // back when the flame is covered (the pause).
        roomDressing.spread(candleView.lit, step);
        candleLight.bakeIfDirty(world.renderer, world.scene);
        world.camera.getWorldPosition(settingsHead);
        // While paused the snow holds still (the head still moves the layers), and the dust, shaft and sparkles are skipped.
        roomDressing.tick(sessionState === 'paused' ? 0 : step, settingsHead);
        // Mood: the room starts cold and warms as the puzzles are solved (a placeholder curve until the puzzles set it).
        moodNow += (moodGoal - moodNow) * Math.min(1, step / 2.5);
        stageView.mood = moodNow;
        air.update(
          stage,
          candleView.flamePosition,
          rigPlaced && lanternLight.light.lit ? candleView.occlusion : 0,
          step,
          !passthrough && sessionState !== 'paused',
        );
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
        menu,
        showMenu,
        stageView,
        shadowRenderer,
        cutscenes,
        kindred,
        kindredView,
        stickerView,
        storyLine,
        captionLine,
        wakeSleeper,
        soundPool,
        governor,
        inspector,
        fade,
        rewards,
        handTrail,
        prologue,
        finale,
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
        candleLight,
        stageGroup,
        stageRenderer,
        ghostTarget,
        fixturesView,
        night,
        audio,
        gameAudio,
        debug,
        getRecorder: () => recorder,
        handVisual,
        bedTray,
        bedroomView,
        roomDressing,
        roomModels,
        roomEditor,
        vrTitle,
        wallPauseView,
        sessionState: () => sessionState,
        igniteCandle: () => {
          if (sessionState === 'title_vr') {
            sessionState = 'opening';
            candleView.lit = true;
            gameAudio.candleIgnited(candleView.flamePosition);
            vrTitle.ignite();
            playOpening();
          }
        },
        probe: (points: readonly (readonly number[])[]) =>
          probePixels(world.renderer, world.scene, world.camera, points),
      },
    });
}
