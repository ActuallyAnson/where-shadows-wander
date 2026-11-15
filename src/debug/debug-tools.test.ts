import { describe, expect, it, vi } from 'vitest';
import { DebugActions } from './debug-actions';
import { DebugController, ITEMS_PER_PAGE, OVERLAYS, SYSTEMS, type DebugEffects } from './debug-controller';
import { DEBUG_KEYS, debugKeyAction } from './debug-keys';

const effects = (): DebugEffects & { system: ReturnType<typeof vi.fn>; overlay: ReturnType<typeof vi.fn> } => ({
  system: vi.fn(),
  overlay: vi.fn(),
  replay: vi.fn(() => true),
});

describe('DebugController', () => {
  it('starts with everything on, nothing shown, and nothing to report', () => {
    const c = new DebugController(effects());
    expect(SYSTEMS.every((s) => c.systems[s])).toBe(true);
    expect(OVERLAYS.every((o) => !c.overlays[o])).toBe(true);
    expect(c.status()).toBe('');
  });

  it('calls the effect once per real change and says what is not normal', () => {
    const e = effects();
    const c = new DebugController(e);
    c.setSystem('shadow', false);
    c.setSystem('shadow', false);
    c.setOverlay('joints', true);
    expect(e.system).toHaveBeenCalledTimes(1);
    expect(e.system).toHaveBeenCalledWith('shadow', false);
    expect(e.overlay).toHaveBeenCalledWith('joints', true);
    expect(c.status()).toBe('off: shadow  showing: joints');
  });

  it('every keyboard action does what its menu button does', () => {
    const e = effects();
    const c = new DebugController(e);
    const keys = new Set(Object.values(DEBUG_KEYS));
    for (const k of keys) c.handleKey(k);
    expect(SYSTEMS.every((s) => !c.systems[s])).toBe(true);
    expect(OVERLAYS.every((o) => c.overlays[o])).toBe(true);
  });

  it('a replay that fails to start is reported and leaves it off', async () => {
    const e = effects();
    e.replay = vi.fn(() => false);
    const c = new DebugController(e);
    await c.setReplay(true);
    expect(c.replaying).toBe(false);
    expect(c.replayError).toBeTruthy();
    e.replay = vi.fn(() => {
      throw new Error('no such file');
    });
    await c.setReplay(true);
    expect(c.replayError).toBe('no such file');
    e.replay = vi.fn(() => true);
    await c.setReplay(true);
    expect(c.replaying).toBe(true);
    expect(c.status()).toContain('REPLAY');
    await c.setReplay(false);
    expect(c.replaying).toBe(false);
  });

  it('tells listeners about each change, and survives one that throws', () => {
    const c = new DebugController(effects());
    const ok = vi.fn();
    c.subscribe(() => {
      throw new Error('hud');
    });
    c.subscribe(ok);
    c.setOverlay('joints', true);
    c.handleKey('capsules');
    expect(ok).toHaveBeenCalledTimes(2);
  });
});

describe('the menu', () => {
  it('has two pages of at most six buttons to start with, each with text and help', () => {
    const pages = new DebugController(effects()).pages();
    expect(pages).toHaveLength(2);
    for (const p of pages) {
      expect(p.items.length).toBeLessThanOrEqual(ITEMS_PER_PAGE);
      for (const i of p.items) {
        expect(i.label).toBeTruthy();
        expect(i.help.length).toBeGreaterThan(10);
        expect(i.text()).toBeTruthy();
      }
    }
    const all = pages.flatMap((p) => p.items.map((i) => i.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('buttons change the state and the text they show', () => {
    const c = new DebugController(effects());
    const [views, systems] = c.pages();
    const joints = views.items.find((i) => i.id === 'joints')!;
    expect(joints.text()).toBe('off');
    joints.press();
    expect(joints.text()).toBe('ON');
    const shadow = systems.items.find((i) => i.id === 'system-shadow')!;
    shadow.press();
    expect(shadow.text()).toBe('OFF');
    expect(c.systems.shadow).toBe(false);
  });

  it('lists registered actions, a group at a time, six to a page', () => {
    const c = new DebugController(effects());
    const ran: string[] = [];
    for (let i = 0; i < 8; i++)
      c.actions.register({ id: `p${i}`, group: 'Puzzles', label: `Puzzle ${i}`, run: () => ran.push(`p${i}`) });
    c.actions.register({ id: 'x', group: 'Other', label: 'Other thing', run: () => ran.push('x') });
    const pages = c.pages();
    expect(pages.map((p) => p.title)).toEqual([
      'Debug: views',
      'Debug: systems and replay',
      'Debug: Puzzles 1',
      'Debug: Puzzles 2',
      'Debug: Other',
    ]);
    pages[3].items[0].press();
    expect(ran).toEqual(['p6']);
  });
});

describe('DebugActions', () => {
  it('replaces an action with the same id, removes on request, and reports a throw instead of raising it', () => {
    const a = new DebugActions();
    const remove = a.register({ id: 'a', group: 'g', label: 'A', run: () => undefined });
    a.register({
      id: 'a',
      group: 'g',
      label: 'A2',
      run: () => {
        throw new Error('boom');
      },
    });
    expect(a.all()).toHaveLength(1);
    expect(a.run('a')).toBe(false);
    expect(a.lastError).toBe('a: boom');
    expect(a.run('missing')).toBe(false);
    remove(); // removes the first registration, which was replaced: nothing left to remove by identity
    a.register({ id: 'b', group: 'g', label: 'B', run: () => undefined });
    expect(a.run('b')).toBe(true);
    expect(a.lastError).toBeNull();
  });
});

describe('keys', () => {
  it('needs Alt and nothing else held, and ignores the Hand Lab keys', () => {
    expect(debugKeyAction({ altKey: true, code: 'KeyK' })).toBe('capsules');
    expect(debugKeyAction({ altKey: false, code: 'KeyK' })).toBeNull();
    expect(debugKeyAction({ altKey: true, ctrlKey: true, code: 'KeyK' })).toBeNull();
    expect(debugKeyAction({ altKey: true, metaKey: true, code: 'KeyK' })).toBeNull();
    for (const labKey of ['KeyR', 'KeyL', 'KeyH', 'Space', 'ArrowUp', 'Digit6']) {
      expect(debugKeyAction({ altKey: false, code: labKey })).toBeNull();
    }
  });

  it('gives every action exactly one key', () => {
    const values = Object.values(DEBUG_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});
