import { EFFECTS } from './quality-governor';
import { describe, expect, it } from 'vitest';
import { partDepths } from '../../stage/puppet/puppet-scene';
import { STORY_STAGE } from '../../stage/story/story-stage';
import { PASSES, PUPPET_PART_STEP, puppetPartOrder, RenderOrder, validatePasses } from './render-order';

describe('the render order', () => {
  it('is sound: every layer has its own name, they are in drawing order, and the fade is last', () => {
    expect(validatePasses()).toEqual([]);
  });

  it('keeps the order the game already had: the paper under the shadows under the sprites, the rings over', () => {
    expect(RenderOrder.paper).toBeLessThan(RenderOrder.shadow);
    expect(RenderOrder.shadow).toBeLessThan(RenderOrder.sprite);
    expect(RenderOrder.sprite).toBeLessThan(RenderOrder.ring);
    expect(RenderOrder.fade).toBeGreaterThan(RenderOrder.ghost);
  });

  it('says which layers may be switched off (the decoration), and never the paper, the shadows or the sprites', () => {
    const optional = PASSES.filter((p) => p.optional).map((p) => p.id);
    expect(optional).toEqual(expect.arrayContaining(['ring']));
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

describe("a puppet part's layer", () => {
  it('puts what stands back, shadow or glow, under the hands and every near puppet', () => {
    expect(puppetPartOrder(false, 0.6, 140)).toBeLessThan(RenderOrder.shadow);
    expect(puppetPartOrder(true, 0.6, 140)).toBeLessThan(puppetPartOrder(false, 0, 0));
    expect(puppetPartOrder(false, 0.6, 0)).toBeGreaterThan(RenderOrder.paper);
  });

  it('primes the wall before the scenery, draws the near puppets after it, and resolves them all before the hands', () => {
    const last = STORY_STAGE.parts.length - 1;
    expect(RenderOrder.puppetPrime).toBeGreaterThan(RenderOrder.paper);
    expect(RenderOrder.puppetPrime).toBeLessThan(puppetPartOrder(false, 0.6, 0));
    expect(puppetPartOrder(true, 0.6, last)).toBeLessThan(puppetPartOrder(false, 0, 0));
    expect(RenderOrder.puppetNear + last * PUPPET_PART_STEP).toBeLessThan(RenderOrder.puppetResolve);
    expect(RenderOrder.puppetResolve).toBeLessThan(RenderOrder.shadow);
  });

  it('keeps near shadows in their layer, near glows on top, and list order within a layer', () => {
    expect(Math.floor(puppetPartOrder(false, 0, 5) * 10)).toBe(RenderOrder.puppetNear * 10);
    expect(puppetPartOrder(true, 0, 0)).toBeGreaterThan(puppetPartOrder(false, 0, 140));
    expect(puppetPartOrder(false, 0.5, 3)).toBeLessThan(puppetPartOrder(false, 0.3, 4));
  });

  it('draws every character in the story in front of all the scenery, though later chapters add scenery after the kids', () => {
    const depths = partDepths(STORY_STAGE);
    let highestScenery = -Infinity;
    let lowestNear = Infinity;
    STORY_STAGE.parts.forEach((p, i) => {
      if (!p.art) return;
      const order = puppetPartOrder(p.look === 'glow', depths[i], i);
      if (depths[i] > 0) highestScenery = Math.max(highestScenery, order);
      else lowestNear = Math.min(lowestNear, order);
    });
    expect(highestScenery).toBeLessThan(lowestNear);
    expect(highestScenery).toBeLessThan(RenderOrder.shadow);
  });
});
