// The story's running order (docs/STORY.md): each scene is a list of beats played one after another. A `friend` beat shows the
// friend's hand making a shape and waits, for as long as it takes, until the player's hand commits that shape; a `memory` beat
// plays a puppet scene (puppet-scene.ts), or one chapter of it (chapters.ts), to its end. A memory can start one of its puppets
// where the player's shadow was and ease it to its keyed place, so the player's rabbit becomes the puppet rabbit. The wall never
// goes blank between memories: when one ends, its last picture stays on the wall, idling, through the wait for the next shape,
// and a memory that continues the same scene goes on from there. Plain data in story-script.ts; plain TypeScript here, and a
// frame allocates nothing.
import type { Shape } from '../../hands/shapes';
import { POSE_STRIDE, bedAt, type Cue, type PuppetScene, type StoryBed } from '../puppet/puppet-scene';
import { ScenePlayer } from '../puppet/scene-player';
import type { CandleMoodName } from './candle-mood';
import { FRIEND_PUPPETS, OUTLINE_SIZE } from './friend-puppet';

/** The friend's hand shows `shape`, its shadow at `x`, `y` (metres right and up from the wall's centre), and waits. */
export interface FriendBeat {
  readonly kind: 'friend';
  readonly shape: Shape;
  readonly x: number;
  readonly y: number;
  /** Which of the friend's painted hands (friend-puppet.ts) shows the shape, e.g. 'wave'. Default the shape's own. */
  readonly puppet?: string;
  /** Seconds the hand takes to go once copied. Default FRIEND_OUT_S. */
  readonly out?: number;
  /** How it goes once copied: lowered out of sight below the wall (the default), or fading where it is (scene 6's goodbye). */
  readonly leave?: 'lower' | 'fade';
  /**
   * Seconds her hand copies the player's before it shows the shape (the first time only, so the player learns that hands answer
   * hands): it rises open, follows the player's hand about and makes any shape the player makes, and only after this long with a
   * hand to copy does it make its own. Default 0: it shows the shape at once.
   */
  readonly mirror?: number;
  /**
   * Where the outline of her shape stands (shape-guide.ts), metres as `x`, `y`, where the wall's picture leaves no room beside
   * her hand (scene 4's trees), or `false` to omit the outline altogether. Default: GHOST_GAP_M from her hand, toward the middle
   * of the wall.
   */
  readonly guide?: readonly [number, number] | false;
  /**
   * The shape counts only made at the outline: the middle of the player's hand shadow must be within this many of the outline's
   * sizes (OUTLINE_SIZE, its larger side) of the outline's middle, `guide` (which it needs), so a bigger outline gives more room.
   * A shape already held counts once it is moved there. Default: anywhere on the wall.
   */
  readonly near?: number;
}

/** A memory plays: `scene` from `start` (default 0) to `end` (default its length) seconds, e.g. one chapter of it. */
export interface MemoryBeat {
  readonly kind: 'memory';
  readonly scene: PuppetScene;
  /** A root part that starts where the player's committed shadow was, and eases to its keyed place over the handoff. */
  readonly from?: string;
  readonly start?: number;
  readonly end?: number;
  /** Seconds the `from` puppet takes to reach its place. Default HANDOFF_S. */
  readonly handoff?: number;
  /** The player's own hand shadow fades right out while it plays (the goodbye, where puppet hands take over the touch). */
  readonly hideHand?: boolean;
}

/** Nothing new for `seconds`: the wall holds what it has (a hand fading, an empty wall) before the next beat. */
export interface WaitBeat {
  readonly kind: 'wait';
  readonly seconds: number;
}

/** The end: it waits, for as long as it takes, for the player to cover the flame and sleep (scene 7). */
export interface SleepBeat {
  readonly kind: 'sleep';
}

export type Beat = FriendBeat | MemoryBeat | WaitBeat | SleepBeat;

export interface StoryScene {
  readonly id: string;
  /** Its name for the developer tools (the Hand Lab's checkpoints), e.g. "2 · How they met". */
  readonly title?: string;
  readonly beats: readonly Beat[];
  /**
   * The candle's mood for this scene (candle-mood.ts), eased into as it starts; without one the light stays as it was. A memory's
   * mood cues can change it on the way; a scene's mood is the one its wait opens in, so a jump to the scene can snap to it.
   */
  readonly candle?: CandleMoodName;
}

