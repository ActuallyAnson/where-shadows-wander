// Loads assets on demand without stalling the game: each try has its own (shorter) timeout, a failed load is
// tried again once, simultaneous callers share one load, and a failure resolves to a stand-in instead of
// rejecting, so a missing file shows a placeholder. A stand-in is not kept for good: after `retryAfterMs` the
// next `get` tries the load again (a file that arrived late, or one asked for before the world existed).
// `load` is injected (iwsdk-assets.ts wraps IWSDK's AssetManager) so this is unit-testable with no browser.
// Not for critical assets: those load inside World.create, before any of this exists.
//
// A loaded model is one shared object. To place it in several spots, take a fresh copy each time with
// AssetManager.getGLTF(id) once `get(id)` has resolved.

export interface AssetLoaderOptions<T> {
  /** Loads one manifest asset by id; rejects on failure. */
  load: (id: string) => Promise<T>;
  /** What to use when an asset cannot be loaded. */
  fallback: (id: string) => T;
  /** Called with a short message each time a try fails. */
  onError?: (message: string) => void;
  /** Per try, milliseconds. IWSDK's own limit is 30 s, far too long to wait in a headset. */
  timeoutMs?: number;
  /** Extra tries after the first, within one `get`. */
  retries?: number;
  /** After a `get` ended in the stand-in, how long later calls get it straight away before trying again. */
  retryAfterMs?: number;
  /** The clock, for tests. */
  now?: () => number;
}

export class AssetLoader<T> {
  private readonly done = new Map<string, T>();
  private readonly pending = new Map<string, Promise<T>>();
  private readonly standIns = new Map<string, { value: T; at: number }>();
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly retryAfterMs: number;
  private readonly now: () => number;

  constructor(private readonly options: AssetLoaderOptions<T>) {
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.retries = options.retries ?? 1;
    this.retryAfterMs = options.retryAfterMs ?? 10_000;
    this.now = options.now ?? (() => Date.now());
  }

  /** The asset if it has loaded, else undefined (also while only a stand-in exists). Cheap enough for a frame. */
  peek(id: string): T | undefined {
    return this.done.get(id);
  }

  /** Resolves with the asset, or with its stand-in if the tries ran out. Never rejects. */
  get(id: string): Promise<T> {
    const ready = this.done.get(id);
    if (ready !== undefined) return Promise.resolve(ready);
    const standIn = this.standIns.get(id);
    if (standIn && this.now() - standIn.at < this.retryAfterMs) return Promise.resolve(standIn.value);
    let p = this.pending.get(id);
    if (!p) {
      p = this.run(id).then((value) => {
        this.pending.delete(id);
        return value;
      });
      this.pending.set(id, p);
    }
    return p;
  }

  /** Forgets that a load failed, so the next `get` tries at once. */
  retry(id: string): void {
    this.standIns.delete(id);
  }

  /** Starts loading several assets (for example everything a chapter needs) without waiting. */
  prefetch(ids: readonly string[]): void {
    for (const id of ids) void this.get(id);
  }

  private async run(id: string): Promise<T> {
    let last = 'unknown error';
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const value = await withTimeout(this.options.load(id), this.timeoutMs, id);
        this.done.set(id, value);
        this.standIns.delete(id);
        return value;
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
        this.options.onError?.(`asset "${id}" try ${attempt + 1} failed: ${last}`);
      }
    }
    this.options.onError?.(`asset "${id}" gave up (${last}); using a stand-in`);
    const value = this.standIns.get(id)?.value ?? this.options.fallback(id);
    this.standIns.set(id, { value, at: this.now() });
    return value;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, id: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms (${id})`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
