import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetLoader } from './asset-loader';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function make(
  load: (id: string) => Promise<string>,
  extra: { retries?: number; timeoutMs?: number; retryAfterMs?: number } = {},
) {
  const errors: string[] = [];
  const loader = new AssetLoader<string>({
    now: () => Date.now(),
    load,
    fallback: (id) => `standin:${id}`,
    onError: (m) => errors.push(m),
    ...extra,
  });
  return { loader, errors };
}

describe('AssetLoader', () => {
  it('loads once and serves later asks from memory', async () => {
    const load = vi.fn(async (id: string) => `real:${id}`);
    const { loader } = make(load);
    expect(loader.peek('crow')).toBeUndefined();
    expect(await loader.get('crow')).toBe('real:crow');
    expect(await loader.get('crow')).toBe('real:crow');
    expect(loader.peek('crow')).toBe('real:crow');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shares one load between callers asking at the same time', async () => {
    const load = vi.fn(async (id: string) => `real:${id}`);
    const { loader } = make(load);
    const [a, b] = await Promise.all([loader.get('crow'), loader.get('crow')]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('tries again after a failure and uses the second answer', async () => {
    const load = vi
      .fn<(id: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('real');
    const { loader, errors } = make(load);
    expect(await loader.get('crow')).toBe('real');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/try 1 failed: network/);
  });

  it('falls back to the stand-in when every try fails, and does not ask again straight away', async () => {
    const load = vi.fn(async () => {
      throw new Error('404');
    });
    const { loader, errors } = make(load);
    expect(await loader.get('crow')).toBe('standin:crow');
    expect(load).toHaveBeenCalledTimes(2);
    expect(errors.at(-1)).toMatch(/gave up/);
    expect(loader.peek('crow')).toBeUndefined();
    expect(await loader.get('crow')).toBe('standin:crow');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('tries again after the retry delay, and then serves the real asset for good', async () => {
    let up = false;
    const load = vi.fn(async (id: string) => {
      if (!up) throw new Error('not yet');
      return `real:${id}`;
    });
    const { loader } = make(load, { retryAfterMs: 5000 });
    expect(await loader.get('crow')).toBe('standin:crow');
    up = true;
    expect(await loader.get('crow')).toBe('standin:crow'); // still inside the delay
    vi.advanceTimersByTime(5000);
    expect(await loader.get('crow')).toBe('real:crow');
    expect(loader.peek('crow')).toBe('real:crow');
    expect(await loader.get('crow')).toBe('real:crow');
  });

  it('retry() skips the wait', async () => {
    let up = false;
    const { loader } = make(async (id) => {
      if (!up) throw new Error('not yet');
      return `real:${id}`;
    });
    expect(await loader.get('crow')).toBe('standin:crow');
    up = true;
    loader.retry('crow');
    expect(await loader.get('crow')).toBe('real:crow');
  });

  it('gives up on a load that never answers after the timeout, not after IWSDK’s 30 s', async () => {
    const load = vi.fn(() => new Promise<string>(() => {}));
    const { loader, errors } = make(load, { timeoutMs: 1000, retries: 0 });
    const result = loader.get('crow');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe('standin:crow');
    expect(errors[0]).toMatch(/timed out after 1000 ms/);
  });

  it('prefetch starts loads without waiting', async () => {
    const load = vi.fn(async (id: string) => `real:${id}`);
    const { loader } = make(load);
    loader.prefetch(['a', 'b']);
    expect(load).toHaveBeenCalledTimes(2);
    await vi.runAllTimersAsync();
    expect(loader.peek('a')).toBe('real:a');
  });
});
