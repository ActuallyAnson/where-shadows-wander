// Draws a playing cutscene (src/engine/sim/cutscene.ts) on the stage: each caption and shadow puppet is a textured quad
// lying on the stage plane, black like the hands' shadows, plus a Skip button in the corner. The textures are drawn once
// when a cutscene loads; update() only moves and fades the quads, and allocates nothing.
import { CanvasTexture, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry } from '@iwsdk/core';
import type { Beat, BeatState, CutscenePlayer } from '../sim/cutscene';
import { makeBeatStates } from '../sim/cutscene';
import { FOX_BOX, paintFox } from './fox-art';
import { hasPuppet, PUPPETS } from './pure/puppets';
import { paintTraveller, Pose } from './traveller-art';
import { skipCentre, SKIP_RADIUS_M } from './pure/skip-touch';
import type { StagePlane } from './pure/stage-plane';
import { DEFAULT_SHADOW_OPACITY } from './shadow-renderer';
import { placeOnStage, crispTexture } from './stage-quad';
import { RenderOrder } from './pure/render-order';

/** Beats showing at once; more than this are dropped (the data is checked at load). */
const SLOTS = 4;
/** In front of the hands' shadows (render order 2) and off the paper. */
const RENDER_ORDER = RenderOrder.sprite;
const LIFT_M = 0.004;
const PUPPET_WIDTH = 0.35; // of the stage width
const CAPTION_WIDTH = 0.8;
const CAPTION_ASPECT = 8;
const CAPTION_Y = -0.3; // of the stage height, from the centre (a caption beat can ask for another height)
const SKIP_LIFT_M = 0.006;
const INK = '#1a1410';
/** Puppet positions in a cutscene are metres on the real wall (about this wide); they scale to the stage actually in use. */
const REF_STAGE_WIDTH_M = 1.6;

interface Art {
  readonly tex: CanvasTexture;
  /** Width over height. */
  readonly aspect: number;
  /** Width as a fraction of the stage's (a puppet that is not the default size). */
  readonly width?: number;
}

/** Puppets drawn by code in their own files (the fox and the traveller's poses) rather than as a few paths. */
const PAINTED: Readonly<
  Record<string, { aspect: number; width: number; paint: (g: CanvasRenderingContext2D, w: number, h: number) => void }>
> = {
  fox: { aspect: FOX_BOX[0] / FOX_BOX[1], width: 0.3, paint: (g, w, h) => paintFox(g, w, h, 1) },
  'fox-flying': { aspect: FOX_BOX[0] / FOX_BOX[1], width: 0.3, paint: (g, w, h) => paintFox(g, w, h, 2) },
  traveller: { aspect: 1, width: 0.2, paint: (g, w) => paintTraveller(g, w, Pose.Idle) },
  'traveller-wait': { aspect: 1, width: 0.2, paint: (g, w) => paintTraveller(g, w, Pose.Wait) },
  'traveller-cheer': { aspect: 1, width: 0.2, paint: (g, w) => paintTraveller(g, w, Pose.Cheer) },
};

function hasAnyPuppet(name: string): boolean {
  return hasPuppet(name) || Object.prototype.hasOwnProperty.call(PAINTED, name);
}

function paintedArt(name: string): Art {
  const a = PAINTED[name];
  const W = 512;
  const H = Math.round(W / a.aspect);
  const [c, g] = canvas(W, H);
  a.paint(g, W, H);
  return { tex: crispTexture(c), aspect: a.aspect, width: a.width };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function puppetArt(name: string): Art {
  const art = PUPPETS[name];
  const [bx, by, bw, bh] = art.box;
  const W = 512;
  const H = Math.round((W * bh) / bw);
  const [c, g] = canvas(W, H);
  const sx = (W - 24) / bw;
  const sy = (H - 24) / bh;
  g.translate(12 - bx * sx, 12 - by * sy);
  g.scale(sx, sy);
  g.fillStyle = '#000';
  g.shadowColor = '#000';
  g.shadowBlur = 6;
  for (const d of art.paths) g.fill(new Path2D(d));
  return { tex: crispTexture(c), aspect: bw / bh };
}

function captionArt(text: string): Art {
  const [c, g] = canvas(1024, 128);
  g.fillStyle = INK;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 72;
  do {
    g.font = `700 ${size}px 'Cinzel Decorative', Georgia, serif`;
    size -= 4;
  } while (g.measureText(text).width > 980 && size > 20);
  g.fillText(text, 512, 66);
  return { tex: crispTexture(c), aspect: CAPTION_ASPECT };
}

function skipArt(): CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = 8;
  g.beginPath();
  g.arc(128, 128, 100, 0, Math.PI * 2);
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = "700 56px 'Cinzel Decorative', Georgia, serif";
  g.fillText('SKIP', 128, 132);
  return crispTexture(c);
}

