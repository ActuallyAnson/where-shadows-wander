// Where mock hands go in a session. Every mock source poses its hands for the desk rig: a player whose eyes are at MOCK_HEAD,
// looking down -Z (src/engine/shadow/pure/test-rig.ts; MOCK_WRIST in hand-source.ts is in that space). In a session the rig
// is placed for the wearer's real head (main.ts placeRig), so the hands are moved into it: the same offset from the eyes,
// turned by the rig's yaw. That keeps them where they always were relative to the candle, the tray and the wall. `toDesk`
// goes the other way, for a key that aims a mock hand at something in the room (the candle). No allocation per call.
import { JOINT_COUNT, type HandFrame } from '../engine/hands/hand';
import { MOCK_HEAD } from '../engine/shadow/pure/test-rig';

export class DeskFrame {
  private x = MOCK_HEAD[0];
  private y = MOCK_HEAD[1];
  private z = MOCK_HEAD[2];
  private cos = 1;
  private sin = 0;

  /** The rig the hands go into: the eyes it was placed for, and its yaw (0 faces -Z; main.ts placeRig). */
  set(head: ArrayLike<number>, yaw: number): void {
    this.x = head[0];
    this.y = head[1];
    this.z = head[2];
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
  }

  /** Moves a hand posed for the desk rig into the placed rig, in place. An untracked hand with no joints is left alone. */
  toRig(hand: HandFrame): void {
    if (hand.validJoints === 0) return;
    const p = hand.positions;
    const c = this.cos,
      s = this.sin;
    for (let i = 0; i < JOINT_COUNT * 3; i += 3) {
      const dx = p[i] - MOCK_HEAD[0],
        dy = p[i + 1] - MOCK_HEAD[1],
        dz = p[i + 2] - MOCK_HEAD[2];
      p[i] = this.x + dx * c + dz * s;
      p[i + 1] = this.y + dy;
      p[i + 2] = this.z - dx * s + dz * c;
    }
  }

  /** A point in the placed rig, as the desk rig sees it. `out` may be `p`. */
  toDesk(p: ArrayLike<number>, out: { [i: number]: number }): void {
    const dx = p[0] - this.x,
      dy = p[1] - this.y,
      dz = p[2] - this.z;
    const c = this.cos,
      s = this.sin;
    out[0] = MOCK_HEAD[0] + dx * c - dz * s;
    out[1] = MOCK_HEAD[1] + dy;
    out[2] = MOCK_HEAD[2] + dx * s + dz * c;
  }
}
