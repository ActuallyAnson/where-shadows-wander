// The recognition sharpen effect (GDD "How a shape is used"): when a shape is
// recognised, that hand's shadow starts to sharpen as the hold fills, snaps
// crisp on commit, and relaxes back when the shape is cancelled or released.
// This is the pure part: per hand it turns the classifier's state into a
// `look` (how much to scale the shadow's edge blur and how much darker to draw
// it) for the renderer. The shadow's shape and its collision capsules are never
// touched, only how its edge is drawn.
// Plain TypeScript, no allocation per update.
import type { Handedness } from '../../hands/hand';
import type { ShapeEventQueue, ShapeState } from '../../hands/shape-events';

export interface SharpenSettings {
  /** 0..1, the master amount. 0 turns the effect off. Accessibility: high contrast can raise it. */
  strength: number;
  /** How sharp a candidate gets by the time its hold is complete (committed is 1). */
  candidateLevel: number;
  /** Seconds to settle when sharpening, and when relaxing. */
  riseS: number;
  relaxS: number;
  /** Edge blur at full sharpness, as a fraction of its normal width. */
  crispBlurScale: number;
  /** How much darker (opacity added, 0..1) a fully sharp shadow is drawn. */
  opacityBoost: number;
  /** How long the extra snap on commit takes to fade, seconds. */
  pulseS: number;
}

export const DEFAULT_SHARPEN_SETTINGS: Readonly<SharpenSettings> = {
  strength: 1,
  candidateLevel: 0.7,
  riseS: 0.05,
  relaxS: 0.25,
  crispBlurScale: 0.3,
  opacityBoost: 0.08,
  pulseS: 0.15,
};

/** What the renderer needs for one hand. */
export interface ShadowLook {
  /** Multiplies the hand's edge blur (1 = normal). */
  blurScale: number;
  /** Added to the shadow's base opacity. */
  opacityBoost: number;
}

/** The edge never gets sharper than this fraction of its normal blur, whatever the settings: a razor edge aliases. */
const MIN_BLUR_SCALE = 0.15;
const MAX_DT = 0.1;
const HANDS: readonly Handedness[] = ['left', 'right'];

const smoothstep = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};

export class ShadowSharpen {
  readonly settings: SharpenSettings;
  /** 0..1 per hand: 0 = plain shadow, 1 = committed shape. */
  readonly value: Record<Handedness, number> = { left: 0, right: 0 };
  /** 1 at the moment a shape commits, fading to 0: the brief extra snap. */
  readonly pulse: Record<Handedness, number> = { left: 0, right: 0 };
  readonly look: Record<Handedness, ShadowLook> = {
    left: { blurScale: 1, opacityBoost: 0 },
    right: { blurScale: 1, opacityBoost: 0 },
  };

  constructor(settings: Partial<SharpenSettings> = {}) {
    this.settings = { ...DEFAULT_SHARPEN_SETTINGS, ...settings };
  }

  /**
   * @param states each hand's classifier state, read this frame
   * @param events this frame's shape events (a commit fires the pulse)
   * @param dt seconds since the last update
   */
  update(states: Readonly<Record<Handedness, Readonly<ShapeState>>>, events: ShapeEventQueue, dt: number): void {
    const s = this.settings;
    const step = Math.min(Math.max(dt, 0), MAX_DT);
    for (let i = 0; i < events.count; i++) {
      const e = events.at(i);
      if (e.type === 'commit') this.pulse[e.hand] = 1;
    }
    const pulseDecay = Math.exp(-step / Math.max(s.pulseS, 1e-3));
    for (let i = 0; i < HANDS.length; i++) {
      const h = HANDS[i];
      const st = states[h];
      this.pulse[h] *= pulseDecay;
      // A role stays in force while another shape's hold is under way (a switch), so it stays sharp.
      // While tracking is partial the classifier waits, and so does the shadow.
      if (st.phase !== 'paused') {
        const target = st.committed ? 1 : st.candidate ? s.candidateLevel * smoothstep(st.progress) : 0;
        const tau = Math.max(target > this.value[h] ? s.riseS : s.relaxS, 1e-3);
        this.value[h] += (target - this.value[h]) * (1 - Math.exp(-step / tau));
      }
      const amount = s.strength * this.value[h];
      const look = this.look[h];
      const snap = 1 - 0.5 * s.strength * this.pulse[h];
      look.blurScale = Math.max(MIN_BLUR_SCALE, (1 + (s.crispBlurScale - 1) * amount) * snap);
      look.opacityBoost = s.strength * s.opacityBoost * (this.value[h] + 0.5 * this.pulse[h]);
    }
  }

  /** Back to plain shadows without a transition, e.g. when the hand source changes. */
  reset(): void {
    for (const h of HANDS) {
      this.value[h] = this.pulse[h] = 0;
      this.look[h].blurScale = 1;
      this.look[h].opacityBoost = 0;
    }
  }
}
