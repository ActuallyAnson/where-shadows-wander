// Silhouettes for the bedroom's props, drawn in code: a stack of books, a toy block, a teacup with steam and a toy castle.
// The props are invisible in the room; only their shadows are, and a shadow reads as an object only if its outline does.
// Each painter fills a box in black with a few light details cut out of it (spines, a star, a window), at any size. The
// sprite or prop-shadow view that wants a richer outline than a rectangle uses a painter as the shadow's texture.

export type PropName = 'books' | 'block' | 'teacup' | 'castle';
export const PROP_NAMES: readonly PropName[] = ['books', 'block', 'teacup', 'castle'];
/** Each drawing's width over its height. */
export const PROP_ASPECT: Readonly<Record<PropName, number>> = { books: 1.1, block: 1.1, teacup: 1.1, castle: 1.1 };

function cut(g: CanvasRenderingContext2D, draw: () => void): void {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  draw();
  g.restore();
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A leaning stack of three books with their spines and page edges cut out. */
function books(g: CanvasRenderingContext2D): void {
  const shelf = [
    { x: 10, y: 210, w: 270, h: 54, tilt: 0 },
    { x: 34, y: 150, w: 226, h: 52, tilt: -0.04 },
    { x: 20, y: 92, w: 200, h: 50, tilt: 0.05 },
  ];
  g.fillStyle = '#000';
  for (const b of shelf) {
    g.save();
    g.translate(b.x + b.w / 2, b.y + b.h / 2);
    g.rotate(b.tilt);
    rrect(g, -b.w / 2, -b.h / 2, b.w, b.h, 8);
    g.fill();
    cut(g, () => {
      g.lineWidth = 3;
      g.strokeStyle = '#000';
      g.beginPath();
      g.moveTo(-b.w / 2 + 16, -b.h / 2 + 8); // the spine's edge
      g.lineTo(-b.w / 2 + 16, b.h / 2 - 8);
      g.moveTo(b.w / 2 - 14, -b.h / 2 + 12); // the pages' edge
      g.lineTo(b.w / 2 - 14, b.h / 2 - 12);
      g.stroke();
      g.fillStyle = '#000';
      g.fillRect(-b.w / 2 + 34, -4, 46, 8); // a title plate
    });
    g.restore();
  }
}

/** A toy block with a star cut out of its face. */
function block(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#000';
  rrect(g, 24, 40, 212, 212, 18);
  g.fill();
  cut(g, () => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 58 : 26;
      g.lineTo(130 + Math.cos(a) * r, 146 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
}

/** A cup on a saucer with a curl of steam, and a handle with a hole in it. */
function teacup(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(150, 246, 120, 18, 0, 0, Math.PI * 2); // the saucer
  g.fill();
  g.beginPath(); // the cup
  g.moveTo(60, 120);
  g.lineTo(240, 120);
  g.quadraticCurveTo(236, 220, 150, 232);
  g.quadraticCurveTo(64, 220, 60, 120);
  g.closePath();
  g.fill();
  g.lineWidth = 20; // the handle
  g.strokeStyle = '#000';
  g.beginPath();
  g.ellipse(250, 160, 28, 38, 0, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.lineWidth = 10; // steam
  g.lineCap = 'round';
  for (const [x, ph] of [
    [118, 0],
    [170, 1.4],
  ] as const) {
    g.beginPath();
    for (let t = 0; t <= 1; t += 0.1) g.lineTo(x + Math.sin(t * 6 + ph) * 12, 108 - t * 90);
    g.stroke();
  }
  cut(g, () => {
    g.beginPath();
    g.ellipse(150, 124, 76, 8, 0, 0, Math.PI * 2); // the dark rim of tea
    g.fill();
  });
}

/** A toy castle: two towers with battlements, a gate with an arch, a flag and a few windows. */
function castle(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#000';
  const tower = (x: number, w: number, top: number) => {
    g.fillRect(x, top, w, 252 - top);
    const n = 4;
    const step = w / (n * 2 - 1);
    for (let i = 0; i < n; i++) g.fillRect(x + i * 2 * step, top - 18, step, 20);
  };
  tower(14, 74, 76);
  tower(212, 74, 76);
  g.fillRect(80, 118, 140, 134); // the keep
  const n = 6;
  const step = 140 / (n * 2 - 1);
  for (let i = 0; i < n; i++) g.fillRect(80 + i * 2 * step, 100, step, 20);
  g.beginPath(); // a flag on a pole
  g.moveTo(150, 100);
  g.lineTo(150, 40);
  g.lineTo(196, 56);
  g.lineTo(150, 72);
  g.lineWidth = 6;
  g.strokeStyle = '#000';
  g.stroke();
  g.fill();
  cut(g, () => {
    g.beginPath(); // the gate
    g.moveTo(124, 252);
    g.lineTo(124, 190);
    g.arc(150, 190, 26, Math.PI, 0);
    g.lineTo(176, 252);
    g.closePath();
    g.fill();
    for (const [x, y] of [
      [40, 120],
      [238, 120],
      [104, 150],
      [182, 150],
    ]) {
      rrect(g, x, y, 14, 26, 6);
      g.fill();
    }
  });
}

const PAINTERS: Readonly<Record<PropName, (g: CanvasRenderingContext2D) => void>> = { books, block, teacup, castle };

/** Paints a prop's silhouette to fill a w x h canvas (its own 300 x (300 / aspect) box scaled to fit), on transparent. */
export function paintProp(g: CanvasRenderingContext2D, w: number, h: number, name: PropName): void {
  g.clearRect(0, 0, w, h);
  g.save();
  g.scale(w / 300, h / (300 / PROP_ASPECT[name]));
  g.lineJoin = 'round';
  PAINTERS[name](g);
  g.restore();
}
