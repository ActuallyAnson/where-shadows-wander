// Mock hands (the Hand Lab, chosen on the page: src/app/launch-mode.ts, ADR 0018): drives the
// game's hands from a HandSource instead of the device's, in the game's own session.
// The sources:
//   synthetic   hands you pose with buttons or keys (the default)
//   script      every v1 shape on each hand, in a loop
//   replay      a .handrec.json (the emulator demo, or a file dropped on the page)
//   webcam      live hands from the webcam (MediaPipe)
// The Hand Lab panel (hand-lab.ts) switches sources at runtime.
import type { HandFrame } from '../engine/hands/hand';
import type { HandSource } from './hand-source';
import { loadReplay } from './replay-source';
import { ScriptedSource } from './scripted-source';
import { SyntheticSource } from './synthetic-source';

export const MOCK_SOURCES = ['synthetic', 'script', 'replay', 'webcam'] as const;
export type MockSourceKind = (typeof MOCK_SOURCES)[number];

export interface MockOptions {
  source: MockSourceKind;
  /** Recording URL for the replay source. */
  file: string;
}

const DEFAULT_REPLAY = 'recordings/emulator-demo.handrec.json';
/** Longest frame mock time advances by, matching the sim loop's cap. */
const MAX_FRAME_S = 0.25;

/** The options for starting mock mode with `source` (a replay plays the emulator demo). */
export function mockOptionsFor(source: MockSourceKind): MockOptions {
  return { source, file: DEFAULT_REPLAY };
}

export async function createMockSource(options: MockOptions): Promise<HandSource> {
  switch (options.source) {
    case 'script':
      return new ScriptedSource();
    case 'replay':
      return loadReplay(options.file);
    case 'webcam': {
      const { WebcamSource } = await import('./webcam-source');
      return WebcamSource.start();
    }
    default:
      return new SyntheticSource();
  }
}

export class MockMode {
  /** Seconds of mock time; stops while paused. Sources are driven by this, not the wall clock. */
  time = 0;
  paused = false;

  constructor(public source: HandSource) {}

  setSource(source: HandSource): void {
    if (source === this.source) return;
    this.source.dispose?.();
    this.source = source;
    this.time = 0;
  }

  /** Call once per display frame with its length in seconds. */
  update(delta: number, left: HandFrame, right: HandFrame): void {
    if (!this.paused) this.time += Math.min(Math.max(delta, 0), MAX_FRAME_S);
    this.source.update(this.time, left, right);
  }
}
