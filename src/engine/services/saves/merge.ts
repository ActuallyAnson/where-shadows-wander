// Combines two saves into one, so two browser tabs (or a stale copy) cannot undo each other's changes. Starting over
// wins outright: a copy made after more resets replaces the other, so a stale tab cannot bring a wiped save back.
// Plain TypeScript.
import type { SaveData } from './schema';

export function mergeData(a: SaveData, b: SaveData): SaveData {
  if (a.resetCount !== b.resetCount) return a.resetCount > b.resetCount ? a : b;
  return {
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    lastPlayedDay: a.lastPlayedDay > b.lastPlayedDay ? a.lastPlayedDay : b.lastPlayedDay,
    resetCount: a.resetCount,
    // The settings changed last win, whole (mixing two copies' values would give a combination nobody chose).
    settings: a.settingsAt >= b.settingsAt ? a.settings : b.settings,
    settingsAt: Math.max(a.settingsAt, b.settingsAt),
  };
}
