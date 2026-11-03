// The traveller, drawn as a character: a small hooded wanderer in profile (facing right) with a pointed cowl, a scarf that
// streams behind, a round cloak with a swishing tail, stubby boots and a lantern that swings from one hand. It is a black
// silhouette like everything else in the shadows, with the two warm things that give it life: glowing eyes under the hood
// and the lantern. Thirteen poses from one set of curves, so a pose only changes numbers. Nothing here is downloaded: it is paths
// drawn in code, at any size. A sprite atlas calls paintTraveller(g, size, pose) once per pose.

/** Pose numbers. The walk cycle is WALK_CYCLE; BLINK is the idle pose with the eyes shut, shown now and then. */
export const Pose = {
  Idle: 0,
  Walk1: 1,
  Walk2: 2,
  Wait: 3,
  Cheer: 4,
  Shiver: 5,
  Walk3: 6,
  Walk4: 7,
  Blink: 8,
  /** Going up a step: one boot lifted high, the body leaning in, the lantern arm reaching. */
  Climb1: 9,
  Climb2: 10,
  /** Standing and looking up (at the top of a climb, at a high place). */
  LookUp: 11,
  /** A hop over something small. */
  Hop: 12,
} as const;
export const TRAVELLER_POSES = 13;
/** The poses of one stride, in order (about 8 steps a second looks like a steady walk). */
export const WALK_CYCLE: readonly number[] = [Pose.Walk1, Pose.Walk3, Pose.Walk2, Pose.Walk4];

interface Params {
  /** Lean of the body into the walk (pixels at the head). */
  lean: number;
  /** The front boot's offset forward; the back boot goes the other way. */
  stride: number;
  /** How high the back boot lifts, and the front one (pixels). */
  liftBack: number;
  liftFront: number;
  /** Lantern swing, radians (0 hangs straight). */
  swing: number;
  /** The lantern arm: 0 down, 1 raised. */
  arm: number;
  /** Scarf wave phase and how far it trails. */
  wave: number;
  trail: number;
  /** Head tilt, radians (negative turns the cowl back over the shoulder). */
  tilt: number;
  /** Eyes open, 0..1 (a blink is a small value). */
  eyes: number;
  /** Whole-body lift in pixels (a bob, or a hop). */
  lift: number;
  /** Cloak tail swish in pixels. */
  hem: number;
  /** Shiver wobble, pixels. */
  shake: number;
}

