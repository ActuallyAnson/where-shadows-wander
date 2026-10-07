import { describe, expect, it } from 'vitest';
import {
  HandsState,
  HandsStatus,
  LOST_MESSAGE,
  MAX_STEP_S,
  MESSAGE_AFTER_LOST_S,
  UNAVAILABLE_AFTER_S,
  UNAVAILABLE_MESSAGE,
} from './hands-status';

const DT = 1 / 72;

/** Runs `seconds` of frames with the given inputs. */
function run(s: HandsStatus, seconds: number, tracked: boolean, sources: number): void {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) s.update(DT, tracked, sources);
}

function started(): HandsStatus {
  const s = new HandsStatus();
  s.start();
  return s;
}

describe('HandsStatus', () => {
  it('reports nothing before a session starts and after it ends', () => {
    const s = new HandsStatus();
    run(s, 20, false, 0);
    expect(s.showMessage).toBe(false);
    expect(s.message).toBe('');
    s.start();
    run(s, 20, false, 0);
    expect(s.showMessage).toBe(true);
    s.stop();
    expect(s.showMessage).toBe(false);
    expect(s.state).toBe(HandsState.Tracking);
    run(s, 20, false, 0);
    expect(s.showMessage).toBe(false);
  });

  it('is tracking, with no message, while a hand is tracked', () => {
    const s = started();
    run(s, 10, true, 2);
    expect(s.state).toBe(HandsState.Tracking);
    expect(s.showMessage).toBe(false);
    expect(s.message).toBe('');
  });

  it('is lost, without a message yet, for a short dropout', () => {
    const s = started();
    run(s, 5, true, 2);
    run(s, MESSAGE_AFTER_LOST_S - 0.3, false, 2);
    expect(s.state).toBe(HandsState.Lost);
    expect(s.showMessage).toBe(false);
  });

  it('shows the lost message once the dropout is long, and clears it as soon as a hand is back', () => {
    const s = started();
    run(s, 5, true, 2);
    run(s, MESSAGE_AFTER_LOST_S + 0.3, false, 2);
    expect(s.state).toBe(HandsState.Lost);
    expect(s.showMessage).toBe(true);
    expect(s.message).toBe(LOST_MESSAGE);
    run(s, 0.1, true, 2);
    expect(s.state).toBe(HandsState.Tracking);
    expect(s.showMessage).toBe(false);
  });

  it('counts a tracked frame as the end of a dropout', () => {
    const s = started();
    for (let i = 0; i < 10; i++) {
      run(s, MESSAGE_AFTER_LOST_S - 0.5, false, 2);
      run(s, 0.05, true, 2);
    }
    expect(s.showMessage).toBe(false);
  });

  it('becomes unavailable when the session has no hand source for a while (controllers held, hand tracking off)', () => {
    const s = started();
    run(s, UNAVAILABLE_AFTER_S - 0.5, false, 0);
    expect(s.state).toBe(HandsState.Lost);
    run(s, 1, false, 0);
    expect(s.state).toBe(HandsState.Unavailable);
    expect(s.showMessage).toBe(true);
    expect(s.message).toBe(UNAVAILABLE_MESSAGE);
  });

  it('is not unavailable while hand sources exist, however long the hands are out of view', () => {
    const s = started();
    run(s, 60, false, 2);
    expect(s.state).toBe(HandsState.Lost);
    expect(s.message).toBe(LOST_MESSAGE);
  });

  it('restarts the no-source count when a hand source appears', () => {
    const s = started();
    run(s, UNAVAILABLE_AFTER_S - 0.5, false, 0);
    run(s, 0.1, false, 1);
    run(s, UNAVAILABLE_AFTER_S - 0.5, false, 0);
    expect(s.state).toBe(HandsState.Lost);
  });

  it('recovers from unavailable when a hand is tracked', () => {
    const s = started();
    run(s, 10, false, 0);
    expect(s.state).toBe(HandsState.Unavailable);
    run(s, 0.1, true, 1);
    expect(s.state).toBe(HandsState.Tracking);
    expect(s.showMessage).toBe(false);
  });

  it('starts a new session from a clean slate', () => {
    const s = started();
    run(s, 10, false, 0);
    s.stop();
    s.start();
    expect(s.state).toBe(HandsState.Tracking);
    expect(s.showMessage).toBe(false);
    expect(s.lostFor).toBe(0);
    expect(s.noSourceFor).toBe(0);
  });

  it('bumps `version` only when the state or the message changes', () => {
    const s = started();
    const v0 = s.version;
    run(s, 5, true, 2);
    expect(s.version).toBe(v0);
    run(s, MESSAGE_AFTER_LOST_S + 1, false, 2); // tracking -> lost -> message
    expect(s.version).toBe(v0 + 2);
    run(s, 10, false, 2);
    expect(s.version).toBe(v0 + 2);
    run(s, 0.1, true, 2);
    expect(s.version).toBe(v0 + 3);
  });

  it('does not count one huge frame step (the first frame after the headset was off) as a long dropout', () => {
    const s = started();
    s.update(DT, true, 2);
    s.update(30, false, 0);
    expect(s.state).toBe(HandsState.Lost);
    expect(s.showMessage).toBe(false);
    expect(s.lostFor).toBeCloseTo(MAX_STEP_S, 12);
    expect(s.noSourceFor).toBeCloseTo(MAX_STEP_S, 12);
  });

  it('keeps every message short enough for the panel', () => {
    for (const m of [LOST_MESSAGE, UNAVAILABLE_MESSAGE]) {
      const [title, detail] = m.split('\n');
      expect(title.length).toBeLessThanOrEqual(22);
      expect(detail.length).toBeLessThanOrEqual(30);
    }
  });
});
