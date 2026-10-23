// Draws the shadows of the invisible props (GDD "The landscape: shadows of invisible props") on the stage, in one
// draw call: each prop's silhouette from projectProp as a filled polygon with a soft rim, in the same black, at the same
// render order and just off the stage like the hands' shadows. Props are static, so the geometry is built when a puzzle
// loads (and again if the light moves); update() only places the mesh and sets its opacity, and allocates nothing.
import { BufferAttribute, BufferGeometry, DoubleSide, Matrix4, Mesh, MeshBasicMaterial } from '@iwsdk/core';
import { projectProp, createSilhouette, type Prop } from './pure/prop-shadow';
import { appendFeathered, createPropShadowMesh, MAX_PROP_SHADOWS, resetPropShadowMesh } from './pure/prop-shadow-mesh';
import { DEFAULT_SHADOW_SETTINGS } from './pure/shadow-projector';
import { distanceToPlane, type StagePlane } from './pure/stage-plane';
import { DEFAULT_SHADOW_OPACITY, SHADOW_RENDER_ORDER } from './shadow-renderer';

/** Lifted this far off the stage, toward the player, as the hands' shadows are. */
const LIFT_M = 0.002;

type V3 = Readonly<ArrayLike<number>>;

export class PropShadowView {
  readonly mesh: Mesh;
  private readonly geometry = new BufferGeometry();
  private readonly material: MeshBasicMaterial;
  private readonly data = createPropShadowMesh();
  private readonly scratch = createSilhouette();
  private readonly m = new Matrix4();
  private drawn = 0;

  constructor() {
    this.geometry.setAttribute(
      'position',
      new BufferAttribute(this.data.positions, 3).setUsage(35048), // DynamicDrawUsage
    );
    this.geometry.setAttribute('color', new BufferAttribute(this.data.colors, 4).setUsage(35048));
    this.geometry.setIndex(new BufferAttribute(this.data.indices, 1).setUsage(35048));
    this.geometry.setDrawRange(0, 0);
    this.material = new MeshBasicMaterial({
      color: 0x000000,
      vertexColors: true, // four-component colours: the alpha fades the rim
      transparent: true,
      opacity: DEFAULT_SHADOW_OPACITY,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = SHADOW_RENDER_ORDER;
    this.mesh.visible = false;
  }

  /** How many prop shadows are drawn. */
  get count(): number {
    return this.drawn;
  }

  /**
   * Rebuilds the shadows of `props` lit from `light` on `stage`, with the same `blend` as the hands. Call when a puzzle
   * loads, and again if the light moves. Props with no usable shadow are skipped, and so is anything past
   * MAX_PROP_SHADOWS. Returns how many are drawn. Allocates nothing, but it is meant for load, not every frame.
   */
  setProps(props: readonly Prop[], light: V3, stage: StagePlane, blend: number): number {
    resetPropShadowMesh(this.data);
    const s = DEFAULT_SHADOW_SETTINGS;
    for (let i = 0; i < props.length && this.data.shadows < MAX_PROP_SHADOWS; i++) {
      const prop = props[i];
      if (projectProp(prop, light, stage, blend, this.scratch) < 3) continue;
      // The farther the prop is from the stage, the softer its edge, as for the hands.
      const h = distanceToPlane(stage, prop.position[0], prop.position[1], prop.position[2]);
      const blur = Math.min(Math.max(h * s.blurPerM, s.minBlurM), s.maxBlurM);
      appendFeathered(this.data, this.scratch, blur);
    }
    this.drawn = this.data.shadows;
    this.geometry.setDrawRange(0, this.data.indexCount);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.index!.needsUpdate = true;
    return this.drawn;
  }

  /**
   * Once per frame: puts the mesh on the stage and sets how solid the shadows are (the hands' opacity times the
   * lantern's: 0 hides them, as when the lantern is out).
   */
  update(stage: StagePlane, opacity: number): void {
    this.mesh.visible = this.drawn > 0 && opacity > 0.001;
    if (!this.mesh.visible) return;
    this.material.opacity = opacity;
    // The geometry is in stage metres: x along the stage's right, y along its up, z along its normal.
    const r = stage.right,
      u = stage.up,
      n = stage.normal,
      o = stage.origin;
    // prettier-ignore
    this.m.set(
      r[0], u[0], n[0], o[0] + n[0] * LIFT_M,
      r[1], u[1], n[1], o[1] + n[1] * LIFT_M,
      r[2], u[2], n[2], o[2] + n[2] * LIFT_M,
      0, 0, 0, 1,
    );
    this.mesh.matrix.copy(this.m);
    this.mesh.matrixWorldNeedsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
