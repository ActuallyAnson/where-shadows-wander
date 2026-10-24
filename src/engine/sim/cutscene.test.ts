import { describe, expect, it } from 'vitest';
import { CutscenePlayer, makeBeatStates, validateCutscene, type CutsceneData } from './cutscene';

const scene: CutsceneData = {
  id: 'opening',
  beats: [
    { kind: 'caption', at: 0, duration: 4, text: 'Once, a flame.' },
    { kind: 'puppet', at: 2, duration: 4, puppet: 'bird', from: [0, 0], to: [2, 1] },
  ],
};

describe('CutscenePlayer', () => {
  it('shows nothing finished until the timeline runs out', () => {
    const p = new CutscenePlayer(scene);
    expect(p.length).toBe(6);
    expect(p.done).toBe(false);
    p.update(5.9);
    expect(p.done).toBe(false);
    p.update(0.2);
    expect(p.done).toBe(true);
  });

  it('fades a caption in, holds it and fades it out', () => {
    const p = new CutscenePlayer(scene);
    const out = makeBeatStates(4);
    p.update(0.3);
    p.sample(out);
    expect(out[0].alpha).toBeCloseTo(0.5);
    p.update(1.2);
    p.sample(out);
    expect(out[0].alpha).toBe(1);
  });

  it('moves a puppet along its path and overlaps beats', () => {
    const p = new CutscenePlayer(scene);
    const out = makeBeatStates(4);
    p.update(4);
    expect(p.sample(out)).toBe(2);
    expect(out[1].x).toBeCloseTo(1);
    expect(out[1].y).toBeCloseTo(0.5);
  });

  it('ends on skip and plays again after a restart', () => {
    const p = new CutscenePlayer(scene);
    p.update(1);
    p.skip();
    expect(p.done).toBe(true);
    expect(p.sample(makeBeatStates(4))).toBe(0);
    p.restart();
    expect(p.done).toBe(false);
    expect(p.time).toBe(0);
  });

  it('ignores negative time steps and drops beats beyond the output size', () => {
    const p = new CutscenePlayer(scene);
    p.update(-1);
    expect(p.time).toBe(0);
    p.update(3);
    expect(p.sample(makeBeatStates(1))).toBe(1);
  });
});

describe('validateCutscene', () => {
  it('accepts a good cutscene', () => {
    expect(validateCutscene(scene)).toEqual([]);
  });

  it('names each problem', () => {
    const bad: CutsceneData = {
      id: 'x',
      beats: [
        { kind: 'caption', at: 0, duration: 0, text: ' ' },
        { kind: 'puppet', at: 19, duration: 5, puppet: '', from: [0, 0], to: [1, 1] },
      ],
    };
    const p = validateCutscene(bad);
    expect(p).toHaveLength(4);
    expect(p.join()).toContain('over the 20s limit');
  });

  it('rejects an empty cutscene', () => {
    expect(validateCutscene({ id: 'e', beats: [] })).toEqual(['no beats']);
  });
});
