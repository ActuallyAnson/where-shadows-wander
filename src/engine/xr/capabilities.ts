// What the XR session actually provides, the same way on Quest, Pico and the
// emulator (ADR 0003: detect features, never device names). One Capabilities
// object, updated in place, for B's persistence and diagnostics, plus the
// detected planes for A's StageFrame.
//
// Support is decided by session.enabledFeatures when the browser reports it.
// The emulator's frame.detectedPlanes exists even when plane detection wasn't
// granted, so API presence is only the fallback (`basis: 'api'`).
// Only WebXR types are imported, so this runs in Node tests with fake sessions.
import type { HandFrame, Handedness } from '../hands/hand';
import type { DetectedPlane } from './detected-plane';
import { MAX_PLANES, PlaneTracker } from './plane-tracker';

export type SessionState = 'none' | 'active';
/** How support was decided: the session's granted features, API presence, or not at all (no session). */
export type Basis = 'enabledFeatures' | 'api' | 'none';
export type Tri = 'yes' | 'no' | 'unknown';
/**
 * no-session: no XR session. unsupported: not granted, or the API is missing or failed.
 * none-yet: supported, nothing detected yet (room setup not done?). found: count > 0.
 */
export type DetectionStatus = 'no-session' | 'unsupported' | 'none-yet' | 'found';

export interface HandPresence {
  /** All 25 joints have a pose this frame. */
  tracked: boolean;
  validJoints: number;
  /** Times this hand went from tracked to not tracked this session. */
  lostCount: number;
}

export interface Capabilities {
  /** Bumps when anything below except hand presence changes. */
  version: number;
  /** Bumps when a hand's `tracked` flips. Separate so tracking dropouts don't churn `version`. */
  handsVersion: number;
  /** Bumps when the plane set or any plane's geometry changes. */
  planesVersion: number;
  session: SessionState;
  /** session.enabledFeatures, copied at session start; null if the browser doesn't report it. */
  enabledFeatures: readonly string[] | null;
  handTracking: { available: Tri; basis: Basis; left: HandPresence; right: HandPresence };
  passthrough: { available: Tri; environmentBlendMode: XREnvironmentBlendMode | null };
  planes: { status: DetectionStatus; basis: Basis; count: number; overflow: number };
  meshes: { status: DetectionStatus; basis: Basis; count: number };
  anchors: { available: Tri; basis: Basis };
  /**
   * Whether the persistent-anchor API exists: restore = session.restorePersistentAnchor,
   * handleRequest = XRAnchor.requestPersistentHandle. That anchors survive a browser
   * restart is a separate question, answered by B's anchor probe. IWSDK's own world
   * anchor takes one entry in storedCount.
   */
  persistentAnchors: { available: Tri; restore: boolean; handleRequest: Tri; storedCount: number | null };
}

function noSession(): Capabilities {
  const hand = (): HandPresence => ({ tracked: false, validJoints: 0, lostCount: 0 });
  return {
    version: 0,
    handsVersion: 0,
    planesVersion: 0,
    session: 'none',
    enabledFeatures: null,
    handTracking: { available: 'unknown', basis: 'none', left: hand(), right: hand() },
    passthrough: { available: 'unknown', environmentBlendMode: null },
    planes: { status: 'no-session', basis: 'none', count: 0, overflow: 0 },
    meshes: { status: 'no-session', basis: 'none', count: 0 },
    anchors: { available: 'unknown', basis: 'none' },
    persistentAnchors: { available: 'unknown', restore: false, handleRequest: 'unknown', storedCount: null },
  };
}

export class CapabilityDetector {
  /** Updated in place; never replaced (its nested objects are replaced when a session starts or ends). */
  readonly capabilities: Capabilities = noSession();
  /** Last error from reading planes or meshes, for diagnostics. */
  lastError: string | null = null;
  private readonly tracker: PlaneTracker;
  private session: XRSession | null = null;
  private planesBroken = false;
  /** enabledFeatures says anchors weren't granted: no API check can change that. */
  private anchorsRefused = false;
  private meshesBroken = false;
  private changed = false;

