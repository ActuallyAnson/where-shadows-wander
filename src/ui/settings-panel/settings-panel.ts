// The settings screen in the room: an IWSDK UIKit panel pressed with a fingertip (poke). Rays stay off in this
// game, so nothing here can be reached with a controller. The panel's text comes from markup.ts, its values from
// the SettingsStore, and a press goes straight back into the store, which applies it live and saves it.
//
// It is built the first time it opens and only shown and hidden after that: no per-frame work, and nothing
// at all until the player asks for it.
import { Euler, PanelDocument, PanelUI, PokeInteractable, RayInteractable } from '@iwsdk/core';
import type { Entity, World } from '@iwsdk/core';
import { SETTING_SPECS, type Settings } from '../../engine/services/settings/settings';
import type { SettingsStore } from '../../engine/services/settings/settings-store';
import {
  formatValue,
  ids,
  METRES_PER_PX,
  nextValue,
  extraId,
  PAGES,
  PALETTE,
  pageButtonText,
  settingsMarkup,
  stepValue,
  type ExtraPage,
} from './markup';
import { placeSettingsPanel, type PanelPose } from './placement';

/** UIKit's default: one pixel is a centimetre, until the document is scaled to the panel's real size. */
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
  dispose?(): void;
}

export class SettingsPanel {
  private entity: Entity | null = null;
  private doc: UiDocument | null = null;
  private loading: Promise<boolean> | null = null;
  private url: string | null = null;
  private opened = false;
  private page = 0;
  private extra: (ExtraPage & { items: (ExtraPage['items'][number] & { press(): void })[] })[] = [];
  private readonly pose: PanelPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly removers: (() => void)[] = [];
  /** Why the panel could not be built, for the diagnostics report. */
  lastError: string | null = null;
  /** Called after the panel opens or closes. */
  onVisibilityChange: ((open: boolean) => void) | null = null;

  constructor(
    private readonly world: World,
    private readonly store: SettingsStore,
    /** Extra pages after the settings (the debug menu), asked for once, when the panel is first built. */
    private readonly extraPages: () => (ExtraPage & {
      items: (ExtraPage['items'][number] & { press(): void })[];
    })[] = () => [],
  ) {}

  get isOpen(): boolean {
    return this.opened;
  }

  /** Shows the panel in front of the head (`head` is the eye position, (fx, fz) the way it looks). */
  async open(head: ArrayLike<number>, fx: number, fz: number): Promise<boolean> {
    if (!(await this.build())) return false;
    const entity = this.entity!;
    placeSettingsPanel(head, fx, fz, this.store.value.hand, this.pose);
    const o = entity.object3D!;
    o.position.set(this.pose.x, this.pose.y, this.pose.z);
    this.euler.set(this.pose.pitch, this.pose.yaw, 0, 'YXZ');
    o.rotation.copy(this.euler);
    o.visible = true;
    // Pressable only while it is showing: a hidden panel must not catch a fingertip.
    if (!entity.hasComponent(PokeInteractable)) entity.addComponent(PokeInteractable);
    if (!entity.hasComponent(RayInteractable)) entity.addComponent(RayInteractable);
    this.showPage(0);
    this.refresh(null);
    if (!this.opened) {
      this.opened = true;
      this.onVisibilityChange?.(true);
    }
    return true;
  }

  close(): void {
    if (!this.entity) return;
    this.entity.object3D!.visible = false;
    if (this.entity.hasComponent(PokeInteractable)) this.entity.removeComponent(PokeInteractable);
    if (this.entity.hasComponent(RayInteractable)) this.entity.removeComponent(RayInteractable);
    if (this.opened) {
      this.opened = false;
      this.onVisibilityChange?.(false);
    }
  }

  dispose(): void {
    this.close();
    for (const r of this.removers.splice(0)) r();
    this.entity?.destroy();
    this.entity = null;
    this.doc = null;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
    this.loading = null;
  }

  /** Builds the panel once; resolves false (with `lastError` set) if it could not be built. */
  private build(): Promise<boolean> {
    this.loading ??= this.load().catch((e) => {
      this.lastError = e instanceof Error ? e.message : String(e);
      this.loading = null; // a later open tries again
      return false;
    });
    return this.loading;
  }

