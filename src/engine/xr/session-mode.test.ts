import { describe, expect, it } from 'vitest';
import { clearFor, occluderDefault, ROOM_BACKGROUND, sessionModeOf, xrModeFromUrl } from './session-mode';

describe('xrModeFromUrl', () => {
  it('defaults to VR', () => {
    expect(xrModeFromUrl('')).toBe('vr');
    expect(xrModeFromUrl('?mock=1')).toBe('vr');
    expect(xrModeFromUrl('?xr=vr')).toBe('vr');
  });

  it('starts AR only for ?xr=ar', () => {
    expect(xrModeFromUrl('?xr=ar')).toBe('ar');
    expect(xrModeFromUrl('?stage=wall&xr=ar')).toBe('ar');
    expect(xrModeFromUrl('?xr=AR')).toBe('vr');
    expect(xrModeFromUrl('?xr=')).toBe('vr');
  });

  it('maps to the WebXR session mode', () => {
    expect(sessionModeOf('vr')).toBe('immersive-vr');
    expect(sessionModeOf('ar')).toBe('immersive-ar');
  });
});

describe('occluderDefault', () => {
  it('is off in a VR session (opaque display) and on over passthrough', () => {
    expect(occluderDefault('opaque', false, null)).toBe(false);
    expect(occluderDefault('alpha-blend', false, null)).toBe(true);
    expect(occluderDefault('additive', false, null)).toBe(true);
  });

  it('is off before a session exists and in mock mode', () => {
    expect(occluderDefault(undefined, false, null)).toBe(false);
    expect(occluderDefault(undefined, true, null)).toBe(false);
    expect(occluderDefault('alpha-blend', true, null)).toBe(false);
  });

  it('?occlude=1 turns it on and ?occlude=0 turns it off, whatever the session', () => {
    for (const blend of ['opaque', 'alpha-blend', undefined])
      for (const mock of [false, true]) {
        expect(occluderDefault(blend, mock, '1')).toBe(true);
        expect(occluderDefault(blend, mock, '0')).toBe(false);
      }
  });

  it('ignores other values', () => {
    expect(occluderDefault('opaque', false, 'yes')).toBe(false);
    expect(occluderDefault('alpha-blend', false, '')).toBe(true);
  });
});

describe('clearFor', () => {
  it('gives an opaque session a solid background and an opaque clear', () => {
    expect(clearFor('opaque', 'vr')).toEqual({ background: ROOM_BACKGROUND, alpha: 1 });
    expect(clearFor('opaque', 'ar')).toEqual({ background: ROOM_BACKGROUND, alpha: 1 });
  });

  it('clears passthrough sessions to transparent', () => {
    for (const blend of ['alpha-blend', 'additive']) {
      expect(clearFor(blend, 'vr')).toEqual({ background: null, alpha: 0 });
      expect(clearFor(blend, 'ar')).toEqual({ background: null, alpha: 0 });
    }
  });

  it('falls back to the page mode when the browser reports no blend mode', () => {
    expect(clearFor(undefined, 'vr')).toEqual({ background: ROOM_BACKGROUND, alpha: 1 });
    expect(clearFor(undefined, 'ar')).toEqual({ background: null, alpha: 0 });
  });
});
