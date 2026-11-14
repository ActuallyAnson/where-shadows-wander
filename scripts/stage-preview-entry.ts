// A flat 2D preview of the story's puppet stage (no headset, no WebGL): each part's cut-out drawn at its pose, for checking
// a moment by eye. Bundled and driven by scripts/stage-preview.mjs.
import { PUPPET_ART } from '../src/engine/shadow/puppet-art';
import { ScenePlayer } from '../src/engine/stage/puppet/scene-player';
import type { PuppetScene } from '../src/engine/stage/puppet/puppet-scene';
import { FRIEND_PUPPETS, friendSceneTime } from '../src/engine/stage/story/friend-puppet';
import { STORY_CHAPTER, STORY_STAGE } from '../src/engine/stage/story/story-stage';

const W = 0.842,
  H = 0.526,
  PX = 600;
const cache = new Map<string, HTMLCanvasElement>();
function art(name: string, w: number, h: number): HTMLCanvasElement {
  const key = `${name}:${w}:${h}`;
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(4, Math.round(w * PX));
    c.height = Math.max(4, Math.round(h * PX));
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#fff';
    PUPPET_ART[name]?.(g, c.width, c.height);
    cache.set(key, c);
  }
  return c;
}
function draw(g: CanvasRenderingContext2D, scene: PuppetScene, p: ScenePlayer, tint: string): void {
  scene.parts.forEach((part, i) => {
    if (!part.art || part.art.includes('.')) return;
    const o = i * 5,
      w = p.world;
    const op = w[o + 4];
    if (op < 0.01) return;
    const sc = w[o + 3],
      a = w[o + 2];
    const pw = part.w * sc,
      ph = part.h * sc;
    const [px, py] = part.pivot ?? [0.5, 0.5];
    const img = art(part.art, part.w, part.h);
    g.save();
    g.translate((w[o] + W) * PX, (H - w[o + 1]) * PX);
    g.rotate(-a);
    if (part.mirror) g.scale(-1, 1);
    g.globalAlpha = op * (part.look === 'glow' ? 0.5 : 0.85);
    // Tint the white cut-out.
    const t = document.createElement('canvas');
    t.width = img.width;
    t.height = img.height;
    const tg = t.getContext('2d') as CanvasRenderingContext2D;
    tg.drawImage(img, 0, 0);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = part.look === 'glow' ? '#cf6' : tint;
    tg.fillRect(0, 0, t.width, t.height);
    const mx = part.mirror ? -1 : 1;
    g.drawImage(t, (-px * pw * PX + (mx < 0 ? 0 : 0)) * 1, -(1 - py) * ph * PX, pw * PX, ph * PX);
    g.restore();
  });
}
const player = new ScenePlayer(STORY_STAGE);
const friends = new Map<string, ScenePlayer>();
(window as unknown as { render: unknown }).render = (
  chapter: string,
  t: number,
  friend?: { puppet: string; x: number; y: number; t: number; op: number },
) => {
  const c = document.getElementById('c') as HTMLCanvasElement;
  c.width = 2 * W * PX;
  c.height = 2 * H * PX;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#d9c9a8';
  g.fillRect(0, 0, c.width, c.height);
  player.seek(STORY_CHAPTER[chapter].start + t);
  draw(g, STORY_STAGE, player, '#222');
  if (friend && friend.op > 0) {
    const scene = FRIEND_PUPPETS[friend.puppet];
    let fp = friends.get(friend.puppet);
    if (!fp) friends.set(friend.puppet, (fp = new ScenePlayer(scene)));
    fp.offset[0] = friend.x;
    fp.offset[1] = friend.y;
    fp.seek(friendSceneTime(friend.t));
    g.save();
    g.globalAlpha = friend.op;
    draw(g, scene, fp, '#a22');
    g.restore();
  }
};