  private async load(): Promise<boolean> {
    this.extra = this.extraPages();
    const markup = settingsMarkup(this.store.value, this.extra);
    this.url = URL.createObjectURL(new Blob([markup], { type: 'text/plain' }));
    const entity = this.world.createTransformEntity();
    entity.object3D!.visible = false;
    entity.object3D!.scale.setScalar(METRES_PER_PX / UIKIT_PIXEL_M);
    entity.addComponent(PanelUI, { config: this.url });
    this.entity = entity;
    const started = performance.now();
    let doc: UiDocument | undefined;
    while (!(doc = PanelDocument.data.document[entity.index] as UiDocument | undefined)) {
      if (performance.now() - started > LOAD_TIMEOUT_MS) throw new Error('the settings panel did not load in time');
      await new Promise((r) => setTimeout(r, 30));
    }
    this.doc = doc;
    // Draw order: after the paper wall (1) so the wall never washes over it, before the hand visual (1.5) so the
    // fingertip is seen pressing it. UIKit's transparent panels would otherwise sort ahead of the paper.
    (doc as unknown as { rootElement: UiElement }).rootElement.setProperties({ renderOrder: PANEL_RENDER_ORDER });
    this.wire();
    this.showPage(0);
    this.applyLook();
    this.removers.push(
      this.store.subscribe((key) => {
        this.refresh(key);
        if (key === null || key === 'highContrast') this.applyLook();
      }),
    );
    return true;
  }

  private el(id: string): UiElement | null {
    return this.doc?.getElementById(id) ?? null;
  }

  private on(id: string, fn: () => void): void {
    const el = this.el(id);
    if (!el) {
      this.lastError = `settings panel: no element "${id}"`;
      return;
    }
    const handler = () => {
      try {
        fn();
      } catch (e) {
        this.lastError = e instanceof Error ? e.message : String(e);
      }
    };
    el.addEventListener('click', handler);
    this.removers.push(() => el.removeEventListener('click', handler));
  }

  private wire(): void {
    for (const spec of SETTING_SPECS) {
      if (spec.kind === 'number') {
        this.on(ids.dec(spec.key), () => this.store.set(spec.key, stepValue(spec, this.store.value[spec.key], -1)));
        this.on(ids.inc(spec.key), () => this.store.set(spec.key, stepValue(spec, this.store.value[spec.key], 1)));
      } else {
        this.on(ids.button(spec.key), () => this.store.set(spec.key, nextValue(spec, this.store.value[spec.key])));
      }
    }
    this.on(ids.pageButton, () => this.showPage((this.page + 1) % (PAGES.length + this.extra.length)));
    for (const page of this.extra)
      for (const item of page.items)
        this.on(extraId(item.id), () => {
          item.press();
          this.refreshExtra();
        });
    this.on(ids.reset, () => this.store.reset());
    this.on(ids.close, () => this.close());
  }

  /** The panel's own colours: pure black on white in high contrast, so the screen that turns it on follows it. */
  private applyLook(): void {
    const look = this.store.value.highContrast ? 'high' : 'normal';
    for (const [cls, props] of Object.entries(PALETTE[look])) {
      for (const el of this.doc?.getElementsByClassName(cls) ?? []) el.setProperties({ ...props });
    }
  }

  /** Redraws the text of every extra button (a press elsewhere, such as a key, can change them too). */
  refreshExtra(): void {
    for (const page of this.extra)
      for (const item of page.items) this.el(extraId(item.id))?.setProperties({ text: item.text() });
  }

  /** Shows one page of settings and hides the others, and points the page button at the next. */
  private showPage(n: number): void {
    this.page = n;
    const total = PAGES.length + this.extra.length;
    for (let i = 0; i < total; i++) this.el(ids.page(i))?.setProperties({ display: i === n ? 'flex' : 'none' });
    this.el(ids.pageButton)?.setProperties({ text: pageButtonText(n, total) });
    this.el(ids.title)?.setProperties({ text: n < PAGES.length ? 'Settings' : this.extra[n - PAGES.length].title });
  }

  /** Redraws the value of one setting, or of all of them for `null`. */
  private refresh(key: keyof Settings | null): void {
    if (!this.doc) return;
    for (const spec of SETTING_SPECS) {
      if (key !== null && spec.key !== key) continue;
      const id = spec.kind === 'number' ? ids.value(spec.key) : ids.button(spec.key);
      this.el(id)?.setProperties({ text: formatValue(spec.key, this.store.value[spec.key] as never) });
    }
  }
}
