import { describe, expect, it } from 'vitest';
import { FailureReporter } from './failure-reporter';

describe('FailureReporter', () => {
  it('says so the first time a part fails, with its name and the error', () => {
    const lines: string[] = [];
    const r = new FailureReporter((m) => lines.push(m));
    r.report('audio', new TypeError('Failed to set the value: not finite'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^audio failed .*TypeError: Failed to set the value: not finite$/);
  });

  it('counts later failures of the same part without repeating the message', () => {
    const lines: string[] = [];
    const r = new FailureReporter((m) => lines.push(m));
    for (let i = 0; i < 1000; i++) r.report('audio', new Error('x'));
    r.report('shadow', new Error('y'));
    expect(lines).toHaveLength(2);
    expect(r.toJSON()).toEqual({ audio: 1000, shadow: 1 });
  });

  it('copes with things that are not Errors, including ones that cannot be turned into text', () => {
    const lines: string[] = [];
    const r = new FailureReporter((m) => lines.push(m));
    r.report('a', 'plain text');
    r.report('b', 42);
    r.report('c', Object.create(null));
    expect(lines[0]).toMatch(/plain text$/);
    expect(lines[1]).toMatch(/42$/);
    expect(lines[2]).toMatch(/unprintable error$/);
  });

  it('reports nothing until something fails', () => {
    const r = new FailureReporter(() => {
      throw new Error('should not be called');
    });
    expect(r.toJSON()).toEqual({});
  });
});
