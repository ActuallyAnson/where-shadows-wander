// The bedroom's layout: where each static piece of the room stands, read from a data file (content/rooms/bedroom.json)
// so the room can be arranged in the dev room editor (?mock=1&edit=room) rather than by editing numbers in code.
//
// A layout has two sections, each a map from a piece's id to its placement:
//   room  room space: x right, y up from the floor, -z toward the wall the shadows play on (the player sits at the origin).
//   lap   the bed tray and what is on the lap, in the tray's own space; `anchor` places the tray relative to the head.
// A placement is a position (metres), a rotation (degrees, applied x then y then z, as three.js's default Euler order)
// and a scale (a multiplier on the piece's own size, so 1 is the size the code gives it).
//
// An entry may also name a `model`: the id of a .glb under src/assets (its file name in lower case with hyphens, as the asset
// manifest names it). Such an entry is an added piece: a model placed in the room editor rather than built by the code, so its
// id is free (`chair-2`) and need not be one the code knows. The built-in pieces never take a model.
//
// Anything missing from the file falls back to the code's own default, so a missing or broken file never breaks the room.
// Things placed at run time (the room's root, the wall ahead, the bunting on it) are not in the layout.
//
// Plain TypeScript: no IWSDK, no three.js, no browser globals. Reads untrusted JSON as `unknown` and never throws.

export type Vec3 = [number, number, number];

export interface Placement {
  /** Position, metres. */
  pos: Vec3;
  /** Rotation about x, y and z, degrees (Euler order XYZ). */
  rotDeg: Vec3;
  /** Scale on each axis, a multiplier on the piece's own size. */
  scale: Vec3;
}

export const LAYOUT_SECTIONS = ['room', 'lap'] as const;
export type LayoutSection = (typeof LAYOUT_SECTIONS)[number];

export const ROOM_LAYOUT_VERSION = 1;

/** One piece in a layout section: its placement, and for an added piece the asset it shows. */
export interface LayoutEntry extends Placement {
  /** The asset id of the .glb an added piece shows; absent for the code's own pieces. */
  model?: string;
}

export interface RoomLayout {
  version: typeof ROOM_LAYOUT_VERSION;
  room: Record<string, LayoutEntry>;
  lap: Record<string, LayoutEntry>;
}

export interface ParsedRoomLayout {
  layout: RoomLayout;
  /** Things that were skipped, each naming the piece; empty for a clean file. */
  problems: string[];
}

/** A piece id: lower case words joined by hyphens (`bed`, `hung-books`). Asset ids have the same form. */
export const PIECE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Rounding the file uses: 1 mm, 0.1°, and a thousandth of scale. */
const POS_STEP = 1000;
const ROT_STEP = 10;
const SCALE_STEP = 1000;

/** The smallest scale a piece may have (a zero or negative scale would turn it inside out or make it vanish). */
export const MIN_SCALE = 0.01;

/** A new placement (copies its arguments). Rotation defaults to none and scale to 1. */
export function placement(
  pos: Readonly<Vec3>,
  rotDeg: Readonly<Vec3> = [0, 0, 0],
  scale: Readonly<Vec3> = [1, 1, 1],
): Placement {
  return {
    pos: [pos[0], pos[1], pos[2]],
    rotDeg: [rotDeg[0], rotDeg[1], rotDeg[2]],
    scale: [scale[0], scale[1], scale[2]],
  };
}

export function copyPlacement(p: Readonly<Placement>): Placement {
  return placement(p.pos, p.rotDeg, p.scale);
}

export function emptyRoomLayout(): RoomLayout {
  return { version: ROOM_LAYOUT_VERSION, room: {}, lap: {} };
}

const round = (v: number, step: number): number => {
  const r = Math.round(v * step) / step;
  return r === 0 ? 0 : r; // no "-0" in the file
};
/** Wraps an angle into (-180, 180]. */
const wrapDeg = (d: number): number => {
  const w = d - 360 * Math.floor((d + 180) / 360);
  return w === -180 ? 180 : w;
};

/** The placement as the file stores it: rounded, angles wrapped into (-180, 180], scales at least MIN_SCALE. */
export function roundPlacement(p: Readonly<Placement>): Placement {
  return {
    pos: [round(p.pos[0], POS_STEP), round(p.pos[1], POS_STEP), round(p.pos[2], POS_STEP)],
    rotDeg: [
      round(wrapDeg(round(p.rotDeg[0], ROT_STEP)), ROT_STEP),
      round(wrapDeg(round(p.rotDeg[1], ROT_STEP)), ROT_STEP),
      round(wrapDeg(round(p.rotDeg[2], ROT_STEP)), ROT_STEP),
    ],
    scale: [
      round(Math.max(MIN_SCALE, p.scale[0]), SCALE_STEP),
      round(Math.max(MIN_SCALE, p.scale[1]), SCALE_STEP),
      round(Math.max(MIN_SCALE, p.scale[2]), SCALE_STEP),
    ],
  };
}

