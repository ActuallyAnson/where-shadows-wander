import { EFFECTS } from './quality-governor';
import { describe, expect, it } from 'vitest';
import { PASSES, RenderOrder, validatePasses } from './render-order';

describe('the render order', () => {
  it('is sound: every layer has its own name, they are in drawing order, and the fade is last', () => {
    expect(validatePasses()).toEqual([]);
  });

  it('keeps the order the game already had: the paper under the shadows under the sprites, trail and rings over', () => {
    expect(RenderOrder.paper).toBeLessThan(RenderOrder.shadow);
    expect(RenderOrder.shadow).toBeLessThan(RenderOrder.sprite);
    expect(RenderOrder.sprite).toBeLessThan(RenderOrder.trail);
    expect(RenderOrder.trail).toBeLessThan(RenderOrder.ring);
    expect(RenderOrder.fade).toBeGreaterThan(RenderOrder.wonder);
  });

  it('says which layers may be switched off (the decoration), and never the paper, the shadows or the sprites', () => {
    const optional = PASSES.filter((p) => p.optional).map((p) => p.id);
    expect(optional).toEqual(expect.arrayContaining(['trail', 'ring']));
    for (const must of ['paper', 'shadow', 'sprite', 'fade']) expect(optional).not.toContain(must);
  });

  it('marks as optional exactly the layers the governor can switch off', () => {
    const optional = PASSES.filter((p) => p.optional).map((p) => p.id);
    for (const id of optional) expect(EFFECTS as readonly string[], id).toContain(id);
  });

  it('catches a clash, a mis-ordered list and a fade that is not last', () => {
    expect(
      validatePasses([
        { id: 'a', order: 1, optional: false },
        { id: 'a', order: 2, optional: false },
      ]),
    ).toContain('two layers are called a');
    expect(
      validatePasses([
        { id: 'a', order: 2, optional: false },
        { id: 'b', order: 1, optional: false },
      ]),
    ).toEqual(expect.arrayContaining([expect.stringContaining('is not above')]));
    expect(validatePasses([{ id: 'a', order: 1, optional: false }])).toContain('the fade is not the last layer');
  });
});
