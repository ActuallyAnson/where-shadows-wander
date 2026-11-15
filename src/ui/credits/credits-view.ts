// The end credits, drawn (the timing is ending-timeline.ts, the words credits.ts): after he falls asleep, pale lettering rolls up
// through a soft-edged window on the black, then "thank you for playing" fades in alone. Both hang still in the room, a little way
// in front of where the eyes looked as the credits began (not stuck to the head), drawn over the lids' black. The lettering is
// painted once, when the end starts, after the fonts have loaded; nothing is allocated per frame.
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
} from '@iwsdk/core';
import { RenderOrder } from '../../engine/shadow/pure/render-order';
import { MENU_FONT } from '../menu-panel/menu-art';
import menuFontUrl from '../menu-panel/fonts/cinzel-latin-400-normal.woff2?url';
import { CREDITS, THANKS, type CreditKind, type CreditLine } from './credits';

/** How far in front of the eyes the credits hang, and the window they roll through (m). */
const DISTANCE_M = 2.4;
const WINDOW_W_M = 1.5;
const WINDOW_H_M = 1.1;
/** The canvas: its width in pixels (its height follows the lines). */
const CANVAS_W = 1024;
const COLOR = '#d9d4c7';
const DECORATIVE = "'Cinzel Decorative'";
const PLAIN = `'${MENU_FONT}', 'Cinzel Decorative', Georgia, serif`;

