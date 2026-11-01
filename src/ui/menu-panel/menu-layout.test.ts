import { describe, expect, it } from 'vitest';
import {
  createMenuPlane,
  GAZE_DWELL_S,
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

describe('gaze', () => {
  const screen = MENU_SCREENS.pause;
  const eye = [0, 0, 1];
  /** A ray from the eye that meets the screen at (u, v). */
  const toward = (u: number, v: number) => {
    const x = (u - 0.5) * MENU_SIZE_M;
    const y = (0.5 - v) * MENU_SIZE_M;
    const len = Math.sqrt(x * x + y * y + 1);
    return [x / len, y / len, -1 / len];
  };

  it('presses an item after a long enough look, once, and not again until the look has moved away', () => {
    const input = new MenuInput();
    const at = toward(0.5, itemV(0));
    let pressed = 0;
    for (let t = 0; t < GAZE_DWELL_S - 0.1; t += 0.05) input.gaze(screen, plane, eye, at, 0.05);
    expect(input.state.hover).toBe(0);
    expect(input.dwell).toBeGreaterThan(0.5);
    expect(input.dwell).toBeLessThan(1);
    for (let t = 0; t < 4; t += 0.05) if (input.gaze(screen, plane, eye, at, 0.05).pressed === 0) pressed++;
    expect(pressed).toBe(1);
    input.gaze(screen, plane, eye, toward(0.05, 0.05), 0.05); // away
    for (let t = 0; t < GAZE_DWELL_S + 0.2; t += 0.05)
      if (input.gaze(screen, plane, eye, at, 0.05).pressed === 0) pressed++;
    expect(pressed).toBe(2);
  });

  it('starts again when the look moves to another item, and presses nothing when it rests on empty paper', () => {
    const input = new MenuInput();
    for (let t = 0; t < 1; t += 0.05) input.gaze(screen, plane, eye, toward(0.5, itemV(0)), 0.05);
    input.gaze(screen, plane, eye, toward(0.5, itemV(1)), 0.05);
    expect(input.state.hover).toBe(1);
    expect(input.dwell).toBeLessThan(0.1);
    for (let t = 0; t < 5; t += 0.05) expect(input.gaze(screen, plane, eye, toward(0.9, 0.9), 0.05).pressed).toBe(-1);
  });

  it('does not press when looking away from the screen, or when the screen is behind', () => {
    const input = new MenuInput();
    for (let t = 0; t < 5; t += 0.05) {
      expect(input.gaze(screen, plane, eye, [0, 0, 1], 0.05).pressed).toBe(-1); // facing away from it
      expect(input.gaze(screen, plane, eye, [1, 0, 0], 0.05).pressed).toBe(-1); // parallel to it
    }
  });
});
