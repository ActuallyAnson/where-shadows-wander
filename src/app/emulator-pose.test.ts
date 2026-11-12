import { describe, expect, it } from 'vitest';
import {
  CandleStep,
  GameToDevice,
  defaultEmulatorPose,
  lookAt,
  rotate,
  setEmulatorPose,
  type EmulatedRigLike,
  type Pose,
  type Quat,
  type Vec3,
} from './emulator-pose';

function vec(x = 0, y = 0, z = 0) {
  return {
    x,
    y,
    z,
    set(a: number, b: number, c: number) {
      this.x = a;
      this.y = b;
      this.z = c;
    },
  };
}
function quat(x = 0, y = 0, z = 0, w = 1) {
  return {
    x,
    y,
    z,
    w,
    set(a: number, b: number, c: number, d: number) {
      this.x = a;
      this.y = b;
      this.z = c;
      this.w = d;
    },
  };
}
const tracked = (p: Vec3) => ({ position: vec(...p), quaternion: quat() });

/** A stand-in emulator: records the control modes it is set to, as its panel would see them. */
function device(): EmulatedRigLike & { seen: string[] } {
  const seen: string[] = [];
  let mode = 'manual';
  return {
    seen,
    primaryInputMode: 'hand',
    get controlMode() {
      return mode;
    },
    set controlMode(m: string) {
      mode = m;
      seen.push(m);
    },
    position: vec(0, 1.6, 0),
    quaternion: quat(),
    hands: { left: tracked([-0.2, 1.4, -0.4]), right: tracked([0.2, 1.4, -0.4]) },
    controllers: { left: tracked([-0.25, 1.5, -0.3]), right: tracked([0.25, 1.5, -0.3]) },
  };
}

const yawQ = (deg: number): Quat => {
  const a = (deg * Math.PI) / 360;
  return [0, Math.sin(a), 0, Math.cos(a)];
};

describe('lookAt', () => {
  it('looks down -Z at a point straight ahead', () => {
    const f = rotate(lookAt([0, 1, 0], [0, 1, -1]), [0, 0, -1]);
    expect(f[2]).toBeCloseTo(-1);
  });

  it('points the eyes at a point below and to the side', () => {
    const from: Vec3 = [1, 1.2, 2];
    const to: Vec3 = [0.5, 0.7, 1.4];
    const f = rotate(lookAt(from, to), [0, 0, -1]);
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    const n = Math.hypot(d[0], d[1], d[2]);
    for (let i = 0; i < 3; i++) expect(f[i]).toBeCloseTo(d[i] / n);
  });
});

describe('GameToDevice', () => {
  it('maps the game head onto the device head, and points with it', () => {
    const t = new GameToDevice();
    const game: Pose = { position: [1, 1.2, 0.5], quaternion: yawQ(0) };
    const dev: Pose = { position: [0, 1.6, 0], quaternion: yawQ(90) };
    t.set(game, dev);
    const h = t.point(game.position);
    expect(h[0]).toBeCloseTo(0);
    expect(h[1]).toBeCloseTo(1.6);
    expect(h[2]).toBeCloseTo(0);
    // A point 1 m in front of the game head is 1 m in front of the device head (turned 90° left: -X).
    const ahead = t.point([1, 1.2, -0.5]);
    expect(ahead[0]).toBeCloseTo(-1);
    expect(ahead[2]).toBeCloseTo(0);
  });
});

describe('setEmulatorPose', () => {
  it('sets the head and a hand, and makes the panel read them back', () => {
    const d = device();
    setEmulatorPose(
      d,
      { position: [1, 2, 3], quaternion: yawQ(30) },
      { right: { position: [4, 5, 6], quaternion: [0, 0, 0, 1] } },
    );
    expect([d.position.x, d.position.y, d.position.z]).toEqual([1, 2, 3]);
    expect(d.quaternion.y).toBeCloseTo(Math.sin(Math.PI / 12));
    expect(d.hands.right!.position.x).toBe(4);
    expect(d.hands.left!.position.x).toBe(-0.2); // untouched
    expect(d.seen).toEqual(['programmatic', 'manual']);
  });
});

