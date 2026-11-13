// The story's running order (docs/STORY.md): each scene is a list of beats played one after another. A `friend` beat shows the
// friend's hand making a shape and waits, for as long as it takes, until the player's hand commits that shape; a `memory` beat
// plays a puppet scene (puppet-scene.ts) to its end. A memory can start one of its puppets where the player's shadow was and
// ease it to its keyed place, so the player's rabbit becomes the puppet rabbit. Plain data in story-script.ts; plain TypeScript
// here, and a frame allocates nothing.
import type { Shape } from '../../hands/shapes';
import { POSE_STRIDE, type Cue, type PuppetScene } from '../puppet/puppet-scene';
import { ScenePlayer } from '../puppet/scene-player';

/** The friend's hand shows `shape`, its shadow at `x`, `y` (metres right and up from the wall's centre), and waits. */
export interface FriendBeat {
  readonly kind: 'friend';
  readonly shape: Shape;
  readonly x: number;
  readonly y: number;
  /** Leans the fingers off straight up, radians (counter-clockwise as seen). */
  readonly tilt?: number;
}

/** A memory plays: `scene` from its start to its end. */
export interface MemoryBeat {
  readonly kind: 'memory';
  readonly scene: PuppetScene;
  /** A root part that starts where the player's committed shadow was, and eases to its keyed place over the handoff. */
  readonly from?: string;
}

export type Beat = FriendBeat | MemoryBeat;

export interface StoryScene {
  readonly id: string;
  readonly beats: readonly Beat[];
}

/** Seconds before the friend's hand starts to appear (the wall settles first), then seconds it takes to fade in. */
export const FRIEND_DELAY_S = 1.2;
export const FRIEND_IN_S = 2.5;
/** Seconds the friend's hand takes to fade once the player has copied it. */
export const FRIEND_OUT_S = 1.2;
/** Seconds a memory's `from` puppet takes to travel from the player's shadow to its own place. */
export const HANDOFF_S = 1.6;

const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** Problems with a story, as sentences (none when it is sound). */
export function validateStory(scenes: readonly StoryScene[]): string[] {
  const problems: string[] = [];
  for (const s of scenes) {
    if (s.beats.length === 0) problems.push(`${s.id} has no beats`);
    for (const b of s.beats) {
      if (b.kind !== 'memory' || b.from === undefined) continue;
      const part = b.scene.parts.find((p) => p.id === b.from);
      if (!part) problems.push(`${s.id}: ${b.scene.id} starts from ${b.from}, which is not one of its parts`);
      else if (part.parent !== undefined)
        problems.push(`${s.id}: ${b.scene.id} starts from ${b.from}, which is not a root part`);
    }
  }
  return problems;
}

export class StoryDirector {
  readonly scenes: readonly StoryScene[];
  /** The scene playing, by index, or -1. */
  sceneIndex = -1;
  /** The beat playing in it, by index. */
  beatIndex = 0;
  /** The friend's hand: the shape it is making (it stays set while it fades out), how visible it is (0..1), and seconds shown. */
  friendShape: Shape | null = null;
  friendLevel = 0;
  friendT = 0;
  friendX = 0;
  friendY = 0;
  friendTilt = 0;
  /** The memory playing, or null. */
  memory: ScenePlayer | null = null;
  private readonly players = new Map<PuppetScene, ScenePlayer>();
  private waiting = false;
  private friendWait = 0;
  private handoffPart = -1;
  private handoffT = 0;
  private handoffX = 0;
  private handoffY = 0;
  /** The shadow's place at the commit, held for the memory that follows. */
  private commitX = NaN;
  private commitY = NaN;
  private readonly onMemoryDone = () => this.next();

  constructor(
    scenes: readonly StoryScene[],
    private readonly onCue: (cue: Cue) => void = () => {},
  ) {
    const problems = validateStory(scenes);
    if (problems.length) throw new Error(`story: ${problems.join('; ')}`);
    this.scenes = scenes;
    for (const s of scenes)
      for (const b of s.beats)
        if (b.kind === 'memory' && !this.players.has(b.scene)) this.players.set(b.scene, new ScenePlayer(b.scene));
  }

  /** Whether the story is under way (a scene is playing). */
  get playing(): boolean {
    return this.sceneIndex >= 0;
  }

  /** Whether the friend's hand is waiting for the player to copy its shape. */
  get waitingForShape(): boolean {
    return this.waiting;
  }

