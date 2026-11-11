import { describe, expect, it } from 'vitest';
import { DEFAULT_LAUNCH, LAUNCH_KEY, isDeskMode, loadLaunch, saveLaunch, type LaunchStorage } from './launch-mode';

const memory = (initial: Record<string, string> = {}): LaunchStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('launch mode', () => {
  it('is the game when nothing is stored, the storage is missing or damaged', () => {
    expect(loadLaunch(true, memory())).toEqual(DEFAULT_LAUNCH);
    expect(loadLaunch(true, null)).toEqual(DEFAULT_LAUNCH);
    expect(loadLaunch(true, memory({ [LAUNCH_KEY]: '{oops' }))).toEqual(DEFAULT_LAUNCH);
    expect(loadLaunch(true, memory({ [LAUNCH_KEY]: '{"mode":"nope","source":"nope"}' }))).toEqual(DEFAULT_LAUNCH);
  });

  it('round-trips a choice', () => {
    const s = memory();
    expect(saveLaunch({ mode: 'room-editor', source: 'webcam' }, s)).toBe(true);
    expect(loadLaunch(true, s)).toEqual({ mode: 'room-editor', source: 'webcam' });
  });

  it('opens the room editor as the plain Hand Lab without the debug tools', () => {
    const s = memory();
    saveLaunch({ mode: 'room-editor', source: 'script' }, s);
    expect(loadLaunch(false, s)).toEqual({ mode: 'lab', source: 'script' });
  });

  it('reports a refused save', () => {
    const refusing: LaunchStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveLaunch(DEFAULT_LAUNCH, refusing)).toBe(false);
    expect(saveLaunch(DEFAULT_LAUNCH, null)).toBe(false);
  });

  it('runs the lab and the room editor on mock hands', () => {
    expect(isDeskMode('game')).toBe(false);
    expect(isDeskMode('lab')).toBe(true);
    expect(isDeskMode('room-editor')).toBe(true);
  });
});
