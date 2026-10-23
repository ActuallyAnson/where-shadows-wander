// A few invisible props in front of the stage, for looking at their shadows (?debug=props, dev and tester builds only):
// a bed-sized box, a ball and a lamp-sized cylinder, at different depths so their edges differ in softness.
// Positions are stage-local (x along the stage's right, y up, depth in front of the stage) turned into scene space.
import type { Prop } from '../engine/shadow/pure/prop-shadow';
import type { StagePlane } from '../engine/shadow/pure/stage-plane';

const IDENTITY: readonly number[] = [0, 0, 0, 1];
// prettier-ignore
const SPEC: readonly { shape: Prop['shape']; x: number; y: number; depth: number; size: number[] }[] = [
  { shape: 'box', x: -0.45, y: -0.3, depth: 0.5, size: [0.5, 0.12, 0.2] },
  { shape: 'sphere', x: 0.05, y: -0.05, depth: 0.8, size: [0.09] },
  { shape: 'cylinder', x: 0.5, y: -0.25, depth: 0.6, size: [0.07, 0.3] },
];

export function demoProps(stage: StagePlane): Prop[] {
  return SPEC.map((s) => ({
    shape: s.shape,
    position: [
      stage.origin[0] + stage.right[0] * s.x + stage.up[0] * s.y + stage.normal[0] * s.depth,
      stage.origin[1] + stage.right[1] * s.x + stage.up[1] * s.y + stage.normal[1] * s.depth,
      stage.origin[2] + stage.right[2] * s.x + stage.up[2] * s.y + stage.normal[2] * s.depth,
    ],
    size: s.size,
    rotation: IDENTITY,
  }));
}
