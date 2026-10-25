import { describe, expect, it } from 'vitest';
import { validateCutscene } from '../engine/sim/cutscene';
import { OPENING, OPENING_S, openingFoxAlpha } from './opening';

describe('opening', () => {
  it('is a playable cutscene that ends with the fox', () => {
    expect(validateCutscene(OPENING)).toEqual([]);
    const end = Math.max(...OPENING.beats.map((b) => b.at + b.duration));
    expect(end).toBeLessThanOrEqual(OPENING_S);
  });

  it('fades the fox in, holds it and fades it out', () => {
    expect(openingFoxAlpha(0)).toBe(0);
    expect(openingFoxAlpha(1)).toBeCloseTo(0.5);
    expect(openingFoxAlpha(5)).toBe(1);
    expect(openingFoxAlpha(OPENING_S - 1.25)).toBeCloseTo(0.5);
    expect(openingFoxAlpha(OPENING_S)).toBe(0);
  });
});
