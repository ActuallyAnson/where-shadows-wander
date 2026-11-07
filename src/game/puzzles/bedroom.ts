// What the bedroom puzzles share: the height of the shelf line the traveller walks along, and small
// helpers to write a ledge, a gap, the start and the goal, and to find the next gap ahead of the
// traveller (for hints). Plain TypeScript; the layout helpers run on puzzle load, the rest build nothing.
import type { LayoutMarker } from '../../engine/sim/scene-layout';
import type { GameContext } from '../context';
import type { LevelLayout, LevelRect } from '../level';
import type { LevelProp } from '../props';
import { defaultHintAt } from '../puzzle';

/** Top of the ledges the traveller walks on (books, shelf, bed), stage metres. */
export const LEDGE_TOP = -0.26;
/** How tall a ledge's shadow is, metres. */
export const LEDGE_HEIGHT = 0.14;
/** How deep every prop is, metres: thin, so its shadow is its own size (ADR 0014). */
export const PROP_DEPTH = 0.04;

/** A box prop whose shadow is a ledge from x `left` to `right`, its top at `top` (LEDGE_TOP by default). */
export function ledge(id: string, left: number, right: number, top = LEDGE_TOP, height = LEDGE_HEIGHT): LevelProp {
  return {
    id,
    shape: 'box',
    x: (left + right) / 2,
    y: top - height / 2,
    size: [right - left, height, PROP_DEPTH],
  };
}

/** The traveller's start, standing on a ledge at x. */
export function startOn(x: number): LevelLayout['traveller'] {
  return { x, y: LEDGE_TOP + 0.05 };
}

/** The goal over a ledge at x, its top at `top`. */
export function goalOn(x: number, top = LEDGE_TOP): LevelRect {
  return { x, y: top + 0.06, width: 0.12, height: 0.2 };
}

/** A gap marker between two ledges, from x `left` to `right`, whose near ledge's top is at `top`. */
export function gapMarker(left: number, right: number, top = LEDGE_TOP): LevelRect & { readonly tag: string } {
  return { tag: 'gap', x: (left + right) / 2, y: top - GAP_MARKER_H / 2, width: right - left, height: GAP_MARKER_H };
}
const GAP_MARKER_H = 0.14;

/** The top of the ledge a gap marker was made against (gapMarker's `top`). */
export function gapTop(m: LayoutMarker): number {
  return m.y + m.params.height / 2;
}

/**
 * The next gap the traveller has not crossed yet: the nearest gap marker whose far edge is still
 * ahead of it, or null. Reads the layout only; builds nothing.
 */
export function gapAhead(ctx: GameContext): LayoutMarker | null {
  const s = ctx.traveller.slot(ctx);
  if (s < 0) return null;
  const x = ctx.store.x[s],
    dir = ctx.traveller.dir;
  let best: LayoutMarker | null = null;
  let bestD = Infinity;
  for (const m of ctx.layout.markers) {
    if (m.tag !== 'gap') continue;
    const far = m.x + (dir * m.params.width) / 2;
    if ((far - x) * dir <= 0) continue;
    const d = (m.x - x) * dir;
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

/** The ghost hint over the next gap ahead, level with its near ledge; with none left, a little ahead of the traveller. */
export function hintAtGapAhead(ctx: GameContext, out: Float64Array, dy = 0): void {
  const m = gapAhead(ctx);
  if (m) {
    out[0] = m.x;
    out[1] = gapTop(m) + dy;
    return;
  }
  defaultHintAt(ctx, out);
}
