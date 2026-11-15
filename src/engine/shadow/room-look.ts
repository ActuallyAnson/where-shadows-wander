// The room's look for a loaded model: every surface becomes the room's kind of material (MeshBasicMaterial with its own colour,
// texture and see-through-ness), lit by the candle and the moon (candle-light.ts), and every mesh casts the candle's shadows.
// Shared by the furniture the code places (room-models.ts) and the models placed in the room editor (placed-models.ts).
import { DoubleSide, Mesh, MeshBasicMaterial } from '@iwsdk/core';
import type { Material, Object3D, Texture } from '@iwsdk/core';
import type { CandleLight } from './candle-light';

/** What the conversion reads from a loaded material (any of three's kinds). */
type SourceMaterial = Material & {
  color?: { getHex(): number };
  map?: Texture | null;
};

/**
 * Converts every mesh under `model` to the room's look and makes it cast the candle's shadows. Each new material is added to
 * `made` (for disposal). With `cache`, a material met before (another copy of the same model) is reused instead of copied.
 */
export function toRoomLook(
  model: Object3D,
  candle: CandleLight,
  made: Material[],
  cache?: Map<Material, MeshBasicMaterial>,
): void {
  model.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const source = (Array.isArray(o.material) ? o.material : [o.material]) as SourceMaterial[];
    const converted = source.map((m) => {
      const known = cache?.get(m);
      if (known) return known;
      const basic = new MeshBasicMaterial({
        color: m.color ? m.color.getHex() : 0xffffff,
        map: m.map ?? null,
        vertexColors: o.geometry.hasAttribute('color'),
        side: DoubleSide,
        toneMapped: false,
        // A see-through surface (a picture's cut-out, a glass) stays see-through.
        transparent: m.transparent,
        opacity: m.opacity,
        alphaTest: m.alphaTest,
        depthWrite: m.depthWrite,
      });
      candle.light(basic);
      made.push(basic);
      cache?.set(m, basic);
      return basic;
    });
    o.material = converted.length === 1 ? converted[0] : converted;
    candle.cast(o);
  });
}
