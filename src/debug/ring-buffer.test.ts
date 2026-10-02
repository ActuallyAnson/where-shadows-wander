import { describe, expect, it } from 'vitest';
import { RingBuffer } from './ring-buffer';

describe('RingBuffer', () => {
  it('keeps only the most recent samples', () => {
    const b = new RingBuffer(3);
    [1, 2, 3, 4, 5].forEach((v) => b.push(v));
    expect(b.size).toBe(3);
    expect(b.mean()).toBe(4);
    expect(b.max()).toBe(5);
  });

  it('computes a nearest-rank percentile', () => {
    const b = new RingBuffer(100);
    for (let i = 1; i <= 100; i++) b.push(i);
    expect(b.percentile(0.95)).toBe(96);
  });

  it('is empty after clear', () => {
    const b = new RingBuffer(4);
    b.push(7);
    b.clear();
    expect(b.size).toBe(0);
    expect(b.mean()).toBe(0);
  });
});
