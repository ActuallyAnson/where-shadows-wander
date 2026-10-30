import { Group } from '@iwsdk/core';
import { describe, expect, it, vi } from 'vitest';
import type { HandShadow } from '../hands/hand-shadow';
import { createHandShadow } from '../hands/hand-shadow';
import type { ShapeClassifier } from '../hands/shape-classifier';
import { GHOST_RENDER_ORDER, GhostTargetView } from './ghost-target-view';

function makeMockClassifier(committedShape: string | null = null): ShapeClassifier {
  return {
    state: {
      phase: committedShape ? 'committed' : 'idle',
      candidate: null,
      committed: committedShape,
      progress: committedShape ? 1 : 0,
      margin: 1,
      validJoints: 25,
      hand: 'left',
    },
  } as unknown as ShapeClassifier;
}

function makeMockShadow(cx = 0, cy = 0, active = true, onStage = true): HandShadow {
  const s = createHandShadow('left');
  s.active = active;
  s.onStage = onStage;
  s.bounds[0] = cx - 0.05; // minX
  s.bounds[1] = cy - 0.05; // minY
  s.bounds[2] = cx + 0.05; // maxX
  s.bounds[3] = cy + 0.05; // maxY
  return s;
}

describe('ghost-target-view', () => {
  it('creates dashed LineLoop with correct render order and attach to parent', () => {
    const parent = new Group();
    const target = new GhostTargetView(parent, { targetId: 'bridge_hint', x: 0.1, y: -0.2 });

    expect(target.mesh).toBeDefined();
    expect(target.mesh.renderOrder).toBe(GHOST_RENDER_ORDER);
    expect(target.mesh.renderOrder).toBe(4);
    expect(parent.children).toContain(target.mesh);
    expect(target.x).toBe(0.1);
    expect(target.y).toBe(-0.2);
  });

  it('animates breathing opacity when idle', () => {
    const target = new GhostTargetView(undefined, { x: 0, y: 0 });
    const emptyShadows = { left: createHandShadow('left'), right: createHandShadow('right') };
    const emptyShapes = { left: makeMockClassifier(null), right: makeMockClassifier(null) };

    target.update(0.1, emptyShadows, emptyShapes);
    const op1 = target.material.opacity;

    target.update(0.5, emptyShadows, emptyShapes);
    const op2 = target.material.opacity;

    expect(op1).toBeGreaterThanOrEqual(0.4);
    expect(op1).toBeLessThanOrEqual(0.8);
    expect(op2).not.toBe(op1);
  });

  it('detects shadow overlap within 10cm and triggers when required gesture is committed', () => {
    const onTrigger = vi.fn();
    const target = new GhostTargetView(undefined, {
      targetId: 'flat_bridge',
      x: 0.0,
      y: 0.0,
      requiredShape: 'flat',
      holdDuration: 0.3,
      onTrigger,
    });

    // Left hand hovering at (0.04, 0.03) -> dist = 0.05m < 0.10m
    const shadows = {
      left: makeMockShadow(0.04, 0.03, true, true),
      right: createHandShadow('right'),
    };

    // 1. Hand overlapping, but NOT holding flat shape (holding fist)
    const fistShapes = {
      left: makeMockClassifier('fist'),
      right: makeMockClassifier(null),
    };

    target.update(0.2, shadows, fistShapes);
    expect(target.holdTimer).toBe(0);
    expect(target.triggered).toBe(false);
    expect(onTrigger).not.toHaveBeenCalled();

    // 2. Hand overlapping and committed 'flat' shape
    const flatShapes = {
      left: makeMockClassifier('flat'),
      right: makeMockClassifier(null),
    };

    // Hold for 0.15s (halfway)
    target.update(0.15, shadows, flatShapes);
    expect(target.holdTimer).toBeCloseTo(0.15);
    expect(target.triggered).toBe(false);
    expect(onTrigger).not.toHaveBeenCalled();

    // Hold for another 0.20s (total 0.35s >= 0.3s)
    target.update(0.2, shadows, flatShapes);
    expect(target.triggered).toBe(true);
    expect(target.material.opacity).toBe(1.0); // snapped solid gold
    expect(onTrigger).toHaveBeenCalledWith('flat_bridge');
  });

  it('reconfigures via setTarget cleanly', () => {
    const target = new GhostTargetView();
    target.triggered = true;
    target.holdTimer = 0.5;

    target.setTarget('new_puzzle', 0.5, -0.1, 'cup');

    expect(target.targetId).toBe('new_puzzle');
    expect(target.x).toBe(0.5);
    expect(target.y).toBe(-0.1);
    expect(target.requiredShape).toBe('cup');
    expect(target.triggered).toBe(false);
    expect(target.holdTimer).toBe(0);
    expect(target.active).toBe(true);
    expect(target.mesh.visible).toBe(true);
  });

  it('disposes resources cleanly', () => {
    const target = new GhostTargetView();
    expect(() => target.dispose()).not.toThrow();
  });
});
