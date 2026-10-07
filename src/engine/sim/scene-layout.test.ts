import { describe, expect, it } from 'vitest';
import chapter1 from '../../../public/scenes/chapter-1.iwsdk.scene.json';
import { Flag, Kind } from './entity-kinds';
import { EntityStore, type Handle } from './entity-store';
import { parseLayout, spawnLayout } from './scene-layout';

/** A scene node the way the editor writes one: an asset, a position, a scale, optionally the Piece component. */
const node = (
  id: string,
  asset: string,
  position: number[] = [0, 0, 0],
  scale: number | number[] = 1,
  extra: object = {},
) => ({
  id,
  content: { type: 'asset', asset },
  transform: { position, scale },
  ...extra,
});
const doc = (...nodes: unknown[]) => ({ version: 'iwsdk.scene.v1', units: 'meters', nodes });

describe('parseLayout', () => {
  it('reads a piece: the kind from its asset, the radius from its scale, the position from its position', () => {
    const l = parseLayout(doc(node('r', 'piece-rock', [1.2, 0.3, 5], 0.08)));
    expect(l.problems).toEqual([]);
    expect(l.entities).toEqual([{ id: 'r', kind: Kind.Rock, x: 1.2, y: 0.3, radius: 0.08, vx: 0, vy: 0, flags: 0 }]);
  });

  it('takes the radius from a three-number scale too', () => {
    expect(parseLayout(doc(node('r', 'piece-rock', [0, 0, 0], [0.1, 0.1, 0.1]))).entities[0].radius).toBe(0.1);
  });

  it('reads every kind from its asset name', () => {
    const names = ['traveller', 'rock', 'raindrop', 'crow', 'rabbit', 'fox', 'firefly'];
    const l = parseLayout(doc(...names.map((k, i) => node(`n${i}`, `piece-${k}`))));
    expect(l.problems).toEqual([]);
    expect(l.entities.map((e) => e.kind)).toEqual([
      Kind.Traveller,
      Kind.Rock,
      Kind.Raindrop,
      Kind.Crow,
      Kind.Rabbit,
      Kind.Fox,
      Kind.Firefly,
    ]);
  });

  it('reads speed and flags from the Piece component', () => {
    const l = parseLayout(
      doc(
        node('r', 'piece-rock', [0, 0, 0], 0.1, {
          components: { Piece: { vx: 1, vy: -2, isStatic: true, isSensor: true, hidden: false } },
        }),
      ),
    );
    expect(l.problems).toEqual([]);
    expect(l.entities[0]).toMatchObject({ vx: 1, vy: -2, flags: Flag.Static | Flag.Sensor });
  });

  it('treats an empty Piece component, and other components, as defaults', () => {
    const l = parseLayout(
      doc(node('r', 'piece-rock', [0, 0, 0], 0.1, { components: { Piece: {}, PointLight: { intensity: 1 } } })),
    );
    expect(l.problems).toEqual([]);
    expect(l.entities[0]).toMatchObject({ vx: 0, vy: 0, flags: 0 });
  });

  it('turns a marker into a named spot with its width and height from the scale', () => {
    const l = parseLayout(doc(node('g', 'marker-gap', [2.5, 0, 0], [0.6, 0.2, 1])));
    expect(l.entities).toEqual([]);
    expect(l.markers).toEqual([{ id: 'g', tag: 'gap', x: 2.5, y: 0, params: { width: 0.6, height: 0.2 } }]);
  });

  it('leaves nodes with other assets, no asset, or no content alone', () => {
    const l = parseLayout(
      doc(
        node('table', 'furniture-table'),
        { id: 'group', content: { type: 'group' } },
        { id: 'bare' },
        node('r', 'piece-rock', [0, 0, 0], 0.1),
      ),
    );
    expect(l.problems).toEqual([]);
    expect(l.entities.map((e) => e.id)).toEqual(['r']);
    expect(l.markers).toEqual([]);
  });

  it('adds up the translations of nested groups', () => {
    const l = parseLayout(
      doc({
        id: 'a',
        transform: { position: [10, 1, 0] },
        children: [
          { id: 'b', transform: { position: [2, 0.5, 0] }, children: [node('c', 'piece-fox', [0.25, 0.25, 0], 0.1)] },
        ],
      }),
    );
    expect(l.problems).toEqual([]);
    expect([l.entities[0].x, l.entities[0].y]).toEqual([12.25, 1.75]);
  });

  it('reports a parent that is rotated or scaled, and still reads the children by translation', () => {
    const l = parseLayout(
      doc(
        { id: 'rot', transform: { rotationDeg: [0, 0, 90] }, children: [node('c', 'piece-rock', [1, 0, 0], 0.1)] },
        { id: 'sc', transform: { scale: [2, 2, 2] }, children: [] },
        {
          id: 'ok',
          transform: { scale: 1, rotationDeg: [0, 0, 0] },
          children: [node('d', 'piece-rock', [0, 0, 0], 0.1)],
        },
      ),
    );
    expect(l.problems).toEqual(['rot: rotation or scale on a parent is ignored']);
    expect(l.entities.map((e) => e.id)).toEqual(['c', 'd']);
  });

  it('skips nodes switched off in the editor, and everything under them', () => {
    const l = parseLayout(
      doc(
        node('off', 'piece-rock', [0, 0, 0], 0.1, {
          visible: false,
          children: [node('child', 'piece-rock', [0, 0, 0], 0.1)],
        }),
        node('on', 'piece-rock', [0, 0, 0], 0.1),
      ),
    );
    expect(l.entities.map((e) => e.id)).toEqual(['on']);
  });

  it('keeps authoring order', () => {
    const l = parseLayout(doc(node('z', 'piece-rock'), node('a', 'piece-rock'), node('m', 'piece-rock')));
    expect(l.entities.map((e) => e.id)).toEqual(['z', 'a', 'm']);
  });

  it('uses a scale of 1 when a node has none', () => {
    const l = parseLayout(doc({ id: 'r', content: { type: 'asset', asset: 'piece-rock' } }));
    expect(l.entities[0].radius).toBe(1);
  });

  it('reports each kind of mistake with the node id, and keeps reading the rest', () => {
    const l = parseLayout(
      doc(
        node('k', 'piece-dragon'),
        node('s0', 'piece-rock', [0, 0, 0], 0),
        node('s1', 'piece-rock', [0, 0, 0], -1),
        node('s2', 'piece-rock', [0, 0, 0], [0.2, 0.1, 1]),
        node('m', 'marker-'),
        node('p0', 'piece-rock', [0, 0, 0], 0.1, { components: { Piece: 'fast' } }),
        node('p1', 'piece-rock', [0, 0, 0], 0.1, { components: { Piece: { vx: 'fast' } } }),
        node('p2', 'piece-rock', [0, 0, 0], 0.1, { components: { Piece: { isStatic: 'yes' } } }),
        node('good', 'piece-rock', [0, 0, 0], 0.1),
      ),
    );
    expect(l.problems).toEqual([
      'k: unknown kind "dragon" (asset "piece-dragon")',
      's0: scale (the radius) must be above 0',
      's1: scale (the radius) must be above 0',
      's2: scale x and y differ; the radius uses x',
      'm: a marker asset needs a name after "marker-"',
      'p0: the Piece component must be an object',
      'p1: Piece vx and vy must be numbers',
      'p2: Piece isStatic must be true or false',
    ]);
    expect(l.entities.map((e) => e.id)).toEqual(['s2', 'good']);
  });

  it('survives anything that is not a scene file', () => {
    for (const bad of [null, undefined, 5, 'x', [], {}, { nodes: 'no' }]) {
      const l = parseLayout(bad);
      expect(l.entities).toEqual([]);
      expect(l.problems).toHaveLength(1);
    }
    expect(() =>
      parseLayout(doc(null, 5, 'x', [], { children: 'no' }, { id: 'c', content: 5, components: 5 })),
    ).not.toThrow();
  });

  it('treats a position with missing or non-number parts as the origin, and says so', () => {
    const l = parseLayout(doc(node('a', 'piece-rock', [1], 0.1), node('b', 'piece-rock', ['1', 2, 3] as never, 0.1)));
    expect(l.problems).toHaveLength(2);
    expect(l.entities.map((e) => [e.x, e.y])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });
});

describe('parseLayout of bad or hostile values', () => {
  it('does not mistake a property of Object for a kind', () => {
    const names = ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf'];
    const l = parseLayout(doc(...names.map((k, i) => node(`n${i}`, `piece-${k}`))));
    expect(l.entities).toEqual([]);
    expect(l.problems).toHaveLength(names.length);
    for (const p of l.problems) expect(p).toContain('unknown kind');
    expect(() => spawnLayout(new EntityStore([1, 1, 1, 1, 1, 1, 1]), l)).not.toThrow();
  });

  it('reports a position or scale that is not a finite number instead of using a default', () => {
    const huge = JSON.parse(
      '{"nodes":[{"id":"far","content":{"type":"asset","asset":"piece-rock"},"transform":{"position":[1e400,2,0],"scale":1e400}}]}',
    );
    const l = parseLayout(huge);
    expect(l.entities).toEqual([]);
    expect(l.problems).toEqual(['far: position x and y must be numbers', 'far: scale must be finite numbers']);
    const bad = parseLayout(
      doc(node('p', 'piece-rock', ['1', 2, 3] as never, 0.1), node('q', 'piece-rock', [1] as never, 0.1)),
    );
    expect(bad.problems).toEqual(['p: position x and y must be numbers', 'q: position x and y must be numbers']);
    expect(bad.entities.map((e) => [e.x, e.y])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('reports a scale list with something other than numbers in it', () => {
    const l = parseLayout(
      doc(node('a', 'piece-rock', [0, 0, 0], ['x', 1, 1] as never), node('b', 'marker-gap', [0, 0, 0], 'big' as never)),
    );
    expect(l.problems).toEqual(['a: scale must be finite numbers', 'b: scale must be finite numbers']);
  });

  it('refuses a marker with a zero or negative size', () => {
    const l = parseLayout(
      doc(
        node('m1', 'marker-gap', [0, 0, 0], [-1, 0, 1]),
        node('m2', 'marker-gap', [0, 0, 0], [0.5, 0, 1]),
        node('ok', 'marker-gap', [0, 0, 0], [0.5, 0.2, 1]),
      ),
    );
    expect(l.problems).toEqual([
      "m1: scale (the marker's width and height) must be above 0",
      "m2: scale (the marker's width and height) must be above 0",
    ]);
    expect(l.markers.map((m) => m.id)).toEqual(['ok']);
  });

  it('says a rotation set in the editor is ignored, but not a zero rotation', () => {
    const rotated = (id: string, asset: string, deg: number[]) => ({
      id,
      content: { type: 'asset', asset },
      transform: { position: [0, 0, 0], scale: 0.1, rotationDeg: deg },
    });
    const l = parseLayout(
      doc(
        rotated('a', 'piece-rock', [0, 0, 45]),
        rotated('b', 'marker-gap', [0, 90, 0]),
        rotated('c', 'piece-rock', [0, 0, 0]),
      ),
    );
    expect(l.problems).toEqual(['a: rotation is ignored', 'b: rotation is ignored']);
    expect(l.entities.map((e) => e.id)).toEqual(['a', 'c']);
  });
});

describe('parseLayout with a puzzle named by rootId', () => {
  const puzzle = (extra: object = {}, children: unknown[] = [node('r', 'piece-rock', [1, 0, 0], 0.1)]) => ({
    id: 'puz',
    content: { type: 'group' },
    transform: { position: [10, 0, 0] },
    children,
    ...extra,
  });

  it('gives what the same puzzle gives when found among everything', () => {
    const d = doc({ id: 'wrap', transform: { position: [100, 0, 0] }, children: [puzzle()] });
    expect(parseLayout(d, 'puz').entities.map((e) => e.x)).toEqual([111]);
    expect(parseLayout(d).entities.map((e) => e.x)).toEqual([111]);
  });

  it('leaves out a puzzle that is under a node switched off, and says it could not be found', () => {
    const d = doc({ id: 'wrap', visible: false, children: [puzzle()] });
    const l = parseLayout(d, 'puz');
    expect(l.entities).toEqual([]);
    expect(l.problems).toEqual(['no node with id "puz" (or it is under a node switched off in the editor)']);
    expect(parseLayout(d).entities).toEqual([]);
  });

  it('says so when the puzzle itself is switched off', () => {
    const l = parseLayout(doc(puzzle({ visible: false })), 'puz');
    expect(l.entities).toEqual([]);
    expect(l.problems).toEqual(['puz: switched off in the editor']);
  });

  it('reports a rotated or scaled ancestor of the puzzle, as it does without a rootId', () => {
    const d = doc({ id: 'wrap', transform: { rotationDeg: [0, 0, 30] }, children: [puzzle()] });
    expect(parseLayout(d, 'puz').problems).toEqual(['wrap: rotation or scale on a parent is ignored']);
    expect(parseLayout(d).problems).toEqual(['wrap: rotation or scale on a parent is ignored']);
  });

  it('does not report a rotated parent of a different puzzle', () => {
    const d = doc(
      { id: 'other', transform: { rotationDeg: [0, 0, 30] }, children: [node('x', 'piece-rock', [0, 0, 0], 0.1)] },
      puzzle(),
    );
    expect(parseLayout(d, 'puz').problems).toEqual([]);
  });

  it('reports a duplicate id and uses the first', () => {
    const l = parseLayout(doc(puzzle(), puzzle({}, [node('other', 'piece-fox', [0, 0, 0], 0.1)])), 'puz');
    expect(l.problems).toEqual(['more than one node has the id "puz"; the first is used']);
    expect(l.entities.map((e) => e.id)).toEqual(['r']);
  });
});

describe('parseLayout of one puzzle in a chapter file', () => {
  it('reads only that puzzle', () => {
    const l = parseLayout(chapter1, 'puzzle-1');
    expect(l.problems).toEqual([]);
    expect(l.entities.map((e) => `${e.id}:${e.kind}`)).toEqual([
      `p1-traveller:${Kind.Traveller}`,
      `p1-rock:${Kind.Rock}`,
    ]);
    expect(l.markers.map((m) => m.tag)).toEqual(['gap', 'goal']);
    expect(l.entities[1]).toMatchObject({ x: 1.2, y: 0.3, radius: 0.08, flags: Flag.Static });
    expect(l.markers[0].params).toEqual({ width: 0.6, height: 0.2 });
  });

  it('keeps the position the puzzle group has in the file, and reads the Piece speed', () => {
    const l = parseLayout(chapter1, 'puzzle-2');
    expect(l.problems).toEqual([]);
    expect(l.entities[0]).toMatchObject({ id: 'p2-crow', x: 6, y: 0.5, vx: -0.3, vy: 0 });
  });

  it('finds a node nested deeper, and reports a missing one', () => {
    expect(parseLayout(chapter1, 'p1-rock').entities.map((e) => e.id)).toEqual(['p1-rock']);
    const l = parseLayout(chapter1, 'puzzle-9');
    expect(l.entities).toEqual([]);
    expect(l.problems).toEqual(['no node with id "puzzle-9" (or it is under a node switched off in the editor)']);
  });

  it('reads the whole file when no puzzle is named', () => {
    expect(parseLayout(chapter1).entities.map((e) => e.id)).toEqual(['p1-traveller', 'p1-rock', 'p2-crow']);
  });
});

describe('spawnLayout', () => {
  const caps = [1, 3, 0, 1, 0, 0, 0];

  it('creates every entity in the store and hands back their handles', () => {
    const store = new EntityStore(caps);
    const handles: Handle[] = [];
    expect(spawnLayout(store, parseLayout(chapter1), handles)).toBe(3);
    expect(store.count).toBe(3);
    expect(handles).toHaveLength(3);
    const rock = store.slotOf(handles[1]);
    expect([store.kind[rock], store.x[rock], store.y[rock], store.flags[rock]]).toEqual([
      Kind.Rock,
      1.2,
      0.3,
      Flag.Static,
    ]);
    expect(store.radius[rock]).toBeCloseTo(0.08, 6);
    const crow = store.slotOf(handles[2]);
    expect(store.vx[crow]).toBeCloseTo(-0.3, 12);
  });

  it('is repeatable: the same layout gives the same slots and values', () => {
    const run = () => {
      const store = new EntityStore(caps);
      const handles: Handle[] = [];
      spawnLayout(store, parseLayout(chapter1), handles);
      return [handles.join(), Array.from(store.x).join(), Array.from(store.kind).join()].join('|');
    };
    expect(run()).toBe(run());
  });

  it('skips what does not fit, counts it, and carries on', () => {
    const store = new EntityStore([1, 0, 0, 1, 0, 0, 0]); // a traveller and a crow fit, the rock does not
    const handles: Handle[] = [];
    expect(spawnLayout(store, parseLayout(chapter1), handles)).toBe(2);
    expect(store.overflowCount).toBe(1);
    expect(handles).toHaveLength(2);
  });

  it('clears the handles list it is given', () => {
    const store = new EntityStore(caps);
    const handles: Handle[] = [999 as Handle];
    spawnLayout(store, parseLayout(chapter1, 'puzzle-2'), handles);
    expect(handles).toHaveLength(1);
    expect(handles[0]).not.toBe(999);
  });

  it('works without a handles list', () => {
    expect(spawnLayout(new EntityStore(caps), parseLayout(chapter1, 'puzzle-1'))).toBe(2);
  });
});
