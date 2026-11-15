// Plain Web Audio for the game's sounds (the choice and its reasons are in docs/adr/0008-audio.md).
//
//   one-shot sources -> voice gain -> panner (HRTF) -> bus gain (music | effects | ambience) -> master -> output
//   a flat sound (the music) -> its own gain -> bus gain -> ...      (no panner: the same in both ears)
//
// Browsers keep audio locked until a user gesture, so the context is made on the first gesture (or when a
// headset session starts) and sounds asked for before that are dropped, except a loop, which waits. Playing a
// sound builds one AudioBufferSourceNode (a few objects, once per sound, not per frame); `update` runs every
// frame and only writes numbers into audio parameters. No three.js and no IWSDK: the listener pose is passed
// in. Placeholder sounds are rendered in code the first time each is needed; `setBuffer` swaps in a file.
import { BUS_COUNT, Mixer, type BusId } from './mixer';
import { takeSamples } from './placeholder-sounds';
import { Cooldowns, SOUND_COUNT, SOUND_DEFS, type SoundId } from './sounds';
import { VoicePool } from './voice-pool';

export type AudioState = 'locked' | 'running' | 'suspended' | 'unavailable';

export interface AudioEngineOptions {
  mixer?: Mixer;
  /** Sounds that can play at once (one-shots); looping sounds have voices of their own. */
  voices?: number;
  /** Makes the context. Tests pass a fake; the default is the browser's AudioContext. */
  contextFactory?: () => AudioContext;
}

interface Voice {
  readonly gain: GainNode;
  readonly panner: PannerNode;
  source: AudioBufferSourceNode | null;
  /** The bus the panner (or, for a flat voice, the gain) is connected to, or -1. */
  bus: number;
  /** Not placed in the room: the gain goes straight to the bus and the panner is unused. */
  readonly flat: boolean;
}

/** What `attachSessionUnlock` needs from an XRSession. */
export interface SessionEvents {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
/** In a headset session the page gets no clicks; a pinch or squeeze arrives as these session events. */
const SESSION_GESTURES = ['selectstart', 'select', 'squeezestart'] as const;
/** Listener and moving-sound positions closer than this (metres) to the last written are not written again. */
const MOVE_EPS_M = 0.002;
/** Time constants, seconds: a loop fades in over about three times the first, and a moving sound or the listener glides over a few of the second, so a head-tracked HRTF source never steps. */
const LOOP_FADE_IN_S = 0.5;
const GLIDE_S = 0.03;
/** While locked (or after an interruption), try to start the context again this often, in frames (about 2.5 s at 72 Hz). */
const RETRY_FRAMES = 180;

export class AudioEngine {
  readonly mixer: Mixer;
  /** The final node before the speakers, for tests and meters to tap. Null until unlocked. */
  master: GainNode | null = null;
  context: AudioContext | null = null;
  /** Sounds started, and dropped because audio was locked, they came too soon after the last of their kind, or no voice was free. */
  readonly stats = { played: 0, tooSoon: 0, noVoice: 0, beforeUnlock: 0, badPosition: 0 };

  private readonly pool: VoicePool;
  private readonly cooldowns = new Cooldowns();
  private readonly buffers: (AudioBuffer | null)[] = new Array(SOUND_COUNT).fill(null);
  private readonly overrides: (AudioBuffer | null)[] = new Array(SOUND_COUNT).fill(null);
  private readonly voices: Voice[] = [];
  private readonly loops: (Voice | null)[] = new Array(SOUND_COUNT).fill(null);
  private readonly loopPos = new Float64Array(SOUND_COUNT * 3);
  private readonly loopWanted = new Uint8Array(SOUND_COUNT);
  private readonly busNodes: GainNode[] = [];
  private readonly listenerPose = new Float64Array(9).fill(NaN);
  private seenMixerVersion = -1;
  private pausedNow = false;
  private framesLocked = 0;
  private detach: (() => void) | null = null;
  private detachSession: (() => void) | null = null;

  constructor(private readonly options: AudioEngineOptions = {}) {
    this.mixer = options.mixer ?? new Mixer();
    this.pool = new VoicePool(options.voices ?? 12);
  }

  get state(): AudioState {
    const c = this.context;
    if (!c) return typeof AudioContext === 'undefined' && !this.options.contextFactory ? 'unavailable' : 'locked';
    if (c.state === 'running') return 'running';
    return this.pausedNow ? 'suspended' : 'locked';
  }

