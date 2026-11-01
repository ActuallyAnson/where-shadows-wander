import { describe, expect, it } from 'vitest';
import { TaskPool, type WorkerLike } from './task-pool';

/** A worker that answers each job with its input doubled, when `answer()` is called (so a test controls the timing). */
class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  terminated = false;
  readonly received: { id: number; input: number }[] = [];
  postMessage(message: unknown): void {
    this.received.push(message as { id: number; input: number });
  }
  terminate(): void {
    this.terminated = true;
  }
  answer(): void {
    const m = this.received[this.received.length - 1 - (this.pending() - 1)];
    this.answered++;
    this.onmessage?.({ data: { id: m.id, output: m.input * 2 } });
  }
  answered = 0;
  pending(): number {
    return this.received.length - this.answered;
  }
}

describe('TaskPool', () => {
  it('runs a job on the worker and resolves with its answer', async () => {
    const w = new FakeWorker();
    const pool = new TaskPool<number, number>({ create: () => w, size: 1, fallback: (x) => x * 100 });
    expect(pool.workerBacked).toBe(true);
    const p = pool.run(21);
    expect(w.received).toHaveLength(1);
    w.answer();
    expect(await p).toBe(42);
    expect(pool.doneByWorker).toBe(1);
    expect(pool.doneOnMain).toBe(0);
  });

  it('keeps jobs in order, one at a time per worker, the next going out when the last comes back', async () => {
    const w = new FakeWorker();
    const pool = new TaskPool<number, number>({ create: () => w, size: 1, fallback: (x) => x });
    const a = pool.run(1);
    const b = pool.run(2);
    const c = pool.run(3);
    expect(w.received.map((m) => m.input)).toEqual([1]); // only one in flight
    w.answer();
    expect(await a).toBe(2);
    expect(w.received.map((m) => m.input)).toEqual([1, 2]);
    w.answer();
    w.answer();
    expect([await b, await c]).toEqual([4, 6]);
    expect(pool.doneByWorker).toBe(3);
  });

  it('runs everything on the main thread when there are no workers', async () => {
    const pool = new TaskPool<number, number>({ create: () => null, size: 2, fallback: (x) => x + 1 });
    expect(pool.workerBacked).toBe(false);
    expect(await pool.run(1)).toBe(2);
    expect(pool.doneOnMain).toBe(1);
  });

  it('runs on the main thread when making a worker throws', async () => {
    const pool = new TaskPool<number, number>({
      create: () => {
        throw new Error('no workers here');
      },
      size: 1,
      fallback: (x) => x * 3,
    });
    expect(await pool.run(2)).toBe(6);
  });

  it('falls back for the job in flight and the jobs waiting when a worker fails, and stops using workers', async () => {
    const w = new FakeWorker();
    const pool = new TaskPool<number, number>({ create: () => w, size: 1, fallback: (x) => x + 1000 });
    const a = pool.run(1);
    const b = pool.run(2);
    w.onerror?.({});
    expect([await a, await b]).toEqual([1001, 1002]);
    expect(w.terminated).toBe(true);
    expect(pool.workerBacked).toBe(false);
    expect(await pool.run(3)).toBe(1003);
    expect(pool.doneByWorker).toBe(0);
  });

  it('rejects a job whose fallback throws, and can be disposed with work waiting', async () => {
    const w = new FakeWorker();
    const pool = new TaskPool<number, number>({
      create: () => w,
      size: 1,
      fallback: (x) => {
        if (x < 0) throw new Error('bad input');
        return x;
      },
    });
    const bad = pool.run(-1);
    const ok = pool.run(5);
    pool.dispose();
    await expect(bad).rejects.toThrow('bad input');
    expect(await ok).toBe(5);
  });
});
