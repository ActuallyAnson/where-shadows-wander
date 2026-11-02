import { describe, expect, it } from 'vitest';
import { DIMMING_LINE, lineForPuzzle, PUZZLE_LINES, RETURN_LINE, WAKE_LINES, wakeLineFor } from './story';
import { NIGHT_MOOD } from './night-driver';

describe('the story lines', () => {
  it('has one line for each puzzle of the night', () => {
    expect(PUZZLE_LINES).toHaveLength(NIGHT_MOOD.length);
    expect(WAKE_LINES).toHaveLength(NIGHT_MOOD.length);
  });

  it('keeps every line short enough to read in one glance and to fit the wall', () => {
    for (const line of [...PUZZLE_LINES, ...WAKE_LINES, DIMMING_LINE, RETURN_LINE]) {
      expect(line.trim()).not.toBe('');
      expect(line.split(/\s+/).length).toBeLessThanOrEqual(11);
      expect(line.length).toBeLessThanOrEqual(56);
    }
  });

  it('gives nothing for a puzzle that does not exist', () => {
    expect(lineForPuzzle(-1)).toBe('');
    expect(lineForPuzzle(99)).toBe('');
    expect(lineForPuzzle(2)).toBe(PUZZLE_LINES[2]);
    expect(wakeLineFor(7)).toBe('');
    expect(wakeLineFor(0)).toBe(WAKE_LINES[0]);
  });
});
