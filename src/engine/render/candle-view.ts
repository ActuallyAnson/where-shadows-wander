// Procedural candle on a plate as the sole VR light source.
// Belongs to Teammate B's presentation domain (src/engine/render).
//
// Comprises:
// - Plate / Saucer: dark ceramic / antique brass cylinder with a raised torus lip.
// - Candle Wax: warm ivory cylinder resting on the plate floor.
// - Wick: matte charcoal cylinder centered on the top of the wax.
// - Flame: soft glowing billboard quad from LanternGlow at the tip of the wick.
// - Dynamic Scene Light: non-shadow-casting PointLight matching the flame position and flickering with it.
// - Interactive feedback (the candle stays where it is put: it is not picked up, so the light never moves in play):
//   - Wick Indicator: soft pulsing warm glow hovering over the wick when the candle is unlit.
//   - Light occlusion: a hand near the flame dims its light, at any time.
//   - Sleep mode (the end, scene 7): only then does a cover count. A palm (or two cupped hands) held over the flame for
//     3 s covers it (isCovered), which puts the candle out; the flame shrinks and its light dims as the cover goes on, and a
//     hand starts to dim it from further off. Covering never pauses the game (the system menu does).
//   - Ignition ring: a radial ring fills round the wick as the matchstick lights it.
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
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import { createPalm, derivePalm, type HandFrame, type Handedness } from '../hands/hand';
import { LanternGlow } from '../shadow/lantern-glow';
import type { LanternLight } from '../shadow/pure/lantern-light';

export const COVER_SLEEP_S = 3.0;
/** How far from the flame (m) a hand starts to dim it: in play, and at the end (sleep mode), where it answers from further off. */
const OCCLUDE_REACH_M = 0.16;
const SLEEP_OCCLUDE_REACH_M = 0.3;
/** Closer than this (m) a hand smothers the light completely. */
const OCCLUDE_FULL_M = 0.04;
/**
 * At the end (sleep mode) a hand over the flame dims its light only this far (0.5: to half), so the room the end dims from
 * (SLEEP_DIM in main.ts) goes from 30% to 15% under the cover, not to black.
 */