  /** The beat playing, or null. */
  get beat(): Beat | null {
    return this.sceneIndex < 0 ? null : (this.scenes[this.sceneIndex].beats[this.beatIndex] ?? null);
  }

  /** Starts the story at scene `index` (0, the first in the script, by default), dropping whatever was playing. */
  start(index = 0): void {
    this.stop();
    if (index < 0 || index >= this.scenes.length) return;
    this.sceneIndex = index;
    this.enter(0);
  }

  /** Stops it: no hand, no memory. */
  stop(): void {
    this.memory?.skip();
    this.memory = null;
    this.sceneIndex = -1;
    this.beatIndex = 0;
    this.waiting = false;
    this.friendShape = null;
    this.friendLevel = 0;
    this.handoffPart = -1;
  }

  /**
   * The player's hand committed `shape`, its shadow at `x`, `y` on the wall (NaN if it is not known). Returns whether it was
   * the shape the friend's hand is waiting for, which moves the story on.
   */
  commit(shape: Shape, x = NaN, y = NaN): boolean {
    const b = this.beat;
    if (!this.waiting || !b || b.kind !== 'friend' || b.shape !== shape) return false;
    this.waiting = false;
    this.commitX = x;
    this.commitY = y;
    this.next();
    return true;
  }

  /** Skips the memory playing, if any, to the beat after it. */
  skipMemory(): void {
    this.memory?.skip();
  }

  /** Once per frame; 0 while paused (all of it holds still). */
  update(dt: number): void {
    if (dt <= 0) return;
    // The friend's hand: waits, fades in while it waits, fades out after.
    if (this.friendShape !== null) {
      if (this.waiting) {
        if (this.friendWait > 0) this.friendWait -= dt;
        else {
          this.friendT += dt;
          this.friendLevel = Math.min(1, this.friendLevel + dt / FRIEND_IN_S);
        }
      } else {
        this.friendT += dt;
        this.friendLevel = Math.max(0, this.friendLevel - dt / FRIEND_OUT_S);
        if (this.friendLevel === 0) this.friendShape = null;
      }
    }
    const m = this.memory;
    if (!m) return;
    if (this.handoffPart >= 0) {
      this.handoffT += dt;
      const k = 1 - smooth(this.handoffT / HANDOFF_S);
      m.offset[this.handoffPart * 2] = this.handoffX * k;
      m.offset[this.handoffPart * 2 + 1] = this.handoffY * k;
      if (k === 0) this.handoffPart = -1;
    }
    m.update(dt);
  }

  /** How visible the friend's hand is, eased (0..1). */
  get friendOpacity(): number {
    return smooth(this.friendLevel);
  }

  private next(): void {
    if (this.sceneIndex < 0) return;
    const beats = this.scenes[this.sceneIndex].beats;
    if (this.beatIndex + 1 < beats.length) this.enter(this.beatIndex + 1);
    else if (this.sceneIndex + 1 < this.scenes.length) {
      this.sceneIndex++;
      this.enter(0);
    } else {
      // The end of the script: whatever is still fading finishes on its own.
      this.memory = null;
      this.sceneIndex = -1;
      this.waiting = false;
    }
  }

  private enter(index: number): void {
    this.beatIndex = index;
    this.memory = null;
    this.handoffPart = -1;
    const b = this.scenes[this.sceneIndex].beats[index];
    if (b.kind === 'friend') {
      this.waiting = true;
      this.friendShape = b.shape;
      this.friendX = b.x;
      this.friendY = b.y;
      this.friendTilt = b.tilt ?? 0;
      this.friendT = 0;
      this.friendLevel = 0;
      this.friendWait = FRIEND_DELAY_S;
      this.commitX = this.commitY = NaN;
      return;
    }
    const player = this.players.get(b.scene) as ScenePlayer;
    player.offset.fill(0);
    this.memory = player;
    player.start(this.onCue, this.onMemoryDone);
    const part = b.from === undefined ? -1 : player.partIndex(b.from);
    if (part >= 0 && Number.isFinite(this.commitX) && Number.isFinite(this.commitY)) {
      this.handoffPart = part;
      this.handoffT = 0;
      this.handoffX = this.commitX - player.world[part * POSE_STRIDE];
      this.handoffY = this.commitY - player.world[part * POSE_STRIDE + 1];
      player.offset[part * 2] = this.handoffX;
      player.offset[part * 2 + 1] = this.handoffY;
      player.seek(0);
    }
    this.commitX = this.commitY = NaN;
  }
}
