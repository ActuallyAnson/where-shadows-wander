import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../hands/hand-shadow';
import { ShapeEventQueue } from '../hands/shape-events';
import { HandTrailView, TRAIL_POINTS } from './hand-trail-view';
import { createStagePlane } from './pure/stage-plane';

function setup() {
  const stage = createStagePlane();
  stage.origin.set([0, 1.2, -2]);
  stage.right.set([1, 0, 0]);
  stage.up.set([0, 1, 0]);
  stage.normal.set([0, 0, 1]);
  stage.width = 1.6;
  stage.height = 1;
  const shadows = { left: createHandShadow('left'), right: createHandShadow('right') };
  return { stage, shadows, view: new HandTrailView(), events: new ShapeEventQueue(8) };
}
const alphas = (v: HandTrailView) =>
  Array.from(
    (v.group.children[0] as unknown as { geometry: { attributes: { aA: { array: Float32Array } } } }).geometry
      .attributes.aA.array,
  );
const place = (s: ReturnType<typeof createHandShadow>, x: number) => {
  s.active = true;
  s.onStage = true;
  s.bounds[0] = x - 0.05;
  s.bounds[1] = -0.05;
  s.bounds[2] = x + 0.05;
  s.bounds[3] = 0.05;
};

describe('HandTrailView', () => {
  it('shows nothing when no hand is on the stage', () => {
    const { stage, shadows, view } = setup();
    view.update(0.05, stage, shadows, 1);
    expect(view.group.visible).toBe(false);
    expect(alphas(view).every((a) => a === 0)).toBe(true);
    view.dispose();
  });

  it('lays a fading trail behind a hand that moves, and lets it die away when the hand leaves', () => {
    const { stage, shadows, view } = setup();
    for (let i = 0; i < 12; i++) {
      place(shadows.right, -0.4 + i * 0.05);
      view.update(0.04, stage, shadows, 1);
    }
    expect(view.group.visible).toBe(true);
    const a = alphas(view).slice(TRAIL_POINTS); // the right hand's points, newest first
    expect(a[0]).toBeGreaterThan(a[6]);
    expect(a[6]).toBeGreaterThan(0);
    expect(
      alphas(view)
        .slice(0, TRAIL_POINTS)
        .every((x) => x === 0),
    ).toBe(true); // the left hand is not there
    shadows.right.active = false;
    for (let i = 0; i < 80; i++) view.update(0.04, stage, shadows, 1);
    expect(view.group.visible).toBe(false);
    view.dispose();
  });

  it('opens a ring where a hand commits a shape, and takes it away again', () => {
    const { stage, shadows, view, events } = setup();
    place(shadows.left, 0.2);
    events.push('commit', 'left', 'flat', 0, 0, 0);
    view.onShapeEvents(events, shadows);
    view.update(0.05, stage, shadows, 1);
    const ring = view.group.children[1] as unknown as { visible: boolean };
    expect(ring.visible).toBe(true);
    for (let i = 0; i < 40; i++) view.update(0.05, stage, shadows, 1);
    expect(ring.visible).toBe(false);
    view.dispose();
  });

  it('ignores other events, a commit from a hand with no shadow, and bad frame times', () => {
    const { stage, shadows, view, events } = setup();
    events.push('candidate', 'right', 'fist', 0, 0, 0);
    events.push('commit', 'right', 'fist', 0, 0, 0); // no shadow on the stage
    view.onShapeEvents(events, shadows);
    expect(() => {
      view.update(-1, stage, shadows, 1);
      view.update(NaN, stage, shadows, 1);
    }).not.toThrow();
    expect((view.group.children[2] as unknown as { visible: boolean }).visible).toBe(false);
    view.dispose();
  });
});