/**
 * Seconds before the friend's hand starts to appear (the wall settles first), then seconds it takes to rise into place. It is a
 * real hand's shadow, so it never fades in out of nothing: it is lifted up from below the wall, its arm trailing out of sight.
 */
export const FRIEND_DELAY_S = 1.2;
export const FRIEND_IN_S = 2.6;
/** Seconds the friend's hand takes to go once the player has copied it. */
export const FRIEND_OUT_S = 1.8;
/** Where the friend's hand rises from: the story's metres up from the wall's centre, far enough below it to be out of sight. */
export const FRIEND_FROM_Y = -0.95;
/** Seconds into its rise the friend's hand starts to form its shape, so it comes up loose and makes the shape as it arrives. */
export const FRIEND_FORM_AT_S = 1.3;
/** How far her copying hand follows the player's from its place, stage metres each way, and how closely (seconds behind). */
export const MIRROR_REACH_M = 0.3;
const MIRROR_TAU_S = 0.15;
/** How long it takes her hand to drift back to its place once it stops copying, seconds (a time constant). */
const MIRROR_HOME_TAU_S = 0.45;
/**
 * While copying, how long the player's hand must hold a new shape before hers changes to it, seconds: a shape recognised for a
 * moment (a hand passing through one, or flickering between two) leaves her hand as it was.
 */
export const MIRROR_SWITCH_S = 0.25;
/**
 * Seconds one painted hand of hers takes to give way to another (her copy of the player's to the next, or to her own shape):
 * the new one comes in over the first FRIEND_SWAP_IN of it and the old one goes over the last, so they overlap in the middle
 * and the hand never thins out or pops.
 */
export const FRIEND_SWAP_S = 0.5;
const FRIEND_SWAP_IN = 0.6;
/** Seconds a memory's `from` puppet takes to travel from the player's shadow to its own place. */
export const HANDOFF_S = 1.6;

/** Whether a shadow at `x`, `y` is close enough to the outline for the beat's shape to count (FriendBeat.near). */
function inReach(b: FriendBeat, x: number, y: number): boolean {
  if (b.near === undefined || !b.guide) return true;
  return Math.hypot(x - b.guide[0], y - b.guide[1]) <= b.near * (OUTLINE_SIZE[b.shape] ?? 0);
}

const smooth = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

