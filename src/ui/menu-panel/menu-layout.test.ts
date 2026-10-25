import { describe, expect, it } from 'vitest';
import {
  createMenuPlane,
  ITEM_PITCH_V,
  itemAt,
  itemV,
  MENU_SIZE_M,
  MenuInput,
  PRESS_M,
  REACH_M,
  REARM_M,
} from './menu-layout';
import { MENU_SCREENS } from './screens';

const pause = MENU_SCREENS.pause;
const plane = createMenuPlane(); // at the origin, facing +z; right +x, up +y

/** A fingertip over item i, `depth` in front of the screen. */
function tip(i: number, depth: number, du = 0): number[] {
  return [du * MENU_SIZE_M, (0.5 - itemV(i)) * MENU_SIZE_M, depth];
}

describe('itemAt', () => {
  it('finds each row and nothing between the text and the edges', () => {
    pause.buttons.forEach((_, i) => expect(itemAt(pause, 0.5, itemV(i))).toBe(i));
    expect(itemAt(pause, 0.5, 0.1)).toBe(-1);
    expect(itemAt(pause, 0.02, itemV(0))).toBe(-1);
  });

  it('makes each row at least 4 cm tall to poke', () => {
    expect(ITEM_PITCH_V * MENU_SIZE_M).toBeGreaterThanOrEqual(0.04);
  });
});

describe('MenuInput', () => {
  it('hovers the item a fingertip is over, once it is within reach', () => {
    const input = new MenuInput();
    expect(input.update(pause, plane, tip(1, REACH_M + 0.01), 1).hover).toBe(-1);
    expect(input.update(pause, plane, tip(1, REACH_M - 0.01), 1).hover).toBe(1);
  });

  it('presses once as the fingertip reaches the screen, not again until it is withdrawn', () => {
    const input = new MenuInput();
    expect(input.update(pause, plane, tip(0, 0.04), 1).pressed).toBe(-1);
    expect(input.update(pause, plane, tip(0, PRESS_M - 0.005), 1).pressed).toBe(0);
    expect(input.update(pause, plane, tip(0, 0.0), 1).pressed).toBe(-1);
    input.update(pause, plane, tip(0, REARM_M + 0.01), 1);
    expect(input.update(pause, plane, tip(0, 0.0), 1).pressed).toBe(0);
  });

  it('ignores a fingertip far behind the screen and off the items', () => {
    const input = new MenuInput();
    expect(input.update(pause, plane, tip(0, -0.2), 1).hover).toBe(-1);
    expect(input.update(pause, plane, tip(0, 0.01, 0.45), 1).hover).toBe(-1);
  });

  it('takes the nearest of several fingertips', () => {
    const input = new MenuInput();
    const t = [...tip(0, 0.07), ...tip(2, 0.03)];
    expect(input.update(pause, plane, t, 2).hover).toBe(2);
  });

  it('does not press from a finger that was already on the screen when it appeared', () => {
    const input = new MenuInput();
    input.reset();
    expect(input.update(pause, plane, tip(0, 0.0), 1).pressed).toBe(-1);
  });
});
