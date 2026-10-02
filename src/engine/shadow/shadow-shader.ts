// The shadow shader: a quad covering the stage, where each fragment takes its
// distance to the nearest hand capsule (in stage metres) and fades from black
// to clear across that capsule's blur width. The 50 % edge sits exactly on the
// capsule, which is what the collision solver uses. One draw call for both
// hands; overlaps never darken twice, which matters over passthrough.

export const MAX_CAPSULES = 56; // two hands × 28

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
  uniform int uCount;
  uniform vec2 uSize;  // stage width, height
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  float segmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-10), 0.0, 1.0);
    return length(p - a - ab * t);
  }

  void main() {
    vec2 p = (vUv - 0.5) * uSize;
    float alpha = 0.0;
    for (int i = 0; i < ${MAX_CAPSULES}; i++) {
      if (i >= uCount) break;
      vec4 c = uCaps[i];
      vec2 rb = uRadBlur[i];
      float d = segmentDistance(p, c.xy, c.zw) - rb.x;
      alpha = max(alpha, 1.0 - smoothstep(-0.5 * rb.y, 0.5 * rb.y, d));
    }
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha * uOpacity);
  }
`;
