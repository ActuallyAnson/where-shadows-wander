// The puppets' cut-outs, painted in code: each is a white silhouette whose alpha is the shape (the view draws it as a shadow or a
// glow). Windows and gates are cut out of the card, as a shadow puppet's would be. A scene part can name one of these, or an
// image instead (puppet-scene.ts). Painted once when a scene loads.
import { DRESS_EXTRA_H, DRESS_W_RATIO } from '../stage/story/story-kit';

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

// Scene 2, "How they met": a rabbit, two small kids sitting cross-legged, the blanket fort round them, the torch, and the
// boy's first lumpy try at a rabbit. All face right; a part is mirrored to face left.

function rabbit(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A sitting rabbit in profile: round body, head forward, two long ears leaning back, a tail, a paw; the eye cut out.
  const e = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    g.beginPath();
    g.ellipse(x * w, y * h, rx * w, ry * h, rot, 0, Math.PI * 2);
    g.fill();
  };
  e(0.42, 0.7, 0.28, 0.26);
  e(0.68, 0.46, 0.15, 0.16);
  e(0.78, 0.53, 0.09, 0.08);
  e(0.56, 0.2, 0.055, 0.2, -0.45);
  e(0.66, 0.18, 0.05, 0.19, -0.18);
  e(0.13, 0.72, 0.07, 0.08);
  e(0.62, 0.95, 0.13, 0.05);
  cut(g, () => e(0.74, 0.42, 0.022, 0.026));
}

function fox(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A little fox in profile, facing right, mid-bound: a deep chest and a long body, a pointed snout, two tall pointed ears, a big
  // bushy tail out behind with a fine tip, and four sturdy legs; the eye cut out.
  const e = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    g.beginPath();
    g.ellipse(x * w, y * h, rx * w, ry * h, rot, 0, Math.PI * 2);
    g.fill();
  };
  const poly = (...pts: number[]) => {
    g.beginPath();
    g.moveTo(pts[0] * w, pts[1] * h);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * w, pts[i + 1] * h);
    g.closePath();
    g.fill();
  };
  // The body, haunches and the deep chest rising to the neck.
  e(0.47, 0.55, 0.22, 0.17, -0.04);
  e(0.32, 0.55, 0.1, 0.17);
  e(0.64, 0.47, 0.11, 0.18, -0.5);
  // The head, and its snout tapering to the nose.
  e(0.77, 0.32, 0.1, 0.12);
  poly(0.8, 0.22, 0.99, 0.36, 0.97, 0.42, 0.8, 0.44);
  // The ears, tall and pointed.
  poly(0.69, 0.3, 0.71, 0.0, 0.79, 0.24);
  poly(0.76, 0.24, 0.83, 0.0, 0.86, 0.28);
  // The tail: a big plume out behind, lifted, thick at the root and fine at the tip.
  g.beginPath();
  g.moveTo(0.3 * w, 0.42 * h);
  g.quadraticCurveTo(0.14 * w, 0.18 * h, 0.0 * w, 0.3 * h);
  g.quadraticCurveTo(0.04 * w, 0.66 * h, 0.3 * w, 0.68 * h);
  g.closePath();
  g.fill();
  // The legs, mid-bound: the front pair reaching, the back pair pushing off.
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = g.fillStyle;
  g.lineWidth = 0.06 * w;
  const leg = (x0: number, y0: number, x1: number, y1: number) => {
    g.beginPath();
    g.moveTo(x0 * w, y0 * h);
    g.lineTo(x1 * w, y1 * h);
    g.stroke();
  };
  leg(0.64, 0.6, 0.76, 0.95);
  leg(0.58, 0.64, 0.63, 0.96);
  leg(0.34, 0.66, 0.24, 0.95);
  leg(0.28, 0.62, 0.13, 0.9);
  g.restore();
  cut(g, () => e(0.8, 0.3, 0.02, 0.025));
}

function kid(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A small kid sitting with knees up, side on, facing right: back, shoulders, the thigh out to a knee, the shin down to a foot.
  g.beginPath();
  g.moveTo(w * 0.34, h * 0.02);
  g.quadraticCurveTo(w * 0.6, -h * 0.01, w * 0.62, h * 0.12);
  g.lineTo(w * 0.6, h * 0.48);
  g.quadraticCurveTo(w * 0.78, h * 0.4, w * 0.9, h * 0.5);
  g.lineTo(w * 0.94, h * 0.92);
  g.lineTo(w * 1.0, h * 0.95);
  g.lineTo(w * 1.0, h);
  g.lineTo(w * 0.12, h);
  g.quadraticCurveTo(w * 0.06, h * 0.72, w * 0.2, h * 0.5);
  g.quadraticCurveTo(w * 0.22, h * 0.1, w * 0.34, h * 0.02);
  g.closePath();
  g.fill();
}

function kidHead(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A round head facing right: a little nose, a tuft of hair standing up, an ear's notch.
  g.beginPath();
  g.arc(w * 0.48, h * 0.55, w * 0.36, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.8, h * 0.48);
  g.lineTo(w * 0.94, h * 0.6);
  g.lineTo(w * 0.8, h * 0.66);
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.32, h * 0.26);
  g.lineTo(w * 0.36, h * 0.04);
  g.lineTo(w * 0.44, h * 0.2);
  g.lineTo(w * 0.52, h * 0.02);
  g.lineTo(w * 0.56, h * 0.22);
  g.fill();
  cut(g, () => {
    g.beginPath();
    g.arc(w * 0.68, h * 0.48, w * 0.04, 0, Math.PI * 2);
    g.fill();
  });
}

