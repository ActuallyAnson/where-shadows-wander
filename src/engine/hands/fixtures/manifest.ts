// Regression fixtures for the shape classifier: small labelled clips that once
// went wrong, with the result they must keep giving. Cut new ones from a
// recording with `EVAL_EXTRACT=<file>:<hand>:<start>-<end>:<name> npm run eval`.
// Keep each under 256 KB (one hand, a few seconds) and the folder under 2 MB.

export interface FixtureExpectation {
  /** Lowest accepted frame accuracy over the clip's labels (0..1). */
  minAccuracy?: number;
  /** Every shape label in the clip must be committed in time. */
  allHit?: boolean;
  maxFalseCommits: number;
  maxFlicker?: number;
}

export interface Fixture {
  file: string;
  /** What went wrong, and the fix that made it pass. */
  why: string;
  expect: FixtureExpectation;
}

export const FIXTURES: readonly Fixture[] = [
  {
    file: 'synthetic-fox-4mm-noise.handrec.json',
    why:
      'Synthetic fox (L thumb, palm sideways) with 1.5 mm of joint noise at 30 fps (webcam-like). Noise pushed the ' +
      'mean curl over its limit for single frames, which restarted the 1 s hold, so fox never committed. Fixed by holdSlack. ' +
      'Regenerated when fox gained a palm-direction range: the first version had the palm facing down, which is also a flat hand.',
    expect: { minAccuracy: 0.9, allHit: true, maxFalseCommits: 0, maxFlicker: 0 },
  },
];
