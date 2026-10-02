// Detects the lantern gestures (gesture-events.ts) on both hands each frame.
// Plain TypeScript: no IWSDK, no three.js. Allocates nothing per update.
//
// - Pinch: the thumb-index tip gap, in hand lengths, goes below `pinchEnterGap`
//   and must open past `pinchExitGap` to count as released (hysteresis), with
//   the index finger not curled past `pinchMaxIndexCurl`, so a fist (whose
//   thumb rests near the index) isn't a pinch; a pinch that closes into a fist
//   is dropped silently. Released after at least `pinchMinHoldS` (measured
//   from the first to the last firm frame) it fires pinch-release at the last
//   firm pinch point.
// - Cover-flame: the palm within `coverRadiusM` of the lantern with a closed
//   hand; it stays covered within a slightly larger radius and a slightly
//   lower curl. After `coverHoldS` it fires once, then waits for the hand to leave.
// - Each gesture type has a cooldown shared by both hands, so one action is one event.
// - Missing joints pause a hand; after `freezeS` a pending pinch or cover is dropped silently.
//   A cover that has fired stays fired through a dropout (a closed hand near the
//   lantern is easily occluded), until the hand is seen away from it or is gone
//   for `latchForgetS`.
// A closed hand over the lantern also commits the 'fist' shape (shape-classifier.ts);
// the two coexist, and GestureState.nearLantern lets the game tell them apart.
import { JOINT, type HandFrame, type Handedness, type Vec3 } from './hand';
import { computeHandFeatures, createHandFeatures, type HandFeatures } from './hand-features';
import { createGestureState, GestureEventQueue, type GestureState, type GestureType } from './gesture-events';

export interface GestureConfig {
  /** Thumb-index tip gap (hand lengths) below which a pinch starts: about 18 mm on an adult hand. */
  pinchEnterGap: number;
  /** Gap above which a pinch is released: about 32 mm. */
  pinchExitGap: number;
  pinchMinHoldS: number;
  /** A more curled index finger isn't pinching (a fist's thumb sits near the index). */
  pinchMaxIndexCurl: number;
  coverRadiusM: number;
  /** Extra radius a cover keeps before it counts as left. */
  coverExitMarginM: number;
  /** Mean curl to start covering (a closed hand), and to keep covering. */
  coverEnterCurl: number;
  coverExitCurl: number;
  coverHoldS: number;
  /** Seconds after an event before the same gesture can fire again (both hands). */
  cooldownS: number;
  /** A tracking dropout longer than this drops a pending pinch or cover. */
  freezeS: number;
  /** A dropout longer than this also forgets that a cover has fired. */
  latchForgetS: number;
}

export const DEFAULT_GESTURE_CONFIG: Readonly<GestureConfig> = {
  pinchEnterGap: 0.2,
  pinchExitGap: 0.35,
  pinchMinHoldS: 0.15,
  pinchMaxIndexCurl: 0.75,
  coverRadiusM: 0.12,
  coverExitMarginM: 0.03,
  coverEnterCurl: 0.65,
  coverExitCurl: 0.5,
  coverHoldS: 0.5,
  cooldownS: 1,
  freezeS: 0.2,
  latchForgetS: 2,
};

const MAX_DT = 0.1;
const HANDS: readonly Handedness[] = ['left', 'right'];

interface HandTrack {
  coverS: number;
  /** Fired (or blocked by the cooldown) for this cover: wait for the hand to leave. */
  coverLatched: boolean;
  /** The latched cover actually fired (not blocked by the cooldown). */
  coverFired: boolean;
  pausedS: number;
}

/** The recognizer's features, shared so they aren't computed twice. `valid` false = paused this frame. */
export interface SharedFeatures {
  readonly features: Readonly<Record<Handedness, HandFeatures>>;
  readonly valid: Readonly<Record<Handedness, boolean>>;
}

export class GestureDetector {
  readonly config: GestureConfig;
  /** This update's events. Reused: read them before the next update. */
  readonly events = new GestureEventQueue(8);
  readonly state: Record<Handedness, GestureState> = {
    left: createGestureState('left'),
    right: createGestureState('right'),
  };
  /** Events per type since start, for diagnostics. */
  readonly counts: Record<GestureType, number> = { 'pinch-release': 0, 'cover-flame': 0 };
  private readonly lantern: Vec3 = [0, 0, 0];
  private hasLantern = false;
  private readonly own: Record<Handedness, HandFeatures> = { left: createHandFeatures(), right: createHandFeatures() };
  private readonly track: Record<Handedness, HandTrack> = {
    left: { coverS: 0, coverLatched: false, coverFired: false, pausedS: 0 },
    right: { coverS: 0, coverLatched: false, coverFired: false, pausedS: 0 },
  };
  private readonly lastFired: Record<GestureType, number> = { 'pinch-release': -Infinity, 'cover-flame': -Infinity };
  private lastT = NaN;

  constructor(config: Partial<GestureConfig> = {}) {
    this.config = { ...DEFAULT_GESTURE_CONFIG, ...config };
  }

  /** Where the lantern's flame is (scene space), or null for no lantern, which turns cover-flame off. Copied. */
  setLantern(flame: Readonly<Vec3> | null): void {
    this.hasLantern = flame !== null;
    if (flame) {
      this.lantern[0] = flame[0];
      this.lantern[1] = flame[1];
      this.lantern[2] = flame[2];
    }
  }

