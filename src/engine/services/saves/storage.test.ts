import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStore, MemoryStore } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('MemoryStore', () => {
  it('keeps, replaces and removes values, and says it does not survive the page', () => {
    const s = new MemoryStore();
    expect(s.get('k')).toBeNull();
    s.set('k', 'v');
    s.set('k', 'w');
    expect(s.get('k')).toBe('w');
    s.remove('k');
    expect(s.get('k')).toBeNull();
    expect(s.volatile).toBe(true);
  });
});

describe('browserStore', () => {
  const fakeStorage = (over: Partial<Storage> = {}) => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      ...over,
    } as unknown as Storage;
  };

  it('wraps a working localStorage', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const s = browserStore()!;
    s.set('a', '1');
    expect(s.get('a')).toBe('1');
    s.remove('a');
    expect(s.get('a')).toBeNull();
    expect(s.volatile).toBeUndefined();
  });

  it('leaves no probe key behind', () => {
    const ls = fakeStorage();
    vi.stubGlobal('localStorage', ls);
    browserStore();
    expect(ls.getItem('wsw.save.probe')).toBeNull();
  });

  it('is null when there is no localStorage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(browserStore()).toBeNull();
  });

  it('is null when touching localStorage throws (blocked storage)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    expect(browserStore()).toBeNull();
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('is null when writing throws (private mode, a full disk)', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        setItem: () => {
          throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
        },
      }),
    );
    expect(browserStore()).toBeNull();
  });
});
