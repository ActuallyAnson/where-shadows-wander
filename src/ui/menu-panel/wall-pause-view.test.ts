import { describe, expect, it } from 'vitest';
import { createStagePlane } from '../../engine/shadow/pure/stage-plane';
import { createHandFrame, JOINT } from '../../engine/hands/hand';
import { HOVER_GRACE_S, WallPauseView } from './wall-pause-view';

describe('WallPauseView', () => {
  it('creates geometry, canvas and buttons', () => {
    const view = new WallPauseView();
    expect(view.group.children.length).toBe(3); // wall plane, cursor ring, and laser beam
    expect(view.visible).toBe(false);

    view.show();
    expect(view.visible).toBe(true);

    view.hide();
    expect(view.visible).toBe(false);
    view.dispose();
  });

  it('detects hovering button and returns action after 3 seconds hover dwell', () => {
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

    // Hand pointing towards the "Light the candle" button (resume) (yMin -0.07 to 0.03, so Y ~ 0.0 in stage = 1.0 in world)
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

    // Hover for 1.0s: still dwelling, should not trigger yet
    const action1 = view.update([hand], stage, false, 1.0);
    expect(action1).toBeNull();

    // Hover for an additional 2.1s (total 3.1s >= 3.0s): should trigger selection!
    const action2 = view.update([hand], stage, false, 2.1);
    expect(action2).toBe('resume');

    view.dispose();
  });

  describe('a pointer that slips off the button', () => {
    function setup() {
      const view = new WallPauseView();
      view.show();
      const stage = createStagePlane();
      stage.origin[0] = 0;
      stage.origin[1] = 1.0;
      stage.origin[2] = -1.5;
      stage.normal[2] = 1;
      stage.right[0] = 1;
      stage.up[1] = 1;
      const hand = createHandFrame('right');
      hand.tracked = true;
      hand.validJoints = 25;
      const idx = JOINT['index-finger-tip'] * 3;
      const mcp = JOINT['index-finger-metacarpal'] * 3;
      const aim = (x: number) => {
        hand.positions[idx] = x;
        hand.positions[idx + 1] = 1.0;
        hand.positions[idx + 2] = -1.0;
        hand.positions[mcp] = x;
        hand.positions[mcp + 1] = 1.0;
        hand.positions[mcp + 2] = -0.9;
      };
      aim(0);
      return { view, stage, hand, aim };
    }

    it('keeps its dwell when it comes back within the grace time', () => {
      const { view, stage, hand, aim } = setup();
      expect(view.update([hand], stage, false, 2.0)).toBeNull();
      aim(2.0); // well off the menu
      expect(view.update([hand], stage, false, HOVER_GRACE_S * 0.6)).toBeNull();
      aim(0);
      expect(view.update([hand], stage, false, 1.05)).toBe('resume'); // 2.0 + 1.05 >= 3
      view.dispose();
    });

    it('starts over when it stays away longer than the grace time', () => {
      const { view, stage, hand, aim } = setup();
      view.update([hand], stage, false, 2.0);
      aim(2.0);
      view.update([hand], stage, false, HOVER_GRACE_S + 0.1);
      aim(0);
      expect(view.update([hand], stage, false, 2.0)).toBeNull();
      expect(view.update([hand], stage, false, 1.05)).toBe('resume');
      view.dispose();
    });
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

    // Aim at "Settings" (yMin -0.20 to -0.10, Y ~ -0.15 stage = 0.85 world)
    const idx = JOINT['index-finger-tip'] * 3;
    const mcp = JOINT['index-finger-metacarpal'] * 3;
    hand.positions[idx] = 0;
    hand.positions[idx + 1] = 0.85;
    hand.positions[idx + 2] = -1.0;
    hand.positions[mcp] = 0;
    hand.positions[mcp + 1] = 0.85;
    hand.positions[mcp + 2] = -0.9;

    // Settings is handled on the wall: the view turns to its settings page and reports no action.
    const action = view.update([hand], stage, true); // trigger pressed
    expect(action).toBeNull();
    expect(view.mode).toBe('settings');

    view.dispose();
  });

  describe('the Developer button (debug builds)', () => {
    function aimedAt(view: WallPauseView, y: number) {
      view.show();
      const stage = createStagePlane();
      stage.origin.set([0, 1.0, -1.5]);
      stage.normal.set([0, 0, 1]);
      stage.right.set([1, 0, 0]);
      stage.up.set([0, 1, 0]);
      const hand = createHandFrame('right');
      hand.tracked = true;
      hand.validJoints = 25;
      const idx = JOINT['index-finger-tip'] * 3;
      const mcp = JOINT['index-finger-metacarpal'] * 3;
      hand.positions.set([0, 1.0 + y, -1.0], idx);
      hand.positions.set([0, 1.0 + y, -0.9], mcp);
      return view.update([hand], stage, true);
    }

    it('reports a press when the view has it', () => {
      const view = new WallPauseView(undefined, { developer: true });
      expect(aimedAt(view, -0.28)).toBe('developer');
      view.dispose();
    });

    it('is not there otherwise', () => {
      const view = new WallPauseView();
      expect(aimedAt(view, -0.28)).toBeNull();
      view.dispose();
    });
  });

  it('switches to settings mode and toggles high contrast setting on the wall', () => {
    const view = new WallPauseView();
    const fakeStore = {
      value: {
        volumeMaster: 1.0,
        volumeMusic: 1.0,
        highContrast: false,
        flicker: true,
      },
      set: (key: string, val: unknown) => {
        (fakeStore.value as Record<string, unknown>)[key] = val;
      },
    };
    view.setSettingsStore(fakeStore as never);
    view.showSettings();
    expect(view.mode).toBe('settings');

    const stage = createStagePlane();
    stage.origin.set([0, 1.0, -1.5]);
    stage.normal.set([0, 0, 1]);
    stage.right.set([1, 0, 0]);
    stage.up.set([0, 1, 0]);

    const hand = createHandFrame('right');
    hand.tracked = true;
    hand.validJoints = 25;

    // Aim at "High Contrast" button in settings mode (yMin -0.16 to -0.06, stage Y ~ -0.11 => world Y = 0.89)
    const idx = JOINT['index-finger-tip'] * 3;
    const mcp = JOINT['index-finger-metacarpal'] * 3;
    hand.positions[idx] = 0;
    hand.positions[idx + 1] = 0.89;
    hand.positions[idx + 2] = -1.0;
    hand.positions[mcp] = 0;
    hand.positions[mcp + 1] = 0.89;
    hand.positions[mcp + 2] = -0.9;

    view.update([hand], stage, true); // Trigger click on High Contrast
    expect(fakeStore.value.highContrast).toBe(true);

    view.dispose();
  });
});
