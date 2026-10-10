// Creature discovery (GDD "Discovery"): new creatures are discovered, not unlocked from a menu. A
// faint hint appears in the scenery (a puzzle's `creatureHint`, drawn as a `hint-<creature>`
// fixture), and the player finds the shape. The first time a creature's shape commits anywhere,
// it is discovered: a `creature-discovered` event, added to the save's gallery, and its scenery hint
// fades. Plain TypeScript.

import type { ShapeEvent } from '../engine/hands/shape-events';
import { COMPANION_SHAPES } from '../engine/hands/shapes';
import type { GameContext } from './context';
import type { FixtureKind } from './fixtures';
import type { PuzzleDef } from './puzzle';
import { addCreature, type SaveState } from './save-state';

const HINT_FIXTURE: Readonly<Record<'rabbit' | 'fox', FixtureKind>> = { rabbit: 'hint-rabbit', fox: 'hint-fox' };

export class Discovery {
  constructor(readonly save: SaveState) {}

  isDiscovered(creature: string): boolean {
    return this.save.creatures.includes(creature);
  }

  /** On puzzle load: draws the puzzle's creature hint if that creature is still undiscovered. */
  setup(def: PuzzleDef, ctx: GameContext): void {
    const h = def.creatureHint;
    if (h && !this.isDiscovered(h.creature)) ctx.fixtures.add(HINT_FIXTURE[h.creature], h.x, h.y, 0.2, 0.15);
  }

  /** A shape event from the latch: a companion shape's first commit discovers its creature. */
  onShapeEvent(e: Readonly<ShapeEvent>, ctx: GameContext): void {
    if (e.type !== 'commit' || !COMPANION_SHAPES.includes(e.shape)) return;
    if (!addCreature(this.save, e.shape)) return;
    ctx.events.push('creature-discovered', e.shape, ctx.time, this.save.creatures.length);
    const f = ctx.fixtures.find(HINT_FIXTURE[e.shape as 'rabbit' | 'fox']);
    if (f) f.active = false;
  }
}
