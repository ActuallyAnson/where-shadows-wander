// The session flow: the transition table itself, pausing and resuming from the engine's signals, the
// actions the app must run, and a whole night driven through the flow.
import { describe, expect, it } from 'vitest';
import { GestureEventQueue } from '../engine/hands/gesture-events';
import { Touch } from '../engine/sim/solver';
import {
  FLOW_STATES,
  FLOW_TRANSITIONS,
  GameFlow,
  type FlowAction,
  type FlowEvent,
  type FlowSignals,
  type FlowState,
} from './flow';
import { GameEventQueue } from './game-events';
import { Headless } from './headless';
import { LEDGE_TOP } from './puzzles/bedroom';
import { TABLE_RISE } from './puzzles/n2-ledge';
import { createNightLevels } from './puzzles/index';

/**
 * The first stage of each level: the five puzzles these tests of the game's mechanics play (resume,
 * restart, the outro, saves). The levels' later stages are played in src/game/puzzles/stages.test.ts.
 */
const createNight = () => createNightLevels().map((stages) => stages[0]);

const STATES = Object.keys(FLOW_STATES) as FlowState[];

function host() {
  const actions: FlowAction[] = [];
  return { actions, run: (a: FlowAction) => void actions.push(a) };
}

function quiet(): FlowSignals {
  return { sessionPaused: false, gestures: null, gameEvents: null };
}

/** A flow walked to `state` by events (and the actions on the way). */
function flowAt(state: FlowState) {
  const h = host();
  const f = new GameFlow(h);
  const path: Record<FlowState, FlowEvent[]> = {
    title: [],
    tutorial: ['start'],
    playing: ['start', 'lantern-lit'],
    paused: ['start', 'lantern-lit', 'pause'],
    solved: ['start', 'lantern-lit', 'puzzle-solved'],
    'night-complete': ['start', 'lantern-lit', 'puzzle-solved', 'night-complete'],
    end: ['start', 'lantern-lit', 'puzzle-solved', 'night-complete', 'ending-done'],
  };
  for (const e of path[state]) expect(f.send(e)).toBe(true);
  expect(f.state).toBe(state);
  h.actions.length = 0;
  return { f, h };
}

describe('the transition table', () => {
  it('reaches every state from the title, and every state can leave', () => {
    const seen = new Set<FlowState>(['title']);
    const queue: FlowState[] = ['title'];
    while (queue.length > 0) {
      const s = queue.shift()!;
      for (const t of Object.values(FLOW_TRANSITIONS[s])) {
        if (t.to !== 'back' && !seen.has(t.to)) {
          seen.add(t.to);
          queue.push(t.to);
        }
      }
    }
    expect([...seen].sort()).toEqual([...STATES].sort());
    for (const s of STATES) expect(Object.keys(FLOW_TRANSITIONS[s]).length).toBeGreaterThan(0);
  });

  it('runs the world only while playing, solved or ending', () => {
    expect(STATES.filter((s) => FLOW_STATES[s].simRuns).sort()).toEqual(['night-complete', 'playing', 'solved']);
  });

  it('goes where the table says for every listed event', () => {
    for (const s of STATES) {
      for (const [event, t] of Object.entries(FLOW_TRANSITIONS[s])) {
        const { f } = flowAt(s);
        f.send(event as FlowEvent);
        if (t!.to !== 'back') expect(f.state, `${s} --${event}->`).toBe(t!.to);
      }
    }
  });

  it('ignores an event its state does not list', () => {
    const { f } = flowAt('title');
    const v = f.version;
    expect(f.send('pause')).toBe(false);
    expect(f.send('puzzle-solved')).toBe(false);
    expect(f.state).toBe('title');
    expect(f.version).toBe(v);
  });
});

describe('pause and resume', () => {
  it('returns to the state the pause interrupted', () => {
    for (const s of ['playing', 'solved', 'night-complete', 'tutorial'] as const) {
      const { f } = flowAt(s);
      expect(f.send('pause')).toBe(true);
      expect(f.state).toBe('paused');
      expect(f.simRuns).toBe(false);
      expect(f.screen).toBe('pause');
      f.send('resume');
      expect(f.state).toBe(s);
    }
  });

  it('resumes on a relight pinch (GDD), and a relight after a pause in the tutorial starts the night', () => {
    const a = flowAt('playing').f;
    a.send('pause');
    a.send('lantern-lit');
    expect(a.state).toBe('playing');
    const b = flowAt('tutorial').f;
    b.send('pause');
    b.send('lantern-lit');
    expect(b.state).toBe('playing');
  });

  it('pauses on the cover-the-flame gesture and on the session pausing, once per pause', () => {
    const { f } = flowAt('playing');
    const gestures = new GestureEventQueue();
    gestures.push('cover-flame', 'right', 0, 0, 0, 0, 0.5);
    f.update({ ...quiet(), gestures });
    expect(f.state).toBe('paused');
    f.send('resume');
    // The headset comes off: one pause, and coming back stays paused until a relight or Resume.
    f.update({ ...quiet(), sessionPaused: true });
    expect(f.state).toBe('paused');
    const v = f.version;
    f.update({ ...quiet(), sessionPaused: true });
    f.update(quiet());
    expect(f.state).toBe('paused');
    expect(f.version).toBe(v);
    const relight = new GestureEventQueue();
    relight.push('pinch-release', 'left', 1, 0, 0, 0, 0.2);
    f.update({ ...quiet(), gestures: relight });
    expect(f.state).toBe('playing');
  });

  it('starts the puzzle again from the pause screen', () => {
    const { f, h } = flowAt('playing');
    f.send('pause');
    f.send('restart');
    expect(f.state).toBe('playing');
    expect(h.actions).toEqual(['restart-puzzle']);
  });
});

