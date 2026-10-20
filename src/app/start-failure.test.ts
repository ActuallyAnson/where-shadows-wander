import { describe, expect, it } from 'vitest';
import { startFailureDetail } from './start-failure';

describe('startFailureDetail', () => {
  it('gives the name and message of an Error', () => {
    expect(startFailureDetail(new TypeError('no gl'))).toBe('TypeError: no gl');
  });

  it('prints anything else', () => {
    expect(startFailureDetail('boom')).toBe('boom');
    expect(startFailureDetail(undefined)).toBe('undefined');
  });

  it('trims a long message', () => {
    const detail = startFailureDetail(new Error('x'.repeat(500)));
    expect(detail.length).toBe(200);
    expect(detail.endsWith('...')).toBe(true);
  });

  it('survives a value that cannot be printed', () => {
    const hostile = {
      toString() {
        throw new Error('no');
      },
    };
    expect(startFailureDetail(hostile)).toBe('unprintable error');
  });
});
