// Procedural candle on a plate as the sole VR light source.
// Belongs to Teammate B's presentation domain (src/engine/render).
//
// Comprises:
// - Plate / Saucer: dark ceramic / antique brass cylinder with a raised torus lip.
// - Candle Wax: warm ivory cylinder resting on the plate floor.
// - Wick: matte charcoal cylinder centered on the top of the wax.
// - Flame: soft glowing billboard quad from LanternGlow at the tip of the wick.
// - Dynamic Scene Light: non-shadow-casting PointLight matching the flame position and flickering with it.
// - Interactive feedback:
//   - Aura Ring: warm glowing halo around the saucer indicating the candle is "picked up".
//   - Placement Ring: 1-second expanding ripple animation when hands separate to place the candle.
//   - Wick Indicator: soft pulsing warm glow hovering over the wick when the candle is unlit.
//   - Palm Covering: hovering a palm over the flame (within 12cm for 0.4s) dims light and signals pause.
//   - In-Game Lock: locks candle in place once gameplay starts.
//
// Zero allocations per frame. All Three.js objects imported through @iwsdk/core.
import {
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import { createPalm, derivePalm, JOINT, type HandFrame, type Handedness } from '../hands/hand';
import { LanternGlow } from '../shadow/lantern-glow';
import type { LanternLight } from '../shadow/pure/lantern-light';

export type CandleInteractionState = 'placed' | 'held' | 'placing';

export class CandleView {
  readonly group = new Group();
  readonly flame = new LanternGlow();
  readonly pointLight: PointLight;
  /** Live coordinates of the flame tip in world space [x, y, z]. */
  readonly flamePosition = new Float64Array(3);

  private readonly plateGeometry: CylinderGeometry;
  private readonly rimGeometry: TorusGeometry;
  private readonly waxGeometry: CylinderGeometry;
  private readonly wickGeometry: CylinderGeometry;
  private readonly auraGeometry: TorusGeometry;
  private readonly placementRingGeometry: RingGeometry;
  private readonly wickIndicatorGeometry: SphereGeometry;

  private readonly plateMaterial: MeshStandardMaterial;
  private readonly waxMaterial: MeshStandardMaterial;
  private readonly wickMaterial: MeshStandardMaterial;
  private readonly auraMaterial: MeshBasicMaterial;
  private readonly placementRingMaterial: MeshBasicMaterial;
  private readonly wickIndicatorMaterial: MeshBasicMaterial;

  private readonly auraMesh: Mesh;
  private readonly placementRingMesh: Mesh;
  private readonly wickIndicator: Mesh;

  // Interaction state
  private _state: CandleInteractionState = 'placed';
  private _lit = true;
  private _isLocked = false;
  private _isCovered = false;
  private coverTimer = 0;
  private placingTimer = 0;
  private cooldownTimer = 0;
  private pickupDwellTimer = 0;
  private lightOcclusion = 1.0;

  // Scratch arrays for zero-allocation interaction tracking
  private readonly leftPalm = new Float64Array(3);
  private readonly rightPalm = new Float64Array(3);
  private readonly handsMidpoint = new Float64Array(3);
  private readonly targetPos = new Float64Array(3);
  private readonly scratchPalm = createPalm();

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
    this.pointLight = new PointLight(0xffeedd, 1.2, 3.5, 2.0);
    this.pointLight.position.set(0, 0.095, 0);
    this.pointLight.castShadow = false;

    // 7. Pickup Feedback Aura Ring: glowing highlight on the rim when held
    this.auraGeometry = new TorusGeometry(0.088, 0.004, 8, 24);
    this.auraMaterial = new MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.0,
      toneMapped: false,
    });
    this.auraMesh = new Mesh(this.auraGeometry, this.auraMaterial);
    this.auraMesh.rotation.x = Math.PI / 2;
    this.auraMesh.position.set(0, 0.015, 0);
    this.auraMesh.visible = false;

    // 8. Placement Feedback Ripple Ring: 1-second expanding pulse when let go
    this.placementRingGeometry = new RingGeometry(0.08, 0.095, 32);
    this.placementRingMaterial = new MeshBasicMaterial({
      color: 0xffe080,
      transparent: true,
      opacity: 0.0,
      side: DoubleSide,
      toneMapped: false,
    });
    this.placementRingMesh = new Mesh(this.placementRingGeometry, this.placementRingMaterial);
    this.placementRingMesh.rotation.x = -Math.PI / 2;
    this.placementRingMesh.position.set(0, 0.002, 0);
    this.placementRingMesh.visible = false;

    // 9. Unlit Wick Indicator: soft warm pulsing orb hovering over wick when candle is unlit
    this.wickIndicatorGeometry = new SphereGeometry(0.005, 8, 8);
    this.wickIndicatorMaterial = new MeshBasicMaterial({
      color: 0xffaa44,
      transparent: true,
      opacity: 0.0,
      toneMapped: false,
    });
    this.wickIndicator = new Mesh(this.wickIndicatorGeometry, this.wickIndicatorMaterial);
    this.wickIndicator.position.set(0, 0.098, 0);
    this.wickIndicator.visible = false;

    this.group.add(
      plateMesh,
      rimMesh,
      waxMesh,
      wickMesh,
      this.flame.mesh,
      this.pointLight,
      this.auraMesh,
      this.placementRingMesh,
      this.wickIndicator,
    );
  }

  /** Sets the world position of the candle group. */
  place(position: ArrayLike<number>): void {
    this.group.position.set(position[0], position[1], position[2]);
    this.flamePosition[0] = position[0];
    this.flamePosition[1] = position[1] + 0.095;
    this.flamePosition[2] = position[2];
  }

  /** Whether the candle is lit. Setting to false turns off flame and enables wick pulse. */
  get lit(): boolean {
    return this._lit;
  }

  set lit(value: boolean) {
    this._lit = value;
    this.wickIndicator.visible = !value;
    this.flame.mesh.visible = value;
    if (!value) {
      this.pointLight.intensity = 0;
    }
  }

  /** Locks candle position during gameplay so projection math remains stable. */
  setLocked(locked: boolean): void {
    this._isLocked = locked;
    if (locked && this._state === 'held') {
      this._state = 'placed';
      this.auraMesh.visible = false;
    }
  }

  get isLocked(): boolean {
    return this._isLocked;
  }

  /** Whether a player's palm is currently covering the flame to pause. */
  get isCovered(): boolean {
    return this._isCovered;
  }

  /** Current intensity of the dynamic point light. */
  get lightIntensity(): number {
    return this.pointLight.intensity;
  }

  /** Current interaction state ('placed' | 'held' | 'placing'). */
  get state(): CandleInteractionState {
    return this._state;
  }

  get isHeld(): boolean {
    return this._state === 'held';
  }

  get isPlacing(): boolean {
    return this._state === 'placing';
  }

  /** Current light occlusion factor (0 = fully blocked, 1 = fully open). */
  get occlusion(): number {
    return this.lightOcclusion;
  }

  /**
   * Checks if an index fingertip touches near the wick or a pinch gesture is near the wick.
   * Zero per-frame allocations.
   */
  checkIgnition(hands: Readonly<Record<Handedness, HandFrame>> | readonly HandFrame[]): boolean {
    if (this._lit) return false;
    const fx = this.flamePosition[0];
    const fy = this.flamePosition[1];
    const fz = this.flamePosition[2];

    const isArr = Array.isArray(hands);
    const count = isArr ? hands.length : 2;
    for (let i = 0; i < count; i++) {
      const h = isArr
        ? (hands as readonly HandFrame[])[i]
        : i === 0
          ? (hands as Readonly<Record<Handedness, HandFrame>>).left
          : (hands as Readonly<Record<Handedness, HandFrame>>).right;
      if (!h.tracked || h.validJoints < 10) continue;
      const p = h.positions;

      // Check index tip touch
      const idx = JOINT['index-finger-tip'] * 3;
      const dx = p[idx] - fx;
      const dy = p[idx + 1] - fy;
      const dz = p[idx + 2] - fz;
      const tipDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (tipDist < 0.08) return true;

      // Check index-to-thumb pinch near wick
      const thmb = JOINT['thumb-tip'] * 3;
      const pdx = p[idx] - p[thmb];
      const pdy = p[idx + 1] - p[thmb + 1];
      const pdz = p[idx + 2] - p[thmb + 2];
      const pinchDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
      if (pinchDist < 0.04) {
        const mx = (p[idx] + p[thmb]) * 0.5 - fx;
        const my = (p[idx + 1] + p[thmb + 1]) * 0.5 - fy;
        const mz = (p[idx + 2] + p[thmb + 2]) * 0.5 - fz;
        const pinchWickDist = Math.sqrt(mx * mx + my * my + mz * mz);
        if (pinchWickDist < 0.1) return true;
      }
    }
    return false;
  }

  /**
   * Updates candle pickup, placement, light occlusion, and palm-over-flame pause detection.
   * Zero per-frame allocations.
   */
  updateInteraction(
    hands: Readonly<Record<Handedness, HandFrame>>,
    delta: number,
    minTableY?: number,
  ): { state: CandleInteractionState; justPlaced: boolean; justPickedUp: boolean } {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - delta);
    }

    let justPlaced = false;
    let justPickedUp = false;

    const left = hands.left;
    const right = hands.right;
    const leftTracked = left.tracked && left.validJoints >= 20;
    const rightTracked = right.tracked && right.validJoints >= 20;

    // Check proximity to flame to calculate light occlusion (hands cupping/covering the flame)
    const fx = this.flamePosition[0];
    const fy = this.flamePosition[1];
    const fz = this.flamePosition[2];
    let minFlameDist = Infinity;

    if (leftTracked) {
      const lp = left.positions;
      this.leftPalm[0] = (lp[30] + lp[33]) * 0.5;
      this.leftPalm[1] = (lp[31] + lp[34]) * 0.5;
      this.leftPalm[2] = (lp[32] + lp[35]) * 0.5;
      const dflx = this.leftPalm[0] - fx;
      const dfly = this.leftPalm[1] - fy;
      const dflz = this.leftPalm[2] - fz;
      minFlameDist = Math.min(minFlameDist, Math.sqrt(dflx * dflx + dfly * dfly + dflz * dflz));
    }

    if (rightTracked) {
      const rp = right.positions;
      this.rightPalm[0] = (rp[30] + rp[33]) * 0.5;
      this.rightPalm[1] = (rp[31] + rp[34]) * 0.5;
      this.rightPalm[2] = (rp[32] + rp[35]) * 0.5;
      const dfrx = this.rightPalm[0] - fx;
      const dfry = this.rightPalm[1] - fy;
      const dfrz = this.rightPalm[2] - fz;
      minFlameDist = Math.min(minFlameDist, Math.sqrt(dfrx * dfrx + dfry * dfry + dfrz * dfrz));
    }

    if (minFlameDist < 0.16) {
      // Smoothly ramp from 0.0 (smothered at <= 4cm) to 1.0 (clear at >= 16cm)
      const t = Math.max(0.0, Math.min(1.0, (minFlameDist - 0.04) / 0.12));
      this.lightOcclusion = t * t * (3 - 2 * t);
    } else {
      this.lightOcclusion = 1.0;
    }

    // Palm hovering directly over flame detection (within 0.12m, palm normal pointing downwards)
    let hoveringPalm = false;
    if (this._lit) {
      if (leftTracked) {
        const palm = derivePalm(left, this.scratchPalm);
        if (palm) {
          const dx = palm.position[0] - fx;
          const dy = palm.position[1] - fy;
          const dz = palm.position[2] - fz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 0.12 && palm.position[1] >= fy - 0.03 && palm.normal[1] < -0.35) {
            hoveringPalm = true;
          }
        }
      }
      if (!hoveringPalm && rightTracked) {
        const palm = derivePalm(right, this.scratchPalm);
        if (palm) {
          const dx = palm.position[0] - fx;
          const dy = palm.position[1] - fy;
          const dz = palm.position[2] - fz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < 0.12 && palm.position[1] >= fy - 0.03 && palm.normal[1] < -0.35) {
            hoveringPalm = true;
          }
        }
      }
    }

    if (hoveringPalm) {
      this.coverTimer += delta;
      if (this.coverTimer >= 0.4) {
        this._isCovered = true;
      }
    } else {
      this.coverTimer = Math.max(0, this.coverTimer - delta * 2.0);
      if (this.coverTimer <= 0) {
        this._isCovered = false;
      }
    }

    // If locked during gameplay, 2-handed pickup is disabled
    if (this._isLocked) {
      if (this._state === 'held') {
        this._state = 'placed';
        this.auraMesh.visible = false;
      }
      return { state: this._state, justPlaced, justPickedUp };
    }

    if (leftTracked && rightTracked) {
      // Distance between both hands
      const dx = this.leftPalm[0] - this.rightPalm[0];
      const dy = this.leftPalm[1] - this.rightPalm[1];
      const dz = this.leftPalm[2] - this.rightPalm[2];
      const handDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      // Midpoint between hands
      this.handsMidpoint[0] = (this.leftPalm[0] + this.rightPalm[0]) * 0.5;
      this.handsMidpoint[1] = (this.leftPalm[1] + this.rightPalm[1]) * 0.5;
      this.handsMidpoint[2] = (this.leftPalm[2] + this.rightPalm[2]) * 0.5;

      const cx = this.group.position.x;
      const cy = this.group.position.y;
      const cz = this.group.position.z;

      const dmx = this.handsMidpoint[0] - cx;
      const dmy = this.handsMidpoint[1] - cy;
      const dmz = this.handsMidpoint[2] - cz;
      const midDist = Math.sqrt(dmx * dmx + dmy * dmy + dmz * dmz);

      const dlx = this.leftPalm[0] - cx;
      const dly = this.leftPalm[1] - cy;
      const dlz = this.leftPalm[2] - cz;
      const leftDist = Math.sqrt(dlx * dlx + dly * dly + dlz * dlz);

      const drx = this.rightPalm[0] - cx;
      const dry = this.rightPalm[1] - cy;
      const drz = this.rightPalm[2] - cz;
      const rightDist = Math.sqrt(drx * drx + dry * dry + drz * drz);

      // 1. Check pickup condition when resting (small, intentional grasp around the 18cm saucer)
      if (this._state === 'placed') {
        const heightMatch = Math.abs(this.leftPalm[1] - cy) < 0.07 && Math.abs(this.rightPalm[1] - cy) < 0.07;
        const inGrabZone =
          leftDist < 0.13 && rightDist < 0.13 && midDist < 0.08 && handDist >= 0.06 && handDist <= 0.19 && heightMatch;

        if (inGrabZone && this.cooldownTimer <= 0) {
          this.pickupDwellTimer += delta;
          this.auraMesh.visible = true;
          this.auraMaterial.opacity = 0.35; // gentle approach preview

          if (this.pickupDwellTimer >= 0.12) {
            this._state = 'held';
            justPickedUp = true;
            this.pickupDwellTimer = 0;
            this.auraMaterial.opacity = 0.85;
            this.auraMaterial.color.setHex(0xffaa33);
            this.flame.mesh.scale.setScalar(1.25);
          }
        } else {
          this.pickupDwellTimer = 0;
          this.auraMesh.visible = false;
        }
      }

      // 2. Check holding & moving
      if (this._state === 'held') {
        // Separation check: moving hands far enough apart triggers placement!
        if (handDist > 0.22) {
          this._state = 'placing';
          this.placingTimer = 1.0; // 1-second feedback timer
          this.cooldownTimer = 0.6; // Cooldown before can pick up again
          justPlaced = true;
          this.placementRingMesh.visible = true;
          this.placementRingMesh.scale.setScalar(1.0);
          this.placementRingMaterial.opacity = 0.9;
          this.auraMaterial.color.setHex(0xffe080);
          this.auraMaterial.opacity = 1.0;
        } else {
          // Follow hands midpoint
          const targetY =
            minTableY !== undefined ? Math.max(minTableY, this.handsMidpoint[1] - 0.03) : this.handsMidpoint[1] - 0.03;
          this.targetPos[0] = this.handsMidpoint[0];
          this.targetPos[1] = targetY;
          this.targetPos[2] = this.handsMidpoint[2];

          const lerpFactor = Math.min(1.0, delta * 15.0);
          const nx = cx + (this.targetPos[0] - cx) * lerpFactor;
          const ny = cy + (this.targetPos[1] - cy) * lerpFactor;
          const nz = cz + (this.targetPos[2] - cz) * lerpFactor;
          this.place([nx, ny, nz]);

          // Aura pulsing animation while held
          this.auraMaterial.opacity = 0.7 + 0.15 * Math.sin(performance.now() * 0.008);
        }
      }
    } else if (this._state === 'held') {
      // If tracking lost on both hands while held, settle smoothly
      this._state = 'placing';
      this.placingTimer = 1.0;
      this.cooldownTimer = 0.6;
      justPlaced = true;
      this.placementRingMesh.visible = true;
      this.placementRingMesh.scale.setScalar(1.0);
      this.placementRingMaterial.opacity = 0.9;
    }

    // 3. Process 1-second placement feedback animation
    if (this._state === 'placing') {
      this.placingTimer -= delta;
      const progress = Math.max(0, Math.min(1.0, 1.0 - this.placingTimer / 1.0));

      // Expand placement ripple from 1.0 to 2.6x
      this.placementRingMesh.scale.setScalar(1.0 + progress * 1.6);
      this.placementRingMaterial.opacity = (1.0 - progress) * 0.9;

      // Aura fade out
      this.auraMaterial.opacity = (1.0 - progress) * 0.85;

      // Settle flame scale back to 1.0
      this.flame.mesh.scale.setScalar(1.25 - progress * 0.25);

      if (this.placingTimer <= 0) {
        this._state = 'placed';
        this.placementRingMesh.visible = false;
        this.auraMesh.visible = false;
        this.auraMaterial.opacity = 0.0;
        this.auraMaterial.color.setHex(0xffaa33);
        this.flame.mesh.scale.setScalar(1.0);
      }
    }

    return { state: this._state, justPlaced, justPickedUp };
  }

  /**
   * Syncs candle flame orientation, colour, and point light intensity from LanternLight.
   * Zero per-frame allocations.
   */
  update(light: Readonly<LanternLight>, cameraQuaternion: Readonly<Quaternion>): void {
    if (!this._lit) {
      this.flame.mesh.visible = false;
      this.pointLight.intensity = 0;
      this.wickIndicator.visible = true;
      const pulse = 0.5 + 0.4 * Math.sin(performance.now() * 0.005);
      this.wickIndicatorMaterial.opacity = pulse;
      this.wickIndicator.scale.setScalar(0.8 + 0.3 * pulse);
      return;
    }

    this.wickIndicator.visible = false;
    this.flame.mesh.visible = true;
    this.flame.update(light, cameraQuaternion);
    this.pointLight.color.setRGB(light.color[0], light.color[1], light.color[2]);
    const coverFactor = this._isCovered ? 0.15 : 1.0;
    this.pointLight.intensity = (light.lit ? light.intensity * 1.5 : 0) * this.lightOcclusion * coverFactor;
    if (this._isCovered) {
      this.flame.mesh.scale.setScalar(0.4);
    }
  }

  /** Frees allocated geometries and materials. */
  dispose(): void {
    this.plateGeometry.dispose();
    this.rimGeometry.dispose();
    this.waxGeometry.dispose();
    this.wickGeometry.dispose();
    this.auraGeometry.dispose();
    this.placementRingGeometry.dispose();
    this.wickIndicatorGeometry.dispose();
    this.plateMaterial.dispose();
    this.waxMaterial.dispose();
    this.wickMaterial.dispose();
    this.auraMaterial.dispose();
    this.placementRingMaterial.dispose();
    this.wickIndicatorMaterial.dispose();
  }
}
