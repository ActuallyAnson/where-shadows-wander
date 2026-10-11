// Where saves are kept. A KeyValueStore may throw on any call (blocked storage, private mode, a full disk);
// the save manager catches that. `browserStore` is localStorage behind a probe, or null if it cannot be used at
// all; `MemoryStore` is the working fallback (it keeps the game going but is lost with the page).

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** True for a store that does not survive the page. */
  readonly volatile?: boolean;
}

export class MemoryStore implements KeyValueStore {
  readonly volatile = true;
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

/** localStorage if it works (reading the property can throw, and a full or blocked store throws on write), else null. */
export function browserStore(): KeyValueStore | null {
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return null;
    const probe = 'wsw.save.probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return {
      get: (k) => ls.getItem(k),
      set: (k, v) => ls.setItem(k, v),
      remove: (k) => ls.removeItem(k),
    };
  } catch {
    return null;
  }
}
