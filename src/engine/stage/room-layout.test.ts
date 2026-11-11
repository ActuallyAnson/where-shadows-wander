import { describe, expect, it } from 'vitest';
import {
  emptyRoomLayout,
  footprint,
  mergeLayout,
  modelIdsOf,
  nextPieceId,
  onFloor,
  parseRoomLayout,
  placement,
  placementOr,
  roundPlacement,
  samePlacement,
  serializeRoomLayout,
} from './room-layout';

describe('parseRoomLayout', () => {
  it('reads both sections, with rotation and scale defaulting to none and 1', () => {
    const { layout, problems } = parseRoomLayout({
      version: 1,
      room: { bed: { pos: [0, 0, -0.35], rotDeg: [0, 180, 0] } },
      lap: { quilt: { pos: [0, -0.1, 0.2], scale: [1, 1, 0.5] } },
    });
    expect(problems).toEqual([]);
    expect(layout.room.bed).toEqual(placement([0, 0, -0.35], [0, 180, 0]));
    expect(layout.lap.quilt).toEqual(placement([0, -0.1, 0.2], [0, 0, 0], [1, 1, 0.5]));
  });

  it('never throws, and names everything it leaves out', () => {
    for (const doc of [null, 3, 'x', [], undefined]) {
      const { layout, problems } = parseRoomLayout(doc);
      expect(layout).toEqual(emptyRoomLayout());
      expect(problems).toHaveLength(1);
    }
    const { layout, problems } = parseRoomLayout({
      version: 2,
      extra: {},
      room: {
        ok: { pos: [1, 2, 3] },
        'Bad Id': { pos: [0, 0, 0] },
        nopos: { rotDeg: [0, 0, 0] },
        nan: { pos: [0, Number.NaN, 0] },
        short: { pos: [0, 0] },
        flat: { pos: [0, 0, 0], scale: [1, 0, 1] },
        rot: { pos: [0, 0, 0], rotDeg: 'x' },
        notobj: 5,
        extrafield: { pos: [0, 0, 0], colour: 'red' },
      },
      lap: 'nope',
    });
    expect(Object.keys(layout.room).sort()).toEqual(['extrafield', 'ok']);
    expect(layout.lap).toEqual({});
    expect(problems).toHaveLength(11);
    expect(problems.join('\n')).toMatch(/version is 2/);
    expect(problems.join('\n')).toMatch(/unknown section "extra"/);
    expect(problems.join('\n')).toMatch(/room\.extrafield: unknown field "colour"/);
  });

  it('leaves out ids a section does not know, when told which it knows', () => {
    const { layout, problems } = parseRoomLayout(
      { version: 1, room: { bed: { pos: [0, 0, 0] }, sofa: { pos: [0, 0, 0] } } },
      { room: ['bed'] },
    );
    expect(Object.keys(layout.room)).toEqual(['bed']);
    expect(problems).toEqual(['room.sofa: no such piece']);
  });

  it('takes an added piece (one with a model) even though its id is not one it knows', () => {
    const { layout, problems } = parseRoomLayout(
      {
        version: 1,
        room: { bed: { pos: [0, 0, 0] }, 'lamp-2': { model: 'lamp-round-table', pos: [1, 0, -1], rotDeg: [0, 90, 0] } },
        lap: { mug: { model: 'mug', pos: [0, 0.02, 0] } },
      },
      { room: ['bed'], lap: [] },
    );
    expect(problems).toEqual([]);
    expect(layout.room['lamp-2']).toEqual({ ...placement([1, 0, -1], [0, 90, 0]), model: 'lamp-round-table' });
    expect(layout.lap.mug.model).toBe('mug');
    expect(layout.room.bed.model).toBeUndefined();
    expect(modelIdsOf(layout)).toEqual(['lamp-round-table', 'mug']);
  });

  it('refuses a model that is not an asset id, and a model on a built-in piece', () => {
    const { layout, problems } = parseRoomLayout(
      {
        version: 1,
        room: {
          bed: { model: 'chair', pos: [0, 0, 0] },
          chair: { model: 'Chair.glb', pos: [0, 0, 0] },
          stool: { model: 7, pos: [0, 0, 0] },
          lamp: { model: 'lamp', pos: [0, 0] },
        },
      },
      { room: ['bed', 'chair'] },
    );
    // The built-ins keep their placements without the model; the added pieces with a bad model or placement are left out.
    expect(Object.keys(layout.room).sort()).toEqual(['bed', 'chair']);
    expect(layout.room.bed.model).toBeUndefined();
    expect(layout.room.chair.model).toBeUndefined();
    expect(problems).toHaveLength(4);
    expect(problems.join('\n')).toMatch(/room\.bed: a built-in piece cannot show a model/);
    expect(problems.join('\n')).toMatch(/room\.stool: model must be an asset id/);
  });

  it('cannot be tricked by a "__proto__" key', () => {
    const doc = JSON.parse('{"version":1,"room":{"__proto__":{"pos":[0,0,0]}}}') as unknown;
    const { layout, problems } = parseRoomLayout(doc);
    expect(Object.keys(layout.room)).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(placementOr(layout, 'room', '__proto__', placement([1, 1, 1])).pos).toEqual([1, 1, 1]);
  });
});

