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
import { createMenuPlane, MENU_SIZE_M, MenuInput } from './menu-layout';
import { makeCanvas, MENU_CANVAS_PX, MENU_FONT, paintBackdrop, paintDust, paintMenu } from './menu-art';
import { MENU_SCREENS, type MenuScreenId } from './screens';
import fontUrl from './fonts/cinzel-latin-400-normal.woff2?url';

/** After the paper wall (1) and the hands' shadows (2), so nothing washes over the screen. */
const RENDER_ORDER = 2.5;
const FADE_S = 0.45;
const BACKDROP_W = 1.7;
const BACKDROP_H = 1.06;
const BACKDROP_Z = -0.14;
const DUST_Z = -0.07;
const DUST_SIZE = 1.5;

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
  private lit = -1;
  private alpha = 0;
  private time = 0;
  private high = false;
  lastError: string | null = null;
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
    this.group.visible = false;
    this.dustTex.repeat.set(1, 0.7);
  }

  /** The screen showing now, or null. */
  get current(): MenuScreenId | null {
    return this.shown;
  }

  /** Shows a screen in front of the head (`head` is the eye position, (fx, fz) the way it looks), replacing any other. */
  async show(id: MenuScreenId, head: ArrayLike<number>, fx: number, fz: number): Promise<boolean> {
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
    if (this.shown !== id) this.alpha = 0;
    this.shown = id;
    this.input.reset();
    this.lit = -1;
    this.high = this.store.value.highContrast;
    this.repaint();
    this.group.visible = true;
    return true;
  }

  hide(): void {
    this.shown = null; // the fade-out finishes in update()
  }

  dispose(): void {
    this.shown = null;
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
    const target = this.shown ? 1 : 0;
    this.alpha += Math.sign(target - this.alpha) * Math.min(Math.abs(target - this.alpha), dt / FADE_S);
    if (this.alpha <= 0 && !this.shown) {
      this.group.visible = false;
      return;
    }
    const a = this.alpha;
    this.backdropMat.opacity = a;
    this.menuMat.opacity = a;
    this.dustMat.opacity = a * 0.8;
    // Dust rises slowly and sways a little.
    this.dustTex.offset.set(Math.sin(this.time * 0.17) * 0.02, (this.time * 0.012) % 1);
    if (!this.shown || a < 0.7) return;
    const screen = MENU_SCREENS[this.shown];
    const s = this.input.update(screen, this.plane, tips, n);
    if (s.hover !== this.lit) {
      if (s.hover >= 0) this.onReach?.();
      this.lit = s.hover;
      this.repaint();
    }
    if (s.pressed >= 0) {
      const id = this.shown;
      try {
        this.onPress?.(id, screen.buttons[s.pressed].id);
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  private repaint(): void {
    if (!this.shown) return;
    paintMenu(this.menuCanvas[1], MENU_SCREENS[this.shown], this.lit, this.high);
    this.menuTex.needsUpdate = true;
  }

  private loadFont(): Promise<void> {
    this.fontReady ??= new FontFace(MENU_FONT, `url(${fontUrl})`).load().then((f) => void document.fonts.add(f));
    return this.fontReady;
  }
}
