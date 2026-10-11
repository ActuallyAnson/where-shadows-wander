// A fixed number of sound voices, each with a priority. When every voice is busy a new sound takes the oldest
// voice of the lowest priority, but only if that voice is no more important than the new sound; otherwise the
// new sound is dropped. No allocation after construction. Plain TypeScript.

export class VoicePool {
  private readonly busy: Uint8Array;
  private readonly priority: Uint8Array;
  private readonly startedAt: Float64Array;
  /** Sounds dropped because every voice was busy with something more important. */
  dropped = 0;
  /** Sounds that took over a busy voice. */
  stolen = 0;

  constructor(readonly size: number) {
    this.busy = new Uint8Array(size);
    this.priority = new Uint8Array(size);
    this.startedAt = new Float64Array(size);
  }

  /** Voices in use. */
  get active(): number {
    let n = 0;
    for (let i = 0; i < this.size; i++) n += this.busy[i];
    return n;
  }

  /**
   * Takes a voice for a sound of `priority` (higher is more important) starting at `now` (seconds).
   * @returns the voice index, or -1 if there is none free and none less important to take over.
   *   If the voice was busy, the caller must stop what it was playing.
   */
  acquire(priority: number, now: number): number {
    let victim = -1;
    for (let i = 0; i < this.size; i++) {
      if (this.busy[i] === 0) {
        this.take(i, priority, now);
        return i;
      }
      if (
        victim < 0 ||
        this.priority[i] < this.priority[victim] ||
        (this.priority[i] === this.priority[victim] && this.startedAt[i] < this.startedAt[victim])
      )
        victim = i;
    }
    if (victim >= 0 && this.priority[victim] <= priority) {
      this.stolen++;
      this.take(victim, priority, now);
      return victim;
    }
    this.dropped++;
    return -1;
  }

  /** Frees a voice (its sound ended). Releasing a free voice does nothing. */
  release(voice: number): void {
    this.busy[voice] = 0;
  }

  isBusy(voice: number): boolean {
    return this.busy[voice] === 1;
  }

  private take(i: number, priority: number, now: number): void {
    this.busy[i] = 1;
    this.priority[i] = priority;
    this.startedAt[i] = now;
  }
}
