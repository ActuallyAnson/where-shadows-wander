// The pause, solved and end screens in the room: IWSDK UIKit panels pressed with a fingertip (poke), like the settings
// panel. Each screen is built the first time it is shown and only shown and hidden after that. Which button does what is
// the game flow's business: a press is reported through `onPress(screen, buttonId)`.
import { Euler, PanelDocument, PanelUI, PokeInteractable, RayInteractable } from '@iwsdk/core';
import type { Entity, World } from '@iwsdk/core';
import type { SettingsStore } from '../../engine/services/settings/settings-store';
import { placeSettingsPanel } from '../settings-panel/placement';
import type { PanelPose } from '../settings-panel/placement';
import { MENU_METRES_PER_PX, MENU_PALETTE, MENU_SCREENS, menuIds, menuMarkup, type MenuScreenId } from './markup';

const UIKIT_PIXEL_M = 0.01;
const LOAD_TIMEOUT_MS = 8000;
const PANEL_RENDER_ORDER = 1.2;

interface UiElement {
  setProperties(props: Record<string, unknown>): void;
  addEventListener(type: string, fn: (e: unknown) => void): void;
  removeEventListener(type: string, fn: (e: unknown) => void): void;
}
interface UiDocument {
  getElementById(id: string): UiElement | null;
  getElementsByClassName(className: string): UiElement[];
}

interface Built {
  entity: Entity;
  doc: UiDocument;
  url: string;
}

export class MenuPanel {
  private readonly built = new Map<MenuScreenId, Built>();
  private readonly loading = new Map<MenuScreenId, Promise<Built | null>>();
  private shown: MenuScreenId | null = null;
  private readonly pose: PanelPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly removers: (() => void)[] = [];
  lastError: string | null = null;
  /** A button was pressed on a screen. */
  onPress: ((screen: MenuScreenId, button: string) => void) | null = null;

  constructor(
    private readonly world: World,
    private readonly store: SettingsStore,
  ) {
    this.removers.push(
      this.store.subscribe((key) => {
        if (key === null || key === 'highContrast') for (const b of this.built.values()) this.applyLook(b.doc);
      }),
    );
  }

  /** The screen showing now, or null. */
  get current(): MenuScreenId | null {
    return this.shown;
  }

  /** Shows a screen in front of the head (`head` is the eye position, (fx, fz) the way it looks), hiding any other. */
  async show(id: MenuScreenId, head: ArrayLike<number>, fx: number, fz: number): Promise<boolean> {
    const b = await this.build(id);
    if (!b) return false;
    if (this.shown && this.shown !== id) this.hide();
    placeSettingsPanel(head, fx, fz, this.store.value.hand, this.pose);
    const o = b.entity.object3D!;
    o.position.set(this.pose.x, this.pose.y, this.pose.z);
    this.euler.set(this.pose.pitch, this.pose.yaw, 0, 'YXZ');
    o.rotation.copy(this.euler);
    o.visible = true;
    if (!b.entity.hasComponent(PokeInteractable)) b.entity.addComponent(PokeInteractable);
    if (!b.entity.hasComponent(RayInteractable)) b.entity.addComponent(RayInteractable);
    this.shown = id;
    return true;
  }

  hide(): void {
    if (!this.shown) return;
    const b = this.built.get(this.shown);
    this.shown = null;
    if (!b) return;
    b.entity.object3D!.visible = false;
    if (b.entity.hasComponent(PokeInteractable)) b.entity.removeComponent(PokeInteractable);
    if (b.entity.hasComponent(RayInteractable)) b.entity.removeComponent(RayInteractable);
  }

  dispose(): void {
    this.hide();
    for (const r of this.removers.splice(0)) r();
    for (const b of this.built.values()) {
      b.entity.destroy();
      URL.revokeObjectURL(b.url);
    }
    this.built.clear();
    this.loading.clear();
  }

  private build(id: MenuScreenId): Promise<Built | null> {
    const have = this.built.get(id);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(id);
    if (!p) {
      p = this.load(id).catch((e) => {
        this.lastError = e instanceof Error ? e.message : String(e);
        this.loading.delete(id); // a later show tries again
        return null;
      });
      this.loading.set(id, p);
    }
    return p;
  }

  private async load(id: MenuScreenId): Promise<Built> {
    const screen = MENU_SCREENS[id];
    const url = URL.createObjectURL(new Blob([menuMarkup(screen)], { type: 'text/plain' }));
    const entity = this.world.createTransformEntity();
    entity.object3D!.visible = false;
    entity.object3D!.scale.setScalar(MENU_METRES_PER_PX / UIKIT_PIXEL_M);
    entity.addComponent(PanelUI, { config: url });
    const started = performance.now();
    let doc: UiDocument | undefined;
    while (!(doc = PanelDocument.data.document[entity.index] as UiDocument | undefined)) {
      if (performance.now() - started > LOAD_TIMEOUT_MS) {
        entity.destroy();
        URL.revokeObjectURL(url);
        throw new Error(`the ${id} screen did not load in time`);
      }
      await new Promise((r) => setTimeout(r, 30));
    }
    // After the paper wall (1) so the wall never washes over it, before the hand visual (1.5).
    (doc as unknown as { rootElement: UiElement }).rootElement.setProperties({ renderOrder: PANEL_RENDER_ORDER });
    for (const b of screen.buttons) {
      const el = doc.getElementById(menuIds.button(id, b.id));
      if (!el) {
        this.lastError = `menu: no element "${menuIds.button(id, b.id)}"`;
        continue;
      }
      const handler = () => {
        try {
          this.onPress?.(id, b.id);
        } catch (e) {
          this.lastError = e instanceof Error ? e.message : String(e);
        }
      };
      el.addEventListener('click', handler);
      this.removers.push(() => el.removeEventListener('click', handler));
    }
    this.applyLook(doc);
    const built = { entity, doc, url };
    this.built.set(id, built);
    return built;
  }

  private applyLook(doc: UiDocument): void {
    const look = this.store.value.highContrast ? 'high' : 'normal';
    for (const [cls, props] of Object.entries(MENU_PALETTE[look]))
      for (const el of doc.getElementsByClassName(cls)) el.setProperties({ ...props });
  }
}
