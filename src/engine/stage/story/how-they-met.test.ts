import { describe, expect, it } from 'vitest';
import { POSE_STRIDE } from '../puppet/puppet-scene';
import { ScenePlayer } from '../puppet/scene-player';
import { H_CLAP, H_LIFT, HUSH_HAND, HUSH_LEVEL, HUSH_S, RABBIT_REST, TORCH_TOP_Y, TORCH_X } from './how-they-met';
import { SIT_REACH } from './story-kit';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

// Scene 2's hush (docs/STORY.md, "The hush"): footsteps, and the girl's hand over the torch until they pass.
const at = STORY_CHAPTER['how-they-met'];
const player = new ScenePlayer(STORY_STAGE);
/** A part's pose on the stage `t` seconds into the chapter: x, y, angle, scale, opacity. */
const pose = (id: string, t: number): number[] => {
  player.seek(at.start + t);
  const o = player.partIndex(id) * POSE_STRIDE;
  return Array.from(player.world.subarray(o, o + POSE_STRIDE));
};
/** Where the end of her arm (her hand) is: along the arm from its shoulder pivot, turned with it. */
const friendHand = (t: number): [number, number] => {
  const [x, y, angle, scale] = pose('friend-arm', t);
  return [x - Math.sin(angle) * SIT_REACH * scale, y + Math.cos(angle) * SIT_REACH * scale];
};

describe('the hush', () => {
  it('brings her hand down just over the torch, and holds it there until the footsteps go', () => {
    expect(HUSH_HAND[0]).toBe(TORCH_X);
    expect(HUSH_HAND[1]).toBeGreaterThan(TORCH_TOP_Y);
    expect(HUSH_HAND[1] - TORCH_TOP_Y).toBeLessThan(0.05);
    for (const t of [H_CLAP + 0.05, (H_CLAP + H_LIFT) / 2, H_LIFT - 0.05]) {
      const [hx, hy] = friendHand(HUSH_S + t);
      expect(Math.hypot(hx - HUSH_HAND[0], hy - HUSH_HAND[1])).toBeLessThan(0.02);
    }
  });

  it('puts the torch out under her hand and lights it again after, with the room’s candle dimmed between', () => {
    const glow = (t: number) => pose('torch-light', t)[4];
    expect(glow(HUSH_S + H_CLAP - 0.3)).toBeGreaterThan(0.4);
    expect(glow(HUSH_S + (H_CLAP + H_LIFT) / 2)).toBeLessThan(0.1);
    expect(glow(at.end - at.start)).toBeGreaterThan(0.4);
    const hushes = (STORY_STAGE.cues ?? []).filter((c) => c.kind === 'hush' && c.t >= at.start && c.t <= at.end);
    expect(hushes.map((c) => (c.kind === 'hush' ? c.level : NaN))).toEqual([HUSH_LEVEL, 1]);
    expect(hushes[0].t - at.start).toBeCloseTo(HUSH_S + H_CLAP);
    expect(hushes[1].t - at.start).toBeCloseTo(HUSH_S + H_LIFT);
  });

  it('has footsteps before her hand goes down and after it, and the door’s light gone by the end', () => {
    const steps = (STORY_STAGE.cues ?? []).filter((c) => c.kind === 'step' && c.t >= at.start && c.t <= at.end);
    const rel = steps.map((c) => c.t - at.start);
    expect(rel.some((t) => t < HUSH_S + H_CLAP)).toBe(true);
    expect(rel.some((t) => t > HUSH_S + H_CLAP && t < HUSH_S + H_LIFT)).toBe(true);
    expect(pose('door-light', HUSH_S + H_CLAP + 0.5)[4]).toBeGreaterThan(0.2);
    expect(pose('door-light', at.end - at.start)[4]).toBe(0);
  });

  it('ends with the rabbit back on the blanket where the fox finds it', () => {
    const [x, y] = pose('rabbit', at.end - at.start);
    expect(x).toBeCloseTo(RABBIT_REST[0]);
    expect(y).toBeCloseTo(RABBIT_REST[1]);
  });
});

describe('the memories’ sounds', () => {
  const sounds = (id: keyof typeof STORY_CHAPTER) => {
    const c = STORY_CHAPTER[id];
    return (STORY_STAGE.cues ?? [])
      .filter((q) => q.kind === 'sound' && q.t >= c.start && q.t <= c.end)
      .map((q) => (q.kind === 'sound' ? q.sound : ''));
  };

  it('clicks her torch on in the prologue, rolls far thunder and laughs twice in the fort, and laughs in the park', () => {
    expect(sounds('the-storm')).toEqual(['click']);
    expect(sounds('how-they-met')).toEqual(['rumble', 'laugh', 'laugh']);
    expect(sounds('the-park')).toEqual(['laugh']);
  });

  it('has no laughter after the park: its absence is part of the loss', () => {
    for (const id of Object.keys(STORY_CHAPTER) as (keyof typeof STORY_CHAPTER)[]) {
      if (id === 'the-storm' || id === 'how-they-met' || id === 'the-park') continue;
      expect(sounds(id)).not.toContain('laugh');
    }
  });
});
