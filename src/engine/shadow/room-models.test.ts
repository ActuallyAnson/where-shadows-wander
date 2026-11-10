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
  it('lists the bed, the bookcase and the rug as replacing their painted stand-ins, with asset ids as the manifest names them', () => {
    expect(ROOM_PIECES.filter((p) => p.replaces).map((p) => p.replaces)).toEqual(['bed', 'bookcase', 'rug']);
    for (const p of ROOM_PIECES) for (const id of p.ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it('keeps every piece inside the room, short of the nearest the wall ahead can come (z = -1.52)', () => {
    for (const p of ROOM_PIECES) {
      const [w, d] = p.size;
      const c = Math.abs(Math.cos(p.yaw ?? 0)),
        s = Math.abs(Math.sin(p.yaw ?? 0));
      const halfX = (w * c + d * s) / 2,
        halfZ = (w * s + d * c) / 2;
      expect(p.at[0] - halfX, p.ids[0]).toBeGreaterThanOrEqual(-2);
      expect(p.at[0] + halfX, p.ids[0]).toBeLessThanOrEqual(2);
      expect(p.at[2] - halfZ, p.ids[0]).toBeGreaterThanOrEqual(-1.52);
      expect(p.at[2] + halfZ, p.ids[0]).toBeLessThanOrEqual(1.85);
    }
  });
});
