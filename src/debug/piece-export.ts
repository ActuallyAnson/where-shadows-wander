// Exports a piece of the room the code builds (the tray, the quilt, the pictures, the tin can...) as a .glb, so it can be
// placed again from the asset browser or edited in Blender. The piece is copied with its own transform reset (the file is in
// the piece's own space) and everything glTF cannot hold is left out or named in the warnings.
//
// Materials: the room's MeshBasicMaterial is written as an unlit glTF material with its colour, texture (a painted canvas is
// written as a PNG) and see-through-ness. The candle's lighting patch is code, not material data, and is not written: a model
// placed from the file is lit by the candle again (room-look.ts).
import { Line, Mesh, NormalBlending, Points, ShaderMaterial, Sprite, type Material, type Object3D } from '@iwsdk/core';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface PreparedExport {
  /** A copy of the piece, ready for the exporter. */
  readonly root: Object3D;
  /** What will not look the same in the file. */
  readonly warnings: string[];
}

const materialsOf = (o: Object3D): Material[] => {
  const m = (o as Mesh).material as Material | Material[] | undefined;
  return m === undefined ? [] : Array.isArray(m) ? m : [m];
};

/** Copies `piece` for export as `name`: its own transform reset, and lines, points, sprites and shader-drawn meshes left out. */
export function prepareForExport(piece: Object3D, name: string): PreparedExport {
  const root = piece.clone(true);
  root.name = name;
  root.position.set(0, 0, 0);
  root.rotation.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  const warnings = new Set<string>();
  const drop: Object3D[] = [];
  root.traverse((o) => {
    if (o === root) return;
    // A part placed by its matrix alone: take its transform from the matrix, which the exporter's trs mode doesn't read.
    if (!o.matrixAutoUpdate) o.matrix.decompose(o.position, o.quaternion, o.scale);
    if (o instanceof Points || o instanceof Line || o instanceof Sprite) {
      drop.push(o);
      warnings.add('lines, points and sprites are left out');
      return;
    }
    if (o.renderOrder !== 0) warnings.add('the drawing order of see-through parts is not kept');
    for (const m of materialsOf(o)) {
      if (m instanceof ShaderMaterial) {
        drop.push(o);
        warnings.add('parts drawn by shaders are left out');
        break;
      }
      if (m.blending !== NormalBlending) warnings.add('additive (glowing) blending becomes ordinary see-through');
      if (m.polygonOffset) warnings.add('the depth offset that keeps it off the surface under it is not kept');
    }
  });
  for (const o of drop) o.removeFromParent();
  return { root, warnings: [...warnings] };
}

/** The .glb bytes of a prepared piece; textures larger than `maxTextureSize` pixels are scaled down. */
export async function exportGlb(root: Object3D, maxTextureSize = Infinity): Promise<Uint8Array> {
  root.updateMatrixWorld(true);
  const out = await new GLTFExporter().parseAsync(root, { binary: true, trs: true, onlyVisible: true, maxTextureSize });
  return new Uint8Array(out as ArrayBuffer);
}
