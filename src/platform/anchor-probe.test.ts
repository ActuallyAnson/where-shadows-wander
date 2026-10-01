import { beforeAll, describe, expect, it } from 'vitest';
import { AnchorProbe, type HandleStore } from './anchor-probe';

// Minimal WebXR fakes. A frame throws if used after its callback has ended,
// which is what real headsets do (the emulator doesn't, which hid the bug).
beforeAll(() => {
  (globalThis as Record<string, unknown>).XRRigidTransform = class {
    constructor(readonly position: unknown) {}
  };
});

const flush = () => new Promise((r) => setTimeout(r, 0));

function fakeSession(restore: (uuid: string) => Promise<XRAnchor>) {
  return { restorePersistentAnchor: restore, persistentAnchors: [] } as unknown as XRSession;
}

function fakeAnchor(uuid = 'new-uuid') {
  return { anchorSpace: {}, requestPersistentHandle: async () => uuid } as unknown as XRAnchor;
}

function fakeFrame(session: XRSession, created = fakeAnchor()) {
  const frame = {
    session,
    active: true,
    createAnchor() {
      if (!frame.active) throw new DOMException('XRFrame is not active', 'InvalidStateError');
      return Promise.resolve(created);
    },
    getPose() {
      if (!frame.active) throw new DOMException('XRFrame is not active', 'InvalidStateError');
      return { transform: { position: { x: 0, y: 0.8, z: -0.5 } } };
    },
  };
  return frame;
}

function memoryStore(initial: string | null): HandleStore & { value: string | null } {
  const s = { value: initial, get: () => s.value, set: (v: string) => void (s.value = v) };
  return s;
}

/** Runs one frame callback: step, then the frame expires. */
function runFrame(probe: AnchorProbe, frame: ReturnType<typeof fakeFrame>) {
  probe.step(frame as unknown as XRFrame, {} as XRReferenceSpace);
  frame.active = false;
}

describe('AnchorProbe', () => {
  it('creates a fresh anchor on a later frame when restoring the saved one fails', async () => {
    const store = memoryStore('stale-uuid');
    const session = fakeSession(() => Promise.reject(new Error('not found')));
    const probe = new AnchorProbe(store);

    runFrame(probe, fakeFrame(session)); // starts the restore; this frame then expires
    await flush();
    runFrame(probe, fakeFrame(session)); // creates the anchor inside a live frame
    await flush();

    expect(probe.result.restoreError).toContain('not found');
    expect(probe.result.error).toBeUndefined();
    expect(probe.result.created).toBe(true);
    expect(store.value).toBe('new-uuid'); // the stale handle is replaced
  });

  it('ignores a restore that finishes after its session ended', async () => {
    let finish!: (a: XRAnchor) => void;
    const oldSession = fakeSession(() => new Promise((r) => (finish = r)));
    const probe = new AnchorProbe(memoryStore('saved-uuid'));

    runFrame(probe, fakeFrame(oldSession));
    const newSession = fakeSession(() => new Promise(() => {}));
    runFrame(probe, fakeFrame(newSession)); // new session starts its own probe
    finish(fakeAnchor()); // old session's restore lands late
    await flush();

    // The old anchor must not be tracked in the new session (its space belongs to the old one).
    expect(() => runFrame(probe, fakeFrame(newSession))).not.toThrow();
    expect(probe.result.restored).toBeUndefined();
    expect(probe.tracking()).toBeNull();
  });

  it('restores the saved anchor and counts frames with a pose', async () => {
    const session = fakeSession(async () => fakeAnchor());
    const probe = new AnchorProbe(memoryStore('saved-uuid'));
    runFrame(probe, fakeFrame(session));
    await flush();
    runFrame(probe, fakeFrame(session));
    runFrame(probe, fakeFrame(session));
    expect(probe.result.restored).toBe(true);
    expect(probe.tracking()).toMatchObject({ framesWithPose: 2, framesWithoutPose: 0 });
  });
});
