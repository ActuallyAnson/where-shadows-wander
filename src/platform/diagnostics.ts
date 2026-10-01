// Diagnostics for remote testing on a Quest we don't have. The XR session
// collects a report and saves it to localStorage; the 2D page shows a
// "Copy report" button the tester presses after leaving XR (DOM isn't visible
// inside immersive-ar). Each section answers one of the Quest-only unknowns
// listed in docs/GDD.md (Risks).
import type { WebGLRenderer } from '@iwsdk/core';
import type { HandFrame, Handedness } from '../contracts/hand';

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
  private readonly intervals: number[] = [];
  private readonly cpu: number[] = [];
  private readonly handStats: Record<Handedness, HandStats> = { left: newHandStats(), right: newHandStats() };
  private lastFrameAt = 0;
  private xrFrames = 0;
  private sessionStartedAt = 0;
  private lastSaveAt = 0;
  private planeCount = -1;
  private anchorProbe: 'idle' | 'running' | 'done' = 'idle';
  private anchorResult: Json = {};
  private anchor: XRAnchor | null = null;
  private anchorTracking = { framesWithPose: 0, framesWithoutPose: 0, lastPositionRef: null as number[] | null };
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
    this.intervals.length = 0;
    this.cpu.length = 0;
    this.lastFrameAt = 0;
    this.planeCount = -1;
    this.anchorProbe = 'idle';
    this.anchor = null;
    this.anchorResult = {};
    this.anchorTracking = { framesWithPose: 0, framesWithoutPose: 0, lastPositionRef: null };
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
  frame(frame: XRFrame | null, refSpace: XRReferenceSpace | null, hands: Record<Handedness, HandFrame>, cpuMs: number): void {
    const now = performance.now();
    if (!frame || !refSpace) return;
    if (this.xrFrames === 0) {
      const timing = (this.report.timingMs ??= {}) as Json;
      timing.firstXrFrame ??= Math.round(now);
      if (this.sessionInfo) this.sessionInfo.msToFirstXrFrame = Math.round(now - this.sessionStartedAt);
    }
    this.xrFrames++;
    if (this.lastFrameAt) push(this.intervals, now - this.lastFrameAt);
    this.lastFrameAt = now;
    push(this.cpu, cpuMs);
    if (this.sessionInfo) this.sessionInfo.frameRate = frame.session.frameRate ?? null;

    for (const h of ['left', 'right'] as const) trackHand(this.handStats[h], hands[h]);
    this.snapshotPlanes(frame, refSpace);
    this.probeAnchor(frame, refSpace);

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
            intervalMsAvg: r3(avg(this.intervals)),
            intervalMsP95: r3(pct(this.intervals, 0.95)),
            intervalMsMax: r3(Math.max(0, ...this.intervals)),
            ourCpuMsAvg: r3(avg(this.cpu)),
            ourCpuMsP95: r3(pct(this.cpu, 0.95)),
          }
        : null,
      hands: { left: handSummary(this.handStats.left), right: handSummary(this.handStats.right) },
      anchors: this.anchorResult,
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
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of plane.polygon) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
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

  /**
   * Creates one anchor half a metre in front of the start pose and asks for a
   * persistent handle. On the next session (even after a browser restart) it
   * tries to restore that handle first. The emulator fakes persistence with
   * localStorage, so only a device run answers this.
   */
  private probeAnchor(frame: XRFrame, refSpace: XRReferenceSpace): void {
    if (this.anchor) {
      // A restore can resolve and still never track, so count frames with a pose.
      const pose = frame.getPose(this.anchor.anchorSpace, refSpace);
      const t = this.anchorTracking;
      if (pose) {
        t.framesWithPose++;
        const p = pose.transform.position;
        t.lastPositionRef = [r3(p.x), r3(p.y), r3(p.z)];
      } else {
        t.framesWithoutPose++;
      }
      this.anchorResult.tracking = t;
    }
    if (this.anchorProbe !== 'idle') return;
    this.anchorProbe = 'running';
    const session = frame.session as XRSession & {
      restorePersistentAnchor?: (uuid: string) => Promise<XRAnchor>;
      persistentAnchors?: readonly string[];
    };
    const a = this.anchorResult;
    a.createAnchor = typeof frame.createAnchor === 'function';
    a.restorePersistentAnchor = typeof session.restorePersistentAnchor === 'function';
    a.persistentAnchorsAtStart = session.persistentAnchors ? [...session.persistentAnchors] : 'unsupported';
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(ANCHOR_KEY);
    } catch {
      // ignore
    }
    a.savedUuid = saved;
    const run = async () => {
      if (saved && session.restorePersistentAnchor) {
        try {
          this.anchor = await session.restorePersistentAnchor(saved);
          a.restored = true;
          return;
        } catch (e) {
          a.restoreError = String(e);
        }
      }
      if (!frame.createAnchor) return;
      const anchor = await frame.createAnchor(new XRRigidTransform({ x: 0, y: 0.8, z: -0.5 }), refSpace);
      a.created = !!anchor;
      this.anchor = anchor ?? null;
      const persistable = anchor as XRAnchor & { requestPersistentHandle?: () => Promise<string> };
      if (persistable?.requestPersistentHandle) {
        const uuid = await persistable.requestPersistentHandle();
        a.persistedUuid = uuid;
        try {
          localStorage.setItem(ANCHOR_KEY, uuid);
        } catch {
          // ignore
        }
      } else {
        a.persistedUuid = 'requestPersistentHandle unsupported';
      }
    };
    run()
      .catch((e) => (a.error = String(e)))
      .finally(() => {
        this.anchorProbe = 'done';
        this.save();
      });
  }
}

