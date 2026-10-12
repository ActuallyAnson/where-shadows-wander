import { describe, expect, it } from 'vitest';
import { makeFakeXr } from './fake-xr-hands';
import { XRHandReader } from './xr-hands';

const ref = {} as XRReferenceSpace;

describe('XRHandReader on the fast path (fillPoses)', () => {
  it('reads both hands: 25 joints each, in scene space, with radii', () => {
    const xr = makeFakeXr({ fast: true });
    const reader = new XRHandReader();
    reader.update(xr.frame, ref, xr.origin);
    for (const side of ['left', 'right'] as const) {
      const h = reader.hands[side];
      expect(h.tracked).toBe(true);
      expect(h.validJoints).toBe(25);
      expect(h.positions[0]).toBeCloseTo(side === 'left' ? -0.2 : 0.2, 6);
      expect(h.positions[1]).toBeCloseTo(1, 6);
      expect(h.positions[24 * 3]).toBeCloseTo((side === 'left' ? -0.2 : 0.2) + 0.024, 6);
      expect(h.radii[3]).toBeCloseTo(0.012, 6);
    }
    expect(reader.method.fillPoses).toBe(2);
    expect(reader.handSources).toBe(2);
  });

  it('looks each hand’s joint spaces up once, not every frame', () => {
    const xr = makeFakeXr({ fast: true });
    const reader = new XRHandReader();
    reader.update(xr.frame, ref, xr.origin);
    const first = xr.left.getCalls;
    expect(first).toBe(25);
    for (let i = 0; i < 20; i++) reader.update(xr.frame, ref, xr.origin);
    expect(xr.left.getCalls).toBe(first);
    expect(reader.hands.left.tracked).toBe(true);
  });
});

describe('XRHandReader on the getJointPose path (the Pico’s)', () => {
  it('reads every joint once per frame, radii included', () => {
    const xr = makeFakeXr({ fast: false });
    const reader = new XRHandReader();
    reader.update(xr.frame, ref, xr.origin);
    expect(xr.poseCalls.n).toBe(50); // 25 joints, two hands: no second pass for the radii
    const h = reader.hands.right;
    expect(h.tracked).toBe(true);
    expect(h.radii[10]).toBeCloseTo(0.012, 6);
    expect(h.positions[3]).toBeCloseTo(0.2 + 0.001, 6);
    expect(reader.method.getJointPose).toBe(2);
  });

  it('a hand with joints missing is partly tracked, with default radii for the missing joints', () => {
    const xr = makeFakeXr({ fast: false, missing: [5, 6] });
    const reader = new XRHandReader();
    reader.update(xr.frame, ref, xr.origin);
    const h = reader.hands.left;
    expect(h.tracked).toBe(false);
    expect(h.validJoints).toBe(23);
    expect(h.radii[5]).toBeCloseTo(0.01, 6);
    expect(h.radii[4]).toBeCloseTo(0.012, 6);
  });
});

describe('XRHandReader bookkeeping', () => {
  it('clears both hands at the start of every frame', () => {
    const xr = makeFakeXr({ fast: true });
    const reader = new XRHandReader();
    reader.update(xr.frame, ref, xr.origin);
    (xr.session as unknown as { inputSources: unknown[] }).inputSources.length = 0;
    reader.update(xr.frame, ref, xr.origin);
    expect(reader.hands.left.tracked || reader.hands.right.tracked).toBe(false);
    expect(reader.handSources).toBe(0);
  });

  it('keeps only the latest input-source change events', () => {
    const xr = makeFakeXr({ fast: true });
    const reader = new XRHandReader();
    reader.update(xr.frame, ref, xr.origin);
    const fire = xr.listeners.get('inputsourceschange')![0];
    for (let i = 0; i < 200; i++)
      fire({
        added: [{ handedness: 'left', targetRayMode: 'tracked-pointer', hand: {} }],
        removed: [],
      } as unknown as Event);
    expect(reader.debug.inputSourceEvents.length).toBe(50);
    expect(reader.debug.inputSourceEvents[49]).toBe('+(left:tracked-pointer:hand) -()');
  });

  it('ignores a controller (an input source with no hand)', () => {
    const xr = makeFakeXr({ fast: true });
    (xr.session as unknown as { inputSources: unknown[] }).inputSources.push({
      handedness: 'right',
      targetRayMode: 'tracked-pointer',
      profiles: ['pico-4'],
      hand: null,
    });
    const reader = new XRHandReader();
    reader.update(xr.frame, ref, xr.origin);
    expect(reader.handSources).toBe(2);
    expect(reader.debug.sourcesSeen).toBe(3);
  });
});