describe('defaultEmulatorPose', () => {
  it("uses IWER's head and the controllers' start without a panel", () => {
    const p = defaultEmulatorPose(device());
    expect(p.head.position).toEqual([0, 1.6, 0]);
    expect(p.hands.right!.position).toEqual([0.25, 1.5, -0.3]);
  });

  it("uses the panel's defaults, its hands relative to its head", () => {
    const d = device();
    d.devui = {
      inputLayer: {
        headsetDefaultPosition: { x: 1, y: 1.5, z: 0 },
        headsetDefaultQuaternion: { x: 0, y: 0, z: 0, w: 1 },
        transformHandles: new Map([
          ['right', { userData: { defaultPosition: [0.2, -0.1, -0.3], defaultQuaternion: [0, 0, 0, 1] } }],
        ]),
      },
    };
    const p = defaultEmulatorPose(d);
    expect(p.head.position).toEqual([1, 1.5, 0]);
    expect(p.hands.right!.position[0]).toBeCloseTo(1.2);
    expect(p.hands.right!.position[1]).toBeCloseTo(1.4);
    expect(p.hands.left!.position).toEqual([-0.25, 1.5, -0.3]); // no panel default: the controller's start
  });
});

describe('CandleStep', () => {
  /** A game whose world is the device's moved and turned, with the match held 0.1 m in front of the right hand. */
  function setup() {
    const d = device();
    const toGame = new GameToDevice();
    // device -> game: the inverse of game -> device; build game -> device and invert by solving with known points.
    const gameHead: Pose = { position: [0.5, 1.6, 0.5], quaternion: yawQ(-90) };
    toGame.set({ position: [0, 1.6, 0], quaternion: yawQ(0) }, gameHead); // maps device points into the game
    const wick: Vec3 = [0.3, 0.9, -0.2];
    const game = {
      head: () => {
        const q: Quat = [d.quaternion.x, d.quaternion.y, d.quaternion.z, d.quaternion.w];
        return {
          position: toGame.point([d.position.x, d.position.y, d.position.z]),
          quaternion: toGame.orientation(q),
        };
      },
      rigHead: () => [0.5, 1.3, 0.5],
      candleFlame: () => wick,
      matchFlame: () => {
        const h = d.hands.right!.position;
        const p = toGame.point([h.x, h.y, h.z]);
        return [p[0], p[1], p[2] - 0.1];
      },
    };
    return { d, game, wick, toGame };
  }

  it('sits the player at the rig looking at the candle, and brings the match over the wick', () => {
    const { d, game, wick } = setup();
    const step = new CandleStep(d, game);
    step.start();
    const head = game.head();
    expect(head.position[1]).toBeCloseTo(1.3);
    const f = rotate(head.quaternion, [0, 0, -1]);
    const to = [wick[0] - 0.5, wick[1] - 1.3, wick[2] - 0.5];
    const n = Math.hypot(to[0], to[1], to[2]);
    for (let i = 0; i < 3; i++) expect(f[i]).toBeCloseTo(to[i] / n);
    for (let i = 0; i < 20 && step.running; i++) step.frame();
    expect(step.running).toBe(false);
    expect(step.status).toMatch(/over the wick/);
    const m = game.matchFlame();
    expect(m[0]).toBeCloseTo(wick[0], 2);
    expect(m[1]).toBeCloseTo(wick[1] + 0.02, 2);
    expect(m[2]).toBeCloseTo(wick[2], 2);
  });

  it('stops when the hand holds no match', () => {
    const { d, game } = setup();
    const step = new CandleStep(d, { ...game, matchFlame: () => null });
    step.start();
    for (let i = 0; i < 5; i++) step.frame();
    expect(step.running).toBe(false);
    expect(step.status).toMatch(/holds none/);
  });
});
