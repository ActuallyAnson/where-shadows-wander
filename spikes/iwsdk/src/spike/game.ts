// Spike "game": owns its own fixed-timestep loop and state. IWSDK only supplies
// the renderer/scene/camera/XR session and calls frame() once per display frame.
import { Matrix4, Quaternion, Vector3, type World } from '@iwsdk/core';
import { HandReader, JOINT_COUNT } from './hands.js';
import { PlaneFrame, describePlane, type PlaneInfo } from './plane-frame.js';
import { HandShadow } from './shadow.js';
import { StageSim, StageView } from './stage.js';

const ANCHOR_KEY = 'wsw.spike.anchor-uuid';

export interface SpikeOptions {
  hz: number;
  quads: number;
  showProxy: boolean;
}

export class SpikeGame {
  readonly hands = new HandReader();
  readonly plane = new PlaneFrame();
  readonly sim: StageSim;
  readonly stage: StageView;
  readonly shadow: HandShadow;
  readonly light = new Vector3();
  readonly step: number;
  private acc = 0;
  private lastFrameAt = 0;
  private frames = 0;
  private readonly cpuMs: number[] = [];
  private readonly intervalMs: number[] = [];
  private readonly renderMs: number[] = [];
  readonly viewer = new Vector3();
  private readonly startedAt = performance.now();
  private readonly tmpV = new Vector3();
  private readonly tmpM = new Matrix4();
  private planeSetSize = -1;
  private anchorState: 'idle' | 'pending' | 'done' = 'idle';
  private anchor: XRAnchor | undefined;

  readonly report: Record<string, unknown> = {
    firstFrameMs: null as number | null,
    session: null as unknown,
    planes: [] as PlaneInfo[],
    stage: null as unknown,
    anchor: {} as Record<string, unknown>,
    hands: {} as Record<string, unknown>,
    loop: {} as Record<string, unknown>,
    shadow: {} as Record<string, unknown>,
    perf: {} as Record<string, unknown>,
  };

  constructor(private readonly world: World, readonly opts: SpikeOptions) {
    this.step = 1 / opts.hz;
    this.sim = new StageSim(opts.quads);
    this.stage = new StageView(opts.quads);
    this.shadow = new HandShadow(opts.showProxy);
    // View layer only: plain three.js objects parented to the IWSDK scene, no entities.
    world.scene.add(this.stage.paper, this.stage.quads, this.shadow.joints, this.shadow.bones,
      this.shadow.jointShadow, this.shadow.boneShadow);
    // Time renderer.render (CPU submit cost; includes IWSDK's own scene content).
    const renderer = world.renderer;
    const render = renderer.render.bind(renderer);
    renderer.render = (scene, camera) => {
      const t = performance.now();
      render(scene, camera);
      push(this.renderMs, performance.now() - t);
    };
    window.addEventListener('keydown', (e) => {
      if (e.key === '[') this.shadow.k = Math.max(0, this.shadow.k - 0.1);
      if (e.key === ']') this.shadow.k = Math.min(1, this.shadow.k + 0.1);
    });
  }

  /** Called once per display frame, from whichever driver owns the loop. */
  frame(dt: number, frame: XRFrame | null, refSpace: XRReferenceSpace | null): void {
    const t0 = performance.now();
    if (this.report.firstFrameMs === null) {
      this.report.firstFrameMs = Math.round(t0);
      performance.mark('spike-first-frame');
    }
    if (this.lastFrameAt) push(this.intervalMs, t0 - this.lastFrameAt);
    this.lastFrameAt = t0;
    this.frames++;

    // Viewer position: in XR use the viewer pose (world.camera only reflects the
    // headset after renderer.render, i.e. one frame late, and is the desktop camera before).
    const camPos = this.world.camera.getWorldPosition(this.tmpV.set(0, 0, 0)).clone();
    const forward = new Vector3(0, 0, -1).transformDirection(this.world.camera.matrixWorld);
    const viewerPose = frame && refSpace ? frame.getViewerPose(refSpace) : undefined;
    if (viewerPose) {
      this.tmpM.fromArray(viewerPose.transform.matrix).premultiply(this.world.player.matrixWorld);
      camPos.setFromMatrixPosition(this.tmpM);
      forward.set(0, 0, -1).transformDirection(this.tmpM);
    }
    if (frame && refSpace) {
      this.hands.update(frame, refSpace, this.world.player.matrixWorld);
      this.scanPlanes(frame, refSpace, camPos, forward);
      this.updateAnchor(frame, refSpace);
      if (!this.report.session) {
        const s = frame.session;
        this.report.session = {
          mode: 'immersive-ar',
          environmentBlendMode: s.environmentBlendMode,
          enabledFeatures: (s as XRSession & { enabledFeatures?: string[] }).enabledFeatures,
          visibilityState: s.visibilityState,
        };
      }
    }

    // ---- fixed-timestep simulation, independent of display rate ----
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= this.step) {
      this.sim.step(this.step);
      this.acc -= this.step;
    }
    const alpha = this.acc / this.step;

