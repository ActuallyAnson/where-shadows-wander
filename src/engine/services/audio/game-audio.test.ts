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

describe('GameAudio.puzzleSolved and setFlame', () => {
  it('chimes from the top of the wall', () => {
    const { audio, stage, rec } = setup();
    audio.puzzleSolved(stage);
    expect(rec.plays).toHaveLength(1);
    expect(rec.plays[0].id).toBe(Sound.Chime);
    expect(rec.plays[0].y).toBeCloseTo(1 + 0.35, 6);
  });

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

describe('GameAudio.setRoom and candleMoved', () => {
  it('starts the room tone, the music, the clock and the wind together, and stops them together', () => {
    const { audio, rec } = setup();
    audio.setRoom(true);
    audio.setRoom(false);
    expect(rec.loops.map((l) => [l.id, l.on])).toEqual([
      [Sound.Hum, true],
      [Sound.Music, true],
      [Sound.Clock, true],
      [Sound.Wind, true],
      [Sound.Hum, false],
      [Sound.Music, false],
      [Sound.Clock, false],
      [Sound.Wind, false],
    ]);
  });

  it('lifts and sets the candle down from the flame, and is silent on a frame where neither happened', () => {
    const { audio, rec } = setup();
    audio.candleMoved(false, false, [0.2, 1, -0.3]);
    expect(rec.plays).toEqual([]);
    audio.candleMoved(true, false, [0.2, 1, -0.3]);
    audio.candleMoved(false, true, [0.4, 0.9, -0.1]);
    expect(rec.plays.map((p) => [p.id, p.x, p.y, p.z])).toEqual([
      [Sound.Lift, 0.2, 1, -0.3],
      [Sound.Set, 0.4, 0.9, -0.1],
    ]);
  });
});

describe('GameAudio.lullabyNote', () => {
  it('plays the lullaby note for each sleeper from where it is, and keeps a bad number to the five notes', () => {
    const { audio, rec: player } = setup();
    for (let i = 0; i < 5; i++) audio.lullabyNote(i, 1 + i, 1.5, -2);
    expect(player.plays.map((p) => p.id)).toEqual([Sound.Note0, Sound.Note1, Sound.Note2, Sound.Note3, Sound.Note4]);
    expect(player.plays[3].x).toBe(4);
    player.plays.length = 0;
    audio.lullabyNote(-3, 0, 0, 0);
    audio.lullabyNote(99, 0, 0, 0);
    audio.lullabyNote(NaN, 0, 0, 0);
    expect(player.plays.map((p) => p.id)).toEqual([Sound.Note0, Sound.Note4, Sound.Note0]);
  });
});

describe('GameAudio ambient and steps', () => {
  it('moves the clock and the wind to where the room is, plays a window tick and a beam creak from the room, and alternates steps', () => {
    const { audio, rec, stage } = setup();
    audio.placeAmbient({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 });
    expect(rec.moves).toBe(2);
    audio.snowTick();
    audio.creak(0.5, -1);
    audio.stepAt(stage, 0, 0, false);
    audio.stepAt(stage, 0, 0, true);
    expect(rec.plays.map((p) => p.id)).toEqual([Sound.Snowtick, Sound.Creak, Sound.Step0, Sound.Step1]);
    expect(rec.plays[0]).toMatchObject({ x: 4, y: 5, z: 6 });
    expect(rec.plays[1].y).toBeGreaterThan(2);
  });
});
