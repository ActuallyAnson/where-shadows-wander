import { describe, expect, it, vi } from 'vitest';
import { CutsceneHost, type CutsceneDrawing } from './cutscene-host';
import { createStagePlane } from '../engine/shadow/pure/stage-plane';
import { skipCentre } from '../engine/shadow/pure/skip-touch';
import type { CutsceneData } from '../engine/sim/cutscene';

const data: CutsceneData = { id: 't', beats: [{ kind: 'caption', at: 0, duration: 2, text: 'Hi' }] };
const stage = createStagePlane();
stage.origin.set([0, 0, 0]);
stage.right.set([1, 0, 0]);
stage.up.set([0, 1, 0]);
stage.normal.set([0, 0, 1]);

function fake() {
  const view: CutsceneDrawing = { load: vi.fn(), hide: vi.fn(), update: vi.fn() };
  return { view, host: new CutsceneHost(view) };
}

describe('CutsceneHost', () => {
  it('refuses bad data and plays nothing', () => {
    const { host, view } = fake();
    expect(host.play({ id: 'e', beats: [] })).toEqual(['no beats']);
    expect(host.playing).toBe(false);
    expect(view.load).not.toHaveBeenCalled();
  });

  it('draws while playing and calls onDone once at the end', () => {
    const { host, view } = fake();
    const done = vi.fn();
    expect(host.play(data, done)).toEqual([]);
    host.update(1, stage, [], 0, 0.9);
    expect(view.update).toHaveBeenCalledTimes(1);
    host.update(1.5, stage, [], 0, 0.9);
    expect(done).toHaveBeenCalledTimes(1);
    expect(host.playing).toBe(false);
    expect(view.hide).toHaveBeenCalled();
    host.update(1, stage, [], 0, 0.9);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('ends early when the Skip button is poked', () => {
    const { host } = fake();
    const done = vi.fn();
    host.play(data, done);
    const c = skipCentre(stage, [0, 0]);
    host.update(0.2, stage, [c[0], c[1], 0.01], 1, 0.9);
    expect(done).not.toHaveBeenCalled();
    host.update(0.2, stage, [c[0], c[1], 0.01], 1, 0.9);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('starting another cutscene replaces the first without calling its onDone', () => {
    const { host } = fake();
    const first = vi.fn();
    host.play(data, first);
    host.play(data);
    expect(first).not.toHaveBeenCalled();
  });
});
