// Keeps the game running when one part of it throws. The XR frame loop is not protected by the browser or by
// IWSDK: an exception inside it stops the next frame being scheduled, so the headset freezes for the rest of the
// session. main.ts wraps each part of the frame, and each step of a session start or end, in a try/catch that
// reports here, so a failing part is skipped (and counted) and everything else carries on.
//
// Only the first failure of each kind is reported in words (a part that fails every frame would otherwise bury the
// diagnostics log); the counts show how often it happened. Nothing here runs unless something failed.

export class FailureReporter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly onFirst: (message: string) => void) {}

  report(label: string, error: unknown): void {
    const n = (this.counts.get(label) ?? 0) + 1;
    this.counts.set(label, n);
    if (n === 1) this.onFirst(`${label} failed (further failures of it are only counted): ${describe(error)}`);
  }

  /** How many times each part failed, for the diagnostics report. */
  toJSON(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return String(error);
  } catch {
    return 'unprintable error';
  }
}
