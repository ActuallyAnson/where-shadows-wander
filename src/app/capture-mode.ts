// Capture mode: a clean headset session for recording the demo video. It keeps the non-diegetic messages out of the
// picture (the "Show me your hands" panel would appear whenever tracking drops mid-take), turns the headset's foveated
// rendering off (a recording shows its blurred edges), and can render at a higher resolution for a crisper capture. It
// costs frame time, so it is for taking video, not for playing.
//
// It is switched without an address option, and works in the judges' build too: five quick taps on the title screen's
// emblem step through off, clean and sharp (it is remembered in the browser, and the page reloads to apply it); the
// tester build's Testing panel has the same switch. Plain TypeScript.

export interface CaptureOptions {
  enabled: boolean;
  /** Foveation level, 0 (none, the sharpest picture) to 1 (the most blur at the edges). Capture defaults to 0. */
  foveation: number;
  /** Render scale for the eye buffers (WebXR framebuffer scale factor), 1 to 2, or null to leave the default. */
  scale: number | null;
}

export const NO_CAPTURE: Readonly<CaptureOptions> = { enabled: false, foveation: 0, scale: null };

export type CaptureChoice = 'off' | 'clean' | 'sharp';
export const CAPTURE_CHOICES: readonly CaptureChoice[] = ['off', 'clean', 'sharp'];

/** clean: no foveation, the default resolution. sharp: no foveation and 1.5 times the resolution (check it holds the frame rate first). */
export function captureOptions(choice: CaptureChoice): CaptureOptions {
  if (choice === 'clean') return { enabled: true, foveation: 0, scale: null };
  if (choice === 'sharp') return { enabled: true, foveation: 0, scale: 1.5 };
  return { ...NO_CAPTURE };
}

export function nextCapture(choice: CaptureChoice): CaptureChoice {
  return CAPTURE_CHOICES[(CAPTURE_CHOICES.indexOf(choice) + 1) % CAPTURE_CHOICES.length];
}

export const CAPTURE_KEY = 'wsw.capture';

/** The part of localStorage this uses. */
export interface CaptureStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): CaptureStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage; // reading the property can throw when blocked
  } catch {
    return null;
  }
}

/** The remembered choice ('off' if there is none, or the storage is blocked or holds something else). */
export function loadCaptureChoice(storage: CaptureStorage | null = browserStorage()): CaptureChoice {
  try {
    const raw = storage?.getItem(CAPTURE_KEY);
    return (CAPTURE_CHOICES as readonly (string | null | undefined)[]).includes(raw) ? (raw as CaptureChoice) : 'off';
  } catch {
    return 'off';
  }
}

/** Remembers the choice. Returns false if the storage refused. */
export function saveCaptureChoice(choice: CaptureChoice, storage: CaptureStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(CAPTURE_KEY, choice);
    return true;
  } catch {
    return false;
  }
}
