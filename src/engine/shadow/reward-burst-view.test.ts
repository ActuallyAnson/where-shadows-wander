import { describe, expect, it } from 'vitest';
import { BURST_POOL, REWARDS, RewardBurstView } from './reward-burst-view';
import { createStagePlane } from './pure/stage-plane';

const stage = createStagePlane();
stage.origin.set([0, 1.2, -2]);
stage.right.set([1, 0, 0]);
stage.up.set([0, 1, 0]);
stage.normal.set([0, 0, 1]);
stage.width = 1.6;
stage.height = 1;
const run = (v: RewardBurstView, seconds: number) => {
  for (let t = 0; t < seconds - 1e-9; t += 0.04) v.update(0.04, stage, 1);
};

describe('RewardBurstView', () => {
  it('kicks up a small short puff of dust for a footstep', () => {
    const v = new RewardBurstView();
    v.play('puff', 0, 0);
    run(v, 0.1);
    expect(v.alive).toBe(4);
    run(v, 1);
    expect(v.alive).toBe(0);
    v.dispose();
  });

  it('is hidden and empty until a reward plays', () => {
    const v = new RewardBurstView();
    v.update(0.05, stage, 1);
    expect(v.alive).toBe(0);
    expect(v.group.visible).toBe(false);
    v.dispose();
  });

  it.each(REWARDS)('plays the %s reward: specks fly, and they are all gone in a few seconds', (kind) => {
    const v = new RewardBurstView();
    v.play(kind, 0.1, -0.2);
    run(v, 0.5);
    expect(v.alive).toBeGreaterThan(10);
    expect(v.group.visible).toBe(true);
    run(v, 4);
    expect(v.alive).toBe(0);
    expect(v.group.visible).toBe(false);
    v.dispose();
  });

  it('puts the specks where the traveller is (on the stage plane, a little in front of it)', () => {
    const v = new RewardBurstView();
    v.play('sparks', 0.3, -0.1);
    run(v, 0.2);
    const pos = (v.group.children[0] as unknown as { geometry: { attributes: { position: { array: Float32Array } } } })
      .geometry.attributes.position.array;
    let near = 0;
    for (let i = 0; i < BURST_POOL; i++) if (Math.abs(pos[i * 3] - 0.3) < 0.2 && pos[i * 3 + 2] > -2) near++;
    expect(near).toBeGreaterThan(20);
    v.dispose();
  });

  it('keeps to its pool when played over and over, can be cleared, and ignores bad frame times', () => {
    const v = new RewardBurstView();
    for (let i = 0; i < 6; i++) v.play('light', 0, 0);
    run(v, 0.2);
    expect(v.alive).toBeLessThanOrEqual(BURST_POOL);
    v.clear();
    expect(v.alive).toBe(0);
    expect(() => {
      v.update(-1, stage, 1);
      v.update(NaN, stage, 1);
    }).not.toThrow();
    v.dispose();
  });
});