describe('actions', () => {
  it('plays the ending when the night completes, and begins a new night from the end screen', () => {
    const { f, h } = flowAt('solved');
    f.send('night-complete');
    expect(h.actions).toEqual(['play-ending']);
    f.send('ending-done');
    expect(f.screen).toBe('end');
    f.send('again');
    expect(f.state).toBe('title');
    expect(h.actions).toEqual(['play-ending', 'new-night']);
  });

  it('replays a solved puzzle from the solved screen', () => {
    const { f, h } = flowAt('solved');
    f.send('replay');
    expect(f.state).toBe('playing');
    expect(h.actions).toEqual(['restart-puzzle']);
  });
});

describe('driven by the game', () => {
  it('maps the game events: solved, the next puzzle, and the night complete', () => {
    const { f } = flowAt('playing');
    const ev = new GameEventQueue(8);
    ev.push('puzzle-solved', 'bridge', 1, 0);
    f.update({ ...quiet(), gameEvents: ev });
    expect(f.state).toBe('solved');
    expect(f.screen).toBe('solved');
    ev.clear();
    ev.push('puzzle-start', 'n2-drip', 2, 1);
    f.update({ ...quiet(), gameEvents: ev });
    expect(f.state).toBe('playing');
  });

  it('plays the whole night through the flow, the world held until the lantern is lit', () => {
    const h = host();
    const flow = new GameFlow(h);
    const play = new Headless({ puzzles: createNight() });
    const g = play.game;
    const tx = () => g.store.x[g.traveller.slot(g)];
    const tick = () => {
      // Read the last frame's events, then hold or run the next one as the flow says.
      flow.update({ sessionPaused: false, gestures: null, gameEvents: g.events });
      play.paused = !flow.simRuns;
    };
    play.run(1, tick);
    expect(flow.state).toBe('title');
    expect(g.time).toBe(0);
    flow.send('start');
    play.run(1, tick);
    expect(flow.state).toBe('tutorial');
    expect(g.time).toBe(0);
    flow.send('lantern-lit');
    const bridge = LEDGE_TOP - 0.01;
    play.pose('right', 'flat', 0, bridge);
    expect(play.runUntil(() => flow.state === 'solved', 30, tick)).toBe(true);
    expect(play.runUntil(() => flow.state === 'playing', 5, tick)).toBe(true);
    play.hide('right');
    // The rest of the night with the second solutions where they are quick to script.
    // 2: a flat hand in the gap, lifted to the bedside table with the traveller on it.
    let y = bridge;
    play.pose('right', 'flat', 0, y);
    expect(
      play.runUntil(
        () => g.puzzle.id === 'n3-drip' && flow.state === 'playing',
        50,
        () => {
          if (g.traveller.standingOn(g) === Touch.Hand && y < LEDGE_TOP + TABLE_RISE)
            play.move('right', 0, (y += 0.002));
          tick();
        },
      ),
    ).toBe(true);
    play.hide('right');
    // 3: a roof over the drips.
    play.pose('left', 'flat', 0.05, 0.12);
    expect(play.runUntil(() => g.puzzle.id === 'n4-fan' && flow.state === 'playing', 50, tick)).toBe(true);
    play.hide('left');
    // 4: a windbreak walked along with the traveller.
    expect(
      play.runUntil(
        () => g.puzzle.id === 'n5-castle' && flow.state === 'playing',
        50,
        () => {
          play.pose('right', 'spread', tx() + 0.15, LEDGE_TOP + 0.19);
          tick();
        },
      ),
    ).toBe(true);
    play.hide('right');
    // 5: the bridge over the moat first, then the counterweight.
    play.pose('left', 'flat', 0.01, bridge);
    expect(play.runUntil(() => tx() > 0.25, 30, tick)).toBe(true);
    play.hide('left').pose('right', 'fist', -0.3, 0.07);
    expect(play.runUntil(() => flow.state === 'night-complete', 50, tick)).toBe(true);
    expect(h.actions).toEqual(['play-ending']);
    flow.send('ending-done');
    expect(flow.state).toBe('end');
    expect(flow.simRuns).toBe(false);
  });
});
