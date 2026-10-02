import { describe, expect, it } from 'vitest';
import { ShapeEventQueue } from './shape-events';

describe('shape event queue', () => {
  it('keeps events in order and clears', () => {
    const q = new ShapeEventQueue(4);
    q.push('candidate', 'right', 'fist', 1, 0.5, 0);
    q.push('commit', 'right', 'fist', 1.4, 0.6, 0.4);
    expect(q.count).toBe(2);
    expect([q.at(0).type, q.at(1).type]).toEqual(['candidate', 'commit']);
    expect(q.at(1)).toMatchObject({ hand: 'right', shape: 'fist', t: 1.4, heldS: 0.4, reason: null });
    q.clear();
    expect(q.count).toBe(0);
    expect(() => q.at(0)).toThrow(RangeError);
  });

  it('drops the oldest and counts it when full', () => {
    const q = new ShapeEventQueue(2);
    q.push('candidate', 'left', 'cup', 0, 0, 0);
    q.push('commit', 'left', 'cup', 1, 0, 0);
    q.push('release', 'left', 'cup', 2, 0, 0, 'exit');
    expect(q.count).toBe(2);
    expect(q.dropped).toBe(1);
    expect([q.at(0).type, q.at(1).type]).toEqual(['commit', 'release']);
    expect(q.at(1).reason).toBe('exit');
  });

  it('reuses the same event objects', () => {
    const q = new ShapeEventQueue(2);
    q.push('candidate', 'left', 'cup', 0, 0, 0);
    const first = q.at(0);
    q.clear();
    q.push('commit', 'right', 'fox', 3, 0, 1);
    expect(q.at(0)).toBe(first);
    expect(first.shape).toBe('fox');
  });
});