const SLEEP_OCCLUDE_FLOOR = 0.5;

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
  private readonly wickIndicatorGeometry: SphereGeometry;

  private readonly plateMaterial: MeshStandardMaterial;
  private readonly waxMaterial: MeshStandardMaterial;
  private readonly wickMaterial: MeshStandardMaterial;
  private readonly wickIndicatorMaterial: MeshBasicMaterial;

  private readonly wickIndicator: Mesh;

  // The ignition ring round the wick (a cover never shows one)
  private readonly coverProgressGeometry: PlaneGeometry;
  private readonly coverProgressMaterial: ShaderMaterial;
  private readonly coverProgressMesh: Mesh;

  // Interaction state
  private _lit = true;
  private _isCovered = false;
  private _ignitionProgress = 0;
  private coverTimer = 0;
  private lightOcclusion = 1.0;
  /** The point light at the last update as a share of a clear, uncovered flame's (for beginGoingOut). */
  private lastLightShare = 1;
  /**
   * The end (scene 7): covering the flame puts it out for good, so it shows that instead of the pause's ring: the flame
   * shrinks and its light dims as the cover goes on, and a hand begins to dim it from further away.
   */
  sleepMode = false;
  /** The start: 0 .. 1, how near the matchstick is to the wick (ignition.ts); the wick's glow answers it. */
  matchNear = 0;
  /** Sleep mode has sized the flame (put back when it ends). */
  private sleepScaled = false;
  /**
   * The end, after the flame was covered (ending-timeline.ts): 0 .. 1, how far it has gone out. From beginGoingOut the flame
   * shrinks from the size it had under the hand to nothing and its light dims with it; a hand no longer covers or uncovers it.
   */
  goingOut = 0;
  private outActive = false;
  private outScale = 1;
  private outLight = 1;
  /** The story's mood on the candle itself (setMoodTint): multiplies the flame's colour and the light on the wax. */
  private readonly moodTint = new Float64Array([1, 1, 1]);

  // Scratch arrays for zero-allocation interaction tracking
  private readonly leftPalm = new Float64Array(3);
  private readonly rightPalm = new Float64Array(3);
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
    // VR constraint: castShadow = false (the hands' shadows are cast by CandleLight.hands, hand-shadow-map.ts)
    this.pointLight = new PointLight(0xffeedd, 1.2, 3.5, 2.0);
    this.pointLight.position.set(0, 0.095, 0);
    this.pointLight.castShadow = false;

    // 7. Unlit Wick Indicator: soft warm pulsing orb hovering over wick when candle is unlit
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

    // 8. Ignition ring: fills clockwise as the matchstick lights the wick
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

  /** Whether a palm has covered the flame long enough to put it out (sleep mode only: scene 7's sleep). */
  get isCovered(): boolean {
    return this._isCovered;
  }

  /** Progress (0.0 to 1.0) of the 3-second palm cover that puts the flame out (sleep mode only). */
  get coverProgress(): number {
    return Math.min(1.0, this.coverTimer / COVER_SLEEP_S);
  }

  /** The end: the flame starts going out from how it looks now (call as the cover is committed, before resetCover's next update). */
  beginGoingOut(): void {
    this.outActive = true;
    this.goingOut = 0;
    this.outScale = this.flame.mesh.scale.x;
    // Its light now as a share of a clear flame's (the sleep cover had already dimmed it).
    this.outLight = Math.max(0, Math.min(1, this.lastLightShare));
  }

  /** Back to an ordinary candle (a jump back into the story, or a new session). */
  endGoingOut(): void {
    this.outActive = false;
    this.goingOut = 0;
    this.flame.mesh.scale.setScalar(1);
  }

  /** Whether the end's going out is under way. */
  get isGoingOut(): boolean {
    return this.outActive;
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

  /** Current light occlusion factor (0 = fully blocked, 1 = fully open). */
  get occlusion(): number {
    return this.lightOcclusion;
  }

  /**
   * Updates light occlusion and, in sleep mode, palm-over-flame cover detection.
   * Zero per-frame allocations.
   */
  updateInteraction(hands: Readonly<Record<Handedness, HandFrame>>, delta: number): void {
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
      const open = t * t * (3 - 2 * t);
      this.lightOcclusion = this.sleepMode ? SLEEP_OCCLUDE_FLOOR + (1 - SLEEP_OCCLUDE_FLOOR) * open : open;
    } else {
      this.lightOcclusion = 1.0;
    }

    // Dual-hand cupping or single-hand hovering to put the flame out: only in sleep mode (scene 7), never to pause, and not
    // while it is already going out.
    let coveringFlame = false;
    if (this._lit && !this.outActive && this.sleepMode) {
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

    // The cover shows as the flame going out (update), never as a ring.
    if (coveringFlame) {
      this.coverTimer += delta;
      if (this.coverTimer >= COVER_SLEEP_S) this._isCovered = true;
    } else {
      this.coverTimer = Math.max(0, this.coverTimer - delta * 1.5);
      if (this.coverTimer <= 0) this._isCovered = false;
    }
  }

  /**
   * Syncs candle flame orientation, colour, and point light intensity from LanternLight.
   * Zero per-frame allocations.
   */
  update(light: Readonly<LanternLight>, cameraQuaternion: Readonly<Quaternion>): void {
    if (this.outActive) {
      this.updateGoingOut(light, cameraQuaternion);
      return;
    }
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

    // Lit: the ignition ring is done with (it stopped at full when the wick caught), and a cover never shows one.
    this.wickIndicator.visible = false;
    this.coverProgressMesh.visible = false;
    this.flame.mesh.visible = true;
    this.flame.update(light, cameraQuaternion);
    this.setPointLightColour(light);
    const coverFactor = this._isCovered ? 0.15 : 1.0;
    this.pointLight.intensity = (light.lit ? light.intensity * 1.5 : 0) * this.lightOcclusion * coverFactor;
    if (this._isCovered) {
      this.flame.mesh.scale.setScalar(0.4);
    }
    if (this.sleepMode) {
      // Going out: no ring; the flame bows under a near hand and shrinks, and its light dims, as the cover goes on.
      const cover = this.coverProgress;
      this.coverProgressMesh.visible = false;
      this.flame.mesh.scale.setScalar((1 - 0.75 * cover) * (0.55 + 0.45 * this.lightOcclusion));
      this.pointLight.intensity *= 1 - 0.8 * cover;
      this.sleepScaled = true;
    } else if (this.sleepScaled) {
      this.sleepScaled = false;
      this.flame.mesh.scale.setScalar(1);
    }
    const clear = light.lit ? light.intensity * 1.5 : 0;
    this.lastLightShare = clear > 1e-4 ? this.pointLight.intensity / clear : 0;
  }

  /** The end: the flame shrinks to nothing and its light dims with it; once out, no wick glow asks to be lit again. */
  private updateGoingOut(light: Readonly<LanternLight>, cameraQuaternion: Readonly<Quaternion>): void {
    const g = this.goingOut <= 0 ? 0 : this.goingOut >= 1 ? 1 : this.goingOut;
    const left = 1 - g;
    this.wickIndicator.visible = false;
    this.coverProgressMesh.visible = false;
    if (!this._lit || left <= 0.01) {
      this.flame.mesh.visible = false;
      this.pointLight.intensity = 0;
      return;
    }
    this.flame.mesh.visible = true;
    this.flame.update(light, cameraQuaternion);
    // A guttering flame drops in height faster than its light goes: sqrt keeps a small bead to the end.
    this.flame.mesh.scale.setScalar(Math.max(0.04, this.outScale * Math.sqrt(left)));
    this.setPointLightColour(light);
    this.pointLight.intensity = (light.lit ? light.intensity * 1.5 : 0) * this.outLight * left;
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
    this.wickIndicatorGeometry.dispose();
    this.coverProgressGeometry.dispose();
    this.plateMaterial.dispose();
    this.waxMaterial.dispose();
    this.wickMaterial.dispose();
    this.wickIndicatorMaterial.dispose();
    this.coverProgressMaterial.dispose();
  }
}
