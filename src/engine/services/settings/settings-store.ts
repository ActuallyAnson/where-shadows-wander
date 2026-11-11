// The live settings: one object the panel changes and everything else reads. Each change is repaired into range,
// applied at once to the engine objects it controls (recognizer, shadow, lantern, mixer), and announced to
// listeners (the saves, the stage for high contrast, the captions). Plain TypeScript: it reaches the engine
// only through the small shapes below, so it is tested without three.js or a browser.
import { Bus } from '../audio/mixer';
import {
  COMPANION_HOLD_FACTOR,
  DEFAULT_SETTINGS,
  repairSettings,
  repairValue,
  SETTING_SPECS,
  type Settings,
} from './settings';

/** The parts of the game the settings steer. Any may be missing (the Hand Lab has no mixer). */
export interface SettingsTargets {
  recognizer?: { setTolerance(tolerance: number): void; setHoldTimes(verbS: number, companionS: number): void };
  projector?: { settings: { size: number } };
  sharpen?: { settings: { strength: number } };
  lantern?: { settings: { amplitude: number } };
  mixer?: { setMaster(volume: number): void; setVolume(bus: number, volume: number): void };
}

export interface SettingsStoreOptions {
  /**
   * Settings the player has not chosen yet are left to the game's own defaults rather than forced: the lantern
   * flicker, say, follows the device's reduced-motion preference until the player moves its slider.
   * Keys listed here are not applied until `hold(key, false)` (the developer overlay's test flicker overrides the setting).
   */
  neverApply?: readonly (keyof Settings)[];
  /** Keys applied only once the player has changed them this session or saved a non-default value. */
  applyOnlyWhenChosen?: readonly (keyof Settings)[];
}

export type SettingsListener = (key: keyof Settings | null, settings: Readonly<Settings>) => void;

export class SettingsStore {
  /** The current values. Read it; change it only through `set`, `setAll` and `reset`. */
  readonly value: Readonly<Settings>;
  private readonly live: Settings;
  private readonly listeners = new Set<SettingsListener>();
  private readonly chosen = new Set<keyof Settings>();
  private readonly held: Set<keyof Settings>;

  constructor(
    private readonly targets: SettingsTargets = {},
    private readonly options: SettingsStoreOptions = {},
    initial: unknown = undefined,
  ) {
    this.held = new Set(options.neverApply);
    this.live = repairSettings(initial).settings;
    this.value = this.live;
    for (const s of SETTING_SPECS) if (this.live[s.key] !== DEFAULT_SETTINGS[s.key]) this.chosen.add(s.key);
    this.applyAll();
  }

  /** Changes one setting (repaired into range), applies it and tells the listeners. Returns false if nothing changed. */
  set<K extends keyof Settings>(key: K, value: unknown): boolean {
    const fixed = repairValue(key, value);
    const newlyChosen = !this.chosen.has(key);
    this.chosen.add(key);
    const changed = this.live[key] !== fixed;
    this.live[key] = fixed;
    // Choosing the default for a setting that was following the device's own default still takes effect.
    if (changed || newlyChosen) this.apply(key);
    if (changed) this.emit(key);
    return changed;
  }

  /** Replaces everything, e.g. from the save once it is loaded. Listeners hear one `null` change. */
  setAll(next: unknown): void {
    const fixed = repairSettings(next).settings;
    for (const s of SETTING_SPECS) {
      (this.live as unknown as Record<string, unknown>)[s.key] = fixed[s.key];
      if (fixed[s.key] !== DEFAULT_SETTINGS[s.key]) this.chosen.add(s.key);
    }
    this.applyAll();
    this.emit(null);
  }

  /** Back to the defaults, applied everywhere (including a flicker the player had changed). */
  reset(): void {
    for (const s of SETTING_SPECS) {
      (this.live as unknown as Record<string, unknown>)[s.key] = s.default;
      this.chosen.add(s.key);
    }
    this.applyAll();
    this.emit(null);
  }

  /**
   * Holds a setting back (a test override owns its target meanwhile), or with `on` false applies it again. Releasing
   * a setting the player has not chosen leaves the target as it is (see applyOnlyWhenChosen).
   */
  hold(key: keyof Settings, on: boolean): void {
    if (on) this.held.add(key);
    else if (this.held.delete(key)) this.apply(key);
  }

  subscribe(fn: SettingsListener): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** The companion hold time that goes with a verb hold time. */
  static companionHold(verbS: number): number {
    return verbS * COMPANION_HOLD_FACTOR;
  }

  private emit(key: keyof Settings | null): void {
    for (const fn of [...this.listeners]) {
      try {
        fn(key, this.live);
      } catch {
        // one listener's failure must not stop the others, or the setting that was just applied
      }
    }
  }

  private applyAll(): void {
    for (const s of SETTING_SPECS) this.apply(s.key);
  }

  private apply(key: keyof Settings): void {
    const t = this.targets;
    const v = this.live;
    if (this.held.has(key)) return;
    if (this.options.applyOnlyWhenChosen?.includes(key) && !this.chosen.has(key)) return;
    switch (key) {
      case 'tolerance':
        t.recognizer?.setTolerance(v.tolerance);
        break;
      case 'holdTime':
        t.recognizer?.setHoldTimes(v.holdTime, SettingsStore.companionHold(v.holdTime));
        break;
      case 'shadowSize':
        if (t.projector) t.projector.settings.size = v.shadowSize;
        break;
      case 'sharpen':
        if (t.sharpen) t.sharpen.settings.strength = v.sharpen;
        break;
      case 'flicker':
        if (t.lantern) t.lantern.settings.amplitude = v.flicker;
        break;
      case 'volumeMaster':
        t.mixer?.setMaster(v.volumeMaster);
        break;
      case 'volumeMusic':
        t.mixer?.setVolume(Bus.Music, v.volumeMusic);
        break;
      case 'volumeEffects':
        t.mixer?.setVolume(Bus.Effects, v.volumeEffects);
        break;
      case 'volumeAmbience':
        t.mixer?.setVolume(Bus.Ambience, v.volumeAmbience);
        break;
      default:
        break; // highContrast, captions and hand are read by listeners
    }
  }
}
