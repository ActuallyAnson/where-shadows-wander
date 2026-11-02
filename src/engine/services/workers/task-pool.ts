// A small pool of Web Workers that runs one kind of job off the main thread and hands the answer back as a promise. The jobs here are
// ones that take real time on a headset's CPU (rendering seconds of synthesised sound) and would otherwise freeze the frame loop for
// a hundred milliseconds or more the first time they are needed. The pool sends the input, takes the answer back (typed arrays move
// without being copied when they are listed as transferable), and keeps its jobs in order. If workers are not available, or one
// fails, every job (the ones waiting too) runs on the main thread instead with the `fallback` function, so the game works either way
// and only the timing differs. Plain TypeScript: the worker is made by a function the caller gives it, so tests use a fake.

/** The part of a Worker this uses. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface TaskPoolOptions<I, O> {
  /** Makes one worker, or null when workers are not available. */
  create: () => WorkerLike | null;
  /** How many workers to run (a headset has few cores to spare: one is usual). */
  size: number;
  /** Does the same job on the main thread. */
  fallback: (input: I) => O;
}

interface Job<I, O> {
  readonly id: number;
  readonly input: I;
  readonly transfer: Transferable[] | undefined;
  readonly resolve: (value: O) => void;
  readonly reject: (reason: unknown) => void;
}

export class TaskPool<I, O> {
  private readonly workers: WorkerLike[] = [];
  private readonly busy: (Job<I, O> | null)[] = [];
  private readonly queue: Job<I, O>[] = [];
  private nextId = 1;
  private broken = false;
  /** Jobs done by a worker, and by the main thread instead. */
  doneByWorker = 0;
  doneOnMain = 0;

  constructor(private readonly options: TaskPoolOptions<I, O>) {
    for (let i = 0; i < Math.max(1, options.size); i++) {
      let w: WorkerLike | null;
      try {
        w = options.create();
      } catch {
        w = null;
      }
      if (!w) {
        this.broken = true;
        break;
      }
      const index = this.workers.length;
      w.onmessage = (e) => this.finish(index, e.data);
      w.onerror = () => this.fail();
      this.workers.push(w);
      this.busy.push(null);
    }
    if (this.workers.length === 0) this.broken = true;
  }

  /** Whether jobs run on workers (false: the main thread does them). */
  get workerBacked(): boolean {
    return !this.broken;
  }

  /** Runs a job. Resolves with the answer, from a worker if there is one. */
  run(input: I, transfer?: Transferable[]): Promise<O> {
    return new Promise<O>((resolve, reject) => {
      const job: Job<I, O> = { id: this.nextId++, input, transfer, resolve, reject };
      if (this.broken) {
        this.runOnMain(job);
        return;
      }
      this.queue.push(job);
      this.pump();
    });
  }

  /** Stops the workers. Jobs waiting run on the main thread. */
  dispose(): void {
    this.fail();
  }

  private pump(): void {
    for (let i = 0; i < this.workers.length && this.queue.length > 0; i++) {
      if (this.busy[i]) continue;
      const job = this.queue.shift()!;
      this.busy[i] = job;
      try {
        this.workers[i].postMessage({ id: job.id, input: job.input }, job.transfer);
      } catch {
        this.fail();
        return;
      }
    }
  }

  private finish(index: number, data: unknown): void {
    const job = this.busy[index];
    this.busy[index] = null;
    if (job) {
      this.doneByWorker++;
      job.resolve((data as { output: O }).output);
    }
    this.pump();
  }

  /** A worker failed: stop using workers, and run everything not finished on the main thread. */
  private fail(): void {
    if (this.broken) return;
    this.broken = true;
    for (const w of this.workers) {
      w.onmessage = null;
      w.onerror = null;
      w.terminate();
    }
    const pending = [...this.busy.filter((j): j is Job<I, O> => j !== null), ...this.queue];
    this.workers.length = 0;
    this.busy.length = 0;
    this.queue.length = 0;
    for (const job of pending) this.runOnMain(job);
  }

  private runOnMain(job: Job<I, O>): void {
    try {
      const out = this.options.fallback(job.input);
      this.doneOnMain++;
      job.resolve(out);
    } catch (e) {
      job.reject(e);
    }
  }
}