export class CutsceneView {
  readonly group = new Group();
  private readonly quads: Mesh[] = [];
  private readonly mats: MeshBasicMaterial[] = [];
  private readonly states = makeBeatStates(SLOTS);
  private readonly art = new Map<Beat, Art>();
  private readonly skip: Mesh;
  private readonly skipMat: MeshBasicMaterial;
  private readonly m = new Matrix4();
  private readonly c: [number, number] = [0, 0];
  /** The textures made for the loaded cutscene, so the next load can free them. */
  private owned: CanvasTexture[] = [];

  constructor() {
    const geo = new PlaneGeometry(1, 1);
    const make = (): [Mesh, MeshBasicMaterial] => {
      const mat = new MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      });
      const mesh = new Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = RENDER_ORDER;
      mesh.visible = false;
      this.group.add(mesh);
      return [mesh, mat];
    };
    for (let i = 0; i < SLOTS; i++) {
      const [q, m] = make();
      this.quads.push(q);
      this.mats.push(m);
    }
    [this.skip, this.skipMat] = make();
    this.skipMat.map = skipArt();
    this.group.visible = false;
  }

  /** Draws the textures for a cutscene. Call when it is chosen, not every frame. Unknown puppets are skipped. */
  load(beats: readonly Beat[]): void {
    for (const t of this.owned) t.dispose();
    this.owned = [];
    this.art.clear();
    for (const b of beats) {
      if (b.kind === 'puppet' && !hasAnyPuppet(b.puppet)) continue;
      const a =
        b.kind === 'puppet'
          ? Object.prototype.hasOwnProperty.call(PAINTED, b.puppet)
            ? paintedArt(b.puppet)
            : puppetArt(b.puppet)
          : captionArt(b.text);
      this.owned.push(a.tex);
      this.art.set(b, a);
    }
  }

  /** Hides everything (the cutscene ended or none is playing). */
  hide(): void {
    this.group.visible = false;
  }

  /** Call once per frame while a cutscene plays. `skipProgress` (0..1) brightens the Skip button as it is poked. */
  update(player: CutscenePlayer, stage: StagePlane, opacity: number, skipProgress = 0): void {
    if (player.done) {
      this.hide();
      return;
    }
    this.group.visible = true;
    const n = player.sample(this.states);
    for (let i = 0; i < SLOTS; i++) {
      const q = this.quads[i];
      const s: BeatState = this.states[i];
      const art = i < n && s.beat ? this.art.get(s.beat) : undefined;
      q.visible = !!art;
      if (!art || !s.beat) continue;
      const puppet = s.beat.kind === 'puppet';
      const w = stage.width * (puppet ? (art.width ?? PUPPET_WIDTH) : CAPTION_WIDTH);
      const scale = stage.width / REF_STAGE_WIDTH_M;
      const x = puppet ? s.x * scale : 0;
      const y = s.beat.kind === 'puppet' ? s.y * scale : stage.height * (s.beat.y ?? CAPTION_Y);
      placeOnStage(this.m, q, stage, x, y, w, w / art.aspect, LIFT_M);
      const mat = this.mats[i];
      if (mat.map !== art.tex) {
        mat.map = art.tex;
        mat.needsUpdate = true;
      }
      mat.opacity = s.alpha * opacity * (puppet ? DEFAULT_SHADOW_OPACITY : 1);
    }
    skipCentre(stage, this.c);
    this.skip.visible = true;
    const d = SKIP_RADIUS_M * 2;
    placeOnStage(this.m, this.skip, stage, this.c[0], this.c[1], d, d, SKIP_LIFT_M);
    this.skipMat.opacity = (0.45 + 0.55 * skipProgress) * opacity;
  }
}
