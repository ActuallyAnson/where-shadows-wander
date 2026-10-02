// Cuts a small piece out of a recording for a regression fixture: one hand,
// a time range, labels clipped to it. Plain TypeScript: no IWSDK, no three.js.
import type { Handedness } from './hand';
import type { HandRecording } from './hand-recording';

/**
 * The frames of `rec` from `start` to `end` seconds, re-timed to start at 0,
 * with the other hand removed and labels for `hand` clipped to the range.
 */
export function trimRecording(rec: HandRecording, start: number, end: number, hand: Handedness): HandRecording {
  const other = hand === 'left' ? 'right' : 'left';
  const otherIndex = other === 'left' ? 0 : 1;
  const ms = (t: number) => Math.round(t * 1000) / 1000;
  return {
    ...rec,
    note: `${rec.note} [trimmed ${start}-${end} s, ${hand} hand]`,
    labels: rec.labels
      .filter((l) => l.hand === hand && l.end > start && l.start < end)
      .map((l) => ({ ...l, start: ms(Math.max(l.start, start) - start), end: ms(Math.min(l.end, end) - start) })),
    frames: rec.frames
      .filter((f) => f.t >= start && f.t <= end)
      .map((f) => {
        const valid: [number, number] = [...f.valid];
        valid[otherIndex] = 0;
        return { ...f, t: ms(f.t - start), [other]: null, valid };
      }),
  };
}
