// Dev only: reads back what the scene would composite over passthrough, without a
// headset. Renders the live scene into an RGBA8 target like WebXR's own (cleared to
// transparent black, sRGB-encoded) and returns the pixel at each world point, so a
// script can check the alpha the compositor would receive: 0 off the stage and where
// a real hand covers it, the paper's alpha on bare paper, and so on.
// What this cannot show is what the headset's compositor then does with it.
import { Color, RGBAFormat, SRGBColorSpace, UnsignedByteType, Vector3, WebGLRenderTarget } from '@iwsdk/core';
import type { PerspectiveCamera, Scene, WebGLRenderer } from '@iwsdk/core';

const SIZE = 512;

/** `points` are [x, y, z] in scene space; returns one [r, g, b, a] (0..255) per point, or null if behind the camera or off screen. */
export function probePixels(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  points: readonly (readonly number[])[],
): (number[] | null)[] {
  const target = new WebGLRenderTarget(SIZE, SIZE, { format: RGBAFormat, type: UnsignedByteType });
  target.texture.colorSpace = SRGBColorSpace;
  const oldTarget = renderer.getRenderTarget();
  const oldAlpha = renderer.getClearAlpha();
  const oldClear = renderer.getClearColor(new Color());
  const oldBackground = scene.background;
  const oldAspect = camera.aspect;
  camera.aspect = 1;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  scene.background = null;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  const out: (number[] | null)[] = [];
  const v = new Vector3();
  const px = new Uint8Array(4);
  for (const p of points) {
    v.set(p[0], p[1], p[2]).project(camera);
    if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) {
      out.push(null);
      continue;
    }
    const x = Math.min(SIZE - 1, Math.floor(((v.x + 1) / 2) * SIZE));
    const y = Math.min(SIZE - 1, Math.floor(((v.y + 1) / 2) * SIZE));
    renderer.readRenderTargetPixels(target, x, y, 1, 1, px);
    out.push([px[0], px[1], px[2], px[3]]);
  }
  renderer.setRenderTarget(oldTarget);
  renderer.setClearColor(oldClear, oldAlpha);
  scene.background = oldBackground;
  camera.aspect = oldAspect;
  camera.updateProjectionMatrix();
  target.dispose();
  return out;
}
