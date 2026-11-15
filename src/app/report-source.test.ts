import { describe, expect, it } from 'vitest';
import { CapabilityDetector } from '../engine/xr/capabilities';
import { fakeFrame, fakePlane, fakeRefSpace, fakeSession, IDENTITY, poseMatrix } from '../engine/xr/fake-xr';
import { createHandFrame } from '../engine/hands/hand';
import { reportSource } from './report-source';

describe('report source', () => {
  it('puts the capability object in the diagnostics report', () => {
    const detector = new CapabilityDetector();
    const session = fakeSession({ enabledFeatures: ['plane-detection'], blend: 'alpha-blend' });
    detector.sessionStarted(session);
    const planes = new Set([
      fakePlane({
        matrix: poseMatrix(0, 0.7, -0.5),
        polygon: [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      }),
    ]);
    const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
    detector.update(fakeFrame(session, { planes }), fakeRefSpace(), hands, IDENTITY, 0);

    const report = reportSource({
      handReadMethod: { fillPoses: 3, getJointPose: 0 },
      mockSource: null,
      capabilities: detector,
    });
    expect(report.capabilities).toEqual(detector.toJSON());
    expect(report).toMatchObject({ handReadMethod: { fillPoses: 3 }, mock: null });
    expect(JSON.parse(JSON.stringify(report)).capabilities.planes.status).toBe('found');
  });
});
