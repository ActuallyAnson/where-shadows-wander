// The v1 hand shapes (GDD, "Shape vocabulary"). Shared by the classifier, mock
// input and gameplay. Plain TypeScript: no IWSDK, no three.js.

export const SHAPES = ['flat', 'fist', 'cup', 'spread', 'rabbit', 'fox'] as const;
export type Shape = (typeof SHAPES)[number];

/** Companion shapes commit after a longer hold than verb shapes. */
export const COMPANION_SHAPES: readonly Shape[] = ['rabbit', 'fox'];
