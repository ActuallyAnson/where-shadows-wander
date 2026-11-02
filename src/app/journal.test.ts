import { describe, expect, it } from 'vitest';
import { anotherWayLine, endLine, nightWays, waysOf } from './journal';

const books = { id: 'a', solutions: ['bridge'] };
const ledge = { id: 'b', solutions: ['rock', 'bridge'] };

describe('the journal', () => {
  it('counts the listed ways found, ignoring a way nobody designed', () => {
    expect(waysOf(ledge, { b: ['rock'] })).toEqual({ found: 1, total: 2 });
    expect(waysOf(ledge, { b: ['other'] })).toEqual({ found: 0, total: 2 });
    expect(waysOf(ledge, {})).toEqual({ found: 0, total: 2 });
  });

  it('adds up across the night', () => {
    expect(nightWays([books, ledge], { a: ['bridge'], b: ['rock'] })).toEqual({ found: 2, total: 3 });
  });

  it('hints at another way only when one is left to find', () => {
    expect(anotherWayLine({ found: 1, total: 1 })).toBe('');
    expect(anotherWayLine({ found: 2, total: 2 })).toBe('');
    expect(anotherWayLine({ found: 1, total: 2 })).toBe('There is another way through.');
    expect(anotherWayLine({ found: 1, total: 3 })).toBe('There are other ways through.');
  });

  it('writes the end screen line from the count', () => {
    expect(endLine({ found: 0, total: 0 }, 'old')).toBe('old');
    expect(endLine({ found: 5, total: 9 }, 'old')).toBe('5 of 9 ways found. The light is yours to keep.');
    expect(endLine({ found: 9, total: 9 }, 'old')).toContain('Every way found');
  });
});
