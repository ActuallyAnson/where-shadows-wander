import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Group,
  Line,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  Sprite,
} from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { prepareForExport } from './piece-export';

function piece(): Group {
  const g = new Group();
  g.position.set(1, 2, 3);
  g.rotation.set(0, Math.PI / 2, 0);
  g.scale.setScalar(2);
  const body = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0x884422 }));
  body.name = 'body';
  const glow = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ blending: AdditiveBlending }));
  glow.name = 'glow';
  const shaded = new Mesh(new BoxGeometry(1, 1, 1), new ShaderMaterial());
  // A part placed by its matrix only.
  const fixed = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
  fixed.name = 'fixed';
  fixed.matrixAutoUpdate = false;
  fixed.matrix.makeTranslation(0, 0.5, 0);
  g.add(body, glow, shaded, fixed, new Points(new BufferGeometry()), new Line(new BufferGeometry()), new Sprite());
  return g;
}

describe('prepareForExport', () => {
  it("copies the piece in its own space, leaving out what glTF can't hold, and says what changes", () => {
    const original = piece();
    const { root, warnings } = prepareForExport(original, 'tin-can');
    expect(root).not.toBe(original);
    expect(root.name).toBe('tin-can');
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
    expect(root.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(root.children.map((c) => c.name)).toEqual(['body', 'glow', 'fixed']);
    expect(root.getObjectByName('fixed')!.position.y).toBeCloseTo(0.5);
    expect(warnings.join('\n')).toMatch(/lines, points and sprites/);
    expect(warnings.join('\n')).toMatch(/shaders/);
    expect(warnings.join('\n')).toMatch(/additive/);
    // The piece in the room is untouched.
    expect(original.position.toArray()).toEqual([1, 2, 3]);
    expect(original.children).toHaveLength(7);
  });

  it('has nothing to say about a plain piece', () => {
    const g = new Group();
    g.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial()));
    expect(prepareForExport(g, 'box').warnings).toEqual([]);
  });
});
