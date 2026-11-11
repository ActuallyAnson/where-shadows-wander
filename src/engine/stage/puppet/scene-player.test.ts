import { describe, expect, it } from 'vitest';
import { POSE_STRIDE, swingKeys, validateScene, type Cue, type PuppetScene } from './puppet-scene';
import { ScenePlayer } from './scene-player';

const X = 0,
  Y = 1,
  ANGLE = 2,
  SCALE = 3,
  OPACITY = 4;

const arm: PuppetScene = {
  id: 'arm',
  length: 2,
  parts: [
    { id: 'shoulder', art: '', w: 1, h: 1, x: 1, y: 0 },
    { id: 'hand', art: 'orb', parent: 'shoulder', w: 0.1, h: 0.1, x: 0.5, y: 0, opacity: 0.5 },
  ],
  tracks: [
    {
      part: 'shoulder',
      prop: 'angle',
      keys: [
        [0, 0],
        [1, Math.PI / 2],
      ],
    },
    {
      part: 'shoulder',
      prop: 'scale',
      keys: [
        [0, 1],
        [1, 2, 'step'],
      ],
    },
  ],
  cues: [
    { t: 0, kind: 'note', note: 0 },
    { t: 0.5, kind: 'note', note: 1 },
    { t: 1.5, kind: 'note', note: 2 },
  ],
};

const at = (p: ScenePlayer, part: number, prop: number) => p.world[part * POSE_STRIDE + prop];

describe('ScenePlayer', () => {
  it('interpolates a track between its keys and holds the ends', () => {
    const p = new ScenePlayer(arm);
    p.seek(0.5);
    expect(at(p, 0, ANGLE)).toBeCloseTo(Math.PI / 4);
    p.seek(5);
    expect(at(p, 0, ANGLE)).toBeCloseTo(Math.PI / 2);
  });

  it('carries a child round its parent pivot, scaled with it', () => {
    const p = new ScenePlayer(arm);
    p.seek(0);
    expect(at(p, 1, X)).toBeCloseTo(1.5);
    expect(at(p, 1, Y)).toBeCloseTo(0);
    p.seek(1); // turned a quarter, and the step key has doubled the scale
    expect(at(p, 1, X)).toBeCloseTo(1);
    expect(at(p, 1, Y)).toBeCloseTo(1);
    expect(at(p, 1, SCALE)).toBeCloseTo(2);
    expect(at(p, 1, OPACITY)).toBeCloseTo(0.5);
  });

  it('holds a step key until its time', () => {
    const p = new ScenePlayer(arm);
    p.seek(0.99);
    expect(at(p, 0, SCALE)).toBe(1);
  });

  it('fires each cue once as the clock passes it, and ends at its length', () => {
    const p = new ScenePlayer(arm);
    const heard: number[] = [];
    let done = 0;
    p.start(
      (c: Cue) => c.kind === 'note' && heard.push(c.note),
      () => done++,
    );
    expect(heard).toEqual([0]);
    for (let i = 0; i < 30; i++) p.update(1 / 10);
    expect(heard).toEqual([0, 1, 2]);
    expect(done).toBe(1);
    expect(p.playing).toBe(false);
  });

  it('holds still with a zero step, and a skip drops the cues to come', () => {
    const p = new ScenePlayer(arm);
    const heard: number[] = [];
    p.start((c) => c.kind === 'note' && heard.push(c.note));
    p.update(0);
    expect(p.time).toBe(0);
    p.skip();
    p.update(1);
    expect(heard).toEqual([0]);
  });

  it('never jumps more than a tenth of a second in one step', () => {
    const p = new ScenePlayer(arm);
    p.start();
    p.update(5);
    expect(p.time).toBeCloseTo(0.1);
  });

  it('refuses a scene whose part hangs from one not listed before it', () => {
    const bad: PuppetScene = { ...arm, parts: [arm.parts[1], arm.parts[0]] };
    expect(validateScene(bad).join()).toMatch(/hand hangs from shoulder/);
    expect(() => new ScenePlayer(bad)).toThrow();
  });
});

describe('swingKeys', () => {
  it('swings either side of the centre and ends at rest', () => {
    const keys = swingKeys(0, 2, 1, 0.3, 0, 0.1);
    expect(keys[0]).toEqual([0, 0]);
    expect(keys[1][1]).toBeCloseTo(0.3);
    expect(keys[2][1]).toBeCloseTo(-0.3);
    expect(keys[keys.length - 1]).toEqual([2, 0.1, 'smooth']);
  });
});
