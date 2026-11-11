// The puppets' cut-outs, painted in code: each is a white silhouette whose alpha is the shape (the view draws it as a shadow or a
// glow). Windows and gates are cut out of the card, as a shadow puppet's would be. A scene part can name one of these, or an
// image instead (puppet-scene.ts). Painted once when a scene loads.

/** Paints a cut-out filling w × h pixels (y down, as a canvas is). */
export type PuppetPainter = (g: CanvasRenderingContext2D, w: number, h: number) => void;

const cut = (g: CanvasRenderingContext2D, draw: () => void) => {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  draw();
  g.restore();
};

function castle(g: CanvasRenderingContext2D, w: number, h: number): void {
  const X = (f: number) => f * w,
    Y = (f: number) => (1 - f) * h; // f up from the bottom
  g.beginPath();
  // The curtain wall with its battlements.
  g.moveTo(X(0.12), Y(0));
  g.lineTo(X(0.12), Y(0.4));
  for (let i = 0; i < 9; i++) {
    const x0 = 0.12 + i * (0.76 / 9);
    g.lineTo(X(x0), Y(0.44));
    g.lineTo(X(x0 + 0.042), Y(0.44));
    g.lineTo(X(x0 + 0.042), Y(0.4));
    g.lineTo(X(x0 + 0.0844), Y(0.4));
  }
  g.lineTo(X(0.88), Y(0));
  g.closePath();
  g.fill();
  // Towers with pointed roofs and pennants: the two sides, and the tall keep in the middle.
  const tower = (cx: number, tw: number, top: number, roof: number) => {
    g.fillRect(X(cx - tw / 2), Y(top), X(tw), Y(0) - Y(top));
    g.beginPath();
    g.moveTo(X(cx - tw / 2 - 0.02), Y(top));
    g.lineTo(X(cx), Y(top + roof));
    g.lineTo(X(cx + tw / 2 + 0.02), Y(top));
    g.closePath();
    g.fill();
    g.fillRect(X(cx - 0.004), Y(top + roof + 0.07), Math.max(1, X(0.008)), Y(0) - Y(0.07));
    g.beginPath();
    g.moveTo(X(cx + 0.004), Y(top + roof + 0.07));
    g.lineTo(X(cx + 0.07), Y(top + roof + 0.05));
    g.lineTo(X(cx + 0.004), Y(top + roof + 0.03));
    g.fill();
  };
  tower(0.14, 0.13, 0.58, 0.16);
  tower(0.86, 0.13, 0.54, 0.15);
  tower(0.5, 0.2, 0.7, 0.2);
  tower(0.33, 0.09, 0.5, 0.11);
  // The gate and the windows, cut through.
  cut(g, () => {
    g.beginPath();
    g.moveTo(X(0.44), Y(0));
    g.lineTo(X(0.44), Y(0.16));
    g.arc(X(0.5), Y(0.16), X(0.06), Math.PI, 0);
    g.lineTo(X(0.56), Y(0));
    g.fill();
    const win = (cx: number, cy: number) => {
      g.beginPath();
      g.moveTo(X(cx - 0.014), Y(cy - 0.04));
      g.lineTo(X(cx - 0.014), Y(cy));
      g.arc(X(cx), Y(cy), X(0.014), Math.PI, 0);
      g.lineTo(X(cx + 0.014), Y(cy - 0.04));
      g.fill();
    };
    win(0.5, 0.58);
    win(0.14, 0.48);
    win(0.86, 0.44);
    win(0.5, 0.42);
  });
}

function hills(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The top edge: a gentle path along the left (the traveller walks at 60 % up), rising into the castle's mound on the right.
  const top = (u: number) => {
    const mound = Math.exp(-(((u - 0.69) / 0.12) ** 2));
    return 0.6 + 0.025 * Math.sin(u * 19) * (1 - mound) + 0.27 * mound;
  };
  g.beginPath();
  g.moveTo(0, h);
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    g.lineTo(u * w, (1 - top(u)) * h);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  // A few tufts of grass along the path.
  for (const u of [0.06, 0.13, 0.27, 0.36, 0.47, 0.92]) {
    const y = (1 - top(u)) * h;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(u * w + k * 3, y + 2);
      g.lineTo(u * w + k * 7, y - 9 - 3 * (1 - Math.abs(k)));
      g.lineTo(u * w + k * 3 + 2, y + 2);
      g.fill();
    }
  }
}

