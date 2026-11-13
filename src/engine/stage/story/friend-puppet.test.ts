import { describe, expect, it } from 'vitest';
import { POSE_STRIDE, validateScene } from '../puppet/puppet-scene';
import { ScenePlayer } from '../puppet/scene-player';
import { CYCLE_S, FORM_S, FRIEND_PUPPETS, FRIEND_RABBIT, friendSceneTime } from './friend-puppet';

describe('friendSceneTime', () => {
  it('forms once, then loops the showing-again cycle', () => {
    expect(friendSceneTime(0)).toBe(0);
    expect(friendSceneTime(FORM_S / 2)).toBe(FORM_S / 2);
    expect(friendSceneTime(FORM_S + 1)).toBeCloseTo(FORM_S + 1);
    expect(friendSceneTime(FORM_S + CYCLE_S + 1)).toBeCloseTo(FORM_S + 1);
    expect(friendSceneTime(FORM_S + 7 * CYCLE_S + 2)).toBeCloseTo(FORM_S + 2);
  });
});

describe('friend puppets', () => {
  it('are sound scenes placed by a root part', () => {
    for (const scene of Object.values(FRIEND_PUPPETS)) {
      expect(validateScene(scene)).toEqual([]);
      expect(scene.parts[0].parent).toBeUndefined();
    }
  });

  it('the rabbit raises its ears as it forms, stands them leaning back, and droops them a little when showing again', () => {
    const player = new ScenePlayer(FRIEND_RABBIT);
    const ear = player.partIndex('ear-front') * POSE_STRIDE + 2;
    const angleAt = (t: number) => {
      player.seek(friendSceneTime(t));
      return player.world[ear];
    };
    const folded = angleAt(0),
      up = angleAt(FORM_S + 1);
    expect(folded).toBeLessThan(-1);
    expect(up).toBeGreaterThan(0);
    let lowest = up;
    for (let t = FORM_S; t < FORM_S + CYCLE_S; t += 0.05) lowest = Math.min(lowest, angleAt(t));
    expect(lowest).toBeLessThan(up - 0.3);
    expect(lowest).toBeGreaterThan(folded + 0.3);
    expect(angleAt(FORM_S + CYCLE_S + 1)).toBeCloseTo(up);
  });

  it('is placed by its root: moving the root moves the whole hand', () => {
    const player = new ScenePlayer(FRIEND_RABBIT);
    const head = player.partIndex('head') * POSE_STRIDE;
    player.seek(2);
    const x0 = player.world[head];
    player.offset[0] = -0.28;
    player.seek(2);
    expect(player.world[head]).toBeCloseTo(x0 - 0.28);
  });
});