function girlHead(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The friend's head: the same round head and nose as the boy's, but smooth hair over the crown instead of his tuft (her
  // ponytail is a part of its own, 'ponytail', so it can swing), and a little bow on top.
  g.beginPath();
  g.arc(w * 0.48, h * 0.55, w * 0.36, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.8, h * 0.48);
  g.lineTo(w * 0.94, h * 0.6);
  g.lineTo(w * 0.8, h * 0.66);
  g.fill();
  // Hair a little fuller than the head over the crown and down the back, with a fringe over the brow.
  g.beginPath();
  g.moveTo(w * 0.48, h * 0.55);
  g.arc(w * 0.46, h * 0.53, w * 0.4, Math.PI * 0.8, Math.PI * 1.82);
  g.closePath();
  g.fill();
  // The bow: two small loops either side of a knot.
  g.beginPath();
  g.ellipse(w * 0.3, h * 0.12, w * 0.09, h * 0.06, 0.5, 0, Math.PI * 2);
  g.ellipse(w * 0.5, h * 0.08, w * 0.09, h * 0.06, -0.5, 0, Math.PI * 2);
  g.fill();
  cut(g, () => {
    g.beginPath();
    g.arc(w * 0.68, h * 0.48, w * 0.04, 0, Math.PI * 2);
    g.fill();
  });
}

function ponytail(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A ponytail tied at the top right (where it hangs from the back of her head) and falling down and back to a soft tip.
  g.beginPath();
  g.arc(w * 0.82, h * 0.16, w * 0.14, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.72, h * 0.08);
  g.quadraticCurveTo(w * 0.2, h * 0.1, w * 0.12, h * 0.96);
  g.quadraticCurveTo(w * 0.4, h * 0.7, w * 0.92, h * 0.26);
  g.closePath();
  g.fill();
}

function arm(g: CanvasRenderingContext2D, w: number, h: number): void {
  // An arm from the shoulder (bottom) to a small hand (top), tapering.
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(w * 0.2, h * 0.14);
  g.lineTo(w * 0.8, h * 0.14);
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.1, w * 0.48, h * 0.1, 0, 0, Math.PI * 2);
  g.fill();
}

function fort(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A blanket over two chairs: it peaks over the middle, its edge hangs in soft scallops, and its sides fall to the floor as
  // the fort's walls. The middle is open, so the kids inside show.
  const top = (u: number) => 0.04 + 0.16 * Math.abs(u - 0.5) * 2 + 0.02 * Math.sin(u * 23);
  g.beginPath();
  g.moveTo(0, h);
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    g.lineTo(u * w, top(u) * h);
  }
  g.lineTo(w, h);
  g.lineTo(w * 0.9, h);
  g.quadraticCurveTo(w * 0.86, h * 0.7, w * 0.88, h * 0.3);
  // The hanging edge, scalloped from right to left (the fort fills the wall, so it has many).
  const n = 11;
  for (let i = 0; i < n; i++) {
    const u0 = 0.88 - (i * 0.76) / n,
      u1 = 0.88 - ((i + 1) * 0.76) / n;
    const y = 0.24 + 0.04 * Math.sin((i / (n - 1)) * Math.PI);
    g.quadraticCurveTo(((u0 + u1) / 2) * w, (y + 0.06) * h, u1 * w, y * h);
  }
  g.quadraticCurveTo(w * 0.14, h * 0.7, w * 0.1, h);
  g.closePath();
  g.fill();
  // The chairs' backs poking up at the corners.
  g.fillRect(w * 0.02, h * 0.12, w * 0.02, h * 0.3);
  g.fillRect(w * 0.96, h * 0.12, w * 0.02, h * 0.3);
}

function torch(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A torch lying on its side, its head (the wider end, right) pointing the light up and out.
  g.fillRect(0, h * 0.25, w * 0.7, h * 0.6);
  g.beginPath();
  g.moveTo(w * 0.66, h * 0.25);
  g.lineTo(w, 0);
  g.lineTo(w, h);
  g.lineTo(w * 0.66, h * 0.85);
  g.fill();
}

function lump(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A first try at a rabbit: a lumpy fist with one ear bent over and a thumb sticking out the wrong way.
  const e = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    g.beginPath();
    g.ellipse(x * w, y * h, rx * w, ry * h, rot, 0, Math.PI * 2);
    g.fill();
  };
  e(0.5, 0.7, 0.32, 0.28);
  e(0.3, 0.55, 0.16, 0.18);
  e(0.66, 0.5, 0.17, 0.16);
  e(0.48, 0.32, 0.07, 0.18, 0.9);
  e(0.86, 0.68, 0.13, 0.06, -0.3);
}

// Scene 2's opening, the night they met: his new room in the storm (a window with rain on the glass, a moving box), the blanket
// he hides under, and the beam of her torch. All face right; a part is mirrored to face left.