  /**
   * Makes the context and starts it. Call from inside a user gesture (a click, a key, a tap, a pinch, the Enter
   * VR button), which is what lets browsers start audio. Safe to call again. While the game is paused the
   * context is left suspended until it resumes.
   */
  unlock(): void {
    if (!this.context) {
      try {
        this.context = (this.options.contextFactory ?? (() => new AudioContext()))();
      } catch {
        return; // no Web Audio: the game goes on silent
      }
      this.build(this.context);
    }
    this.start(this.context);
  }

  /** Unlocks on the first gesture on `target` (the document), then stops listening. */
  attachGestureUnlock(target: EventTarget): void {
    this.detach?.();
    const handler = () => {
      this.unlock();
      this.detachWhenRunning(this.detach);
    };
    // Capture, so a page or IWSDK handler that stops the event cannot hide the gesture from us.
    for (const g of GESTURES) target.addEventListener(g, handler, { passive: true, capture: true });
    this.detach = () => {
      for (const g of GESTURES) target.removeEventListener(g, handler, { capture: true });
      this.detach = null;
    };
  }

  /**
   * Unlocks on the headset's own gestures during a session (a pinch is `select`), for when the session was
   * started from the browser's enter prompt and the page never saw a click. Stops listening once audio runs.
   */
  attachSessionUnlock(session: SessionEvents): void {
    this.detachSession?.();
    const handler = () => {
      this.unlock();
      this.detachWhenRunning(this.detachSession);
    };
    for (const g of SESSION_GESTURES) session.addEventListener(g, handler);
    this.detachSession = () => {
      for (const g of SESSION_GESTURES) session.removeEventListener(g, handler);
      this.detachSession = null;
    };
  }

  /** Holds all sound while the game is paused (the system menu, the headset off) and resumes it after. */
  setPaused(paused: boolean): void {
    if (paused === this.pausedNow) return;
    this.pausedNow = paused;
    const ctx = this.context;
    if (!ctx) return;
    if (paused) void ctx.suspend().catch(() => undefined);
    else this.start(ctx);
  }

  /** Uses `buffer` (a decoded file) for a sound instead of its placeholder. */
  setBuffer(id: SoundId, buffer: AudioBuffer): void {
    this.overrides[id] = buffer;
    this.buffers[id] = buffer;
  }

