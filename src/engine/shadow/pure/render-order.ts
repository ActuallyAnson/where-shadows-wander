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
  /** Faint paintings of each prop, under the shadows. */
  propSketch: 1.5,
  /** The soft glows (solve bloom, a hand almost making a shape). */
  glow: 1.8,
  /** The black shadows: the hands', the props', the kindred's. */
  shadow: 2,
  /** The candle's dust and light shaft, and the in-VR title. */
  air: 2.2,
  /** The pause menu and the wall's menu. */
  menu: 2.5,
  /** The sprites (the traveller and the world), the captions, the cutscene, the lantern's glow. */
  sprite: 3,
  /** The hand's golden trail, and the ghost outline of a wanted shape. */
  trail: 4,
  /** The ring of light when a shape is recognised. */
  ring: 5,
  /** The puzzle-solved rewards (dust, sparks, drops, leaves, light) and the room's glows. */
  reward: 6,
  /** The room's wonders (lamp, bunting, pictures, globe, window). */
  wonder: 6,
  /** The page of the book in the lap. */
  readingPage: 8,
  /** The spark that flies across the room. */
  sparkFlight: 60,
  /** The fade to black, over everything. */
  fade: 1000,
} as const;

/** The layers as a list, for the inspector and the governor. */
export const PASSES: readonly Pass[] = [
  { id: 'paper', order: RenderOrder.paper, optional: false },
  { id: 'propSketch', order: RenderOrder.propSketch, optional: true },
  { id: 'glow', order: RenderOrder.glow, optional: false },
  { id: 'shadow', order: RenderOrder.shadow, optional: false },
  { id: 'air', order: RenderOrder.air, optional: false },
  { id: 'menu', order: RenderOrder.menu, optional: false },
  { id: 'sprite', order: RenderOrder.sprite, optional: false },
  { id: 'trail', order: RenderOrder.trail, optional: true },
  { id: 'ring', order: RenderOrder.ring, optional: true },
  { id: 'reward', order: RenderOrder.reward, optional: true },
  { id: 'readingPage', order: RenderOrder.readingPage, optional: false },
  { id: 'sparkFlight', order: RenderOrder.sparkFlight, optional: false },
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
