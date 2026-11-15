import { describe, expect, it } from 'vitest';
import { POSE_STRIDE, bedAt } from '../puppet/puppet-scene';
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

  it('clicks her torch on and throws the blanket up in the prologue; hops, far thunder, a laugh and giggles in the fort', () => {
    expect(sounds('the-storm')).toEqual(['click', 'blanket']);
    expect(sounds('how-they-met')).toEqual(['hop', 'rumble', 'hop', 'hop', 'laugh', 'hop', 'hop', 'giggle']);
    expect(sounds('the-park')).toEqual(['run', 'run', 'laugh']);
  });

  it('clinks the jar and rings a far bell in scene 4, creaks the gate in scene 5, and gusts as she fades in scene 6', () => {
    expect(sounds('fireflies')).toEqual(['jar', 'bell']);
    expect(sounds('last-ordinary-day')).toEqual(['gate']);
    expect(sounds('goodbye')).toEqual(['gust']);
  });

  it('has no laughter or giggles after the park: their absence is part of the loss', () => {
    for (const id of Object.keys(STORY_CHAPTER) as (keyof typeof STORY_CHAPTER)[]) {
      if (id === 'the-storm' || id === 'how-they-met' || id === 'the-park') continue;
      expect(sounds(id)).not.toContain('laugh');
      expect(sounds(id)).not.toContain('giggle');
    }
  });

  it('lays crickets under the dusk until morning, and a wind under the empty wall until the goodbye ends', () => {
    const cues = STORY_STAGE.cues;
    const at = (id: keyof typeof STORY_CHAPTER, k: number) =>
      STORY_CHAPTER[id].start + k * (STORY_CHAPTER[id].end - STORY_CHAPTER[id].start);
    expect(bedAt(cues, at('how-they-met', 0.5))).toBeNull();
    expect(bedAt(cues, at('the-park', 0.2))).toBeNull();
    expect(bedAt(cues, STORY_CHAPTER['the-park'].end)).toBe('crickets'); // held while her cup waits
    expect(bedAt(cues, at('fireflies', 0.3))).toBe('crickets');
    expect(bedAt(cues, STORY_CHAPTER.fireflies.end)).toBeNull(); // morning at the gate
    expect(bedAt(cues, at('last-ordinary-day', 0.2))).toBeNull();
    expect(bedAt(cues, STORY_CHAPTER['last-ordinary-day'].end)).toBe('wind'); // held while her flat hand waits
    expect(bedAt(cues, at('goodbye', 0.5))).toBe('wind');
    expect(bedAt(cues, STORY_CHAPTER.goodbye.end)).toBeNull(); // scene 7 is the room's own quiet
  });
});
