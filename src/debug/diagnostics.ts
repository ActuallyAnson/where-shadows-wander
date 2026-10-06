// Diagnostics for testing on headsets we can't watch directly (Pico, remote
// Quest testers). The XR session collects a report and saves it to
// localStorage; report-panel.ts shows it on the 2D page after the tester leaves
// XR. Each section answers one of the device risks in docs/GDD.md (Risks).
import type { WebGLRenderer } from '@iwsdk/core';
import type { HandFrame, Handedness } from '../engine/hands/hand';
import { AnchorProbe, localStorageHandleStore } from './anchor-probe';
import { RingBuffer } from './ring-buffer';

const STORAGE_KEY = 'wsw.diagnostics.v1';
const ANCHOR_KEY = 'wsw.diagnostics.anchor-uuid';
const SAVE_EVERY_MS = 2000;
const MAX_ERRORS = 20;
const MAX_PLANES = 40;
const WINDOW = 600; // frame samples kept for percentiles

type Json = Record<string, unknown>;

interface HandStats {
  framesTracked: number;
  framesPartial: number;
  framesMissing: number;
  /** Times the hand went from tracked to not tracked. */
  lostEvents: number;
  minValidJointsWhilePresent: number | null;
  wasTracked: boolean;
}

export class Diagnostics {
  private readonly report: Json;
  private readonly errors: string[] = [];
  private readonly intervals = new RingBuffer(WINDOW);
  private readonly cpu = new RingBuffer(WINDOW);
  private readonly handStats: Record<Handedness, HandStats> = { left: newHandStats(), right: newHandStats() };
  private lastFrameAt = 0;
  private xrFrames = 0;
  private sessionStartedAt = 0;
  private lastSaveAt = 0;
  private planeCount = -1;
  private readonly anchorProbe = new AnchorProbe(localStorageHandleStore(ANCHOR_KEY), () => this.save());
  private sessionInfo: Json | null = null;
  private sessionCount = 0;
  private extra: () => Json = () => ({});

