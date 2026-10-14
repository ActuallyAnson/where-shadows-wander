// The testing switches (joint dots, shadow capsules, open the settings panel when VR starts, record hands) as a plain
// object. The launcher's Testing panel changes them and they are remembered in the browser (`wsw.testing`), so nobody
// types an address; the older address forms (?debug=joints, ?record ...) still parse to the same object, for the
// scripts that drive the page. Plain TypeScript.

export type RecordChoice = 'off' | 'free' | 'shapes';

export interface TestingOptions {
  /** A dot on every tracked hand joint (?debug=joints). */
  joints: boolean;
  /** The shadow's collision capsules (?debug=shadow). */
  shadow: boolean;
  /** The settings panel opens a second after the headset session starts (?settings). */
  settings: boolean;
  /** Hand recording: 20 s of free hands (?record=20), or the guided shape script, 84 s (?record&script=shapes). */
  record: RecordChoice;
}

export const DEFAULT_TESTING: Readonly<TestingOptions> = {
  joints: false,
  shadow: false,
  settings: false,
  record: 'off',
};

export const RECORD_CHOICES: readonly RecordChoice[] = ['off', 'free', 'shapes'];
export const FREE_RECORD_SECONDS = 20;

/** Reads the switches out of an address's query string (with or without the leading "?"). */
export function parseTesting(search: string): TestingOptions {
  const p = new URLSearchParams(search);
  const debug = new Set(p.getAll('debug').flatMap((v) => v.split(',').map((x) => x.trim())));
  return {
    joints: debug.has('joints'),
    shadow: debug.has('shadow'),
    settings: p.has('settings'),
    record: !p.has('record') ? 'off' : p.get('script') === 'shapes' ? 'shapes' : 'free',
  };
}

/** The query string (with its "?", or "" when there is nothing) for `options`, keeping everything else in `search`. */
export function buildTesting(search: string, options: Readonly<TestingOptions>): string {
  const p = new URLSearchParams(search);
  // Drop the switches this owns, and any other debug views stay.
  const keepDebug = p
    .getAll('debug')
    .flatMap((v) => v.split(',').map((x) => x.trim()))
    .filter((v) => v && v !== 'joints' && v !== 'shadow');
  for (const k of ['debug', 'settings', 'record', 'script', 'note']) p.delete(k);
  const debug = [...(options.joints ? ['joints'] : []), ...(options.shadow ? ['shadow'] : []), ...keepDebug];
  if (debug.length) p.set('debug', debug.join(','));
  if (options.settings) p.set('settings', '');
  if (options.record === 'free') p.set('record', String(FREE_RECORD_SECONDS));
  if (options.record === 'shapes') {
    p.set('record', '');
    p.set('script', 'shapes');
  }
  // "?settings=" reads the same as "?settings" (the game only asks whether it is there), but the short form is kept readable.
  const text = p
    .toString()
    .replace(/(^|&)(settings|record)=(?=&|$)/g, '$1$2')
    .replace(/%2C/g, ',');
  return text ? `?${text}` : '';
}

/** What each button says about its current value. */
export function describeTesting(o: Readonly<TestingOptions>): string[] {
  const on: string[] = [];
  if (o.joints) on.push('joint dots');
  if (o.shadow) on.push('shadow capsules');
  if (o.settings) on.push('settings panel on entry');
  if (o.record === 'free') on.push(`recording ${FREE_RECORD_SECONDS} s`);
  if (o.record === 'shapes') on.push('guided shape recording (84 s)');
  return on;
}

/** The next choice in a list, wrapping round: what pressing a cycling button does. */
export function nextChoice<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

/** Where the switches are remembered, and the event the Testing panel raises when one changes. */
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
