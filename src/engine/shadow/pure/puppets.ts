// The shadow puppets a cutscene can name: each is a few SVG paths in a box (the same bird as the title screen), drawn
// black. The view turns them into textures once, when a cutscene loads. Plain data.

export interface PuppetArt {
  /** The drawing's own coordinate box, as an SVG viewBox: x, y, width, height. */
  readonly box: readonly [number, number, number, number];
  readonly paths: readonly string[];
}

export const PUPPETS: Readonly<Record<string, PuppetArt>> = {
  bird: {
    box: [-130, -110, 252, 156],
    paths: [
      'M-62 18C-32 -8 20 -12 52 -2C60 -18 78 -22 88 -12L116 -8L90 2C84 14 70 20 52 22C20 36 -30 38 -62 18ZM-62 18L-108 4L-100 26Z',
      'M-8 -4C-30 -54 -72 -84 -124 -94C-102 -62 -92 -30 -58 -2Z',
      'M12 -4C22 -52 52 -88 94 -104C84 -68 72 -34 52 -2Z',
    ],
  },
};

/** Puppet names a cutscene may use. */
export function hasPuppet(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(PUPPETS, name);
}
