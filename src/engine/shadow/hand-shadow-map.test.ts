import { Group, Mesh, Scene, Vector3, Vector4, type WebGLRenderer } from '@iwsdk/core';
import { describe, expect, it, vi } from 'vitest';
import { StageFrame } from '../stage/stage-frame';
import { HAND_CASTER_LAYER, HandShadowMap } from './hand-shadow-map';

/** A renderer that only records what it was asked to do. */
function fakeRenderer() {
  const calls: string[] = [];
  const xr = { enabled: true };
  const r = {
    xr,
    getRenderTarget: () => null,
    setRenderTarget: vi.fn(),
    getClearColor: (c: unknown) => c,
    getClearAlpha: () => 0,
    setClearColor: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(() => calls.push(`render xr=${xr.enabled}`)),
  };
  return { renderer: r as unknown as WebGLRenderer, calls, xr };
}

function placed() {
  const map = new HandShadowMap();
  const stage = new StageFrame();
  stage.placeInFront([0, 1.2, 0], 0);
  map.place(stage, [3.96, 2.48, 0, 0.25]);
  const hands = new Group();
  hands.add(new Mesh());
  map.setCasters(hands);
  return { map, stage, hands };
}

describe('HandShadowMap', () => {
  it('puts the casters on its layer, and draws them only when there is a shadow to cast', () => {
    const { map, hands } = placed();
    expect(hands.children[0].layers.isEnabled(HAND_CASTER_LAYER)).toBe(true);
    const { renderer, calls } = fakeRenderer();
    const scene = new Scene();
    map.update(renderer, scene, null, 1);
    map.update(renderer, scene, [0, 1, 0.8], 0);
    expect(calls).toEqual([]);
    expect(map.strength).toBe(0);
    map.update(renderer, scene, [0, 1, 0.8], 0.88);
    expect(calls).toEqual(['render xr=false']); // the headset's cameras are not used for the shadow pass
    expect(map.strength).toBeCloseTo(0.88);
    map.dispose();
  });

  it('puts things back as they were: XR, the scene, and the hands hidden from the player', () => {
    const { map, hands } = placed();
    const { renderer, xr } = fakeRenderer();
    const scene = new Scene();
    hands.visible = false;
    let drawnVisible = false;
    (renderer.render as ReturnType<typeof vi.fn>).mockImplementation(() => (drawnVisible = hands.visible));
    map.update(renderer, scene, [0, 1, 0.8], 1);
    expect(drawnVisible).toBe(true); // a hand hidden from view still casts
    expect(hands.visible).toBe(false);
    expect(xr.enabled).toBe(true);
    expect(scene.overrideMaterial).toBeNull();
    map.dispose();
  });

  it("maps the wall's lit area inside its frustum, and a hand between the light and the wall onto it", () => {
    const { map, stage } = placed();
    const { renderer } = fakeRenderer();
    map.update(renderer, new Scene(), [0, 1, 0.8], 1);
    const m = map.uniforms.uHandMatrix.value;
    const uv = (x: number, y: number, z: number) => {
      const c = new Vector4(x, y, z, 1).applyMatrix4(m);
      return [c.x / c.w, c.y / c.w, c.w];
    };
    // The wall's corners (lit area, at the wall) and its middle are inside clip space.
    const o = new Vector3(...stage.origin);
    for (const [x, y] of [
      [-1.98, -0.99],
      [1.98, 1.49],
      [0, 0.25],
    ]) {
      const [cx, cy, w] = uv(o.x + x, o.y + y, o.z);
      expect(w).toBeGreaterThan(0);
      expect(Math.abs(cx)).toBeLessThan(1);
      expect(Math.abs(cy)).toBeLessThan(1);
    }
    // A point straight between the light and the wall's middle lands where the wall's middle does.
    const [ax, ay] = uv(0, 1, -0.5);
    const [bx, by] = uv(0, 1, stage.origin[2]);
    expect(ax).toBeCloseTo(bx, 6);
    expect(ay).toBeCloseTo(by, 6);
    map.dispose();
  });
});
