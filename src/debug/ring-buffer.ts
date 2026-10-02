// Fixed-size buffer of recent samples. push() is O(1) and allocation-free, so it
// is safe to call every frame; the statistics allocate and are meant for
// occasional reads (saving a report), not per frame.
export class RingBuffer {
  private readonly data: Float64Array;
  private next = 0;
  private count = 0;

  constructor(readonly capacity: number) {
    this.data = new Float64Array(capacity);
  }

  get size(): number {
    return this.count;
  }

  push(v: number): void {
    this.data[this.next] = v;
    this.next = (this.next + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  clear(): void {
    this.next = 0;
    this.count = 0;
  }

  mean(): number {
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.data[i];
    return this.count ? sum / this.count : 0;
  }

  max(): number {
    let m = 0;
    for (let i = 0; i < this.count; i++) m = Math.max(m, this.data[i]);
    return m;
  }

  /** p in [0, 1], nearest-rank. */
  percentile(p: number): number {
    if (!this.count) return 0;
    const sorted = this.data.slice(0, this.count).sort();
    return sorted[Math.min(this.count - 1, Math.floor(this.count * p))];
  }
}