  constructor(maxPlanes = MAX_PLANES) {
    this.tracker = new PlaneTracker(maxPlanes);
  }

  /** The detected planes in scene space, for StageFrame. Reused array; watch `capabilities.planesVersion`. */
  get planes(): readonly DetectedPlane[] {
    return this.tracker.active;
  }

  sessionStarted(session: XRSession): void {
    const c = this.capabilities;
    const keep = { version: c.version, handsVersion: c.handsVersion, planesVersion: c.planesVersion };
    Object.assign(c, noSession(), keep);
    this.session = session;
    this.planesBroken = this.meshesBroken = false;
    this.lastError = null;
    c.session = 'active';
    const features = Array.isArray(session.enabledFeatures) ? [...session.enabledFeatures] : null;
    c.enabledFeatures = features;
    const basis: Basis = features ? 'enabledFeatures' : 'api';
    const granted = (f: string): Tri => (features ? (features.includes(f) ? 'yes' : 'no') : 'unknown');

    c.handTracking.basis = basis;
    c.handTracking.available = granted('hand-tracking');
    c.planes.basis = c.meshes.basis = c.anchors.basis = basis;
    c.planes.status = granted('plane-detection') === 'no' ? 'unsupported' : 'none-yet';
    c.meshes.status = granted('mesh-detection') === 'no' ? 'unsupported' : 'none-yet';
    this.anchorsRefused = granted('anchors') === 'no';
    c.anchors.available = this.anchorsRefused ? 'no' : 'unknown';

    const p = c.persistentAnchors;
    p.restore = typeof session.restorePersistentAnchor === 'function';
    p.storedCount = Array.isArray(session.persistentAnchors) ? session.persistentAnchors.length : null;
    const proto = (globalThis as { XRAnchor?: { prototype: object } }).XRAnchor?.prototype;
    p.handleRequest = proto ? ('requestPersistentHandle' in proto ? 'yes' : 'no') : 'unknown';

    this.readBlendMode(session);
    this.settlePersistence();
    c.version++;
  }

  sessionEnded(): void {
    const c = this.capabilities;
    this.session = null;
    this.tracker.clear();
    const keep = { version: c.version + 1, handsVersion: c.handsVersion + 1, planesVersion: c.planesVersion + 1 };
    Object.assign(c, noSession(), keep);
  }

  /**
   * Once per XR frame, after the hand reader.
   * @param originMatrix world.player.matrixWorld.elements: reference space to scene.
   */
  update(
    frame: XRFrame,
    refSpace: XRReferenceSpace,
    hands: Readonly<Record<Handedness, HandFrame>>,
    originMatrix: ArrayLike<number>,
    now: number,
  ): void {
    const session = this.session;
    if (!session) return;
    const c = this.capabilities;
    this.changed = false;

    this.updateHands(session, hands);
    this.readBlendMode(session);
    this.updatePlanes(frame, refSpace, originMatrix, now);
    this.updateMeshes(frame);
    this.updateAnchors(frame);
    this.settlePersistence();
    if (this.changed) c.version++;
  }

  /** A JSON-safe copy for reports. Allocates; call only when saving a report. */
  toJSON(): Record<string, unknown> {
    return {
      ...structuredClone(this.capabilities),
      planeList: this.planes.map((p) => ({
        id: p.id,
        orientation: p.orientation,
        label: p.label,
        centre: Array.from(p.centre, round3),
        normal: Array.from(p.normal, round3),
        size: [round3(p.extent[1] - p.extent[0]), round3(p.extent[3] - p.extent[2])],
        vertices: p.vertexCount,
      })),
      lastError: this.lastError,
    };
  }

  private updateHands(session: XRSession, hands: Readonly<Record<Handedness, HandFrame>>): void {
    const h = this.capabilities.handTracking;
    if (h.available === 'unknown') {
      // No enabledFeatures: hand tracking is available once a hand input source appears.
      const sources = session.inputSources;
      for (let i = 0; i < sources.length; i++) {
        if (sources[i].hand) {
          h.available = 'yes';
          this.changed = true;
          break;
        }
      }
    }
    this.updatePresence(h.left, hands.left);
    this.updatePresence(h.right, hands.right);
  }

