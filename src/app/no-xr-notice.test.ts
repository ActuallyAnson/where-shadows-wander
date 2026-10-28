import { describe, expect, it } from 'vitest';
import { landingHtml, xrSessionSupported, type XrSupport } from './no-xr-notice';

function fakeXr(supported: readonly string[]): XrSupport & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    isSessionSupported: async (mode) => {
      asked.push(mode);
      return supported.includes(mode);
    },
  };
}

describe('xrSessionSupported', () => {
  it('asks for immersive-vr by default', async () => {
    const xr = fakeXr(['immersive-vr']);
    expect(await xrSessionSupported(xr, '')).toBe(true);
    expect(xr.asked).toEqual(['immersive-vr']);
  });

  it('is not fooled by AR support when the page wants VR', async () => {
    expect(await xrSessionSupported(fakeXr(['immersive-ar']), '')).toBe(false);
  });

  it('asks for immersive-ar with ?xr=ar', async () => {
    const xr = fakeXr(['immersive-ar']);
    expect(await xrSessionSupported(xr, '?xr=ar')).toBe(true);
    expect(xr.asked).toEqual(['immersive-ar']);
  });

  it('is false when WebXR is missing', async () => {
    expect(await xrSessionSupported(undefined, '')).toBe(false);
  });

  it('is false when the check throws', async () => {
    const xr: XrSupport = {
      isSessionSupported: () => Promise.reject(new Error('blocked')),
    };
    expect(await xrSessionSupported(xr, '')).toBe(false);
  });
});

describe('landingHtml', () => {
  it('shows the game name, the link to open on a headset, and the Hand Lab way in', () => {
    const html = landingHtml('https://example.test/game/');
    expect(html).toContain('Where Shadows Wander');
    expect(html).toContain('https://example.test/game/');
    expect(html).toContain('./?mock=1');
    expect(html).toContain('Meta Quest');
  });

  it('cannot be broken out of by the link', () => {
    const html = landingHtml('https://x.test/"><script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });
});