/** Each kind of line: its font and the height it takes (px). */
const STYLE: Record<CreditKind, { font: string; height: number; alpha: number }> = {
  title: { font: `700 72px ${DECORATIVE}, Georgia, serif`, height: 120, alpha: 1 },
  heading: { font: `400 30px ${PLAIN}`, height: 64, alpha: 0.6 },
  name: { font: `400 46px ${PLAIN}`, height: 66, alpha: 1 },
  small: { font: `400 30px ${PLAIN}`, height: 46, alpha: 0.85 },
  gap: { font: '', height: 70, alpha: 0 },
};

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The window shows `win` of the canvas's height. At scroll 0 the canvas's top is just below the window; at 1 its bottom has
// gone out of the top. The top and bottom of the window fade, so lines come out of the dark and go back into it.
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
uniform float scroll;
uniform float win;
uniform float opacity;
varying vec2 vUv;
void main() {
  float y = scroll * (1.0 + win) - win + (1.0 - vUv.y) * win;
  if (y < 0.0 || y > 1.0) discard;
  vec4 c = texture2D(map, vec2(vUv.x, 1.0 - y));
  float edge = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
  gl_FragColor = vec4(c.rgb, c.a * edge * opacity);
}`;

export class CreditsView {
  readonly group = new Group();
  private readonly canvas: HTMLCanvasElement | null;
  private readonly rollTex: CanvasTexture | null;
  private readonly rollMat: ShaderMaterial;
  private readonly roll: Mesh;
  private readonly thanksTex: CanvasTexture | null;
  private readonly thanksMat: MeshBasicMaterial;
  private readonly thanks: Mesh;
  private readonly fonts: Promise<unknown>;
  private painted = false;

  constructor(private readonly lines: readonly CreditLine[] = CREDITS) {
    const hasDocument = typeof document !== 'undefined';
    this.canvas = hasDocument ? document.createElement('canvas') : null;
    // Sized now, before anything can upload it: a texture must not change size once it is on the GPU.
    if (this.canvas) {
      this.canvas.width = CANVAS_W;
      this.canvas.height = rollHeight(lines);
    }
    this.rollTex = this.canvas ? new CanvasTexture(this.canvas) : null;
    if (this.rollTex) this.rollTex.colorSpace = NoColorSpace; // the shader passes the painted colour straight through
    this.rollMat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { map: { value: this.rollTex }, scroll: { value: 0 }, win: { value: 0.5 }, opacity: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.roll = new Mesh(new PlaneGeometry(WINDOW_W_M, WINDOW_H_M), this.rollMat);
    this.roll.renderOrder = RenderOrder.fade + 0.2; // within the fade's layer, over the lids' black
    this.roll.frustumCulled = false;
    this.group.add(this.roll);

    const thanksCanvas = hasDocument ? document.createElement('canvas') : null;
    if (thanksCanvas) {
      thanksCanvas.width = 1024;
      thanksCanvas.height = 256;
    }
    this.thanksTex = thanksCanvas ? new CanvasTexture(thanksCanvas) : null;
    if (this.thanksTex) this.thanksTex.colorSpace = SRGBColorSpace;
    this.thanksMat = new MeshBasicMaterial({
      map: this.thanksTex,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.thanks = new Mesh(new PlaneGeometry(WINDOW_W_M, WINDOW_W_M / 4), this.thanksMat);
    this.thanks.renderOrder = RenderOrder.fade + 0.2;
    this.thanks.frustumCulled = false;
    this.group.add(this.thanks);
    this.group.visible = false;

    // The title page declares Cinzel Decorative; plain Cinzel is the menu's file. Both are asked for now, so they are ready
    // long before the credits roll.
    this.fonts = hasDocument && typeof FontFace !== 'undefined' ? loadFonts() : Promise.resolve();
  }

  /** Paints the lettering once the fonts are in (call as the end starts; it is ready long before it shows). */
  prepare(): void {
    if (this.painted) return;
    this.painted = true;
    void this.fonts.catch(() => undefined).then(() => this.paint());
  }

  /**
   * Hangs the credits `DISTANCE_M` in front of the head at `head` looking along (`lookX`, `lookZ`) (world; only the level part
   * of the look counts), facing it. Once, as they start.
   */
  place(head: Readonly<{ x: number; y: number; z: number }>, lookX: number, lookZ: number): void {
    const len = Math.hypot(lookX, lookZ);
    const fx = len > 1e-4 ? lookX / len : 0;
    const fz = len > 1e-4 ? lookZ / len : -1;
    this.group.position.set(head.x + fx * DISTANCE_M, head.y, head.z + fz * DISTANCE_M);
    this.group.lookAt(head.x, head.y, head.z);
  }

  /** Once per frame while the end plays: how far the roll has got (0..1), whether it shows, and how visible the thanks are (0..1). */
  update(scroll: number, rollOn: boolean, thanks: number): void {
    this.roll.visible = rollOn;
    this.thanks.visible = thanks > 0.001;
    this.group.visible = this.roll.visible || this.thanks.visible;
    this.rollMat.uniforms.scroll.value = scroll;
    this.rollMat.uniforms.opacity.value = rollOn ? 1 : 0;
    this.thanksMat.opacity = thanks > 1 ? 1 : thanks;
  }

  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    this.roll.geometry.dispose();
    this.rollMat.dispose();
    this.rollTex?.dispose();
    this.thanks.geometry.dispose();
    this.thanksMat.dispose();
    this.thanksTex?.dispose();
  }

  private paint(): void {
    const canvas = this.canvas;
    const g = canvas?.getContext('2d');
    if (!canvas || !g || !this.rollTex) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = COLOR;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let y = 0;
    for (const l of this.lines) {
      const s = STYLE[l.kind];
      if (l.text) {
        g.font = s.font;
        g.globalAlpha = s.alpha;
        g.fillText(l.text, CANVAS_W / 2, y + s.height / 2, CANVAS_W - 40);
      }
      y += s.height;
    }
    g.globalAlpha = 1;
    // The window is as tall, in canvas heights, as its shape on the page allows at this width.
    const windowPx = (WINDOW_H_M / WINDOW_W_M) * CANVAS_W;
    this.rollMat.uniforms.win.value = windowPx / canvas.height;
    this.rollTex.needsUpdate = true;

    const tc = this.thanksTex?.image as HTMLCanvasElement | undefined;
    const tg = tc?.getContext('2d');
    if (tc && tg && this.thanksTex) {
      tg.fillStyle = COLOR;
      tg.textAlign = 'center';
      tg.textBaseline = 'middle';
      tg.font = `400 64px ${DECORATIVE}, Georgia, serif`;
      tg.shadowColor = COLOR;
      tg.shadowBlur = 14;
      tg.fillText(THANKS, 512, 128, 980);
      this.thanksTex.needsUpdate = true;
    }
  }
}

/** The roll's canvas height (px): every line's height, at most a texture's largest safe size. */
function rollHeight(lines: readonly CreditLine[]): number {
  let height = 0;
  for (const l of lines) height += STYLE[l.kind].height;
  return Math.min(4096, Math.ceil(height));
}

function loadFonts(): Promise<unknown> {
  const plain = new FontFace(MENU_FONT, `url(${menuFontUrl})`).load().then((f) => void document.fonts.add(f));
  return Promise.all([
    plain,
    document.fonts.load(`700 72px ${DECORATIVE}`),
    document.fonts.load(`400 64px ${DECORATIVE}`),
  ]);
}
