// The game's state at a glance, for debug panels and bug reports (Teammate B's src/debug draws it).
// fillSnapshot() copies into a reused struct each frame without building anything; describe()
// turns it into text on demand (it allocates; call it when the panel is open, not every frame).
// Plain TypeScript.

import { Kind, KIND_COUNT } from '../engine/sim/entity-kinds';
import { HAND_COUNT } from '../engine/sim/solver';
import { ROLE_NAMES } from './abilities';
import type { Game } from './game';
import type { PuzzlePhase } from './puzzle';
import type { TravellerState } from './traveller';

const KIND_NAMES = Object.keys(Kind);

export class DebugSnapshot {
  /** Fixed steps taken since the last resume or reset, and simulated seconds since the start. */
  steps = 0;
  time = 0;
  puzzleIndex = 0;
  puzzleId = '';
  phase: PuzzlePhase = 'playing';
  puzzleTime = 0;
  complete = false;
  travellerState: TravellerState = 'walk';
  travellerStateT = 0;
  travellerX = 0;
  travellerY = 0;
  stuckT = 0;
  hintVisible = false;
  /** Live entities per kind, indexed by Kind. */
  readonly counts = new Int32Array(KIND_COUNT);
  entities = 0;
  /** Creates refused because a kind was full (raise its capacity if this grows). */
  overflow = 0;
  /** Contacts this step, and those dropped because the list was full. */
  contacts = 0;
  contactsDropped = 0;
  /** Simulated time thrown away by the step cap (the sim couldn't keep up). */
  droppedS = 0;
  /** Game events dropped this frame (the queue was full). */
  eventsDropped = 0;
  /** Per hand (0 left, 1 right): role (index into ROLE_NAMES), shadow present, water, fireflies. */
  readonly roles = new Int8Array(HAND_COUNT);
  readonly handActive = new Uint8Array(HAND_COUNT);
  readonly water = new Int32Array(HAND_COUNT);
  readonly carried = new Int32Array(HAND_COUNT);
  /** Credit per solution of the current puzzle (see puzzle.solutions). */
  readonly credits = new Float64Array(8);
  solutionCount = 0;
}

/** Copies the game's state into `snap`. Builds nothing; safe to call every frame. */
export function fillSnapshot(game: Game, snap: DebugSnapshot): DebugSnapshot {
  const { store, solver, runner, traveller } = game;
  snap.steps = game.loop.steps;
  snap.time = game.time;
  snap.puzzleIndex = game.puzzleIndex;
  snap.puzzleId = game.puzzle.id;
  snap.phase = runner.phase;
  snap.puzzleTime = game.puzzleTime;
  snap.complete = game.complete;
  snap.travellerState = traveller.state;
  snap.travellerStateT = traveller.stateT;
  const t = traveller.slot(game);
  snap.travellerX = t < 0 ? NaN : store.x[t];
  snap.travellerY = t < 0 ? NaN : store.y[t];
  snap.stuckT = runner.stuckT;
  snap.hintVisible = runner.hintVisible;
  for (let k = 0; k < KIND_COUNT; k++) snap.counts[k] = store.countOf(k);
  snap.entities = store.count;
  snap.overflow = store.overflowCount;
  snap.contacts = solver.contactCount;
  snap.contactsDropped = solver.contactsDropped;
  snap.droppedS = game.loop.droppedS;
  snap.eventsDropped = game.events.dropped;
  for (let h = 0; h < HAND_COUNT; h++) {
    const a = game.abilities.hands[h];
    snap.roles[h] = a.role;
    snap.handActive[h] = a.active ? 1 : 0;
    snap.water[h] = a.water;
    snap.carried[h] = a.carried;
  }
  snap.solutionCount = game.puzzle.solutions.length;
  for (let i = 0; i < snap.credits.length; i++) snap.credits[i] = runner.credits[i];
  return snap;
}

/** The snapshot as lines of text (allocates: for a debug panel or a bug report, on demand). */
export function describe(snap: DebugSnapshot, game?: Game): string[] {
  const kinds = KIND_NAMES.map((n, k) => `${n.toLowerCase()} ${snap.counts[k]}`).join(', ');
  const hands = [0, 1]
    .map((h) => {
      const side = h === 0 ? 'L' : 'R';
      if (!snap.handActive[h]) return `${side} -`;
      const extra = snap.water[h] || snap.carried[h] ? ` (water ${snap.water[h]}, fireflies ${snap.carried[h]})` : '';
      return `${side} ${ROLE_NAMES[snap.roles[h]]}${extra}`;
    })
    .join('  ');
  const sols = game ? game.puzzle.solutions : [];
  const credit = sols.map((s, i) => `${s} ${snap.credits[i].toFixed(1)}`).join(', ');
  return [
    `puzzle ${snap.puzzleIndex + 1} ${snap.puzzleId} (${snap.phase}${snap.complete ? ', chapter complete' : ''}) ${snap.puzzleTime.toFixed(1)} s`,
    `traveller ${snap.travellerState} ${snap.travellerStateT.toFixed(1)} s at (${snap.travellerX.toFixed(2)}, ${snap.travellerY.toFixed(2)})` +
      (snap.stuckT > 0 ? `, stuck ${snap.stuckT.toFixed(1)} s` : '') +
      (snap.hintVisible ? ', hint shown' : ''),
    `hands ${hands}`,
    `entities ${snap.entities}: ${kinds}`,
    `credit ${credit || '-'}`,
    `sim ${snap.steps} steps, ${snap.time.toFixed(1)} s; contacts ${snap.contacts}` +
      (snap.overflow ? `; OVERFLOW ${snap.overflow}` : '') +
      (snap.contactsDropped ? `; contacts dropped ${snap.contactsDropped}` : '') +
      (snap.eventsDropped ? `; events dropped ${snap.eventsDropped}` : '') +
      (snap.droppedS > 0 ? `; time dropped ${snap.droppedS.toFixed(2)} s` : ''),
  ];
}
