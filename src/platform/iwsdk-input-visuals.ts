// IWSDK input visuals we don't want: the game is hands-only in passthrough, so
// the player sees their real hands and never points at anything.
import type { Object3D, World } from '@iwsdk/core';

/**
 * Turns off IWSDK's far-ray pointers (one per hand). Uses the public
 * MultiPointer API; call once after World.create.
 */
export function disableIwsdkRays(world: World): void {
  for (const h of ['left', 'right'] as const) world.input.xr.multiPointers[h].toggleSubPointer('ray', false);
}

/**
 * Hides IWSDK's hand models. Its own switch (visualAdapters.hand[*].toggleVisual(false)
 * / visual.toggle) did not hide them in the spike, so hide the SkinnedMeshes
 * directly. Visuals are recreated when a hand reconnects, so call this every
 * frame; it only walks the two small hand models.
 */
export function hideIwsdkHandMeshes(world: World): void {
  const hands = world.input.xr.visualAdapters.hand;
  hideSkinned(hands.left.visual?.model);
  hideSkinned(hands.right.visual?.model);
}

function hideSkinned(root: Object3D | undefined): void {
  root?.traverse((o) => {
    if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh && o.visible) o.visible = false;
  });
}
