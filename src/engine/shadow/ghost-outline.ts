// The shape guide's ghost as an outline (shape-guide.ts): a scene (the shape's plain hand, OUTLINE_SHAPES in friend-puppet.ts),
// posed once, drawn as one silhouette and turned into a thin line just outside its edge, mirrored left to right so it faces her
// hand. The parts are joined first, so there is no line where they overlap: only the shape's own edge. The line lies outside the shape, so a shadow that fills it leaves the line showing, as a frame it fits. Baked into a
// canvas once per shape (on first use); PuppetView draws it as a one-part scene, its art looked up in `art`.
import type { PuppetScene } from '../stage/puppet/puppet-scene';
import { POSE_STRIDE } from '../stage/puppet/puppet-scene';
import { ScenePlayer } from '../stage/puppet/scene-player';
import { PUPPET_ART, type PuppetPainter } from './puppet-art';

/** The line's width, story metres (about 2 cm on the wall), and how soft its edges are, as a share of it. */
export const OUTLINE_LINE_M = 0.008;
const OUTLINE_SOFT = 0.25;
/** Pixels per story metre in the baked picture, and the most either side may have. */
const BAKE_PX_PER_M = 1200;
const BAKE_PX_MAX = 2048;
/** Directions round the ring the silhouette is stamped in to grow it by the line's width. */
const RING_STEPS = 24;

export class GhostOutlines {
  /** The baked pictures, by the art name each outline scene's one part uses: give it to PuppetView.extraArt. */
  readonly art: Record<string, PuppetPainter> = {};
  private readonly scenes = new Map<PuppetScene, PuppetScene>();

  /**
   * The outline of `scene` posed at `t` seconds, as a scene of one part placed as `scene` would be (its root at the player's
   * offset), mirrored about the root's x. Made once per scene.
   */
  get(scene: PuppetScene, t: number): PuppetScene {
    let out = this.scenes.get(scene);
    if (!out) {
      out = bake(scene, t, this.art);
      this.scenes.set(scene, out);
    }
    return out;
  }
}

function bake(scene: PuppetScene, t: number, art: Record<string, PuppetPainter>): PuppetScene {
  const player = new ScenePlayer(scene);
  player.seek(t);
  const world = player.world;
  // Each drawn part's centre and axes in story metres (as PuppetView poses it), and the box round them all.
  const quads: {
    paint: PuppetPainter;
    cx: number;
    cy: number;
    ax: number;
    ay: number;
    bx: number;
    by: number;
    o: number;
  }[] = [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  scene.parts.forEach((part, i) => {
    if (!part.art || part.look === 'glow') return;
    const paint = PUPPET_ART[part.art];
    if (!paint) return;
    const b = i * POSE_STRIDE;
    const o = world[b + 4];
    if (!(o > 0.003)) return;
    const c = Math.cos(world[b + 2]),
      s = Math.sin(world[b + 2]),
      sc = world[b + 3];
    const w = part.w * sc,
      h = part.h * sc;
    const [px, py] = part.pivot ?? [0.5, 0.5];
    const dx = (0.5 - px) * w,
      dy = (0.5 - py) * h;
    const cx = world[b] + c * dx - s * dy,
      cy = world[b + 1] + s * dx + c * dy;
    const m = part.mirror ? -1 : 1;
    const q = { paint, cx, cy, ax: c * w * m, ay: s * w * m, bx: -s * h, by: c * h, o: Math.min(1, o) };
    for (const [u, v] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ]) {
      const x = q.cx + u * q.ax + v * q.bx,
        y = q.cy + u * q.ay + v * q.by;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    quads.push(q);
  });
  const id = `ghost-outline:${scene.id}`;
  if (quads.length === 0 || typeof document === 'undefined') {
    art[id] = () => {};
    return { id, length: 1, parts: [{ id: 'outline', art: id, w: 0.01, h: 0.01 }], tracks: [] };
  }
  // Room round the shape for the line and its soft edge.
  const pad = OUTLINE_LINE_M * 2;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const bw = maxX - minX,
    bh = maxY - minY;
  const k = Math.min(BAKE_PX_PER_M, BAKE_PX_MAX / Math.max(bw, bh));
  const W = Math.max(1, Math.round(bw * k)),
    H = Math.max(1, Math.round(bh * k));

  // The silhouette: every part, painted at its size and set in place (canvas y runs down, the story's up).
  const sil = canvasOf(W, H);
  const sg = sil.getContext('2d');
  const piece = canvasOf(1, 1);
  const pg = piece.getContext('2d');
  if (sg && pg)
    for (const q of quads) {
      const wp = Math.max(8, Math.round(Math.hypot(q.ax, q.ay) * k)),
        hp = Math.max(8, Math.round(Math.hypot(q.bx, q.by) * k));
      piece.width = wp;
      piece.height = hp;
      pg.clearRect(0, 0, wp, hp);
      q.paint(pg, wp, hp);
      // A pixel (u, v) of the piece (v down) lands at the centre plus (u/wp - 0.5) along A and (0.5 - v/hp) along B.
      sg.setTransform(
        (k * q.ax) / wp,
        (-k * q.ay) / wp,
        (-k * q.bx) / hp,
        (k * q.by) / hp,
        k * (q.cx - 0.5 * q.ax + 0.5 * q.bx - minX),
        k * (maxY - q.cy + 0.5 * q.ay - 0.5 * q.by),
      );
      sg.globalAlpha = q.o;
      sg.drawImage(piece, 0, 0);
    }
  sg?.setTransform(1, 0, 0, 1, 0, 0);

  // The line: the silhouette grown by the line's width (stamped round a ring), less the silhouette itself.
  const line = canvasOf(W, H);
  const lg = line.getContext('2d');
  const r = OUTLINE_LINE_M * k;
  if (lg) {
    for (let i = 0; i < RING_STEPS; i++) {
      const a = (i / RING_STEPS) * Math.PI * 2;
      lg.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
      lg.drawImage(sil, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
    }
    lg.globalCompositeOperation = 'destination-out';
    lg.drawImage(sil, 0, 0);
    lg.globalCompositeOperation = 'source-over';
  }

  // Mirrored left to right (about the root's x, 0 here: the scene is posed with no offset), softened a little.
  const soft = Math.max(0.5, r * OUTLINE_SOFT);
  art[id] = (g, w, h) => {
    g.save();
    g.filter = `blur(${((soft * w) / W).toFixed(1)}px)`;
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(line, 0, 0, w, h);
    g.restore();
  };
  return {
    id,
    length: 1,
    parts: [{ id: 'outline', art: id, w: bw, h: bh, x: -(minX + maxX) / 2, y: (minY + maxY) / 2 }],
    tracks: [],
  };
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
