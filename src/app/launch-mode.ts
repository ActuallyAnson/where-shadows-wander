// What the page starts as, and whose hands play it (ADR 0018). The mode is the game (the default) or the room editor (a desk
// tool, development and tester builds only). The hands are the device's (a headset, or the emulator's) or, for testing, a mock
// source the Hand Lab panel drives inside the same session: synthetic, scripted, a replay or the webcam. The address is always
// the plain page: the choice is kept in the tab's sessionStorage, so a reload keeps it while a new tab, or the link sent to a
// headset, opens the plain game. Choosing saves it and reloads the page. Plain TypeScript, with the storage passed in for the
// tests.
import { MOCK_SOURCES, type MockSourceKind } from '../input-mock/mock-mode';

export type LaunchMode = 'game' | 'room-editor';
export const LAUNCH_MODES: readonly LaunchMode[] = ['game', 'room-editor'];

/** Whose hands play: the device's, or a mock source (the Hand Lab). */
export type HandsChoice = 'device' | MockSourceKind;
export const HANDS_CHOICES: readonly HandsChoice[] = ['device', ...MOCK_SOURCES];

export interface LaunchChoice {
  mode: LaunchMode;
  hands: HandsChoice;
}

export const DEFAULT_LAUNCH: Readonly<LaunchChoice> = { mode: 'game', hands: 'device' };
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

const isHands = (v: unknown): v is HandsChoice => (HANDS_CHOICES as readonly unknown[]).includes(v);

/**
 * The tab's choice (the plain game if there is none, or the storage is blocked or damaged). Both the room editor and mock
 * hands are testing tools: without the debug tools they are not in the build, so the page opens as the plain game. A tab
 * left in the old Hand Lab mode (`{ mode: 'lab', source }`) opens the game with that source's hands.
 */
export function loadLaunch(debugTools: boolean, storage: LaunchStorage | null = browserStorage()): LaunchChoice {
  if (!debugTools) return { ...DEFAULT_LAUNCH };
  try {
    const raw = JSON.parse(storage?.getItem(LAUNCH_KEY) ?? 'null') as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_LAUNCH };
    if (raw.mode === 'lab') return { mode: 'game', hands: isHands(raw.source) ? raw.source : 'synthetic' };
    const mode = (LAUNCH_MODES as readonly unknown[]).includes(raw.mode) ? (raw.mode as LaunchMode) : 'game';
    return { mode, hands: isHands(raw.hands) ? raw.hands : DEFAULT_LAUNCH.hands };
  } catch {
    return { ...DEFAULT_LAUNCH };
  }
}

/** Remembers the choice for this tab. Returns false if the storage refused. */
export function saveLaunch(choice: Readonly<LaunchChoice>, storage: LaunchStorage | null = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(LAUNCH_KEY, JSON.stringify({ mode: choice.mode, hands: choice.hands }));
    return true;
  } catch {
    return false;
  }
}

/** Saves `mode` (keeping the hands) and reloads the page into it. */
export function switchLaunch(mode: LaunchMode, debugTools: boolean): void {
  saveLaunch({ ...loadLaunch(debugTools), mode });
  location.reload();
}

/** Saves whose hands play (keeping the mode) and reloads the page with them. */
export function switchHands(hands: HandsChoice, debugTools: boolean): void {
  saveLaunch({ ...loadLaunch(debugTools), hands });
  location.reload();
}

/** Whether `mode` runs at a desk with no session (the room editor). The game always runs in one. */
export function isDeskMode(mode: LaunchMode): boolean {
  return mode !== 'game';
}
