import { describe, expect, it } from 'vitest';
import { QualityGovernor } from '../engine/shadow/pure/quality-governor';
import { FrameInspector } from './frame-inspector';

const info = { render: { calls: 54, triangles: 4850 }, memory: { textures: 44, geometries: 70 } };

describe('FrameInspector', () => {
  it('has nothing to say until a window of frames has passed, then gives one line of numbers', () => {
    const g = new QualityGovernor();
    const f = new FrameInspector(info, g, 10);
    expect(f.line).toBe('');
    for (let i = 0; i < 9; i++) f.update(14);
    expect(f.line).toBe('');
    f.update(20);
    expect(f.line).toContain('14.6 ms');
    expect(f.line).toContain('worst 20.0');
    expect(f.line).toContain('54 calls');
    expect(f.line).toContain('4.8k tris');
    expect(f.line).toContain('44 tex');
    expect(f.line).toContain('quality 0');
    expect(f.snapshot).toMatchObject({ calls: 54, textures: 44, level: 0 });
  });

  it('shows the governor level, starts a fresh window each time, and ignores bad frame times', () => {
    const g = new QualityGovernor();
    const f = new FrameInspector(info, g, 5);
    for (let i = 0; i < 5; i++) f.update(30);
    expect(f.snapshot.frameMs).toBeCloseTo(30, 5);
    g.level = 2;
    f.update(NaN);
    f.update(-1);
    f.update(99999);
    for (let i = 0; i < 5; i++) f.update(10);
    expect(f.snapshot.frameMs).toBeCloseTo(10, 5);
    expect(f.snapshot.worstMs).toBe(10);
    expect(f.line).toContain('quality 2');
  });
});
