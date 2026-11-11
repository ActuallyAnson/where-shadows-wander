// The testing switches (joint dots, shadow capsules, open the settings panel when VR starts, record hands, the lantern's
// flicker) as a plain object. The launcher's Developer panel changes them and they are remembered in the browser
// (`wsw.testing`), so nobody types an address; the probe scripts write the same key before the page loads. Plain
// TypeScript.

export type RecordChoice = 'off' | 'free' | 'shapes';
/** Which menu screen to show in the room (menu-panel), or none. */
export type MenuChoice = 'off' | 'pause';
export const MENU_CHOICES: readonly MenuChoice[] = ['off', 'pause'];

/** The lantern's flicker, 0 (steady) to 1, in place of the player's setting; null leaves the setting alone. */
export type FlickerChoice = number | null;
export const FLICKER_CHOICES: readonly FlickerChoice[] = [null, 0, 0.5, 1];

export interface TestingOptions {
  /** A dot on every tracked hand joint. */
  joints: boolean;
  /** The shadow's collision capsules. */
  shadow: boolean;
  /** The settings panel opens a second after the headset session starts. */
  settings: boolean;
  /** Hand recording when VR starts: 20 s of free hands, or the guided shape script (84 s). */
  record: RecordChoice;
  /** A menu screen showing in the room, to look at it. */
  menu: MenuChoice;
  /** The lantern's flicker for testing (a steady light for screenshots); read when the page starts. */
  flicker: FlickerChoice;
}

export const DEFAULT_TESTING: Readonly<TestingOptions> = {
  joints: false,
  shadow: false,
  settings: false,
  record: 'off',
  menu: 'off',
  flicker: null,
};

export const RECORD_CHOICES: readonly RecordChoice[] = ['off', 'free', 'shapes'];
export const FREE_RECORD_SECONDS = 20;

/** What each button says about its current value. */
export function describeTesting(o: Readonly<TestingOptions>): string[] {
  const on: string[] = [];
  if (o.joints) on.push('joint dots');
  if (o.shadow) on.push('shadow capsules');
  if (o.settings) on.push('settings panel on entry');
  if (o.record === 'free') on.push(`recording ${FREE_RECORD_SECONDS} s`);
  if (o.record === 'shapes') on.push('guided shape recording (84 s)');
  if (o.menu !== 'off') on.push(`${o.menu} screen`);
  if (o.flicker !== null) on.push(`lantern flicker ${o.flicker}`);
  return on;
}

/** The next choice in a list, wrapping round: what pressing a cycling button does. */
export function nextChoice<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

/** Where the switches are remembered, and the event the Developer panel raises when one changes. */
export const TESTING_KEY = 'wsw.testing';
export const TESTING_EVENT = 'wsw-testing';

/** The part of localStorage this uses. */
export interface TestingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): TestingStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage; // reading the property can throw when blocked
  } catch {
    return null;
  }
}

/** The remembered switches (all off if there are none, or the storage is blocked or damaged). */
export function loadTesting(storage: TestingStorage | null = browserStorage()): TestingOptions {
  try {
    const raw = JSON.parse(storage?.getItem(TESTING_KEY) ?? 'null') as Partial<TestingOptions> | null;
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_TESTING };
    return {
      joints: raw.joints === true,
      shadow: raw.shadow === true,
      settings: raw.settings === true,
      record: (RECORD_CHOICES as readonly string[]).includes(raw.record ?? '') ? (raw.record as RecordChoice) : 'off',
      menu: (MENU_CHOICES as readonly string[]).includes(raw.menu ?? '') ? (raw.menu as MenuChoice) : 'off',
      flicker:
        typeof raw.flicker === 'number' && Number.isFinite(raw.flicker) ? Math.min(Math.max(raw.flicker, 0), 1) : null,
    };
  } catch {
    return { ...DEFAULT_TESTING };
  }
}

/** Remembers the switches. Returns false if the storage refused (the switches still work until the page closes). */
export function saveTesting(
  options: Readonly<TestingOptions>,
  storage: TestingStorage | null = browserStorage(),
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(TESTING_KEY, JSON.stringify(options));
    return true;
  } catch {
    return false;
  }
}