/**
 * Adds a small "Copy report" panel to the 2D page. It shows the latest saved
 * report (from this or an earlier visit) so a remote tester can paste it to us.
 */
export function mountReportPanel(diagnostics: Diagnostics): void {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;left:12px;bottom:12px;z-index:10;font:14px system-ui,sans-serif;color:#111;' +
    'background:#fffbe9;border:1px solid #c9b77a;border-radius:8px;padding:10px;max-width:min(560px,calc(100vw - 48px))';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap';
  const copy = button('Copy report');
  const toggle = button('Show');
  const status = document.createElement('span');
  status.style.cssText = 'font-size:12px;color:#555';
  const text = document.createElement('textarea');
  text.readOnly = true;
  text.style.cssText = 'display:none;width:100%;height:220px;margin-top:8px;font:11px ui-monospace,monospace;box-sizing:border-box';
  row.append(copy, toggle, status);
  panel.append(row, text);
  document.body.append(panel);

  // Always this page's report (so startup errors show). If this page hasn't run
  // a session yet, also attach the last saved one, e.g. from before a reload.
  const refresh = () => {
    diagnostics.save();
    const report = diagnostics.snapshot();
    const saved = diagnostics.hasSession ? null : Diagnostics.loadSaved();
    if (saved) report.previousSession = JSON.parse(saved);
    text.value = JSON.stringify(report, null, 2);
  };
  toggle.onclick = () => {
    const show = text.style.display === 'none';
    if (show) refresh();
    text.style.display = show ? 'block' : 'none';
    toggle.textContent = show ? 'Hide' : 'Show';
  };
  copy.onclick = async () => {
    refresh();
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = 'Copied. Paste it into the chat.';
      return;
    } catch {
      // Clipboard API may be blocked; fall back to a selection the tester can copy.
    }
    text.style.display = 'block';
    toggle.textContent = 'Hide';
    text.select();
    const ok = document.execCommand?.('copy');
    status.textContent = ok ? 'Copied. Paste it into the chat.' : 'Select all the text below and copy it.';
  };
}

function button(label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = 'font:inherit;padding:8px 14px;border-radius:6px;border:1px solid #8a7a45;background:#fff;cursor:pointer';
  return b;
}

/** Eye buffer size: XRProjectionLayer has textureWidth, XRWebGLLayer has framebufferWidth. */
function layerSize(layer: Record<string, number> | null): [number, number] | null {
  if (!layer) return null;
  return layer.textureWidth ? [layer.textureWidth, layer.textureHeight] : [layer.framebufferWidth, layer.framebufferHeight];
}

function newHandStats(): HandStats {
  return { framesTracked: 0, framesPartial: 0, framesMissing: 0, lostEvents: 0, minValidJointsWhilePresent: null, wasTracked: false };
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

function push(arr: number[], v: number): void {
  arr.push(v);
  if (arr.length > WINDOW) arr.shift();
}
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const pct = (a: number[], p: number) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : 0);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
