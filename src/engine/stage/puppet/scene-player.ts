// Plays a PuppetScene: keeps its clock, samples every track into each part's local pose, chains the parts through their parents
// into stage space, and fires the cues it passes. The pose is a pure function of the time, so a skip or a seek cannot leave a
// part half-way. Everything is compiled into flat arrays when the scene is loaded; a frame allocates nothing.
import { POSE_STRIDE, PROPS, validateScene, type Cue, type Ease, type PuppetScene } from './puppet-scene';

const EASE: Readonly<Record<Ease, number>> = { linear: 0, smooth: 1, in: 2, out: 3, step: 4 };
/** The longest step one update takes, seconds: a stall (the headset off) does not jump the story on. */
const MAX_DT_S = 0.1;

function ease(kind: number, k: number): number {
  switch (kind) {
    case 1:
      return k * k * (3 - 2 * k);
    case 2:
      return k * k;
    case 3:
      return 1 - (1 - k) * (1 - k);
    case 4:
      return 0;
    default:
      return k;
  }
}

export class ScenePlayer {
  readonly scene: PuppetScene;
  /** Each part's pose relative to its parent: x, y, angle, scale, opacity (POSE_STRIDE floats a part). */
  readonly local: Float32Array;
  /** Each part's pose on the stage, its parents applied (scale and opacity multiply down the chain). */
  readonly world: Float32Array;
  /** Each part's parent index, or -1. */
  readonly parents: Int16Array;
  /**
   * Added to each part's local x and y (2 floats a part; zeros unless set): the story moves a part off its keyed place with
   * this, e.g. to start a puppet where the player's shadow was and ease it home. Read on the next seek or update.
   */
  readonly offset: Float32Array;
  /**
   * Added to each part's local angle (1 float a part; zeros unless set): the story turns a part off its keyed angle with this, e.g.
   * the friend's palm tilting as her hand goes down. Read on the next seek or update.
   */
  readonly spin: Float32Array;
  private readonly index: ReadonlyMap<string, number>;
  private readonly rest: Float32Array;
  // The tracks, flattened: for track i, its part's pose slot, and its keys at keyStart[i] .. keyStart[i + 1].
  private readonly trackSlot: Int32Array;
  private readonly keyStart: Int32Array;
  private readonly keyT: Float32Array;
  private readonly keyV: Float32Array;
  private readonly keyEase: Uint8Array;
  private readonly wobbleSlot: Int32Array;
  private readonly wobble: Float32Array; // amp, period, phase
  private readonly cues: readonly Cue[];
  private nextCue = 0;
  private clock = 0;
  /** Where the stretch playing ends (the scene's length unless startAt said otherwise). */
  private end = 0;
  /** Seconds the wobbles have run on past the clock while it held still (idle), so they never jump back. */
  private wobbleExtra = 0;
  private active = false;
  private onCue: ((cue: Cue) => void) | null = null;
  private onDone: (() => void) | null = null;

  constructor(scene: PuppetScene) {
    const problems = validateScene(scene);
    if (problems.length) throw new Error(`puppet scene ${scene.id}: ${problems.join('; ')}`);
    this.scene = scene;
    const n = scene.parts.length;
    const index = new Map(scene.parts.map((p, i) => [p.id, i]));
    this.local = new Float32Array(n * POSE_STRIDE);
    this.world = new Float32Array(n * POSE_STRIDE);
    this.rest = new Float32Array(n * POSE_STRIDE);
    this.parents = new Int16Array(n);
    this.offset = new Float32Array(n * 2);
    this.spin = new Float32Array(n);
    this.index = index;
    scene.parts.forEach((p, i) => {
      this.parents[i] = p.parent === undefined ? -1 : (index.get(p.parent) as number);
      const o = i * POSE_STRIDE;
      this.rest[o] = p.x ?? 0;
      this.rest[o + 1] = p.y ?? 0;
      this.rest[o + 2] = p.angle ?? 0;
      this.rest[o + 3] = p.scale ?? 1;
      this.rest[o + 4] = p.opacity ?? 1;
    });
    const slot = (part: string, prop: (typeof PROPS)[number]) =>
      (index.get(part) as number) * POSE_STRIDE + PROPS.indexOf(prop);
    const tracks = scene.tracks;
    this.trackSlot = new Int32Array(tracks.length);
    this.keyStart = new Int32Array(tracks.length + 1);
    const keyCount = tracks.reduce((s, t) => s + t.keys.length, 0);
    this.keyT = new Float32Array(keyCount);
    this.keyV = new Float32Array(keyCount);
    this.keyEase = new Uint8Array(keyCount);
    let k = 0;
    tracks.forEach((tr, i) => {
      this.trackSlot[i] = slot(tr.part, tr.prop);
      this.keyStart[i] = k;
      for (const [t, v, e] of tr.keys) {
        this.keyT[k] = t;
        this.keyV[k] = v;
        this.keyEase[k] = EASE[e ?? 'linear'];
        k++;
      }
    });
    this.keyStart[tracks.length] = k;
    const wobbles = scene.wobbles ?? [];
    this.wobbleSlot = new Int32Array(wobbles.length);
    this.wobble = new Float32Array(wobbles.length * 3);
    wobbles.forEach((w, i) => {
      this.wobbleSlot[i] = slot(w.part, w.prop);
      this.wobble[i * 3] = w.amp;
      this.wobble[i * 3 + 1] = w.period;
      this.wobble[i * 3 + 2] = w.phase ?? 0;
    });
    this.cues = scene.cues ?? [];
    this.end = scene.length;
    this.seek(0);
  }

