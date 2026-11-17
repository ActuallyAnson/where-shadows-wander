import { CubeCamera, Group, Mesh, Scene, type WebGLRenderer } from '@iwsdk/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HAND_CASTER_LAYER, HandShadowMap } from './hand-shadow-map';

const renderer = {
  getClearColor: (c: unknown) => c,
  getClearAlpha: () => 0,
  setClearColor: vi.fn(),
} as unknown as WebGLRenderer;

function withCasters() {
  const map = new HandShadowMap();
  const hands = new Group();
  hands.add(new Mesh());
  map.setCasters(hands);
  return { map, hands };
}

afterEach(() => vi.restoreAllMocks());

describe('HandShadowMap', () => {
  it('puts the casters on its layer, and draws them only when there is a shadow to cast', () => {
    const draw = vi.spyOn(CubeCamera.prototype, 'update').mockImplementation(() => {});
    const { map, hands } = withCasters();
    expect(hands.children[0].layers.isEnabled(HAND_CASTER_LAYER)).toBe(true);
    const scene = new Scene();
    map.update(renderer, scene, null, 1);
    map.update(renderer, scene, [0, 1, 0.8], 0);
    expect(draw).not.toHaveBeenCalled();
    expect(map.strength).toBe(0);
    map.update(renderer, scene, [0, 1, 0.8], 0.88);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(map.strength).toBeCloseTo(0.88);
    expect(map.uniforms.uHandLight.value.toArray()).toEqual([0, 1, 0.8]);
    map.dispose();
  });

  it('draws all round the light (every wall), from where the light is', () => {
    let at: number[] = [];
    vi.spyOn(CubeCamera.prototype, 'update').mockImplementation(function (this: CubeCamera) {
      at = this.position.toArray();
    });
    const { map } = withCasters();
    map.update(renderer, new Scene(), [0.2, 1.1, 0.5], 1);
    expect(at).toEqual([0.2, 1.1, 0.5]);
    expect((map.uniforms.uHandMap.value as { isCubeTexture?: boolean } | null)?.isCubeTexture).toBe(true);
    map.dispose();
  });

  it('puts things back as they were: the scene, and the hands hidden from the player', () => {
    const { map, hands } = withCasters();
    const scene = new Scene();
    hands.visible = false;
    let drawnVisible = false;
    let drawnOverride = false;
    vi.spyOn(CubeCamera.prototype, 'update').mockImplementation(() => {
      drawnVisible = hands.visible;
      drawnOverride = scene.overrideMaterial !== null;
    });
    map.update(renderer, scene, [0, 1, 0.8], 1);
    expect(drawnVisible).toBe(true); // a hand hidden from view still casts
    expect(drawnOverride).toBe(true);
    expect(hands.visible).toBe(false);
    expect(scene.overrideMaterial).toBeNull();
    map.dispose();
  });
});
