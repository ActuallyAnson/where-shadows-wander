// Several boxes in one geometry, each moved to its place: boxes that share a material cost one draw call, not one each.
import { BufferGeometry, Float32BufferAttribute } from '@iwsdk/core';

export function mergeBoxes(boxes: readonly { geo: BufferGeometry; x: number; y: number; z: number }[]): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const { geo, x, y, z } of boxes) {
    const moved = geo.clone().translate(x, y, z);
    const base = positions.length / 3;
    positions.push(...Array.from(moved.attributes.position.array));
    normals.push(...Array.from(moved.attributes.normal.array));
    uvs.push(...Array.from(moved.attributes.uv.array));
    for (const i of Array.from(moved.index!.array)) indices.push(base + i);
    moved.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}
