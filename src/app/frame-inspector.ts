// The frame inspector: a one-line account of what a frame costs, for the debug bar and for tests: how long frames take (smoothed, and
// the worst lately), the draw calls, triangles and textures the renderer reports, and the quality governor's level. It is rebuilt
// every so many frames, not every frame, so reading it costs nothing. Plain TypeScript (the renderer's counters are passed in).
import type { QualityGovernor } from '../engine/shadow/pure/quality-governor';

/** The part of three's WebGLRenderer.info this reads. */
export interface RenderInfo {
  readonly render: { readonly calls: number; readonly triangles: number };
  readonly memory: { readonly textures: number; readonly geometries: number };
}

export interface FrameSnapshot {
  readonly frameMs: number;
  readonly worstMs: number;
  readonly calls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly level: number;
}

export class FrameInspector {
  private frames = 0;
  private sum = 0;
  private worst = 0;
  private text = '';
  private snap: FrameSnapshot = { frameMs: 0, worstMs: 0, calls: 0, triangles: 0, textures: 0, level: 0 };

  constructor(
    private readonly info: RenderInfo,
    private readonly governor: QualityGovernor,
    /** Frames between rebuilds of the line. */
    private readonly every = 30,
  ) {}

  /** The line for the debug bar ("13.9 ms (worst 15.2) · 54 calls · 4.9k tris · 44 tex · quality 0"), empty until the first window ends. */
  get line(): string {
    return this.text;
  }

  /** The numbers behind the line, as of the last window. */
  get snapshot(): FrameSnapshot {
    return this.snap;
  }

  /** Once per frame, with how long the last frame took (ms). */
  update(frameMs: number): void {
    if (!(frameMs > 0) || frameMs > 1000) return;
    this.sum += frameMs;
    if (frameMs > this.worst) this.worst = frameMs;
    if (++this.frames < this.every) return;
    const i = this.info;
    this.snap = {
      frameMs: this.sum / this.frames,
      worstMs: this.worst,
      calls: i.render.calls,
      triangles: i.render.triangles,
      textures: i.memory.textures,
      level: this.governor.level,
    };
    const s = this.snap;
    this.text = `${s.frameMs.toFixed(1)} ms (worst ${s.worstMs.toFixed(1)}) · ${s.calls} calls · ${(s.triangles / 1000).toFixed(1)}k tris · ${s.textures} tex · quality ${s.level}`;
    this.frames = 0;
    this.sum = 0;
    this.worst = 0;
  }
}