function window_(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A window seen from inside: the frame with a cross of glazing bars, its four panes cut out, a sill under it, and a curtain
  // hanging at each side, gathered at a tie-back.
  const X = (f: number) => f * w,
    Y = (f: number) => (1 - f) * h; // f up from the bottom
  g.fillRect(X(0.12), Y(1), X(0.76), Y(0.06) - Y(1));
  g.fillRect(0, Y(0.08), w, Y(0) - Y(0.08));
  cut(g, () => {
    const x0 = 0.2,
      x1 = 0.8,
      y0 = 0.14,
      y1 = 0.94,
      bar = 0.03;
    const xm = (x0 + x1) / 2,
      ym = (y0 + y1) / 2;
    g.fillRect(X(x0), Y(y1), X(xm - bar / 2 - x0), Y(ym + bar / 2) - Y(y1));
    g.fillRect(X(xm + bar / 2), Y(y1), X(x1 - xm - bar / 2), Y(ym + bar / 2) - Y(y1));
    g.fillRect(X(x0), Y(ym - bar / 2), X(xm - bar / 2 - x0), Y(y0) - Y(ym - bar / 2));
    g.fillRect(X(xm + bar / 2), Y(ym - bar / 2), X(x1 - xm - bar / 2), Y(y0) - Y(ym - bar / 2));
  });
  const curtain = (side: 1 | -1) => {
    const C = (f: number) => X(side > 0 ? f : 1 - f);
    g.beginPath();
    g.moveTo(C(0.04), Y(1));
    g.lineTo(C(0.3), Y(1));
    g.quadraticCurveTo(C(0.26), Y(0.6), C(0.15), Y(0.42));
    g.quadraticCurveTo(C(0.2), Y(0.25), C(0.24), Y(0.08));
    g.lineTo(C(0.02), Y(0.08));
    g.quadraticCurveTo(C(0.1), Y(0.3), C(0.08), Y(0.42));
    g.quadraticCurveTo(C(0.02), Y(0.7), C(0.04), Y(1));
    g.fill();
  };
  curtain(1);
  curtain(-1);
}

function pane(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The light through the window's glass, brighter at the top, with rain running down it as darker streaks.
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0.6)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineCap = 'round';
  g.lineWidth = Math.max(1, w * 0.012);
  // Fixed streaks (no randomness: the same every load), each a short slanted run with a drop at its foot.
  for (let i = 0; i < 26; i++) {
    const u = (i * 0.618034) % 1,
      v = (i * 0.381966 + 0.13 * (i % 3)) % 1;
    const len = 0.08 + 0.1 * ((i * 0.7548) % 1);
    g.beginPath();
    g.moveTo(u * w, v * h);
    g.lineTo((u - 0.015) * w, (v + len) * h);
    g.stroke();
  }
  g.restore();
}

function box(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A moving box, its top flaps open, the tape down its front cut as a thin line.
  g.fillRect(0, h * 0.16, w, h * 0.84);
  g.beginPath();
  g.moveTo(w * 0.02, h * 0.17);
  g.lineTo(w * 0.47, h * 0.17);
  g.lineTo(w * 0.36, h * 0.02);
  g.lineTo(-w * 0.02, h * 0.1);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.53, h * 0.17);
  g.lineTo(w * 0.98, h * 0.17);
  g.lineTo(w * 1.0, h * 0.06);
  g.lineTo(w * 0.66, 0);
  g.closePath();
  g.fill();
  cut(g, () => {
    g.fillRect(w * 0.49, h * 0.22, Math.max(1, w * 0.025), h * 0.3);
    g.fillRect(w * 0.08, h * 0.2, w * 0.84, Math.max(1, h * 0.02));
  });
}

function blanket(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A blanket pulled over a small kid sitting with his knees up: a heap, its peak over his head (a little forward of the
  // middle), sloping to his back and down over his knees to the floor, its hem rippling, and a fold cut in.
  g.beginPath();
  g.moveTo(0, h);
  g.bezierCurveTo(w * 0.02, h * 0.55, w * 0.18, h * 0.1, w * 0.52, h * 0.02);
  g.bezierCurveTo(w * 0.78, -h * 0.02, w * 0.86, h * 0.3, w * 0.84, h * 0.45);
  g.bezierCurveTo(w * 0.98, h * 0.55, w * 1.0, h * 0.8, w * 0.99, h);
  // The hem, rippling back from front to back along the floor.
  for (let i = 1; i <= 6; i++) {
    const u0 = 0.99 - ((i - 1) * 0.99) / 6,
      u1 = 0.99 - (i * 0.99) / 6;
    g.quadraticCurveTo(((u0 + u1) / 2) * w, h * (i % 2 ? 0.95 : 1.02), u1 * w, h);
  }
  g.closePath();
  g.fill();
  cut(g, () => {
    g.lineWidth = Math.max(1, w * 0.018);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.4, h * 0.22);
    g.quadraticCurveTo(w * 0.3, h * 0.55, w * 0.36, h * 0.86);
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.72, h * 0.5);
    g.quadraticCurveTo(w * 0.66, h * 0.7, w * 0.72, h * 0.9);
    g.stroke();
  });
}

function beam(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A torch's beam: from its lens (the left, in the middle) spreading out to the right, brightest near the torch and fading.
  const grad = g.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, h * 0.44);
  g.quadraticCurveTo(w * 0.6, h * 0.12, w, 0);
  g.lineTo(w, h);
  g.quadraticCurveTo(w * 0.6, h * 0.88, 0, h * 0.56);
  g.closePath();
  g.fill();
}

