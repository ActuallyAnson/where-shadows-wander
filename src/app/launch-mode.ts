// What the page starts as: the game (the default), the Hand Lab (mock hands at a desk) or the room editor (in the Hand Lab,
// development and tester builds only). The address is always the plain page: the choice is kept in the tab's
// sessionStorage, so a reload stays in the lab while a new tab, or the link sent to a headset, opens the game. Choosing a
// mode saves it and reloads the page. Plain TypeScript, with the storage passed in for the tests.
import { MOCK_SOURCES, type MockSourceKind } from '../input-mock/mock-mode';

export type LaunchMode = 'game' | 'lab' | 'room-editor';
export const LAUNCH_MODES: readonly LaunchMode[] = ['game', 'lab', 'room-editor'];

export interface LaunchChoice {
  mode: LaunchMode;
  /** The Hand Lab's hand source (the lab remembers the last one picked). */
  source: MockSourceKind;
}

export const DEFAULT_LAUNCH: Readonly<LaunchChoice> = { mode: 'game', source: 'synthetic' };
export const LAUNCH_KEY = 'wsw.launch';

/** The part of sessionStorage this uses. */
export interface LaunchStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): LaunchStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage; // reading the property can throw when blocked
  } catch {
    return null;
  }
}

/**
 * The tab's choice (the game if there is none, or the storage is blocked or damaged). Without the debug tools the room
 * editor is not in the build, so it opens as the plain Hand Lab.
 */
export function loadLaunch(debugTools: boolean, storage: LaunchStorage | null = browserStorage()): LaunchChoice {
  try {
    const raw = JSON.parse(storage?.getItem(LAUNCH_KEY) ?? 'null') as Partial<LaunchChoice> | null;
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_LAUNCH };
    let mode = (LAUNCH_MODES as readonly unknown[]).includes(raw.mode) ? (raw.mode as LaunchMode) : 'game';
    if (mode === 'room-editor' && !debugTools) mode = 'lab';
    const source = (MOCK_SOURCES as readonly unknown[]).includes(raw.source)
      ? (raw.source as MockSourceKind)
      : DEFAULT_LAUNCH.source;
    return { mode, source };
  } catch {
    return { ...DEFAULT_LAUNCH };
  }
}

/** Remembers the choice for this tab. Returns false if the storage refused. */
export function saveLaunch(choice: Readonly<LaunchChoice>, storage: LaunchStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LAUNCH_KEY, JSON.stringify({ mode: choice.mode, source: choice.source }));
    return true;
  } catch {
    return false;
  }
}

/** Saves `mode` (keeping the lab's source) and reloads the page into it. */
export function switchLaunch(mode: LaunchMode, debugTools: boolean): void {
  saveLaunch({ ...loadLaunch(debugTools), mode });
  location.reload();
}

/** Whether `mode` runs on mock hands (the Hand Lab, and the room editor inside it). */
export function isDeskMode(mode: LaunchMode): boolean {
  return mode !== 'game';
}
