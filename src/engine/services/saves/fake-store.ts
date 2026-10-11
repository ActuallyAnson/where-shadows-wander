// A store for tests that can be made to fail in the ways real storage does.
import type { KeyValueStore } from './storage';

export class FakeStore implements KeyValueStore {
  readonly map = new Map<string, string>();
  /** Throws this on every get/set/remove of a matching key (or any key if the matcher is omitted). */
  getError: ((key: string) => Error | null) | null = null;
  setError: ((key: string) => Error | null) | null = null;
  removeError: ((key: string) => Error | null) | null = null;
  /** Changes what is actually stored by a set, to model a write that is cut short or lost. */
  distortSet: ((key: string, value: string) => string | null) | null = null;
  sets: string[] = [];
  gets = 0;

  get(key: string): string | null {
    this.gets++;
    const e = this.getError?.(key);
    if (e) throw e;
    return this.map.get(key) ?? null;
  }

  set(key: string, value: string): void {
    const e = this.setError?.(key);
    if (e) throw e;
    this.sets.push(key);
    const stored = this.distortSet ? this.distortSet(key, value) : value;
    if (stored !== null) this.map.set(key, stored);
  }

  remove(key: string): void {
    const e = this.removeError?.(key);
    if (e) throw e;
    this.map.delete(key);
  }
}

export const quotaError = () =>
  Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
export const blockedError = () => Object.assign(new Error('The operation is insecure.'), { name: 'SecurityError' });
