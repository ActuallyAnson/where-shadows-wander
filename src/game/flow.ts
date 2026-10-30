// The flow of a session from the title to the end (GDD "Player journey", "First five minutes"): a
// small state machine whose states, events and transitions are plain data. The app reads `state`,
// `simRuns` and `screen` each frame, and Anson's screens in src/ui show what `screen` names. Plain
// TypeScript; `update` allocates nothing.
//
//   title           the title screen; the world is still
//   tutorial        the lantern waits on the tray: "pinch to light it"; the world is still
//   playing         the night's puzzles; the world runs
//   paused          the flame is covered or the headset is off; the world holds; a relight resumes
//   solved          a puzzle was just solved: the world runs its outro, the solved screen shows
//   night-complete  the last puzzle is solved: the ending plays; the world runs (the last scene stays)
//   end             the end screen; the world is still
//
// The pause itself comes from the engine, not from here: the cover-the-flame gesture
// (GestureDetector) and the session's visibility (SessionVisibility.paused). `update` reads those
// signals and the game's own events and turns them into flow events.

import type { GestureEvent } from '../engine/hands/gesture-events';
import type { GameEvent } from './game-events';

export type FlowState = 'title' | 'tutorial' | 'playing' | 'paused' | 'solved' | 'night-complete' | 'end';

export type FlowEvent =
  /** The title screen's Start. */
  | 'start'
  /** A pinch-release placed or relit the lantern. */
  | 'lantern-lit'
  /** The flame was covered, or the session was hidden or blurred. */
  | 'pause'
  /** The pause screen's Resume (a relight pinch resumes too, as `lantern-lit`). */
  | 'resume'
  /** The pause screen's "Begin this puzzle again". */
  | 'restart'
  /** The game solved a puzzle (GameEvent `puzzle-solved`). */
  | 'puzzle-solved'
  /** The next puzzle began after the outro (GameEvent `puzzle-start`), or the solved screen's Onward. */
  | 'next-puzzle'
  /** The solved screen's "Play it again". */
  | 'replay'
  /** The game finished the night (GameEvent `chapter-complete`). */
  | 'night-complete'
  /** The ending cutscene finished. */
  | 'ending-done'
  /** The end screen's "Begin again". */
  | 'again';

/** What the app must do on a transition, besides showing the new state's screen. */
export type FlowAction =
  /** game.restart(): the current puzzle from its start. */
  | 'restart-puzzle'
  /** A new save and game.goto(0): the night from the beginning. */
  | 'new-night'
  /** cutscenes.play(ENDING), the room cools and dims; send `ending-done` when it finishes. */
  | 'play-ending';

/** A transition: the state it goes to (`back`: the state the pause interrupted), and an action. */
export interface FlowTransition {
  readonly to: FlowState | 'back';
  readonly action?: FlowAction;
}

/** The screen each state shows (src/ui/menu-panel's ids, plus the title and the tutorial prompt). */
export type FlowScreen = 'title' | 'tutorial' | 'pause' | 'solved' | 'end';

export interface FlowStateInfo {
  /** Whether the world runs: the app passes `paused: !simRuns` to game.frame. */
  readonly simRuns: boolean;
  /** The screen to show, or null for none. */
  readonly screen: FlowScreen | null;
}

export const FLOW_STATES: Readonly<Record<FlowState, FlowStateInfo>> = {
  title: { simRuns: false, screen: 'title' },
  tutorial: { simRuns: false, screen: 'tutorial' },
  playing: { simRuns: true, screen: null },
  paused: { simRuns: false, screen: 'pause' },
  solved: { simRuns: true, screen: 'solved' },
  'night-complete': { simRuns: true, screen: null },
  end: { simRuns: false, screen: 'end' },
};

