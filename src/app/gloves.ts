// The gloves the player's hands can be drawn with: rigged models in src/assets/models/hands (made by
// scripts/blender/rig-glove.py), or the capsule hands drawn in code. The Hand Lab's Glove row picks one; the choice is
// remembered in this browser.

export interface GloveChoice {
  readonly id: GloveId;
  /** The button's label, and its tooltip. */
  readonly label: string;
  readonly title: string;
  /** The asset manifest ids of its left and right models (none: the capsule hands). */
  readonly models: readonly [string, string] | null;
}

export type GloveId = 'cartoon' | 'welding' | 'plain';

export const GLOVES: readonly GloveChoice[] = [
  {
    id: 'cartoon',
    label: 'Cartoon',
    title: 'The white cartoon glove',
    models: ['cartoon-glove-left', 'cartoon-glove-right'],
  },
  { id: 'welding', label: 'Welding', title: 'The dark leather welding glove', models: ['glove-left', 'glove-right'] },
  { id: 'plain', label: 'Plain', title: 'The capsule hands drawn in code', models: null },
];

/** The glove drawn when none has been picked in this browser. */
export const DEFAULT_GLOVE: GloveId = 'cartoon';

const KEY = 'wsw.glove';

export function isGloveId(id: unknown): id is GloveId {
  return GLOVES.some((g) => g.id === id);
}

/** The glove last picked in this browser (the default if none, or if storage is unavailable). */
export function readGlove(): GloveId {
  try {
    const id = localStorage.getItem(KEY);
    return isGloveId(id) ? id : DEFAULT_GLOVE;
  } catch {
    return DEFAULT_GLOVE;
  }
}

export function saveGlove(id: GloveId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
}
