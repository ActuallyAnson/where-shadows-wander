import { describe, expect, it } from 'vitest';
import { FakeStore } from './fake-store';
import { attachSaveHooks, type VisibilitySignal } from './save-hooks';
import { SaveManager } from './save-manager';

function setup() {
  const store = new FakeStore();
  const saves = new SaveManager({ store, now: () => 1000, today: () => '2026-10-11' });
  saves.load();
  let listener: ((state: string, paused: boolean) => void) | null = null;
  const visibility: VisibilitySignal = {
    subscribe(fn) {
      listener = fn;
      return () => void (listener = null);
    },
  };
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const detach = attachSaveHooks(saves, visibility, { window: win, document: doc });
  return {
    store,
    saves,
    win,
    doc,
    detach,
    fire: (s: string, p: boolean) => listener?.(s, p),
    listening: () => listener !== null,
  };
}

/** Any change to the save: the captions setting flipped. */
const change = (saves: SaveManager) =>
  saves.setSettings({ ...saves.data.settings, captions: !saves.data.settings.captions });

describe('attachSaveHooks', () => {
  it('saves when the headset comes off or the system menu opens (paused), not when it resumes', () => {
    const { saves, store, fire } = setup();
    change(saves);
    fire('visible', false);
    expect(store.sets).toEqual([]);
    fire('hidden', true);
    expect(store.sets).toHaveLength(1);
    change(saves);
    fire('visible-blurred', true);
    expect(store.sets).toHaveLength(2);
  });

  it('saves when the page is hidden or closed', () => {
    const { saves, store, win, doc } = setup();
    change(saves);
    win.dispatchEvent(new Event('pagehide'));
    expect(store.sets).toHaveLength(1);
    change(saves);
    doc.hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(store.sets).toHaveLength(1);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(store.sets).toHaveLength(2);
  });

  it('does no work when nothing changed', () => {
    const { store, win, fire } = setup();
    fire('hidden', true);
    win.dispatchEvent(new Event('pagehide'));
    expect(store.sets).toEqual([]);
  });

  it('stops listening when detached', () => {
    const { saves, store, win, detach, listening } = setup();
    detach();
    expect(listening()).toBe(false);
    change(saves);
    win.dispatchEvent(new Event('pagehide'));
    expect(store.sets).toEqual([]);
  });

  it('a failing store does not throw out of an event handler', () => {
    const { saves, store, win, fire } = setup();
    store.setError = () => new Error('full');
    change(saves);
    expect(() => win.dispatchEvent(new Event('pagehide'))).not.toThrow();
    expect(() => fire('hidden', true)).not.toThrow();
  });
});
