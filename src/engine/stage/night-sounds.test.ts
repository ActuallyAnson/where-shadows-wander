import { describe, expect, it } from 'vitest';
import { NIGHT_SOUNDS, NightSounds, type NightSoundKind } from './night-sounds';

/** Runs `seconds` at 72 fps, allowed while `allowed(t)`; returns when each sound fired and which. */
function run(sounds: NightSounds, seconds: number, allowed: (t: number) => boolean = () => true) {
  const at: number[] = [];
  const kinds: NightSoundKind[] = [];
  const dt = 1 / 72;
  for (let i = 0; i * dt < seconds; i++) {
    sounds.update(dt, allowed(i * dt));
    const k = sounds.fired;
    if (k) {
      at.push(i * dt);
      kinds.push(k);
    }
  }
  return { at, kinds };
}

describe('NightSounds', () => {
  it('is quiet at first, then sparse: never closer together than the shortest gap', () => {
    const { at } = run(new NightSounds(3), 600);
    expect(at[0]).toBeGreaterThanOrEqual(NIGHT_SOUNDS.firstS - 0.05);
    for (let i = 1; i < at.length; i++) expect(at[i] - at[i - 1]).toBeGreaterThanOrEqual(NIGHT_SOUNDS.gapMinS - 0.05);
    expect(at.length).toBeLessThanOrEqual(600 / NIGHT_SOUNDS.gapMinS + 1);
    expect(at.length).toBeGreaterThanOrEqual(600 / NIGHT_SOUNDS.gapMaxS - 1);
  });

  it('makes both creaks and gusts', () => {
    const { kinds } = run(new NightSounds(5), 1800);
    expect(kinds).toContain('creak');
    expect(kinds).toContain('gust');
  });

  it('holds its clock while not allowed (a memory playing), and never fires then', () => {
    const blocked = (t: number) => t >= 10 && t < 200;
    const { at } = run(new NightSounds(3), 300, (t) => !blocked(t));
    for (const t of at) expect(blocked(t)).toBe(false);
    // 10 s allowed before the block: the first comes firstS - 10 s after it lifts.
    expect(at[0]).toBeGreaterThanOrEqual(200 + NIGHT_SOUNDS.firstS - 10 - 0.05);
  });

  it('fires on one update only', () => {
    const s = new NightSounds(1, { ...NIGHT_SOUNDS, firstS: 0.5 });
    s.update(0.6, true);
    expect(s.fired).not.toBeNull();
    s.update(0.01, true);
    expect(s.fired).toBeNull();
  });

  it('repeats exactly for the same seed', () => {
    expect(run(new NightSounds(7), 400)).toEqual(run(new NightSounds(7), 400));
  });
});
