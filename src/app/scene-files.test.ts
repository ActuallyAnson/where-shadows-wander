// Every scene file in public/scenes must pass IWSDK's own validator, the one its editor runs when it opens a
// file, so a hand-edited or editor-saved file that the editor would reject fails here instead.
import { validateSceneDocument } from '@iwsdk/scene-composition';
import { describe, expect, it } from 'vitest';
import { Kind } from '../engine/sim/entity-kinds';
import { MARKER_PREFIX, parseLayout, PIECE_COMPONENT, PIECE_PREFIX } from '../engine/sim/scene-layout';
import assets from './assets';
import components, { Piece } from './components';

const scenes = import.meta.glob('../../public/scenes/*.iwsdk.scene.json', { eager: true, import: 'default' });

describe('public/scenes', () => {
  it('has the scene files this test is meant to check', () => {
    expect(Object.keys(scenes).length).toBeGreaterThanOrEqual(2);
  });

  for (const [path, doc] of Object.entries(scenes)) {
    const name = path.slice(path.lastIndexOf('/') + 1);

    it(`${name} passes the IWSDK scene validator`, () => {
      expect(validateSceneDocument(doc as never).issues).toEqual([]);
    });

    it(`${name} has no problems for our layout loader`, () => {
      expect(parseLayout(doc).problems).toEqual([]);
    });
  }

  it('names an asset in the manifest for every piece or marker a scene file uses', () => {
    const manifest = assets as unknown as Record<string, unknown>;
    const used: string[] = [];
    const walk = (nodes: unknown) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes as { content?: { asset?: string }; children?: unknown }[]) {
        const a = n.content?.asset;
        if (a && (a.startsWith(PIECE_PREFIX) || a.startsWith(MARKER_PREFIX))) used.push(a);
        walk(n.children);
      }
    };
    for (const doc of Object.values(scenes)) walk((doc as { nodes: unknown }).nodes);
    expect(used.length).toBeGreaterThan(0);
    for (const a of used) expect(Object.keys(manifest), a).toContain(a);
  });
});

describe('editor assets and components', () => {
  it('has a piece asset for every entity kind, so a new kind shows up in the editor', () => {
    const names = Object.keys(assets as object);
    for (const kind of Object.keys(Kind)) expect(names).toContain(`${PIECE_PREFIX}${kind.toLowerCase()}`);
  });

  it('registers the Piece component under the name and fields the loader reads', () => {
    expect(Piece.id).toBe(PIECE_COMPONENT);
    expect(components).toContain(Piece);
    expect(Object.keys((Piece as unknown as { schema: object }).schema)).toEqual([
      'vx',
      'vy',
      'isStatic',
      'isSensor',
      'hidden',
    ]);
  });
});
