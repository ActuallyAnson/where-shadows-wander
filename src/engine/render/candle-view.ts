// Procedural candle on a plate as the sole VR light source.
// Belongs to Teammate B's presentation domain (src/engine/render).
//
// Comprises:
// - Plate / Saucer: dark ceramic / antique brass cylinder with a raised torus lip.
// - Candle Wax: warm ivory cylinder resting on the plate floor.
// - Wick: matte charcoal cylinder centered on the top of the wax.
// - Flame: soft glowing billboard quad from LanternGlow at the tip of the wick.
// - Dynamic Scene Light: non-shadow-casting PointLight matching the flame position and flickering with it.
//
// Zero allocations per frame. All Three.js objects imported through @iwsdk/core.
import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, PointLight, TorusGeometry } from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import { LanternGlow } from '../shadow/lantern-glow';
import type { LanternLight } from '../shadow/pure/lantern-light';

export class CandleView {
  readonly group = new Group();
  readonly flame = new LanternGlow();
  readonly pointLight: PointLight;

  private readonly plateGeometry: CylinderGeometry;
  private readonly rimGeometry: TorusGeometry;
  private readonly waxGeometry: CylinderGeometry;
  private readonly wickGeometry: CylinderGeometry;

  private readonly plateMaterial: MeshStandardMaterial;
  private readonly waxMaterial: MeshStandardMaterial;
  private readonly wickMaterial: MeshStandardMaterial;

  constructor() {
    // 1. Plate / Saucer: radiusTop 0.09m, radiusBottom 0.07m, height 0.015m, 24 segments
    this.plateGeometry = new CylinderGeometry(0.09, 0.07, 0.015, 24);
    this.plateMaterial = new MeshStandardMaterial({
      color: 0x2b221b,
      roughness: 0.6,
      metalness: 0.1,
    });
    const plateMesh = new Mesh(this.plateGeometry, this.plateMaterial);
    // Base rests at Y = 0 (center at height / 2 = 0.0075m)
    plateMesh.position.set(0, 0.0075, 0);

    // 2. Plate Lip / Rim: radius 0.085m, tube 0.005m, 8 radial, 24 tubular segments
    this.rimGeometry = new TorusGeometry(0.085, 0.005, 8, 24);
    const rimMesh = new Mesh(this.rimGeometry, this.plateMaterial);
    // Rotated flat (torus defaults to XY plane; rotate by 90 deg around X to lay in XZ plane)
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.set(0, 0.015, 0);

    // 3. Candle Wax: radiusTop 0.025m, radiusBottom 0.025m, height 0.08m, 16 segments
    this.waxGeometry = new CylinderGeometry(0.025, 0.025, 0.08, 16);
    this.waxMaterial = new MeshStandardMaterial({
      color: 0xf6f0e2,
      roughness: 0.35,
    });
    const waxMesh = new Mesh(this.waxGeometry, this.waxMaterial);
    // Positioned on the plate center, base at Y ≈ 0.0075m, center at Y = 0.0475m
    waxMesh.position.set(0, 0.0475, 0);

    // 4. Wick: radiusTop 0.0015m, radiusBottom 0.0015m, height 0.012m, 8 segments
    this.wickGeometry = new CylinderGeometry(0.0015, 0.0015, 0.012, 8);
    this.wickMaterial = new MeshStandardMaterial({
      color: 0x151515,
      roughness: 0.9,
    });
    const wickMesh = new Mesh(this.wickGeometry, this.wickMaterial);
    // Top of wax is Y = 0.0875m. Wick center is Y = 0.0875 + 0.006 = 0.0935m
    wickMesh.position.set(0, 0.0935, 0);

    // 5. Flame Quad: tip of wick at Y ≈ 0.095m
    this.flame.mesh.position.set(0, 0.095, 0);

    // 6. Dynamic Scene Light: PointLight at wick tip (Y ≈ 0.095m)
    // VR constraint: castShadow = false (shadow puppetry silhouettes are rendered separately by ShadowRenderer)
    this.pointLight = new PointLight(0xffeedd, 1.0, 3.5, 2.0);
    this.pointLight.position.set(0, 0.095, 0);
    this.pointLight.castShadow = false;

    this.group.add(plateMesh, rimMesh, waxMesh, wickMesh, this.flame.mesh, this.pointLight);
  }

  /** Sets the world position of the candle group. */
  place(position: ArrayLike<number>): void {
    this.group.position.set(position[0], position[1], position[2]);
  }

  /** Current intensity of the dynamic point light. */
  get lightIntensity(): number {
    return this.pointLight.intensity;
  }

  /**
   * Syncs candle flame orientation, colour, and point light intensity from LanternLight.
   * Zero per-frame allocations.
   */
  update(light: Readonly<LanternLight>, cameraQuaternion: Readonly<Quaternion>): void {
    this.flame.update(light, cameraQuaternion);
    this.pointLight.color.setRGB(light.color[0], light.color[1], light.color[2]);
    this.pointLight.intensity = light.lit ? light.intensity * 1.2 : 0;
  }

  /** Frees allocated geometries and materials. */
  dispose(): void {
    this.plateGeometry.dispose();
    this.rimGeometry.dispose();
    this.waxGeometry.dispose();
    this.wickGeometry.dispose();
    this.plateMaterial.dispose();
    this.waxMaterial.dispose();
    this.wickMaterial.dispose();
  }
}
