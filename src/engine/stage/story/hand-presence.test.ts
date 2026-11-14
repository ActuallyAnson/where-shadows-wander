import { describe, expect, it } from 'vitest';
import { HAND_FAINT, HandPresence } from './hand-presence';

describe('HandPresence', () => {
  it('starts full, so the shadow is plain before the story begins', () => {
    expect(new HandPresence().value).toBe(1);
  });

  it('fades to faint while a memory plays and darkens again when the story calls for a hand', () => {
    const p = new HandPresence();
    for (let i = 0; i < 100; i++) p.update(0.05, false);
    expect(p.value).toBeCloseTo(HAND_FAINT);
    p.update(0.3, true);
    expect(p.value).toBeGreaterThan(HAND_FAINT);
    expect(p.value).toBeLessThan(1);
    for (let i = 0; i < 40; i++) p.update(0.05, true);
    expect(p.value).toBe(1);
  });

  it('holds still with no time passing and ignores bad steps', () => {
    const p = new HandPresence();
    p.update(1, false);
    const v = p.value;
    p.update(0, true);
    p.update(-1, true);
    p.update(NaN, true);
    expect(p.value).toBe(v);
  });
});
