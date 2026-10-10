// Times whole game frames (`npm run perf`) in the chapter's busiest scenes. The sim and gameplay
// together get 2.0 ms a frame on the headset (docs/ARCHITECTURE.md), about 0.5 ms on a desktop.
import { bench, describe } from 'vitest';
import chapter1 from '../../public/scenes/chapter-1.iwsdk.scene.json';
import { createHandShadow } from '../engine/hands/hand-shadow';
import { ShapeEventQueue } from '../engine/hands/shape-events';
import { cupShadow, flatShadow } from '../engine/sim/shadow-shapes';
import { Game, type GameInput } from './game';
import { createChapter1 } from './puzzles/index';
import { newSave } from './save-state';

function scene(puzzle: number, left: 'cup' | 'flat' | null, right: 'cup' | 'flat' | null) {
  const save = newSave();
  save.puzzle = puzzle;
  const game = new Game({ chapter: chapter1, puzzles: createChapter1(), save });
  const l = createHandShadow('left'),
    r = createHandShadow('right');
  const q = new ShapeEventQueue();
  const input: GameInput = { dt: 1 / 72, paused: false, left: l, right: r, shapeEvents: q };
  let f = 0;
  return () => {
    q.clear();
    if (f === 1) {
      if (left) q.push('commit', 'left', left, 0, 0.5, 0.4);
      if (right) q.push('commit', 'right', right, 0, 0.5, 0.4);
    }
    const sway = Math.sin(f * 0.01) * 0.05;
    if (left === 'cup') cupShadow(l, 0.12 + sway, -0.05);
    else flatShadow(l, -0.4 + sway, 0.1);
    if (right === 'cup') cupShadow(r, -0.45 + sway, 0.13);
    else flatShadow(r, 0.4 + sway, 0.1);
    game.frame(input);
    f++;
  };
}

describe('game frame', () => {
  const rain = scene(1, 'cup', 'flat');
  const crows = scene(4, 'flat', 'cup');
  bench('rain puzzle: shower, a cup, a roof', rain);
  bench('crows puzzle: crows, fireflies in a cup', crows);
});