const POSES: readonly Params[] = [
  /* idle */ {
    lean: 0,
    stride: 0,
    liftBack: 0,
    liftFront: 0,
    swing: 0.05,
    arm: 0.1,
    wave: 0,
    trail: 1,
    tilt: 0,
    eyes: 1,
    lift: 0,
    hem: 0,
    shake: 0,
  },
  /* walk 1 */ {
    lean: 8,
    stride: 26,
    liftBack: 6,
    liftFront: 0,
    swing: 0.34,
    arm: 0.2,
    wave: 1.2,
    trail: 1.25,
    tilt: 0.05,
    eyes: 1,
    lift: 0,
    hem: 10,
    shake: 0,
  },
  /* walk 2 */ {
    lean: 8,
    stride: -22,
    liftBack: 0,
    liftFront: 6,
    swing: -0.24,
    arm: 0.2,
    wave: 2.6,
    trail: 1.2,
    tilt: 0.03,
    eyes: 1,
    lift: 0,
    hem: -8,
    shake: 0,
  },
  /* wait */ {
    lean: -6,
    stride: 0,
    liftBack: 0,
    liftFront: 0,
    swing: 0.04,
    arm: 0.65,
    wave: 0.5,
    trail: 0.8,
    tilt: -0.22,
    eyes: 1,
    lift: 0,
    hem: 3,
    shake: 0,
  },
  /* cheer */ {
    lean: -2,
    stride: 6,
    liftBack: 12,
    liftFront: 12,
    swing: 0.5,
    arm: 1,
    wave: 1.8,
    trail: 1.4,
    tilt: -0.1,
    eyes: 0.8,
    lift: 20,
    hem: 12,
    shake: 0,
  },
  /* shiver */ {
    lean: 4,
    stride: 0,
    liftBack: 0,
    liftFront: 0,
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
  /* walk 3: the step passes, the body at its highest */ {
    lean: 7,
    stride: 2,
    liftBack: 12,
    liftFront: 0,
    swing: 0.1,
    arm: 0.2,
    wave: 1.9,
    trail: 1.3,
    tilt: 0.04,
    eyes: 1,
    lift: 5,
    hem: 2,
    shake: 0,
  },
  /* walk 4 */ {
    lean: 7,
    stride: -2,
    liftBack: 0,
    liftFront: 12,
    swing: 0,
    arm: 0.2,
    wave: 3.2,
    trail: 1.25,
    tilt: 0.04,
    eyes: 1,
    lift: 5,
    hem: -2,
    shake: 0,
  },
  /* blink */ {
    lean: 0,
    stride: 0,
    liftBack: 0,
    liftFront: 0,
    swing: 0.05,
    arm: 0.1,
    wave: 0,
    trail: 1,
    tilt: 0,
    eyes: 0.08,
    lift: 0,
    hem: 0,
    shake: 0,
  },
  /* climb 1: the front boot up on the next step */ {
    lean: 14,
    stride: 18,
    liftBack: 4,
    liftFront: 26,
    swing: 0.2,
    arm: 0.55,
    wave: 1.5,
    trail: 1.2,
    tilt: -0.1,
    eyes: 1,
    lift: 4,
    hem: 6,
    shake: 0,
  },
  /* climb 2: the back boot comes up, the body rising */ {
    lean: 12,
    stride: -14,
    liftBack: 24,
    liftFront: 2,
    swing: -0.1,
    arm: 0.7,
    wave: 2.8,
    trail: 1.2,
    tilt: -0.08,
    eyes: 1,
    lift: 8,
    hem: -5,
    shake: 0,
  },
  /* look up */ {
    lean: -4,
    stride: 0,
    liftBack: 0,
    liftFront: 0,
    swing: 0.04,
    arm: 0.3,
    wave: 0.6,
    trail: 0.9,
    tilt: -0.38,
    eyes: 1,
    lift: 0,
    hem: 2,
    shake: 0,
  },
  /* hop */ {
    lean: 4,
    stride: 8,
    liftBack: 16,
    liftFront: 20,
    swing: 0.4,
    arm: 0.8,
    wave: 2.2,
    trail: 1.5,
    tilt: -0.05,
    eyes: 1,
    lift: 26,
    hem: 10,
    shake: 0,
  },
];

export const TRAVELLER_BOX = 256;
const INK = '#000';
const AMBER = '#ffdf80';

/** A soft ribbon: a smooth curve from (x0, y0) trailing back `len`, `w` wide at the neck and tapering to a rounded end. */
function ribbon(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  len: number,
  w: number,
  wave: number,
  phase: number,
): void {
  const n = 9;
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 - t * len;
    const y = y0 + Math.sin(t * 4.2 + wave + phase) * (4 + 12 * t) + t * 12;
    const half = (w * (1 - t * 0.6)) / 2;
    top.push([x, y - half]);
    bot.push([x, y + half]);
  }
  g.beginPath();
  g.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i <= n; i++) {
    const mx = (top[i - 1][0] + top[i][0]) / 2;
    const my = (top[i - 1][1] + top[i][1]) / 2;
    g.quadraticCurveTo(top[i - 1][0], top[i - 1][1], mx, my);
  }
  // A rounded end, then back along the bottom edge.
  const end = top[n];
  const endB = bot[n];
  g.quadraticCurveTo(end[0] - 8, (end[1] + endB[1]) / 2, endB[0], endB[1]);
  for (let i = n - 1; i >= 0; i--) {
    const mx = (bot[i + 1][0] + bot[i][0]) / 2;
    const my = (bot[i + 1][1] + bot[i][1]) / 2;
    g.quadraticCurveTo(bot[i + 1][0], bot[i + 1][1], mx, my);
  }
  g.closePath();
  g.fill();
}

