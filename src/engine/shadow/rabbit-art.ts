// A little shadow rabbit in profile, facing right, in black: a round body with a big haunch, a round head, two long ears, a
// puff of a tail and a spirit's glint of an eye. Three frames of a hop (crouched, stretched in the air, landing), painted from
// the same curves. Drawn in code at any size. Plain drawing code: it takes a 2D context.

/** The drawing's box (width, height). */
export const RABBIT_BOX = [300, 240] as const;
export const RABBIT_FRAMES = 3;

interface Pose {
  /** Whole-body tilt, radians (negative noses up). */
  tilt: number;
  /** How long the body is stretched (1 is the crouch). */
  stretch: number;
  /** Where the ears lie: 0 up, 1 swept flat back. */
  ears: number;
  /** The front legs reach forward (pixels), and the hind leg trails back (pixels). */
  front: number;
  hind: number;
  /** Body lift above the ground, pixels. */
  lift: number;
}

const POSES: readonly Pose[] = [
  { tilt: 0.05, stretch: 1, ears: 0.15, front: 0, hind: 0, lift: 0 },
  { tilt: -0.3, stretch: 1.28, ears: 0.9, front: 46, hind: 52, lift: 40 },
  { tilt: 0.1, stretch: 1.05, ears: 0.3, front: 24, hind: 8, lift: 4 },
];

export function paintRabbit(g: CanvasRenderingContext2D, w: number, h: number, frame: number): void {
  const p = POSES[Math.max(0, Math.min(RABBIT_FRAMES - 1, frame | 0))];
  g.clearRect(0, 0, w, h);
  g.save();
  g.scale(w / RABBIT_BOX[0], h / RABBIT_BOX[1]);
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  const ground = 222;
  g.translate(150, ground - 60 - p.lift);
  g.rotate(p.tilt);
  g.translate(-150, 60 - ground + 0);
  // (the body is now drawn about its own middle, 150 across and `ground - 60` down)
  const cy = ground - 60;

  // The far legs and the hind foot first.
  g.lineWidth = 20;
  g.beginPath();
  g.moveTo(205, cy + 30);
  g.lineTo(212 + p.front, cy + 56 + (p.front ? -14 : 0));
  g.stroke();
  // Hind foot: a long flat paw.
  g.beginPath();
  g.ellipse(112 - p.hind * 0.4, cy + 52, 42 + p.hind * 0.2, 12, 0, 0, Math.PI * 2);
  g.fill();

  // The tail: a round puff.
  g.beginPath();
  g.arc(70 - (p.stretch - 1) * 40, cy + 6, 21, 0, Math.PI * 2);
  g.fill();
  // The body and the haunch.
  g.beginPath();
  g.ellipse(140, cy + 4, 74 * p.stretch, 46, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(118 - (p.stretch - 1) * 30, cy + 14, 48, 50, 0, 0, Math.PI * 2);
  g.fill();
  // The head, with a soft little muzzle.
  const hx = 214 + (p.stretch - 1) * 30;
  const hy = cy - 28;
  g.beginPath();
  g.arc(hx, hy, 36, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(hx + 30, hy + 8, 18, 14, 0.15, 0, Math.PI * 2);
  g.fill();
  // Two long ears, swept back as it leaps.
  for (const [dx, lean] of [
    [-6, 0],
    [12, 0.14],
  ] as const) {
    g.save();
    g.translate(hx + dx, hy - 24);
    g.rotate(-0.2 - p.ears * 1.25 + lean);
    g.beginPath();
    g.ellipse(0, -44, 13, 48, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // The near front leg.
  g.lineWidth = 19;
  g.beginPath();
  g.moveTo(200, cy + 26);
  g.lineTo(206 + p.front, cy + 54 + (p.front ? -12 : 0));
  g.stroke();

  // A spirit's eye and the pale inside of the near ear, cut out of the black.
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.ellipse(hx + 14, hy - 4, 5.5, 7.5, 0.2, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  g.restore();
}
