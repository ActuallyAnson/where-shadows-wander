import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../../hands/hand-shadow';
import { ShapeEventQueue, type ShapeEventType } from '../../hands/shape-events';
import { createStagePlane } from '../../shadow/pure/stage-plane';
import { GameAudio, type SoundPlayer } from './game-audio';
import { Sound, type SoundId } from './sounds';

class Recorder implements SoundPlayer {
  plays: { id: SoundId; x: number; y: number; z: number; key: number }[] = [];
  loops: { id: SoundId; on: boolean; x: number }[] = [];
  moves = 0;
  playAt(id: SoundId, x: number, y: number, z: number, key = 0): boolean {
    this.plays.push({ id, x, y, z, key });
    return true;
  }
  setLoop(id: SoundId, on: boolean, x: number): void {
    this.loops.push({ id, on, x });
  }
  moveLoop(): void {
    this.moves++;
  }
}

function setup() {
  const stage = createStagePlane();
  stage.origin.set([0, 1, -2]);
  stage.normal.set([0, 0, 1]);
  stage.width = 1.6;
  stage.height = 1;
  const shadows = { left: createHandShadow('left'), right: createHandShadow('right') };
  const rec = new Recorder();
  return { stage, shadows, rec, audio: new GameAudio(rec), queue: new ShapeEventQueue(8) };
}

const push = (q: ShapeEventQueue, type: ShapeEventType, hand: 'left' | 'right') => q.push(type, hand, 'flat', 0, 0, 0);

describe('GameAudio.onShapeEvents', () => {
  it('rustles on candidate, thumps on commit, lets go on release, and ignores cancel', () => {
    const { audio, queue, shadows, stage, rec } = setup();
    for (const t of ['candidate', 'cancel', 'commit', 'release'] as const) push(queue, t, 'right');
    audio.onShapeEvents(queue, shadows, stage);
    expect(rec.plays.map((p) => p.id)).toEqual([Sound.Rustle, Sound.Thump, Sound.Release]);
  });

  it('falls low when tracking was lost, and stays silent when another shape took over', () => {
    const { audio, queue, shadows, stage, rec } = setup();
    queue.push('release', 'left', 'flat', 0, 0, 1, 'lost');
    queue.push('release', 'right', 'flat', 0, 0, 1, 'switch');
    queue.push('release', 'right', 'flat', 0, 0, 1, 'exit');
    audio.onShapeEvents(queue, shadows, stage);
    expect(rec.plays.map((p) => p.id)).toEqual([Sound.Lost, Sound.Release]);
  });

  it('plays from the middle of the hand’s shadow on the wall, a little in front of it', () => {
    const { audio, queue, shadows, stage, rec } = setup();
    shadows.left.active = true;
    shadows.left.bounds.set([-0.5, 0.1, -0.3, 0.3]);
    push(queue, 'candidate', 'left');
    audio.onShapeEvents(queue, shadows, stage);
    expect(rec.plays[0].x).toBeCloseTo(-0.4, 6);
    expect(rec.plays[0].y).toBeCloseTo(1.2, 6);
    expect(rec.plays[0].z).toBeCloseTo(-2 + 0.05, 6);
  });

  it('with no shadow, uses that hand’s side of the wall', () => {
    const { audio, queue, shadows, stage, rec } = setup();
    push(queue, 'commit', 'left');
    push(queue, 'commit', 'right');
    audio.onShapeEvents(queue, shadows, stage);
    expect(rec.plays[0].x).toBeCloseTo(-0.4, 6);
    expect(rec.plays[1].x).toBeCloseTo(0.4, 6);
  });

  it('keys each sound by hand, so the two hands have their own gaps', () => {
    const { audio, queue, shadows, stage, rec } = setup();
    push(queue, 'commit', 'left');
    push(queue, 'commit', 'right');
    audio.onShapeEvents(queue, shadows, stage);
    expect(rec.plays.map((p) => p.key)).toEqual([0, 1]);
  });

  it('keeps the sound on the wall when a shadow reaches beyond it', () => {
    const { audio, queue, shadows, stage, rec } = setup();
    shadows.right.active = true;
    shadows.right.bounds.set([3, -5, 4, -4]);
    push(queue, 'candidate', 'right');
    audio.onShapeEvents(queue, shadows, stage);
    expect(rec.plays[0].x).toBeCloseTo(0.8, 6);
    expect(rec.plays[0].y).toBeCloseTo(0.5, 6);
  });
});

describe('GameAudio.setFlame', () => {
  it('starts the crackle when the flame is lit, follows it, and stops when it goes out', () => {
    const { audio, rec } = setup();
    audio.setFlame(false, [0, 1, 0]);
    expect(rec.loops).toEqual([]);
    audio.setFlame(true, [0.1, 0.9, 0.2]);
    audio.setFlame(true, [0.1, 0.9, 0.2]);
    expect(rec.loops).toEqual([{ id: Sound.Crackle, on: true, x: 0.1 }]);
    expect(rec.moves).toBe(2);
    audio.setFlame(false, [0.1, 0.9, 0.2]);
    expect(rec.loops.at(-1)).toEqual({ id: Sound.Crackle, on: false, x: 0.1 });
    audio.setFlame(false, [0.1, 0.9, 0.2]);
    expect(rec.loops).toHaveLength(2);
  });
});

describe('GameAudio weather', () => {
  it('starts the rain once from the window, follows the window while it plays, and stops it once', () => {
    const { audio, rec } = setup();
    const at = { x: -1.9, y: 1.45, z: -0.8 };
    audio.setRain(false, at);
    expect(rec.loops).toEqual([]);
    audio.setRain(true, at);
    audio.setRain(true, at);
    expect(rec.loops).toEqual([{ id: Sound.Rain, on: true, x: -1.9 }]);
    expect(rec.moves).toBe(1);
    audio.setRain(false, at);
    audio.setRain(false, at);
    expect(rec.loops).toHaveLength(2);
    expect(rec.loops.at(-1)).toEqual({ id: Sound.Rain, on: false, x: -1.9 });
  });

  it('plays the thunder from the window', () => {
    const { audio, rec } = setup();
    audio.thunder({ x: -1.9, y: 1.45, z: -0.8 });
    expect(rec.plays.map((p) => [p.id, p.x, p.y, p.z])).toEqual([[Sound.Thunder, -1.9, 1.45, -0.8]]);
  });

  it('plays a story footstep from its point on the wall, alternating the two steps', () => {
    const { audio, rec, stage } = setup();
    audio.storyStep(0, stage, 0.5, -0.1);
    audio.storyStep(1, stage, 0.5, -0.1);
    expect(rec.plays.map((p) => p.id)).toEqual([Sound.Step0, Sound.Step1]);
    expect(rec.plays[0].x).toBeCloseTo(0.5);
    expect(rec.plays[0].y).toBeCloseTo(0.9);
  });

  it('plays the covers from the lap', () => {
    const { audio, rec } = setup();
    audio.covers([0, 0.7, -0.45]);
    expect(rec.plays.map((p) => [p.id, p.x, p.y, p.z])).toEqual([[Sound.Covers, 0, 0.7, -0.45]]);
  });
});
