import { describe, expect, it } from 'vitest';
import { nearestJointGap, Sticker, STICKER_LIFE_S, TravellerMood } from './traveller-mood';

const FAR = 9;

function run(m: TravellerMood, seconds: number, x = 0, y = 0, waiting = false, solved = false, gap = FAR): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) m.update(1 / 60, x, y, waiting, solved, gap);
}

describe('TravellerMood', () => {
  it('shows nothing while the traveller walks about undisturbed', () => {
    const m = new TravellerMood();
    run(m, 3);
    expect(m.active).toBe(false);
    expect(m.alpha).toBe(0);
  });

  it('is sad after a fall (the traveller reappears elsewhere)', () => {
    const m = new TravellerMood();
    run(m, 0.5, 0.4, -0.2);
    run(m, 0.1, -0.75, -0.05);
    expect(m.sticker).toBe(Sticker.Sad);
    expect(m.x).toBe(-0.75);
  });

  it('is happy when the puzzle is solved, and takes over a smaller sticker', () => {
    const m = new TravellerMood();
    run(m, 0.2, 0.6, 0, false, false, 0.05); // a hand surprises them first
    expect(m.sticker).toBe(Sticker.Surprised);
    run(m, 0.1, 0.6, 0, false, true);
    expect(m.sticker).toBe(Sticker.Happy);
  });

  it('is surprised once when a hand comes close, then not again until things calm down', () => {
    const m = new TravellerMood();
    run(m, 0.1, 0, 0, false, false, 0.05);
    expect(m.sticker).toBe(Sticker.Surprised);
    run(m, STICKER_LIFE_S + 0.1, 0, 0, false, false, 0.05); // the hand stays, the sticker goes
    expect(m.active).toBe(false);
    run(m, 0.1, 0, 0, false, false, FAR);
    run(m, 0.1, 0, 0, false, false, 0.05); // back again within the cooldown
    expect(m.active).toBe(false);
    run(m, 4, 0, 0, false, false, FAR);
    run(m, 0.1, 0, 0, false, false, 0.05);
    expect(m.sticker).toBe(Sticker.Surprised);
  });

  it('looks puzzled after a long wait, and does not nag at once', () => {
    const m = new TravellerMood();
    run(m, 5.5, 0, 0, true);
    expect(m.active).toBe(false);
    run(m, 1, 0, 0, true);
    expect(m.sticker).toBe(Sticker.Puzzled);
    run(m, STICKER_LIFE_S + 0.1, 0, 0, true);
    expect(m.active).toBe(false);
  });

  it('starts the wait over when they walk again', () => {
    const m = new TravellerMood();
    run(m, 5, 0, 0, true);
    run(m, 0.1, 0, 0, false);
    run(m, 5, 0, 0, true);
    expect(m.active).toBe(false);
  });

  it('pops in, holds, fades out, and follows the traveller', () => {
    const m = new TravellerMood();
    m.show(Sticker.Happy, 0, 0);
    expect(m.alpha).toBe(0);
    run(m, 0.5, 0.2, 0.1);
    expect(m.alpha).toBe(1);
    expect(m.scale).toBe(1);
    expect([m.x, m.y]).toEqual([0.2, 0.1]);
    run(m, STICKER_LIFE_S - 0.5 - 0.2, 0.2, 0.1);
    expect(m.alpha).toBeLessThan(1);
    run(m, 0.5, 0.2, 0.1);
    expect(m.active).toBe(false);
  });

  it('measures the nearest joint', () => {
    const joints = new Float32Array([1, 0, 0.3, 0.4, -2, 2]);
    expect(nearestJointGap(joints, 3, 0, 0)).toBeCloseTo(0.5);
    expect(nearestJointGap(joints, 0, 0, 0)).toBeGreaterThan(1e8);
  });
});
