import { describe, expect, it } from 'vitest';
import { ScenePlayer } from '../puppet/scene-player';
import { BOY_HAND, FRIEND_HAND, GATHER_S } from './fireflies';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

describe('fireflies', () => {
  it('brings the fireflies to where the lying kids’ raised hands are', () => {
    const p = new ScenePlayer(STORY_STAGE);
    p.seek(STORY_CHAPTER['fireflies'].start + GATHER_S + 1);
    const at = (id: string): [number, number] => {
      const o = STORY_STAGE.parts.findIndex((q) => q.id === id) * 5;
      return [p.world[o], p.world[o + 1]];
    };
    const [fx, fy] = at('run-friend-hand-glow');
    const [bx, by] = at('run-boy-hand-glow');
    expect(Math.hypot(fx - FRIEND_HAND[0], fy - FRIEND_HAND[1])).toBeLessThan(0.01);
    expect(Math.hypot(bx - BOY_HAND[0], by - BOY_HAND[1])).toBeLessThan(0.01);
  });
});
