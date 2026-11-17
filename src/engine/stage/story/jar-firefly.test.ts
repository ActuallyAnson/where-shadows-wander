import { describe, expect, it } from 'vitest';
import { FIREFLY_LEAVES_AT, JarFirefly } from './jar-firefly';
import { STORY_CHAPTER } from './story-stage';

describe('the firefly in the room’s jar', () => {
  it('glows from the start, before the story is on the wall', () => {
    const f = new JarFirefly();
    f.update(0.1, null, true);
    f.update(0.1, null, false);
    expect(f.level).toBe(1);
    expect(f.glow).toBeGreaterThan(0.5);
  });

  it('leaves in scene 5, when the one on the wall leaves its jar, and stays gone into the end', () => {
    const day = STORY_CHAPTER['last-ordinary-day'];
    expect(FIREFLY_LEAVES_AT).toBeGreaterThan(day.start);
    expect(FIREFLY_LEAVES_AT).toBeLessThan(day.end);
    const f = new JarFirefly();
    f.update(0.1, FIREFLY_LEAVES_AT - 0.1, false);
    expect(f.level).toBe(1);
    for (let i = 0; i < 20; i++) f.update(0.1, FIREFLY_LEAVES_AT + 0.1 * i, false);
    expect(f.level).toBe(0);
    expect(f.glow).toBe(0);
    // The end: no memory on the wall, and it is still gone.
    f.update(1, null, false);
    expect(f.level).toBe(0);
  });

  it('is back in the jar for a new play-through, or a jump back to before scene 5', () => {
    const f = new JarFirefly();
    f.update(5, FIREFLY_LEAVES_AT + 1, false);
    f.update(0, null, true);
    expect(f.level).toBe(1);
    f.update(5, FIREFLY_LEAVES_AT + 1, false);
    f.update(5, STORY_CHAPTER['fireflies'].start, false);
    expect(f.level).toBe(1);
  });
});
