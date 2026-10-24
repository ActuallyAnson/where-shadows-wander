import { describe, expect, it } from 'vitest';
import type { Handedness } from '../engine/hands/hand';
import { createHandShadow } from '../engine/hands/hand-shadow';
import type { ShapeClassifier } from '../engine/hands/shape-classifier';
import type { Shape } from '../engine/hands/shapes';
import { DEFAULT_CAPACITIES, Flag, Kind } from '../engine/sim/entity-kinds';
import { EntityStore } from '../engine/sim/entity-store';
import { RIGHT, Solver } from '../engine/sim/solver';
import { type GhostTargetController, TUTORIAL_CONFIG, type TutorialAudio, TutorialFlow } from './tutorial-flow';

class MockGhostTarget implements GhostTargetController {
  active = false;
  x = 0;
  y = -0.15;
  triggered = false;
  matchedHand: Handedness | null = null;
  setTarget(_id: string, x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.active = true;
  }
}

class MockAudio implements TutorialAudio {
  activatedCalls = 0;
  solvedCalls = 0;
  bridgeActivated(): void {
    this.activatedCalls++;
  }
  puzzleSolved(): void {
    this.solvedCalls++;
  }
}

function createMockShapes(): Record<Handedness, ShapeClassifier> {
  return {
    left: { state: { committed: null as Shape | null } } as unknown as ShapeClassifier,
    right: { state: { committed: null as Shape | null } } as unknown as ShapeClassifier,
  };
}