  get playing(): boolean {
    return this.active;
  }

  /** The index of the part called `id`, or -1. */
  partIndex(id: string): number {
    return this.scene.parts.findIndex((p) => p.id === id);
  }

  /** Seconds into the scene. */
  get time(): number {
    return this.clock;
  }

  /** Plays it from the start (one already playing starts over). `onCue` hears each cue as the clock passes it. */
  start(onCue?: (cue: Cue) => void, onDone?: () => void): void {
    this.wobbleExtra = 0;
    this.startAt(0, this.scene.length, onCue, onDone);
  }

  /**
   * Plays the stretch from `from` to `to` seconds (a chapter of a longer scene), firing the cues in it. The wobbles carry on
   * from where they were, so a stretch that starts where the last one ended goes on without a jump.
   */
  startAt(from: number, to: number, onCue?: (cue: Cue) => void, onDone?: () => void): void {
    this.onCue = onCue ?? null;
    this.onDone = onDone ?? null;
    this.active = true;
    this.end = Math.min(to, this.scene.length);
    this.nextCue = 0;
    while (this.nextCue < this.cues.length && this.cues[this.nextCue].t < from) this.nextCue++;
    this.seek(from);
    this.fireCues();
  }

  /** Once per frame (0 while paused: the scene holds still). */
  update(dt: number): void {
    if (!this.active) return;
    if (dt > 0) this.seek(Math.min(this.clock + Math.min(dt, MAX_DT_S), this.end));
    this.fireCues();
    if (this.clock >= this.end) this.finish();
  }

  /**
   * Once per frame while it is not playing but still on the wall: the picture holds where it stopped, and only its wobbles
   * (a torch's light, the kids breathing) go on, so it is paused, not frozen.
   */
  idle(dt: number): void {
    if (this.active || dt <= 0) return;
    this.wobbleExtra += Math.min(dt, MAX_DT_S);
    this.seek(this.clock);
  }

  /** Ends it now, posed at the end of its stretch, without the cues still to come. */
  skip(): void {
    if (!this.active) return;
    this.seek(this.end);
    this.finish();
  }

  /** Poses every part for `t` seconds in, firing nothing. */
  seek(t: number): void {
    this.clock = t < 0 ? 0 : t;
    const now = this.clock;
    const local = this.local;
    local.set(this.rest);
    for (let i = 0; i < this.trackSlot.length; i++) local[this.trackSlot[i]] = this.sample(i, now);
    const wobbleT = now + this.wobbleExtra;
    for (let i = 0; i < this.wobbleSlot.length; i++) {
      const w = i * 3;
      local[this.wobbleSlot[i]] +=
        this.wobble[w] * Math.sin((2 * Math.PI * wobbleT) / this.wobble[w + 1] + this.wobble[w + 2]);
    }
    const offset = this.offset;
    for (let i = 0; i < this.parents.length; i++) {
      local[i * POSE_STRIDE] += offset[i * 2];
      local[i * POSE_STRIDE + 1] += offset[i * 2 + 1];
      local[i * POSE_STRIDE + 2] += this.spin[i];
    }
    const world = this.world;
    for (let i = 0; i < this.parents.length; i++) {
      const o = i * POSE_STRIDE;
      const p = this.parents[i];
      if (p < 0) {
        for (let j = 0; j < POSE_STRIDE; j++) world[o + j] = local[o + j];
        continue;
      }
      // The child's offset is in its parent's frame: turned by the parent's angle and scaled with it.
      const q = p * POSE_STRIDE;
      const c = Math.cos(world[q + 2]),
        s = Math.sin(world[q + 2]),
        sc = world[q + 3];
      const lx = local[o],
        ly = local[o + 1];
      world[o] = world[q] + (c * lx - s * ly) * sc;
      world[o + 1] = world[q + 1] + (s * lx + c * ly) * sc;
      world[o + 2] = world[q + 2] + local[o + 2];
      world[o + 3] = sc * local[o + 3];
      world[o + 4] = world[q + 4] * local[o + 4];
    }
  }

  /** The index of the part named `id` (for `offset` and `spin`), or -1. Allocates nothing. */
  indexOf(id: string): number {
    return this.index.get(id) ?? -1;
  }

  private sample(track: number, t: number): number {
    const a = this.keyStart[track],
      b = this.keyStart[track + 1] - 1;
    const T = this.keyT,
      V = this.keyV;
    if (t <= T[a]) return V[a];
    if (t >= T[b]) return V[b];
    let k = a + 1;
    while (T[k] < t) k++;
    const span = T[k] - T[k - 1];
    const f = span > 0 ? ease(this.keyEase[k], (t - T[k - 1]) / span) : 1;
    return V[k - 1] + (V[k] - V[k - 1]) * f;
  }

  private fireCues(): void {
    while (this.nextCue < this.cues.length && this.cues[this.nextCue].t <= this.clock) {
      const cue = this.cues[this.nextCue++];
      this.onCue?.(cue);
    }
  }

  private finish(): void {
    this.active = false;
    const done = this.onDone;
    this.onDone = null;
    this.onCue = null;
    done?.();
  }
}
