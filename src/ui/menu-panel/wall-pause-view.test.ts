import { describe, expect, it } from 'vitest';
import { createStagePlane } from '../../engine/shadow/pure/stage-plane';
import { createHandFrame, JOINT } from '../../engine/hands/hand';
import { WallPauseView } from './wall-pause-view';

describe('WallPauseView', () => {
  it('creates geometry, canvas and buttons', () => {
    const view = new WallPauseView();
    expect(view.group.children.length).toBe(2); // wall plane and cursor ring
    expect(view.visible).toBe(false);

    view.show();
    expect(view.visible).toBe(true);

    view.hide();
    expect(view.visible).toBe(false);
    view.dispose();
  });

  it('detects hovering button and returns action on pinch', () => {
    const view = new WallPauseView();
    view.show();

    const stage = createStagePlane();
    stage.origin[0] = 0;
    stage.origin[1] = 1.0;
    stage.origin[2] = -1.5;
    stage.normal[0] = 0;
    stage.normal[1] = 0;
    stage.normal[2] = 1;
    stage.right[0] = 1;
    stage.up[1] = 1;

    // Hand pointing towards the "Resume" button (yMin -0.07 to 0.03, so Y ~ 0.0 in stage = 1.0 in world)
    const hand = createHandFrame('right');
    hand.tracked = true;
    hand.validJoints = 25;

    // Set index tip at (0, 1.0, -1.0) pointing towards wall at Z = -1.5
    const idx = JOINT['index-finger-tip'] * 3;
    const mcp = JOINT['index-finger-metacarpal'] * 3;
    hand.positions[idx] = 0;
    hand.positions[idx + 1] = 1.0;
    hand.positions[idx + 2] = -1.0;

    hand.positions[mcp] = 0;
    hand.positions[mcp + 1] = 1.0;
    hand.positions[mcp + 2] = -0.9; // Knuckle behind tip, ray points straight -Z towards wall

    // Update with no pinch
    const action1 = view.update([hand], stage, false);
    expect(action1).toBeNull();

    // Now pinch (bring thumb tip to index tip)
    const thmb = JOINT['thumb-tip'] * 3;
    hand.positions[thmb] = 0;
    hand.positions[thmb + 1] = 1.0;
    hand.positions[thmb + 2] = -1.0;

    const action2 = view.update([hand], stage, false);
    expect(action2).toBe('resume');

    view.dispose();
  });

  it('triggers action on controller trigger press', () => {
    const view = new WallPauseView();
    view.show();

    const stage = createStagePlane();
    stage.origin.set([0, 1.0, -1.5]);
    stage.normal.set([0, 0, 1]);
    stage.right.set([1, 0, 0]);
    stage.up.set([0, 1, 0]);

    const hand = createHandFrame('right');
    hand.tracked = true;
    hand.validJoints = 25;

    // Aim at "Begin this puzzle again" (yMin -0.20 to -0.10, Y ~ -0.15 stage = 0.85 world)
    const idx = JOINT['index-finger-tip'] * 3;
    const mcp = JOINT['index-finger-metacarpal'] * 3;
    hand.positions[idx] = 0;
    hand.positions[idx + 1] = 0.85;
    hand.positions[idx + 2] = -1.0;
    hand.positions[mcp] = 0;
    hand.positions[mcp + 1] = 0.85;
    hand.positions[mcp + 2] = -0.9;

    const action = view.update([hand], stage, true); // trigger pressed
    expect(action).toBe('restart');

    view.dispose();
  });
});
