import { describe, expect, it } from 'vitest';
import { joinChapters, SLIDE_DEPTH_LAG, slideKeys, type Chapter } from './chapters';
import { POSE_STRIDE, validateScene } from './puppet-scene';
import { ScenePlayer } from './scene-player';

const first: Chapter = {
  id: 'first',
  length: 2,
  parts: [{ id: 'kid', art: 'kid', w: 0.1, h: 0.1 }],
  tracks: [
    {
      part: 'kid',
      prop: 'x',
      keys: [
        [0, 0],
        [2, 0.2],
      ],
    },
  ],
  cues: [{ t: 1, kind: 'step', variant: 0, x: 1, y: 0 }],
};
const second: Chapter = {
  id: 'second',
  length: 3,
  parts: [{ id: 'fox', art: 'fox', w: 0.1, h: 0.1, opacity: 0 }],
  tracks: [
    {
      part: 'kid',
      prop: 'x',
      keys: [
        [1, 0.2],
        [2, 0.5],
      ],
    },
    {
      part: 'fox',
      prop: 'opacity',
      keys: [
        [0, 0],
        [0.5, 1],
      ],
    },
  ],
  cues: [{ t: 0.5, kind: 'step', variant: 0, x: 2, y: 0 }],
};

describe('joinChapters', () => {
  const { scene, at } = joinChapters('show', [first, second]);

  it('lays the chapters end to end, keeping each part once and shifting the second chapter’s times', () => {
    expect(validateScene(scene)).toEqual([]);
    expect(scene.length).toBe(5);
    expect(at).toEqual({ first: { start: 0, end: 2 }, second: { start: 2, end: 5 } });
    expect(scene.parts.map((p) => p.id)).toEqual(['kid', 'fox']);
    expect(scene.cues?.map((c) => c.t)).toEqual([1, 2.5]);
  });

  it('joins a part’s tracks from every chapter into one, so it carries on from where it was', () => {
    expect(scene.tracks.filter((t) => t.part === 'kid')).toHaveLength(1);
    const p = new ScenePlayer(scene);
    const kidX = (t: number) => {
      p.seek(t);
      return p.world[0];
    };
    expect(kidX(2)).toBeCloseTo(0.2);
    expect(kidX(2.8)).toBeCloseTo(0.2); // held until the second chapter moves it
    expect(kidX(3.5)).toBeCloseTo(0.35);
    expect(kidX(5)).toBeCloseTo(0.5);
    expect(p.world[POSE_STRIDE + 4]).toBe(1);
  });

  it('refuses two chapters with one name', () => {
    expect(() => joinChapters('show', [first, first])).toThrow(/two/);
  });
});

describe('slideKeys', () => {
  it('slides from one place to another, the further back the slower', () => {
    expect(slideKeys(1, 2, 1.6, 0)).toEqual([
      [1, 1.6],
      [3, 0, 'out'],
    ]);
    const far = slideKeys(1, 2, 0, -1.6, 1, true);
    expect(far[1][0]).toBeCloseTo(1 + 2 * (1 + SLIDE_DEPTH_LAG));
    expect(far[1][2]).toBe('in');
  });
});

describe('ScenePlayer stretches', () => {
  const { scene, at } = joinChapters('show', [first, second]);

  it('plays a stretch to its end, then idles there with only its wobbles moving', () => {
    const swaying = { ...scene, wobbles: [{ part: 'kid', prop: 'angle' as const, amp: 0.1, period: 2 }] };
    const p = new ScenePlayer(swaying);
    let done = 0;
    p.startAt(at.first.start, at.first.end, undefined, () => done++);
    for (let i = 0; i < 30; i++) p.update(0.1);
    expect(done).toBe(1);
    expect(p.time).toBeCloseTo(2);
    const angle = p.world[2];
    p.idle(0.5);
    expect(p.time).toBeCloseTo(2);
    expect(p.world[0]).toBeCloseTo(0.2);
    expect(p.world[2]).not.toBeCloseTo(angle, 3);
  });

  it('fires only the cues inside the stretch it plays', () => {
    const p = new ScenePlayer(scene);
    const heard: number[] = [];
    p.startAt(at.second.start, at.second.end, (c) => c.kind === 'step' && heard.push(c.x));
    for (let i = 0; i < 40; i++) p.update(0.1);
    expect(heard).toEqual([2]);
  });

  it('a skip lands on the end of the stretch', () => {
    const p = new ScenePlayer(scene);
    p.startAt(at.second.start, at.second.end);
    p.update(0.1);
    p.skip();
    expect(p.time).toBeCloseTo(5);
    expect(p.world[0]).toBeCloseTo(0.5);
  });
});
