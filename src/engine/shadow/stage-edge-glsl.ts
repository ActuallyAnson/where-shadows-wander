// The stage's soft edge: the stage is a patch of the bedroom's wall lit by the candle, not a sheet pinned to it, so the paper
// and the shadows on it fade out toward a rounded edge instead of stopping at a hard rectangle. Shared by the paper's shader
// (test-stage-view.ts) and the hands' shadow shader (shadow-shader.ts), so the shadows end where the light does.

/** How wide the fade at the stage's edge is, metres (0 is the old hard edge). */
export const STAGE_EDGE_FADE_M = 0.16;
/** How round the stage's corners are, metres. */
export const STAGE_CORNER_M = 0.32;

/**
 * GLSL: `stageEdge(p, size, fade)` is 1 inside the stage and falls to 0 at its edge across `fade` metres, round the rounded
 * corners. `p` is the point in stage metres from the centre, `size` the stage's width and height.
 */
export const stageEdgeGlsl = /* glsl */ `
  float stageEdge(vec2 p, vec2 size, float fade) {
    if (fade <= 0.0) return 1.0;
    float r = min(${STAGE_CORNER_M.toFixed(3)}, 0.5 * min(size.x, size.y));
    vec2 q = abs(p) - (0.5 * size - r);
    float inside = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r);
    return smoothstep(0.0, fade, inside);
  }
`;
