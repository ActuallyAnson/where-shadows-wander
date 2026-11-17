// Composition root. IWSDK owns the XR session, renderer and display loop; one
// driver system hands each frame to our code. Pure code (src/engine/hands,
// src/engine/stage) never imports IWSDK or three.js; this is enforced by
// ESLint (eslint.config.js). See docs/adr/0001-iwsdk-as-xr-and-view-layer.md.
//
// What runs (docs/adr/0016-story-shadow-theatre.md): the bedroom, lighting the candle, the hands' shadows on the
// wall, the story told in shadow puppets (docs/STORY.md), covering the flame to pause, and at the end to sleep.
// docs/ARCHITECTURE.md walks through one frame.
import {
  AmbientLight,
  AssetManager,
  AssetType,
  Color,
  Group,
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
import { JarFireflyView } from '../engine/render/jar-firefly-view';
import { TitleLighterView } from '../engine/render/title-lighter-view';
import { BedTrayView } from '../engine/render/room/bed-tray-view';
import { BedroomView } from '../engine/render/room/bedroom-view';
import { RoomDressingView } from '../engine/shadow/room-dressing-view';
import { GestureDetector } from '../engine/hands/gesture-detector';
import { ShapeRecognizer } from '../engine/hands/shape-recognizer';
import { LanternLightModel } from '../engine/shadow/pure/lantern-light';
import { ShadowSharpen } from '../engine/shadow/pure/shadow-sharpen';
import { ShadowProjector } from '../engine/shadow/pure/shadow-projector';
import { castPoint, REAL_WALL_SHADOW_SETTINGS } from '../engine/shadow/pure/real-wall';
import { loadTesting, MENU_CHOICES, nextChoice, saveTesting, type MenuChoice } from './testing-options';
import { MenuPanel } from '../ui/menu-panel/menu-panel';
import { WallPauseView } from '../ui/menu-panel/wall-pause-view';
import type { MenuScreenId } from '../ui/menu-panel/screens';
import type { StagePlane } from '../engine/shadow/pure/stage-plane';
import { createHandFrame, JOINT } from '../engine/hands/hand';
import { FADE_IN_S } from '../engine/xr/hand-fade';
import { FadeView } from '../engine/shadow/fade-view';
import { WakeView } from '../engine/shadow/wake-view';
import { WakeTimeline } from '../engine/stage/wake-timeline';
import { EndingTimeline } from '../engine/stage/ending-timeline';
import { CreditsView } from '../ui/credits/credits-view';
import { NightSounds } from '../engine/stage/night-sounds';
import { Storm } from '../engine/stage/storm';
import { LookToStart, looksAtStage } from '../engine/stage/look-to-start';
import { MATCH_GRIP, PosedHand } from '../engine/hands/posed-hand';
import { MOCK_HEAD, placeLantern, yawOf } from '../engine/shadow/pure/test-rig';
import { FrameInspector } from './frame-inspector';
import { ShapeRingView } from '../engine/shadow/shape-ring-view';
import { QualityGovernor } from '../engine/shadow/pure/quality-governor';
import { StoryLineView } from '../engine/shadow/story-line-view';
import { GhostOutlines } from '../engine/shadow/ghost-outline';
import { PuppetView } from '../engine/shadow/puppet-view';
import { SkipTouch } from '../engine/shadow/pure/skip-touch';
import type { Cue, PuppetScene } from '../engine/stage/puppet/puppet-scene';
import { ScenePlayer } from '../engine/stage/puppet/scene-player';
import { StoryDirector } from '../engine/stage/story/story-director';
import { SleepHint } from '../engine/stage/story/sleep-hint';
import { JarFirefly } from '../engine/stage/story/jar-firefly';
import { STORY_STAGE } from '../engine/stage/story/story-stage';
import { LightHush } from '../engine/stage/story/light-hush';
import { IgnitionHold } from '../engine/stage/ignition';
import { writeCoverHand } from '../engine/hands/cover-hand';
import { GhostHandView } from '../engine/render/ghost-hand-view';
import { STORY_SCRIPT } from '../engine/stage/story/story-script';
import { CANDLE_MOODS, CandleMoodBlend, type CandleMoodName } from '../engine/stage/story/candle-mood';
import { FORM_S, FRIEND_PUPPETS, friendSceneTime, OUTLINE_SHAPES } from '../engine/stage/story/friend-puppet';
import { ShapeGuide } from '../engine/stage/story/shape-guide';
import { SHAPES, type Shape } from '../engine/hands/shapes';
import { Bus } from '../engine/services/audio/mixer';
import { DEFAULT_SHADOW_OPACITY } from '../engine/shadow/hand-shadow-map';
import { BACKDROP, TestStageView } from '../engine/shadow/test-stage-view';
import { GameAudio } from '../engine/services/audio/game-audio';
import { CaptioningPlayer } from '../engine/services/audio/sound-captions';
import { loadSoundFiles, soundFiles } from '../engine/services/audio/sound-files';
import { startSoundPrerender } from '../engine/services/audio/sound-prerender';
import { renderJob, type RenderedSound, type RenderJob } from '../engine/services/audio/sound-render-job';
import { TaskPool, type WorkerLike } from '../engine/services/workers/task-pool';
import { AudioEngine, type SessionEvents } from '../engine/services/audio/web-audio-engine';
import { attachSaveHooks } from '../engine/services/saves/save-hooks';
import { SaveManager } from '../engine/services/saves/save-manager';
import { browserStore, MemoryStore } from '../engine/services/saves/storage';
import { ROOM_WALL_HEIGHT_M, ROOM_WALL_WIDTH_M, STORY_SCALE, StageFrame } from '../engine/stage/stage-frame';
import { lightArea } from '../engine/shadow/stage-edge-glsl';
import { CandleLight } from '../engine/shadow/candle-light';
import { SettingsStore } from '../engine/services/settings/settings-store';
import { HandPresence } from '../engine/stage/story/hand-presence';
import { shortenAssetTimeout } from '../engine/services/assets/iwsdk-assets';
import { RoomModels } from '../engine/shadow/room-models';
import { PlacedModels, type ModelLoader } from '../engine/shadow/placed-models';
import { BEDROOM_LAYOUT_FILE, BEDROOM_PIECE_IDS, readBedroomLayout } from '../engine/shadow/bedroom-layout';
import assetManifest, { assetFiles } from './assets';
import { GLOVES, isGloveId, readGlove, saveGlove, type GloveId } from './gloves';
import { CapabilityDetector } from '../engine/xr/capabilities';
import { CapsuleHandVisual, type HandVisual } from '../engine/xr/hand-visual';
import { ModelHandVisual } from '../engine/xr/model-hand-visual';
import { HandsStatus, MAX_STEP_S } from '../engine/xr/hands-status';
import { HandRecorder, offerDownload } from '../engine/xr/hand-recorder';
import { disableIwsdkRays, hideIwsdkHandMeshes } from '../engine/xr/iwsdk-input-visuals';
import { PromptPanel } from '../engine/xr/prompt-panel';
import { clearFor } from '../engine/xr/session-mode';
import { SessionVisibility } from '../engine/xr/session-visibility';
import { XRHandReader } from '../engine/xr/xr-hands';
import { DeskFrame } from '../input-mock/desk-frame';
import { HandLab, type LabSteps, type LabStory } from '../input-mock/hand-lab';
import { MockMode } from '../input-mock/mock-mode';
import { SyntheticSource } from '../input-mock/synthetic-source';
import { createSettingsPage } from '../ui/settings-panel/settings-page';
import { SettingsScreen } from '../ui/settings-panel/settings-screen';
import type { ExtraPageItems } from '../ui/settings-panel/screen-model';
import type { DeveloperOverlay } from './developer-overlay';
import { FailureReporter } from './failure-reporter';
import { FrameTimings, SLOT } from './frame-timings';
import { mountEnterArButtonIfNeeded, type LauncherHooks } from './enter-ar-button';
import { captureOptions, loadCaptureChoice } from './capture-mode';
import { createUiSound } from './ui-sound';
import { isDeskMode, loadLaunch, switchLaunch, updateLaunch } from './launch-mode';
import { reportSource } from './report-source';
import { showNoXrNoticeIfNeeded } from './no-xr-notice';
import { hideEmulatorOfferBar } from './emulator-offer';
import { hideEmulatorExtras, listenForGizmoKey, useEmulatorHands, type EmulatedDeviceLike } from './emulator-hands';
import { CandleStep, defaultEmulatorPose, setEmulatorPose, type EmulatedRigLike } from './emulator-pose';
import { showStartFailure } from './start-failure';

const HANDS_STATE_NAMES = ['tracking', 'lost', 'unavailable'] as const;

// What the page starts as (launch-mode.ts, ADR 0018): the game, always in a session (a headset, or the emulator at a desk),
// played by the device's hands or, switched live in the Hand Lab panel, by mock ones; or the dev room editor, the one desk
// mode, with no session. The address is always the plain page; the choice is kept in the tab and changed from the page.
const launch = loadLaunch(DEBUG_TOOLS);
const desk = isDeskMode(launch.mode);
/** The longest the headset waits on black for the title to go, should the title never say it has. */
const SESSION_BLACK_FALLBACK_S = 4;
/**
 * Where the bed tray (and the candle in its middle) stands from the eyes, metres: how far ahead, and how far below. Near and low
 * (15 Nov 2026; it was 0.45 ahead, 0.5 below), so a relaxed hand is already past the flame and casts without reaching out.
 */
const TRAY_AHEAD_M = 0.38;
const TRAY_BELOW_EYES_M = 0.55;

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
    listenForGizmoKey(window, emulatedDevice); // Alt+G hides the emulator's gizmos (and its panel) for a clean view
    hideEmulatorExtras(document); // and none of its buttons this game has no use for (controllers, gaze, ...)
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

  // Shape recognition on both hands every frame; the story listens to its commits.
  const shapes = new ShapeRecognizer();
  // Lantern gestures. Nothing listens to them now that the candle stays on its saucer (only the diagnostics count them):
  // covering the flame is read by CandleView, and no lantern is set, so a resting fist near it never reads as "pause".
  const gestures = new GestureDetector();
  gestures.setLantern(null);
  let clock = 0;

  // Hand shadows land on the stage: StageFrame, the virtual room's paper wall, 2 m ahead and 1.6 x 1.0 m (ADR 0005). The
  // room editor uses the same wall as a headset; only where the head comes from differs.
  // Capture mode (five taps on the title's emblem): a clean session for recording the demo video (capture-mode.ts). The eye buffers' scale has to be set
  // before the session starts, so it is set here; the foveation is set when the session starts.
  const capture = captureOptions(loadCaptureChoice());
  if (capture.enabled && capture.scale !== null) world.renderer.xr.setFramebufferScaleFactor(capture.scale);
  const lastHead = new Float64Array(3);
  const saucerPos = new Float64Array(3);
  let lastYaw = 0;
  const stageFrame = new StageFrame();
  const stage: StagePlane = stageFrame;
  // The story's area: the same wall, drawn STORY_SCALE times the stage and centred on the wall's middle, so the memories, the
  // friend's hand and the story's words fill most of the wall. The hands' own shadows (and the captions) keep the stage.
  const storyFrame = new StageFrame();
  const lantern = new Float64Array(3);
  // Where each hand's shadow falls, as the candle casts it (real-wall.ts): for the story, the shapes' rings and the debug tools.
  // The shadow itself is drawn by the candle's light (CandleLight.hands, hand-shadow-map.ts).
  const projector = new ShadowProjector(REAL_WALL_SHADOW_SETTINGS);
  /** Where the hands' shadows are cast from this frame: behind and above the flame, so they reach the wall (real-wall.ts). */
  const castFrom = new Float64Array(3);
  // How dark the hands' shadow is drawn: `baseOpacity` at full (high contrast: 1), and this frame's strength (faint while a
  // memory plays) and softness (the sharpen effect).
  const handShadow = { baseOpacity: DEFAULT_SHADOW_OPACITY, strength: 0, softness: 1 };
  // On the room's wall the stage is the middle of the candle's round pool of light, drawn over most of the wall (stage-edge-glsl.ts).
  const lightPoolArea = new Float64Array(4);
  // Each hand's shadow sharpens as its shape is recognised (candidate), and snaps crisp on commit.
  const sharpen = new ShadowSharpen();
  // Each hand's classifier state, made once: a new object here every frame is garbage in a headset.
  const handStates = { left: shapes.left.state, right: shapes.right.state };
  // The lantern's flicker: the developer overlay's test flicker (0..1, 0 is steady) overrides it for testing; the default is
  // gentler under reduced motion.
  let flickerTest = DEBUG_TOOLS ? loadTesting().flicker : null;
  /** A test switch (the developer overlay): covering the lit flame plays the end at any point, not only in scene 7. */
  let coverEndsTest = DEBUG_TOOLS ? loadTesting().coverEnds : false;
  const flickerParam = flickerTest ?? NaN;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lanternLight = new LanternLightModel({
    amplitude: Number.isFinite(flickerParam) ? Math.min(Math.max(flickerParam, 0), 1) : reduceMotion ? 0.3 : 1,
  });
  // Follow the OS reduced-motion setting while the page is open, unless the test flicker is set.
  if (typeof matchMedia === 'function')
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      if (flickerTest === null) lanternLight.settings.amplitude = e.matches ? 0.3 : 1;
    });
  const cameraQuat = new Quaternion();
  // The candle as a real light for the room: everything in it is lit per pixel by the flame, the props cast baked shadows and
  // the hands cast theirs every frame.
  const candleLight = new CandleLight();
  const stageView = new TestStageView(candleLight.hands);
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
  // The room's painted art (wallpaper, the night and rain in the window, the moonlight on the floor), over Damon's bare room.
  const roomDressing = new RoomDressingView(bedroomLayout.layout);
  bedroomView.group.add(roomDressing.group);
  bedroomView.setWallsCovered(true); // the dressing's painted walls cover them
  roomDressing.useCandleLight(candleLight);
  bedroomView.useCandleLight(candleLight);
  bedTray.useCandleLight(candleLight);
  // Real furniture (models credited in CREDITS.md) wherever its .glb is in src/assets/models.
  const roomModels = new RoomModels((id) => id in assetManifest, bedroomLayout.layout);
  roomDressing.group.add(roomModels.group);
  // Her firefly, glowing in the jar on his desk until it leaves the jar on the wall in scene 5 (jar-firefly.ts).
  const jarFirefly = new JarFirefly();
  const jarFireflyView = new JarFireflyView();
  void roomModels.load(candleLight).then(() => jarFireflyView.setJar(roomModels.group.getObjectByName('jar') ?? null));
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
  /** asleep: the story's end (scene 7): the flame covered, then the end plays (fallAsleep: the candle out, the blinks, credits). */
  type SessionState = 'title_vr' | 'playing' | 'paused' | 'asleep';
  let sessionState: SessionState = 'title_vr';
  // Lighting the candle with the match (ignition.ts): its progress, and how near the match is so the wick can answer it.
  const ignition = new IgnitionHold();
  // The end (sleep-hint.ts): a ghost hand comes down over the candle to show that covering it is what's wanted now, growing
  // stronger if the wait goes on, and after a long wait one word on the wall.
  const sleepHint = new SleepHint();
  const ghostHand = new GhostHandView();
  const ghostFrame = createHandFrame('right');
  /** A child's hand, as the drawn gloves are. */
  const GHOST_HAND_SCALE = 0.8;
  const SLEEP_WORD = 'goodnight';
  /** How far the room's light dips while the ghost hand has the flame covered (sleep-hint.ts `dip`), as the fort went dark. */
  const GHOST_DIP = 0.35;
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
  // The puppet story (ADR 0016, docs/STORY.md): a moment after the candle is lit, once a session (and again from
  // `__wsw.playStory()` in dev), the story director plays the scenes in story-script.ts: the friend's hand shows a shape and
  // waits, the player copies it, and a memory plays in puppets. Words, if a memory has any, are written in ink by two lines.
  const puppets = new PuppetView();
  puppets.scale = STORY_SCALE;
  // The wall's edges are the theatre's screen: a place sliding on or off is cut there, not drawn into the room.
  puppets.clipToWall(ROOM_WALL_WIDTH_M / 2, ROOM_WALL_HEIGHT_M / 2);
  const storyTitle = new StoryLineView({ y: 0.42, width: 0.72 });
  const storyLine = new StoryLineView({ y: 0.3, width: 0.36 });
  const storySkip = new SkipTouch();
  /**
   * Once the candle is lit, the story waits for the player to look up at the wall (lighting it, they look down at the candle),
   * and the candle's light on the wall swells and settles to draw the eye (look-to-start.ts).
   */
  const lookToStart = new LookToStart();
  /** How much brighter the wall's light is at the top of that call (0.3: a third brighter). */
  const LOOK_CALL_LIGHT = 0.3;
  const lookEye = new Vector3();
  const lookDir = new Vector3();
  const lookEyeA = new Float64Array(3);
  const lookDirA = new Float64Array(3);
  let storyStarted = false;
  /** The player's hand shadow: faint while a memory plays, full when the story waits for a hand shape. */
  const handPresence = new HandPresence();
  // Scene 2's hush (docs/STORY.md): while the girl's hand is over the torch, the room's candle light is dimmed with it.
  const lightHush = new LightHush();
  const onStoryCue = (cue: Cue) => {
    if (cue.kind === 'mood') {
      if (cue.mood in CANDLE_MOODS) candleMood.to(cue.mood as CandleMoodName, cue.seconds);
    } else if (cue.kind === 'storm') storm.strikeNow(cue.thunderAfter, 1);
    else if (cue.kind === 'step')
      gameAudio.storyStep(cue.variant, storyFrame, cue.x, cue.y); // from where it is in the story
    else if (cue.kind === 'sound') gameAudio.storySound(cue.sound, storyFrame, cue.x, cue.y);
    else if (cue.kind === 'hush') lightHush.to(cue.level, cue.seconds);
    else if (cue.kind === 'bed')
      return; // read every frame from the story's time (story.bed), so a skip cannot lose it
    else (cue.slot === 'title' ? storyTitle : storyLine).say(cue.text, 0, cue.hold);
  };
  const story = new StoryDirector(STORY_SCRIPT, onStoryCue);
  // The friend's hand: a painted shadow of a hand making the shape (friend-puppet.ts), drawn as a puppet of its own and played
  // by time. As dark as the memories' puppets: a puppet leaves 1 - opacity of the wall's light (puppet-view.ts).
  const friendView = new PuppetView();
  friendView.scale = STORY_SCALE;
  // The friend's hand rises from below the wall, its arm running off the bottom: the wall's edge cuts it off, as it does the puppets.
  friendView.clipToWall(ROOM_WALL_WIDTH_M / 2, ROOM_WALL_HEIGHT_M / 2);
  const friendPlayers = new Map<PuppetScene, ScenePlayer>();
  // The painted hand hers is changing from (StoryDirector.friendPrevPuppet), going as the new one comes, so it never pops.
  const friendOutView = new PuppetView();
  friendOutView.scale = STORY_SCALE;
  friendOutView.clipToWall(ROOM_WALL_WIDTH_M / 2, ROOM_WALL_HEIGHT_M / 2);
  // The shape guide (shape-guide.ts): while her hand waits, a faint outline of her shape stands beside it, mirrored to face
  // hers (ghost-outline.ts: where his matching hand would go), the candle steadies and brightens as the player's hand nears
  // the shape, and her hand leans toward theirs while they hold it.
  const guide = new ShapeGuide();
  const ghostOutlines = new GhostOutlines();
  const guideView = new PuppetView();
  guideView.scale = STORY_SCALE;
  guideView.extraArt = ghostOutlines.art;
  guideView.clipToWall(ROOM_WALL_WIDTH_M / 2, ROOM_WALL_HEIGHT_M / 2);
  const guidePlayers = new Map<PuppetScene, ScenePlayer>();
  /** The ghost's painted hand: her shape's, kept while the ghost fades after she is copied. */
  let guideScene: PuppetScene | null = null;
  /** The outline's strength at its faintest and what closeness adds: a thin line, so darker than the old filled ghost was. */
  const GUIDE_FAINT = 0.35;
  const GUIDE_CLOSE = 0.15;
  /** Which hand the story follows this frame (the one nearest her shape, or else any with a shadow), and where its shadow is. */
  const HAND_SIDES = ['left', 'right'] as const;
  let followHand: 'left' | 'right' | null = null;
  let followX = NaN;
  let followY = NaN;
  // The candle's mood (candle-mood.ts): the story opens rainy and gloomy, the candle's light blue-grey; a scene can ask for
  // another (StoryScene.candle) and the light eases into it.
  const candleMood = new CandleMoodBlend();
  /** The scene whose mood (StoryScene.candle) was last asked for: a scene's mood is eased into once, as it starts. */
  let moodScene = -1;
  const startStory = (scene = 0) => {
    lookToStart.cancel();
    storyStarted = true;
    storyTitle.clear();
    storyLine.clear();
    story.start(scene);
    guide.reset();
    // Started part-way (a checkpoint), the light is already the scene's.
    const mood = STORY_SCRIPT[scene]?.candle;
    if (scene > 0 && mood) candleMood.snap(mood);
    moodScene = story.sceneIndex;
  };
  const stopStory = () => {
    lookToStart.cancel();
    story.stop();
    guide.reset();
    storyTitle.clear();
    storyLine.clear();
    puppets.hide();
    friendView.hide();
    friendOutView.hide();
  };
  const skipTips = new Float32Array(6);
  // The quality governor: when a headset's frames keep running over what its display allows, the decoration switches off a step at a
  // time (and comes back slowly), and the inspector gives the debug bar a line of what a frame costs. It watches only in a headset
  // session: on the desktop the software renderer would trip it for no reason.
  const governor = new QualityGovernor();
  const inspector = new FrameInspector(world.renderer.info, governor);
  let governorOn = false;
  let appliedLevel = 0;
  const shapeRing = new ShapeRingView();
  /** What the quality level means: the paper's scenery and the rings are switched by it here. */
  const applyGovernor = () => {
    appliedLevel = governor.level;
    stageView.backdrop = governor.isOn('backdrop') ? BACKDROP : 0;
    shapeRing.ringsOn = governor.isOn('ring');
  };
  const wallPauseView = new WallPauseView();
  world.scene.add(
    stageView.group,
    wallPauseView.group,
    bedroomView.group,
    jarFireflyView.glow.mesh,
    friendView.group,
    friendOutView.group,
    guideView.group,
    puppets.group,
    storyTitle.group,
    storyLine.group,
    captionLine.group,
    shapeRing.group,
    candleView.group,
    ghostHand.object,
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
  // Real sound files (src/assets/audio/sfx/<name>.ogg) replace their placeholders once decoded (sound-files.ts).
  const sfxFiles = soundFiles(assetFiles);
  // The other sounds are made in code; rendering them takes real time on a headset's CPU, so a worker does it ahead while the
  // title screen sits idle, and the engine finds each ready. Without workers the pool does the same on the main thread.
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
    void startSoundPrerender(soundPool, audioContextRate(), undefined, new Set(sfxFiles.map((f) => f.sound))).then(() =>
      soundPool.dispose(),
    );
  });
  if (typeof OfflineAudioContext !== 'undefined') {
    const decoder = new OfflineAudioContext(1, 1, audioContextRate());
    void loadSoundFiles(
      sfxFiles,
      (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`)))),
      (bytes) => decoder.decodeAudioData(bytes),
      (sound, buffer) => audio.setBuffer(sound, buffer),
    );
  }
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
  // default until the player moves its slider, and the developer overlay's test flicker overrides the setting for testing.
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
    handShadow.baseOpacity = settings.value.highContrast ? 1 : DEFAULT_SHADOW_OPACITY;
  };
  settings.subscribe((key) => {
    if (key === null || key === 'highContrast') applyContrast();
  });
  applyContrast();
  // The settings screen: pressed with a fingertip. The Hand Lab has a Settings button.
  // The debug menu (when the debug tools are on) is extra pages after the settings, built the first time it opens.
  const menu = new MenuPanel(settings);
  world.scene.add(menu.group);
  // The session opens on black (the title page fades to black as BEGIN is pressed). Then scene 1 begins (docs/STORY.md, "Waking"):
  // a word in the dark, and the boy's eyes open on the room in two slow blinks (wake-timeline.ts).
  const fade = new FadeView();
  const fadeHead = new Vector3();
  const wake = new WakeTimeline();
  // The rain outside: a constant loop from the window, and now and then a flash there and, after it, far thunder (storm.ts).
  const storm = new Storm();
  const windowAt = new Vector3();
  // The house at night (night-sounds.ts): between memories, now and then a creak of the floor behind him, by the door, or a gust
  // on the window.
  const nightSounds = new NightSounds();
  const creakAt = new Vector3(-1.0, 0.2, 1.0);
  const wakeView = new WakeView(wake.script.text);
  const wakeHead = new Quaternion();
  /** The wake's lids take over from the plain black (they are as black while shut). Once a session. */
  const startWake = () => {
    // A Story checkpoint may have lit the candle before the title was gone: no waking then.
    if (wake.playing || sessionState !== 'title_vr') return;
    fade.setBlack(false);
    wake.start();
  };
  launcherHooks.titleGone = startWake;
  // The end (docs/STORY.md, "Sleep"; ending-timeline.ts): once the flame is covered for good the candle goes out slowly, his
  // eyes close in a few heavy blinks (the wake's lids, backwards), the credits roll over the black, and the session ends.
  const ending = new EndingTimeline();
  const credits = new CreditsView();
  /** The candle's light on the room as the flame was covered (its occlusion then); the end dims it from there to nothing. */
  let endLightFrom = 1;
  world.scene.add(fade.group, wakeView.group, credits.group);
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
  // The pause screen in the room, shown from the Hand Lab's Menu button or the `menu` testing switch; a press on Settings opens
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
    roomDressing.place(stageDist > 0.5 ? stageDist : 2.0, bedroomView.playerZ());

    // Position bed tray and lap blanket across player's lap. The candle stands in the tray's middle, so this is where the light
    // is: near and low, so that hands held in a relaxed way in front of the body are already past the flame and cast.
    const trayX = head[0] - Math.sin(yaw) * TRAY_AHEAD_M;
    const trayY = Math.max(0.4, head[1] - TRAY_BELOW_EYES_M);
    const trayZ = head[2] - Math.cos(yaw) * TRAY_AHEAD_M;
    bedTray.place(trayX, trayY, trayZ, yaw);
    candleLight.rebake(); // the room and the tray moved: their shadows are cast again
    candleLight.aimAt(stage.origin); // its light is thrown at the wall the shadows play on

    bedTray.getCandleSaucerPosition(saucerPos);
    lantern[0] = saucerPos[0];
    lantern[1] = saucerPos[1];
    lantern[2] = saucerPos[2];

    stageView.setPool(lightArea(true, stage.origin[1], stage.width, stage.height, lightPoolArea));
    storyFrame.setStoryArea(stageFrame, STORY_SCALE, lightPoolArea[3]);
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
  // (desk-frame.ts). Made the first time the panel is asked for (the developer overlay, or a reload that had it).
  let mock: MockMode | null = null;
  let lab: HandLab | null = null;
  // The Hand Lab's Steps tab (dev, under the emulator only): ready-made setups that move the emulator's headset and hands.
  const rigDevice = emulatedDevice as EmulatedRigLike | undefined;
  const stepHeadPos = new Vector3();
  const stepHeadQuat = new Quaternion();
  const candleStep = rigDevice
    ? new CandleStep(rigDevice, {
        head: () => {
          world.camera.getWorldPosition(stepHeadPos);
          world.camera.getWorldQuaternion(stepHeadQuat);
          return {
            position: [stepHeadPos.x, stepHeadPos.y, stepHeadPos.z],
            quaternion: [stepHeadQuat.x, stepHeadQuat.y, stepHeadQuat.z, stepHeadQuat.w],
          };
        },
        rigHead: () => lastHead,
        candleFlame: () => candleView.flamePosition,
        matchFlame: () => (sessionState === 'title_vr' && titleLighter.visible ? titleLighter.flamePosition : null),
      })
    : null;
  // The hands as the player sees them in the room: a glove model (src/assets/models/hands, rigged to the WebXR joints by
  // scripts/blender/rig-glove.py) once it has loaded, the capsule gloves until then or if it cannot load. Which glove is
  // the Hand Lab's Glove row's choice, remembered in this browser (the cartoon glove by default). Shown in VR (whoever's
  // hands they are); over passthrough the real hands are visible, so it hides itself.
  const capsuleHands = new CapsuleHandVisual();
  let handVisual: HandVisual = capsuleHands;
  let passthrough = false; // set from the session's blend mode: over passthrough the real hands are visible
  world.scene.add(handVisual.object);
  candleLight.hands.setCasters(handVisual.object);
  // One visual per glove, kept once made: a model's bones are posed in place, so it cannot be set up from them again.
  const gloveVisuals = new Map<GloveId, HandVisual>([['plain', capsuleHands]]);
  let gloveId = readGlove();
  let gloveLoad = 0;
  const showHandVisual = (next: HandVisual) => {
    if (next === handVisual) return;
    next.fadeInS.set(handVisual.fadeInS);
    world.scene.remove(handVisual.object);
    handVisual = next;
    world.scene.add(next.object);
    candleLight.hands.setCasters(next.object); // the hands the player sees are the ones that cast
  };
  const chooseGlove = (id: GloveId) => {
    gloveId = id;
    saveGlove(id);
    const load = ++gloveLoad; // a later choice wins over a load still under way
    const made = gloveVisuals.get(id);
    if (made) return showHandVisual(made);
    const models = GLOVES.find((g) => g.id === id)?.models;
    if (!models) return;
    void Promise.all([manifestModels(models[0]), manifestModels(models[1])])
      .then(([left, right]) => {
        if (!left || !right || gloveVisuals.has(id)) return;
        const model = new ModelHandVisual(left, right, new Group(), candleLight);
        gloveVisuals.set(id, model);
        if (load === gloveLoad) showHandVisual(model);
      })
      .catch((e: unknown) => failures.report('glove model', e));
  };
  chooseGlove(gloveId);
  let stepStatus = '';
  const labSteps: LabSteps | undefined =
    rigDevice && candleStep
      ? {
          candle: () => {
            stepStatus = '';
            if (!world.renderer.xr.isPresenting)
              stepStatus = 'Press BEGIN first: the step moves the hands in the session.';
            else if (sessionState !== 'title_vr') stepStatus = 'The candle is already lit.';
            else candleStep.start();
          },
          reset: () => {
            candleStep.cancel();
            const pose = defaultEmulatorPose(rigDevice);
            setEmulatorPose(rigDevice, pose.head, pose.hands);
            stepStatus = 'Headset and hands are back where the emulator started.';
          },
          status: () => stepStatus || candleStep.status,
        }
      : undefined;
  /** The Story tab's jump, in the session: the waking again (only before the candle is lit), or scene `id`. */
  const jumpTo = (id: string, play: boolean): string => {
    if (id === 'wake') {
      if (sessionState !== 'title_vr') return 'The candle is lit: reload to see the waking and light it again.';
      wake.finish();
      startWake();
      return 'Waking again.';
    }
    return jumpToScene(Number(id), play);
  };
  // The Story tab: a checkpoint for the waking and for each scene of story-script.ts.
  const labStory: LabStory = {
    checkpoints: [
      { id: 'wake', label: '1 · Waking', shape: null },
      ...STORY_SCRIPT.map((sc, i) => {
        const first = sc.beats.find((b) => b.kind === 'friend');
        return { id: String(i), label: sc.title ?? sc.id, shape: first?.kind === 'friend' ? first.shape : null };
      }),
    ],
    jump: (id, play) => {
      if (world.renderer.xr.isPresenting) return jumpTo(id, play);
      // Not in the session yet: start it, as BEGIN would, then jump.
      if (!launcherHooks.begin) return 'Press BEGIN first.';
      return launcherHooks.begin().then((ok) => (ok ? jumpTo(id, play) : "Couldn't start the session."));
    },
    advance: () => {
      const b = story.beat;
      if (story.waitingForSleep) {
        if (story.sleep()) fallAsleep();
        return 'Covered the flame: asleep.';
      }
      if (b?.kind === 'friend' && story.waitingForShape) {
        story.commit(b.shape, b.x + 0.12, b.y - 0.04);
        return `Copied the ${b.shape}.`;
      }
      return 'Nothing is waiting for a shape.';
    },
    waitingFor: () => {
      const b = story.beat;
      return b?.kind === 'friend' && story.waitingForShape ? b.shape : null;
    },
    skip: () => {
      if (!story.memory?.playing) return 'No memory is playing.';
      story.skipMemory();
      return 'Skipped to the end of the memory.';
    },
    status: () => {
      if (sessionState === 'asleep')
        return ending.active ? `Asleep: the end, ${ending.time.toFixed(1)} s in.` : 'Asleep: the end is over.';
      if (sessionState === 'title_vr') return 'Not started: the candle is not lit.';
      if (!story.playing)
        return lookToStart.waiting ? 'The story starts once the wall is looked at.' : 'The story is not playing.';
      const sc = story.scenes[story.sceneIndex];
      const b = story.beat;
      const doing =
        b?.kind === 'friend'
          ? story.waitingForShape
            ? `waiting for the ${b.shape}`
            : 'the hand fading'
          : b?.kind === 'memory'
            ? `memory ${(story.memory?.time ?? 0).toFixed(1)} s`
            : b?.kind === 'sleep'
              ? 'waiting for the flame to be covered'
              : 'a pause';
      return `${sc.title ?? sc.id}: ${doing}${sessionState === 'paused' ? ' (paused)' : ''}`;
    },
  };
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
      steps: labSteps,
      story: labStory,
      gloves: {
        options: GLOVES,
        current: () => gloveId,
        choose: (id) => {
          if (isGloveId(id)) chooseGlove(id);
        },
      },
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
  }
  const handList = [hands.hands.left, hands.hands.right];
  // The right hand as drawn while it holds the matchstick (posed-hand.ts), and the lists of hands the glove draws then.
  const heldHand = new PosedHand('right', MATCH_GRIP);
  /** Seconds the held grip takes to blend to the live fingers once the candle is lit. */
  const HELD_TO_LIVE_S = 0.35;
  let heldLive = 0; // 0 the grip .. 1 the live hand
  /** Seconds the left hand takes to fade in when the candle is first lit (its fade-in after that is the usual quick one). */
  const LEFT_REVEAL_S = 1.2;
  let sinceLit = 0; // seconds since the candle was lit (0 before)
  // Before then the left is an untracked stand-in, so a left hand left drawn from an earlier session fades out.
  const titleHands = [createHandFrame('left'), heldHand.frame];
  const blendHands = [hands.hands.left, heldHand.frame];
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
  // The room editor (src/debug/room-editor.ts), chosen in the developer overlay: arranges the bedroom's static pieces in the
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
      playerSpot: bedroomView.playerSpot,
      setFullBright: (on) => {
        candleLight.fullBright = on;
      },
      // Closing the editor leaves for the game (its desk has nothing else on it).
      suspendDesk: (on) => {
        if (!on) switchLaunch('game', DEBUG_TOOLS);
      },
    });
    // The candle stands on the tray: when the tray moves, the rig is placed again so the candle (the light) follows it.
    bedTray.onPieceMoved = () => {
      if (rigPlaced) placeRig(lastHead, lastYaw);
    };
    // Moving the player's spot keeps the room still: the head goes to the spot, and the stage, the tray and the candle with it.
    bedroomView.onPlayerMoved = () => {
      if (!rigPlaced) return;
      bedroomView.group.updateMatrixWorld(true);
      const at = bedroomView.group.localToWorld(new Vector3(bedroomView.playerX(), lastHead[1], bedroomView.playerZ()));
      placeRig([at.x, lastHead[1], at.z], lastYaw);
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
    guard('sessionstart: fade', () => {
      // Black until the page's title has faded out and gone (launcherHooks.titleGone), with a fallback should it never say so.
      fade.setBlack(true);
      fade.fadeTo(1, SESSION_BLACK_FALLBACK_S, startWake);
    });
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
      ignition.reset();
      moonLift = START_MOON_LIFT;
      candleView.ignitionProgress = 0;
      candleView.lit = false;
      titleLighter.visible = false;
      wallPauseView.hide();
      stopStory();
      storyStarted = false;
      wake.finish();
      cancelEnding();
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
  /** Starts a hand recording (from the developer overlay, or a `record` testing switch preset when the session starts). */
  const armRecording = (choice: 'off' | 'free' | 'shapes') => {
    if ((recorder && !recorder.finished) || choice === 'off') return;
    if (panel) world.player.remove(panel.mesh);
    panel = null;
    recorder = HandRecorder.make(choice === 'shapes');
    recorder.onFinished = offerDownload;
    if (recorder.script) {
      panel = new PromptPanel();
      world.player.add(panel.mesh);
      panelAtStart = false;
    }
  };
  let developer: ExtraPageItems | null = null;
  let developerOverlay: DeveloperOverlay | null = null;
  // The testing switches (debug tools only), preset in the browser's storage by the probe scripts (testing-options.ts): the
  // overlays and menu screen at once, the settings panel and the recording when VR starts.
  if (DEBUG_TOOLS && debug) {
    const t = loadTesting();
    debug.showOverlay('capsules', t.shadow);
    debug.showOverlay('joints', t.joints);
    showMenuChoice(t.menu);
    world.renderer.xr.addEventListener('sessionstart', () => {
      const t = loadTesting();
      if (t.settings) setTimeout(() => void openSettings(), 1000);
      armRecording(t.record);
    });
    // The developer overlay: a panel on the page beside the emulator's own, not in the room. Debug builds only, loaded on
    // demand like the debug tools.
    const [{ developerPage }, { mountDeveloperOverlay }] = await Promise.all([
      import('./developer-page'),
      import('./developer-overlay'),
    ]);
    const page = developerPage({
      labShown: () => lab?.shown ?? false,
      showLab,
      recorder: () =>
        recorder && { shapes: recorder.script !== null, started: recorder.started, finished: recorder.finished },
      record: (shapes) => armRecording(shapes ? 'shapes' : 'free'),
      flicker: () => flickerTest,
      setFlicker: (choice) => {
        flickerTest = choice;
        saveTesting({ ...loadTesting(), flicker: choice });
        if (choice !== null) {
          settings.hold('flicker', true);
          lanternLight.settings.amplitude = choice;
        } else {
          lanternLight.settings.amplitude = reduceMotion ? 0.3 : 1; // the device default, until the player's setting applies
          settings.hold('flicker', false);
        }
      },
      coverEnds: () => coverEndsTest,
      setCoverEnds: (on) => {
        coverEndsTest = on;
        saveTesting({ ...loadTesting(), coverEnds: on });
      },
      errorCount: () => diagnostics.errorCount,
      lastError: () => diagnostics.lastError,
      openRoomEditor: () => {
        // Ending the session first saves the game (sessionend), then the page reloads into the editor.
        const session = world.renderer.xr.getSession();
        if (session) void session.end().finally(() => switchLaunch('room-editor', DEBUG_TOOLS));
        else switchLaunch('room-editor', DEBUG_TOOLS);
      },
    });
    developer = page;
    const tools = debug;
    const overlay = mountDeveloperOverlay(() => [page, ...tools.controller.pages()]);
    developerOverlay = overlay;
    tools.controller.subscribe(() => overlay.refresh()); // a key press changes the buttons' text too
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
    ignition.reset();
    candleView.matchNear = 0;
    candleView.ignitionProgress = 0;
    roomDressing.ignition = 0;
    candleView.lit = true;
    titleLighter.visible = false;
    gameAudio.candleIgnited(candleView.flamePosition);
    if (!storyStarted) lookToStart.start();
  };
  /**
   * Scene 7's end (docs/STORY.md, "Sleep"): the flame covered for good. The end plays from here (ending-timeline.ts, driven in
   * the frame): the candle goes out slowly, the eyes close, the credits roll, and the session ends.
   */
  const fallAsleep = () => {
    sessionState = 'asleep';
    endLightFrom = candleView.occlusion;
    candleView.beginGoingOut();
    candleView.resetCover();
    ending.start();
    credits.prepare();
  };
  /** Leaves the end where it is, for a jump back into the story or a new session: the candle, lids, credits and sound as normal. */
  const cancelEnding = () => {
    ending.stop();
    candleView.endGoingOut();
    credits.hide();
    wakeView.hide();
    audio.mixer.setDip(Bus.Ambience, 1);
    audio.mixer.setDip(Bus.Music, 1);
  };
  /**
   * Dev (the Hand Lab's Story tab, `__wsw.jumpTo`): plays the story from scene `index` of story-script.ts, the picture before it
   * on the wall and its light already set; the candle is lit first if it was not (the waking skipped), and a pause or the end
   * is left. With `play`, as if the player had copied the friend's shape at once, so its memory plays. Returns what it did.
   */
  const jumpToScene = (index: number, play = false): string => {
    const scene = STORY_SCRIPT[index];
    if (!scene) return `no scene ${index}`;
    if (sessionState === 'title_vr') {
      wake.finish();
      wakeView.hide();
      fade.setBlack(false);
      igniteCandle();
    } else if (sessionState !== 'playing') {
      cancelEnding();
      wallPauseView.hide();
      fade.setBlack(false);
      sessionState = 'playing';
      candleView.resetCover();
      candleView.lit = true;
      audio.mixer.setLift(Bus.Ambience, 1.0);
      audio.mixer.setLift(Bus.Music, 1.0);
    }
    startStory(index);
    const b = story.beat;
    if (play && b?.kind === 'friend') story.commit(b.shape, b.x + 0.12, b.y - 0.04);
    return `${scene.title ?? scene.id}${play ? ', playing' : ''}`;
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
      if (fade.alpha > 0 || fade.fading) {
        world.camera.getWorldPosition(fadeHead);
        fade.update(step, fadeHead);
      }
      if (wake.playing) {
        wake.update(step);
        world.camera.getWorldPosition(fadeHead);
        world.camera.getWorldQuaternion(wakeHead);
        wakeView.update(wake.lid, wake.text, fadeHead, wakeHead, wake.friend);
      }
      if (ending.active) {
        // The end (fallAsleep): it holds still while the headset's menu is up, like the rest of the game.
        ending.update(paused ? 0 : step);
        world.camera.getWorldPosition(fadeHead);
        world.camera.getWorldQuaternion(wakeHead);
        wakeView.update(ending.lid, 0, fadeHead, wakeHead, 0);
        candleView.goingOut = 1 - ending.candle;
        if (ending.out) candleView.lit = false; // the flame is gone: its sound stops and the room's light draws in
        if (ending.snuff) gameAudio.snuff(candleView.flamePosition); // the flame hisses as it gutters under his hand
        if (ending.yawn) gameAudio.yawn(saucerPos); // his eyes grow heavy: a yawn, from his lap
        if (ending.breath) gameAudio.breath(saucerPos); // one slow breath as his eyes close
        audio.mixer.setDip(Bus.Ambience, ending.rain);
        audio.mixer.setDip(Bus.Music, ending.music);
        if (ending.creditsStart) {
          world.camera.getWorldDirection(settingsLook);
          credits.place(fadeHead, settingsLook.x, settingsLook.z);
        }
        credits.update(ending.credits, ending.creditsShowing, ending.thanks);
        // All over: back to the title page (the session's end puts everything back for the next one).
        if (ending.done) void world.renderer.xr.getSession()?.end();
      }
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
      // The right hand holds the matchstick in a set grip until the candle is lit, then its fingers blend to the live ones.
      heldLive = sessionState === 'title_vr' ? 0 : Math.min(1, heldLive + step / HELD_TO_LIVE_S);
      heldHand.update(hands.hands.right, heldLive);
      sinceLit = sessionState === 'title_vr' ? 0 : sinceLit + step;
      handVisual.fadeInS[0] = sinceLit < LEFT_REVEAL_S ? LEFT_REVEAL_S : FADE_IN_S;
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
          candleView.updateInteraction(hands.hands, step);
        } catch (e) {
          failures.report('candle cover', e);
        }
        world.camera.getWorldQuaternion(cameraQuat);
        // The Steps tab's candle step: moves the emulator's right hand until its match is over the wick (dev only).
        candleStep?.frame();
        if (sessionState === 'title_vr') {
          titleLighter.visible = true;
          titleLighter.update(heldHand.frame, cameraQuat, clock);

          // Only the matchstick's flame lights the candle: a bare hand near the wick does not.
          let matchDistance = Infinity;
          if (hands.hands.right.tracked && hands.hands.right.validJoints >= 5) {
            const dlx = titleLighter.flamePosition[0] - candleView.flamePosition[0];
            const dly = titleLighter.flamePosition[1] - candleView.flamePosition[1];
            const dlz = titleLighter.flamePosition[2] - candleView.flamePosition[2];
            matchDistance = Math.sqrt(dlx * dlx + dly * dly + dlz * dlz);
          }
          // The room editor has no hands: its room is lit, as the editor needs to see it.
          if (desk) matchDistance = 0;
          const caught = ignition.update(step, matchDistance);
          // The wick brightens and the match's flame leans to it as it comes near, before it is close enough to catch.
          candleView.matchNear = ignition.near;
          titleLighter.setLean(candleView.flamePosition, ignition.near);
          candleView.ignitionProgress = ignition.progress;
          roomDressing.ignition = ignition.progress; // the room starts to glow as the wick is held

          if (caught) igniteCandle();
        } else {
          titleLighter.visible = false;
          if (sessionState === 'playing') {
            if (candleView.isCovered && story.sleep()) fallAsleep();
            else if (candleView.isCovered && coverEndsTest) {
              // The test switch: the end, wherever the story is.
              stopStory();
              fallAsleep();
            } else if (candleView.isCovered) {
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
          projector.update(hands.hands, stage, castPoint(stage, candleView.flamePosition, castFrom));
          if (!paused) {
            gameAudio.onShapeEvents(shapes.events, projector.shadows, stage);
            shapeRing.onShapeEvents(shapes.events, projector.shadows);
          }
          // Full when the story calls for a hand (or none is playing, or a menu needs it); faint while a memory plays.
          // High contrast keeps it fully solid throughout.
          const handCalled =
            sessionState !== 'playing' ||
            !story.playing ||
            (story.waitingForShape && story.friendOpacity > 0) ||
            story.waitingForSleep;
          const handLevel = settings.value.highContrast ? 1 : handPresence.update(step, handCalled, story.handHidden);
          // The hands' shadow is cast by the candle (drawn after the hands are posed, below): how dark it is, and how soft (a
          // recognised shape sharpens it). The candle's own dimming (a hand near the flame) is the light's, so not counted here.
          // The debug tools' shadow switch (Alt+1) holds it hidden.
          const shadowOn = shadowsVisible && !(debug && !debug.controller.systems.shadow);
          handShadow.strength = shadowOn ? handShadow.baseOpacity * handLevel : 0;
          handShadow.softness = Math.min(sharpen.look.left.blurScale, sharpen.look.right.blurScale);
          shapeRing.update(
            paused ? 0 : step,
            stage,
            shadowsVisible ? handShadow.baseOpacity * candleView.occlusion * handLevel : 0,
          );
          // The captions' line on the wall: it waits while paused and is not shown under a menu.
          const lineOpacity = shadowsVisible && !menu.group.visible ? handShadow.baseOpacity * candleView.occlusion : 0;
          captionLine.update(paused || sessionState !== 'playing' ? 0 : step, stage, lineOpacity);
          // The puppet story: it holds still while paused (the flame covered) and its shadows go with the candle's light.
          const storyStep = paused || sessionState !== 'playing' ? 0 : step;
          if (lookToStart.waiting || lookToStart.pulse > 0) {
            world.camera.getWorldPosition(lookEye);
            world.camera.getWorldDirection(lookDir);
            lookEyeA[0] = lookEye.x;
            lookEyeA[1] = lookEye.y;
            lookEyeA[2] = lookEye.z;
            lookDirA[0] = lookDir.x;
            lookDirA[1] = lookDir.y;
            lookDirA[2] = lookDir.z;
            const looking = looksAtStage(stage, lookEyeA, lookDirA, ROOM_WALL_WIDTH_M / 2, ROOM_WALL_HEIGHT_M / 2);
            if (lookToStart.update(storyStep, looking)) startStory();
          }
          // A commit of the shape the friend's hand shows moves the story on, its memory starting where the player's shadow is.
          if (storyStep > 0 && story.waitingForShape)
            for (let i = 0; i < shapes.events.count; i++) {
              const e = shapes.events.at(i);
              if (e.type !== 'commit') continue;
              const sh = projector.shadows[e.hand];
              const o = JOINT['middle-finger-phalanx-proximal'] * 2;
              if (story.commit(e.shape, sh.active ? sh.joints[o] : NaN, sh.active ? sh.joints[o + 1] : NaN)) break;
            }
          // The hand the story follows: while her hand waits on a shape, the one nearer to making it; else any with a shadow.
          const target = story.waitingForShape ? story.friendShape : null;
          const ti = target === null ? -1 : SHAPES.indexOf(target);
          let margin = -Infinity;
          let hold = 0;
          followHand = null;
          for (const side of HAND_SIDES) {
            if (!projector.shadows[side].active) continue;
            const m = ti >= 0 ? shapes[side].margins[ti] : -Infinity;
            if (followHand === null || m > margin) {
              followHand = side;
              margin = m;
            }
            const st = shapes[side].state;
            if (target !== null)
              hold = Math.max(hold, st.committed === target ? 1 : st.candidate === target ? st.progress : 0);
          }
          followX = followY = NaN;
          let followShape: Shape | null = null;
          if (followHand !== null) {
            const sh = projector.shadows[followHand];
            // The ghost of a flat hand stands on its wrist, the others are placed by the middle of the hand.
            const wristAnchored = story.friendPuppet === 'flat' || story.friendPuppet === 'wave';
            const o = JOINT[wristAnchored && !story.mirroring ? 'wrist' : 'middle-finger-phalanx-proximal'] * 2;
            followX = sh.joints[o];
            followY = sh.joints[o + 1];
            followShape = shapes[followHand].state.committed;
          }
          story.follow(followX, followY, followShape);
          story.update(storyStep);
          guide.update(
            storyStep,
            story.friendShowing,
            margin,
            hold,
            followX,
            followY,
            story.friendX + story.friendDX,
            story.friendY,
            story.guideX,
            story.guideY,
            story.friendGuide,
          );
          // The friend's hand, while it shows its shape and while it fades.
          const friendScene = story.friendPuppet !== null ? FRIEND_PUPPETS[story.friendPuppet] : undefined;
          // The outline is the shape's plain hand, the way it is recognised, not her puppet hand (OUTLINE_SHAPES).
          if (friendScene && story.friendShowing)
            guideScene = (story.friendShape !== null ? OUTLINE_SHAPES[story.friendShape] : undefined) ?? friendScene;
          // How dark her hand's shadow is; how much of it is there (fading, changing shape) goes in separately, so a fading hand
          // covers the scenery less rather than paling over it (PuppetView.update).
          const friendLight = shadowsVisible ? handShadow.baseOpacity * candleView.occlusion : 0;
          if (friendScene && story.friendOpacity > 0.001) {
            let fp = friendPlayers.get(friendScene);
            if (!fp) friendPlayers.set(friendScene, (fp = new ScenePlayer(friendScene)));
            fp.offset[0] = story.friendX + story.friendDX + guide.leanX;
            fp.offset[1] = story.friendY + story.friendDY + guide.leanY - story.friendDrop;
            fp.seek(friendSceneTime(story.friendShapeT));
            friendView.load(friendScene);
            friendView.update(fp, storyFrame, friendLight, story.friendOpacity * story.friendSwapIn);
          } else friendView.hide();
          // The hand it is changing from, held in its last pose where hers is now, going.
          const outScene = story.friendPrevPuppet !== null ? FRIEND_PUPPETS[story.friendPrevPuppet] : undefined;
          if (outScene && outScene !== friendScene && story.friendSwapOut > 0.001 && story.friendOpacity > 0.001) {
            let op = friendPlayers.get(outScene);
            if (!op) friendPlayers.set(outScene, (op = new ScenePlayer(outScene)));
            op.offset[0] = story.friendX + story.friendDX + guide.leanX;
            op.offset[1] = story.friendY + story.friendDY + guide.leanY - story.friendDrop;
            op.seek(friendSceneTime(story.friendPrevShapeT));
            friendOutView.load(outScene);
            friendOutView.update(op, storyFrame, friendLight, story.friendOpacity * story.friendSwapOut);
          } else friendOutView.hide();
          // The outline of her shape beside her hand, facing it: a frame for the player's shadow to fill.
          if (guideScene && guide.presence > 0.001) {
            // Her shape as made, held still (baked once per shape).
            const outline = ghostOutlines.get(guideScene, friendSceneTime(FORM_S));
            let gp = guidePlayers.get(outline);
            if (!gp) guidePlayers.set(outline, (gp = new ScenePlayer(outline)));
            gp.offset[0] = guide.x;
            gp.offset[1] = guide.y;
            gp.seek(0);
            guideView.load(outline);
            // Faint on the paper; over scenery it covers, a paler line through it, so it reads as in front.
            const strength = GUIDE_FAINT + GUIDE_CLOSE * guide.closeness;
            guideView.update(
              gp,
              storyFrame,
              shadowsVisible ? handShadow.baseOpacity * strength * candleView.occlusion : 0,
              guide.presence,
            );
          } else guideView.hide();
          const memory = story.memory;
          if (memory) {
            puppets.load(memory.scene);
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
            if (storyStep > 0 && storySkip.update(storyStep, skipTips, tips, stage)) story.skipMemory();
            puppets.update(memory, storyFrame, lineOpacity);
          } else puppets.hide();
          storyTitle.update(storyStep, storyFrame, lineOpacity);
          storyLine.update(storyStep, storyFrame, lineOpacity);
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
        // The shape guide: the flame steadies and burns up as the player's hand nears her shape.
        lanternLight.steady = guide.steady;
        lanternLight.boost = guide.boost;
        lanternLight.update(clock, rigPlaced ? candleView.flamePosition : null, candleView.lit);
        world.camera.getWorldQuaternion(cameraQuat);
        // The candle's light on the room: shaded by a hand near the flame, hushed with the torch in scene 2 (a skipped or
        // stopped memory puts it back), and dipping under scene 7's ghost hand (last frame's); at the end, dimming from where
        // the cover left it.
        if (!story.memory?.playing) lightHush.reset();
        else lightHush.update(paused ? 0 : step);
        const roomLight = ending.active
          ? endLightFrom * ending.candle
          : candleView.occlusion * lightHush.level * (1 - GHOST_DIP * sleepHint.dip);
        stageView.applyLight(
          lanternLight.light,
          cameraQuat,
          roomLight * (1 + LOOK_CALL_LIGHT * lookToStart.pulse),
          candleView.flamePosition,
          step,
        );
        world.camera.getWorldPosition(settingsHead);
        stageView.setHead(settingsHead);
        bedroomView.update(lanternLight.light, cameraQuat, candleView.lit ? roomLight : 0);
        // Waiting to be lit, the candle holds a small, bright pool of light round itself, to draw the eye to it.
        roomDressing.waiting = sessionState === 'title_vr';
        // The storm moves on only in the story (not on the title, not paused); its flash lights the window.
        storm.update(sessionState === 'playing' ? step : 0);
        roomDressing.lightning = storm.flash;
        roomDressing.update(lanternLight.light, candleView.lit ? roomLight : 0, candleView.flamePosition);
        // The room is dark until the candle is lit; then its light spreads out from the flame to the walls, and draws
        // back when the flame is covered (the pause).
        roomDressing.spread(candleView.lit, step);
        if (ending.active)
          moonLift = ending.moon; // the end: the moon dims as he falls asleep, as it rose when the candle caught
        else if (sessionState !== 'title_vr' && moonLift !== 1) {
          const settle = (step * Math.abs(START_MOON_LIFT - 1)) / MOON_SETTLE_S;
          moonLift = moonLift > 1 ? Math.max(1, moonLift - settle) : Math.min(1, moonLift + settle);
        }
        candleLight.setMoon(moonLift);
        if (story.sceneIndex !== moodScene) {
          moodScene = story.sceneIndex;
          const askedMood = story.candleMood;
          if (askedMood) candleMood.to(askedMood);
        }
        candleMood.update(step);
        const glow = 1 + guide.boost;
        candleLight.setColour(candleMood.light[0] * glow, candleMood.light[1] * glow, candleMood.light[2] * glow);
        stageView.setTint(candleMood.wall[0], candleMood.wall[1], candleMood.wall[2]);
        candleView.setMoodTint(candleMood.flame[0], candleMood.flame[1], candleMood.flame[2]);
        candleLight.bakeIfDirty(world.renderer, world.scene);
        // While paused the rain holds still (the head still moves the layers), and the dust, shaft and sparkles are skipped.
        roomDressing.tick(sessionState === 'paused' ? 0 : step, settingsHead);
        // The end: covering the flame puts it out (no pause ring), and a ghost hand shows that it is what's wanted now.
        const sleepWait = sessionState === 'playing' && story.waitingForSleep;
        candleView.sleepMode = sleepWait;
        sleepHint.update(paused ? 0 : step, sleepWait, 1 - candleView.occlusion, candleView.coverProgress);
        if (sleepHint.sayWord) storyLine.say(SLEEP_WORD, 0, 6);
        if (sleepHint.ghost > 0) {
          // Its fingers point away from the player, toward the wall.
          const fl = candleView.flamePosition;
          writeCoverHand(
            fl,
            sleepHint.lift,
            fl[0] - settingsHead.x,
            fl[2] - settingsHead.z,
            ghostFrame,
            GHOST_HAND_SCALE,
          );
        }
        ghostHand.update(ghostFrame, sleepHint.ghost);
        candleView.update(lanternLight.light, cameraQuat);
        const shown = story.memory;
        jarFirefly.update(
          paused ? 0 : step,
          shown !== null && shown.scene === STORY_STAGE ? shown.time : null,
          sessionState === 'title_vr',
        );
        jarFireflyView.update(jarFirefly.glow, jarFirefly.x, jarFirefly.y, jarFirefly.z, cameraQuat);
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
        roomDressing.windowPoint(windowAt);
        gameAudio.setRain(true, windowAt);
        // The music, from the candle's lighting through the end (its fall and return there are the ending's dips on Bus.Music).
        gameAudio.setMusic(sessionState !== 'title_vr');
        // The storm's thunder, and the one in the black that wakes him (scene 1).
        if (storm.thunder || wake.thunder) gameAudio.thunder(windowAt);
        // The story's bed (crickets at dusk, wind on the empty wall), from the wall.
        gameAudio.setStoryBed(sessionState === 'playing' || sessionState === 'paused' ? story.bed : null, storyFrame);
        // The house between memories: not while a memory plays, not on the title, not paused, not in the end.
        nightSounds.update(step, sessionState === 'playing' && !story.memoryPlaying);
        const night = nightSounds.fired;
        if (night) gameAudio.nightSound(night, night === 'gust' ? windowAt : creakAt);
        if (wake.covers) gameAudio.covers(saucerPos); // he sits up: the covers slide, at his lap
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
        // Before the candle is lit only the right hand is drawn, holding the matchstick (lit by its flame); once it is
        // lit the left fades in and the right's fingers blend to the live ones.
        const titleNow = sessionState === 'title_vr';
        handVisual.update(
          titleNow ? titleHands : heldLive < 1 ? blendHands : handList,
          step,
          titleNow ? titleLighter.flamePosition : rigPlaced && candleView.lit ? candleView.flamePosition : null,
          !paused,
          handEye,
        );
        // The hands as posed this frame cast their shadow from the flame onto the room (hand-shadow-map.ts).
        candleLight.hands.update(
          world.renderer,
          world.scene,
          rigPlaced && candleView.lit ? castPoint(stage, candleView.flamePosition, castFrom) : null,
          handShadow.strength,
          handShadow.softness,
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
        /** The developer overlay's buttons (debug builds), for the probes. */
        get developer() {
          return developer;
        },
        get developerOverlay() {
          return developerOverlay;
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
        handShadow,
        captionLine,
        soundPool,
        governor,
        inspector,
        shapeRing,
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
        get handVisual() {
          return handVisual;
        },
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
        story,
        puppets,
        friendView,
        guide,
        /** Plays the story from scene `scene` of story-script.ts (0, scene 2, by default; the candle must be lit to see it). */
        playStory: (scene = 0) => startStory(scene),
        /** Jumps to scene `index` of story-script.ts (0 is scene 2), lighting the candle if need be; `play` copies its shape. */
        jumpTo: (index: number, play = false) => jumpToScene(index, play),
        /** Eases the candle's light into a mood ('rainy', 'warm'; candle-mood.ts), to try one. */
        candleMood: (mood: CandleMoodName, seconds?: number) => candleMood.to(mood, seconds),
        /** As if the player's hand had committed `shape` (e.g. 'rabbit') with its shadow at x, y on the wall. */
        commitShape: (shape: Parameters<StoryDirector['commit']>[0], x = 0.1, y = 0.05) => story.commit(shape, x, y),
        /** Plays the end now (the candle going out, the blinks, the credits, back to the title), the story stopped. */
        playEnding: () => {
          if (sessionState !== 'playing') return 'Light the candle first (and not while paused or already asleep).';
          stopStory();
          fallAsleep();
          return 'The end is playing.';
        },
        ending,
        credits,
        /** Plays scene 1's waking (the blinks) again. */
        playWake: () => {
          wake.finish();
          startWake();
        },
        wake,
        storm,
        /** A lightning flash in the window now, and its thunder a few seconds later (while the story plays). */
        thunder: () => storm.strikeNow(),
        /** Debug: lights everything fully (true) or as in the game (false); with no argument, flips it. */
        fullBright: (on?: boolean) => {
          candleLight.fullBright = on ?? !candleLight.fullBright;
          return candleLight.fullBright;
        },
        /** How strongly the candle catches the walls' plaster (0 flat; default BUMP_STRENGTH): try it live. Returns it. */
        wallBump: (strength?: number) => {
          const u = candleLight.uniforms.uCandleBumpStrength;
          if (typeof strength === 'number' && strength >= 0) u.value = strength;
          return u.value;
        },
      },
    });
}
