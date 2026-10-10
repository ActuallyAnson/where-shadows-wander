// A stand-in drawing of the game, until Teammate B's renderer exists: the terrain, entities and
// puzzle objects as coloured lines on the stage, plus a text panel on the page with the game's
// state, its events and buttons to restart or switch puzzles. Debug only; ?gameview=0 turns it off.
import { BufferAttribute, BufferGeometry, Group, LineBasicMaterial, LineSegments, Matrix4 } from '@iwsdk/core';
import type { StagePlane } from '../engine/shadow/pure/stage-plane';
import { CAPSULE_STRIDE } from '../engine/hands/hand-shadow';
import { Kind } from '../engine/sim/entity-kinds';
import { DebugSnapshot, describe, fillSnapshot } from '../game/debug-snapshot';
import type { Game } from '../game/game';

/** Line vertices per frame; enough for the chapter's entities, terrain and fixtures. */
const MAX_VERTS = 16384;
/** Lines sit this far in front of the paper, metres, so the shadows don't hide them. */
const LIFT_M = 0.004;
const CIRCLE_SEGS = 12;
const ARC_SEGS = 4;

// Colours (r, g, b in 0..1): bright, to read on the dimly lit paper.
const TERRAIN = [1, 0.95, 0.8];
const TERRAIN_OFF = [0.45, 0.4, 0.3];
const KIND_COLOUR: (readonly number[])[] = [];
KIND_COLOUR[Kind.Traveller] = [1, 0.25, 0.2];
KIND_COLOUR[Kind.Rock] = [0.75, 0.75, 0.75];
KIND_COLOUR[Kind.Raindrop] = [0.4, 0.7, 1];
KIND_COLOUR[Kind.Crow] = [0.7, 0.6, 1];
KIND_COLOUR[Kind.Rabbit] = [0.9, 0.5, 1];
KIND_COLOUR[Kind.Fox] = [1, 0.6, 0.1];
KIND_COLOUR[Kind.Firefly] = [1, 1, 0.3];
const FIXTURE_ON = [0.3, 1, 0.5];
const FIXTURE_OFF = [0.15, 0.4, 0.2];
const HINT = [1, 0.3, 0.8];

export class GameDebugView {
  readonly group = new Group();
  private readonly positions = new Float32Array(MAX_VERTS * 3);
  private readonly colours = new Float32Array(MAX_VERTS * 3);
  private readonly geometry = new BufferGeometry();
  private readonly lines: LineSegments;
  private n = 0;
  private c: readonly number[] = TERRAIN;
  private hintX = 0;
  private hintY = 0;
  private hintShape = '';
  private readonly snap = new DebugSnapshot();
  private readonly panel: HTMLDivElement;
  private readonly status: HTMLPreElement;
  private readonly log: HTMLPreElement;
  private readonly logLines: string[] = [];
  private panelFrames = 0;

