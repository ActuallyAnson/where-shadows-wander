// What the bedroom puzzles share: the height of the shelf line the traveller walks along, and small
// helpers to write a ledge, the start and the goal. Plain TypeScript; used on puzzle load only.
import type { LevelLayout, LevelRect } from '../level';
import type { LevelProp } from '../props';

/** Top of the ledges the traveller walks on (books, shelf, bed), stage metres. */
export const LEDGE_TOP = -0.26;
/** How tall a ledge's shadow is, metres. */
export const LEDGE_HEIGHT = 0.14;
/** How deep every prop is, metres: thin, so its shadow is its own size (ADR 0014). */
export const PROP_DEPTH = 0.04;

/** A box prop whose shadow is a ledge from x `left` to `right`, its top at LEDGE_TOP. */
export function ledge(id: string, left: number, right: number): LevelProp {
  return {
    id,
    shape: 'box',
    x: (left + right) / 2,
    y: LEDGE_TOP - LEDGE_HEIGHT / 2,
    size: [right - left, LEDGE_HEIGHT, PROP_DEPTH],
  };
}

/** The traveller's start, standing on a ledge at x. */
export function startOn(x: number): LevelLayout['traveller'] {
  return { x, y: LEDGE_TOP + 0.05 };
}

/** The goal over a ledge at x. */
export function goalOn(x: number): LevelRect {
  return { x, y: LEDGE_TOP + 0.06, width: 0.12, height: 0.2 };
}
