import { describe, expect, it } from 'vitest';
import {
  CAPTURE_KEY,
  captureOptions,
  loadCaptureChoice,
  nextCapture,
  NO_CAPTURE,
  saveCaptureChoice,
  type CaptureStorage,
} from './capture-mode';

function memory(initial: Record<string, string> = {}): CaptureStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('captureOptions', () => {
  it('is off, clean (no foveation) or sharp (no foveation, 1.5 times the resolution)', () => {
    expect(captureOptions('off')).toEqual(NO_CAPTURE);
    expect(captureOptions('clean')).toEqual({ enabled: true, foveation: 0, scale: null });
    expect(captureOptions('sharp')).toEqual({ enabled: true, foveation: 0, scale: 1.5 });
  });

  it('does not share its off object between calls', () => {
    const a = captureOptions('off');
    a.enabled = true;
    expect(captureOptions('off').enabled).toBe(false);
    expect(NO_CAPTURE.enabled).toBe(false);
  });
});

describe('nextCapture', () => {
  it('steps off, clean, sharp and round again', () => {
    expect(nextCapture('off')).toBe('clean');
    expect(nextCapture('clean')).toBe('sharp');
    expect(nextCapture('sharp')).toBe('off');
  });
});

describe('remembering the choice', () => {
  it('saves and loads it', () => {
    const s = memory();
    expect(loadCaptureChoice(s)).toBe('off');
    expect(saveCaptureChoice('sharp', s)).toBe(true);
    expect(s.data[CAPTURE_KEY]).toBe('sharp');
    expect(loadCaptureChoice(s)).toBe('sharp');
  });

  it('is off for anything else, and for storage that is missing or refuses', () => {
    expect(loadCaptureChoice(memory({ [CAPTURE_KEY]: 'loud' }))).toBe('off');
    expect(loadCaptureChoice(null)).toBe('off');
    const broken: CaptureStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadCaptureChoice(broken)).toBe('off');
    expect(saveCaptureChoice('clean', broken)).toBe(false);
    expect(saveCaptureChoice('clean', null)).toBe(false);
  });
});
