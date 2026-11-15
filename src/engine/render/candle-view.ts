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
//   - Palm Covering & Deliberate Pause: hovering a palm over the flame displays a radial progress ring filling
//     clockwise over 3.0 seconds before extinguishing the candle and pausing.
//   - In-Game Lock: locks candle in place once gameplay starts.
//   - Sleep mode (the end, scene 7): covering puts the candle out instead of pausing, so there is no pause ring; the flame
//     shrinks and its light dims as the cover goes on, and a hand starts to dim it from further off.
//   - Match near (the start): the wick's glow brightens, grows and quickens as the matchstick comes near it.
//
// Zero allocations per frame. All Three.js objects imported through @iwsdk/core.
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import { createPalm, derivePalm, type HandFrame, type Handedness } from '../hands/hand';
import { LanternGlow } from '../shadow/lantern-glow';
import type { LanternLight } from '../shadow/pure/lantern-light';

export type CandleInteractionState = 'placed' | 'held' | 'placing';

export const COVER_PAUSE_DURATION_S = 3.0;
/** How far from the flame (m) a hand starts to dim it: in play, and at the end (sleep mode), where it answers from further off. */
const OCCLUDE_REACH_M = 0.16;
const SLEEP_OCCLUDE_REACH_M = 0.3;
/** Closer than this (m) a hand smothers the light completely. */
const OCCLUDE_FULL_M = 0.04;

const COVER_RING_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const COVER_RING_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uProgress;
  uniform vec3 uColor;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float r = length(p);
    // Smooth anti-aliased circular ring between r = 0.32 and r = 0.46
    float ring = smoothstep(0.31, 0.33, r) * (1.0 - smoothstep(0.45, 0.47, r));
    if (ring <= 0.001) {
      discard;
    }

    // Angle starting at 12 o'clock (top, p.y > 0, p.x = 0) filling clockwise
    float angle = atan(p.x, p.y);
    if (angle < 0.0) {
      angle += 6.28318530718;
    }
    float normAngle = angle / 6.28318530718;

    // Faint dark amber background track
    vec4 trackCol = vec4(0.4, 0.25, 0.1, 0.28 * ring);

    if (normAngle <= uProgress) {
      // Filled progress arc with leading edge glow
      float isLead = smoothstep(max(0.0, uProgress - 0.08), uProgress, normAngle);
      vec3 col = mix(uColor, vec3(1.0, 0.95, 0.8), isLead * 0.65);
      gl_FragColor = vec4(col, 0.95 * ring);
    } else {
      gl_FragColor = trackCol;
    }
    #include <colorspace_fragment>
  }
