// The room's bunting, alive: two strands of paper flags hung along the picture rail on the wall behind the stage, each a rope
// (VerletChain, the room's own little simulation) that sags, sways in a breeze, is blown hard when the fan puzzle's wind rises, and
// ripples when the spark lands on it. The ropes' points are moved each frame and written straight into one mesh (the flags as
// triangles hanging from the ropes, the ropes as thin ribbons), so it is a single draw call and allocates nothing per frame. It
// replaces the bunting that used to be painted on the wall texture.
import { BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Mesh, MeshBasicMaterial } from '@iwsdk/core';
import { VerletChain } from './pure/verlet-chain';

/** Where each strand hangs from and to, in the wall behind the stage's own coordinates (metres from its centre; y up from the floor). */
const STRANDS: readonly { ax: number; bx: number; y: number }[] = [
  { ax: -1.7266, bx: -0.28125, y: 2.21875 },
  { ax: 0.3047, bx: 1.75, y: 2.21875 },
];
/** Points in a rope (a flag spans two links), and the slack that makes it sag about 11 cm. */
const POINTS = 19;
const LENGTH = 1.4676;
const FLAG_H = 0.115;
const ROPE_HALF = 0.0028;
const FLAG_COLOURS: readonly (readonly [number, number, number])[] = [
  [0.54, 0.29, 0.23],
  [0.78, 0.6, 0.32],
  [0.3, 0.42, 0.35],
  [0.42, 0.35, 0.53],
  [0.7, 0.42, 0.29],
];
const ROPE_COLOUR = [0.1, 0.075, 0.06] as const;
const GRAVITY = 9.8;
/** The breeze in an ordinary room, and what a gust of the fan's wind is (metres per second per second along the wall). */
export const CALM_WIND = 4;
export const FAN_WIND = 34;

export class BuntingView {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  private readonly chains: VerletChain[] = [];
  private readonly positions: Float32Array;
  private readonly posAttr: BufferAttribute;
  private wind = CALM_WIND;
  private readonly flagsPerStrand = (POINTS - 1) / 2;
  private readonly vertsPerStrand: number;

  constructor() {
    for (const s of STRANDS) this.chains.push(new VerletChain(POINTS, s.ax, s.y, s.bx, s.y, LENGTH));
    const flagVerts = this.flagsPerStrand * 3;
    const ropeVerts = (POINTS - 1) * 4;
    this.vertsPerStrand = flagVerts + ropeVerts;
    const total = this.vertsPerStrand * STRANDS.length;
    this.positions = new Float32Array(total * 3);
    const colours = new Float32Array(total * 3);
    const index: number[] = [];
    STRANDS.forEach((_, s) => {
      const base = s * this.vertsPerStrand;
      for (let f = 0; f < this.flagsPerStrand; f++) {
        const c = FLAG_COLOURS[(f + s * 2) % FLAG_COLOURS.length];
        for (let v = 0; v < 3; v++) colours.set(c, (base + f * 3 + v) * 3);
        index.push(base + f * 3, base + f * 3 + 1, base + f * 3 + 2);
      }
      for (let i = 0; i < POINTS - 1; i++) {
        const b = base + flagVerts + i * 4;
        for (let v = 0; v < 4; v++) colours.set(ROPE_COLOUR, (b + v) * 3);
        index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    });
    const geometry = new BufferGeometry();
    this.posAttr = new BufferAttribute(this.positions, 3);
    this.posAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.posAttr);
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    geometry.setIndex(index);
    this.material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, toneMapped: false });
    this.mesh = new Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.write();
  }

  /** Puts the bunting `z` metres in front of the middle of the room's wall space (just in front of the wall). */
  place(z: number): void {
    this.mesh.position.z = z;
  }

  /** The wind along the wall (acceleration, m/s²): CALM_WIND in the room, FAN_WIND while the fan puzzle blows. */
  setWind(wind: number): void {
    this.wind = Number.isFinite(wind) ? wind : CALM_WIND;
  }

  /** The bunting's swing: how much the ropes are moving (zero when still). */
  get motion(): number {
    let m = 0;
    for (const c of this.chains) m += c.motion;
    return m;
  }

  /** Sets the bunting swinging from a point (x, y in the wall's coordinates), as when the spark lands on it. */
  ripple(x: number, y: number, strength = 2.5, radius = 0.55): void {
    for (const c of this.chains) c.impulse(x, y, radius, strength);
  }

  /** Once per frame. Allocates nothing. */
  update(dt: number): void {
    if (!(dt > 0)) return;
    for (const c of this.chains) c.advance(dt, GRAVITY, this.wind);
    this.write();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  /** Writes the ropes' places into the mesh: the flags hang from every second point, the ropes are thin ribbons. */
  private write(): void {
    const out = this.positions;
    for (let s = 0; s < this.chains.length; s++) {
      const c = this.chains[s];
      let o = s * this.vertsPerStrand * 3;
      for (let f = 0; f < this.flagsPerStrand; f++) {
        const a = f * 2;
        const b = a + 2;
        const dx = c.x[b] - c.x[a];
        const dy = c.y[b] - c.y[a];
        const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        // The flag hangs from the rope, down the way gravity pulls (perpendicular to the rope).
        const nx = dy / len;
        const ny = -dx / len;
        out[o++] = c.x[a];
        out[o++] = c.y[a];
        out[o++] = 0;
        out[o++] = c.x[b];
        out[o++] = c.y[b];
        out[o++] = 0;
        out[o++] = (c.x[a] + c.x[b]) / 2 + nx * FLAG_H;
        out[o++] = (c.y[a] + c.y[b]) / 2 + ny * FLAG_H;
        out[o++] = 0.012; // the tip comes a little toward the viewer, so the flag is not flat to the wall
      }
      for (let i = 0; i < POINTS - 1; i++) {
        const dx = c.x[i + 1] - c.x[i];
        const dy = c.y[i + 1] - c.y[i];
        const len = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const rx = (-dy / len) * ROPE_HALF;
        const ry = (dx / len) * ROPE_HALF;
        out[o++] = c.x[i] + rx;
        out[o++] = c.y[i] + ry;
        out[o++] = 0;
        out[o++] = c.x[i] - rx;
        out[o++] = c.y[i] - ry;
        out[o++] = 0;
        out[o++] = c.x[i + 1] + rx;
        out[o++] = c.y[i + 1] + ry;
        out[o++] = 0;
        out[o++] = c.x[i + 1] - rx;
        out[o++] = c.y[i + 1] - ry;
        out[o++] = 0;
      }
    }
    this.posAttr.needsUpdate = true;
  }
}
