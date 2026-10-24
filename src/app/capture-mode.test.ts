import { describe, expect, it } from 'vitest';
import { captureFromUrl, NO_CAPTURE } from './capture-mode';

describe('captureFromUrl', () => {
  it('is off without ?capture, whatever else is in the address', () => {
    expect(captureFromUrl('')).toEqual(NO_CAPTURE);
    expect(captureFromUrl('?foveation=0.5&scale=1.5')).toEqual(NO_CAPTURE);
    expect(captureFromUrl('?debug=joints')).toEqual(NO_CAPTURE);
  });

  it('turns on with ?capture or ?capture=1, with no foveation and the default resolution', () => {
    expect(captureFromUrl('?capture')).toEqual({ enabled: true, foveation: 0, scale: null });
    expect(captureFromUrl('capture=1')).toEqual({ enabled: true, foveation: 0, scale: null });
  });

  it('reads the foveation and the render scale', () => {
    expect(captureFromUrl('?capture&foveation=0.5&scale=1.4')).toEqual({ enabled: true, foveation: 0.5, scale: 1.4 });
  });

  it('keeps both values in range', () => {
    expect(captureFromUrl('?capture&foveation=7&scale=9')).toEqual({ enabled: true, foveation: 1, scale: 2 });
    expect(captureFromUrl('?capture&foveation=-1&scale=0.2')).toEqual({ enabled: true, foveation: 0, scale: 1 });
  });

  it('ignores a value that is empty or not a number', () => {
    expect(captureFromUrl('?capture&foveation=&scale=')).toEqual({ enabled: true, foveation: 0, scale: null });
    expect(captureFromUrl('?capture&foveation=high&scale=big')).toEqual({ enabled: true, foveation: 0, scale: null });
  });

  it('does not share its default object between calls', () => {
    const a = captureFromUrl('');
    a.enabled = true;
    expect(captureFromUrl('').enabled).toBe(false);
    expect(NO_CAPTURE.enabled).toBe(false);
  });
});
