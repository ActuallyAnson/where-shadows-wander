// The spirit fox, drawn in code: a round, chibi fox in profile, facing right, in black like the hands' shadows. A big head
// with pointed ears, a bean of a body, stubby legs and one huge plume of a tail whose tip fades away like a spirit's. Three
// frames (a leap cycle: tail and legs) are painted once onto canvases and swapped as it moves. Nothing is downloaded.

/** The drawing's box (width, height) in its own units; the frames are painted to fit it. */
export const FOX_BOX = [420, 280] as const;
export const FOX_FRAMES = 3;

const BODY =
  'M120 138C114 112 148 100 186 102C222 104 246 114 248 138C250 160 226 172 186 172C146 172 124 162 120 138Z';
const HEAD =
  'M252 106C250 72 278 56 306 62C330 68 346 84 358 102C364 112 360 120 350 122C336 124 324 128 312 140C288 158 254 140 252 106Z';
const EAR_FAR = 'M298 68C300 46 310 28 326 16C332 34 330 54 320 74Z';
const EAR_NEAR = 'M256 76C248 52 252 30 262 12C282 26 294 46 294 70Z';
/** A tuft of cheek fur under the jaw. */
const TUFT = 'M292 130C296 144 302 152 312 156C314 148 316 138 320 128Z';
const TAIL = 'M128 138C70 144 8 116 6 64C4 30 24 6 56 4C48 22 58 46 84 62C112 80 142 96 152 126Z';
/** Where the tail grows from, and how far each frame swings it (radians). */
const TAIL_ROOT = [136, 132] as const;
const TAIL_SWING = [-0.22, 0, 0.26];
/** Legs: hip x, then each frame's angle (radians from straight down; negative reaches forward). */
const LEGS: readonly (readonly [number, readonly number[]])[] = [
  [232, [-0.9, -0.2, 0.5]], // near front
  [204, [-0.5, 0.2, 0.8]], // far front
  [150, [0.6, -0.1, -0.7]], // near back
  [128, [0.9, 0.3, -0.4]], // far back
];
const HIP_Y = 160;
const LEG_LEN = 36;
const LEG_W = 22;

/** Paints one frame (0..2) on a transparent canvas of any size; `g` is a 2D context. */
export function paintFox(g: CanvasRenderingContext2D, w: number, h: number, frame: number): void {
  const f = Math.max(0, Math.min(FOX_FRAMES - 1, frame | 0));
  g.clearRect(0, 0, w, h);
  g.save();
  g.scale(w / FOX_BOX[0], h / FOX_BOX[1]);
  g.translate(34, 44); // margin so the swinging tail is never cut off
  g.fillStyle = '#000';
  g.strokeStyle = '#000';
  g.lineCap = 'round';
  g.lineWidth = LEG_W;

  // Legs behind the body first.
  for (const [hx, angles] of LEGS) {
    const a = angles[f];
    g.beginPath();
    g.moveTo(hx, HIP_Y);
    g.lineTo(hx + Math.sin(a) * LEG_LEN, HIP_Y + Math.cos(a) * LEG_LEN);
    g.stroke();
  }

  // The tail, swung about its root, with its tip fading out.
  g.save();
  g.translate(TAIL_ROOT[0], TAIL_ROOT[1]);
  g.rotate(TAIL_SWING[f]);
  g.translate(-TAIL_ROOT[0], -TAIL_ROOT[1]);
  const fade = g.createLinearGradient(130, 130, 24, 6);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fill(new Path2D(TAIL));
  g.restore();

  g.fillStyle = '#000';
  g.fill(new Path2D(BODY));
  // The head sits into the body (a neck), a little lower than it was drawn.
  g.translate(-28, 6);
  g.fill(new Path2D(EAR_FAR));
  g.fill(new Path2D(HEAD));
  g.fill(new Path2D(TUFT));
  g.fill(new Path2D(EAR_NEAR));

  // A spirit's eye: a small glint of light cut out of the head.
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.ellipse(312, 98, 6.5, 8.5, 0.2, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'source-over';
  g.restore();
}
