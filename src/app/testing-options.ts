// The testing switches (joint dots, shadow capsules, open the settings panel when VR starts, record hands, the lantern's
// flicker) as a plain object, remembered in the browser (`wsw.testing`) and read when the page starts. The probe scripts
// write the key before the page loads; the developer overlay (developer-overlay.ts) changes the flicker. Plain TypeScript.

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
  /** Covering the lit flame plays the end at any point of the story, not only in scene 7 (to test the end). */
  coverEnds: boolean;
}

export const DEFAULT_TESTING: Readonly<TestingOptions> = {
  joints: false,
  shadow: false,
  settings: false,
  record: 'off',
  menu: 'off',
  flicker: null,
  coverEnds: false,
};

export const RECORD_CHOICES: readonly RecordChoice[] = ['off', 'free', 'shapes'];
export const FREE_RECORD_SECONDS = 20;

/** The next choice in a list, wrapping round: what pressing a cycling button does. */
export function nextChoice<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

/** Where the switches are remembered. */
export const TESTING_KEY = 'wsw.testing';

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
      coverEnds: raw.coverEnds === true,
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
