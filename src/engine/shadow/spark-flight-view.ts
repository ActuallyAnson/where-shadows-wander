// The spark: when a puzzle is solved, a small glowing light leaves the paper and flies through the room to the thing it wakes (the
// lamp, the bunting, a picture, the globe, the window), leaving a trail, and bursts into light where it lands. It follows a curve that
// rises toward the ceiling and drops onto the target, so the eyes follow it across the room. One Points of trail points moved in
// place each frame (a ring of past positions), so a frame allocates nothing; `onLand` is called once, when it arrives.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Points,
  ShaderMaterial,
  Vector3,
} from '@iwsdk/core';
import { RenderOrder } from './pure/render-order';

/** Trail points (the first is the head), how often one is laid down (seconds), and how long the burst at the end lasts. */
const POINTS = 34;
const LAY_EVERY_S = 0.028;
const BURST_S = 0.7;
/** How high above the straight line the path rises, as a share of its length (at least a hand's breadth). */
const ARC = 0.55;
const MIN_ARC_M = 0.5;

const VERTEX = /* glsl */ `
uniform float uBurst;
uniform float uScale;
attribute float aAge;
varying float vA;
varying float vHeat;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = mix(0.3, 0.08, aAge) * (1.0 + uBurst * 3.0 * (1.0 - aAge));
  gl_PointSize = size * uScale / max(0.4, -mv.z);
  vA = pow(1.0 - aAge, 1.4) * (1.0 - uBurst);
  vHeat = 1.0 - aAge;
}`;

const FRAGMENT = /* glsl */ `
varying float vA;
varying float vHeat;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  vec3 c = mix(vec3(1.0, 0.7, 0.28), vec3(1.0, 0.97, 0.86), vHeat * vHeat);
  gl_FragColor = vec4(c, a * vA);
  #include <colorspace_fragment>
}`;

export class SparkFlightView {
  readonly group = new Group();
  private readonly positions = new Float32Array(POINTS * 3);
  private readonly points: Points;
  private readonly material: ShaderMaterial;
  private readonly from = new Vector3();
  private readonly via = new Vector3();
  private readonly to = new Vector3();
  private onLand: (() => void) | null = null;
  private seconds = 1.7;
  /** Seconds into the flight, since the last trail point was laid, and into the burst (negative until it lands). */
  private t = 0;
  private sinceLay = 0;
  private burst = -1;
  private active = false;

  constructor() {
    const geometry = new BufferGeometry();
    // The attribute keeps this very array (a Float32BufferAttribute would copy it), so moving the points here moves them on screen.
    const position = new BufferAttribute(this.positions, 3);
    position.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', position);
    const age = new Float32Array(POINTS);
    for (let i = 0; i < POINTS; i++) age[i] = i / (POINTS - 1);
    geometry.setAttribute('aAge', new Float32BufferAttribute(age, 1));
    this.material = new ShaderMaterial({
      uniforms: { uBurst: { value: 0 }, uScale: { value: 260 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = RenderOrder.sparkFlight;
    this.group.add(this.points);
    this.group.visible = false;
  }

  /** Whether a spark is flying (or bursting). */
  get flying(): boolean {
    return this.active;
  }

  /** How far along the path the head is, 0..1 (it eases in and out); 1 once it has landed. */
  get progress(): number {
    if (!this.active) return 0;
    const s = Math.min(1, this.t / this.seconds);
    return s * s * (3 - 2 * s);
  }

  /** Sends a spark from `from` to `to` (scene space) over `seconds`; `onLand` is called once when it arrives. A spark already flying is dropped. */
  launch(
    from: Readonly<{ x: number; y: number; z: number }>,
    to: Readonly<{ x: number; y: number; z: number }>,
    onLand: () => void,
    seconds = 1.7,
  ): void {
    this.from.set(from.x, from.y, from.z);
    this.to.set(to.x, to.y, to.z);
    // The control point: halfway, lifted, so the path rises and then drops onto the target.
    const length = this.from.distanceTo(this.to);
    this.via.copy(this.from).add(this.to).multiplyScalar(0.5);
    this.via.y += Math.max(MIN_ARC_M, length * ARC);
    this.onLand = onLand;
    this.seconds = Math.max(0.2, seconds);
    this.t = 0;
    this.sinceLay = 0;
    this.burst = -1;
    this.active = true;
    for (let i = 0; i < POINTS; i++) this.set(i, this.from.x, this.from.y, this.from.z);
    this.material.uniforms.uBurst.value = 0;
    this.group.visible = true;
  }

  /** Drops the spark now (a restart): it is not called back. */
  clear(): void {
    this.active = false;
    this.onLand = null;
    this.group.visible = false;
  }

  /** Once per frame. Allocates nothing. */
  update(dt: number): void {
    if (!this.active) return;
    const step = dt > 0 ? Math.min(dt, 0.1) : 0;
    if (this.burst >= 0) {
      this.burst += step;
      this.material.uniforms.uBurst.value = Math.min(1, this.burst / BURST_S);
      if (this.burst >= BURST_S) this.clear();
      return;
    }
    this.t += step;
    this.sinceLay += step;
    const p = this.progress;
    // Where the head is: a quadratic curve from the paper, up through the lifted point, down onto the target (with a small shimmer).
    const u = 1 - p;
    const x = u * u * this.from.x + 2 * u * p * this.via.x + p * p * this.to.x;
    const y = u * u * this.from.y + 2 * u * p * this.via.y + p * p * this.to.y;
    const z = u * u * this.from.z + 2 * u * p * this.via.z + p * p * this.to.z;
    const wob = Math.sin(this.t * 19) * 0.012 * (1 - p);
    // Lay down a trail point every so often by shifting the older ones along (a ring of positions), then put the head in place.
    while (this.sinceLay >= LAY_EVERY_S) {
      this.sinceLay -= LAY_EVERY_S;
      for (let i = POINTS - 1; i > 1; i--) {
        this.positions[i * 3] = this.positions[(i - 1) * 3];
        this.positions[i * 3 + 1] = this.positions[(i - 1) * 3 + 1];
        this.positions[i * 3 + 2] = this.positions[(i - 1) * 3 + 2];
      }
      this.positions[3] = this.positions[0];
      this.positions[4] = this.positions[1];
      this.positions[5] = this.positions[2];
    }
    this.set(0, x + wob, y + wob, z);
    this.points.geometry.attributes.position.needsUpdate = true;
    if (this.t >= this.seconds) {
      // Landed: the head sits on the target and bursts; the room is told.
      this.set(0, this.to.x, this.to.y, this.to.z);
      this.burst = 0;
      const done = this.onLand;
      this.onLand = null;
      done?.();
    }
  }

  dispose(): void {
    this.clear();
    this.points.geometry.dispose();
    this.material.dispose();
  }

  private set(i: number, x: number, y: number, z: number): void {
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
  }
}
