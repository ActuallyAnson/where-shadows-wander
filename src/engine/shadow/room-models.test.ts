import { describe, expect, it } from 'vitest';
import { CandleLight } from './candle-light';
import { ROOM_PIECES, RoomModels } from './room-models';

describe('RoomModels', () => {
  it('places nothing and hides no painted piece when no model file is there', async () => {
    const hidden: string[] = [];
    const models = new RoomModels(
      () => false,
      (part) => void hidden.push(part),
    );
    const candle = new CandleLight();
    expect(await models.load(candle)).toBe(0);
    expect(models.group.children).toHaveLength(0);
    expect(hidden).toEqual([]);
    candle.dispose();
  });
  it('lists the bed and the bookcase as replacing their painted stand-ins, with asset ids as the manifest names them', () => {
    expect(ROOM_PIECES.filter((p) => p.replaces).map((p) => p.replaces)).toEqual(['bed', 'bookcase']);
    for (const p of ROOM_PIECES) for (const id of p.ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
