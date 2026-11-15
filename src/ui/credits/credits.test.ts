import { describe, expect, it } from 'vitest';
import { CREDITS, THANKS } from './credits';

describe('CREDITS', () => {
  it('opens on the title and names the team, Nyove by alias', () => {
    expect(CREDITS[0]).toEqual({ kind: 'title', text: 'Where Shadows Wander' });
    const names = CREDITS.filter((l) => l.kind === 'name').map((l) => l.text);
    expect(names).toContain('Nyove');
    expect(names).toHaveLength(3);
  });

  it('keeps the CC BY credits the gloves require', () => {
    const text = CREDITS.map((l) => l.text).join('\n');
    expect(text).toContain('vr.district.0 (CC BY 4.0)');
    expect(text).toContain('senseiwords203 (CC BY 4.0)');
  });

  it('has words on every line but the gaps', () => {
    for (const l of CREDITS) expect(l.kind === 'gap' ? l.text === '' : l.text.length > 0).toBe(true);
    expect(THANKS.length).toBeGreaterThan(0);
  });
});
