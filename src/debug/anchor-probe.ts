// Anchor persistence probe for the diagnostics report. Each XR session it
// restores the anchor saved last time, or creates one half a metre in front of
// the start pose and asks for a persistent handle. The result answers "do
// persistent anchors survive a browser restart on this headset?".
//
// WebXR rule this follows: an XRFrame is only usable inside its own frame
// callback, so anchors are only ever created from step(), never after an await.

type Json = Record<string, unknown>;

type SessionWithPersistence = XRSession & {
  restorePersistentAnchor?: (uuid: string) => Promise<XRAnchor>;
  persistentAnchors?: readonly string[];
};
type PersistableAnchor = XRAnchor & { requestPersistentHandle?: () => Promise<string> };

/** Where the probe stores the anchor's persistent handle between sessions. */
export interface HandleStore {
  get(): string | null;
  set(uuid: string): void;
}

export const localStorageHandleStore = (key: string): HandleStore => ({
  get: () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (uuid) => {
    try {
      localStorage.setItem(key, uuid);
    } catch {
      // Storage unavailable; persistence just won't be tested across reloads.
    }
  },
});

type State = 'idle' | 'restoring' | 'create' | 'creating' | 'done';

export class AnchorProbe {
  /** Report section, JSON-safe. */
  result: Json = {};
  private state: State = 'idle';
  private session: XRSession | null = null;
  private anchor: XRAnchor | null = null;
  private framesWithPose = 0;
  private framesWithoutPose = 0;
  private readonly lastPosition = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly store: HandleStore,
    private readonly onSettled: () => void = () => {},
  ) {}

  /** Call once per XR frame, inside the frame callback. */
  step(frame: XRFrame, refSpace: XRReferenceSpace): void {
    if (frame.session !== this.session) this.reset(frame.session);
    if (this.state === 'idle') this.begin(frame);
    if (this.state === 'create') this.create(frame, refSpace);
    if (this.anchor) this.track(frame, refSpace);
  }

  private reset(session: XRSession): void {
    this.session = session;
    this.state = 'idle';
    this.anchor = null;
    this.result = {};
    this.framesWithPose = 0;
    this.framesWithoutPose = 0;
  }

  private begin(frame: XRFrame): void {
    const session = frame.session as SessionWithPersistence;
    const r = this.result;
    r.createAnchor = typeof frame.createAnchor === 'function';
    r.restorePersistentAnchor = typeof session.restorePersistentAnchor === 'function';
    r.persistentAnchorsAtStart = session.persistentAnchors ? [...session.persistentAnchors] : 'unsupported';
    const saved = this.store.get();
    r.savedUuid = saved;
    if (!saved || !session.restorePersistentAnchor) {
      this.state = 'create';
      return;
    }
    this.state = 'restoring';
    session.restorePersistentAnchor(saved).then(
      (anchor) => {
        if (this.session !== session) return; // session ended meanwhile
        this.anchor = anchor;
        r.restored = true;
        this.settle();
      },
      (e) => {
        if (this.session !== session) return;
        r.restoreError = String(e);
        this.state = 'create'; // the next frame creates a fresh anchor
      },
    );
  }

  private create(frame: XRFrame, refSpace: XRReferenceSpace): void {
    const session = frame.session;
    const r = this.result;
    if (!frame.createAnchor) {
      this.settle();
      return;
    }
    this.state = 'creating';
    let pending: Promise<XRAnchor | undefined>;
    try {
      pending =
        frame.createAnchor(new XRRigidTransform({ x: 0, y: 0.8, z: -0.5 }), refSpace) ?? Promise.resolve(undefined);
    } catch (e) {
      r.error = String(e);
      this.settle();
      return;
    }
    pending
      .then(async (anchor) => {
        if (this.session !== session) return;
        r.created = !!anchor;
        this.anchor = anchor ?? null;
        const persistable = anchor as PersistableAnchor | undefined;
        if (!persistable?.requestPersistentHandle) {
          r.persistedUuid = 'requestPersistentHandle unsupported';
          return;
        }
        const uuid = await persistable.requestPersistentHandle();
        if (this.session !== session) return;
        r.persistedUuid = uuid;
        this.store.set(uuid); // replaces a saved handle that failed to restore
      })
      .catch((e) => {
        if (this.session === session) r.error = String(e);
      })
      .finally(() => {
        if (this.session === session) this.settle();
      });
  }

  /** A restore can resolve and still never track, so count frames with a pose. */
  private track(frame: XRFrame, refSpace: XRReferenceSpace): void {
    const pose = frame.getPose(this.anchor!.anchorSpace, refSpace);
    if (pose) {
      this.framesWithPose++;
      const p = pose.transform.position;
      this.lastPosition.x = p.x;
      this.lastPosition.y = p.y;
      this.lastPosition.z = p.z;
    } else {
      this.framesWithoutPose++;
    }
  }

  /** Tracking counters, added to the report when it is saved (not every frame). */
  tracking(): Json | null {
    if (!this.anchor) return null;
    const { x, y, z } = this.lastPosition;
    return {
      framesWithPose: this.framesWithPose,
      framesWithoutPose: this.framesWithoutPose,
      lastPositionRef: this.framesWithPose ? [x, y, z].map((n) => Math.round(n * 1000) / 1000) : null,
    };
  }

  private settle(): void {
    this.state = 'done';
    this.onSettled();
  }
}
