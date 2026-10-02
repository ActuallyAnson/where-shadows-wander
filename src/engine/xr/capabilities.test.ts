import { describe, expect, it } from 'vitest';
import { createHandFrame, JOINT_COUNT, type HandFrame } from '../hands/hand';
import { CapabilityDetector } from './capabilities';
import { fakeFrame, fakePlane, fakeRefSpace, fakeSession, IDENTITY, poseMatrix, type FakeFrameInit } from './fake-xr';

const ALL = ['local-floor', 'hand-tracking', 'plane-detection', 'mesh-detection', 'anchors'];
const SQUARE: [number, number][] = [
  [-0.5, -0.4],
  [0.5, -0.4],
  [0.5, 0.4],
  [-0.5, 0.4],
];

function hands(left: boolean, right: boolean): Record<'left' | 'right', HandFrame> {
  const make = (side: 'left' | 'right', tracked: boolean) => {
    const h = createHandFrame(side);
    h.tracked = tracked;
    h.validJoints = tracked ? JOINT_COUNT : 0;
    return h;
  };
  return { left: make('left', left), right: make('right', right) };
}

function threePlanes() {
  return new Set([0, 1, 2].map((i) => fakePlane({ matrix: poseMatrix(i, 0.7, -0.5), polygon: SQUARE })));
}

/** Starts a session and runs `frames` identical frames. */
function run(session: XRSession, frameInit: FakeFrameInit = {}, frames = 1, h = hands(true, true)) {
  const d = new CapabilityDetector();
  d.sessionStarted(session);
  const frame = fakeFrame(session, frameInit);
  const ref = fakeRefSpace();
  for (let i = 0; i < frames; i++) d.update(frame, ref, h, IDENTITY, i * 16);
  return { d, c: d.capabilities, frame, ref };
}

