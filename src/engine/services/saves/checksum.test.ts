import { describe, expect, it } from 'vitest';
import { checksum } from './checksum';

describe('checksum', () => {
  it('is 8 hex digits, the same every time, and known for known input', () => {
    expect(checksum('')).toBe('811c9dc5');
    expect(checksum('a')).toBe('e40c292c');
    expect(checksum('hello')).toBe(checksum('hello'));
    expect(checksum('hello')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes when any character changes, is added or is cut off', () => {
    const base = checksum('{"a":1,"b":[1,2,3]}');
    expect(checksum('{"a":2,"b":[1,2,3]}')).not.toBe(base);
    expect(checksum('{"a":1,"b":[1,2,3]} ')).not.toBe(base);
    expect(checksum('{"a":1,"b":[1,2,3')).not.toBe(base);
  });
});
