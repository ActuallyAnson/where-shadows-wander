// Renders 2D paper-cut shadow silhouettes of invisible bedroom props onto the stage wall.
// Flat planar Three.js mesh at renderOrder: 1.5, baked once at setup (0 ms per-frame CPU cost).

import { BufferAttribute, BufferGeometry, Mesh, MeshBasicMaterial, type Object3D } from '@iwsdk/core';
import type { PropPolygon } from './prop-projector';

export const PROP_SHADOW_RENDER_ORDER = 1.5;
export const PROP_SHADOW_Z_OFFSET = 0.0015;

export class PropShadowView {
  readonly mesh: Mesh;
  readonly geometry: BufferGeometry;
  readonly material: MeshBasicMaterial;

  private _isBaked = false;

  get isBaked(): boolean {
    return this._isBaked;
  }

  constructor(parent?: Object3D) {
    this.geometry = new BufferGeometry();
    this.material = new MeshBasicMaterial({
      color: 0x000000,
      opacity: 0.88,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.renderOrder = PROP_SHADOW_RENDER_ORDER;
    this.mesh.frustumCulled = false;

    if (parent) {
      parent.add(this.mesh);
    }
  }

  /**
   * Triangulates the 2D convex polygons and updates the flat mesh geometry.
   */
  updatePolygons(polygons: readonly PropPolygon[]): void {
    let totalTriangles = 0;
    for (let p = 0; p < polygons.length; p++) {
      const count = polygons[p].vertexCount;
      if (count >= 3) {
        totalTriangles += count - 2;
      }
    }

    if (totalTriangles === 0) {
      this.geometry.setAttribute('position', new BufferAttribute(new Float32Array(0), 3));
      this._isBaked = true;
      return;
    }

    // Each triangle has 3 vertices, each vertex has (x, y, z) = 9 floats
    const positions = new Float32Array(totalTriangles * 9);
    let offset = 0;

    for (let p = 0; p < polygons.length; p++) {
      const poly = polygons[p];
      const count = poly.vertexCount;
      if (count < 3) continue;

      const verts = poly.vertices;
      const v0x = verts[0];
      const v0y = verts[1];

      // Fan triangulation from vertex 0: (0, i, i + 1)
      for (let i = 1; i < count - 1; i++) {
        const vix = verts[i * 2];
        const viy = verts[i * 2 + 1];
        const vi1x = verts[(i + 1) * 2];
        const vi1y = verts[(i + 1) * 2 + 1];

        // Vertex 0
        positions[offset++] = v0x;
        positions[offset++] = v0y;
        positions[offset++] = PROP_SHADOW_Z_OFFSET;

        // Vertex i
        positions[offset++] = vix;
        positions[offset++] = viy;
        positions[offset++] = PROP_SHADOW_Z_OFFSET;

        // Vertex i + 1
        positions[offset++] = vi1x;
        positions[offset++] = vi1y;
        positions[offset++] = PROP_SHADOW_Z_OFFSET;
      }
    }

    this.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this._isBaked = true;
  }

  dispose(): void {
    if (this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.geometry.dispose();
    this.material.dispose();
  }
}
