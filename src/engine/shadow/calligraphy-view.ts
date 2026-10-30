// A page of calligraphy that draws itself: a glowing pen tip traces each letter's outline, leaving a bright line that cools to
// a thin gold, and each letter fills with warm white behind it. Made for the dark (the prologue's black void), where white on
// black reads best. The outlines come from calligraphy-plan.ts; they become two meshes built when the page starts (the traced
// lines and the fills), and a shader shows each point only once the pen's clock has passed its time, so a frame only moves the
// clock and the pen's glow: no canvas is redrawn and no texture uploaded while it draws.
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  ShapeUtils,
  SRGBColorSpace,
  Vector2,
} from '@iwsdk/core';
import { CALLIGRAPHY_EM } from './pure/calligraphy-glyphs';
import { planCalligraphyIn, type CalligraphyPlan, type TracedGlyph } from './pure/calligraphy-plan';

/** Draw order: above everything in the scene (the prologue hides the rest anyway). */
const ORDER_FILL = 100;
const ORDER_LINE = 101;
const ORDER_PEN = 102;
/** Half the thickness of the traced line, in font units. */
const HALF_LINE = 11;
/** Seconds the page fades out for at the end. */
const FADE_OUT_S = 1;
/** Seconds the pen's glow lingers after the last letter. */
const PEN_LINGER_S = 0.4;

const LINE_VERTEX = /* glsl */ `
attribute float aT;
varying float vT;
void main() {
  vT = aT;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Each point shows once the pen has passed it, hot white at the tip and cooling to a soft gold behind it.
const LINE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFade;
varying float vT;
void main() {
  if (vT > uTime) discard;
  float head = exp(-(uTime - vT) * 4.5);
  vec3 col = mix(vec3(1.0, 0.86, 0.6), vec3(1.0), head);
  gl_FragColor = vec4(col, (0.55 + 0.45 * head) * uFade);
  #include <colorspace_fragment>
}`;

const FILL_VERTEX = /* glsl */ `
attribute float aDone;
varying float vDone;
void main() {
  vDone = aDone;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// A letter fills in as the pen leaves it.
const FILL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uFade;
varying float vDone;
void main() {
  float k = smoothstep(vDone - 0.12, vDone + 0.5, uTime);
  gl_FragColor = vec4(1.0, 0.95, 0.84, k * 0.93 * uFade);
  #include <colorspace_fragment>
}`;

