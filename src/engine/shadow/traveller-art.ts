// The traveller, drawn as a character: a small hooded wanderer in profile (facing right) with a pointed cowl, a scarf that
// streams behind, a cloak with a scalloped hem, stubby boots and a lantern that swings from one hand. It is a black silhouette
// like everything else in the shadows, with the two warm things that give it life: glowing eyes under the hood and the lantern.
// Six poses (idle, two walk frames, wait, cheer, shiver) from one set of curves, so a pose only changes numbers. Nothing here
// is downloaded: it is paths drawn in code, at any size. A sprite atlas calls paintTraveller(g, size, pose) once per pose.
export const TRAVELLER_POSES = 6;
export type TravellerPose = 0 | 1 | 2 | 3 | 4 | 5; // idle, walk 1, walk 2, wait, cheer, shiver

interface Params {
  /** Lean of the body into the walk, pixels at the head (of a 256 cell). */
  lean: number;
  /** Boot positions: the front boot's forward offset (the back boot mirrors it). */
  stride: number;
  /** Lantern swing, radians (0 hangs straight). */
  swing: number;
  /** The arm that holds the lantern: 0 down, 1 raised. */
  arm: number;
  /** Scarf wave phase and how far it trails. */
  wave: number;
  trail: number;
  /** Head tilt, radians (negative turns the cowl back over the shoulder). */
  tilt: number;
  /** Eyes open, 0..1 (a blink is a small value). */
  eyes: number;
  /** Whole-body lift in pixels (a hop). */
  lift: number;
  /** Hem sway in pixels. */
  hem: number;
  /** Shiver wobble, pixels. */
  shake: number;
}

const POSES: readonly Params[] = [
  { lean: 0, stride: 0, swing: 0.05, arm: 0.1, wave: 0, trail: 1, tilt: 0, eyes: 1, lift: 0, hem: 0, shake: 0 },
  {
    lean: 8,
    stride: 24,
    swing: 0.32,
    arm: 0.2,
    wave: 1.2,
    trail: 1.25,
    tilt: 0.05,
    eyes: 1,
    lift: 0,
    hem: 6,
    shake: 0,
  },
  {
    lean: 6,
    stride: -18,
    swing: -0.22,
    arm: 0.2,
    wave: 2.6,
    trail: 1.2,
    tilt: 0.03,
    eyes: 1,
    lift: 3,
    hem: -6,
    shake: 0,
  },
  {
    lean: -6,
    stride: 0,
    swing: 0.04,
    arm: 0.65,
    wave: 0.5,
    trail: 0.8,
    tilt: -0.22,
    eyes: 1,
    lift: 0,
    hem: 2,
    shake: 0,
  },
  { lean: -2, stride: 0, swing: 0.5, arm: 1, wave: 1.8, trail: 1.4, tilt: -0.1, eyes: 0.8, lift: 16, hem: 8, shake: 0 },
  {
    lean: 4,
    stride: 0,
    swing: 0.1,
    arm: 0.1,
    wave: 0.2,
    trail: 0.7,
    tilt: 0.1,
    eyes: 0.55,
    lift: 0,
    hem: 0,
    shake: 2.2,
  },
];

export const TRAVELLER_BOX = 256;
const INK = '#000';
const AMBER = '#ffdf80';

