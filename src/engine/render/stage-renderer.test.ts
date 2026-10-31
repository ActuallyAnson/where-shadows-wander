import { Group, Matrix4, Vector3 } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPACITIES, Flag, Kind } from '../sim/entity-kinds';
import { EntityStore } from '../sim/entity-store';
import { SPRITE_RENDER_ORDER, SPRITE_Z_OFFSET, StageRenderer } from './stage-renderer';

describe('stage-renderer', () => {
  it('initializes InstancedMesh with 256 capacity and correct render order', () => {
    const parent = new Group();
    const renderer = new StageRenderer(parent);

    expect(renderer.mesh).toBeDefined();
    expect(renderer.mesh.count).toBe(0);
    expect(renderer.mesh.renderOrder).toBe(SPRITE_RENDER_ORDER);
    expect(renderer.mesh.renderOrder).toBe(3);
    expect(parent.children).toContain(renderer.mesh);
  });

  it('interpolates entity position with alpha and writes instance matrices', () => {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const renderer = new StageRenderer();

    // Create Traveller at px = 0.0, py = 0.0, currently at x = 1.0, y = 0.0
    const h = store.create(Kind.Traveller, 0.0, 0.0, 0.1);
    const slot = store.slotOf(h);
    store.px[slot] = 0.0;
    store.py[slot] = 0.0;
    store.x[slot] = 1.0;
    store.y[slot] = 2.0;

    // When alpha = 0.5: interpolated position should be (0.5, 1.0)
    renderer.update(store, 0.5);

    expect(renderer.liveCount).toBe(1);
    expect(renderer.mesh.count).toBe(1);

    const m = new Matrix4();
    renderer.mesh.getMatrixAt(0, m);

    const pos = new Vector3();
    pos.setFromMatrixPosition(m);

    expect(pos.x).toBeCloseTo(0.5);
    expect(pos.y).toBeCloseTo(1.0);
    expect(pos.z).toBeCloseTo(SPRITE_Z_OFFSET);
  });

  it('skips inactive and hidden entities', () => {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const renderer = new StageRenderer();

    // Entity 1: active normal rock
    store.create(Kind.Rock, 0.2, 0.2, 0.08);

    // Entity 2: active hidden sensor
    store.create(Kind.Raindrop, 0.4, 0.4, 0.02, 0, 0, Flag.Hidden);

    // Entity 3: created then destroyed
    const temp = store.create(Kind.Crow, 0.6, 0.6, 0.05);
    store.destroy(temp);

    renderer.update(store, 0);

    expect(renderer.liveCount).toBe(1);
    expect(renderer.mesh.count).toBe(1);
  });

  it('mirrors sprite UVs horizontally when velocity is negative', () => {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const renderer = new StageRenderer();

    // Traveller moving left: vx = -0.5
    store.create(Kind.Traveller, 0.0, 0.0, 0.06, -0.5, 0.0);

    renderer.update(store, 0);

    const uvAttr = renderer.geometry.getAttribute('aAtlasUv');
    const uOffset = uvAttr.getX(0);
    const uScale = uvAttr.getZ(0);

    // Moving left: negative scale
    expect(uScale).toBeLessThan(0);
    // Offset shifted to right edge of tile
    expect(uOffset).toBeGreaterThan(0);
  });

  it('applies custom shader injection in onBeforeCompile without error', () => {
    const renderer = new StageRenderer();
    const shader = {
      vertexShader: `
        #include <common>
        void main() {
          #include <uv_vertex>
        }
      `,
      fragmentShader: `
        #include <common>
        void main() {}
      `,
    };

    expect(renderer.material.onBeforeCompile).toBeDefined();
    (renderer.material as unknown as { onBeforeCompile: (s: unknown) => void }).onBeforeCompile(shader);

    expect(shader.vertexShader).toContain('attribute vec4 aAtlasUv;');
    expect(shader.vertexShader).toContain('vMapUv = uv * aAtlasUv.zw + aAtlasUv.xy;');
  });

  it('disposes resources cleanly', () => {
    const renderer = new StageRenderer();
    expect(() => renderer.dispose()).not.toThrow();
  });

  it('glances back toward a close hand only while standing still', () => {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const renderer = new StageRenderer();
    const h = store.create(Kind.Traveller, 0, 0, 0.1);
    const slot = store.slotOf(h);
    const tileU = () => (renderer.mesh.geometry.attributes.aAtlasUv.array as Float32Array)[0];
    renderer.update(store, 0);
    const idle = tileU();
    renderer.glance = true;
    renderer.update(store, 0);
    const glancing = tileU();
    expect(glancing).not.toBe(idle); // the looking-back tile
    store.vx[slot] = 0.12; // walking: no glance, the walk tile
    renderer.update(store, 0);
    expect(tileU()).not.toBe(glancing);
    expect(tileU()).not.toBe(idle);
    store.vx[slot] = 0;
    renderer.glance = false;
    renderer.update(store, 0);
    expect(tileU()).toBe(idle);
  });
});
