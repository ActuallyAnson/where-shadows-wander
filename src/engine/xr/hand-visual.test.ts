import { Matrix4, Quaternion, ShaderLib, Vector3 } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { PRESETS, writeHandPose } from '../hands/synthetic-hand';
import { createHandFrame, type HandFrame } from '../hands/hand';
import { FADE_OUT_S, stepFade } from './hand-fade';
import { CAPSULE_JOINTS } from '../shadow/pure/shadow-projector';
import { CapsuleHandVisual, CHILD_HAND_SCALE, HAND_RENDER_ORDER, insertAfter, WRIST_CUFF_SCALE } from './hand-visual';

function hand(side: 'left' | 'right', x: number): HandFrame {
  const h = createHandFrame(side);
  writeHandPose(PRESETS.flat, [x, 1, -0.4], h);
  h.tracked = true;
  h.validJoints = 25;
  return h;
}

describe('CapsuleHandVisual', () => {
  it('is two instanced draw calls, drawn after the paper and before the shadow', () => {
    const v = new CapsuleHandVisual();
    expect(v.object.children).toHaveLength(2);
    for (const m of v.object.children) expect(m.renderOrder).toBe(HAND_RENDER_ORDER);
    expect(HAND_RENDER_ORDER).toBeGreaterThan(1);
    expect(HAND_RENDER_ORDER).toBeLessThan(2);
  });

  it('never writes depth, so the shadow behind a hand still draws over it', () => {
    const v = new CapsuleHandVisual();
    for (const m of v.object.children) {
      const material = (m as unknown as { material: { depthWrite: boolean; transparent: boolean } }).material;
      expect(material.depthWrite).toBe(false);
      expect(material.transparent).toBe(true);
    }
  });

  it('draws 25 joints and 28 bones per tracked hand, none for a hand never seen', () => {
    const v = new CapsuleHandVisual();
    const left = createHandFrame('left');
    v.update([left, hand('right', 0.2)], 1 / 72);
    const [joints, bones] = v.object.children as unknown as { count: number }[];
    expect(joints.count).toBe(25);
    expect(bones.count).toBe(28);
    v.update([hand('left', -0.2), hand('right', 0.2)], 1 / 72);
    expect(joints.count).toBe(50);
    expect(bones.count).toBe(56);
  });

  it('fades a lost hand out where it was, then stops drawing it', () => {
    const v = new CapsuleHandVisual();
    const right = hand('right', 0.2);
    v.update([right], 1);
    expect(v.fade[1]).toBe(1);
    right.tracked = false;
    v.update([right], FADE_OUT_S / 2);
    const [joints] = v.object.children as unknown as { count: number }[];
    expect(v.fade[1]).toBeCloseTo(0.5, 6);
    expect(joints.count).toBe(25);
    v.update([right], FADE_OUT_S);
    expect(v.fade[1]).toBe(0);
    expect(joints.count).toBe(0);
  });

  it('fades exactly as stepFade does, for any run of tracked, lost and paused frames', () => {
    const v = new CapsuleHandVisual();
    const h = hand('right', 0.2);
    let want = 0;
    const steps: [boolean, boolean, number][] = [
      [true, true, 0.05],
      [true, true, 0.05],
      [true, true, 0.2],
      [false, true, 0.1],
      [false, true, 0.3],
      [true, true, 0.01],
      [true, false, 0.2],
      [true, true, 1 / 72],
      [false, false, 0.5],
      [true, true, 0.4],
    ];
    for (const [tracked, shown, dt] of steps) {
      h.tracked = tracked;
      v.update([h], dt, null, shown);
      want = stepFade(want, tracked && shown, dt);
      expect(v.fade[1]).toBeCloseTo(want, 6);
    }
  });

  it('draws the same matrices three.js’s own compose gives, for every bone and joint', () => {
    const v = new CapsuleHandVisual();
    const h = hand('right', 0.1);
    v.update([h], 1);
    const [joints, bones] = v.object.children as unknown as {
      instanceMatrix: { array: Float32Array };
      count: number;
    }[];
    const p = h.positions;
    const r = h.radii;
    const up = new Vector3(0, 1, 0);
    let n = 0;
    for (let k = 0; k < CAPSULE_JOINTS.length / 2; k++) {
      const i = CAPSULE_JOINTS[k * 2];
      const j = CAPSULE_JOINTS[k * 2 + 1];
      const a = new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
      const b = new Vector3(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
      const d = new Vector3().subVectors(b, a);
      const len = d.length();
      if (len < 1e-6) continue;
      const q = new Quaternion().setFromUnitVectors(up, d.clone().multiplyScalar(1 / len));
      const s = Math.max(Math.min(r[i], r[j]) || 0, 0.006) * CHILD_HAND_SCALE;
      const want = new Matrix4().compose(new Vector3().addVectors(a, b).multiplyScalar(0.5), q, new Vector3(s, len, s));
      const got = bones.instanceMatrix.array.subarray(n * 16, n * 16 + 16);
      for (let e = 0; e < 16; e++) expect(got[e]).toBeCloseTo(want.elements[e], 4);
      n++;
    }
    expect(n).toBe(bones.count);
    for (let j = 0; j < 25; j++) {
      const s = Math.max(r[j] || 0, 0.006) * CHILD_HAND_SCALE * (j === 0 ? WRIST_CUFF_SCALE : 1.0);
      const want = new Matrix4().makeScale(s, s, s).setPosition(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]);
      for (let e = 0; e < 16; e++) expect(joints.instanceMatrix.array[j * 16 + e]).toBeCloseTo(want.elements[e], 5);
    }
  });

  it('gives finite matrices for a bone pointing straight up or straight down', () => {
    for (const dir of [1, -1]) {
      const g = createHandFrame('left');
      writeHandPose(PRESETS.flat, [0, 1, -0.4], g);
      g.tracked = true;
      g.validJoints = 25;
      g.positions[5 * 3] = 0;
      g.positions[5 * 3 + 1] = 1;
      g.positions[5 * 3 + 2] = 0;
      g.positions[6 * 3] = 0;
      g.positions[6 * 3 + 1] = 1 + dir * 0.05;
      g.positions[6 * 3 + 2] = 0;
      const w = new CapsuleHandVisual();
      w.update([g], 1);
      const arr = (w.object.children[1] as unknown as { instanceMatrix: { array: Float32Array } }).instanceMatrix.array;
      expect(arr.every((x) => Number.isFinite(x))).toBe(true);
    }
  });

  it('fades each hand on its own', () => {
    const v = new CapsuleHandVisual();
    const left = hand('left', -0.2);
    const right = hand('right', 0.2);
    v.update([left, right], 1);
    right.tracked = false;
    v.update([left, right], FADE_OUT_S / 2);
    expect(v.fade[0]).toBe(1);
    expect(v.fade[1]).toBeCloseTo(0.5, 6);
  });

  it('warms joints near the flame', () => {
    const v = new CapsuleHandVisual();
    const h = hand('right', 0);
    const colours = (v.object.children[0] as unknown as { instanceColor: { getX(i: number): number } }).instanceColor;
    // Joint 0 is the wrist; red rises toward the warm colour when the flame is on it.
    v.update([h], 1, [h.positions[0], h.positions[1], h.positions[2]]);
    const lit = colours.getX(0);
    v.update([h], 1, [10, 10, 10]);
    expect(lit).toBeGreaterThan(colours.getX(0));
  });

  it('fades a lost hand out from its last fully tracked pose, not from the joints the reader left behind', () => {
    const v = new CapsuleHandVisual();
    const right = hand('right', 0.2);
    v.update([right], 1);
    const wristX = right.positions[0];
    // Lost: the reader leaves stale joints, here scrambled, as when it fills a hand from another's pose.
    right.tracked = false;
    right.validJoints = 12;
    right.positions.fill(5);
    v.update([right], 0.1);
    const joints = v.object.children[0] as unknown as { instanceMatrix: { array: Float32Array } };
    expect(joints.instanceMatrix.array[12]).toBeCloseTo(wristX, 5);
  });

  it('fades the hands out while the game is paused, even though they still read as tracked', () => {
    const v = new CapsuleHandVisual();
    const right = hand('right', 0.2);
    v.update([right], 1);
    v.update([right], FADE_OUT_S / 2, null, false);
    expect(v.fade[1]).toBeCloseTo(0.5, 6);
    v.update([right], 1, null, true);
    expect(v.fade[1]).toBe(1);
  });
});

describe('the fade shader patch', () => {
  it('adds the fade attribute, its varying and the dither discard to three.js’s basic material shaders', () => {
    const v = new CapsuleHandVisual();
    const material = (v.object.children[0] as unknown as { material: { onBeforeCompile: (s: unknown) => void } })
      .material;
    const shader = { vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader };
    material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('attribute float aFade;');
    expect(shader.vertexShader).toContain('vFade = aFade;');
    expect(shader.fragmentShader).toContain('varying float vFade;');
    expect(shader.fragmentShader).toContain('discard;');
    // The varying is declared before it is used.
    expect(shader.fragmentShader.indexOf('varying float vFade;')).toBeLessThan(
      shader.fragmentShader.indexOf('vFade <='),
    );
  });

  it('throws when a shader chunk it hooks into is gone, rather than silently drawing no hands', () => {
    expect(() => insertAfter('void main() {}', '#include <common>', 'x')).toThrow(/#include <common> not found/);
    expect(insertAfter('a #include <common> b', '#include <common>', 'x')).toBe('a #include <common>\nx b');
  });
});