function doorLight(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A door left ajar (scene 2's hush): a thin upright line of light, soft at its sides and fading towards the top, and at its
  // foot a faint wedge of light thrown across the floor towards the left, into the room.
  const foot = h * 0.88;
  const line = g.createLinearGradient(0, 0, w, 0);
  line.addColorStop(0.6, 'rgba(255,255,255,0)');
  line.addColorStop(0.8, 'rgba(255,255,255,1)');
  line.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = line;
  g.fillRect(w * 0.6, 0, w * 0.4, foot);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const top = g.createLinearGradient(0, 0, 0, foot);
  top.addColorStop(0, 'rgba(0,0,0,0.85)');
  top.addColorStop(0.4, 'rgba(0,0,0,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, w, foot);
  g.restore();
  const floor = g.createLinearGradient(w, 0, 0, 0);
  floor.addColorStop(0, 'rgba(255,255,255,0.55)');
  floor.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = floor;
  g.beginPath();
  g.moveTo(w * 0.86, foot);
  g.lineTo(w * 0.74, foot);
  g.lineTo(0, h);
  g.lineTo(w, h);
  g.closePath();
  g.fill();
}

// The friend's hands (docs/STORY.md, "How a memory starts"): the shadow a child's hand casts making each shape, painted the way
// the old shadow-puppet plates draw them, so it reads at once. The fingers that move (a rabbit's ears) are parts of their own.

/** Strokes a finger: a round-ended band through the points (fractions of w, h), `width` a fraction of w. */
function finger(g: CanvasRenderingContext2D, w: number, h: number, pts: readonly number[], width: number): void {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = width * w;
  g.strokeStyle = g.fillStyle;
  g.beginPath();
  g.moveTo(pts[0] * w, pts[1] * h);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * w, pts[i + 1] * h);
  g.stroke();
  g.restore();
}

function friendRabbit(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A hand side on, facing right, the forearm rising into it from the lower left (the hand itself: friendRabbitHand).
  // The forearm, a child's: wrist narrower than the arm below it.
  g.beginPath();
  g.moveTo(0.02 * w, h);
  g.quadraticCurveTo(0.14 * w, 0.78 * h, 0.22 * w, 0.52 * h);
  g.lineTo(0.47 * w, 0.6 * h);
  g.quadraticCurveTo(0.36 * w, 0.8 * h, 0.34 * w, h);
  g.closePath();
  g.fill();
  friendRabbitHand(g, w, h);
}

function friendRabbitHand(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The rabbit hand without its forearm: the back of the hand is the back of the rabbit's head, the ring and little fingers
  // curled under it are its cheek and jaw, and the thumb laid along them to their tips is the top of its muzzle; the gap the
  // thumb leaves above the curled fingers is its eye. (The ears, the index and middle fingers, are parts of their own:
  // 'friend-ear'.)
  const e = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    g.beginPath();
    g.ellipse(x * w, y * h, rx * w, ry * h, rot, 0, Math.PI * 2);
    g.fill();
  };
  // The back of the hand: the head, round.
  e(0.42, 0.42, 0.22, 0.19, -0.2);
  // The knuckles along its top, under the ears.
  e(0.46, 0.27, 0.1, 0.07, -0.3);
  // The curled ring and little fingers: two knuckled bands from the palm forward, the cheek and jaw.
  finger(g, w, h, [0.44, 0.5, 0.58, 0.53, 0.68, 0.5, 0.72, 0.45], 0.11);
  finger(g, w, h, [0.42, 0.57, 0.54, 0.61, 0.63, 0.59, 0.66, 0.54], 0.1);
  // The thumb, from its root at the back of the head along the top of the muzzle to meet the fingertips: the nose.
  finger(g, w, h, [0.34, 0.36, 0.52, 0.31, 0.68, 0.35, 0.76, 0.41], 0.095);
  e(0.76, 0.44, 0.055, 0.05);
  cut(g, () => {
    // The eye: the gap the thumb leaves above the curled fingers, round.
    e(0.58, 0.41, 0.036, 0.033);
  });
}

function friendEar(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A finger standing up from its knuckle (the bottom) as a rabbit's ear: a little wider in the middle, a round tip.
  g.beginPath();
  g.moveTo(0.18 * w, h);
  g.quadraticCurveTo(0.02 * w, 0.5 * h, 0.14 * w, 0.12 * h);
  g.quadraticCurveTo(0.5 * w, -0.06 * h, 0.86 * w, 0.12 * h);
  g.quadraticCurveTo(0.98 * w, 0.5 * h, 0.82 * w, h);
  g.closePath();
  g.fill();
}

function friendFox(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A hand side on, facing right, the forearm rising into it from the lower left (the hand itself: friendFoxHand).
  // The forearm, a child's: wrist narrower than the arm below it.
  g.beginPath();
  g.moveTo(0.02 * w, h);
  g.quadraticCurveTo(0.12 * w, 0.78 * h, 0.2 * w, 0.54 * h);
  g.lineTo(0.42 * w, 0.62 * h);
  g.quadraticCurveTo(0.33 * w, 0.8 * h, 0.32 * w, h);
  g.closePath();
  g.fill();
  friendFoxHand(g, w, h);
}

