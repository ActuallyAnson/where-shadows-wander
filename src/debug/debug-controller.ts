// The state of the debug tools and the list of buttons the menu shows. It holds no engine objects: what a switch or an
// overlay actually does is injected as `effects`, so this is tested in Node and the same controller serves the keyboard,
// the on-page HUD and the hands-only menu. Plain TypeScript.
import type { DebugKeyAction } from './debug-keys';
import { DebugActions } from './debug-actions';

export const SYSTEMS = ['shadow', 'sharpen', 'flicker', 'candleLight', 'handVisual'] as const;
export type SystemKey = (typeof SYSTEMS)[number];
export const OVERLAYS = ['capsules', 'joints'] as const;
export type OverlayKey = (typeof OVERLAYS)[number];

export const SYSTEM_INFO: Readonly<Record<SystemKey, { label: string; help: string }>> = {
  shadow: { label: 'Shadow', help: 'The black hand shadow on the wall.' },
  sharpen: { label: 'Sharpen', help: 'The edge sharpening while a shape is recognised.' },
  flicker: { label: 'Flicker', help: 'The lantern flame flicker (off is steady).' },
  candleLight: { label: 'Candle light', help: 'The point light the candle casts on the room.' },
  handVisual: { label: 'Hand visual', help: 'The glove drawn over your hands.' },
};
export const OVERLAY_INFO: Readonly<Record<OverlayKey, { label: string; help: string }>> = {
  capsules: { label: 'Shadow capsules', help: 'The capsules your hands are made of on the wall.' },
  joints: { label: 'Joint dots', help: 'A dot on each tracked hand joint.' },
};

export interface DebugEffects {
  /** Switch one system on or off. Must be safe to call before the game has made the thing. */
  system(key: SystemKey, on: boolean): void;
  /** Show or hide one overlay. */
  overlay(key: OverlayKey, on: boolean): void;
  /** Start or stop replaying the demo recording. Resolves false if it could not start. */
  replay(on: boolean): boolean | Promise<boolean>;
}

/** One button in the menu. */
export interface DebugItem {
  id: string;
  label: string;
  help: string;
  /** The button's current text. */
  text(): string;
  press(): void;
}
export interface DebugPage {
  title: string;
  items: DebugItem[];
}

/** Buttons per page: the same six as the settings pages, which is what fits at a size a fingertip can use. */
export const ITEMS_PER_PAGE = 6;

export class DebugController {
  readonly actions = new DebugActions();
  readonly systems: Record<SystemKey, boolean> = {
    shadow: true,
    sharpen: true,
    flicker: true,
    candleLight: true,
    handVisual: true,
  };
  readonly overlays: Record<OverlayKey, boolean> = { capsules: false, joints: false };
  replaying = false;
  /** Why the last replay start failed, if it did. */
  replayError: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly effects: DebugEffects) {}

  setSystem(key: SystemKey, on: boolean): void {
    if (this.systems[key] === on) return;
    this.systems[key] = on;
    this.effects.system(key, on);
    this.changed();
  }

  setOverlay(key: OverlayKey, on: boolean): void {
    if (this.overlays[key] === on) return;
    this.overlays[key] = on;
    this.effects.overlay(key, on);
    this.changed();
  }

  async setReplay(on: boolean): Promise<void> {
    if (this.replaying === on) return;
    this.replayError = null;
    try {
      const ok = await this.effects.replay(on);
      this.replaying = on ? ok : false;
      if (on && !ok) this.replayError = 'could not start the replay';
    } catch (e) {
      this.replaying = false;
      this.replayError = e instanceof Error ? e.message : String(e);
    }
    this.changed();
  }

  /** What a keyboard press does; the same actions as the menu buttons. */
  handleKey(action: DebugKeyAction): void {
    switch (action) {
      case 'replay':
        void this.setReplay(!this.replaying);
        return;
      case 'developer':
        return; // the page owns no debug state: DebugTools hands this key to onDeveloperKey
      case 'capsules':
      case 'joints':
        this.setOverlay(action, !this.overlays[action]);
        return;
      default:
        if (action.startsWith('system:')) {
          const key = action.slice(7) as SystemKey;
          this.setSystem(key, !this.systems[key]);
          return;
        }
    }
    this.changed();
  }

  /** Called after any change, for a HUD or the menu to redraw. Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** One line for a HUD: what is not normal right now. */
  status(): string {
    const parts: string[] = [];
    const off = SYSTEMS.filter((s) => !this.systems[s]);
    if (off.length) parts.push(`off: ${off.join(', ')}`);
    const shown = OVERLAYS.filter((o) => this.overlays[o]);
    if (shown.length) parts.push(`showing: ${shown.join(', ')}`);
    if (this.replaying) parts.push('REPLAY');
    return parts.join('  ');
  }

  /** The menu: pages of six buttons. Any registered actions follow, a group at a time. */
  pages(): DebugPage[] {
    const onOff = (on: boolean) => (on ? 'ON' : 'off');
    const press = (fn: () => void) => () => {
      fn();
      this.changed();
    };
    const views: DebugItem[] = [
      ...OVERLAYS.map<DebugItem>((o) => ({
        id: o,
        label: OVERLAY_INFO[o].label,
        help: OVERLAY_INFO[o].help,
        text: () => onOff(this.overlays[o]),
        press: () => this.setOverlay(o, !this.overlays[o]),
      })),
    ];
    const systems: DebugItem[] = [
      ...SYSTEMS.map<DebugItem>((s) => ({
        id: `system-${s}`,
        label: SYSTEM_INFO[s].label,
        help: `${SYSTEM_INFO[s].help} Press to switch it off or on.`,
        text: () => (this.systems[s] ? 'on' : 'OFF'),
        press: () => this.setSystem(s, !this.systems[s]),
      })),
      {
        id: 'replay',
        label: 'Replay',
        help: 'Play the demo hand recording into the game, in place of your hands.',
        text: () => (this.replaying ? 'Replaying: stop' : this.replayError ? 'Failed: try again' : 'Start replay'),
        press: () => void this.setReplay(!this.replaying),
      },
    ];
    const pages: DebugPage[] = [
      { title: 'Debug: views', items: views },
      { title: 'Debug: systems and replay', items: systems },
    ];
    const groups = new Map<string, DebugItem[]>();
    for (const a of this.actions.all()) {
      const items = groups.get(a.group) ?? [];
      items.push({
        id: `action-${a.id}`,
        label: a.label,
        help: a.help ?? `Run "${a.id}".`,
        text: () => 'Run',
        press: press(() => void this.actions.run(a.id)),
      });
      groups.set(a.group, items);
    }
    for (const [group, items] of groups)
      for (let i = 0; i < items.length; i += ITEMS_PER_PAGE)
        pages.push({
          title: `Debug: ${group}${items.length > ITEMS_PER_PAGE ? ` ${i / ITEMS_PER_PAGE + 1}` : ''}`,
          items: items.slice(i, i + ITEMS_PER_PAGE),
        });
    return pages;
  }

  private changed(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch {
        // a HUD that fails to draw must not stop the others
      }
    }
  }
}