/** Draws pose `pose` into a `size` x `size` cell at the context's origin, on a transparent background. */
export function paintTraveller(g: CanvasRenderingContext2D, size: number, pose: number): void {
  const p = POSES[Math.max(0, Math.min(POSES_COUNT - 1, pose | 0))];
  const k = size / TRAVELLER_BOX;
  g.save();
  g.scale(k, k);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const ground = 238;
  const sx = p.shake ? Math.sin(p.wave * 9 + 1) * p.shake : 0;
  // The whole figure is drawn a little smaller about its feet, so the cowl and the scarf stay inside the cell.
  g.translate(128 + sx, ground - p.lift);
  g.scale(0.8, 0.8);
  g.translate(-128, -ground);

  // Boots first, under the cloak.
  g.fillStyle = INK;
  const boot = (cx: number, up: number) => {
    g.beginPath();
    g.moveTo(cx - 17, ground - 24 - up);
    g.lineTo(cx + 12, ground - 24 - up);
    g.quadraticCurveTo(cx + 22, ground - 14 - up, cx + 26, ground - up);
    g.lineTo(cx - 17, ground - up);
    g.quadraticCurveTo(cx - 20, ground - 12 - up, cx - 17, ground - 24 - up);
    g.fill();
  };
  boot(110 - p.stride * 0.8, p.stride < 0 ? 0 : 0);
  boot(140 + p.stride, p.stride > 0 ? 6 : 0);

  // The cloak: a bell from the shoulders to a scalloped hem.
  const hx = p.lean * 0.6;
  g.beginPath();
  g.moveTo(104 + hx, 100);
  g.bezierCurveTo(88 + hx * 0.5, 130, 70, 170, 66 + p.hem, 214);
  // Scalloped hem.
  const left = 66 + p.hem;
  const right = 164 + p.hem * 0.5;
  const bumps = 5;
  for (let i = 0; i < bumps; i++) {
    const x0 = left + ((right - left) * i) / bumps;
    const x1 = left + ((right - left) * (i + 1)) / bumps;
    g.quadraticCurveTo((x0 + x1) / 2, 230 + (i % 2) * 3, x1, 214 + ((i + 1) % 2) * 2);
  }
  g.bezierCurveTo(164, 170, 156 + hx * 0.5, 130, 150 + hx, 100);
  g.closePath();
  g.fill();

  // The scarf: two ribbons streaming back from the neck, waving.
  const ribbon = (y0: number, len: number, w: number, ph: number) => {
    g.beginPath();
    const x0 = 106 + hx;
    g.moveTo(x0, y0);
    const n = 8;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      g.lineTo(x0 - t * len * p.trail, y0 + Math.sin(t * 5 + p.wave + ph) * (6 + 10 * t) + t * 10);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      const taper = w * (1 - t * 0.55);
      g.lineTo(x0 - t * len * p.trail, y0 + taper + Math.sin(t * 5 + p.wave + ph) * (6 + 10 * t) + t * 10);
    }
    g.closePath();
    g.fill();
  };
  ribbon(104, 78, 22, 0);
  ribbon(116, 52, 16, 1.6);

  // The arm and the lantern (the arm reaches out in front; raised, it lifts the lantern up and out).
  const shoulderX = 140 + hx;
  const shoulderY = 116;
  const handX = shoulderX + 30 + 10 * p.arm;
  const handY = shoulderY + 22 - 52 * p.arm;
  g.strokeStyle = INK;
  g.lineWidth = 15;
  g.beginPath();
  g.moveTo(shoulderX, shoulderY);
  g.quadraticCurveTo(shoulderX + 22, shoulderY + 20 - 20 * p.arm, handX, handY);
  g.stroke();
  // Lantern hangs from the hand on a short cord and swings about it.
  g.save();
  g.translate(handX, handY);
  g.rotate(p.swing);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 22);
  g.stroke();
  // Glow behind the lantern (the only coloured thing besides the eyes).
  const glow = g.createRadialGradient(0, 44, 2, 0, 44, 46);
  glow.addColorStop(0, 'rgba(255,223,128,0.55)');
  glow.addColorStop(1, 'rgba(255,223,128,0)');
  g.fillStyle = glow;
  g.fillRect(-50, 0, 100, 100);
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(-9, 24);
  g.lineTo(9, 24);
  g.lineTo(13, 36);
  g.lineTo(13, 58);
  g.quadraticCurveTo(0, 66, -13, 58);
  g.lineTo(-13, 36);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(0, 23, 5, Math.PI, 0);
  g.fill();
  // The lit window.
  g.fillStyle = AMBER;
  g.beginPath();
  g.ellipse(0, 46, 6.5, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // The head: a round hood with a pointed cowl curling back, tilted about the neck.
  g.save();
  g.translate(128 + hx * 1.2, 100);
  g.rotate(p.tilt);
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(20, -4); // chin, front
  g.bezierCurveTo(38, -18, 38, -52, 14, -66); // brow
  g.bezierCurveTo(-4, -78, -26, -86, -46, -94); // up the cowl to its tip, curling back
  g.bezierCurveTo(-34, -74, -42, -56, -44, -36); // down the back of the head
  g.bezierCurveTo(-46, -14, -34, -2, -20, 2);
  g.closePath();
  g.fill();
  // A little bobble at the cowl's tip.
  g.beginPath();
  g.arc(-47, -97, 7, 0, Math.PI * 2);
  g.fill();
  // The eyes: two warm ovals in the dark of the hood, with a small shine each.
  const eyeH = 8 * Math.max(0.15, p.eyes);
  g.fillStyle = AMBER;
  for (const ex of [6, 24]) {
    g.beginPath();
    g.ellipse(ex, -34, 4.2, eyeH, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.restore();
}

const POSES_COUNT = POSES.length;
