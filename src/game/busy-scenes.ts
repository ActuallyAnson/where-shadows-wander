// The night's busiest scenes as one-frame functions, for the frame-time bench (game.perf.ts) and
// the CI budget test (game.budget.test.ts). Each keeps its puzzle going without ending it, so no
// puzzle load lands inside a timed frame. Test and tooling code: it allocates while it sets up.
import { createHandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import type { Shape } from '../engine/hands/shapes';
import { shapeShadow } from '../engine/sim/shadow-shapes';
import { Game, type GameInput } from './game';
import { createNight } from './puzzles/index';
import { newSave } from './save-state';

export type BusySceneName = 'drip' | 'fan' | 'castle';

interface Pose {
  shape: Shape;
  x: number;
  y: number;
}

const SCENES: Record<BusySceneName, { puzzle: number; left: Pose; right: Pose }> = {
  // A cup sweeping the far half of the drips and a roof off to the side: the drips keep falling on
  // the path, so the traveller waits.
  drip: { puzzle: 2, left: { shape: 'cup', x: 0.12, y: 0 }, right: { shape: 'flat', x: 0.5, y: 0.15 } },
  // A windbreak and an anchor both behind the traveller: the wind keeps it from the goal.
  fan: { puzzle: 3, left: { shape: 'spread', x: -0.5, y: -0.07 }, right: { shape: 'fist', x: -0.7, y: 0.0 } },
  // A fist swaying just above the counterweight (never resting on it) and a flat hand off the moat.
  castle: { puzzle: 4, left: { shape: 'fist', x: -0.3, y: 0.2 }, right: { shape: 'flat', x: 0.5, y: 0.2 } },
};

/** A function that plays one display frame (72 Hz) of the named scene each time it is called. */
export function busyScene(name: BusySceneName): () => void {
  const scene = SCENES[name];
  const save = newSave();
  save.puzzle = scene.puzzle;
  const game = new Game({ puzzles: createNight(), save });
  const l = createHandShadow('left'),
    r = createHandShadow('right');
  const q = new ShapeEventQueue();
  const input: GameInput = { dt: 1 / 72, paused: false, left: l, right: r, shapeEvents: q };
  let f = 0;
  return () => {
    q.clear();
    if (f === 1) {
      q.push('commit', 'left', scene.left.shape, 0, 0.5, 0.4);
      q.push('commit', 'right', scene.right.shape, 0, 0.5, 0.4);
    }
    const sway = Math.sin(f * 0.01) * 0.05;
    shapeShadow(l, scene.left.shape, scene.left.x + sway, scene.left.y);
    shapeShadow(r, scene.right.shape, scene.right.x - sway, scene.right.y);
    game.frame(input);
    f++;
  };
}
