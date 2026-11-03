import { describe, expect, it } from 'vitest';
import {
  ARRIVAL_S,
  arrivalAt,
  createArrivalState,
  createWakingState,
  ROAD_END_M,
  START_Z,
  STAND_S,
  TURN_S,
  WAKING_S,
  wakingAt,
} from './walk-timeline';

describe('the arrival', () => {
  const s = createArrivalState();

  it('stands, turns in a quick hop, then walks the road and stops short of its end', () => {
    expect(arrivalAt(0, s).look).toBe('stand');
    expect(arrivalAt(STAND_S + TURN_S * 0.25, s).look).toBe('hop');
    expect(s.hop).toBeGreaterThan(0.5);
    expect(arrivalAt(STAND_S + TURN_S * 0.75, s).look).toBe('turned');
    expect(arrivalAt(STAND_S + TURN_S + 2, s).look).toBe('walk');
    expect(arrivalAt(ARRIVAL_S, s).done).toBe(true);
    expect(s.z).toBeLessThan(ROAD_END_M);
    expect(s.z).toBeGreaterThan(ROAD_END_M - 2);
  });

  it('only ever goes forward, and the turn is quick (a fraction of a second)', () => {
    let last = START_Z - 1;
    for (let t = -1; t < ARRIVAL_S + 1; t += 0.05) {
      arrivalAt(t, s);
      expect(s.z).toBeGreaterThanOrEqual(last);
      last = s.z;
    }
    expect(TURN_S).toBeLessThan(0.4);
  });
});

describe('the waking', () => {
  const s = createWakingState();

  it('is asleep at first, flashes, and ends fully awake', () => {
    expect(wakingAt(0, s).wake).toBe(0);
    let peak = 0;
    for (let t = 0; t < WAKING_S; t += 0.02) peak = Math.max(peak, wakingAt(t, s).flash);
    expect(peak).toBeGreaterThan(0.9);
    expect(wakingAt(WAKING_S, s).wake).toBe(1);
    expect(s.done).toBe(true);
  });
});
