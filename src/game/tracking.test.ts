// What the game does when hand tracking drops out (the engine shows "Show me your hands" after 3 s,
// src/engine/xr/hands-status.ts): a lost hand's shadow holds still for HOLD_LOST_HAND_S, so a short
// dropout leaves the bridge under the traveller; with no hand tracked for longer, the world holds
// still until a hand returns.
import { describe, expect, it } from 'vitest';
import { HOLD_LOST_HAND_S } from './game';
import { Headless } from './headless';
import { LEDGE_TOP } from './puzzles/bedroom';
import { createNight } from './puzzles/index';
import { InputRecorder, replay } from './replay';
import { Game } from './game';
import { newSave } from './save-state';

const BRIDGE_Y = LEDGE_TOP - 0.01;

function onBridge() {
  const h = new Headless({ puzzles: createNight() });
  const g = h.game;
  const tx = () => g.store.x[g.traveller.slot(g)];
  h.pose('right', 'flat', 0, BRIDGE_Y);
  // Out to the middle of the gap, standing on the hand.
  expect(h.runUntil(() => Math.abs(tx()) < 0.02, 20)).toBe(true);
  return { h, g, tx };
}

describe('tracking loss', () => {
  it('keeps a bridge under the traveller through a short dropout', () => {
    const { h, tx } = onBridge();
    h.tracked.right = false;
    h.run(HOLD_LOST_HAND_S * 0.8);
    h.tracked.right = true;
    expect(h.runUntil(() => h.saw('puzzle-solved'), 15)).toBe(true);
    expect(h.saw('traveller-fell')).toBe(false);
    expect(tx()).toBeGreaterThan(0.5);
  });

  it('holds the world still while no hand is tracked, and carries on without a jump when one returns', () => {
    const { h, g, tx } = onBridge();
    h.tracked.left = false;
    h.tracked.right = false;
    h.run(HOLD_LOST_HAND_S + 0.1);
    expect(g.waitingForHands).toBe(true);
    const t = g.time,
      x = tx();
    h.run(5);
    expect(g.time).toBe(t);
    expect(tx()).toBe(x);
    h.tracked.right = true;
    h.run(1 / 72);
    expect(g.waitingForHands).toBe(false);
    expect(g.time - t).toBeLessThan(0.05);
  });

  it('lets a hand that stays lost go, like a hand taken out of the light, while the other is tracked', () => {
    const { h } = onBridge();
    // The left hand is tracked (resting, no shadow on the stage); the bridge hand drops out.
    h.tracked.right = false;
    expect(h.runUntil(() => h.saw('traveller-fell'), 3)).toBe(true);
    expect(h.game.waitingForHands).toBe(false);
    expect(h.saw('ability-end', 'bridge')).toBe(true);
  });

  it('replays a session with dropouts exactly', () => {
    const rec = new InputRecorder(72 * 20);
    const h = new Headless({ puzzles: createNight(), save: newSave(), seed: 2 });
    h.recorder = rec;
    h.pose('right', 'flat', 0, BRIDGE_Y).run(6);
    h.tracked.right = false;
    h.run(0.3);
    h.tracked.right = true;
    h.tracked.left = false;
    h.run(2);
    const g = new Game({ puzzles: createNight(), save: newSave(), seed: 2 });
    replay(rec, g);
    expect(g.time).toBe(h.game.time);
    expect(new Uint8Array(g.store.x.buffer)).toEqual(new Uint8Array(h.game.store.x.buffer));
  });
});
