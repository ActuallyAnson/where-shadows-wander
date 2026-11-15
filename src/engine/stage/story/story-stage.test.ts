import { describe, expect, it } from 'vitest';
import { validateScene } from '../puppet/puppet-scene';
import { ScenePlayer } from '../puppet/scene-player';
import { FRIEND_PUPPETS } from './friend-puppet';
import { STORY_SCRIPT } from './story-script';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';
import { CANDLE_MOODS } from './candle-mood';

const chapters = Object.entries(STORY_CHAPTER).sort((a, b) => a[1].start - b[1].start);
const chapterAt = (t: number) => chapters.findIndex(([, c]) => t >= c.start - 1e-9 && t < c.end - 1e-9);

describe('the story stage', () => {
  it('is a sound puppet scene', () => {
    expect(validateScene(STORY_STAGE)).toEqual([]);
  });

  it('never moves a part across a chapter boundary: each chapter picks up its parts where the last one left them', () => {
    // Between a track's last key in one chapter and its first in a later one, the value would ease from one to the other over
    // the start of the later chapter: a drift nobody keyed. A 'step' key is a deliberate cut, so it may change the value.
    const drifts: string[] = [];
    for (const tr of STORY_STAGE.tracks)
      for (let i = 1; i < tr.keys.length; i++) {
        const [ta, va] = tr.keys[i - 1];
        const [tb, vb, e] = tr.keys[i];
        if (chapterAt(ta) === chapterAt(tb) || e === 'step') continue;
        if (Math.abs(va - vb) > 1e-6) drifts.push(`${tr.part}.${tr.prop}: ${va} at ${ta} s to ${vb} at ${tb} s`);
      }
    expect(drifts).toEqual([]);
  });

  it('ends the goodbye on an empty wall, and every chapter plays without a part going out of bounds', () => {
    const p = new ScenePlayer(STORY_STAGE);
    p.seek(STORY_STAGE.length);
    const wallHalfW = 0.84;
    const shown: string[] = [];
    STORY_STAGE.parts.forEach((part, i) => {
      const o = i * 5;
      const visible = part.art !== '' && p.world[o + 4] > 0.01 && Math.abs(p.world[o]) < wallHalfW + 0.3;
      if (visible) shown.push(part.id);
    });
    expect(shown).toEqual([]);
    let bad = 0;
    for (let t = 0; t <= STORY_STAGE.length; t += 0.25) {
      p.seek(t);
      for (let k = 0; k < p.world.length; k++) if (!Number.isFinite(p.world[k])) bad++;
    }
    expect(bad).toBe(0);
  });

  it('has a friend’s hand for every shape the script waits for, and every mood it names', () => {
    for (const s of STORY_SCRIPT) {
      if (s.candle) expect(CANDLE_MOODS[s.candle], s.id).toBeDefined();
      for (const b of s.beats) if (b.kind === 'friend') expect(FRIEND_PUPPETS[b.puppet ?? b.shape], s.id).toBeDefined();
    }
    for (const c of STORY_STAGE.cues ?? [])
      if (c.kind === 'mood') expect(CANDLE_MOODS[c.mood as keyof typeof CANDLE_MOODS], c.mood).toBeDefined();
  });

  it('plays the scenes in the story’s order, ending on sleep', () => {
    expect(STORY_SCRIPT.map((s) => s.id)).toEqual([
      'how-they-met',
      'the-park',
      'fireflies',
      'last-ordinary-day',
      'goodbye',
      'sleep',
    ]);
    const last = STORY_SCRIPT[STORY_SCRIPT.length - 1].beats;
    expect(last[last.length - 1].kind).toBe('sleep');
  });
});
