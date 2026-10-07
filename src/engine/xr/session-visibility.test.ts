import { describe, expect, it } from 'vitest';
import { fakeSession } from './fake-xr';
import { pausesOn, SessionVisibility, type SessionVisibilityState } from './session-visibility';

describe('pausesOn', () => {
  it('pauses on everything but visible', () => {
    expect(pausesOn('visible')).toBe(false);
    expect(pausesOn('visible-blurred')).toBe(true);
    expect(pausesOn('hidden')).toBe(true);
  });
});

describe('SessionVisibility', () => {
  it('is visible and unpaused with no session', () => {
    const v = new SessionVisibility();
    expect(v.state).toBe('visible');
    expect(v.paused).toBe(false);
  });

  it('follows the session through blurred, hidden and back', () => {
    const session = fakeSession();
    const v = new SessionVisibility();
    v.attach(session);
    expect(v.paused).toBe(false);
    session.setVisibility('visible-blurred');
    expect([v.state, v.paused]).toEqual(['visible-blurred', true]);
    session.setVisibility('hidden');
    expect([v.state, v.paused]).toEqual(['hidden', true]);
    session.setVisibility('visible');
    expect([v.state, v.paused]).toEqual(['visible', false]);
  });

  it('reads the state the session already has when attached', () => {
    const v = new SessionVisibility();
    v.attach(fakeSession({ visibilityState: 'visible-blurred' }));
    expect(v.paused).toBe(true);
  });

  it('treats a session that reports no state as visible', () => {
    const session = fakeSession();
    (session as unknown as { visibilityState?: string }).visibilityState = undefined;
    const v = new SessionVisibility();
    v.attach(session);
    expect(v.paused).toBe(false);
  });

  it('tells subscribers once per change, and not at all when nothing changed', () => {
    const session = fakeSession();
    const v = new SessionVisibility();
    const seen: [SessionVisibilityState, boolean][] = [];
    v.subscribe((state, paused) => seen.push([state, paused]));
    v.attach(session);
    expect(seen).toEqual([]);
    session.setVisibility('visible-blurred');
    session.setVisibility('visible-blurred');
    session.setVisibility('hidden');
    expect(seen).toEqual([
      ['visible-blurred', true],
      ['hidden', true],
    ]);
  });

  it('stops telling a subscriber that unsubscribed', () => {
    const session = fakeSession();
    const v = new SessionVisibility();
    let calls = 0;
    const off = v.subscribe(() => calls++);
    v.attach(session);
    session.setVisibility('hidden');
    off();
    session.setVisibility('visible');
    expect(calls).toBe(1);
  });

  it('unpauses and lets go of the session on detach, and again for a new session', () => {
    const first = fakeSession();
    const second = fakeSession();
    const v = new SessionVisibility();
    v.attach(first);
    first.setVisibility('hidden');
    expect(v.paused).toBe(true);
    v.detach();
    expect(v.paused).toBe(false);
    expect(first.visibilityListeners()).toBe(0);
    first.setVisibility('visible-blurred');
    expect(v.paused).toBe(false);
    v.attach(second);
    expect(second.visibilityListeners()).toBe(1);
    second.setVisibility('visible-blurred');
    expect(v.paused).toBe(true);
  });

  it('attaching a second session drops the first', () => {
    const first = fakeSession();
    const second = fakeSession();
    const v = new SessionVisibility();
    v.attach(first);
    v.attach(second);
    expect(first.visibilityListeners()).toBe(0);
    first.setVisibility('hidden');
    expect(v.paused).toBe(false);
  });

  it('bumps version on each change', () => {
    const session = fakeSession();
    const v = new SessionVisibility();
    v.attach(session);
    const v0 = v.version;
    session.setVisibility('hidden');
    session.setVisibility('visible');
    expect(v.version).toBe(v0 + 2);
  });
});