  /**
   * Plays a one-shot sound from the point (x, y, z), scene metres. `key` (0 or 1, for example the hand) gives
   * each its own gap between plays.
   * @returns false if it was dropped: audio is locked, it came too soon after the last of its kind, or every voice is busy with something more important.
   */
  playAt(id: SoundId, x: number, y: number, z: number, key = 0): boolean {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running') {
      this.stats.beforeUnlock++;
      return false;
    }
    // A position that is not a finite number would make the panner's parameters throw (and a throw in the frame
    // loop is costly), so the sound is dropped instead.
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) {
      this.stats.badPosition++;
      return false;
    }
    const now = ctx.currentTime;
    if (!this.cooldowns.ready(id, key, now)) {
      this.stats.tooSoon++;
      return false;
    }
    const def = SOUND_DEFS[id];
    if (def.fileOnly && !this.overrides[id]) return false; // silent until its file is in
    const slot = this.pool.acquire(def.priority, now);
    if (slot < 0) {
      this.stats.noVoice++;
      return false;
    }
    this.cooldowns.mark(id, key, now); // only a sound that plays uses up its gap
    const voice = this.voices[slot];
    if (voice.source) stop(voice.source); // a stolen voice
    this.route(voice, def.bus, def.gain, def.refDistance, def.maxDistance, x, y, z);
    const source = ctx.createBufferSource();
    source.buffer = this.bufferFor(ctx, id);
    source.connect(voice.gain);
    source.onended = () => {
      if (voice.source === source) {
        voice.source = null;
        this.pool.release(slot);
      }
    };
    voice.source = source;
    source.start();
    this.stats.played++;
    return true;
  }

  /**
   * Plays a one-shot menu sound as if from a metre in front of the listener, so it sits in the middle of the head's
   * view whatever the head is doing. Before the first `update` the listener is at the origin looking down -z.
   */
  playUi(id: SoundId, key = 0): boolean {
    const l = this.listenerPose;
    if (Number.isNaN(l[0])) return this.playAt(id, 0, 0, -1, key);
    return this.playAt(id, l[0] + l[3], l[1] + l[4], l[2] + l[5], key);
  }

  /**
   * Asks for a looping sound (the flame's crackle) to play at (x, y, z), or to stop. A request made before
   * audio is unlocked is kept and starts as soon as it is, so a flame that was lit during loading is heard.
   */
  setLoop(id: SoundId, on: boolean, x: number, y: number, z: number): void {
    if (on && !(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) return; // see playAt
    this.loopWanted[id] = on ? 1 : 0;
    if (on) {
      this.loopPos[id * 3] = x;
      this.loopPos[id * 3 + 1] = y;
      this.loopPos[id * 3 + 2] = z;
      this.startLoop(id);
      return;
    }
    const ctx = this.context;
    const voice = this.loops[id];
    if (ctx && voice?.source) {
      // Fade this voice out and let it go; a restart makes a fresh one, so two copies never share a gain.
      const source = voice.source;
      voice.source = null;
      this.loops[id] = null;
      source.onended = () => {
        voice.gain.disconnect();
        voice.panner.disconnect();
      };
      voice.gain.gain.cancelScheduledValues(ctx.currentTime);
      // A bed (SoundDef.fadeS) fades out as slowly as it came in; anything else goes in a moment.
      const fade = SOUND_DEFS[id].fadeS ?? 0.08;
      voice.gain.gain.setTargetAtTime(0, ctx.currentTime, fade);
      source.stop(ctx.currentTime + Math.max(0.5, fade * 6));
    }
  }

  private startLoop(id: SoundId): void {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.loops[id]?.source) return;
    const def = SOUND_DEFS[id];
    // A sound with no placeholder waits for its file; it stays wanted, so `update` starts it once the file is set.
    if (def.fileOnly && !this.overrides[id]) return;
    const voice = this.makeVoice(ctx, def.flat === true);
    this.loops[id] = voice;
    const p = this.loopPos;
    this.route(voice, def.bus, def.gain, def.refDistance, def.maxDistance, p[id * 3], p[id * 3 + 1], p[id * 3 + 2]);
    const source = ctx.createBufferSource();
    source.buffer = this.bufferFor(ctx, id);
    source.loop = true;
    source.connect(voice.gain);
    voice.source = source;
    // Fade in rather than start at full level: a loop that begins with the headset session is heard as a burst.
    voice.gain.gain.value = 0;
    voice.gain.gain.setTargetAtTime(def.gain, ctx.currentTime, def.fadeS ?? LOOP_FADE_IN_S);
    source.start();
  }

  /** Moves a playing loop. Cheap enough to call every frame: it writes only when the sound moved. */
  moveLoop(id: SoundId, x: number, y: number, z: number): void {
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z))) return; // see playAt
    const voice = this.loops[id];
    const p = this.loopPos;
    const i = id * 3;
    if (!voice?.source) {
      if (this.loopWanted[id] === 1) {
        p[i] = x;
        p[i + 1] = y;
        p[i + 2] = z;
      }
      return;
    }
    if (Math.abs(p[i] - x) < MOVE_EPS_M && Math.abs(p[i + 1] - y) < MOVE_EPS_M && Math.abs(p[i + 2] - z) < MOVE_EPS_M)
      return;
    p[i] = x;
    p[i + 1] = y;
    p[i + 2] = z;
    if (voice.flat) return;
    const t = this.context!.currentTime;
    voice.panner.positionX.setTargetAtTime(x, t, GLIDE_S);
    voice.panner.positionY.setTargetAtTime(y, t, GLIDE_S);
    voice.panner.positionZ.setTargetAtTime(z, t, GLIDE_S);
  }

  /**
   * Call once per frame: puts the listener at the head, applies mixer changes, starts loops that were waiting,
   * and retries starting the context every couple of seconds while it is locked. Only writes audio parameters,
   * and only the ones that changed.
   * @param pose nine numbers: the head's position, its forward direction and its up direction (unit vectors)
   */
  update(pose: ArrayLike<number>): void {
    const ctx = this.context;
    if (!ctx) return;
    for (let i = 0; i < 9; i++) if (!Number.isFinite(pose[i])) return; // keep the last good listener (see playAt)
    if (ctx.state !== 'running') {
      if (!this.pausedNow && ++this.framesLocked % RETRY_FRAMES === 0) this.start(ctx);
    } else {
      this.framesLocked = 0;
      for (let id = 0; id < SOUND_COUNT; id++)
        if (this.loopWanted[id] === 1 && !this.loops[id]?.source) this.startLoop(id as SoundId);
    }
    const l = this.listenerPose;
    if (
      Math.abs(l[0] - pose[0]) > MOVE_EPS_M ||
      Math.abs(l[1] - pose[1]) > MOVE_EPS_M ||
      Math.abs(l[2] - pose[2]) > MOVE_EPS_M ||
      Math.abs(l[3] - pose[3]) > 0.001 ||
      Math.abs(l[4] - pose[4]) > 0.001 ||
      Math.abs(l[5] - pose[5]) > 0.001 ||
      Math.abs(l[6] - pose[6]) > 0.001 ||
      Math.abs(l[7] - pose[7]) > 0.001 ||
      Math.abs(l[8] - pose[8]) > 0.001 ||
      Number.isNaN(l[0])
    ) {
      for (let i = 0; i < 9; i++) l[i] = pose[i];
      const L = ctx.listener;
      if (L.positionX) {
        const t = ctx.currentTime;
        L.positionX.setTargetAtTime(l[0], t, GLIDE_S);
        L.positionY.setTargetAtTime(l[1], t, GLIDE_S);
        L.positionZ.setTargetAtTime(l[2], t, GLIDE_S);
        L.forwardX.setTargetAtTime(l[3], t, GLIDE_S);
        L.forwardY.setTargetAtTime(l[4], t, GLIDE_S);
        L.forwardZ.setTargetAtTime(l[5], t, GLIDE_S);
        L.upX.setTargetAtTime(l[6], t, GLIDE_S);
        L.upY.setTargetAtTime(l[7], t, GLIDE_S);
        L.upZ.setTargetAtTime(l[8], t, GLIDE_S);
      } else {
        L.setPosition(l[0], l[1], l[2]); // browsers without listener parameters (older Firefox and Gecko)
        L.setOrientation(l[3], l[4], l[5], l[6], l[7], l[8]);
      }
    }
    if (this.mixer.version !== this.seenMixerVersion) {
      this.seenMixerVersion = this.mixer.version;
      for (let b = 0; b < BUS_COUNT; b++)
        this.busNodes[b].gain.setTargetAtTime(this.mixer.busGain(b as BusId), ctx.currentTime, 0.03);
    }
  }

  /** Closes the context and forgets everything built on it. `unlock` after this makes a new one. */
  dispose(): void {
    this.detach?.();
    this.detachSession?.();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.master = null;
    this.voices.length = 0;
    this.busNodes.length = 0;
    this.loops.fill(null);
    for (let i = 0; i < SOUND_COUNT; i++) this.buffers[i] = this.overrides[i];
    this.seenMixerVersion = -1;
    this.listenerPose.fill(NaN);
  }

  private start(ctx: AudioContext): void {
    if (this.pausedNow || ctx.state === 'running' || ctx.state === 'closed') return;
    void ctx.resume().catch(() => undefined);
  }

  /** Stops listening once the context is running, or as soon as it is (a resume can take a moment). */
  private detachWhenRunning(detach: (() => void) | null): void {
    const ctx = this.context;
    if (!ctx || !detach) return;
    if (ctx.state === 'running') detach();
    else
      void ctx.resume().then(
        () => this.context?.state === 'running' && detach(),
        () => undefined,
      );
  }

  private build(ctx: AudioContext): void {
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    for (let b = 0; b < BUS_COUNT; b++) {
      const node = ctx.createGain();
      node.gain.value = this.mixer.busGain(b as BusId);
      node.connect(this.master);
      this.busNodes.push(node);
    }
    this.seenMixerVersion = this.mixer.version;
    for (let i = 0; i < this.pool.size; i++) this.voices.push(this.makeVoice(ctx));
  }

  /** A sound's buffer: its file if one was set, else the placeholder, rendered the first time it is needed. */
  private bufferFor(ctx: AudioContext, id: SoundId): AudioBuffer {
    let buffer = this.buffers[id];
    if (!buffer) {
      const rate = ctx.sampleRate;
      const samples = takeSamples(id, rate);
      buffer = ctx.createBuffer(1, samples.length, rate);
      buffer.copyToChannel(samples, 0);
      this.buffers[id] = buffer;
    }
    return buffer;
  }

  private makeVoice(ctx: AudioContext, flat = false): Voice {
    const gain = ctx.createGain();
    const panner = ctx.createPanner();
    if (flat) return { gain, panner, source: null, bus: -1, flat };
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.rolloffFactor = 1;
    gain.connect(panner);
    return { gain, panner, source: null, bus: -1, flat };
  }

  private route(
    voice: Voice,
    bus: BusId,
    gain: number,
    refDistance: number,
    maxDistance: number,
    x: number,
    y: number,
    z: number,
  ): void {
    if (voice.bus !== bus) {
      const out = voice.flat ? voice.gain : voice.panner;
      out.disconnect();
      out.connect(this.busNodes[bus]);
      voice.bus = bus;
    }
    voice.gain.gain.cancelScheduledValues(0);
    voice.gain.gain.value = gain;
    if (voice.flat) return;
    voice.panner.refDistance = refDistance;
    voice.panner.maxDistance = maxDistance;
    voice.panner.positionX.value = x;
    voice.panner.positionY.value = y;
    voice.panner.positionZ.value = z;
  }
}

function stop(source: AudioBufferSourceNode): void {
  try {
    source.stop();
  } catch {
    // already stopped
  }
}
