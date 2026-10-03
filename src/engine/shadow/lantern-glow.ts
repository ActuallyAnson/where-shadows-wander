// The lantern's glow: a soft round halo with a bright core, drawn as a quad that
// always faces the camera. It replaces the stand-in sphere. Colour and brightness
// come from the LanternLight (pure/lantern-light.ts), so it flickers with it.
// Over passthrough it blends like the other stage materials (src-alpha onto a
// transparent clear), never additively, and includes colorspace_fragment because
// it isn't black. Nothing allocated per frame.
import { Color, Mesh, PlaneGeometry, ShaderMaterial } from '@iwsdk/core';
import type { Quaternion } from '@iwsdk/core';
import type { LanternLight } from './pure/lantern-light';

/** Drawn over the paper (1) and the shadow (2). */
export const GLOW_RENDER_ORDER = 3;

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    if (r >= 1.0 || uIntensity <= 0.001) discard;
    // A tight bright core inside a wide soft halo, both fading to nothing at the edge.
    float halo = exp(-r * r * 5.0) * (1.0 - r);
    float core = exp(-r * r * 60.0);
    float alpha = clamp((0.45 * halo + core) * uIntensity, 0.0, 1.0);
    vec3 color = mix(uColor, vec3(1.0, 0.92, 0.7), core);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export class LanternGlow {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  /** @param sizeM the quad's width and height, metres */
  constructor(sizeM = 0.14) {
    this.material = new ShaderMaterial({
      uniforms: { uColor: { value: new Color(1, 0.56, 0.24) }, uIntensity: { value: 1 } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      premultipliedAlpha: false,
      toneMapped: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(new PlaneGeometry(sizeM, sizeM), this.material);
    this.mesh.renderOrder = GLOW_RENDER_ORDER;
    this.mesh.frustumCulled = false;
  }

  /** Brightness and colour from the light; turns to face `cameraQuaternion` (world). Position is the caller's. */
  update(light: Readonly<LanternLight>, cameraQuaternion: Readonly<Quaternion>): void {
    const u = this.material.uniforms;
    u.uIntensity.value = light.intensity;
    (u.uColor.value as Color).setRGB(light.color[0], light.color[1], light.color[2]);
    this.mesh.quaternion.copy(cameraQuaternion as Quaternion);
  }
}
