import { describe, expect, it } from 'vitest';
import { sampleHand } from './hand-sample';
import { PRESETS, type PresetName } from './synthetic-hand';

describe('hand sample pictures', () => {
  it('fits every shape into -1..1 on both hands', () => {
    for (const preset of Object.keys(PRESETS) as PresetName[])
      for (const side of ['left', 'right'] as const) {
        const pts = sampleHand(preset, side);
        for (const v of pts) expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-6);
        expect(Math.max(...pts.map(Math.abs))).toBeCloseTo(1, 5);
      }
  });

  it('mirrors the left hand', () => {
    const r = sampleHand('rabbit', 'right'),
      l = sampleHand('rabbit', 'left');
    for (let j = 0; j < 25; j++) expect(l[j * 2]).toBeCloseTo(-r[j * 2], 5);
  });
});