    // Lantern: on the table just in front of and below the viewer.
    this.light.copy(camPos).add(this.tmpV.set(0, -0.45, -0.15));
    this.stage.update(this.sim, this.plane, alpha);
    this.shadow.update(this.hands, this.plane, this.light);

    this.viewer.copy(camPos);
    push(this.cpuMs, performance.now() - t0);
    if (this.frames % 60 === 0) this.summarise();
  }

  private scanPlanes(frame: XRFrame, refSpace: XRReferenceSpace, viewer: Vector3, viewDir: Vector3): void {
    const planes = frame.detectedPlanes;
    if (!planes) return;
    // Re-scan when the plane set changes, and every 30 frames until a stage is chosen.
    const chosen = this.plane.source.startsWith('detected');
    if (planes.size === this.planeSetSize && (chosen || this.frames % 30 !== 0)) return;
    this.planeSetSize = planes.size;
    const infos: PlaneInfo[] = [];
    const forward = viewDir.clone();
    forward.y = 0;
    forward.normalize();
    let best: { info: PlaneInfo; t: number; hit: Vector3; n: Vector3 } | undefined;
    const poseM = new Matrix4();
    for (const plane of planes) {
      const pose = frame.getPose(plane.planeSpace, refSpace);
      const info = describePlane(plane, pose, this.world.player.matrixWorld);
      infos.push(info);
      if (info.orientation !== 'vertical' || !pose) continue;
      // Wall stage: the vertical plane hit by the viewer's horizontal gaze, 0.5-3.5 m away.
      const n = new Vector3(...info.normal);
      const o = new Vector3(...info.position);
      const denom = n.dot(forward);
      if (Math.abs(denom) < 0.5) continue; // wall must roughly face the viewer
      const t = n.dot(o.clone().sub(viewer)) / denom;
      if (t < 0.5 || t > 3.5) continue;
      const hit = viewer.clone().addScaledVector(forward, t);
      poseM.fromArray(pose.transform.matrix).premultiply(this.world.player.matrixWorld).invert();
      const local = hit.clone().applyMatrix4(poseM);
      if (Math.abs(local.x) > info.extentX / 2 || Math.abs(local.z) > info.extentZ / 2) continue;
      if (!best || t < best.t || (t === best.t && info.semanticLabel === 'wall')) best = { info, t, hit, n };
    }
    this.report.planes = infos;
    if (best) {
      // Stage centre: where the gaze meets the wall, 0.2 m below eye height.
      best.hit.y -= 0.2;
      this.plane.setFrom(best.hit, best.n, viewer, `detected:${best.info.semanticLabel ?? 'vertical'}`);
      this.report.stage = {
        source: this.plane.source,
        distanceM: r3(best.t),
        viewer: viewer.toArray().map(r3),
        origin: this.plane.origin.toArray().map(r3),
        normalTowardViewer: this.plane.normal.toArray().map(r3),
        rawPlaneNormal: best.info.normal,
      };
    }
  }

  private updateAnchor(frame: XRFrame, refSpace: XRReferenceSpace): void {
    const a = this.report.anchor as Record<string, unknown>;
    if (this.anchorState === 'idle' && this.plane.source.startsWith('detected') && frame.createAnchor) {
      this.anchorState = 'pending';
      const session = frame.session as XRSession & {
        restorePersistentAnchor?: (uuid: string) => Promise<XRAnchor>;
        persistentAnchors?: readonly string[];
      };
      a.persistentAnchorsAtStart = session.persistentAnchors ? [...session.persistentAnchors] : 'unsupported';
      const saved = localStorage.getItem(ANCHOR_KEY);
      const create = async () => {
        // scene -> reference space (player origin is identity in this seated AR app)
        this.tmpM.copy(this.world.player.matrixWorld).invert();
        const p = this.plane.origin.clone().applyMatrix4(this.tmpM);
        const q = new Quaternion().setFromRotationMatrix(this.plane.basis(new Matrix4()));
        const anchor = await frame.createAnchor!(
          new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: q.x, y: q.y, z: q.z, w: q.w }),
          refSpace,
        );
        a.created = true;
        const handle = (anchor as XRAnchor & { requestPersistentHandle?: () => Promise<string> });
        if (handle.requestPersistentHandle) {
          const uuid = await handle.requestPersistentHandle();
          localStorage.setItem(ANCHOR_KEY, uuid);
          a.persistedUuid = uuid;
        } else {
          a.persistedUuid = 'requestPersistentHandle unsupported';
        }
        return anchor;
      };
      const run = async () => {
        if (saved && session.restorePersistentAnchor) {
          try {
            this.anchor = await session.restorePersistentAnchor(saved);
            a.restoredUuid = saved;
            return;
          } catch (err) {
            a.restoreError = String(err);
          }
        }
        this.anchor = await create();
      };
      run()
        .catch((err) => (a.error = String(err)))
        .finally(() => (this.anchorState = 'done'));
    }
    if (this.anchor) {
      const pose = frame.getPose(this.anchor.anchorSpace, refSpace);
      if (pose) a.pose = [pose.transform.position.x, pose.transform.position.y, pose.transform.position.z].map(r3);
    }
  }

  private sizeTable(): SizeRow[] {
    const rows: SizeRow[] = [];
    const saved = this.plane.origin.clone();
    const lightDist = this.plane.normal.dot(this.light.clone().sub(saved));
    for (const dist of [1, 1.5, 2, 3]) {
      // move the plane so the lantern is `dist` metres from it
      this.plane.origin.copy(saved).addScaledVector(this.plane.normal, lightDist - dist);
      const row: SizeRow = { wallDistanceM: dist };
      for (const k of [0, 0.6, 0.9, 1]) row[`k=${k}`] = n3(this.shadow.shadowExtent(this.hands, this.plane, this.light, k));
      rows.push(row);
    }
    this.plane.origin.copy(saved);
    return rows;
  }

  private summarise(): void {
    const r = this.report;
    const L = this.hands.hands.left, R = this.hands.hands.right;
    const tip = new Vector3();
    const iwsdkTip = new Vector3();
    let tipDelta: number | null = null;
    const tipEntity = this.world.playerSpaceEntities?.indexTipSpaces?.right;
    if (R.tracked && tipEntity?.object3D) {
      this.hands.jointPosition('right', 9, tip);
      tipEntity.object3D.getWorldPosition(iwsdkTip);
      tipDelta = tip.distanceTo(iwsdkTip);
    }
    r.hands = {
      jointsPerHand: JOINT_COUNT,
      left: { tracked: L.tracked, validJoints: L.validJoints, wrist: L.tracked ? this.hands.jointPosition('left', 0, new Vector3()).toArray().map(r3) : null },
      right: { tracked: R.tracked, validJoints: R.validJoints, wrist: R.tracked ? this.hands.jointPosition('right', 0, new Vector3()).toArray().map(r3) : null, indexTip: R.tracked ? tip.toArray().map(r3) : null },
      readMethod: { ...this.hands.method },
      rightIndexTipVsIwsdkIndexTipSpaceM: tipDelta === null ? null : r3(tipDelta),
    };
    const elapsed = (performance.now() - this.startedAt) / 1000;
    r.loop = {
      driver: this.opts && (window as unknown as { __spikeDriver?: string }).__spikeDriver,
      fixedHz: this.opts.hz,
      simSteps: this.sim.steps,
      displayFrames: this.frames,
      elapsedS: r3(elapsed),
      simStepsPerS: r3(this.sim.steps / elapsed),
      displayFps: r3(this.frames / elapsed),
    };
    r.shadow = {
      k: r3(this.shadow.k),
      instances: this.shadow.jointShadow.count + this.shadow.boneShadow.count,
      handShadowWidthM: Object.fromEntries([0, 0.5, 1].map((k) => [`k=${k}`, n3(this.shadow.shadowExtent(this.hands, this.plane, this.light, k))])),
      stageSource: this.plane.source,
      // Same hand, same light, wall moved along its normal: width (m) per wall distance.
      widthVsWallDistance: this.sizeTable(),
    };
    const info = this.world.renderer.info;
    r.perf = {
      quads: this.opts.quads,
      ourCpuMsAvg: r3(avg(this.cpuMs)),
      ourCpuMsMax: r3(Math.max(...this.cpuMs)),
      renderCallMsAvg: r3(avg(this.renderMs)),
      renderCallMsP95: r3(p95(this.renderMs)),
      frameIntervalMsAvg: r3(avg(this.intervalMs)),
      frameIntervalMsP95: r3(p95(this.intervalMs)),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
    };
    console.info('[spike] ' + JSON.stringify(r));
  }
}

export interface SizeRow { wallDistanceM: number; [k: string]: number | null }

function push(arr: number[], v: number): void {
  arr.push(v);
  if (arr.length > 240) arr.shift();
}
const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const p95 = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] : 0);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const n3 = (n: number | null) => (n === null ? null : r3(n));
