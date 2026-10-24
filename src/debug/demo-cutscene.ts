// A short test cutscene for the Hand Lab Cutscene button and the Testing switch: a bird crosses the wall under one caption. Dev and tester builds only.
import type { CutsceneData } from '../engine/sim/cutscene';

export const DEMO_CUTSCENE: CutsceneData = {
  id: 'demo',
  beats: [
    { kind: 'caption', at: 0.5, duration: 5, text: 'Where shadows wander' },
    { kind: 'puppet', at: 1, duration: 7, puppet: 'bird', from: [-0.25, 0.05], to: [0.25, 0.12] },
  ],
};
