// Decides which detected webcam hand is the left and which is the right.
// MediaPipe labels each hand, but the label sometimes flips for a frame or two
// (a recording showed the right hand jumping 28 cm onto the left hand's spot).
// Hands can't teleport, so when a recent position is known, each hand keeps the
// side it was on a moment ago; the label only decides when there's no history.
import type { Handedness, Vec3 } from '../engine/hands/hand';

/** How long a hand's last position is trusted after it was last seen. */
const MEMORY_MS = 300;
/** A label is overridden only when going against it is this much closer (metres). */
const OVERRIDE_MARGIN_M = 0.05;

export class HandAssigner {
  private readonly last: Record<Handedness, { pos: Vec3; at: number } | null> = { left: null, right: null };

  /**
   * @param labels MediaPipe's handedness label per detected hand
   * @param wrists each detected hand's wrist position, in the same order
   * @returns the side to use for each detected hand; never the same side twice
   */
  assign(labels: readonly Handedness[], wrists: readonly Vec3[], nowMs: number): Handedness[] {
    const recent = (side: Handedness) => {
      const l = this.last[side];
      return l && nowMs - l.at <= MEMORY_MS ? l.pos : null;
    };
    const prev = { left: recent('left'), right: recent('right') };
    let sides: Handedness[];

    if (labels.length === 1) {
      const label = labels[0];
      const other = opposite(label);
      // Flip only if the hand is clearly where the other hand just was.
      const toOther = prev[other] ? dist(wrists[0], prev[other]) : Infinity;
      const toLabel = prev[label] ? dist(wrists[0], prev[label]) : Infinity;
      sides = [toOther + OVERRIDE_MARGIN_M < toLabel ? other : label];
    } else if (labels.length >= 2) {
      const byLabel: Handedness[] = labels[0] === labels[1] ? [labels[0], opposite(labels[0])] : [labels[0], labels[1]];
      const swapped: Handedness[] = [byLabel[1], byLabel[0]];
      sides = cost(swapped, wrists, prev) + OVERRIDE_MARGIN_M < cost(byLabel, wrists, prev) ? swapped : byLabel;
    } else {
      sides = [];
    }

    sides.forEach((side, i) => (this.last[side] = { pos: [...wrists[i]], at: nowMs }));
    return sides;
  }
}

/** Total distance from each hand to where its side was last seen; unknown sides cost nothing. */
function cost(sides: readonly Handedness[], wrists: readonly Vec3[], prev: Record<Handedness, Vec3 | null>): number {
  let total = 0;
  for (let i = 0; i < 2; i++) {
    const p = prev[sides[i]];
    if (p) total += dist(wrists[i], p);
  }
  return total;
}

function opposite(side: Handedness): Handedness {
  return side === 'left' ? 'right' : 'left';
}

function dist(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
