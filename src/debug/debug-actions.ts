// Named things the debug menu can run, registered by whoever owns them. This is where "skip to a puzzle" plugs in:
// when the puzzle code (Teammate A) and the puzzle framework (Teammate B) exist, they register one action per puzzle,
//
//   if (DEBUG_TOOLS) debug.actions.register({ id: 'c1-p2', group: 'Puzzles', label: 'Chapter 1, puzzle 3', run: () => game.jumpTo('c1-p2') });
//
// and the menu lists them with no further change. Plain TypeScript.

export interface DebugAction {
  /** Unique id (letters, digits, - and _). */
  id: string;
  /** Section title in the menu, e.g. 'Puzzles'. */
  group: string;
  /** What the button says. */
  label: string;
  /** One line under it (optional). */
  help?: string;
  run(): void;
}

export class DebugActions {
  private readonly list: DebugAction[] = [];

  /** Adds an action, or replaces the one with the same id. Returns a function that removes it. */
  register(action: DebugAction): () => void {
    const i = this.list.findIndex((a) => a.id === action.id);
    if (i >= 0) this.list[i] = action;
    else this.list.push(action);
    return () => {
      const at = this.list.indexOf(action);
      if (at >= 0) this.list.splice(at, 1);
    };
  }

  /** All actions, in the order registered. */
  all(): readonly DebugAction[] {
    return this.list;
  }

  /** Runs one by id. Returns false for an unknown id, or if the action threw (the error is returned in `lastError`). */
  run(id: string): boolean {
    const a = this.list.find((x) => x.id === id);
    if (!a) return false;
    try {
      a.run();
      this.lastError = null;
      return true;
    } catch (e) {
      this.lastError = `${id}: ${e instanceof Error ? e.message : String(e)}`;
      return false;
    }
  }

  lastError: string | null = null;
}
