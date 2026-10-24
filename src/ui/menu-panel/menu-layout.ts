// Where things sit on a menu screen, and how a fingertip reaches them. The screen is drawn on a square canvas shown on
// a square quad MENU_SIZE_M across, facing the player; every position here is a fraction of it (u across from the
// left, v down from the top). Plain TypeScript: no three.js, no canvas, and nothing built per call.
import type { MenuScreen } from './screens';

/** The quad's side in the room, metres: a screen within easy reach of a seated player. */
export const MENU_SIZE_M = 0.56;
export const TITLE_V = 0.2;
export const RULE_V = 0.285;
export const LINE_V = 0.35;
export const FIRST_ITEM_V = 0.5;
/** Rows are this far apart (6 cm at the real size, so a fingertip poke is not precise work). */
export const ITEM_PITCH_V = 0.11;
/** An item is reached anywhere within this fraction of its row, either side of the text's line, and across this width. */
export const ITEM_HALF_V = ITEM_PITCH_V / 2;
export const ITEM_HALF_U = 0.34;

export function itemV(i: number): number {
  return FIRST_ITEM_V + i * ITEM_PITCH_V;
}

/** The item under (u, v), or -1. */
export function itemAt(screen: MenuScreen, u: number, v: number): number {
  if (Math.abs(u - 0.5) > ITEM_HALF_U) return -1;
  for (let i = 0; i < screen.buttons.length; i++) if (Math.abs(v - itemV(i)) <= ITEM_HALF_V) return i;
  return -1;
}

/** A plane in the room, with its unit axes and a scale. */
export interface MenuPlane {
  readonly origin: Float64Array;
  readonly right: Float64Array;
  readonly up: Float64Array;
  readonly normal: Float64Array;
}

export function createMenuPlane(): MenuPlane {
  return {
    origin: new Float64Array(3),
    right: Float64Array.of(1, 0, 0),
    up: Float64Array.of(0, 1, 0),
    normal: Float64Array.of(0, 0, 1),
  };
}

/** A fingertip is reaching when it is within this far in front of the screen (or this far through it), metres. */
export const REACH_M = 0.08;
export const THROUGH_M = 0.06;
/** It presses when it gets this close to the screen, and counts as withdrawn again past REARM_M. */
export const PRESS_M = 0.02;
export const REARM_M = 0.05;

export interface MenuInputState {
  /** The item a fingertip is reaching, or -1. */
  hover: number;
  /** The item pressed this call, or -1. */
  pressed: number;
}

/** Turns fingertips into a reached item and presses. Holds one flag (armed), and allocates nothing. */
export class MenuInput {
  readonly state: MenuInputState = { hover: -1, pressed: -1 };
  private armed = true;

  /** `tips` holds n fingertips as xyz triples in scene space. */
  update(screen: MenuScreen, plane: MenuPlane, tips: ArrayLike<number>, n: number): MenuInputState {
    const o = plane.origin,
      r = plane.right,
      u = plane.up,
      nn = plane.normal;
    let hover = -1;
    let depth = Infinity;
    for (let i = 0; i < n; i++) {
      const dx = tips[i * 3] - o[0],
        dy = tips[i * 3 + 1] - o[1],
        dz = tips[i * 3 + 2] - o[2];
      const d = dx * nn[0] + dy * nn[1] + dz * nn[2];
      if (d > REACH_M || d < -THROUGH_M) continue;
      const pu = (dx * r[0] + dy * r[1] + dz * r[2]) / MENU_SIZE_M + 0.5;
      const pv = 0.5 - (dx * u[0] + dy * u[1] + dz * u[2]) / MENU_SIZE_M;
      const item = itemAt(screen, pu, pv);
      if (item >= 0 && d < depth) {
        hover = item;
        depth = d;
      }
    }
    this.state.hover = hover;
    this.state.pressed = -1;
    if (hover < 0 || depth > REARM_M) this.armed = true;
    if (hover >= 0 && this.armed && depth <= PRESS_M) {
      this.state.pressed = hover;
      this.armed = false;
    }
    return this.state;
  }

  /** Forget a held press (the screen changed). */
  reset(): void {
    this.armed = false; // a finger already on the new screen must be withdrawn before it presses
    this.state.hover = -1;
    this.state.pressed = -1;
  }
}
