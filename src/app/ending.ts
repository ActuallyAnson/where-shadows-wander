// The ending cutscene: the candle burns low, the spirit fox flies to the traveller, the traveller cheers and the room settles
// into sleep. Data for the cutscene player (src/engine/sim/cutscene.ts); the puppets are drawn in code (fox-art.ts and
// traveller-art.ts). The game flow plays it after the last puzzle; the room's mood cools while it plays. Plain TypeScript.
import type { CutsceneData } from '../engine/sim/cutscene';

export const ENDING: CutsceneData = {
  id: 'ending',
  beats: [
    { kind: 'caption', at: 0.5, duration: 4, text: 'The candle burns low.' },
    { kind: 'puppet', at: 1, duration: 5, puppet: 'traveller-wait', from: [-0.4, -0.16], to: [-0.4, -0.16] },
    { kind: 'puppet', at: 2, duration: 8.5, puppet: 'fox-flying', from: [0.55, 0.12], to: [-0.12, -0.04] },
    { kind: 'caption', at: 5.5, duration: 4.5, text: 'The light found its way home.' },
    { kind: 'puppet', at: 6, duration: 4.5, puppet: 'traveller-cheer', from: [-0.4, -0.16], to: [-0.4, -0.16] },
    { kind: 'caption', at: 10.5, duration: 4.5, text: 'Sleep well.' },
  ],
};

/** The room's mood (0 cold .. 1 warm) the ending settles to: dim and quiet, not dark. */
export const ENDING_MOOD = 0.3;
