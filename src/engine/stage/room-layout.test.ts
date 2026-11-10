import { describe, expect, it } from 'vitest';
import {
  emptyRoomLayout,
  footprint,
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
