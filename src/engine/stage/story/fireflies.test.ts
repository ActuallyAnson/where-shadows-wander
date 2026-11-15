import { describe, expect, it } from 'vitest';
import { ScenePlayer } from '../puppet/scene-player';
import { BOY_HAND, FRIEND_HAND, GATHER_S, HANDOVER_S, JAR_HANDED } from './fireflies';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

const player = new ScenePlayer(STORY_STAGE);
const start = STORY_CHAPTER['fireflies'].start;
/** A part's place on the wall, its angle and how visible it is, at `t` seconds into the fireflies chapter. */
function at(id: string, t: number): { x: number; y: number; angle: number; opacity: number } {
  player.seek(start + t);
  const o = STORY_STAGE.parts.findIndex((q) => q.id === id) * 5;
  expect(o, id).toBeGreaterThanOrEqual(0);
  const w = player.world;
  return { x: w[o], y: w[o + 1], angle: w[o + 2], opacity: w[o + 4] };
}

describe('fireflies', () => {
  it('brings the fireflies to where the lying kids’ raised hands are', () => {
    const f = at('run-friend-hand-glow', GATHER_S + 1);
    const b = at('run-boy-hand-glow', GATHER_S + 1);
    expect(Math.hypot(f.x - FRIEND_HAND[0], f.y - FRIEND_HAND[1])).toBeLessThan(0.01);
    expect(Math.hypot(b.x - BOY_HAND[0], b.y - BOY_HAND[1])).toBeLessThan(0.01);
  });

  it('passes the jar from her hand to his where their hands meet, upright, without it jumping', () => {
    const hers = at('park-friend-jar', HANDOVER_S - 0.01);
    const his = at('park-boy-jar', HANDOVER_S + 0.01);
    expect(Math.hypot(hers.x - his.x, hers.y - his.y)).toBeLessThan(0.005);
    expect(Math.hypot(hers.x - JAR_HANDED[0], hers.y - JAR_HANDED[1])).toBeLessThan(0.005);
    expect(hers.opacity).toBeGreaterThan(0.9);
    expect(his.opacity).toBeGreaterThan(0.9);
    // Upright the whole way, in her hands and in his (but for the sitting kids' breathing sway, a hundredth of a radian).
    for (let t = HANDOVER_S - 2; t < HANDOVER_S + 2; t += 0.1) {
      expect(Math.abs(at('park-friend-jar', t).angle), `hers at ${t}`).toBeLessThan(0.012);
      expect(Math.abs(at('park-boy-jar', t).angle), `his at ${t}`).toBeLessThan(0.012);
    }
  });
});
