import { describe, expect, it } from 'vitest';
import { clearFor, ROOM_BACKGROUND } from './session-mode';

describe('clearFor', () => {
  it('gives an opaque session the room backdrop and an opaque clear', () => {
    expect(clearFor('opaque')).toEqual({ background: ROOM_BACKGROUND, alpha: 1 });
  });

  it('clears a see-through display to transparent', () => {
    for (const blend of ['alpha-blend', 'additive']) expect(clearFor(blend)).toEqual({ background: null, alpha: 0 });
  });

  it('treats a browser that reports no blend mode as VR', () => {
    expect(clearFor(undefined)).toEqual({ background: ROOM_BACKGROUND, alpha: 1 });
  });
});
