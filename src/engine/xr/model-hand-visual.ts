// The player's hands drawn as a rigged model (a glove GLB whose 25 bones are named after the WebXR hand joints, flat under
// one armature: no bone is another's parent). Each frame every bone is put on its tracked joint: turned the way the palm
// has turned since the model's rest pose, then swung to point at its next joint, and scaled to the player's hand, so
// the model follows the real fingers (or PosedHand's held grip). The game knows joint positions only, which is all this
// needs. Fades in and out like CapsuleHandVisual (a dither, so nothing is blended), and fades near the eyes.
//
// It writes depth, so a glove's fingers and palm hide each other properly; where a hand is in front of its own shadow on
// the wall, the hand covers it, as a real one would. Lit as the room is (the moon and the candle, candle-light.ts), with
// the flame near the hands (the matchstick before the candle is lit) adding its own warmth.
import {
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type Bone,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from '@iwsdk/core';
import type { CandleLight } from '../shadow/candle-light';
import {
  createHandFrame,
  createPalm,
  derivePalm,
  JOINT,
  JOINT_COUNT,
  JOINT_NAMES,
  type HandFrame,
} from '../hands/hand';
import { FADE_IN_S, FADE_OUT_S, nearFade } from './hand-fade';
import { HAND_RENDER_ORDER, insertAfter, type HandVisual } from './hand-visual';

/** The joint each bone points at (none for the tips: they keep their finger's turn). */
const CHILD = new Int8Array(JOINT_COUNT).fill(-1);
const PARENT = new Int8Array(JOINT_COUNT).fill(-1);
for (let j = 0; j < JOINT_COUNT; j++) {
  const name = JOINT_NAMES[j];
  if (name.endsWith('-tip')) continue;
  CHILD[j] = name === 'wrist' ? JOINT['middle-finger-metacarpal'] : j + 1;
  if (name !== 'wrist') PARENT[j + 1] = j;
}
const WRIST = JOINT.wrist;
const MID_PROX = JOINT['middle-finger-phalanx-proximal'];

/** The flame near the hands (the matchstick, or the candle once lit): a small warm light added to the candle's. */
interface MatchUniforms {
  pos: { value: Vector3 };
  on: { value: number };
}
/** How far the flame's own warmth reaches on the glove (m, where it is half), and its colour. */
const MATCH_REACH_M = 0.16;
const MATCH_GLSL = /* glsl */ `
  if (uMatchOn > 0.0) {
    vec3 toMatch = uMatchPos - vCandleWorld;
    float md2 = max(dot(toMatch, toMatch), 1e-6);
    float mnl = length(vCandleNormal);
    float mFacing = mnl > 1e-4 ? 0.35 + 0.65 * abs(dot(vCandleNormal / mnl, toMatch * inversesqrt(md2))) : 1.0;
    outgoingLight += diffuseColor.rgb * vec3(1.0, 0.68, 0.38) * uMatchOn * mFacing / (1.0 + md2 / ${(MATCH_REACH_M * MATCH_REACH_M).toFixed(5)});
  }`;

const DITHER = `
  const float bayer[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
  ivec2 ditherCell = ivec2(mod(gl_FragCoord.xy, 4.0));
  if (uHandFade <= (bayer[ditherCell.y * 4 + ditherCell.x] + 0.5) / 16.0) discard;`;

/** Builds a quaternion from an orthonormal basis given as columns (x, y, z). */
function basisQuat(
  x: ArrayLike<number>,
  y: ArrayLike<number>,
  z: ArrayLike<number>,
  m: Matrix4,
  out: Quaternion,
): Quaternion {
  m.set(x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1);
  return out.setFromRotationMatrix(m);
}

/** One glove: its bones by joint, its rest pose, and its fade. */
class Glove {
  readonly bones: (Bone | null)[] = new Array<Bone | null>(JOINT_COUNT).fill(null);
  readonly restPos = new Float64Array(JOINT_COUNT * 3);
  readonly restQuat: Quaternion[] = [];
  readonly restPalmInv = new Quaternion();
  readonly restLength: number;
  readonly fadeUniform = { value: 0 };
  readonly materials: Material[] = [];
  /** The armature's world matrix, inverted: bones are set in its space. */
  readonly armatureInv = new Matrix4();
  fade = 0;
  posed = false;

  constructor(
    readonly root: Object3D,
    scratch: Matrix4,
    candle: CandleLight | null,
    match: MatchUniforms,
  ) {
    root.updateMatrixWorld(true);
    const rest = createHandFrame('right');
    const pos = new Vector3();
    const scale = new Vector3();
    let armature: Object3D | null = null;
    root.traverse((o) => {
      const j = (JOINT as Record<string, number | undefined>)[o.name];
      if (j !== undefined && (o as Bone).isBone) {
        this.bones[j] = o as Bone;
        armature ??= o.parent;
      }
      if (o instanceof SkinnedMesh) {
        o.frustumCulled = false; // its bones move far from where its bounds were measured
        o.renderOrder = HAND_RENDER_ORDER;
        const own = (Array.isArray(o.material) ? o.material : [o.material]).map((m: Material) =>
          this.material(m, candle, match),
        );
        o.material = Array.isArray(o.material) ? own : own[0];
      }
    });
    for (let j = 0; j < JOINT_COUNT; j++) {
      const q = new Quaternion();
      const b = this.bones[j];
      if (!b) throw new Error(`hand model: no bone named ${JOINT_NAMES[j]}`);
      b.matrixWorld.decompose(pos, q, scale);
      this.restQuat.push(q);
      this.restPos[j * 3] = rest.positions[j * 3] = pos.x;
      this.restPos[j * 3 + 1] = rest.positions[j * 3 + 1] = pos.y;
      this.restPos[j * 3 + 2] = rest.positions[j * 3 + 2] = pos.z;
    }
    if (armature) this.armatureInv.copy((armature as Object3D).matrixWorld).invert();
    rest.tracked = true;
    rest.validJoints = JOINT_COUNT;
    // Its palm's frame at rest, from its joints as a right hand's (the turn between two frames is what is used, and a
    // left hand's mirrored frame turns the same way).
    const palm = derivePalm(rest);
    if (!palm) throw new Error('hand model: its rest pose has no palm');
    basisQuat(palm.forward, palm.across, palm.normal, scratch, this.restPalmInv).invert();
    const p = this.restPos;
    this.restLength = Math.hypot(
      p[MID_PROX * 3] - p[WRIST * 3],
      p[MID_PROX * 3 + 1] - p[WRIST * 3 + 1],
      p[MID_PROX * 3 + 2] - p[WRIST * 3 + 2],
    );
  }

  /**
   * The model's material remade as the room's are: its own colours (its texture and base colour), lit per pixel by the moon
   * and the candle (CandleLight), with the glove's bent normals, plus a small warm light from the flame near the hands
   * (`match`), and the fade's dither. Without a candle (tests) it is the texture as it is.
   */
  private material(src: Material, candle: CandleLight | null, match: MatchUniforms): Material {
    const std = src as MeshStandardMaterial;
    const m = new MeshBasicMaterial({ map: std.map ?? null, side: src.side });
    if (std.color) m.color.copy(std.color);
    const fade = this.fadeUniform;
    if (candle) candle.light(m, undefined, false); // the hands' own shadows do not fall on the glove
    const lit = m.onBeforeCompile;
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
      if (candle) {
        lit.call(m, shader, renderer);
        // The candle's facing term from the skinned normal, so a turned or bent glove is lit the way it now faces.
        shader.vertexShader = shader.vertexShader.replace('vec3 candleN = normal;', 'vec3 candleN = objectNormal;');
        shader.uniforms.uMatchPos = match.pos;
        shader.uniforms.uMatchOn = match.on;
        shader.fragmentShader = insertAfter(
          shader.fragmentShader,
          '#include <common>',
          'uniform vec3 uMatchPos;\nuniform float uMatchOn;',
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <opaque_fragment>',
          `${MATCH_GLSL}\n#include <opaque_fragment>`,
        );
      }
      shader.uniforms.uHandFade = fade;
      shader.fragmentShader = insertAfter(shader.fragmentShader, '#include <common>', 'uniform float uHandFade;');
      shader.fragmentShader = insertAfter(shader.fragmentShader, 'void main() {', DITHER);
    };
    m.customProgramCacheKey = () => (candle ? 'model-hand-candle' : 'model-hand');
    this.materials.push(m);
    return m;
  }
}