describe('capabilities', () => {
  it('reports no session before a session starts (mock mode)', () => {
    const c = new CapabilityDetector().capabilities;
    expect(c.session).toBe('none');
    expect(c.planes.status).toBe('no-session');
    expect(c.meshes.status).toBe('no-session');
    expect(c.version).toBe(0);
  });

  it('everything present', () => {
    const session = fakeSession({
      enabledFeatures: ALL,
      blend: 'alpha-blend',
      hands: ['left', 'right'],
      restore: true,
      persistentAnchors: ['a'],
    });
    const { d, c } = run(session, { planes: threePlanes(), meshes: new Set([{}]), createAnchor: true });
    expect(c.session).toBe('active');
    expect(c.handTracking).toMatchObject({ available: 'yes', basis: 'enabledFeatures' });
    expect(c.handTracking.left.tracked && c.handTracking.right.tracked).toBe(true);
    expect(c.passthrough).toEqual({ available: 'yes', environmentBlendMode: 'alpha-blend' });
    expect(c.planes).toEqual({ status: 'found', basis: 'enabledFeatures', count: 3, overflow: 0 });
    expect(c.meshes).toEqual({ status: 'found', basis: 'enabledFeatures', count: 1 });
    expect(c.anchors).toEqual({ available: 'yes', basis: 'enabledFeatures' });
    expect(c.persistentAnchors).toMatchObject({ restore: true, storedCount: 1 });
    expect(c.persistentAnchors.available).not.toBe('no');
    expect(d.planes).toHaveLength(3);
  });

  it('no planes: feature not granted, even though detectedPlanes exists (the emulator)', () => {
    const { d, c } = run(fakeSession({ enabledFeatures: ['hand-tracking'] }), { planes: threePlanes() });
    expect(c.planes.status).toBe('unsupported');
    expect(d.planes).toHaveLength(0);
  });

  it('no planes: API absent and enabledFeatures not reported', () => {
    const { c } = run(fakeSession(), { planes: 'absent' });
    expect(c.planes).toMatchObject({ status: 'unsupported', basis: 'api' });
  });

  it('no planes: reading detectedPlanes throws', () => {
    const { d, c } = run(fakeSession({ enabledFeatures: ALL }), { planes: 'throws' }, 3);
    expect(c.planes.status).toBe('unsupported');
    expect(d.lastError).toContain('plane detection failed');
  });

  it('planes supported: none yet, then found', () => {
    const d = new CapabilityDetector();
    const session = fakeSession({ enabledFeatures: ALL });
    d.sessionStarted(session);
    const ref = fakeRefSpace();
    d.update(fakeFrame(session), ref, hands(true, true), IDENTITY, 0);
    expect(d.capabilities.planes.status).toBe('none-yet');
    const [version, planesVersion] = [d.capabilities.version, d.capabilities.planesVersion];
    d.update(fakeFrame(session, { planes: threePlanes() }), ref, hands(true, true), IDENTITY, 16);
    expect(d.capabilities.planes.status).toBe('found');
    expect(d.capabilities.version).toBeGreaterThan(version);
    expect(d.capabilities.planesVersion).toBeGreaterThan(planesVersion);
  });

  it('no persistent anchors', () => {
    const { c } = run(fakeSession({ enabledFeatures: ALL }), { createAnchor: true });
    expect(c.anchors.available).toBe('yes');
    expect(c.persistentAnchors).toMatchObject({ available: 'no', restore: false, storedCount: null });
  });

  it('anchors not granted means no persistent anchors, even if the API exists', () => {
    const session = fakeSession({ enabledFeatures: ['hand-tracking'], restore: true, persistentAnchors: [] });
    const { c } = run(session, { createAnchor: true });
    expect(c.anchors.available).toBe('no');
    expect(c.persistentAnchors.available).toBe('no');
  });

  it('finds persistent-handle support on an anchor that already exists, without creating one', () => {
    const session = fakeSession({ enabledFeatures: ALL, restore: true, persistentAnchors: [] });
    const anchor = { requestPersistentHandle: () => Promise.resolve('uuid') };
    const { c } = run(session, { createAnchor: true, trackedAnchors: new Set([anchor]) });
    expect(c.persistentAnchors.handleRequest).toBe('yes');
    expect(c.persistentAnchors.available).toBe('yes');
  });

  it('hands lost mid-session', () => {
    const session = fakeSession({ enabledFeatures: ALL, hands: ['left', 'right'] });
    const d = new CapabilityDetector();
    d.sessionStarted(session);
    const frame = fakeFrame(session);
    const ref = fakeRefSpace();
    const both = hands(true, true),
      rightOnly = hands(false, true);
    d.update(frame, ref, both, IDENTITY, 0);
    const [version, handsVersion] = [d.capabilities.version, d.capabilities.handsVersion];
    for (let i = 1; i <= 3; i++) d.update(frame, ref, rightOnly, IDENTITY, i * 16);
    const h = d.capabilities.handTracking;
    expect(h.available).toBe('yes');
    expect(h.left).toEqual({ tracked: false, validJoints: 0, lostCount: 1 });
    expect(h.right.tracked).toBe(true);
    d.update(frame, ref, both, IDENTITY, 64);
    expect(h.left.tracked).toBe(true);
    expect(d.capabilities.handsVersion).toBe(handsVersion + 2);
    expect(d.capabilities.version).toBe(version);
  });

  it('infers hand tracking from input sources when enabledFeatures is not reported', () => {
    const session = fakeSession();
    const d = new CapabilityDetector();
    d.sessionStarted(session);
    const ref = fakeRefSpace();
    d.update(fakeFrame(session), ref, hands(false, false), IDENTITY, 0);
    expect(d.capabilities.handTracking).toMatchObject({ available: 'unknown', basis: 'api' });
    session.inputSources.push({ handedness: 'left', hand: {} } as unknown as XRInputSource);
    d.update(fakeFrame(session), ref, hands(true, false), IDENTITY, 16);
    expect(d.capabilities.handTracking.available).toBe('yes');
    session.inputSources.length = 0;
    d.update(fakeFrame(session), ref, hands(false, false), IDENTITY, 32);
    expect(d.capabilities.handTracking.available).toBe('yes');
  });

  it('passthrough from the blend mode', () => {
    expect(run(fakeSession({ blend: 'opaque' })).c.passthrough.available).toBe('no');
    expect(run(fakeSession({ blend: 'additive' })).c.passthrough.available).toBe('yes');
    expect(run(fakeSession()).c.passthrough.available).toBe('unknown');
  });

  it('keeps the version when nothing changes', () => {
    const session = fakeSession({ enabledFeatures: ALL, blend: 'alpha-blend', restore: true });
    const d = new CapabilityDetector();
    d.sessionStarted(session);
    const frame = fakeFrame(session, { planes: threePlanes(), createAnchor: true });
    const ref = fakeRefSpace();
    d.update(frame, ref, hands(true, true), IDENTITY, 0);
    const version = d.capabilities.version;
    for (let i = 1; i <= 10; i++) d.update(frame, ref, hands(true, true), IDENTITY, i * 16);
    expect(d.capabilities.version).toBe(version);
  });

  it('resets when the session ends, and detects again in a new session', () => {
    const { d, c } = run(fakeSession({ enabledFeatures: ALL }), { planes: threePlanes() });
    const version = c.version;
    d.sessionEnded();
    expect(d.capabilities.session).toBe('none');
    expect(d.capabilities.planes.status).toBe('no-session');
    expect(d.planes).toHaveLength(0);
    expect(d.capabilities.version).toBeGreaterThan(version);
    const next = fakeSession({ enabledFeatures: ['hand-tracking'] });
    d.sessionStarted(next);
    d.update(fakeFrame(next, { planes: threePlanes() }), fakeRefSpace(), hands(true, true), IDENTITY, 0);
    expect(d.capabilities.planes.status).toBe('unsupported');
  });

  it('toJSON is a JSON-safe copy', () => {
    const { d, frame, ref } = run(fakeSession({ enabledFeatures: ALL, blend: 'alpha-blend' }), {
      planes: threePlanes(),
    });
    const j = d.toJSON();
    expect(JSON.parse(JSON.stringify(j))).toEqual(j);
    expect((j.planeList as unknown[]).length).toBe(3);
    d.update(frame, ref, hands(false, false), IDENTITY, 100);
    expect((j.handTracking as { left: { tracked: boolean } }).left.tracked).toBe(true);
  });
});
