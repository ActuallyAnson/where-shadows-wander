// Mock mode (?mock=1): drives the game's hands from a HandSource instead of a
// headset, so the game runs at a desk. Options:
//   ?mock=1                         synthetic hands, keyboard controlled (default)
//   ?mock=1&src=script              every v1 shape on each hand, in a loop
//   ?mock=1&src=replay&file=<url>   a .handrec.json (default: the emulator demo)
//   ?mock=1&src=webcam              live hands from the webcam (MediaPipe)
// Dropping a .handrec.json onto the page switches to replaying it.
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

/** Reads mock mode options from a query string; null when mock mode is off. */
export function mockOptionsFromUrl(search: string): MockOptions | null {
  const params = new URLSearchParams(search);
  const mock = params.get('mock');
  if (mock === null || mock === '0' || mock === 'false') return null;
  const src = params.get('src') ?? 'synthetic';
  return {
    source: (MOCK_SOURCES as readonly string[]).includes(src) ? (src as MockSourceKind) : 'synthetic',
    file: params.get('file') ?? DEFAULT_REPLAY,
  };
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
