// The debug tools, assembled: the controller (state and menu), the overlays, the switches that turn each system off,
// the replay, the keyboard and a one-line HUD. Only ever reached through a dynamic import behind DEBUG_TOOLS
// (debug-flag.ts), so a normal build does not contain it. With every tool off, the per-frame cost is one call that
// returns at once.
import type { Scene } from '@iwsdk/core';
import type { HandFrame, Handedness } from '../engine/hands/hand';
import type { ShadowProjector } from '../engine/shadow/pure/shadow-projector';
import type { StagePlane } from '../engine/shadow/pure/stage-plane';
import { ShadowDebug } from '../engine/shadow/shadow-debug';
import type { SettingsStore } from '../engine/services/settings/settings-store';
import { JointDots } from '../engine/xr/joint-dots';
import { DebugController, OVERLAYS, type OverlayKey, type SystemKey } from './debug-controller';
import { debugKeyAction } from './debug-keys';
import { HandReplay } from './hand-replay';

/** What the tools reach into. All of it already exists in main.ts; nothing here makes game objects. */
export interface DebugContext {
  scene: Scene;
  handFrames: Readonly<Record<Handedness, HandFrame>>;
  handList: readonly HandFrame[];
  projector: ShadowProjector;
  stage: StagePlane;
  sharpen: { settings: { strength: number } };
  lantern: { settings: { amplitude: number } };
  candleLight: { visible: boolean };
  settings: SettingsStore;
  /** The frame-time summary line, if there is one (it changes once a few seconds). */
  readout?: () => string;
  /** main.ts draws the glove only while this is true. */
  flags: { handVisual: boolean };
  flame: () => ArrayLike<number> | null;
  /** Where to show the HUD line (document.body by default). */
  hudParent?: HTMLElement;
}

export class DebugTools {
  readonly controller: DebugController;
  readonly replay = new HandReplay();
  private readonly shadowDebug = new ShadowDebug();
  readonly dots = new JointDots();
  private savedFlicker = 1;
  private flickerOff = false;
  private readonly hud: HTMLDivElement;
  private lastStatus = '\u0000';
  private lastLine: string | undefined;
  private readonly removers: (() => void)[] = [];

  constructor(private readonly ctx: DebugContext) {
    ctx.scene.add(this.shadowDebug.group, this.dots.mesh);
    this.dots.mesh.visible = false;
    this.controller = new DebugController({
      system: (key, on) => this.applySystem(key, on),
      overlay: (key, on) => this.applyOverlay(key, on),
      replay: async (on) => {
        if (!on) return (void this.replay.stop(), true);
        return this.replay.start();
      },
    });
    // The settings screen changes some of the same values (sharpen, flicker): keep a switched-off system off.
    this.removers.push(
      ctx.settings.subscribe((key) => {
        if (key === 'flicker' || key === null) this.savedFlicker = ctx.settings.value.flicker;
        for (const s of ['sharpen', 'flicker'] as const) if (!this.controller.systems[s]) this.applySystem(s, false);
      }),
    );
    this.hud = document.createElement('div');
    this.hud.style.cssText =
      'position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:9998;padding:4px 8px;border-radius:6px;pointer-events:none;' +
      'font:12px ui-monospace,monospace;background:rgba(15,18,24,0.85);color:#e3b341;white-space:pre;';
    (ctx.hudParent ?? document.body).append(this.hud);
    this.controller.subscribe(() => this.drawHud());
    this.drawHud();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const action = debugKeyAction(e);
      if (!action) return;
      e.preventDefault();
      this.controller.handleKey(action);
    };
    window.addEventListener('keydown', onKey);
    this.removers.push(() => window.removeEventListener('keydown', onKey));
  }

  /** Per frame, after the shadows are updated. Returns at once when nothing is shown. */
  frame(rigPlaced: boolean): void {
    const line = this.ctx.readout?.();
    if (line !== this.lastLine) {
      this.lastLine = line;
      this.drawHud();
    }
    const o = this.controller.overlays;
    if (o.capsules)
      this.shadowDebug.update(
        this.ctx.projector.shadows,
        this.ctx.handFrames,
        this.ctx.stage,
        this.ctx.projector.matrix,
      );
    if (o.joints) this.dots.update(this.ctx.handList, rigPlaced ? this.ctx.flame() : null);
  }

  /** Switches an overlay from outside (the testing switches preset in storage). */
  showOverlay(key: OverlayKey, on = true): void {
    this.controller.setOverlay(key, on);
  }

  dispose(): void {
    for (const r of this.removers.splice(0)) r();
    this.hud.remove();
    this.ctx.scene.remove(this.shadowDebug.group, this.dots.mesh);
  }

  private applyOverlay(key: OverlayKey, on: boolean): void {
    if (key === 'capsules') this.shadowDebug.setVisible('capsules', on);
    else this.dots.mesh.visible = on;
  }

  private applySystem(key: SystemKey, on: boolean): void {
    const c = this.ctx;
    switch (key) {
      case 'shadow':
        break; // read by the frame loop (systems.shadow): the hands' shadow is cast with no strength while it is off
      case 'sharpen':
        c.sharpen.settings.strength = on ? c.settings.value.sharpen : 0;
        break;
      case 'flicker':
        if (on) {
          this.flickerOff = false;
          c.lantern.settings.amplitude = this.savedFlicker;
        } else {
          // Remember what the flame was doing (the device's default or the player's choice) the first time only.
          if (!this.flickerOff) this.savedFlicker = c.lantern.settings.amplitude;
          this.flickerOff = true;
          c.lantern.settings.amplitude = 0;
        }
        break;
      case 'candleLight':
        c.candleLight.visible = on;
        break;
      case 'handVisual':
        c.flags.handVisual = on;
        break;
    }
  }

  private drawHud(): void {
    const status = this.controller.status() + (this.ctx.readout?.() ?? '');
    if (status === this.lastStatus) return;
    this.lastStatus = status;
    const frames = this.ctx.readout?.();
    const text = this.controller.status();
    this.hud.textContent =
      (text ? `DEBUG  ${text}` : 'DEBUG  Alt+K capsules  Alt+J joints  Alt+R replay') +
      (frames ? `  |  ${frames}` : '');
  }
}

export { OVERLAYS };
