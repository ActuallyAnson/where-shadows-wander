// Saves when the game is about to be left: the headset comes off or the system menu opens (the visibility
// signal), or the page is hidden or closed. Event-driven: nothing here runs per frame. A puzzle ending saves
// through SaveManager.puzzleEnded.
import type { SaveManager } from './save-manager';

/** The part of SessionVisibility this uses. */
export interface VisibilitySignal {
  subscribe(fn: (state: string, paused: boolean) => void): () => void;
}

/** The part of the page this uses: `pagehide` on the window and `visibilitychange` on the document. */
export interface PageEvents {
  window: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  document: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> & { readonly hidden: boolean };
}

/** Returns a function that removes everything it attached. */
export function attachSaveHooks(saves: SaveManager, visibility: VisibilitySignal, page: PageEvents): () => void {
  const unsubscribe = visibility.subscribe((_state, paused) => {
    if (paused) saves.flush();
  });
  const onPageHide = () => void saves.flush();
  const onVisibility = () => {
    if (page.document.hidden) saves.flush();
  };
  page.window.addEventListener('pagehide', onPageHide);
  page.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    unsubscribe();
    page.window.removeEventListener('pagehide', onPageHide);
    page.document.removeEventListener('visibilitychange', onVisibility);
  };
}