describe('serializeRoomLayout', () => {
  it('writes sorted ids, one per line, rounded, and reads back the same', () => {
    const layout = emptyRoomLayout();
    layout.room.rug = placement([1.20004, -0.012, -0.35], [0, -90.04, 0]);
    layout.room.bed = placement([0, 0, -0.35], [0, 180, 0]);
    layout.lap.quilt = placement([0, -0.07, 0.14], [-78.26087, 0, 0], [1.0004, 1, 1]);
    const text = serializeRoomLayout(layout);
    expect(text).toBe(
      [
        '{',
        '  "version": 1,',
        '  "room": {',
        '    "bed": { "pos": [0, 0, -0.35], "rotDeg": [0, 180, 0], "scale": [1, 1, 1] },',
        '    "rug": { "pos": [1.2, -0.012, -0.35], "rotDeg": [0, -90, 0], "scale": [1, 1, 1] }',
        '  },',
        '  "lap": {',
        '    "quilt": { "pos": [0, -0.07, 0.14], "rotDeg": [-78.3, 0, 0], "scale": [1, 1, 1] }',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
    const back = parseRoomLayout(JSON.parse(text));
    expect(back.problems).toEqual([]);
    expect(serializeRoomLayout(back.layout)).toBe(text);
  });

  it("writes an added piece's model first, and reads it back", () => {
    const layout = emptyRoomLayout();
    layout.room['chair-2'] = { ...placement([1, 0, -0.5]), model: 'chair' };
    const text = serializeRoomLayout(layout);
    expect(text).toContain(
      '    "chair-2": { "model": "chair", "pos": [1, 0, -0.5], "rotDeg": [0, 0, 0], "scale": [1, 1, 1] }',
    );
    const back = parseRoomLayout(JSON.parse(text));
    expect(back.problems).toEqual([]);
    expect(serializeRoomLayout(back.layout)).toBe(text);
  });

  it('writes an empty section as {}', () => {
    expect(serializeRoomLayout(emptyRoomLayout())).toBe('{\n  "version": 1,\n  "room": {},\n  "lap": {}\n}\n');
  });
});

describe('placements', () => {
  it('rounds to 1 mm and 0.1°, wraps angles into (-180, 180] and keeps scales positive, with no -0', () => {
    const r = roundPlacement(placement([-0.0001, 1.23456, 2], [-180, 270, -190.3], [0, -1, 2.0004]));
    expect(r.pos).toEqual([0, 1.235, 2]);
    expect(Object.is(r.pos[0], -0)).toBe(false);
    expect(r.rotDeg).toEqual([180, -90, 169.7]);
    expect(roundPlacement(placement([0, 0, 0], [0, 0, 540.04])).rotDeg[2]).toBe(180);
    expect(r.scale).toEqual([0.01, 0.01, 2]);
  });

  it('compares placements as the file would store them', () => {
    expect(samePlacement(placement([0, 0, 0.0002]), placement([0, 0, 0]))).toBe(true);
    expect(samePlacement(placement([0, 0, 0], [0, 360, 0]), placement([0, 0, 0]))).toBe(true);
    expect(samePlacement(placement([0, 0, 0.002]), placement([0, 0, 0]))).toBe(false);
  });

  it('falls back to the code default, and hands out copies', () => {
    const layout = emptyRoomLayout();
    layout.room.bed = placement([1, 0, 0]);
    const fallback = placement([9, 9, 9]);
    const got = placementOr(layout, 'room', 'bed', fallback);
    got.pos[0] = 5;
    expect(layout.room.bed.pos[0]).toBe(1);
    expect(placementOr(layout, 'lap', 'bed', fallback)).toEqual(fallback);
    expect(placementOr(null, 'room', 'bed', fallback)).not.toBe(fallback);
  });

  it('measures a turned footprint, and checks it against the floor', () => {
    const f = footprint([0, 0, 0], [0.9, 1.7], 90);
    expect(f.maxX).toBeCloseTo(0.85);
    expect(f.maxZ).toBeCloseTo(0.45);
    expect(onFloor(f)).toBe(true);
    expect(onFloor(footprint([1.8, 0, 0], [0.6, 0.2], 0))).toBe(false);
    expect(onFloor(footprint([0, 0, -1.4], [0.4, 0.4], 0))).toBe(false);
  });
});

describe('merging what the editor holds into the layout', () => {
  const base = () => {
    const l = emptyRoomLayout();
    l.room.bed = placement([0, 0, 0]);
    l.room['lamp-2'] = { ...placement([1, 0, 0]), model: 'lamp' };
    l.room.ghost = { ...placement([2, 0, 0]), model: 'missing-file' };
    l.lap.tray = placement([0, 0, 0]);
    return l;
  };

  it("keeps the file's entries, drops the removed ones and writes every piece standing now", () => {
    const out = mergeLayout(
      base(),
      [
        { section: 'room', id: 'bed', placement: placement([0.5, 0, 0]) },
        { section: 'room', id: 'chair-2', placement: placement([1.23456, 0, 0]), model: 'chair' },
      ],
      new Set(['room:lamp-2']),
    );
    expect(Object.keys(out.room).sort()).toEqual(['bed', 'chair-2', 'ghost']);
    expect(out.room.bed).toEqual(placement([0.5, 0, 0]));
    expect(out.room['chair-2']).toEqual({ ...placement([1.235, 0, 0]), model: 'chair' });
    // A piece whose model never loaded is kept as the file had it.
    expect(out.room.ghost).toEqual({ ...placement([2, 0, 0]), model: 'missing-file' });
    expect(out.lap.tray).toEqual(placement([0, 0, 0]));
  });

  it('does not change the layout it was given', () => {
    const b = base();
    const before = serializeRoomLayout(b);
    mergeLayout(b, [{ section: 'room', id: 'bed', placement: placement([9, 0, 0]) }], new Set(['room:ghost']));
    expect(serializeRoomLayout(b)).toBe(before);
  });
});

describe('nextPieceId', () => {
  it('uses the name when it is free, else the next number', () => {
    const taken = new Set(['chair', 'chair-2', 'lamp', 'lamp-2']);
    const isTaken = (id: string) => taken.has(id);
    expect(nextPieceId('rug', isTaken)).toBe('rug');
    expect(nextPieceId('chair', isTaken)).toBe('chair-3');
    expect(nextPieceId('lamp-2', isTaken)).toBe('lamp-3');
    expect(nextPieceId('chair-9', isTaken)).toBe('chair-3');
    expect(nextPieceId('', isTaken)).toBe('piece');
  });
});