function pointInside(poly: readonly Vector2[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface PageOptions {
  /** Seconds the pen takes to write the page. */
  write: number;
  /** Seconds the page stays once written, before it fades. */
  hold: number;
  /** Ems a line may be, before the text wraps. */
  maxEm: number;
}

export class CalligraphyView {
  readonly group = new Group();
  private readonly lineMat: ShaderMaterial;
  private readonly fillMat: ShaderMaterial;
  private readonly penMat: MeshBasicMaterial;
  private readonly pen: Mesh;
  private lines: Mesh | null = null;
  private fills: Mesh | null = null;
  private plan: CalligraphyPlan | null = null;
  private time = 0;
  private hold = 0;
  private scale = 0.0002;
  private readonly at = { x: 0, y: 0 };

  /** @param emMetres how tall the font's em is on the wall, in metres. */
  constructor(private readonly emMetres = 0.17) {
    const uniforms = () => ({ uTime: { value: 0 }, uFade: { value: 1 } });
    this.lineMat = new ShaderMaterial({
      uniforms: uniforms(),
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    this.fillMat = new ShaderMaterial({
      uniforms: uniforms(),
      vertexShader: FILL_VERTEX,
      fragmentShader: FILL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: NormalBlending,
      side: DoubleSide,
    });
    let map: CanvasTexture | null = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext ? c.getContext('2d') : null;
      if (g) {
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 252, 240, 1)');
        grad.addColorStop(0.2, 'rgba(255, 214, 140, 0.75)');
        grad.addColorStop(1, 'rgba(255, 170, 70, 0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        map = new CanvasTexture(c);
        map.colorSpace = SRGBColorSpace;
      }
    }
    this.penMat = new MeshBasicMaterial({
      map,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.pen = new Mesh(new PlaneGeometry(1, 1), this.penMat);
    this.pen.renderOrder = ORDER_PEN;
    this.pen.visible = false;
    this.group.add(this.pen);
    this.group.visible = false;
  }

  /** Whether a page is being written or held. */
  get playing(): boolean {
    return this.plan !== null;
  }

  /** How far into the page the pen's clock is, in seconds. */
  get clock(): number {
    return this.time;
  }

  /** The pen's travel time for the current page (zero when there is none). */
  get duration(): number {
    return this.plan?.duration ?? 0;
  }

  /** Starts writing `text`. A page already up is replaced. */
  show(text: string, options: Partial<PageOptions> = {}): void {
    this.clear();
    const { write = 5, hold = 2, maxEm = 15 } = options;
    const plan = planCalligraphyIn(text, maxEm, write);
    if (plan.glyphs.length === 0) return;
    this.plan = plan;
    this.hold = Math.max(0, hold);
    this.time = 0;
    this.scale = this.emMetres / CALLIGRAPHY_EM;
    this.lines = new Mesh(this.buildLines(plan), this.lineMat);
    this.lines.renderOrder = ORDER_LINE;
    this.lines.frustumCulled = false;
    this.fills = new Mesh(this.buildFills(plan), this.fillMat);
    this.fills.renderOrder = ORDER_FILL;
    this.fills.frustumCulled = false;
    this.group.add(this.fills, this.lines);
    this.penMat.opacity = 1;
    this.setUniforms(0, 1);
    this.group.visible = true;
  }

  /** Takes the page away now. */
  clear(): void {
    for (const m of [this.lines, this.fills]) {
      if (!m) continue;
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.lines = this.fills = null;
    this.plan = null;
    this.pen.visible = false;
    this.group.visible = false;
  }

  /** Once per frame. Allocates nothing. */
  update(dt: number): void {
    const plan = this.plan;
    if (!plan) return;
    this.time += dt > 0 ? Math.min(dt, 0.1) : 0;
    const end = plan.duration + this.hold;
    if (this.time >= end + FADE_OUT_S) {
      this.clear();
      return;
    }
    const fade = this.time <= end ? 1 : Math.max(0, 1 - (this.time - end) / FADE_OUT_S);
    this.setUniforms(this.time, fade);
    const writing = this.time < plan.duration + PEN_LINGER_S;
    this.pen.visible = writing;
    if (writing) {
      plan.penAt(this.time, this.at);
      const s = this.scale;
      const size = this.emMetres * (0.5 + 0.06 * Math.sin(this.time * 23));
      this.pen.position.set((this.at.x - plan.width / 2) * s, (this.at.y + plan.height / 2) * s, 0.003);
      this.pen.scale.set(size, size, 1);
      this.penMat.opacity = Math.min(1, (plan.duration + PEN_LINGER_S - this.time) / PEN_LINGER_S);
    }
  }

  dispose(): void {
    this.clear();
    this.lineMat.dispose();
    this.fillMat.dispose();
    this.pen.geometry.dispose();
    this.penMat.map?.dispose();
    this.penMat.dispose();
  }

  private setUniforms(time: number, fade: number): void {
    this.lineMat.uniforms.uTime.value = time;
    this.lineMat.uniforms.uFade.value = fade;
    this.fillMat.uniforms.uTime.value = time;
    this.fillMat.uniforms.uFade.value = fade;
  }

  /** The traced outlines: a thin ribbon along each, each point carrying the second the pen reaches it. */
  private buildLines(plan: CalligraphyPlan): BufferGeometry {
    let segments = 0;
    for (const g of plan.glyphs) for (const c of g.contours) segments += c.times.length - 1;
    const pos = new Float32Array(segments * 4 * 3);
    const tt = new Float32Array(segments * 4);
    const idx = new Uint32Array(segments * 6);
    const cx = plan.width / 2;
    const cy = plan.height / 2;
    const s = this.scale;
    let v = 0;
    for (const g of plan.glyphs) {
      for (const c of g.contours) {
        for (let i = 0; i < c.times.length - 1; i++) {
          const x0 = c.points[i * 2];
          const y0 = c.points[i * 2 + 1];
          const x1 = c.points[i * 2 + 2];
          const y1 = c.points[i * 2 + 3];
          const dx = x1 - x0;
          const dy = y1 - y0;
          const len = Math.hypot(dx, dy) || 1;
          const nx = (-dy / len) * HALF_LINE;
          const ny = (dx / len) * HALF_LINE;
          const corners = [
            [x0 + nx, y0 + ny, c.times[i]],
            [x0 - nx, y0 - ny, c.times[i]],
            [x1 + nx, y1 + ny, c.times[i + 1]],
            [x1 - nx, y1 - ny, c.times[i + 1]],
          ];
          for (let k = 0; k < 4; k++) {
            pos[(v + k) * 3] = (corners[k][0] - cx) * s;
            pos[(v + k) * 3 + 1] = (corners[k][1] + cy) * s;
            pos[(v + k) * 3 + 2] = 0;
            tt[v + k] = corners[k][2];
          }
          const q = v / 4;
          idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], q * 6);
          v += 4;
        }
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new Float32BufferAttribute(tt, 1));
    geo.setIndex(Array.from(idx));
    return geo;
  }

  /** The letters' fills: each outline triangulated with its holes, every vertex carrying the second its letter is done. */
  private buildFills(plan: CalligraphyPlan): BufferGeometry {
    const positions: number[] = [];
    const done: number[] = [];
    const indices: number[] = [];
    const cx = plan.width / 2;
    const cy = plan.height / 2;
    const s = this.scale;
    for (const g of plan.glyphs) this.fillGlyph(g, positions, done, indices, cx, cy, s);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aDone', new Float32BufferAttribute(done, 1));
    geo.setIndex(indices);
    return geo;
  }

  private fillGlyph(
    g: TracedGlyph,
    positions: number[],
    done: number[],
    indices: number[],
    cx: number,
    cy: number,
    s: number,
  ): void {
    const toPoly = (points: Float32Array): Vector2[] => {
      const poly: Vector2[] = [];
      // The last point repeats the first (the pen closes the outline); the fill does not need it.
      for (let i = 0; i < points.length / 2 - 1; i++) poly.push(new Vector2(points[i * 2], points[i * 2 + 1]));
      return poly;
    };
    const outers = g.contours.filter((c) => !c.hole).map((c) => toPoly(c.points));
    const holes = g.contours.filter((c) => c.hole).map((c) => toPoly(c.points));
    const own: Vector2[][][] = outers.map(() => []);
    for (const h of holes) {
      const k = outers.findIndex((o) => pointInside(o, h[0].x, h[0].y));
      if (k >= 0) own[k].push(h);
    }
    outers.forEach((outer, k) => {
      const base = positions.length / 3;
      const all = [outer, ...own[k]].flat();
      for (const p of all) {
        positions.push((p.x - cx) * s, (p.y + cy) * s, 0);
        done.push(g.doneAt);
      }
      for (const face of ShapeUtils.triangulateShape(outer, own[k]))
        indices.push(base + face[0], base + face[1], base + face[2]);
    });
  }
}