function friendFoxHand(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The fox hand without its forearm: the back of the hand is the fox's head, the middle and ring fingers laid straight
  // forward to meet the thumb's tip are its long pointed snout, and the thumb under them its jaw; the gap the thumb leaves
  // under the fingers' root is its eye. (The ears, the index and little fingers standing up, are parts of their own:
  // 'friend-ear'.)
  const e = (x: number, y: number, rx: number, ry: number, rot = 0) => {
    g.beginPath();
    g.ellipse(x * w, y * h, rx * w, ry * h, rot, 0, Math.PI * 2);
    g.fill();
  };
  // The back of the hand: the head.
  e(0.36, 0.44, 0.19, 0.17, -0.2);
  e(0.4, 0.3, 0.09, 0.06, -0.3);
  // The two fingers straight forward, tapering to the snout's tip.
  finger(g, w, h, [0.42, 0.36, 0.66, 0.39, 0.92, 0.45], 0.1);
  finger(g, w, h, [0.42, 0.43, 0.68, 0.45, 0.9, 0.48], 0.08);
  // The thumb under them, the jaw, its tip meeting theirs.
  finger(g, w, h, [0.38, 0.55, 0.6, 0.56, 0.86, 0.51], 0.085);
  cut(g, () => {
    // The eye: the gap the thumb leaves under the fingers' root, round.
    e(0.5, 0.47, 0.03, 0.026);
  });
}

// Scenes 3 to 5: the kids standing (running in the park, walking to school), the park's trees and grass, the hill of fireflies
// and its jar, the school gate and the autumn leaves.

/** Fills an ellipse given in fractions of w, h. */
function blob(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rot = 0,
) {
  g.beginPath();
  g.ellipse(x * w, y * h, rx * w, ry * h, rot, 0, Math.PI * 2);
  g.fill();
}

function kidTorso(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A small kid's body standing, side on, facing right: round shoulders, a jumper to the hips, and shorts at the bottom.
  g.beginPath();
  g.moveTo(w * 0.22, h);
  g.lineTo(w * 0.16, h * 0.4);
  g.quadraticCurveTo(w * 0.14, h * 0.04, w * 0.46, h * 0.02);
  g.quadraticCurveTo(w * 0.84, h * 0.02, w * 0.84, h * 0.36);
  g.quadraticCurveTo(w * 0.9, h * 0.6, w * 0.82, h);
  g.closePath();
  g.fill();
}

function girlTorso(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The friend standing, side on, facing right: the same shoulders as the boy's, in a dress whose skirt flares out from the
  // waist to a hem over her knees (the bottom DRESS_EXTRA_H of the part hangs below where the boy's jumper ends).
  const body = 1 / DRESS_W_RATIO; // the boy's torso's width, as a fraction of this one
  const top = 0.1 / (0.1 + DRESS_EXTRA_H); // the boy's torso's height, as a fraction of this one
  const X = (f: number) => w * (0.5 + (f - 0.5) * body);
  const Y = (f: number) => h * f * top;
  g.beginPath();
  g.moveTo(X(0.2), Y(0.62));
  g.lineTo(X(0.16), Y(0.4));
  g.quadraticCurveTo(X(0.14), Y(0.04), X(0.46), Y(0.02));
  g.quadraticCurveTo(X(0.84), Y(0.02), X(0.84), Y(0.36));
  g.lineTo(X(0.8), Y(0.62));
  // The skirt: out to a wide hem, a gentle wave along it.
  g.quadraticCurveTo(w * 0.94, h * 0.8, w * 1.0, h);
  g.quadraticCurveTo(w * 0.75, h * 0.95, w * 0.5, h);
  g.quadraticCurveTo(w * 0.25, h * 0.95, 0, h);
  g.quadraticCurveTo(w * 0.06, h * 0.8, X(0.2), Y(0.62));
  g.closePath();
  g.fill();
}

function leafyTree(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A park tree in leaf: a trunk that forks, and a round crown of clumps over it, with a few gaps for the light.
  g.beginPath();
  g.moveTo(w * 0.44, h);
  g.quadraticCurveTo(w * 0.47, h * 0.7, w * 0.4, h * 0.45);
  g.lineTo(w * 0.47, h * 0.47);
  g.lineTo(w * 0.52, h * 0.38);
  g.lineTo(w * 0.56, h * 0.48);
  g.lineTo(w * 0.62, h * 0.44);
  g.quadraticCurveTo(w * 0.54, h * 0.7, w * 0.57, h);
  g.closePath();
  g.fill();
  const clumps: readonly (readonly [number, number, number, number])[] = [
    [0.5, 0.26, 0.3, 0.2],
    [0.28, 0.36, 0.2, 0.14],
    [0.72, 0.36, 0.22, 0.14],
    [0.38, 0.16, 0.18, 0.13],
    [0.64, 0.15, 0.18, 0.13],
    [0.5, 0.08, 0.16, 0.08],
    [0.18, 0.42, 0.12, 0.08],
    [0.84, 0.43, 0.12, 0.08],
  ];
  for (const [x, y, rx, ry] of clumps) blob(g, w, h, x, y, rx, ry);
  cut(g, () => {
    blob(g, w, h, 0.36, 0.3, 0.035, 0.025);
    blob(g, w, h, 0.66, 0.24, 0.03, 0.02);
    blob(g, w, h, 0.56, 0.4, 0.025, 0.02);
  });
}

function grass(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A strip of ground with tufts of long grass along its top edge (the top third is the grass).
  const ground = h * 0.3;
  g.fillRect(0, ground, w, h - ground);
  for (let i = 0; i < 90; i++) {
    const u = (i + 0.5) / 90 + 0.004 * Math.sin(i * 7.3);
    const tall = 0.5 + 0.5 * Math.abs(Math.sin(i * 2.17));
    g.beginPath();
    g.moveTo(u * w - w * 0.004, ground + 1);
    g.lineTo(u * w + w * 0.003 * Math.sin(i), ground * (1 - tall));
    g.lineTo(u * w + w * 0.004, ground + 1);
    g.fill();
  }
}