  /**
   * @param t the caller's clock, seconds (the same one as the shape recognizer)
   * @param shared the shape recognizer's features for this frame; computed here if omitted
   */
  update(hands: Readonly<Record<Handedness, HandFrame>>, t: number, shared?: SharedFeatures): void {
    this.events.clear();
    // A clock that went backwards (a new hand source) would block both gestures until it caught up.
    if (t < this.lastT) this.lastFired['pinch-release'] = this.lastFired['cover-flame'] = -Infinity;
    const dt = Number.isNaN(this.lastT) ? 0 : Math.min(Math.max(t - this.lastT, 0), MAX_DT);
    this.lastT = t;
    for (let i = 0; i < HANDS.length; i++) {
      const h = HANDS[i];
      const f = shared ? (shared.valid[h] ? shared.features[h] : null) : computeHandFeatures(hands[h], this.own[h]);
      this.updateHand(h, hands[h], f, dt, t);
    }
  }

  /** Forgets everything without events, e.g. when the hand source changes. */
  reset(): void {
    for (let i = 0; i < HANDS.length; i++) {
      const s = this.state[HANDS[i]];
      s.pinching = false;
      s.pinchHeldS = 0;
      s.coverProgress = 0;
      s.nearLantern = false;
      s.paused = false;
      const k = this.track[HANDS[i]];
      k.coverS = 0;
      k.coverLatched = k.coverFired = false;
      k.pausedS = 0;
    }
    this.lastFired['pinch-release'] = this.lastFired['cover-flame'] = -Infinity;
    this.lastT = NaN;
  }

  private updateHand(h: Handedness, hand: HandFrame, f: HandFeatures | null, dt: number, t: number): void {
    const s = this.state[h];
    const k = this.track[h];
    const c = this.config;
    if (!f) {
      s.paused = true;
      k.pausedS += dt;
      if (k.pausedS > c.freezeS) {
        s.pinching = false;
        s.pinchHeldS = 0;
        k.coverS = 0;
        s.nearLantern = false;
        s.lanternDistM = Infinity;
        if (!k.coverLatched) s.coverProgress = 0;
      }
      if (k.pausedS > c.latchForgetS) {
        k.coverLatched = k.coverFired = false;
        s.coverProgress = 0;
      }
      return;
    }
    s.paused = false;
    k.pausedS = 0;

    // Pinch.
    const gap = f.tipGap[0];
    const firm = gap < c.pinchEnterGap && f.curl.index <= c.pinchMaxIndexCurl;
    if (!s.pinching) {
      if (firm) {
        s.pinching = true;
        s.pinchHeldS = 0;
        this.writePinchPoint(hand, s.pinchPoint);
      }
    } else if (f.curl.index > c.pinchMaxIndexCurl || f.meanCurl >= c.coverEnterCurl) {
      // The hand closed: a thumb brushing the index on the way into a fist isn't a pinch.
      s.pinching = false;
      s.pinchHeldS = 0;
    } else if (gap > c.pinchExitGap) {
      if (s.pinchHeldS >= c.pinchMinHoldS && this.ready('pinch-release', t)) {
        const p = s.pinchPoint;
        this.fire('pinch-release', h, t, p[0], p[1], p[2], s.pinchHeldS);
      }
      s.pinching = false;
      s.pinchHeldS = 0;
    } else {
      s.pinchHeldS += dt;
      if (firm) this.writePinchPoint(hand, s.pinchPoint);
    }

    // Cover-flame.
    if (!this.hasLantern) {
      k.coverS = 0;
      k.coverLatched = k.coverFired = false;
      s.coverProgress = 0;
      s.nearLantern = false;
      s.lanternDistM = Infinity;
      return;
    }
    const pos = f.palm.position;
    const dist = Math.hypot(pos[0] - this.lantern[0], pos[1] - this.lantern[1], pos[2] - this.lantern[2]);
    s.lanternDistM = dist;
    s.nearLantern = dist <= c.coverRadiusM + c.coverExitMarginM;
    const covering = k.coverS > 0 || k.coverLatched;
    const inside = covering
      ? dist <= c.coverRadiusM + c.coverExitMarginM && f.meanCurl >= c.coverExitCurl
      : dist <= c.coverRadiusM && f.meanCurl >= c.coverEnterCurl;
    if (!inside) {
      k.coverS = 0;
      k.coverLatched = k.coverFired = false;
    } else if (!k.coverLatched) {
      k.coverS += dt;
      if (k.coverS >= c.coverHoldS - 1e-6) {
        k.coverFired = this.ready('cover-flame', t);
        if (k.coverFired) this.fire('cover-flame', h, t, pos[0], pos[1], pos[2], k.coverS);
        k.coverLatched = true;
      }
    }
    // Full once it fired; back to 0 if the cooldown blocked it, so the feedback doesn't promise a pause.
    s.coverProgress = k.coverLatched ? (k.coverFired ? 1 : 0) : Math.min(k.coverS / c.coverHoldS, 1);
  }

  private ready(type: GestureType, t: number): boolean {
    return t - this.lastFired[type] >= this.config.cooldownS;
  }

  private fire(type: GestureType, h: Handedness, t: number, x: number, y: number, z: number, heldS: number): void {
    this.events.push(type, h, t, x, y, z, heldS);
    this.lastFired[type] = t;
    this.counts[type]++;
  }

  private writePinchPoint(hand: HandFrame, out: Vec3): void {
    const p = hand.positions;
    const a = JOINT['thumb-tip'] * 3,
      b = JOINT['index-finger-tip'] * 3;
    out[0] = (p[a] + p[b]) / 2;
    out[1] = (p[a + 1] + p[b + 1]) / 2;
    out[2] = (p[a + 2] + p[b + 2]) / 2;
  }
}