`;

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

  // Deliberate pause radial gauge
  private readonly coverProgressGeometry: PlaneGeometry;
  private readonly coverProgressMaterial: ShaderMaterial;
  private readonly coverProgressMesh: Mesh;

  // Interaction state
  private _state: CandleInteractionState = 'placed';
  private _lit = true;
  private _isLocked = false;
  private _isCovered = false;
  private _ignitionProgress = 0;
  private coverTimer = 0;
  private placingTimer = 0;
  private cooldownTimer = 0;
  private pickupDwellTimer = 0;
  private lightOcclusion = 1.0;
  /**
   * The end (scene 7): covering the flame puts it out for good, so it shows that instead of the pause's ring: the flame
   * shrinks and its light dims as the cover goes on, and a hand begins to dim it from further away.
   */
  sleepMode = false;
  /** The start: 0 .. 1, how near the matchstick is to the wick (ignition.ts); the wick's glow answers it. */
  matchNear = 0;
  /** Sleep mode has sized the flame (put back when it ends). */
  private sleepScaled = false;
  /** The story's mood on the candle itself (setMoodTint): multiplies the flame's colour and the light on the wax. */
  private readonly moodTint = new Float64Array([1, 1, 1]);

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
    this.wickIndicatorGeometry = new SphereGeometry(0.012, 10, 10);
    this.wickIndicatorMaterial = new MeshBasicMaterial({
      color: 0xffb844,
      transparent: true,
      opacity: 0.0,
      toneMapped: false,
    });
    this.wickIndicator = new Mesh(this.wickIndicatorGeometry, this.wickIndicatorMaterial);
    this.wickIndicator.position.set(0, 0.098, 0);
    this.wickIndicator.visible = false;

    // 10. Deliberate Pause Radial Gauge: fills clockwise over 3.0 seconds when hands cup/cover flame
    this.coverProgressGeometry = new PlaneGeometry(0.2, 0.2);
    this.coverProgressMaterial = new ShaderMaterial({
      vertexShader: COVER_RING_VERT,
      fragmentShader: COVER_RING_FRAG,
      uniforms: {
        uProgress: { value: 0.0 },
        uColor: { value: new Color(0xffaa33) },
      },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.coverProgressMesh = new Mesh(this.coverProgressGeometry, this.coverProgressMaterial);
    this.coverProgressMesh.position.set(0, 0.098, 0);
    this.coverProgressMesh.renderOrder = 3;
    this.coverProgressMesh.visible = false;

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
      this.coverProgressMesh,
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

  /** Progress (0.0 to 1.0) of the 3-second palm cover hold toward triggering pause. */
  get coverProgress(): number {
    return Math.min(1.0, this.coverTimer / COVER_PAUSE_DURATION_S);
  }

  /** Resets cover timer, progress gauge, and covered flag. */
  resetCover(): void {
    this._isCovered = false;
    this.coverTimer = 0;
    this.coverProgressMaterial.uniforms.uProgress.value = 0.0;
    this.coverProgressMesh.visible = false;
  }

  /** Progress (0.0 to 1.0) of lighting the candle by holding hand over it for 3 seconds. */
  get ignitionProgress(): number {
    return this._ignitionProgress;
  }

  set ignitionProgress(value: number) {
    this._ignitionProgress = Math.max(0, Math.min(1, value));
  }

  /**
   * Tints the flame and the light it throws on the candle (1, 1, 1 is a flame's own colour), so the candle itself follows the
   * story's mood (candle-mood.ts, moodTint) along with the room.
   */
  setMoodTint(r: number, g: number, b: number): void {
    this.moodTint[0] = r;
    this.moodTint[1] = g;
    this.moodTint[2] = b;
    this.flame.setTint(r, g, b);
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

    const reach = this.sleepMode ? SLEEP_OCCLUDE_REACH_M : OCCLUDE_REACH_M;
    if (minFlameDist < reach) {
      // Smoothly ramp from 0.0 (smothered at <= 4cm) to 1.0 (clear at the reach)
      const t = Math.max(0.0, Math.min(1.0, (minFlameDist - OCCLUDE_FULL_M) / (reach - OCCLUDE_FULL_M)));
      this.lightOcclusion = t * t * (3 - 2 * t);
    } else {
      this.lightOcclusion = 1.0;
    }

    // Dual-hand cupping or single-hand hovering to extinguish flame and pause
    let coveringFlame = false;
    if (this._lit) {
      // 1. Check dual-hand cupping (both hands around or above flame)
      if (leftTracked && rightTracked) {
        const dflx = this.leftPalm[0] - fx;
        const dfly = this.leftPalm[1] - fy;
        const dflz = this.leftPalm[2] - fz;
        const leftDist = Math.sqrt(dflx * dflx + dfly * dfly + dflz * dflz);

        const dfrx = this.rightPalm[0] - fx;
        const dfry = this.rightPalm[1] - fy;
        const dfrz = this.rightPalm[2] - fz;
        const rightDist = Math.sqrt(dfrx * dfrx + dfry * dfry + dfrz * dfrz);

        const hdx = this.leftPalm[0] - this.rightPalm[0];
        const hdy = this.leftPalm[1] - this.rightPalm[1];
        const hdz = this.leftPalm[2] - this.rightPalm[2];
        const handDist = Math.sqrt(hdx * hdx + hdy * hdy + hdz * hdz);

        const mx = (this.leftPalm[0] + this.rightPalm[0]) * 0.5 - fx;
        const my = (this.leftPalm[1] + this.rightPalm[1]) * 0.5 - fy;
        const mz = (this.leftPalm[2] + this.rightPalm[2]) * 0.5 - fz;
        const midDist = Math.sqrt(mx * mx + my * my + mz * mz);

        const heightOk = my >= -0.08 && my <= 0.22 && dfly >= -0.08 && dfry >= -0.08;
        if (leftDist < 0.22 && rightDist < 0.22 && midDist < 0.18 && handDist < 0.28 && heightOk) {
          coveringFlame = true;
        }
      }

      // 2. Check single-hand covering (either palm hovering over flame)
      if (!coveringFlame && leftTracked) {
        const palm = derivePalm(left, this.scratchPalm);
        if (palm) {
          const dx = palm.position[0] - fx;
          const dy = palm.position[1] - fy;
          const dz = palm.position[2] - fz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const horizDist = Math.hypot(dx, dz);
          if (dist < 0.17 && dy >= -0.06 && dy <= 0.2 && horizDist < 0.14) {
            coveringFlame = true;
          }
        }
      }
      if (!coveringFlame && rightTracked) {
        const palm = derivePalm(right, this.scratchPalm);
        if (palm) {
          const dx = palm.position[0] - fx;
          const dy = palm.position[1] - fy;
          const dz = palm.position[2] - fz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const horizDist = Math.hypot(dx, dz);
          if (dist < 0.17 && dy >= -0.06 && dy <= 0.2 && horizDist < 0.14) {
            coveringFlame = true;
          }
        }
      }
    }

    if (coveringFlame) {
      this.coverTimer += delta;
      const progress = Math.min(1.0, this.coverTimer / COVER_PAUSE_DURATION_S);
      this.coverProgressMaterial.uniforms.uProgress.value = progress;
      this.coverProgressMesh.visible = progress > 0.005;
      if (this.coverTimer >= COVER_PAUSE_DURATION_S) {
        this._isCovered = true;
      }
    } else {
      this.coverTimer = Math.max(0, this.coverTimer - delta * 1.5);
      const progress = Math.min(1.0, this.coverTimer / COVER_PAUSE_DURATION_S);
      this.coverProgressMaterial.uniforms.uProgress.value = progress;
      this.coverProgressMesh.visible = progress > 0.005;
      if (this.coverTimer <= 0) {
        this._isCovered = false;
        this.coverProgressMesh.visible = false;
      }
    }

    // If locked during gameplay or unlit in title ritual, pickup is disabled
    if (this._isLocked || !this._lit) {
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
      if (this._ignitionProgress > 0) {
        // Igniting: fire slowly grows from small spark (0.06) to full flame (1.0)
        this.flame.mesh.visible = true;
        this.flame.update(light, cameraQuaternion);
        const scale = Math.max(0.06, this._ignitionProgress);
        this.flame.mesh.scale.setScalar(scale);

        // Circular progress gauge filling over 3 seconds
        this.coverProgressMesh.quaternion.copy(cameraQuaternion);
        this.coverProgressMaterial.uniforms.uProgress.value = this._ignitionProgress;
        this.coverProgressMesh.visible = this._ignitionProgress > 0.01;

        // Dynamic light grows warmly as fire grows
        this.setPointLightColour(light);
        this.pointLight.intensity = Math.pow(this._ignitionProgress, 2) * (light.intensity * 1.5);

        // Wick indicator fades as flame grows
        this.wickIndicator.visible = this._ignitionProgress < 0.6;
        this.pulseWick();
        return;
      }

      this.flame.mesh.visible = false;
      this.coverProgressMesh.visible = false;
      this.pointLight.intensity = 0;
      this.wickIndicator.visible = true;
      this.pulseWick();
      return;
    }

    this.wickIndicator.visible = false;
    this.flame.mesh.visible = true;
    this.flame.update(light, cameraQuaternion);
    this.coverProgressMesh.quaternion.copy(cameraQuaternion);
    this.setPointLightColour(light);
    const coverFactor = this._isCovered ? 0.15 : 1.0;
    this.pointLight.intensity = (light.lit ? light.intensity * 1.5 : 0) * this.lightOcclusion * coverFactor;
    if (this._isCovered) {
      this.flame.mesh.scale.setScalar(0.4);
    }
    if (this.sleepMode) {
      // Going out, not pausing: no ring; the flame bows under a near hand and shrinks, and its light dims, as the cover goes on.
      const cover = this.coverProgress;
      this.coverProgressMesh.visible = false;
      this.flame.mesh.scale.setScalar((1 - 0.75 * cover) * (0.55 + 0.45 * this.lightOcclusion));
      this.pointLight.intensity *= 1 - 0.8 * cover;
      this.sleepScaled = true;
    } else if (this.sleepScaled) {
      this.sleepScaled = false;
      this.flame.mesh.scale.setScalar(1);
    }
  }

  /** The unlit wick's glow: a slow pulse, brighter, bigger and quicker as the match comes near. */
  private pulseWick(): void {
    const near = this.matchNear;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * (0.007 + 0.009 * near));
    const opacity = 0.4 + 0.55 * pulse;
    this.wickIndicatorMaterial.opacity = opacity + (1 - opacity) * near * 0.8;
    this.wickIndicator.scale.setScalar((0.85 + 0.35 * pulse) * (1 + 0.7 * near));
  }

  private setPointLightColour(light: Readonly<LanternLight>): void {
    const t = this.moodTint;
    this.pointLight.color.setRGB(light.color[0] * t[0], light.color[1] * t[1], light.color[2] * t[2]);
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
    this.coverProgressGeometry.dispose();
    this.plateMaterial.dispose();
    this.waxMaterial.dispose();
    this.wickMaterial.dispose();
    this.auraMaterial.dispose();
    this.placementRingMaterial.dispose();
    this.wickIndicatorMaterial.dispose();
    this.coverProgressMaterial.dispose();
  }
}