/** Whether two placements are the same once rounded as the file stores them. */
export function samePlacement(a: Readonly<Placement>, b: Readonly<Placement>): boolean {
  const ra = roundPlacement(a),
    rb = roundPlacement(b);
  for (let i = 0; i < 3; i++)
    if (ra.pos[i] !== rb.pos[i] || ra.rotDeg[i] !== rb.rotDeg[i] || ra.scale[i] !== rb.scale[i]) return false;
  return true;
}

/** The layout's placement for a piece, or `fallback` (the code's default) when the file has none. */
export function placementOr(
  layout: Readonly<RoomLayout> | null | undefined,
  section: LayoutSection,
  id: string,
  fallback: Readonly<Placement>,
): Placement {
  const p = layout && Object.prototype.hasOwnProperty.call(layout[section], id) ? layout[section][id] : undefined;
  return copyPlacement(p ?? fallback);
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isVec3 = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/**
 * Reads a layout file. Never throws: anything it cannot use is left out (so the code's default stands) and named in `problems`.
 * @param known the piece ids each section may hold; an id not listed is reported and left out. Omit to accept any id.
 */
export function parseRoomLayout(
  doc: unknown,
  known?: Partial<Record<LayoutSection, readonly string[]>>,
): ParsedRoomLayout {
  const layout = emptyRoomLayout();
  const problems: string[] = [];
  if (!isObj(doc)) {
    problems.push('the layout is not a JSON object');
    return { layout, problems };
  }
  if (doc.version !== ROOM_LAYOUT_VERSION)
    problems.push(`version is ${JSON.stringify(doc.version)}, expected ${ROOM_LAYOUT_VERSION}`);
  for (const key of Object.keys(doc))
    if (key !== 'version' && !(LAYOUT_SECTIONS as readonly string[]).includes(key))
      problems.push(`unknown section "${key}"`);
  for (const section of LAYOUT_SECTIONS) {
    const raw = doc[section];
    if (raw === undefined) continue;
    if (!isObj(raw)) {
      problems.push(`${section}: not an object`);
      continue;
    }
    const allowed = known?.[section];
    for (const [id, value] of Object.entries(raw)) {
      const where = `${section}.${id}`;
      if (!PIECE_ID.test(id)) {
        problems.push(`${where}: not a piece id (lower case words joined by hyphens)`);
        continue;
      }
      if (!isObj(value)) {
        problems.push(`${where}: not an object`);
        continue;
      }
      const builtIn = !allowed || allowed.includes(id);
      let model: string | undefined;
      if (value.model !== undefined) {
        if (typeof value.model !== 'string' || !PIECE_ID.test(value.model)) {
          problems.push(`${where}: model must be an asset id (lower case words joined by hyphens)`);
          if (!allowed || !allowed.includes(id)) continue;
        } else if (allowed && allowed.includes(id)) {
          problems.push(`${where}: a built-in piece cannot show a model; model "${value.model}" ignored`);
        } else model = value.model;
      }
      if (!builtIn && model === undefined) {
        if (value.model === undefined) problems.push(`${where}: no such piece`);
        continue;
      }
      const { pos, rotDeg = [0, 0, 0], scale = [1, 1, 1] } = value;
      if (!isVec3(pos)) {
        problems.push(`${where}: pos must be three numbers`);
        continue;
      }
      if (!isVec3(rotDeg)) {
        problems.push(`${where}: rotDeg must be three numbers`);
        continue;
      }
      if (!isVec3(scale) || scale.some((s) => s < MIN_SCALE)) {
        problems.push(`${where}: scale must be three numbers of at least ${MIN_SCALE}`);
        continue;
      }
      for (const k of Object.keys(value))
        if (k !== 'pos' && k !== 'rotDeg' && k !== 'scale' && k !== 'model')
          problems.push(`${where}: unknown field "${k}" ignored`);
      const entry: LayoutEntry = placement(pos, rotDeg, scale);
      if (model !== undefined) entry.model = model;
      layout[section][id] = entry;
    }
  }
  return { layout, problems };
}

const num = (v: number): string => String(v);
const vec = (v: Readonly<Vec3>): string => `[${num(v[0])}, ${num(v[1])}, ${num(v[2])}]`;

/**
 * The layout as the file stores it: sections and ids in sorted order, one piece per line, numbers rounded (roundPlacement).
 * The same layout always gives the same text, so a saved change is a small diff.
 */
export function serializeRoomLayout(layout: Readonly<RoomLayout>): string {
  const lines = ['{', `  "version": ${ROOM_LAYOUT_VERSION},`];
  LAYOUT_SECTIONS.forEach((section, si) => {
    const ids = Object.keys(layout[section]).sort();
    const tail = si === LAYOUT_SECTIONS.length - 1 ? '' : ',';
    if (ids.length === 0) {
      lines.push(`  "${section}": {}${tail}`);
      return;
    }
    lines.push(`  "${section}": {`);
    ids.forEach((id, i) => {
      const entry = layout[section][id];
      const p = roundPlacement(entry);
      const comma = i === ids.length - 1 ? '' : ',';
      const model = entry.model !== undefined ? `"model": ${JSON.stringify(entry.model)}, ` : '';
      lines.push(
        `    "${id}": { ${model}"pos": ${vec(p.pos)}, "rotDeg": ${vec(p.rotDeg)}, "scale": ${vec(p.scale)} }${comma}`,
      );
    });
    lines.push(`  }${tail}`);
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** The asset ids a layout's added pieces show, sorted, each once. */
export function modelIdsOf(layout: Readonly<RoomLayout>): string[] {
  const ids = new Set<string>();
  for (const section of LAYOUT_SECTIONS)
    for (const entry of Object.values(layout[section])) if (entry.model !== undefined) ids.add(entry.model);
  return [...ids].sort();
}

/** A piece standing in the room now, as the room editor sees it. */
export interface CurrentPiece {
  readonly section: LayoutSection;
  readonly id: string;
  readonly placement: Readonly<Placement>;
  /** The asset an added piece shows. */
  readonly model?: string;
}

/**
 * The layout to save: the file's own entries (`base`), less the pieces taken out (`removed`, as `section:id`), with every piece
 * standing now at its current placement. Entries of pieces that never loaded (a model whose file is missing) are kept as they
 * were, so saving never quietly drops them.
 */
export function mergeLayout(
  base: Readonly<RoomLayout>,
  current: readonly CurrentPiece[],
  removed: ReadonlySet<string> = new Set(),
): RoomLayout {
  const out = emptyRoomLayout();
  for (const section of LAYOUT_SECTIONS)
    for (const [id, entry] of Object.entries(base[section])) {
      if (removed.has(`${section}:${id}`)) continue;
      const copy: LayoutEntry = copyPlacement(entry);
      if (entry.model !== undefined) copy.model = entry.model;
      out[section][id] = copy;
    }
  for (const piece of current) {
    const entry: LayoutEntry = roundPlacement(piece.placement);
    if (piece.model !== undefined) entry.model = piece.model;
    out[piece.section][piece.id] = entry;
  }
  return out;
}

/**
 * A free id for a new piece made from `name` (an asset id, or the id of a piece being copied): the name itself if it is free,
 * else the name with the next free number (`chair` → `chair-2`; copying `lamp-2` gives `lamp-3`).
 */
export function nextPieceId(name: string, taken: (id: string) => boolean): string {
  let base = name.replace(/-\d+$/, '');
  if (!PIECE_ID.test(base)) base = 'piece';
  if (!taken(base)) return base;
  for (let n = 2; ; n++) if (!taken(`${base}-${n}`)) return `${base}-${n}`;
}

/** The room's floor, which every piece's footprint must stay on: the side walls at x ±2, the back wall at z 1.85, and the
 * nearest the wall ahead can come (z -1.52, a 1.5 m stage distance plus the room wall behind it). */
export const ROOM_FLOOR = { minX: -2, maxX: 2, minZ: -1.52, maxZ: 1.85 } as const;

export interface Footprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * The floor area a piece covers: a `size` (width along its own x, depth along its own z, metres) centred on `pos`, turned by
 * `yawDeg` about the vertical. (Tilts about x or z are not counted; furniture stands upright.)
 */
export function footprint(pos: Readonly<Vec3>, size: readonly [number, number], yawDeg: number): Footprint {
  const yaw = (yawDeg * Math.PI) / 180;
  const c = Math.abs(Math.cos(yaw)),
    s = Math.abs(Math.sin(yaw));
  const halfX = (size[0] * c + size[1] * s) / 2,
    halfZ = (size[0] * s + size[1] * c) / 2;
  return { minX: pos[0] - halfX, maxX: pos[0] + halfX, minZ: pos[2] - halfZ, maxZ: pos[2] + halfZ };
}

/** Whether a footprint lies on the room's floor (ROOM_FLOOR), with `slack` metres of tolerance for rounding. */
export function onFloor(f: Readonly<Footprint>, slack = 1e-6): boolean {
  return (
    f.minX >= ROOM_FLOOR.minX - slack &&
    f.maxX <= ROOM_FLOOR.maxX + slack &&
    f.minZ >= ROOM_FLOOR.minZ - slack &&
    f.maxZ <= ROOM_FLOOR.maxZ + slack
  );
}
