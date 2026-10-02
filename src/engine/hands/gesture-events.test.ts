import { describe, expect, it } from 'vitest';
import { GestureEventQueue } from './gesture-events';

describe('gesture event queue', () => {
  it('keeps events in order and reuses their objects', () => {
    const q = new GestureEventQueue(4);
    q.push('pinch-release', 'right', 1, 0.1, 0.9, -0.3, 0.2);
    q.push('cover-flame', 'left', 2, 0, 0.8, 0.3, 0.5);
    expect([q.at(0).type, q.at(1).type]).toEqual(['pinch-release', 'cover-flame']);
    expect(q.at(0).position).toEqual([0.1, 0.9, -0.3]);
    const first = q.at(0);
    q.clear();
    q.push('cover-flame', 'right', 3, 1, 2, 3, 0.5);
    expect(q.at(0)).toBe(first);
  });

  it('drops the oldest and counts it when full', () => {
    const q = new GestureEventQueue(2);
    for (let i = 0; i < 3; i++) q.push('pinch-release', 'right', i, 0, 0, 0, 0);
    expect(q.count).toBe(2);
    expect(q.dropped).toBe(1);
    expect(q.at(0).t).toBe(1);
  });
});
