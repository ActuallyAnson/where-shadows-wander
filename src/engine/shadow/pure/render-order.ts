// Every layer the game draws, in the order it draws, in one place. Three.js sorts what it draws by `renderOrder` (lowest first), and
// the game used to scatter bare numbers (1, 1.5, 1.8, 2, 2.2, 2.5, 3 ...) through forty files, so a new layer meant reading all of
// them to find a gap. Now each layer has a name here, the numbers keep the order the game already had, and a test says which layer
// must be under which. `optional` marks the layers the quality governor may switch off when the frame time runs over its budget.
// Plain TypeScript: no three, so it can be read by pure code and tests.

export interface Pass {
  /** The layer's name, as the inspector shows it. */
  readonly id: string;
  /** Three.js's renderOrder: lower draws first (under). */
  readonly order: number;
  /** The quality governor may turn this layer off to save frame time (see quality-governor.ts). */
  readonly optional: boolean;
}

/** The stage's layers, from the paper up. (The room's own layers sit below the stage in room-dressing-view.ts and the bedroom.) */
export const RenderOrder = {
  /** The paper and its painted scenery (one shader). */
  paper: 1,
  /**
   * The puppet scenery that stands back (PuppetPart.depth > 0: rooms, trees, the gate, the window and its light): under every
   * near puppet and the hands, so a character is always in front of it.
   */
  scenery: 1.5,
  /** The black shadows of the hands. */
  shadow: 2,
  /** The candle's dust and light shaft, and the in-VR title. */
  air: 2.2,
  /** The pause menu and the wall's menu. */
  menu: 2.5,
  /** The captions and the lantern's glow (and the story's puppets to come). */
  sprite: 3,
  /** The hand's golden trail. */
  trail: 4,
  /** The ring of light when a shape is recognised. */
  ring: 5,
  /** The room's wonders (lamp, bunting, pictures, globe, window). */
  wonder: 6,
  /** The fade to black, over everything. */
  fade: 1000,
} as const;

/** How far apart two puppet parts' orders are, so later parts in a scene's list draw over earlier ones in the same layer. */
export const PUPPET_PART_STEP = 0.0001;

/**
 * Where a puppet part draws (puppet-view.ts). A part standing back (`depth` > 0), shadow or glow, goes in the scenery layer, under
 * the near puppets and the hands: a far shadow darkens what is under it and a glow lights it, so scenery drawn over a character
 * would show through the character's shadow (a tree in front of the boy, the window's light on him). Near shadows lie with the
 * hands' shadows and near glows (the torch, the fireflies) are light on top of them. Within a layer, list order (`index`).
 */
export function puppetPartOrder(glow: boolean, depth: number, index: number): number {
  const layer = depth > 0 ? RenderOrder.scenery : glow ? RenderOrder.sprite : RenderOrder.shadow;
  return layer + index * PUPPET_PART_STEP;
}

/** The layers as a list, for the inspector and the governor. */
export const PASSES: readonly Pass[] = [
  { id: 'paper', order: RenderOrder.paper, optional: false },
  { id: 'scenery', order: RenderOrder.scenery, optional: false },
  { id: 'shadow', order: RenderOrder.shadow, optional: false },
  { id: 'air', order: RenderOrder.air, optional: false },
  { id: 'menu', order: RenderOrder.menu, optional: false },
  { id: 'sprite', order: RenderOrder.sprite, optional: false },
  { id: 'trail', order: RenderOrder.trail, optional: true },
  { id: 'ring', order: RenderOrder.ring, optional: true },
  { id: 'fade', order: RenderOrder.fade, optional: false },
];

/**
 * Problems with the layers, as sentences (none when they are sound): every layer must have its own name, the list must be in
 * drawing order, and the fade must be the last thing drawn.
 */
export function validatePasses(passes: readonly Pass[] = PASSES): string[] {
  const problems: string[] = [];
  const names = new Set<string>();
  passes.forEach((p, i) => {
    if (names.has(p.id)) problems.push(`two layers are called ${p.id}`);
    names.add(p.id);
    if (!Number.isFinite(p.order)) problems.push(`${p.id} has no order`);
    if (i > 0 && !(p.order > passes[i - 1].order))
      problems.push(`${p.id} (${p.order}) is not above ${passes[i - 1].id}`);
  });
  const last = passes[passes.length - 1];
  if (last && last.id !== 'fade') problems.push('the fade is not the last layer');
  return problems;
}
