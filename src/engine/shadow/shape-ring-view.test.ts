import { describe, expect, it } from 'vitest';
import { createHandShadow } from '../hands/hand-shadow';
import { ShapeEventQueue } from '../hands/shape-events';
import { ShapeRingView } from './shape-ring-view';
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
  return { stage, shadows, view: new ShapeRingView(), events: new ShapeEventQueue(8) };
}
const place = (s: ReturnType<typeof createHandShadow>, x: number) => {
  s.active = true;
  s.onStage = true;
  s.bounds[0] = x - 0.05;
  s.bounds[1] = -0.05;
  s.bounds[2] = x + 0.05;
  s.bounds[3] = 0.05;
};

describe('ShapeRingView', () => {
  it('shows nothing while a hand only moves on the stage', () => {
    const { stage, shadows, view } = setup();
    for (let i = 0; i < 12; i++) {
      place(shadows.right, -0.4 + i * 0.05);
      view.update(0.04, stage, 1);
    }
    expect(view.group.visible).toBe(false);
    view.dispose();
  });

  it('opens a ring where a hand commits a shape, and takes it away again', () => {
    const { stage, shadows, view, events } = setup();
    place(shadows.left, 0.2);
    events.push('commit', 'left', 'flat', 0, 0, 0);
    view.onShapeEvents(events, shadows);
    view.update(0.05, stage, 1);
    const ring = view.group.children[0] as unknown as { visible: boolean };
    expect(ring.visible).toBe(true);
    expect(view.group.visible).toBe(true);
    for (let i = 0; i < 40; i++) view.update(0.05, stage, 1);
    expect(ring.visible).toBe(false);
    expect(view.group.visible).toBe(false);
    view.dispose();
  });

  it('opens no ring while the governor has rings off', () => {
    const { stage, shadows, view, events } = setup();
    view.ringsOn = false;
    place(shadows.left, 0.2);
    events.push('commit', 'left', 'flat', 0, 0, 0);
    view.onShapeEvents(events, shadows);
    view.update(0.05, stage, 1);
    expect(view.group.visible).toBe(false);
    view.dispose();
  });

  it('ignores other events, a commit from a hand with no shadow, and bad frame times', () => {
    const { stage, shadows, view, events } = setup();
    events.push('candidate', 'right', 'fist', 0, 0, 0);
    events.push('commit', 'right', 'fist', 0, 0, 0); // no shadow on the stage
    view.onShapeEvents(events, shadows);
    expect(() => {
      view.update(-1, stage, 1);
      view.update(NaN, stage, 1);
    }).not.toThrow();
    expect((view.group.children[1] as unknown as { visible: boolean }).visible).toBe(false);
    view.dispose();
  });
});
