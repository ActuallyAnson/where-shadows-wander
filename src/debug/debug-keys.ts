// The keyboard map for the debug tools: Alt plus a key, so none of them clash with the Hand Lab's own keys (0 to 6,
// R, L, H, J, Q, E, Z, X, T, Y, Space and the arrows, none with Alt). Matched on the physical key (`code`), so it works
// on any layout and on a Mac where Alt+letter types a symbol. Plain TypeScript.

export type DebugKeyAction =
  | 'pause'
  | 'step'
  | 'slower'
  | 'faster'
  | 'normal'
  | 'capsules'
  | 'colliders'
  | 'joints'
  | 'replay'
  | `system:${'shadow' | 'sharpen' | 'flicker' | 'candleLight' | 'handVisual'}`;

export const DEBUG_KEYS: Readonly<Record<string, DebugKeyAction>> = {
  KeyP: 'pause',
  Period: 'step',
  BracketLeft: 'slower',
  BracketRight: 'faster',
  Digit0: 'normal',
  KeyK: 'capsules',
  KeyC: 'colliders',
  KeyJ: 'joints',
  KeyR: 'replay',
  Digit1: 'system:shadow',
  Digit2: 'system:sharpen',
  Digit3: 'system:flicker',
  Digit4: 'system:candleLight',
  Digit5: 'system:handVisual',
};

/** What an Alt-key press means, or null when it is not one of ours. */
export function debugKeyAction(e: {
  altKey: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  code: string;
}): DebugKeyAction | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  return DEBUG_KEYS[e.code] ?? null;
}

/** The keys as a table for the docs and the on-page help: [chord, what it does]. */
export const DEBUG_KEY_HELP: readonly (readonly [string, string])[] = [
  ['Alt+P', 'pause or resume the simulation'],
  ['Alt+.', 'run one fixed step (pauses first)'],
  ['Alt+[  /  Alt+]', 'slower / faster (1x, 1/2x, 1/4x, 1/10x)'],
  ['Alt+0', 'normal speed, running'],
  ['Alt+K', 'show the shadow capsules and outline'],
  ['Alt+C', 'show the entity colliders'],
  ['Alt+J', 'show the joint dots'],
  ['Alt+R', 'start or stop replaying the demo recording'],
  ['Alt+1 to Alt+5', 'switch off or on: shadow, sharpen, flicker, candle light, hand visual'],
];