/** Problems with a story, as sentences (none when it is sound). */
export function validateStory(scenes: readonly StoryScene[]): string[] {
  const problems: string[] = [];
  for (const s of scenes) {
    if (s.beats.length === 0) problems.push(`${s.id} has no beats`);
    for (const b of s.beats) {
      if (b.kind === 'wait' && !(b.seconds >= 0)) problems.push(`${s.id} waits for ${b.seconds} s`);
      if (
        b.kind === 'friend' &&
        b.near !== undefined &&
        !(b.near > 0 && Array.isArray(b.guide) && b.shape in OUTLINE_SIZE)
      )
        problems.push(`${s.id}: a friend's ${b.shape} asks to be made near an outline it has no place for`);
      if (b.kind !== 'memory') continue;
      const start = b.start ?? 0,
        end = b.end ?? b.scene.length;
      if (!(start >= 0 && start < end && end <= b.scene.length))
        problems.push(`${s.id}: ${b.scene.id} plays from ${start} to ${end} s, outside its ${b.scene.length} s`);
      if (b.from === undefined) continue;
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
  /** The name of the friend's painted hand showing (FriendBeat.puppet, or its shape), while friendShape is set. */
  friendPuppet: string | null = null;
  /** The painted hand it is changing from (friendSwapOut says how much of it is left), or null. */
  friendPrevPuppet: string | null = null;
  /** Seconds into the old hand's shape when it was let go: it holds that pose as it goes. */
  friendPrevShapeT = 0;
  /** Set once the player has covered the flame at the end (a sleep beat): the story is over. */
  asleep = false;
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
  /** Where her hand is away from its place while it copies the player's (FriendBeat.mirror), stage metres. */
  friendDX = 0;
  friendDY = 0;
  /** The memory on the wall, or null: playing, or (once it has ended) holding its last picture until the next one. */
  memory: ScenePlayer | null = null;
  private readonly players = new Map<PuppetScene, ScenePlayer>();
  private waiting = false;
  private friendWait = 0;
  private friendOut = FRIEND_OUT_S;
  private friendFades = false;
  /** Seconds of copying left (FriendBeat.mirror), where the player's hand was when the copying took it up, and the player now. */
  private mirrorLeft = 0;
  private mirrorOX = NaN;
  private mirrorOY = NaN;
  private playerX = NaN;
  private playerY = NaN;
  /** The middle of the player's hand shadow (FriendBeat.near measures from it). */
  private playerMX = NaN;
  private playerMY = NaN;
  private playerShape: Shape | null = null;
  /** Her hand's clock (friendT) when it began forming the shape it shows. */
  private formAt = FRIEND_FORM_AT_S;
  /** Seconds since her painted hand last changed (FRIEND_SWAP_S or more: done). */
  private swapT = FRIEND_SWAP_S;
  /** While copying: the painted hand the player's shape asks for that hers is not yet, and for how long it has asked. */
  private pendingPuppet: string | null = null;
  private pendingFor = 0;
  private waitLeft = -1;
  private sleepWaiting = false;
  private handoffS = HANDOFF_S;
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

  /** Whether the friend's hand is copying the player's (FriendBeat.mirror) rather than waiting on its own shape yet. */
  get mirroring(): boolean {
    return this.waiting && this.mirrorLeft > 0;
  }

  /** Whether the friend's hand is in place and showing the shape it waits for: risen, not copying, not yet copied. */
  get friendShowing(): boolean {
    return this.waiting && this.friendShape !== null && this.friendLevel >= 1 && this.mirrorLeft <= 0;
  }

  /**
   * Where the player's hand shadow is on the wall (NaN, NaN without one) and the shape it holds (committed), if any: what the
   * friend's hand copies while it mirrors; `mx`, `my` is the middle of the hand, if `x`, `y` is another point of it (a flat
   * hand's wrist). Once per frame, before update.
   */
  follow(x: number, y: number, shape: Shape | null, mx = x, my = y): void {
    this.playerX = x;
    this.playerY = y;
    this.playerMX = mx;
    this.playerMY = my;
    this.playerShape = shape;
  }

  /** Whether the story is at its end, waiting for the player to cover the flame (a sleep beat). */
  get waitingForSleep(): boolean {
    return this.sleepWaiting;
  }

  /** The candle's mood the scene playing asks for, or null (none playing, or it names none). */
  get candleMood(): CandleMoodName | null {
    return this.sceneIndex < 0 ? null : (this.scenes[this.sceneIndex].candle ?? null);
  }

  /** Whether the player's own hand shadow should be gone: a memory beat that hides it (MemoryBeat.hideHand) is playing. */
  get handHidden(): boolean {
    const b = this.beat;
    return b !== null && b.kind === 'memory' && b.hideHand === true && this.memory?.playing === true;
  }

  /** Whether a memory is playing (not held on its last picture while the friend's hand waits). */
  get memoryPlaying(): boolean {
    return this.sceneIndex >= 0 && this.memory?.playing === true;
  }

  /**
   * The loop the story lays under itself now (puppet-scene.ts's `bedAt`: crickets at dusk, wind on the empty wall), or null.
   * It holds through the friend's waits, as the memory's last picture does.
   */
  get bed(): StoryBed | null {
    const m = this.memory;
    return this.sceneIndex < 0 || !m ? null : bedAt(m.scene.cues, m.time);
  }

  /** The beat playing, or null. */
  get beat(): Beat | null {
    return this.sceneIndex < 0 ? null : (this.scenes[this.sceneIndex].beats[this.beatIndex] ?? null);
  }

  /**
   * Starts the story at scene `index` (0, the first in the script, by default), dropping whatever was playing. A scene after the
   * first opens on the picture the memory before it ended on, idling, as if the story had played up to it (a checkpoint).
   */
  start(index = 0): void {
    this.stop();
    if (index < 0 || index >= this.scenes.length) return;
    const before = this.memoryBefore(index);
    if (before) {
      const player = this.players.get(before.scene) as ScenePlayer;
      player.offset.fill(0);
      player.seek(before.end ?? before.scene.length);
      this.memory = player;
    }
    this.sceneIndex = index;
    this.enter(0);
  }

  /** The last memory beat before scene `index`, or null. */
  private memoryBefore(index: number): MemoryBeat | null {
    for (let s = index - 1; s >= 0; s--) {
      const beats = this.scenes[s].beats;
      for (let i = beats.length - 1; i >= 0; i--) {
        const b = beats[i];
        if (b.kind === 'memory') return b;
      }
    }
    return null;
  }

  /** The player covered the flame. At the end (a sleep beat) that is sleep, and the story is over; returns whether it was. */
  sleep(): boolean {
    if (!this.sleepWaiting) return false;
    this.sleepWaiting = false;
    this.asleep = true;
    this.next();
    return true;
  }

  /** Stops it: no hand, no memory. */
  stop(): void {
    const m = this.memory;
    this.memory = null;
    this.sceneIndex = -1;
    m?.skip();
    this.beatIndex = 0;
    this.waiting = false;
    this.friendShape = null;
    this.friendPuppet = null;
    this.endSwap();
    this.friendLevel = 0;
    this.friendDX = this.friendDY = 0;
    this.mirrorLeft = 0;
    this.handoffPart = -1;
    this.waitLeft = -1;
    this.sleepWaiting = false;
    this.asleep = false;
  }

  /**
   * The player's hand committed `shape`, its shadow at `x`, `y` on the wall (NaN if it is not known). Returns whether it was
   * the shape the friend's hand is waiting for, which moves the story on.
   */
  commit(shape: Shape, x = NaN, y = NaN): boolean {
    const b = this.beat;
    if (!this.waiting || !b || b.kind !== 'friend' || b.shape !== shape || !inReach(b, x, y)) return false;
    this.waiting = false;
    this.commitX = x;
    this.commitY = y;
    this.next();
    return true;
  }

  /** Skips the memory playing, if any, to its last picture and the beat after it. */
  skipMemory(): void {
    this.memory?.skip();
  }

  /** Once per frame; 0 while paused (all of it holds still). */
  update(dt: number): void {
    if (dt <= 0) return;
    // The friend's hand: waits, rises into place while it waits, lowers (or fades) after.
    if (this.friendShape !== null) {
      if (this.swapT < FRIEND_SWAP_S) {
        this.swapT += dt;
        if (this.swapT >= FRIEND_SWAP_S) this.endSwap();
      }
      if (this.waiting) {
        if (this.friendWait > 0) this.friendWait -= dt;
        else {
          this.friendT += dt;
          this.friendLevel = Math.min(1, this.friendLevel + dt / FRIEND_IN_S);
          if (this.mirrorLeft > 0 && this.friendLevel >= 1) this.copyPlayer(dt);
          else this.easeHome(dt);
          // Made at the outline (FriendBeat.near), a shape held from before counts too once her hand is in place: the
          // recogniser's commit came when it formed, perhaps far from the outline, and does not come again as it moves.
          const b = this.beat;
          if (
            b?.kind === 'friend' &&
            b.near !== undefined &&
            this.friendLevel >= 1 &&
            this.playerShape === b.shape &&
            inReach(b, this.playerMX, this.playerMY)
          )
            this.commit(b.shape, this.playerMX, this.playerMY);
        }
      } else {
        this.friendT += dt;
        this.friendLevel = Math.max(0, this.friendLevel - dt / this.friendOut);
        if (this.friendLevel === 0) {
          this.friendShape = this.friendPuppet = null;
          this.endSwap();
        }
      }
    }
    if (this.waitLeft >= 0) {
      this.waitLeft -= dt;
      if (this.waitLeft < 0) this.next();
    }
    const m = this.memory;
    if (!m) return;
    if (!m.playing) {
      m.idle(dt);
      return;
    }
    if (this.handoffPart >= 0) {
      this.handoffT += dt;
      const k = 1 - smooth(this.handoffT / this.handoffS);
      m.offset[this.handoffPart * 2] = this.handoffX * k;
      m.offset[this.handoffPart * 2 + 1] = this.handoffY * k;
      if (k === 0) this.handoffPart = -1;
    }
    m.update(dt);
  }

  /** Her hand copies the player's: follows it about, makes the shape it makes; when the time is up, it shows its own. */
  private copyPlayer(dt: number): void {
    const tracked = Number.isFinite(this.playerX) && Number.isFinite(this.playerY);
    let tx = 0,
      ty = 0;
    if (tracked) {
      if (!Number.isFinite(this.mirrorOX)) {
        this.mirrorOX = this.playerX;
        this.mirrorOY = this.playerY;
      }
      const r = MIRROR_REACH_M;
      tx = Math.min(r, Math.max(-r, this.playerX - this.mirrorOX));
      ty = Math.min(r, Math.max(-r, this.playerY - this.mirrorOY));
      this.mirrorLeft -= dt;
    } else this.mirrorOX = this.mirrorOY = NaN;
    const k = 1 - Math.exp(-dt / MIRROR_TAU_S);
    this.friendDX += (tx - this.friendDX) * k;
    this.friendDY += (ty - this.friendDY) * k;
    const s = this.playerShape;
    const want = this.mirrorLeft <= 0 ? this.ownPuppet : tracked && s !== null && s in FRIEND_PUPPETS ? s : 'flat';
    if (want === this.friendPuppet) {
      this.pendingPuppet = null;
      return;
    }
    // Her own shape, once the copying is over, comes at once; a copy waits until the player's shape has held a moment.
    if (want !== this.pendingPuppet) {
      this.pendingPuppet = want;
      this.pendingFor = 0;
    }
    this.pendingFor += dt;
    if (this.mirrorLeft <= 0 || this.pendingFor >= MIRROR_SWITCH_S) this.swapTo(want);
  }

  /** Changes her painted hand to `puppet`: it forms afresh, over the old one going (friendSwapIn, friendSwapOut). */
  private swapTo(puppet: string): void {
    this.friendPrevPuppet = this.friendPuppet;
    this.friendPrevShapeT = this.friendShapeT;
    this.friendPuppet = puppet;
    this.formAt = this.friendT;
    this.swapT = 0;
    this.pendingPuppet = null;
  }

  /** Lets any old painted hand go, and forgets a change waiting to be taken. */
  private endSwap(): void {
    this.friendPrevPuppet = null;
    this.swapT = FRIEND_SWAP_S;
    this.pendingPuppet = null;
    this.pendingFor = 0;
  }

  /** How much of her painted hand (friendPuppet) is drawn, 0..1: it comes in over the start of a change, 1 otherwise. */
  get friendSwapIn(): number {
    return smooth(this.swapT / (FRIEND_SWAP_S * FRIEND_SWAP_IN));
  }

  /** How much of the old painted hand (friendPrevPuppet) is still drawn, 0..1: it goes over the end of a change. */
  get friendSwapOut(): number {
    if (this.friendPrevPuppet === null) return 0;
    const from = FRIEND_SWAP_S * (1 - FRIEND_SWAP_IN);
    return 1 - smooth((this.swapT - from) / (FRIEND_SWAP_S * FRIEND_SWAP_IN));
  }

  /** Once it has stopped copying, her hand drifts back to its own place. */
  private easeHome(dt: number): void {
    if (this.friendDX === 0 && this.friendDY === 0) return;
    const k = 1 - Math.exp(-dt / MIRROR_HOME_TAU_S);
    this.friendDX -= this.friendDX * k;
    this.friendDY -= this.friendDY * k;
    if (Math.abs(this.friendDX) < 1e-5 && Math.abs(this.friendDY) < 1e-5) this.friendDX = this.friendDY = 0;
  }

  /** The friend beat's own painted hand (FriendBeat.puppet, or its shape). */
  private get ownPuppet(): string {
    const b = this.beat;
    return b?.kind === 'friend' ? (b.puppet ?? b.shape) : 'flat';
  }

  /** Whether the friend's outline should be shown for the active friend beat (false when `FriendBeat.guide` is `false`). */
  get friendGuide(): boolean {
    const b = this.beat;
    return !(b?.kind === 'friend' && b.guide === false);
  }
  /** Where the outline of her shape stands (FriendBeat.guide), or NaN for the default beside her hand or when hidden. */
  get guideX(): number {
    const b = this.beat;
    return b?.kind === 'friend' && b.guide ? b.guide[0] : NaN;
  }
  get guideY(): number {
    const b = this.beat;
    return b?.kind === 'friend' && b.guide ? b.guide[1] : NaN;
  }

  /** Whether the friend's hand is going, once copied, by fading where it is (FriendBeat.leave). */
  private get friendFading(): boolean {
    return this.friendFades && !this.waiting;
  }

  /** How visible the friend's hand is (0..1): all there while it rises and lowers, eased away when it leaves by fading. */
  get friendOpacity(): number {
    if (this.friendShape === null || this.friendLevel <= 0) return 0;
    return this.friendFading ? smooth(this.friendLevel) : 1;
  }

  /** Stage metres the friend's hand is below its place: all the way from below the wall while hidden, none once in place. */
  get friendDrop(): number {
    if (this.friendFading) return 0;
    return (this.friendY - FRIEND_FROM_Y) * (1 - smooth(this.friendLevel));
  }

  /** How far the friend's hand is from being in place, 0..1, as it rises or lowers (0 in place, and while it fades). */
  get friendLower(): number {
    if (this.friendShape === null || this.friendFading) return 0;
    return 1 - smooth(this.friendLevel);
  }

  /** Seconds into the friend's hand's shape (friend-puppet.ts's scene time): it forms the shape as it arrives. */
  get friendShapeT(): number {
    return this.friendT - this.formAt;
  }

  private next(): void {
    if (this.sceneIndex < 0) return;
    const beats = this.scenes[this.sceneIndex].beats;
    if (this.beatIndex + 1 < beats.length) this.enter(this.beatIndex + 1);
    else if (this.sceneIndex + 1 < this.scenes.length) {
      this.sceneIndex++;
      this.enter(0);
    } else {
      // The end of the script: whatever is still fading finishes on its own, and the last picture stays.
      this.sceneIndex = -1;
      this.waiting = false;
    }
  }

  private enter(index: number): void {
    this.beatIndex = index;
    this.handoffPart = -1;
    this.waitLeft = -1;
    const b = this.scenes[this.sceneIndex].beats[index];
    if (b.kind === 'wait') {
      this.waitLeft = b.seconds;
      return;
    }
    if (b.kind === 'sleep') {
      this.sleepWaiting = true;
      return;
    }
    if (b.kind === 'friend') {
      // The memory before it, if any, stays on the wall while the hand waits.
      this.waiting = true;
      this.friendShape = b.shape;
      this.mirrorLeft = b.mirror ?? 0;
      this.mirrorOX = this.mirrorOY = NaN;
      this.friendDX = this.friendDY = 0;
      this.formAt = FRIEND_FORM_AT_S;
      // Copying first, it comes up as an open hand.
      this.friendPuppet = this.mirrorLeft > 0 ? 'flat' : (b.puppet ?? b.shape);
      this.endSwap();
      this.friendOut = b.out ?? FRIEND_OUT_S;
      this.friendX = b.x;
      this.friendY = b.y;
      this.friendFades = b.leave === 'fade';
      this.friendT = 0;
      this.friendLevel = 0;
      this.friendWait = FRIEND_DELAY_S;
      this.commitX = this.commitY = NaN;
      return;
    }
    const player = this.players.get(b.scene) as ScenePlayer;
    const start = b.start ?? 0;
    player.offset.fill(0);
    this.memory = player;
    player.startAt(start, b.end ?? b.scene.length, this.onCue, this.onMemoryDone);
    const part = b.from === undefined ? -1 : player.partIndex(b.from);
    if (part >= 0 && Number.isFinite(this.commitX) && Number.isFinite(this.commitY)) {
      this.handoffPart = part;
      this.handoffS = b.handoff ?? HANDOFF_S;
      this.handoffT = 0;
      this.handoffX = this.commitX - player.world[part * POSE_STRIDE];
      this.handoffY = this.commitY - player.world[part * POSE_STRIDE + 1];
      player.offset[part * 2] = this.handoffX;
      player.offset[part * 2 + 1] = this.handoffY;
      player.seek(start);
    }
    this.commitX = this.commitY = NaN;
  }
}