function hill(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A long low hill: its round top in the middle (a seat for two), falling away gently to both sides, grass along the crest.
  const top = (u: number) => 0.06 + 0.86 * Math.exp(-(((u - 0.5) / 0.3) ** 2));
  g.beginPath();
  g.moveTo(0, h);
  for (let i = 0; i <= 120; i++) {
    const u = i / 120;
    g.lineTo(u * w, (1 - top(u)) * h);
  }
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  for (let i = 0; i < 70; i++) {
    const u = (i + 0.5) / 70;
    const y = (1 - top(u)) * h;
    const tall = h * (0.04 + 0.03 * Math.abs(Math.sin(i * 3.1)));
    g.beginPath();
    g.moveTo(u * w - 2, y + 2);
    g.lineTo(u * w + 1.5 * Math.sin(i * 1.7), y - tall);
    g.lineTo(u * w + 2, y + 2);
    g.fill();
  }
}

function jar(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A glass jar: a rim, a neck and a round-shouldered body. The glass lets most of the light through, so only its edges and its
  // rim cast a full shadow.
  g.beginPath();
  g.moveTo(w * 0.2, h * 0.24);
  g.quadraticCurveTo(w * 0.04, h * 0.3, w * 0.06, h * 0.5);
  g.lineTo(w * 0.08, h * 0.92);
  g.quadraticCurveTo(w * 0.1, h, w * 0.24, h);
  g.lineTo(w * 0.76, h);
  g.quadraticCurveTo(w * 0.9, h, w * 0.92, h * 0.92);
  g.lineTo(w * 0.94, h * 0.5);
  g.quadraticCurveTo(w * 0.96, h * 0.3, w * 0.8, h * 0.24);
  g.lineTo(w * 0.8, h * 0.1);
  g.lineTo(w * 0.2, h * 0.1);
  g.closePath();
  g.fill();
  g.fillRect(w * 0.14, 0, w * 0.72, h * 0.1);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = 0.72;
  g.beginPath();
  g.moveTo(w * 0.24, h * 0.32);
  g.quadraticCurveTo(w * 0.14, h * 0.38, w * 0.15, h * 0.52);
  g.lineTo(w * 0.17, h * 0.88);
  g.lineTo(w * 0.83, h * 0.88);
  g.lineTo(w * 0.85, h * 0.52);
  g.quadraticCurveTo(w * 0.86, h * 0.38, w * 0.76, h * 0.32);
  g.closePath();
  g.fill();
  g.restore();
}

function schoolGate(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A school's gate: two brick pillars with caps and lamps, railings between them running off to the sides, and the gate
  // itself standing open in the middle under an arch of iron with a plain plate hanging from it.
  const X = (f: number) => f * w,
    Y = (f: number) => (1 - f) * h; // f up from the bottom
  const pillar = (cx: number) => {
    g.fillRect(X(cx - 0.035), Y(0.62), X(0.07), Y(0) - Y(0.62));
    g.fillRect(X(cx - 0.045), Y(0.66), X(0.09), Y(0.62) - Y(0.66));
    blob(g, w, h, cx, 1 - 0.7, 0.025, 0.04);
  };
  // Railings, low, out to both sides: a rail top and bottom and spiked bars between.
  const rails = (x0: number, x1: number) => {
    g.fillRect(X(x0), Y(0.36), X(x1 - x0), Y(0.34) - Y(0.36));
    g.fillRect(X(x0), Y(0.06), X(x1 - x0), Y(0.04) - Y(0.06));
    for (let x = x0 + 0.012; x < x1; x += 0.028) {
      g.fillRect(X(x), Y(0.4), Math.max(1, X(0.007)), Y(0) - Y(0.4));
      g.beginPath();
      g.moveTo(X(x - 0.006), Y(0.4));
      g.lineTo(X(x + 0.0035), Y(0.44));
      g.lineTo(X(x + 0.013), Y(0.4));
      g.fill();
    }
  };
  rails(0, 0.31);
  rails(0.69, 1);
  pillar(0.31);
  pillar(0.69);
  g.save();
  g.strokeStyle = '#fff';
  g.lineWidth = X(0.012);
  g.beginPath();
  g.moveTo(X(0.345), Y(0.6));
  g.quadraticCurveTo(X(0.5), Y(0.9), X(0.655), Y(0.6));
  g.stroke();
  g.lineWidth = X(0.006);
  g.beginPath();
  g.moveTo(X(0.345), Y(0.56));
  g.quadraticCurveTo(X(0.5), Y(0.82), X(0.655), Y(0.56));
  g.stroke();
  g.restore();
  g.fillRect(X(0.44), Y(0.76), X(0.12), Y(0.7) - Y(0.76));
  // The two gates, swung open, seen edge on as narrow panels of bars by the pillars.
  for (const x0 of [0.35, 0.6]) {
    g.fillRect(X(x0), Y(0.5), X(0.05), Y(0.48) - Y(0.5));
    g.fillRect(X(x0), Y(0.06), X(0.05), Y(0.04) - Y(0.06));
    for (let k = 0; k < 4; k++) g.fillRect(X(x0 + 0.004 + k * 0.014), Y(0.5), Math.max(1, X(0.005)), Y(0.04) - Y(0.5));
  }
}