export class ModelHandVisual implements HandVisual {
  readonly object: Object3D;
  readonly fadeInS = new Float32Array([FADE_IN_S, FADE_IN_S]);
  private readonly gloves: [Glove, Glove];
  private readonly palm = createPalm();
  private readonly livePalm = new Quaternion();
  private readonly turn = new Quaternion();
  private readonly swing = new Quaternion();
  private readonly q = new Quaternion();
  private readonly turns: Quaternion[] = Array.from({ length: JOINT_COUNT }, () => new Quaternion());
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly at = new Vector3();
  private readonly size = new Vector3();
  private readonly m = new Matrix4();
  private readonly world = new Matrix4();

  private readonly match: MatchUniforms = { pos: { value: new Vector3() }, on: { value: 0 } };

  /**
   * @param left the left glove's model (its scene), @param right the right's; both are added under `group`, which is
   * `object`. @param candle the room's light, to light the gloves as the room is (null: unlit, as in tests).
   */
  constructor(left: Object3D, right: Object3D, group: Object3D, candle: CandleLight | null = null) {
    this.object = group;
    group.add(left, right);
    this.gloves = [new Glove(left, this.m, candle, this.match), new Glove(right, this.m, candle, this.match)];
    left.visible = right.visible = false;
  }

  update(
    hands: readonly HandFrame[],
    dt: number,
    flame?: ArrayLike<number> | null,
    shown = true,
    eye?: ArrayLike<number> | null,
  ): void {
    if (flame) {
      this.match.pos.value.set(flame[0], flame[1], flame[2]);
      this.match.on.value = 1;
    } else this.match.on.value = 0;
    for (const hand of hands) {
      const side = hand.handedness === 'left' ? 0 : 1;
      const g = this.gloves[side];
      const fade =
        hand.tracked && shown ? Math.min(1, g.fade + dt / this.fadeInS[side]) : Math.max(0, g.fade - dt / FADE_OUT_S);
      g.fade = fade;
      if (hand.tracked && this.pose(g, hand)) g.posed = true;
      let drawn = g.posed ? fade : 0;
      if (drawn > 0 && eye) {
        let nearest = Infinity;
        const p = hand.positions;
        for (let j = 0; j < JOINT_COUNT; j++) {
          const d = Math.hypot(p[j * 3] - eye[0], p[j * 3 + 1] - eye[1], p[j * 3 + 2] - eye[2]);
          if (d < nearest) nearest = d;
        }
        drawn *= nearFade(nearest);
      }
      g.fadeUniform.value = drawn;
      g.root.visible = drawn > 0;
    }
  }

