import { DataTexture, MeshBasicMaterial, Object3D } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { BUMP_STRENGTH, CandleLight, MOON_BEAM, MOON_FLASH } from './candle-light';

/** A shader as three hands onBeforeCompile one: just the chunks the patch looks for. */
function fakeShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <opaque_fragment>\n}',
  };
}

function patched(material: MeshBasicMaterial) {
  const shader = fakeShader();
  (material.onBeforeCompile as unknown as (s: typeof shader) => void)(shader);
  return shader;
}

describe('CandleLight.light', () => {
  it('lights a material by the candle, without a bump unless one is given', () => {
    const candle = new CandleLight();
    const plain = new MeshBasicMaterial();
    candle.light(plain);
    const s = patched(plain);
    expect(s.fragmentShader).toContain('outgoingLight *= candleLight();');
    expect(s.fragmentShader).not.toContain('#define CANDLE_BUMP');
    expect(s.uniforms.uCandleBump).toBeUndefined();
    candle.dispose();
  });

  it('with a bump, leans the normal by its map, repeated as asked, under its own program', () => {
    const candle = new CandleLight();
    const map = new DataTexture(new Uint8Array(4), 1, 1);
    const plain = new MeshBasicMaterial();
    const wall = new MeshBasicMaterial();
    candle.light(plain);
    candle.light(wall, { map, repeat: [6, 4] });
    const s = patched(wall);
    expect(s.fragmentShader).toContain('#define CANDLE_BUMP');
    expect(s.vertexShader).toContain('vCandleUv = uv;');
    expect(s.uniforms.uCandleBump.value).toBe(map);
    expect(s.uniforms.uCandleBumpRepeat.value).toMatchObject({ x: 6, y: 4 });
    expect(s.uniforms.uCandleBumpStrength).toBe(candle.uniforms.uCandleBumpStrength); // shared: one knob for all
    expect(candle.uniforms.uCandleBumpStrength.value).toBe(BUMP_STRENGTH);
    expect(wall.customProgramCacheKey()).not.toBe(plain.customProgramCacheKey());
    map.dispose();
    candle.dispose();
  });

  it("takes the hands' shadows (shared uniforms), unless asked not to, under its own program", () => {
    const candle = new CandleLight();
    const wall = new MeshBasicMaterial();
    const glove = new MeshBasicMaterial();
    candle.light(wall);
    candle.light(glove, undefined, false);
    const w = patched(wall);
    expect(w.fragmentShader).toContain('#define CANDLE_HANDS');
    expect(w.uniforms.uHandStrength).toBe(candle.hands.uniforms.uHandStrength);
    expect(w.uniforms.uHandMap).toBe(candle.hands.uniforms.uHandMap);
    expect(patched(glove).fragmentShader).not.toContain('#define CANDLE_HANDS');
    expect(glove.customProgramCacheKey()).not.toBe(wall.customProgramCacheKey());
    candle.dispose();
  });
});

describe('CandleLight.fullBright', () => {
  it('is a switch shared by every lit material that lights them evenly', () => {
    const candle = new CandleLight();
    const m = new MeshBasicMaterial();
    candle.light(m);
    const s = patched(m);
    expect(s.fragmentShader).toContain('if (uFullBright > 0.5) outgoingLight = sqrt(outgoingLight);');
    expect(candle.fullBright).toBe(false);
    candle.fullBright = true;
    expect(s.uniforms.uFullBright.value).toBe(1);
    candle.fullBright = false;
    expect(s.uniforms.uFullBright.value).toBe(0);
    candle.dispose();
  });
});

describe('CandleLight and the moon through the window', () => {
  it('has no beam until it has a window, then the night beam, scaled by the moon, the story and the lightning', () => {
    const candle = new CandleLight();
    expect(candle.moonBeam.b).toBe(0);
    const window = new Object3D();
    window.position.set(-1.995, 1.45, -0.8);
    candle.setMoonWindow(window, 0.84, 1.08);
    expect(candle.moonBeam.b).toBeCloseTo(MOON_BEAM.b, 6);
    candle.setMoon(0.5); // the ending: the moon sinks
    expect(candle.moonBeam.b).toBeCloseTo(MOON_BEAM.b * 0.5, 6);
    candle.setMoon(1);
    candle.setMoonBeamLift(2); // scene 6
    expect(candle.moonBeam.b).toBeCloseTo(MOON_BEAM.b * 2, 6);
    candle.setMoonBeamLift(1);
    candle.setMoonFlash(1);
    expect(candle.moonBeam.b).toBeCloseTo(MOON_BEAM.b * (1 + MOON_FLASH), 6);
    candle.setMoonFlash(0);
    expect(candle.moonBeam.b).toBeCloseTo(MOON_BEAM.b, 6);
    candle.dispose();
  });

  it('lights every lit material by the beam too, through shared uniforms', () => {
    const candle = new CandleLight();
    const m = new MeshBasicMaterial();
    candle.light(m);
    const s = patched(m);
    expect(s.fragmentShader).toContain('vec3 moon = uMoonLight + moonBeam(n, nl);');
    expect(s.uniforms.uMoonBeam).toBe(candle.uniforms.uMoonBeam);
    expect(s.uniforms.uMoonShadow).toBe(candle.uniforms.uMoonShadow);
    candle.dispose();
  });
});
