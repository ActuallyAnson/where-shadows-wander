// The shadow shader: a quad covering the stage, where each fragment takes its
// distance to the nearest hand capsule (in stage metres; only within each
// hand's bounds, so most fragments test nothing) and fades from black
// to clear across that capsule's blur width. The 50 % edge sits exactly on the
// capsule, which is what the collision solver uses. One draw call for both
// hands; overlaps never darken twice, which matters over passthrough.

import { CAPSULES_PER_SLOT, MAX_CAPSULES } from './pure/shadow-uniforms';
import { stageEdgeGlsl } from './stage-edge-glsl';

export { CAPSULES_PER_SLOT, MAX_CAPSULES };

export const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const shadowFragment = /* glsl */ `
  uniform vec4 uCaps[${MAX_CAPSULES}];  // ax, ay, bx, by in stage metres
  uniform vec2 uRadBlur[${MAX_CAPSULES}]; // radius, blur width
  uniform vec4 uBounds[2];  // per hand: minX, minY, maxX, maxY (radius and blur included)
  uniform int uActive[2];
  uniform vec2 uSize;  // stage width, height
  uniform vec3 uColor;
  uniform float uOpacity[2];  // per hand: the base opacity plus its sharpen boost
  uniform vec2 uAreaC;  // the middle of the quad (uSize), metres from the stage's centre
  uniform vec3 uPool;  // the candle's pool of light: the flame's x, y on the wall, and 1 when on (0: clip to the quad)
  uniform vec2 uPoolR;  // the pool's radii, metres
  varying vec2 vUv;
${stageEdgeGlsl}

  float segmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-10), 0.0, 1.0);
    return length(p - a - ab * t);
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize + uAreaC;
    // One pixel's footprint in stage metres, worked out here where every fragment runs it together (derivatives
    // are undefined inside the bounds tests below, which differ between neighbouring pixels). A distance field
    // changes by at most the footprint per pixel.
    float aa = 1.5 * (length(dFdx(p)) + length(dFdy(p)));
    float alpha = 0.0;
    // Only test a hand's capsules where its shadow can reach: most of the stage is skipped.
    for (int h = 0; h < 2; h++) {
      vec4 b = uBounds[h];
      if (uActive[h] == 0 || p.x < b.x || p.y < b.y || p.x > b.z || p.y > b.w) continue;
      for (int k = 0; k < ${CAPSULES_PER_SLOT}; k++) {
        int i = h * ${CAPSULES_PER_SLOT} + k;
        vec4 c = uCaps[i];
        vec2 rb = uRadBlur[i];
        float d = segmentDistance(p, c.xy, c.zw) - rb.x;
        // A sharpened edge is never narrower than about a pixel, so it stays anti-aliased.
        float w = max(rb.y, aa);
        float a = (1.0 - smoothstep(-0.5 * w, 0.5 * w, d)) * uOpacity[h];
        alpha = max(alpha, a);
      }
    }
    // Shadows are only where the candle's light falls: they fade with its pool of light, and stop at the wall's edges.
    if (uPool.z > 0.5) alpha *= lightPool(p, uPool.xy, uPoolR) * stageEdge(p - uAreaC, uSize, 0.03);
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;