  /** Puts `g`'s bones on `hand`'s joints. False if its palm cannot be found this frame (the pose is left as it was). */
  private pose(g: Glove, hand: HandFrame): boolean {
    const palm = derivePalm(hand, this.palm);
    if (!palm) return false;
    // The palm's turn from rest (a left hand's frame is mirrored, as its model is: see Glove).
    if (hand.handedness === 'left') cross(palm.forward, palm.across, palm.normal);
    basisQuat(palm.forward, palm.across, palm.normal, this.m, this.livePalm);
    this.turn.multiplyQuaternions(this.livePalm, g.restPalmInv);
    const p = hand.positions;
    const r = g.restPos;
    const s =
      Math.hypot(
        p[MID_PROX * 3] - p[WRIST * 3],
        p[MID_PROX * 3 + 1] - p[WRIST * 3 + 1],
        p[MID_PROX * 3 + 2] - p[WRIST * 3 + 2],
      ) / g.restLength;
    this.size.set(s, s, s);
    for (let j = 0; j < JOINT_COUNT; j++) {
      const c = CHILD[j];
      const t = this.turns[j];
      if (c < 0 || j === WRIST) {
        // A tip keeps its finger's turn; the wrist turns with the palm.
        t.copy(j === WRIST ? this.turn : this.turns[PARENT[j]]);
      } else {
        this.from
          .set(r[c * 3] - r[j * 3], r[c * 3 + 1] - r[j * 3 + 1], r[c * 3 + 2] - r[j * 3 + 2])
          .applyQuaternion(this.turn);
        this.to.set(p[c * 3] - p[j * 3], p[c * 3 + 1] - p[j * 3 + 1], p[c * 3 + 2] - p[j * 3 + 2]);
        if (this.from.lengthSq() < 1e-12 || this.to.lengthSq() < 1e-12) t.copy(this.turn);
        else
          t.multiplyQuaternions(this.swing.setFromUnitVectors(this.from.normalize(), this.to.normalize()), this.turn);
      }
      this.q.multiplyQuaternions(t, g.restQuat[j]);
      this.at.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
      this.world.compose(this.at, this.q, this.size).premultiply(g.armatureInv);
      const bone = g.bones[j]!;
      this.world.decompose(bone.position, bone.quaternion, bone.scale);
    }
    return true;
  }

  dispose(): void {
    for (const g of this.gloves) for (const m of g.materials) m.dispose();
  }
}

/** out = a x b, for three-element arrays. */
function cross(a: ArrayLike<number>, b: ArrayLike<number>, out: number[]): void {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
}
