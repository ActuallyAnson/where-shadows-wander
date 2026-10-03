// Times each stage of the per-frame hand pipeline (`npm run perf`). Desktop
// numbers are only a guide: a headset CPU is several times slower, so read them
// against the budgets in docs/ARCHITECTURE.md (headset budget divided by 4):
// reading hands 0.1 ms, shapes + gestures 0.175 ms, shadow 0.225 ms per frame.
import { bench, describe } from 'vitest';
import { GestureDetector } from '../../hands/gesture-detector';
import { createHandFrame, type Handedness, type HandFrame } from '../../hands/hand';
import { ShapeRecognizer } from '../../hands/shape-recognizer';
import { PRESETS, writeHandPose } from '../../hands/synthetic-hand';
import { ShadowProjector } from './shadow-projector';
import { createStagePlane } from './stage-plane';

const hands: Record<Handedness, HandFrame> = { left: createHandFrame('left'), right: createHandFrame('right') };
writeHandPose(PRESETS.rabbit, [-0.1, 0.95, -0.4], hands.left);
writeHandPose(PRESETS.flat, [0.1, 0.95, -0.4], hands.right);
const shapes = new ShapeRecognizer();
const gestures = new GestureDetector();
gestures.setLantern([0, 0.65, -0.2]);
const projector = new ShadowProjector();
const stage = createStagePlane();
stage.origin.set([0, 0.75, -0.75]);
const lantern: [number, number, number] = [0, 0.65, -0.2];
let t = 0;

describe('per-frame hand pipeline, both hands', () => {
  bench('shape recognizer', () => {
    shapes.update(hands, (t += 1 / 72));
  });
  bench('shape recognizer + gesture detector', () => {
    shapes.update(hands, (t += 1 / 72));
    gestures.update(hands, t, shapes);
  });
  bench('shadow projector', () => {
    projector.update(hands, stage, lantern);
  });
});