function leaf(g: CanvasRenderingContext2D, w: number, h: number): void {
  // An autumn leaf: a pointed oval with a stalk.
  g.beginPath();
  g.moveTo(w * 0.5, 0);
  g.quadraticCurveTo(w * 1.0, h * 0.4, w * 0.5, h * 0.86);
  g.quadraticCurveTo(0, h * 0.4, w * 0.5, 0);
  g.fill();
  g.fillRect(w * 0.46, h * 0.8, w * 0.08, h * 0.2);
}

function autumnTree(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A tree losing its leaves: the bare tree with a few clumps still on its branches.
  tree(g, w, h);
  for (const [x, y, r] of [
    [0.3, 0.3, 0.09],
    [0.62, 0.22, 0.1],
    [0.45, 0.14, 0.08],
    [0.75, 0.38, 0.07],
    [0.22, 0.45, 0.06],
  ] as const)
    blob(g, w, h, x, y, r, (r * w) / h);
}

// The friend's hands for scenes 4 to 6: a cupped hand, and a flat hand held up (to wave, and to meet the player's).

function friendCup(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A hand held palm up and cupped, side on, the forearm rising into it from the lower left: the heel of the hand and the thumb
  // standing up at the left, the hollow of the palm, and the base of the fingers at the right (the fingers that curl up are a
  // part of their own: 'friend-ear'). The hand itself, without the forearm: friendCupHand.
  g.beginPath();
  g.moveTo(0.0 * w, h);
  g.quadraticCurveTo(0.16 * w, 0.82 * h, 0.26 * w, 0.66 * h);
  g.lineTo(0.42 * w, 0.76 * h);
  g.quadraticCurveTo(0.3 * w, 0.88 * h, 0.3 * w, h);
  g.closePath();
  g.fill();
  friendCupHand(g, w, h);
}

function friendCupHand(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The cupped hand without its forearm: the bowl of the palm and the thumb standing up at its near side.
  // The palm: a bowl, its top hollowed.
  g.beginPath();
  g.moveTo(0.22 * w, 0.5 * h);
  g.quadraticCurveTo(0.44 * w, 0.66 * h, 0.72 * w, 0.52 * h);
  g.lineTo(0.8 * w, 0.56 * h);
  g.quadraticCurveTo(0.74 * w, 0.78 * h, 0.46 * w, 0.8 * h);
  g.quadraticCurveTo(0.24 * w, 0.78 * h, 0.2 * w, 0.62 * h);
  g.closePath();
  g.fill();
  // The thumb, standing up at the near side: the hollow's other wall.
  finger(g, w, h, [0.24, 0.58, 0.22, 0.44, 0.26, 0.34], 0.085);
}

function friendArm(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The rest of the friend's arm below the painted hands' forearms: a child's forearm, narrow at the top where it joins the
  // wrist's end and filling out a little towards the elbow, which is off the bottom of the wall.
  g.beginPath();
  g.moveTo(0.12 * w, 0);
  g.quadraticCurveTo(0.0 * w, 0.55 * h, 0.03 * w, h);
  g.lineTo(0.97 * w, h);
  g.quadraticCurveTo(w, 0.55 * h, 0.88 * w, 0);
  g.closePath();
  g.fill();
}

function friendPalm(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A small hand held up flat, its palm to the light: the wrist and forearm below, the palm, and four fingers together standing
  // up from it. The thumb is a part of its own ('friend-ear'). The hand itself, without the forearm: friendPalmHand.
  g.beginPath();
  g.moveTo(0.3 * w, h);
  g.lineTo(0.32 * w, 0.66 * h);
  g.lineTo(0.68 * w, 0.66 * h);
  g.lineTo(0.7 * w, h);
  g.closePath();
  g.fill();
  friendPalmHand(g, w, h);
}

function friendPalmHand(g: CanvasRenderingContext2D, w: number, h: number): void {
  // The flat hand without its forearm: the palm, its heel rounded off where the wrist would go, and the four fingers.
  g.beginPath();
  g.moveTo(0.32 * w, 0.66 * h);
  g.quadraticCurveTo(0.22 * w, 0.56 * h, 0.24 * w, 0.42 * h);
  g.lineTo(0.76 * w, 0.42 * h);
  g.quadraticCurveTo(0.8 * w, 0.58 * h, 0.68 * w, 0.66 * h);
  g.quadraticCurveTo(0.5 * w, 0.72 * h, 0.32 * w, 0.66 * h);
  g.closePath();
  g.fill();
  const fingers: readonly (readonly [number, number])[] = [
    [0.3, 0.17],
    [0.43, 0.06],
    [0.56, 0.05],
    [0.69, 0.13],
  ];
  for (const [x, top] of fingers) finger(g, w, h, [x, 0.46, x + (x - 0.5) * 0.08, top + 0.04], 0.125);
}

