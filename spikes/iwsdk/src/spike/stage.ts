// Stage surface + N instanced quads simulated in 2D plane space.
import {
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import { PlaneFrame } from './plane-frame.js';

export const STAGE_W = 0.8;
export const STAGE_H = 0.6;

/** Pure 2D simulation state: no three.js, no ECS. */
export class StageSim {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly px: Float32Array; // previous step, for render interpolation
  readonly py: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  steps = 0;

  constructor(readonly count: number) {
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.px = new Float32Array(count);
    this.py = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      this.x[i] = this.px[i] = (rnd() - 0.5) * STAGE_W;
      this.y[i] = this.py[i] = (rnd() - 0.5) * STAGE_H;
      this.vx[i] = (rnd() - 0.5) * 0.2;
      this.vy[i] = (rnd() - 0.5) * 0.2;
    }
  }

  step(dt: number): void {
    const hw = STAGE_W / 2, hh = STAGE_H / 2;
    for (let i = 0; i < this.count; i++) {
      this.px[i] = this.x[i];
      this.py[i] = this.y[i];
      let x = this.x[i] + this.vx[i] * dt;
      let y = this.y[i] + this.vy[i] * dt;
      if (x < -hw || x > hw) { this.vx[i] = -this.vx[i]; x = Math.max(-hw, Math.min(hw, x)); }
      if (y < -hh || y > hh) { this.vy[i] = -this.vy[i]; y = Math.max(-hh, Math.min(hh, y)); }
      this.x[i] = x;
      this.y[i] = y;
    }
    this.steps++;
  }
}

export class StageView {
  readonly paper: Mesh;
  readonly quads: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly basis = new Matrix4();
  private readonly p = new Vector3();
  private readonly q = new Quaternion();
  private readonly s = new Vector3(0.03, 0.03, 1);

  constructor(count: number) {
    this.paper = new Mesh(
      new PlaneGeometry(STAGE_W, STAGE_H),
      new MeshBasicMaterial({ color: new Color(0xf3e6c8), side: DoubleSide }),
    );
    this.paper.renderOrder = 0;
    this.quads = new InstancedMesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
      count,
    );
    this.quads.frustumCulled = false;
    this.quads.renderOrder = 1;
    const c = new Color();
    for (let i = 0; i < count; i++) this.quads.setColorAt(i, c.setHSL(0.08 + (i % 7) * 0.01, 0.9, 0.45));
  }

  update(sim: StageSim, plane: PlaneFrame, alpha: number): void {
    plane.basis(this.basis);
    this.paper.position.copy(plane.origin);
    this.paper.quaternion.setFromRotationMatrix(this.basis);
    this.q.copy(this.paper.quaternion);
    for (let i = 0; i < sim.count; i++) {
      const x = sim.px[i] + (sim.x[i] - sim.px[i]) * alpha;
      const y = sim.py[i] + (sim.y[i] - sim.py[i]) * alpha;
      plane.toWorld(x, y, this.p, 0.001);
      this.m.compose(this.p, this.q, this.s);
      this.quads.setMatrixAt(i, this.m);
    }
    this.quads.instanceMatrix.needsUpdate = true;
  }
}