  constructor(private readonly game: Game) {
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new BufferAttribute(this.colours, 3));
    this.lines = new LineSegments(
      this.geometry,
      new LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    this.lines.renderOrder = 10;
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;

    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:9999;max-width:min(560px,calc(100vw - 16px));' +
      'background:rgba(20,16,12,.85);color:#f2e6c9;font:12px/1.35 ui-monospace,monospace;' +
      'padding:8px;border-radius:6px;';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;';
    const button = (label: string, act: () => void) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'font:inherit;padding:2px 8px;cursor:pointer;';
      b.addEventListener('click', act);
      buttons.append(b);
    };
    button('◀ prev', () => this.goto(game.puzzleIndex - 1));
    button('restart', () => game.restart());
    button('next ▶', () => this.goto(game.puzzleIndex + 1));
    button('hide', () => {
      const hidden = this.status.style.display === 'none';
      this.status.style.display = this.log.style.display = hidden ? '' : 'none';
    });
    this.status = document.createElement('pre');
    this.log = document.createElement('pre');
    for (const p of [this.status, this.log]) p.style.cssText = 'margin:0;white-space:pre-wrap;';
    this.log.style.opacity = '0.75';
    this.panel.append(buttons, this.status, this.log);
    document.body.append(this.panel);
  }

  private goto(i: number): void {
    const n = this.game.puzzleCount;
    this.game.goto(((i % n) + n) % n);
  }

  /** Puts the drawing on the stage. Call when the stage moves. */
  place(stage: StagePlane): void {
    const r = stage.right,
      u = stage.up,
      nn = stage.normal,
      o = stage.origin;
    // prettier-ignore
    this.group.matrix.copy(new Matrix4().set(
      r[0], u[0], nn[0], o[0] + nn[0] * LIFT_M,
      r[1], u[1], nn[1], o[1] + nn[1] * LIFT_M,
      r[2], u[2], nn[2], o[2] + nn[2] * LIFT_M,
      0, 0, 0, 1,
    ));
    this.group.matrixWorldNeedsUpdate = true;
    this.group.visible = true;
  }

  /** Redraws from the game's state; call after game.frame() with the alpha it returned. */
  update(alpha: number): void {
    const g = this.game;
    this.readEvents();
    this.n = 0;

    // Terrain: solid when enabled, faint when switched off (an open gate, a rope not yet down).
    const t = g.solver.terrain;
    for (let i = 0; i < t.count; i++) {
      const o = i * CAPSULE_STRIDE;
      this.c = t.enabled[i] ? TERRAIN : TERRAIN_OFF;
      this.capsule(t.data[o], t.data[o + 1], t.data[o + 2], t.data[o + 3], t.data[o + 4]);
    }

    // Puzzle objects as boxes; a pressed plate or opened gate shows its value as a bar.
    const f = g.fixtures;
    for (let i = 0; i < f.count; i++) {
      const x = f.at(i);
      this.c = x.active ? FIXTURE_ON : FIXTURE_OFF;
      this.box(x.x, x.y, x.w / 2, x.h / 2);
      if (x.value > 0)
        this.seg(x.x - x.w / 2, x.y - x.h / 2, x.x - x.w / 2 + x.w * Math.min(x.value, 1), x.y - x.h / 2);
    }

    // Entities, interpolated between the last two steps; a velocity tick shows where each is heading.
    const s = g.store;
    for (let i = 0; i < s.capacity; i++) {
      if (!s.alive[i]) continue;
      const x = s.px[i] + (s.x[i] - s.px[i]) * alpha,
        y = s.py[i] + (s.y[i] - s.py[i]) * alpha;
      this.c = KIND_COLOUR[s.kind[i]] ?? TERRAIN;
      this.circle(x, y, s.radius[i]);
      if (s.kind[i] === Kind.Traveller) {
        this.circle(x, y, s.radius[i] * 0.5);
        this.seg(x, y, x + s.vx[i] * 0.3, y + s.vy[i] * 0.3);
      }
    }

    // The ghost hint: a cross where the shape should go.
    if (this.hintShape) {
      this.c = HINT;
      this.seg(this.hintX - 0.05, this.hintY - 0.05, this.hintX + 0.05, this.hintY + 0.05);
      this.seg(this.hintX - 0.05, this.hintY + 0.05, this.hintX + 0.05, this.hintY - 0.05);
      this.circle(this.hintX, this.hintY, 0.08);
    }

    this.geometry.setDrawRange(0, this.n);
    (this.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geometry.attributes.color as BufferAttribute).needsUpdate = true;

    // The text panel, a few times a second.
    if (++this.panelFrames >= 10) {
      this.panelFrames = 0;
      fillSnapshot(g, this.snap);
      const lines = describe(this.snap, g);
      if (this.hintShape)
        lines.push(`HINT: make a ${this.hintShape} at (${this.hintX.toFixed(2)}, ${this.hintY.toFixed(2)})`);
      this.status.textContent = lines.join('\n');
    }
  }

  private readEvents(): void {
    const ev = this.game.events;
    let changed = false;
    for (let i = 0; i < ev.count; i++) {
      const e = ev.at(i);
      if (e.type === 'hint-show') {
        this.hintShape = e.id;
        this.hintX = e.x;
        this.hintY = e.y;
      } else if (e.type === 'hint-hide' || e.type === 'puzzle-start') this.hintShape = '';
      // The traveller's state changes and splashes are too chatty for the log.
      if (e.type === 'traveller-state' || e.type === 'splash' || e.type === 'caught') continue;
      const line = `${this.game.time.toFixed(1)} ${e.type}${e.id ? ' ' + e.id : ''}${e.hand ? ' (' + e.hand + ')' : ''}`;
      this.logLines.push(line);
      console.info('[game]', line);
      changed = true;
    }
    if (!changed) return;
    while (this.logLines.length > 8) this.logLines.shift();
    this.log.textContent = this.logLines.join('\n');
  }

  private seg(ax: number, ay: number, bx: number, by: number): void {
    if (this.n + 2 > MAX_VERTS) return;
    const p = this.positions,
      c = this.colours,
      col = this.c;
    let o = this.n * 3;
    p[o] = ax;
    p[o + 1] = ay;
    p[o + 2] = 0;
    p[o + 3] = bx;
    p[o + 4] = by;
    p[o + 5] = 0;
    for (let k = 0; k < 2; k++, o += 3) {
      c[o] = col[0];
      c[o + 1] = col[1];
      c[o + 2] = col[2];
    }
    this.n += 2;
  }

  private circle(x: number, y: number, r: number): void {
    for (let k = 0; k < CIRCLE_SEGS; k++) {
      const a = (k / CIRCLE_SEGS) * Math.PI * 2,
        b = ((k + 1) / CIRCLE_SEGS) * Math.PI * 2;
      this.seg(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r, y + Math.sin(b) * r);
    }
  }

  private box(x: number, y: number, hw: number, hh: number): void {
    this.seg(x - hw, y - hh, x + hw, y - hh);
    this.seg(x + hw, y - hh, x + hw, y + hh);
    this.seg(x + hw, y + hh, x - hw, y + hh);
    this.seg(x - hw, y + hh, x - hw, y - hh);
  }

  /** A capsule's outline: two sides and a half circle at each end. */
  private capsule(ax: number, ay: number, bx: number, by: number, r: number): void {
    const dx = bx - ax,
      dy = by - ay;
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) {
      this.circle(ax, ay, r);
      return;
    }
    const nx = (-dy / l) * r,
      ny = (dx / l) * r;
    this.seg(ax + nx, ay + ny, bx + nx, by + ny);
    this.seg(ax - nx, ay - ny, bx - nx, by - ny);
    const base = Math.atan2(ny, nx);
    for (let k = 0; k < ARC_SEGS; k++) {
      const a0 = base + (k / ARC_SEGS) * Math.PI,
        a1 = base + ((k + 1) / ARC_SEGS) * Math.PI;
      this.seg(ax + Math.cos(a0) * r, ay + Math.sin(a0) * r, ax + Math.cos(a1) * r, ay + Math.sin(a1) * r);
      this.seg(bx - Math.cos(a0) * r, by - Math.sin(a0) * r, bx - Math.cos(a1) * r, by - Math.sin(a1) * r);
    }
  }
}