describe('TutorialFlow', () => {
  function setup() {
    const store = new EntityStore(DEFAULT_CAPACITIES);
    const solver = new Solver(store.capacity);
    const ghostTarget = new MockGhostTarget();
    const audio = new MockAudio();
    const tutorial = new TutorialFlow(store, solver, ghostTarget, audio);
    const shadows = {
      left: createHandShadow('left'),
      right: createHandShadow('right'),
    };
    const shapes = createMockShapes();

    return { store, solver, ghostTarget, audio, tutorial, shadows, shapes };
  }

  it('starts in IDLE and spawns Traveller upon start()', () => {
    const { tutorial, store, ghostTarget } = setup();

    expect(tutorial.state).toBe('IDLE');
    expect(tutorial.travellerX).toBe(0);
    expect(ghostTarget.active).toBe(false);

    tutorial.start();

    expect(tutorial.state).toBe('WALK_TO_GAP');
    expect(tutorial.travellerX).toBeCloseTo(TUTORIAL_CONFIG.SPAWN_X);
    expect(tutorial.travellerY).toBeCloseTo(TUTORIAL_CONFIG.SPAWN_Y);
    expect(ghostTarget.active).toBe(false);

    const s = store.slotOf(tutorial.handle);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(store.kind[s]).toBe(Kind.Traveller);
  });

  it('walks to the gap and pauses in WAIT_AT_GAP with ghost hint visible', () => {
    const { tutorial, store, ghostTarget, shadows, shapes } = setup();
    tutorial.start();

    const s = store.slotOf(tutorial.handle);

    // Initial step: walking forward
    tutorial.update(0.016, shadows, shapes);
    expect(store.vx[s]).toBeCloseTo(TUTORIAL_CONFIG.WALK_SPEED);
    expect(tutorial.state).toBe('WALK_TO_GAP');

    // Move Traveller forward near the gap
    store.x[s] = -0.21;
    tutorial.update(0.016, shadows, shapes);

    expect(tutorial.state).toBe('WAIT_AT_GAP');
    expect(store.vx[s]).toBe(0);
    expect(store.flags[s] & Flag.WaitPose).toBeTruthy();
    expect(ghostTarget.active).toBe(true);
    expect(ghostTarget.x).toBeCloseTo(TUTORIAL_CONFIG.BRIDGE_TARGET_X);
    expect(ghostTarget.y).toBeCloseTo(TUTORIAL_CONFIG.BRIDGE_TARGET_Y);
  });

  it('activates hand bridge when player places flat hand over gap', () => {
    const { tutorial, store, solver, audio, shadows, shapes } = setup();
    tutorial.start();

    const s = store.slotOf(tutorial.handle);
    store.x[s] = -0.22;
    tutorial.update(0.016, shadows, shapes);
    expect(tutorial.state).toBe('WAIT_AT_GAP');

    // Position right hand shadow directly over the gap target
    shadows.right.active = true;
    shadows.right.onStage = true;
    shadows.right.bounds.set([-0.1, -0.25, 0.1, -0.05]); // centroid at (0.0, -0.15)
    shapes.right.state.committed = 'flat';

    tutorial.update(0.016, shadows, shapes);

    expect(tutorial.state).toBe('CROSSING_BRIDGE');
    expect(tutorial.isBridgeActive).toBe(true);
    expect(solver.hands[RIGHT].mask).toBe(1 << Kind.Traveller);
    expect(store.vx[s]).toBeCloseTo(TUTORIAL_CONFIG.WALK_SPEED);
    expect(store.flags[s] & Flag.WaitPose).toBe(0); // resumed walking posture
    expect(audio.activatedCalls).toBe(1);
  });

  it('clears hand collider mask if player breaks flat hand during crossing', () => {
    const { tutorial, store, solver, shadows, shapes } = setup();
    tutorial.start();

    const s = store.slotOf(tutorial.handle);
    store.x[s] = -0.22;
    tutorial.update(0.016, shadows, shapes);

    // Bridge active
    shadows.right.active = true;
    shadows.right.onStage = true;
    shadows.right.bounds.set([-0.1, -0.25, 0.1, -0.05]);
    shapes.right.state.committed = 'flat';
    tutorial.update(0.016, shadows, shapes);
    expect(tutorial.isBridgeActive).toBe(true);

    // Break flat hand shape (e.g. none)
    shapes.right.state.committed = null;
    tutorial.update(0.016, shadows, shapes);

    expect(tutorial.isBridgeActive).toBe(false);
    expect(solver.hands[RIGHT].mask).toBe(0);
  });

  it('reaches goal ledge, halts, triggers hop and celebration chime', () => {
    const { tutorial, store, ghostTarget, solver, audio, shadows, shapes } = setup();
    tutorial.start();

    const s = store.slotOf(tutorial.handle);
    store.x[s] = -0.22;
    tutorial.update(0.016, shadows, shapes);

    // Establish bridge
    shadows.right.active = true;
    shadows.right.onStage = true;
    shadows.right.bounds.set([-0.1, -0.25, 0.1, -0.05]);
    shapes.right.state.committed = 'flat';
    tutorial.update(0.016, shadows, shapes);

    // Advance Traveller to goal threshold
    store.x[s] = TUTORIAL_CONFIG.GOAL_X + 0.01;
    tutorial.update(0.016, shadows, shapes);

    expect(tutorial.state).toBe('GOAL_REACHED');
    expect(store.vx[s]).toBe(0);
    expect(store.vy[s]).toBeCloseTo(TUTORIAL_CONFIG.HOP_VELOCITY_Y);
    expect(ghostTarget.active).toBe(false);
    expect(solver.hands[RIGHT].mask).toBe(0);
    expect(audio.solvedCalls).toBe(1);
  });

  it('recovers and respawns if Traveller falls off the stage', () => {
    const { tutorial, store, shadows, shapes } = setup();
    tutorial.start();

    const s = store.slotOf(tutorial.handle);
    store.x[s] = -0.1;
    store.y[s] = -1.2; // below stage drop limit

    tutorial.update(0.016, shadows, shapes);

    expect(tutorial.state).toBe('WALK_TO_GAP');
    expect(store.x[s]).toBeCloseTo(TUTORIAL_CONFIG.SPAWN_X);
    expect(store.y[s]).toBeCloseTo(TUTORIAL_CONFIG.SPAWN_Y);
    expect(store.vx[s]).toBe(0);
  });
});
