// The opening that plays when a headset session starts: the title appears on the wall, a spirit fox (the kindred) drifts in
// out of the dark, then it fades with the last line. It is a cutscene (skippable); this file holds its data and the fox's
// fade. Plain TypeScript.
import type { CutsceneData } from '../engine/sim/cutscene';

export const OPENING: CutsceneData = {
  id: 'opening',
  beats: [
    { kind: 'caption', at: 1, duration: 5.5, text: 'Where Shadows Wander' },
    { kind: 'caption', at: 7, duration: 4, text: 'Hold your hands to the light' },
  ],
};

/** Seconds the fox takes to appear and to leave. */
const FOX_IN_S = 2;
const FOX_OUT_S = 2.5;
export const OPENING_S = 11.5;

/** How visible the kindred is `t` seconds into the opening, 0..1. */
export function openingFoxAlpha(t: number): number {
  if (t <= 0 || t >= OPENING_S) return 0;
  return Math.min(1, t / FOX_IN_S, (OPENING_S - t) / FOX_OUT_S);
}