  constructor() {
    this.report = {
      build: __BUILD_ID__,
      url: location.href,
      secureContext: isSecureContext,
      userAgent: navigator.userAgent,
      pageLoadedAt: new Date().toISOString(),
    };
    addEventListener('error', (e) => this.error(e.message));
    addEventListener('unhandledrejection', (e) => this.error(`unhandled rejection: ${String(e.reason)}`));
    addEventListener('pagehide', () => this.save());
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      this.error(args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' '));
      origError.apply(console, args);
    };
    void this.probeSupport();
  }

  mark(name: 'worldCreated' | 'firstFrame'): void {
    const timing = (this.report.timingMs ??= {}) as Json;
    if (timing[name] !== undefined) return;
    timing[name] = Math.round(performance.now());
    performance.mark(`wsw-${name}`);
  }

  error(message: string): void {
    this.errors.push(`${Math.round(performance.now())}ms ${message}`);
    if (this.errors.length > MAX_ERRORS) this.errors.shift();
  }

  /** Call from the renderer's sessionstart / sessionend events. */
  sessionStarted(session: XRSession, renderer: WebGLRenderer): void {
    this.sessionCount++;
    this.sessionStartedAt = performance.now();
    this.xrFrames = 0;
    this.intervals.clear();
    this.cpu.clear();
    this.lastFrameAt = 0;
    this.planeCount = -1;
    this.handStats.left = newHandStats();
    this.handStats.right = newHandStats();
    const s = session as XRSession & { enabledFeatures?: string[]; supportedFrameRates?: Float32Array };
    this.sessionInfo = {
      count: this.sessionCount,
      startedAtMs: Math.round(this.sessionStartedAt),
      environmentBlendMode: s.environmentBlendMode,
      enabledFeatures: s.enabledFeatures ?? 'unknown',
      frameRate: s.frameRate ?? null,
      supportedFrameRates: s.supportedFrameRates ? [...s.supportedFrameRates] : null,
      multiview: (renderer.xr as { isMultiview?: boolean }).isMultiview ?? null,
      layerSize: layerSize(renderer.xr.getBaseLayer() as unknown as Record<string, number> | null),
    };
    this.save();
  }

  sessionEnded(): void {
    if (this.sessionInfo) this.sessionInfo.endedAfterS = r3((performance.now() - this.sessionStartedAt) / 1000);
    this.save();
  }

  /**
   * Call once per display frame from the driver system.
   * @param cpuMs time spent in our own frame code
   */
  frame(
    frame: XRFrame | null,
    refSpace: XRReferenceSpace | null,
    hands: Record<Handedness, HandFrame>,
    cpuMs: number,
  ): void {
    const now = performance.now();
    if (!frame || !refSpace) return;
    if (this.xrFrames === 0) {
      const timing = (this.report.timingMs ??= {}) as Json;
      timing.firstXrFrame ??= Math.round(now);
      if (this.sessionInfo) this.sessionInfo.msToFirstXrFrame = Math.round(now - this.sessionStartedAt);
    }
    this.xrFrames++;
    if (this.lastFrameAt) this.intervals.push(now - this.lastFrameAt);
    this.lastFrameAt = now;
    this.cpu.push(cpuMs);
    if (this.sessionInfo) this.sessionInfo.frameRate = frame.session.frameRate ?? null;

    trackHand(this.handStats.left, hands.left);
    trackHand(this.handStats.right, hands.right);
    this.snapshotPlanes(frame, refSpace);
    this.anchorProbe.step(frame, refSpace);

    if (now - this.lastSaveAt > SAVE_EVERY_MS) this.save();
  }

  /** Adds sections computed only when a report is saved, e.g. sim and hand-reader counters. */
  addSource(extra: () => Json): void {
    this.extra = extra;
  }

  /** The current report as JSON-safe data. */
  snapshot(): Json {
    const elapsedS = this.sessionInfo ? (performance.now() - this.sessionStartedAt) / 1000 : 0;
    return {
      ...this.report,
      savedAt: new Date().toISOString(),
      session: this.sessionInfo,
      frames: this.xrFrames
        ? {
            xrFrames: this.xrFrames,
            fpsAvg: r3(this.xrFrames / Math.max(elapsedS, 1e-3)),
            intervalMsAvg: r3(this.intervals.mean()),
            intervalMsP95: r3(this.intervals.percentile(0.95)),
            intervalMsMax: r3(this.intervals.max()),
            ourCpuMsAvg: r3(this.cpu.mean()),
            ourCpuMsP95: r3(this.cpu.percentile(0.95)),
          }
        : null,
      hands: { left: handSummary(this.handStats.left), right: handSummary(this.handStats.right) },
      anchors: { ...this.anchorProbe.result, tracking: this.anchorProbe.tracking() },
      ...this.extra(),
      errors: [...this.errors],
    };
  }

  /** True once this page has run an XR session. */
  get hasSession(): boolean {
    return this.sessionCount > 0;
  }

  /** Saves the report. Before the first XR session it does nothing, so a reload keeps the last session's report. */
  save(): void {
    this.lastSaveAt = performance.now();
    if (!this.hasSession) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
    } catch {
      // Storage may be unavailable (private mode); the live report still works.
    }
  }

  static loadSaved(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private async probeSupport(): Promise<void> {
    const xr = navigator.xr;
    const support: Json = { navigatorXr: !!xr };
    if (xr) {
      for (const mode of ['immersive-ar', 'immersive-vr'] as const) {
        try {
          support[mode] = await xr.isSessionSupported(mode);
        } catch (e) {
          support[mode] = `error: ${String(e)}`;
        }
      }
    }
    this.report.xrSupport = support;
  }

  private snapshotPlanes(frame: XRFrame, refSpace: XRReferenceSpace): void {
    const planes = frame.detectedPlanes;
    if (!planes) {
      this.report.planes = 'detectedPlanes unsupported';
      return;
    }
    if (planes.size === this.planeCount) return;
    this.planeCount = planes.size;
    const viewer = frame.getViewerPose(refSpace)?.transform.position;
    const list: Json[] = [];
    for (const plane of planes) {
      if (list.length >= MAX_PLANES) break;
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) continue;
      const m = pose.transform.matrix;
      // Plane space +Y is the plane normal; its sign is not guaranteed to face the room.
      const n = [m[4], m[5], m[6]];
      const c = [m[12], m[13], m[14]];
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
      const toViewer = viewer ? [viewer.x - c[0], viewer.y - c[1], viewer.z - c[2]] : null;
      list.push({
        label: (plane as XRPlane & { semanticLabel?: string }).semanticLabel ?? null,
        orientation: plane.orientation,
        centreRef: c.map(r3),
        extentM: [r3(maxX - minX), r3(maxZ - minZ)],
        normalRef: n.map(r3),
        normalFacesViewer: toViewer ? n[0] * toViewer[0] + n[1] * toViewer[1] + n[2] * toViewer[2] > 0 : null,
        distanceM: toViewer ? r3(Math.hypot(toViewer[0], toViewer[1], toViewer[2])) : null,
      });
    }
    // Values are in the XR reference space, not scene space.
    this.report.planes = { count: planes.size, list };
  }
}

/** Eye buffer size: XRProjectionLayer has textureWidth, XRWebGLLayer has framebufferWidth. */
function layerSize(layer: Record<string, number> | null): [number, number] | null {
  if (!layer) return null;
  return layer.textureWidth
    ? [layer.textureWidth, layer.textureHeight]
    : [layer.framebufferWidth, layer.framebufferHeight];
}

function newHandStats(): HandStats {
  return {
    framesTracked: 0,
    framesPartial: 0,
    framesMissing: 0,
    lostEvents: 0,
    minValidJointsWhilePresent: null,
    wasTracked: false,
  };
}

function trackHand(s: HandStats, hand: HandFrame): void {
  if (hand.tracked) s.framesTracked++;
  else if (hand.validJoints > 0) s.framesPartial++;
  else s.framesMissing++;
  if (hand.validJoints > 0) {
    s.minValidJointsWhilePresent = Math.min(s.minValidJointsWhilePresent ?? hand.validJoints, hand.validJoints);
  }
  if (s.wasTracked && !hand.tracked) s.lostEvents++;
  s.wasTracked = hand.tracked;
}

function handSummary(s: HandStats): Json {
  const { wasTracked: _, ...rest } = s;
  return rest;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
