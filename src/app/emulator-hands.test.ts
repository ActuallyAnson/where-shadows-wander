import { describe, expect, it } from 'vitest';
import { toggleEmulatorGizmos, useEmulatorHands } from './emulator-hands';

/** A stand-in device that records the control modes it is set to, as the emulator's panel would see them. */
function device(controlMode: string) {
  const seen: string[] = [];
  let mode = controlMode;
  return {
    seen,
    primaryInputMode: 'controller',
    get controlMode() {
      return mode;
    },
    set controlMode(m: string) {
      mode = m;
      seen.push(m);
    },
  };
}

describe('useEmulatorHands', () => {
  it('switches to hands and makes the panel read it, then gives the mouse back', () => {
    const d = device('manual');
    useEmulatorHands(d);
    expect(d.primaryInputMode).toBe('hand');
    expect(d.seen).toEqual(['programmatic', 'manual']);
    expect(d.controlMode).toBe('manual');
  });

  it('leaves a device a script is driving in programmatic mode', () => {
    const d = device('programmatic');
    useEmulatorHands(d);
    expect(d.primaryInputMode).toBe('hand');
    expect(d.seen).toEqual([]);
  });
});

describe('toggleEmulatorGizmos', () => {
  it('hides the gizmos by turning the control mode programmatic, and shows them again by turning it back', () => {
    const d = device('manual');
    expect(toggleEmulatorGizmos(d)).toBe(true);
    expect(d.controlMode).toBe('programmatic');
    expect(toggleEmulatorGizmos(d)).toBe(false);
    expect(d.controlMode).toBe('manual');
  });
});
