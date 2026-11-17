import { describe, expect, it } from 'vitest';
import { ScenePlayer } from '../puppet/scene-player';
import {
  BOY_FACING,
  BOY_LIES_X,
  BOY_START_X,
  FRIEND_LIES_X,
  FRIEND_START_X,
  THE_PARK_LENGTH_S,
  WALK_PACE_M_S,
} from './the-park';
import { KID_SCALE } from './story-kit';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

const player = new ScenePlayer(STORY_STAGE);
const start = STORY_CHAPTER['the-park'].start;
const index = new Map(STORY_STAGE.parts.map((p, i) => [p.id, i]));
/** A part's place on the wall, its angle and how visible it is, `t` seconds into the park chapter. */
function at(id: string, t: number): { x: number; y: number; angle: number; opacity: number } {
  player.seek(start + t);
  const o = (index.get(id) as number) * 5;
  expect(o, id).toBeGreaterThanOrEqual(0);
  const w = player.world;
  return { x: w[o], y: w[o + 1], angle: w[o + 2], opacity: w[o + 4] };
}
/** The first time `id` is at least half there. */
function firstSeen(id: string): number {
  for (let t = 0; t < THE_PARK_LENGTH_S; t += 0.05) if (at(id, t).opacity > 0.5) return t;
  throw new Error(`${id} never appears`);
}

describe('the park: the kids walk on from the left, turn and lie down', () => {
  it('has them come on at the wall’s left edge, inside the wall, the boy first and then the friend', () => {
    expect(BOY_START_X).toBeLessThan(-0.5);
    expect(FRIEND_START_X).toBeLessThan(BOY_START_X);
    expect(FRIEND_START_X).toBeGreaterThan(-0.8); // inside the wall's half-width
    expect(firstSeen('come-boy')).toBeLessThan(firstSeen('run-friend'));
    const t = firstSeen('run-friend');
    expect(at('run-friend', t).x).toBeLessThan(-0.6);
    // Nothing of them stands in the middle of the wall as the animals go: they are not the animals turned into kids.
    expect(at('run-friend', 7.5).opacity).toBe(0);
    expect(at('come-boy', 7.5).opacity).toBe(0);
  });

  it('walks them right at one steady pace, so the stance foot does not skate on the ground', () => {
    const t0 = firstSeen('come-boy') + 1.2;
    const t1 = t0 + 1.8;
    const pace = (at('come-boy', t1).x - at('come-boy', t0).x) / (t1 - t0);
    expect(pace).toBeCloseTo(WALK_PACE_M_S, 2);
    // The feet: a stance foot moves back along the wall as fast as the kid moves forward (a leg is 0.1 * KID_SCALE long).
    const foot = (t: number): number => {
      const kid = at('come-boy', t);
      const leg = at('come-boy-leg-front', t);
      return kid.x + (leg.x - kid.x) + 0.1 * KID_SCALE * Math.sin(-leg.angle);
    };
    // Over a whole stride the feet come back to where they were relative to the kid: the average pace of the body is the pace.
    expect(foot(t0 + 0.9) - foot(t0)).toBeCloseTo(WALK_PACE_M_S * 0.9, 1);
  });

  it('turns him round to face her once he has stopped: the other way about, a quick cross-fade, in the same place', () => {
    let turned = -1;
    for (let t = 0; t < THE_PARK_LENGTH_S; t += 0.05) if (at('run-boy', t).opacity > 0.5 && turned < 0) turned = t;
    expect(turned).toBeGreaterThan(firstSeen('run-friend') + 2);
    const before = at('come-boy', turned - 0.5);
    const after = at('run-boy', turned + 0.5);
    expect(after.x).toBeCloseTo(before.x, 1);
    expect(BOY_FACING).toBe(-1);
    expect(at('come-boy', turned + 0.5).opacity).toBeLessThan(0.05);
  });

  it('has no pushing: her arms never reach forward to him while they walk or stand', () => {
    const arrived = firstSeen('run-boy');
    for (let t = firstSeen('run-friend'); t < arrived + 0.8; t += 0.1) {
      // Hanging down (about -2.95 rad) and swinging a little: never raised forward toward a quarter turn.
      expect(
        Math.abs(at('run-friend-arm-front', t).angle - (at('run-friend', t).angle - 2.95)),
        `at ${t}`,
      ).toBeLessThan(0.9);
    }
  });

  it('ends with them lying head to head, her head to the left and his to the right, their bodies clear of each other', () => {
    const t = THE_PARK_LENGTH_S - 2.5;
    const hers = { head: at('run-friend-head', t).x, feet: at('run-friend-leg-front', t).x };
    const his = { head: at('run-boy-head', t).x, feet: at('run-boy-leg-front', t).x };
    expect(hers.head).toBeLessThan(FRIEND_LIES_X - 0.2);
    expect(his.head).toBeGreaterThan(BOY_LIES_X + 0.2);
    // Her feet and his feet are the middle of the picture, with a gap between: no one lies over the other.
    expect(his.feet).toBeGreaterThan(hers.feet);
    expect(his.feet - hers.feet).toBeGreaterThan(0.05);
    expect(Math.abs(hers.head)).toBeLessThan(0.8);
    expect(Math.abs(his.head)).toBeLessThan(0.8);
    // Lying flat on the grass, not standing: both heads low on the wall.
    expect(at('run-friend-head', t).y).toBeLessThan(0);
    expect(at('run-boy-head', t).y).toBeLessThan(0);
  });
});