  private updatePresence(p: HandPresence, hand: HandFrame): void {
    p.validJoints = hand.validJoints;
    if (p.tracked === hand.tracked) return;
    if (p.tracked) p.lostCount++;
    p.tracked = hand.tracked;
    this.capabilities.handsVersion++;
  }

  private readBlendMode(session: XRSession): void {
    const mode = session.environmentBlendMode ?? null;
    const t = this.capabilities.passthrough;
    if (mode === t.environmentBlendMode && t.available !== 'unknown') return;
    const available: Tri = mode === null ? 'unknown' : mode === 'opaque' ? 'no' : 'yes';
    if (mode !== t.environmentBlendMode || available !== t.available) this.changed = true;
    t.environmentBlendMode = mode;
    t.available = available;
  }

  private updatePlanes(frame: XRFrame, refSpace: XRReferenceSpace, origin: ArrayLike<number>, now: number): void {
    const c = this.capabilities;
    const p = c.planes;
    if (p.status === 'unsupported') return;
    let set: XRPlaneSet | undefined;
    try {
      set = this.planesBroken ? undefined : frame.detectedPlanes;
    } catch (e) {
      this.planesBroken = true;
      this.lastError = `detectedPlanes: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (!set) return this.setStatus(p, 'unsupported');
    if (this.tracker.update(set, frame, refSpace, origin, now)) c.planesVersion++;
    const count = this.tracker.active.length;
    if (count !== p.count || this.tracker.overflow !== p.overflow) {
      p.count = count;
      p.overflow = this.tracker.overflow;
      this.changed = true;
    }
    this.setStatus(p, count > 0 ? 'found' : 'none-yet');
  }

  private updateMeshes(frame: XRFrame): void {
    const m = this.capabilities.meshes;
    if (m.status === 'unsupported') return;
    let set: XRMeshSet | undefined;
    try {
      set = this.meshesBroken ? undefined : frame.detectedMeshes;
    } catch (e) {
      this.meshesBroken = true;
      this.lastError = `detectedMeshes: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (!set) return this.setStatus(m, 'unsupported');
    if (set.size !== m.count) {
      m.count = set.size;
      this.changed = true;
    }
    this.setStatus(m, set.size > 0 ? 'found' : 'none-yet');
  }

  private updateAnchors(frame: XRFrame): void {
    const c = this.capabilities;
    const a = c.anchors;
    if (!this.anchorsRefused) {
      // Granted (or not reported): anchors work if the frame can create them.
      const available: Tri = typeof frame.createAnchor === 'function' ? 'yes' : 'no';
      if (available !== a.available) {
        a.available = available;
        this.changed = true;
      }
    }
    // Persistent handles: without a global XRAnchor (the emulator), look at an anchor that already exists
    // (IWSDK creates a world anchor) instead of creating one.
    if (c.persistentAnchors.handleRequest === 'unknown' && (frame.trackedAnchors?.size ?? 0) > 0)
      frame.trackedAnchors!.forEach(this.inspectAnchor);
  }

  private readonly inspectAnchor = (anchor: XRAnchor): void => {
    const p = this.capabilities.persistentAnchors;
    if (p.handleRequest !== 'unknown') return;
    p.handleRequest = typeof anchor.requestPersistentHandle === 'function' ? 'yes' : 'no';
    this.changed = true;
  };

  private settlePersistence(): void {
    const c = this.capabilities;
    const p = c.persistentAnchors;
    const available: Tri =
      c.anchors.available === 'no' || !p.restore || p.handleRequest === 'no'
        ? 'no'
        : c.anchors.available === 'yes'
          ? 'yes'
          : 'unknown';
    if (available !== p.available) {
      p.available = available;
      this.changed = true;
    }
  }

  private setStatus(s: { status: DetectionStatus }, status: DetectionStatus): void {
    if (s.status === status) return;
    s.status = status;
    this.changed = true;
  }
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
