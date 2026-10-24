import { describe, expect, it } from 'vitest';
import { Sound, type SoundId } from '../engine/services/audio/sounds';
import { createUiSound } from './ui-sound';

describe('createUiSound', () => {
  it('plays a tick, a press and the match, in the middle of the view', () => {
    const played: SoundId[] = [];
    const ui = createUiSound(() => ({ playUi: (id) => (played.push(id), true) }));
    ui.hover();
    ui.press();
    ui.begin();
    expect(played).toEqual([Sound.Tick, Sound.Press, Sound.Ignite]);
  });

  it('does nothing, and does not throw, before the engine exists', () => {
    const ui = createUiSound(() => null);
    expect(() => {
      ui.hover();
      ui.press();
      ui.begin();
    }).not.toThrow();
  });

  it('looks the engine up each time, so one made later is used', () => {
    let engine: { playUi(id: SoundId): boolean } | null = null;
    const played: SoundId[] = [];
    const ui = createUiSound(() => engine);
    ui.hover();
    engine = { playUi: (id) => (played.push(id), true) };
    ui.hover();
    expect(played).toEqual([Sound.Tick]);
  });
});
