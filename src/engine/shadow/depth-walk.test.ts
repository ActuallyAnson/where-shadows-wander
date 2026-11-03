import { describe, expect, it } from 'vitest';
import { FAR_M, project, placeProps, ROAD_M, roadX } from './depth-walk';
import { LAND_IDS } from './walk-lands';

describe('the depth walk', () => {
  it('shows things smaller and higher on the screen the further away they are', () => {
    const cam = { x: 0, z: 0 };
    const near = { sx: 0, sy: 0, px: 0 };
    const far = { sx: 0, sy: 0, px: 0 };
    expect(project(cam, 0, 3, 1280, 720, near)).toBe(true);
    expect(project(cam, 0, 30, 1280, 720, far)).toBe(true);
    expect(far.px).toBeLessThan(near.px);
    expect(far.sy).toBeLessThan(near.sy); // nearer the horizon
    expect(near.sx).toBeCloseTo(640, 3); // straight ahead stays in the middle
  });

  it('puts a point to the right of the camera on the right of the screen, and loses what is behind it', () => {
    const cam = { x: 0, z: 0 };
    const out = { sx: 0, sy: 0, px: 0 };
    project(cam, 2, 5, 1280, 720, out);
    expect(out.sx).toBeGreaterThan(640);
    expect(project(cam, 0, -1, 1280, 720, out)).toBe(false);
  });

  it.each(LAND_IDS)('winds %s smoothly and lines its roadside with things in order', (land) => {
    let last = roadX(land, 0);
    for (let z = 0.2; z < FAR_M; z += 0.2) {
      const x = roadX(land, z);
      expect(Math.abs(x - last)).toBeLessThan(0.5); // no jumps
      last = x;
    }
    const props = placeProps(land, 30);
    expect(props.length).toBeGreaterThan(5);
    for (let i = 1; i < props.length; i++) expect(props[i].z).toBeGreaterThanOrEqual(props[i - 1].z);
    for (const p of props) expect(Math.abs(p.off)).toBeGreaterThan(ROAD_M * 0.5); // never on the road itself
  });
});
