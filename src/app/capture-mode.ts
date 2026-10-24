// Capture mode (?capture): a clean headset session for recording the demo video. It keeps the non-diegetic messages
// out of the picture (the "Show me your hands" panel would appear whenever tracking drops mid-take), turns the
// headset's foveated rendering off (a recording shows its blurred edges), and can render at a higher resolution for a
// crisper capture. It costs frame time, so it is for taking video, not for playing. Plain TypeScript.

export interface CaptureOptions {
  enabled: boolean;
  /** Foveation level, 0 (none, the sharpest picture) to 1 (the most blur at the edges). Capture defaults to 0. */
  foveation: number;
  /** Render scale for the eye buffers (WebXR framebuffer scale factor), 1 to 2, or null to leave the default. */
  scale: number | null;
}

export const NO_CAPTURE: Readonly<CaptureOptions> = { enabled: false, foveation: 0, scale: null };

const MAX_SCALE = 2;

/**
 * Reads ?capture, ?foveation=0..1 and ?scale=1..2 from an address's query string. `foveation` and `scale` only count
 * with ?capture on, and a value that is not a number, or is out of range, is clamped (an empty one is ignored).
 */
export function captureFromUrl(search: string): CaptureOptions {
  const p = new URLSearchParams(search);
  if (!p.has('capture')) return { ...NO_CAPTURE };
  const number = (key: string): number | null => {
    const raw = p.get(key);
    if (raw === null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  const foveation = number('foveation');
  const scale = number('scale');
  return {
    enabled: true,
    foveation: foveation === null ? 0 : Math.min(Math.max(foveation, 0), 1),
    scale: scale === null ? null : Math.min(Math.max(scale, 1), MAX_SCALE),
  };
}