function tree(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A bare, wind-bent tree: a trunk and branches drawn as tapering strokes.
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const branch = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    const x2 = x + Math.cos(angle) * len,
      y2 = y - Math.sin(angle) * len;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
    if (depth === 0) return;
    branch(x2, y2, angle + 0.45, len * 0.7, width * 0.62, depth - 1);
    branch(x2, y2, angle - 0.38, len * 0.74, width * 0.62, depth - 1);
  };
  branch(w * 0.5, h, Math.PI / 2 + 0.08, h * 0.34, w * 0.09, 5);
}

function leg(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A tapering leg with a small boot pointing forward (right).
  g.beginPath();
  g.moveTo(w * 0.1, 0);
  g.lineTo(w * 0.9, 0);
  g.lineTo(w * 0.75, h * 0.86);
  g.lineTo(w, h * 0.9);
  g.lineTo(w, h);
  g.lineTo(w * 0.18, h);
  g.closePath();
  g.fill();
}

function cloak(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A travelling cloak, flaring to a ragged hem, with a satchel on its back.
  g.beginPath();
  g.moveTo(w * 0.36, 0);
  g.quadraticCurveTo(w * 0.62, -h * 0.02, w * 0.66, h * 0.1);
  g.lineTo(w * 0.9, h * 0.9);
  for (let i = 0; i <= 6; i++) g.lineTo(w * (0.9 - i * 0.13), h * (i % 2 ? 0.94 : 1));
  g.lineTo(w * 0.12, h * 0.92);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(w * 0.22, h * 0.38, w * 0.15, h * 0.15, -0.3, 0, Math.PI * 2);
  g.fill();
}

function hood(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A hood with its point falling back (left), the face's nose peeking out on the right.
  g.beginPath();
  g.moveTo(w * 0.22, h);
  g.quadraticCurveTo(w * 0.1, h * 0.5, w * 0.32, h * 0.2);
  g.quadraticCurveTo(w * 0.5, h * 0.02, w * 0.0, h * 0.04);
  g.quadraticCurveTo(w * 0.38, -h * 0.06, w * 0.62, h * 0.12);
  g.quadraticCurveTo(w * 0.86, h * 0.3, w * 0.84, h * 0.5);
  g.lineTo(w * 0.98, h * 0.64);
  g.lineTo(w * 0.82, h * 0.7);
  g.quadraticCurveTo(w * 0.8, h * 0.95, w * 0.6, h);
  g.closePath();
  g.fill();
}

function staff(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A walking staff with a crook at its top for the lantern's ring.
  g.fillRect(w * 0.3, h * 0.14, w * 0.4, h * 0.86);
  g.beginPath();
  g.arc(w * 0.5, h * 0.12, w * 0.5, 0, Math.PI * 2);
  g.fill();
}

function lantern(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A small lantern: a ring, a peaked cap, a glass box (cut out, so its light shows through) and a base.
  g.lineWidth = w * 0.09;
  g.strokeStyle = '#fff';
  g.beginPath();
  g.arc(w * 0.5, h * 0.1, w * 0.14, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(w * 0.5, h * 0.16);
  g.lineTo(w * 0.95, h * 0.34);
  g.lineTo(w * 0.05, h * 0.34);
  g.closePath();
  g.fill();
  g.fillRect(w * 0.14, h * 0.34, w * 0.72, h * 0.54);
  g.fillRect(w * 0.04, h * 0.86, w * 0.92, h * 0.14);
  cut(g, () => {
    g.fillRect(w * 0.27, h * 0.42, w * 0.18, h * 0.38);
    g.fillRect(w * 0.55, h * 0.42, w * 0.18, h * 0.38);
  });
}

function orb(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A soft round glow, bright at the heart.
  const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

export const PUPPET_ART: Readonly<Record<string, PuppetPainter>> = {
  castle,
  hills,
  tree,
  leg,
  cloak,
  hood,
  staff,
  lantern,
  orb,
};

/** Whether a part's art names an image file rather than a painted cut-out. */
export function isImageArt(art: string): boolean {
  return /\.(png|webp|jpe?g|gif|svg)(\?.*)?$/i.test(art);
}
