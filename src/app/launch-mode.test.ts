import { describe, expect, it } from 'vitest';
import { DEFAULT_LAUNCH, LAUNCH_KEY, isDeskMode, loadLaunch, saveLaunch, type LaunchStorage } from './launch-mode';

const memory = (initial: Record<string, string> = {}): LaunchStorage & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('launch mode', () => {
  it('is the plain game when nothing is stored, the storage is missing or damaged', () => {
    expect(DEFAULT_LAUNCH).toEqual({ mode: 'game', hands: 'device', lab: false });
    expect(loadLaunch(true, memory())).toEqual(DEFAULT_LAUNCH);
    expect(loadLaunch(true, null)).toEqual(DEFAULT_LAUNCH);
    expect(loadLaunch(true, memory({ [LAUNCH_KEY]: '{oops' }))).toEqual(DEFAULT_LAUNCH);
    expect(loadLaunch(true, memory({ [LAUNCH_KEY]: '{"mode":"nope","hands":"nope"}' }))).toEqual(DEFAULT_LAUNCH);
  });

  it('round-trips a choice', () => {
    const s = memory();
    expect(saveLaunch({ mode: 'game', hands: 'webcam', lab: true }, s)).toBe(true);
    expect(loadLaunch(true, s)).toEqual({ mode: 'game', hands: 'webcam', lab: true });
    saveLaunch({ mode: 'room-editor', hands: 'device', lab: false }, s);
    expect(loadLaunch(true, s)).toEqual({ mode: 'room-editor', hands: 'device', lab: false });
  });

  it('opens a tab left in the old Hand Lab mode as the game with mock hands and the panel', () => {
    expect(loadLaunch(true, memory({ [LAUNCH_KEY]: '{"mode":"lab","source":"script"}' }))).toEqual({
      mode: 'game',
      hands: 'script',
      lab: true,
    });
    expect(loadLaunch(true, memory({ [LAUNCH_KEY]: '{"mode":"lab"}' }))).toEqual({
      mode: 'game',
      hands: 'synthetic',
      lab: true,
    });
  });

  it('is always the plain game without the debug tools', () => {
    const s = memory();
    saveLaunch({ mode: 'room-editor', hands: 'script', lab: true }, s);
    expect(loadLaunch(false, s)).toEqual(DEFAULT_LAUNCH);
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

  it('runs only the room editor at a desk', () => {
    expect(isDeskMode('game')).toBe(false);
    expect(isDeskMode('room-editor')).toBe(true);
  });
});