/** Draws pose `pose` into a `size` x `size` cell at the context's origin, on a transparent background. */
export function paintTraveller(g: CanvasRenderingContext2D, size: number, pose: number): void {
  const p = POSES[Math.max(0, Math.min(TRAVELLER_POSES - 1, pose | 0))];
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
  g.fillStyle = INK;

  // Boots: two stubby ones that stride and lift, under the cloak.
  const boot = (cx: number, up: number) => {
    g.beginPath();
    g.moveTo(cx - 17, ground - 30 - up);
    g.lineTo(cx + 12, ground - 30 - up);
    g.quadraticCurveTo(cx + 24, ground - 16 - up, cx + 28, ground - up);
    g.lineTo(cx - 17, ground - up);
    g.quadraticCurveTo(cx - 21, ground - 14 - up, cx - 17, ground - 30 - up);
    g.fill();
  };
  boot(108 - p.stride * 0.8, p.liftBack);
  boot(142 + p.stride, p.liftFront);

  // The cloak: a round bell from the shoulders, a scalloped hem, and a tail that swishes behind.
  const hx = p.lean * 0.6;
  const hemY = 206;
  const left = 64 + p.hem * 0.4;
  const right = 166;
  g.beginPath();
  g.moveTo(104 + hx, 100);
  g.bezierCurveTo(84 + hx * 0.5, 128, 56, 168, left, hemY);
  const bumps = 5;
  for (let i = 0; i < bumps; i++) {
    const x0 = left + ((right - left) * i) / bumps;
    const x1 = left + ((right - left) * (i + 1)) / bumps;
    g.quadraticCurveTo((x0 + x1) / 2, hemY + 18 + (i % 2) * 4, x1, hemY + ((i + 1) % 2) * 2);
  }
  g.bezierCurveTo(176, 168, 158 + hx * 0.5, 130, 150 + hx, 100);
  g.closePath();
  g.fill();
  // The swishing tail of the cloak, at the back.
  g.beginPath();
  g.moveTo(left + 2, hemY - 30);
  g.quadraticCurveTo(left - 18 - p.hem, hemY - 8, left - 26 - p.hem * 1.4, hemY + 10 - p.hem * 0.5);
  g.quadraticCurveTo(left - 6, hemY + 6, left + 12, hemY + 2);
  g.closePath();
  g.fill();

  // The scarf: two soft ribbons streaming back from the neck, waving.
  ribbon(g, 108 + hx, 106, 84 * p.trail, 22, p.wave, 0);
  ribbon(g, 110 + hx, 118, 54 * p.trail, 16, p.wave, 1.6);

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
  g.moveTo(20, -4);
  g.bezierCurveTo(38, -18, 38, -52, 14, -66);
  g.bezierCurveTo(-4, -78, -26, -86, -46, -94);
  g.bezierCurveTo(-34, -74, -42, -56, -44, -36);
  g.bezierCurveTo(-46, -14, -34, -2, -20, 2);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(-47, -97, 7, 0, Math.PI * 2);
  g.fill();
  // The eyes: two warm ovals in the dark of the hood, each with a tiny shine.
  const eyeH = 8 * Math.max(0.12, p.eyes);
  for (const ex of [6, 24]) {
    g.fillStyle = AMBER;
    g.beginPath();
    g.ellipse(ex, -34, 4.4, eyeH, 0, 0, Math.PI * 2);
    g.fill();
    if (p.eyes > 0.4) {
      g.fillStyle = '#fffbe8';
      g.beginPath();
      g.arc(ex + 1.2, -34 - eyeH * 0.4, 1.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
  g.restore();
}
