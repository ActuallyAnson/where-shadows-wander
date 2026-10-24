// The cutscene's Skip button: a spot on the stage's lower corner that a fingertip pokes. Held there for a moment, it
// counts as pressed (a brush by the hand while it moves is not). Plain TypeScript; builds nothing per call.
import type { StagePlane } from './stage-plane';

/** How far in from the stage's corner the button sits, metres, and how big it is. */
export const SKIP_INSET_M = 0.07;
export const SKIP_RADIUS_M = 0.05;
/** A fingertip counts when it is this close to the wall (in front, behind). */
export const SKIP_NEAR_M = 0.05;
export const SKIP_BEHIND_M = 0.03;
export const SKIP_DWELL_S = 0.3;

/** The button's centre in stage coordinates (x along right, y along up, from the stage centre). */
export function skipCentre(stage: StagePlane, out: [number, number]): [number, number] {
  out[0] = stage.width / 2 - SKIP_INSET_M;
  out[1] = -stage.height / 2 + SKIP_INSET_M;
  return out;
}

export class SkipTouch {
  private held = 0;
  private readonly c: [number, number] = [0, 0];

  /** `tips` holds n fingertips as xyz triples in scene space. True on the frame the poke completes. */
  update(dt: number, tips: ArrayLike<number>, n: number, stage: StagePlane): boolean {
    skipCentre(stage, this.c);
    const o = stage.origin,
      r = stage.right,
      u = stage.up,
      nn = stage.normal;
    let touching = false;
    for (let i = 0; i < n && !touching; i++) {
      const dx = tips[i * 3] - o[0],
        dy = tips[i * 3 + 1] - o[1],
        dz = tips[i * 3 + 2] - o[2];
      const x = dx * r[0] + dy * r[1] + dz * r[2] - this.c[0];
      const y = dx * u[0] + dy * u[1] + dz * u[2] - this.c[1];
      const d = dx * nn[0] + dy * nn[1] + dz * nn[2];
      touching = x * x + y * y <= SKIP_RADIUS_M * SKIP_RADIUS_M && d <= SKIP_NEAR_M && d >= -SKIP_BEHIND_M;
    }
    if (!touching) {
      this.held = 0;
      return false;
    }
    this.held += dt;
    if (this.held < SKIP_DWELL_S) return false;
    this.held = 0;
    return true;
  }

  /** 0..1 how far the poke has got (for a ring that fills). */
  get progress(): number {
    return Math.min(1, this.held / SKIP_DWELL_S);
  }
}
