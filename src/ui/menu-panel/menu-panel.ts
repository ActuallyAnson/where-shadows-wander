// The pause, solved and end screens in the room. No panel: the text and a misty backdrop are drawn as artwork (menu-art.ts)
// on quads in front of the player, and a fingertip reaches and presses the items by position (menu-layout.ts), not through
// UIKit. A press is reported through `onPress(screen, buttonId)`; which button does what is the game flow's business.
// A texture is redrawn only when the reached item changes. Nothing is built per frame.
import {
  CanvasTexture,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from '@iwsdk/core';
import type { SettingsStore } from '../../engine/services/settings/settings-store';
import { placeSettingsPanel, type PanelPose } from '../settings-panel/placement';
import { createMenuPlane, ITEM_HALF_U, itemAt, itemV, MENU_SIZE_M, MenuInput, type MenuHits } from './menu-layout';
import { makeCanvas, MENU_CANVAS_PX, MENU_FONT, paintBackdrop, paintDust, paintMenu } from './menu-art';
import { MENU_SCREENS, type MenuScreen, type MenuScreenId } from './screens';
import fontUrl from './fonts/cinzel-latin-400-normal.woff2?url';

/** After the paper wall (1) and the hands' shadows (2), so nothing washes over the screen. */
const RENDER_ORDER = 2.5;
const FADE_S = 0.45;
const BACKDROP_W = 1.7;
const BACKDROP_H = 1.06;
const BACKDROP_Z = -0.14;
const DUST_Z = -0.07;
const DUST_SIZE = 1.5;

/** What a screen shows and how it is reached: the button screens (screens.ts) and the settings screen are both one. */
export interface MenuContent extends MenuHits {
  /** Paints the screen's text on a transparent canvas; `hover` is the item code a fingertip is reaching, or -1. */
  paint(g: CanvasRenderingContext2D, hover: number, high: boolean): void;
  /** A press on item `code`. */
  press(code: number): void;
}

function texture(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class MenuPanel {
  readonly group = new Group();
  private readonly menuMat: MeshBasicMaterial;
  private readonly backdropMat: MeshBasicMaterial;
  private readonly dustMat: MeshBasicMaterial;
  private readonly menuCanvas: [HTMLCanvasElement, CanvasRenderingContext2D];
  private readonly menuTex: CanvasTexture;
  private readonly backdropTex: CanvasTexture;
  private readonly dustTex: CanvasTexture;
  private readonly plane = createMenuPlane();
  private readonly input = new MenuInput();
  private readonly pose: PanelPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private fontReady: Promise<void> | null = null;
  private shown: MenuScreenId | null = null;
  private content: MenuContent | null = null;
  private readonly screenContents = new Map<MenuScreenId, MenuContent>();
  private lit = -1;
  private alpha = 0;
  private time = 0;
  private high = false;
  lastError: string | null = null;
  /** Press items by looking at them (the Look to press setting); the app sets the head's ray each frame with `setGaze`. */
  gazeOn = false;
  private readonly gazeOrigin = new Float64Array(3);
  private readonly gazeDir = new Float64Array(3);
  private readonly dwellBar: Mesh;
  /** A button was pressed on a screen. */
  onPress: ((screen: MenuScreenId, button: string) => void) | null = null;
  /** A fingertip reached an item (once as it arrives), for the sound. */
  onReach: (() => void) | null = null;

  constructor(private readonly store: SettingsStore) {
    const [mc, mg] = (this.menuCanvas = makeCanvas(MENU_CANVAS_PX, MENU_CANVAS_PX));
    void mg;
    this.menuTex = texture(mc);
    const [bc, bg] = makeCanvas(1024, 640);
    paintBackdrop(bg, 1024, 640);
    this.backdropTex = texture(bc);
    const [dc, dg] = makeCanvas(512, 512);
    paintDust(dg, 512);
    this.dustTex = texture(dc);
    this.dustTex.wrapS = this.dustTex.wrapT = RepeatWrapping;

    const mat = (map: CanvasTexture) =>
      new MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false });
    this.menuMat = mat(this.menuTex);
    this.backdropMat = mat(this.backdropTex);
    this.dustMat = mat(this.dustTex);
    const geo = new PlaneGeometry(1, 1);
    const quad = (m: MeshBasicMaterial, w: number, h: number, z: number) => {
      const mesh = new Mesh(geo, m);
      mesh.scale.set(w, h, 1);
      mesh.position.z = z;
      mesh.renderOrder = RENDER_ORDER;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    };
    quad(this.backdropMat, BACKDROP_W, BACKDROP_H, BACKDROP_Z);
    quad(this.dustMat, DUST_SIZE, DUST_SIZE * 0.7, DUST_Z);
    quad(this.menuMat, MENU_SIZE_M, MENU_SIZE_M, 0);
    // The line that fills under an item while it is looked at.
    this.dwellBar = new Mesh(
      geo,
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
    );
    this.dwellBar.renderOrder = RENDER_ORDER + 1;
    this.dwellBar.frustumCulled = false;
    this.dwellBar.visible = false;
    this.group.add(this.dwellBar);
    this.group.visible = false;
    this.dustTex.repeat.set(1, 0.7);
  }

  /** Where the head is and the way it points (unit), scene space. */
  setGaze(x: number, y: number, z: number, dx: number, dy: number, dz: number): void {
    this.gazeOrigin[0] = x;
    this.gazeOrigin[1] = y;
    this.gazeOrigin[2] = z;
    this.gazeDir[0] = dx;
    this.gazeDir[1] = dy;
    this.gazeDir[2] = dz;
  }

  /** The screen showing now, or null (null too while a custom screen shows). */
  get current(): MenuScreenId | null {
    return this.shown;
  }

  /** The content showing now, or null. */
  get showing(): MenuContent | null {
    return this.content;
  }

  /** Shows a screen in front of the head (`head` is the eye position, (fx, fz) the way it looks), replacing any other. */
  show(id: MenuScreenId, head: ArrayLike<number>, fx: number, fz: number, line?: string): Promise<boolean> {
    // A screen with its own line (the end screen's count of ways found) is painted fresh, not kept.
    if (line !== undefined)
      return this.showContent(this.screenContent({ ...MENU_SCREENS[id], line }), head, fx, fz, id);
    let c = this.screenContents.get(id);
    if (!c) {
      c = this.screenContent(MENU_SCREENS[id]);
      this.screenContents.set(id, c);
    }
    return this.showContent(c, head, fx, fz, id);
  }

  private screenContent(screen: MenuScreen): MenuContent {
    return {
      hitAt: (u, v) => itemAt(screen, u, v),
      paint: (g, hover, high) => paintMenu(g, screen, hover, high),
      press: (code) => this.onPress?.(screen.id, screen.buttons[code].id),
    };
  }

  /** Shows any screen's content in front of the head, replacing what shows. `id` names a button screen, null otherwise. */
  async showContent(
    content: MenuContent,
    head: ArrayLike<number>,
    fx: number,
    fz: number,
    id: MenuScreenId | null = null,
  ): Promise<boolean> {
    try {
      await this.loadFont();
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      // Draws with the fallback serif: still readable.
    }
    placeSettingsPanel(head, fx, fz, this.store.value.hand, this.pose);
    this.group.position.set(this.pose.x, this.pose.y, this.pose.z);
    this.euler.set(this.pose.pitch, this.pose.yaw, 0, 'YXZ');
    this.group.rotation.copy(this.euler);
    this.group.updateMatrixWorld(true);
    const e = this.group.matrixWorld.elements;
    for (let i = 0; i < 3; i++) {
      this.plane.right[i] = e[i];
      this.plane.up[i] = e[4 + i];
      this.plane.normal[i] = e[8 + i];
      this.plane.origin[i] = e[12 + i];
    }
    if (this.content !== content) this.alpha = 0;
    this.content = content;
    this.shown = id;
    this.input.reset();
    this.lit = -1;
    this.high = this.store.value.highContrast;
    this.repaint();
    this.group.visible = true;
    return true;
  }

  hide(): void {
    this.shown = null;
    this.content = null; // the fade-out finishes in update()
  }

  dispose(): void {
    this.shown = null;
    this.content = null;
    this.group.visible = false;
    for (const t of [this.menuTex, this.backdropTex, this.dustTex]) t.dispose();
  }

  /**
   * Once per frame while anything is showing. `tips` holds n fingertips as xyz triples in scene space. Fades the screen,
   * drifts the dust, lights the item a fingertip reaches and reports presses.
   */
  update(dt: number, tips: ArrayLike<number>, n: number): void {
    if (!this.group.visible) return;
    this.time += dt;
    const target = this.content ? 1 : 0;
    this.alpha += Math.sign(target - this.alpha) * Math.min(Math.abs(target - this.alpha), dt / FADE_S);
    if (this.alpha <= 0 && !this.content) {
      this.group.visible = false;
      return;
    }
    const a = this.alpha;
    this.backdropMat.opacity = a;
    this.menuMat.opacity = a;
    this.dustMat.opacity = a * 0.8;
    // Dust rises slowly and sways a little.
    this.dustTex.offset.set(Math.sin(this.time * 0.17) * 0.02, (this.time * 0.012) % 1);
    const content = this.content;
    if (!content || a < 0.7) return;
    let s = this.input.update(content, this.plane, tips, n);
    this.dwellBar.visible = false;
    if (this.gazeOn && this.shown !== null && s.hover < 0) {
      // No fingertip is at the screen: the head's gaze reaches it instead, and a long look presses. (The button screens only: the
      // settings screen's small arrows are not for a head to aim at.)
      s = this.input.gaze(content, this.plane, this.gazeOrigin, this.gazeDir, dt);
      if (this.input.dwell > 0 && s.hover >= 0) {
        const bar = this.dwellBar;
        const width = ITEM_HALF_U * 1.2 * MENU_SIZE_M * this.input.dwell;
        bar.scale.set(width, 0.004, 1);
        bar.position.set(
          -ITEM_HALF_U * 0.6 * MENU_SIZE_M + width / 2,
          (0.5 - (itemV(s.hover) + 0.04)) * MENU_SIZE_M,
          0.002,
        );
        bar.visible = true;
      }
    }
    if (s.hover !== this.lit) {
      if (s.hover >= 0) this.onReach?.();
      this.lit = s.hover;
      this.repaint();
    }
    if (s.pressed >= 0) {
      try {
        content.press(s.pressed);
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  /** Redraws the screen (its text changed, or the reached item did). */
  repaint(): void {
    if (!this.content) return;
    this.content.paint(this.menuCanvas[1], this.lit, this.high);
    this.menuTex.needsUpdate = true;
  }

  private loadFont(): Promise<void> {
    this.fontReady ??= new FontFace(MENU_FONT, `url(${fontUrl})`).load().then((f) => void document.fonts.add(f));
    return this.fontReady;
  }
}