/** Every transition. An event a state does not list is ignored in that state. */
export const FLOW_TRANSITIONS: Readonly<Record<FlowState, Readonly<Partial<Record<FlowEvent, FlowTransition>>>>> = {
  title: { start: { to: 'tutorial' } },
  tutorial: {
    'lantern-lit': { to: 'playing' },
    // The headset off before the lantern is lit; covering an unlit lantern does nothing.
    pause: { to: 'paused' },
  },
  playing: {
    pause: { to: 'paused' },
    'puzzle-solved': { to: 'solved' },
    'night-complete': { to: 'night-complete', action: 'play-ending' },
  },
  paused: {
    resume: { to: 'back' },
    // GDD: "Resume: relight with a pinch."
    'lantern-lit': { to: 'back' },
    restart: { to: 'playing', action: 'restart-puzzle' },
  },
  solved: {
    'next-puzzle': { to: 'playing' },
    replay: { to: 'playing', action: 'restart-puzzle' },
    'night-complete': { to: 'night-complete', action: 'play-ending' },
    pause: { to: 'paused' },
  },
  'night-complete': {
    'ending-done': { to: 'end' },
    pause: { to: 'paused' },
  },
  end: { again: { to: 'title', action: 'new-night' } },
};

/** What the app does for a FlowAction. */
export interface FlowHost {
  run(action: FlowAction): void;
}

/** The engine's signals for one frame, and the game's events from it. */
export interface FlowSignals {
  /** SessionVisibility.paused: the headset is off, the system menu is open, or the page is hidden. */
  sessionPaused: boolean;
  /** This frame's lantern gestures (GestureDetector.events), or null. */
  gestures: { readonly count: number; at(i: number): Readonly<GestureEvent> } | null;
  /** This frame's game events (game.events, read after game.frame), or null. */
  gameEvents: { readonly count: number; at(i: number): Readonly<GameEvent> } | null;
}

export class GameFlow {
  state: FlowState = 'title';
  /** Where a resume goes: the state the pause interrupted. */
  resumeTo: FlowState = 'playing';
  /** Bumps on every change of state, so a view redraws only then. */
  version = 0;
  private sessionWasPaused = false;

  constructor(private readonly host: FlowHost | null = null) {}

  get simRuns(): boolean {
    return FLOW_STATES[this.state].simRuns;
  }

  get screen(): FlowScreen | null {
    return FLOW_STATES[this.state].screen;
  }

  /** Applies an event. @returns whether it changed the state (false: ignored in this state). */
  send(event: FlowEvent): boolean {
    const t = FLOW_TRANSITIONS[this.state][event];
    if (!t) return false;
    let to = t.to === 'back' ? this.resumeTo : t.to;
    // A pause that began before the lantern was lit (the headset off in the tutorial): the pinch
    // that resumes also lights it, so the night begins.
    if (event === 'lantern-lit' && to === 'tutorial') to = 'playing';
    if (to === 'paused') this.resumeTo = this.state;
    this.state = to;
    this.version++;
    if (t.action) this.host?.run(t.action);
    return true;
  }

  /**
   * Once a frame, after game.frame(): turns the engine's signals and the game's events into flow
   * events. The session pausing counts once, when it starts; coming back stays paused until the
   * player relights the lantern or presses Resume.
   */
  update(signals: FlowSignals): void {
    const sp = signals.sessionPaused;
    if (sp && !this.sessionWasPaused) this.send('pause');
    this.sessionWasPaused = sp;
    const g = signals.gestures;
    if (g) {
      for (let i = 0; i < g.count; i++) this.send(g.at(i).type === 'cover-flame' ? 'pause' : 'lantern-lit');
    }
    const e = signals.gameEvents;
    if (e) {
      for (let i = 0; i < e.count; i++) {
        const type = e.at(i).type;
        if (type === 'puzzle-solved') this.send('puzzle-solved');
        else if (type === 'puzzle-start') this.send('next-puzzle');
        else if (type === 'chapter-complete') this.send('night-complete');
      }
    }
  }
}