function sideHand(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A small flat hand held up, seen side on, its palm to the right (the goodbye: two of these pressed palm to palm). The wrist
  // and forearm below, the narrow edge of the palm, the fingers together standing up from it, their tips leaning a little
  // forward, and the thumb lying along the palm's face.
  g.beginPath();
  g.moveTo(0.22 * w, h);
  g.quadraticCurveTo(0.2 * w, 0.75 * h, 0.24 * w, 0.6 * h);
  g.quadraticCurveTo(0.26 * w, 0.48 * h, 0.3 * w, 0.4 * h);
  g.lineTo(0.84 * w, 0.4 * h);
  g.quadraticCurveTo(0.9 * w, 0.55 * h, 0.82 * w, 0.66 * h);
  g.quadraticCurveTo(0.76 * w, 0.8 * h, 0.78 * w, h);
  g.closePath();
  g.fill();
  // The fingers, together: one band, rounded at the top.
  finger(g, w, h, [0.56, 0.44, 0.58, 0.2, 0.62, 0.07], 0.5);
  // The thumb, along the palm's face, its tip up.
  finger(g, w, h, [0.74, 0.62, 0.84, 0.47, 0.86, 0.4], 0.2);
}

// The shape guide's outlines (ghost-outline.ts, OUTLINE_SHAPES in friend-puppet.ts): each shape as the plainest hand that
// makes it, the way the recogniser reads it (shape-ranges.ts), not her shadow-puppet hand. Only the hand, no arm.

function outlineRabbit(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A V seen from the back of the hand: two fingers up and apart (the ears), the others folded into a round palm below.
  g.beginPath();
  g.moveTo(0.16 * w, 0.62 * h);
  g.quadraticCurveTo(0.14 * w, 0.5 * h, 0.3 * w, 0.5 * h);
  g.lineTo(0.74 * w, 0.5 * h);
  g.quadraticCurveTo(0.88 * w, 0.52 * h, 0.86 * w, 0.66 * h);
  g.quadraticCurveTo(0.86 * w, 0.9 * h, 0.5 * w, 0.9 * h);
  g.quadraticCurveTo(0.18 * w, 0.9 * h, 0.16 * w, 0.62 * h);
  g.closePath();
  g.fill();
  finger(g, w, h, [0.4, 0.56, 0.32, 0.26, 0.26, 0.08], 0.2);
  finger(g, w, h, [0.6, 0.56, 0.68, 0.26, 0.74, 0.08], 0.2);
}

function outlineFox(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A flat hand side on, fingers together pointing right (the snout), the thumb standing up behind them (the ear).
  g.beginPath();
  g.moveTo(0.06 * w, 0.64 * h);
  g.quadraticCurveTo(0.06 * w, 0.4 * h, 0.26 * w, 0.4 * h);
  g.lineTo(0.84 * w, 0.46 * h);
  g.quadraticCurveTo(0.98 * w, 0.5 * h, 0.96 * w, 0.62 * h);
  g.quadraticCurveTo(0.94 * w, 0.72 * h, 0.8 * w, 0.74 * h);
  g.lineTo(0.3 * w, 0.92 * h);
  g.quadraticCurveTo(0.06 * w, 0.9 * h, 0.06 * w, 0.64 * h);
  g.closePath();
  g.fill();
  finger(g, w, h, [0.24, 0.5, 0.27, 0.26, 0.3, 0.15], 0.13);
}

function outlineCup(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A hand held palm up and cupped: the bowl, the thumb up at one side and the fingers curled up at the other.
  g.beginPath();
  g.moveTo(0.14 * w, 0.4 * h);
  g.quadraticCurveTo(0.16 * w, 0.9 * h, 0.5 * w, 0.9 * h);
  g.quadraticCurveTo(0.84 * w, 0.9 * h, 0.86 * w, 0.4 * h);
  g.lineTo(0.74 * w, 0.4 * h);
  g.quadraticCurveTo(0.7 * w, 0.64 * h, 0.5 * w, 0.64 * h);
  g.quadraticCurveTo(0.3 * w, 0.64 * h, 0.26 * w, 0.4 * h);
  g.closePath();
  g.fill();
  // The rims, rounded: the thumb's tip at one side, the fingertips at the other.
  finger(g, w, h, [0.2, 0.42, 0.2, 0.36], 0.12);
  finger(g, w, h, [0.8, 0.42, 0.8, 0.34], 0.12);
}

function outlineFlat(g: CanvasRenderingContext2D, w: number, h: number): void {
  // A hand held up flat: the palm, the fingers together, the thumb a little out at its side.
  friendPalmHand(g, w, h);
  finger(g, w, h, [0.3, 0.6, 0.2, 0.48, 0.16, 0.4], 0.16);
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
  rabbit,
  fox,
  kid,
  'kid-head': kidHead,
  arm,
  fort,
  torch,
  lump,
  'friend-rabbit': friendRabbit,
  'friend-ear': friendEar,
  'friend-fox': friendFox,
  'kid-torso': kidTorso,
  'girl-head': girlHead,
  ponytail,
  'girl-torso': girlTorso,
  'leafy-tree': leafyTree,
  grass,
  hill,
  jar,
  'school-gate': schoolGate,
  leaf,
  'autumn-tree': autumnTree,
  'friend-cup': friendCup,
  'friend-palm': friendPalm,
  'friend-arm': friendArm,
  'side-hand': sideHand,
  window: window_,
  pane,
  box,
  blanket,
  beam,
  'door-light': doorLight,
  'outline-rabbit': outlineRabbit,
  'outline-fox': outlineFox,
  'outline-cup': outlineCup,
  'outline-flat': outlineFlat,
};

/** Whether a part's art names an image file rather than a painted cut-out. */
export function isImageArt(art: string): boolean {
  return /\.(png|webp|jpe?g|gif|svg)(\?.*)?$/i.test(art);
}
