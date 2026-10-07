// Reads puzzle layouts that were placed in IWSDK's scene editor, and spawns them into the entity store.
// A layout is an ordinary scene file (public/scenes/*.iwsdk.scene.json). Everything the game needs is set
// with the editor's own fields, so nothing has to be typed into the file:
//
//   Asset      `piece-<kind>` (piece-rock, piece-crow, ...) makes an entity of that kind.
//              `marker-<tag>` (marker-gap, marker-goal, ...) makes a named spot for puzzle code.
//   Position   x and y, in metres, are the stage position (z is ignored).
//   Scale      a piece's radius is its scale (the stand-in shape is a unit sphere, so the size you see is
//              the size the game uses). A marker's width and height are its scale x and y.
//   Piece      an optional component (Add Component in the inspector) for starting speed `vx`, `vy` and the
//              flags `isStatic`, `isSensor` and `hidden`.
//   Visible    a node switched off in the editor is skipped, and so is everything under it.
//
// Nodes with any other asset, or none (the room, groups, lights), are left alone. Groups may nest and their
// translations add up; a parent's rotation or scale is not applied (the loader says so in `problems`).
//
// Plain TypeScript: reads untrusted JSON as `unknown`, imports nothing from IWSDK or three.js, and builds
// its result once at load time (loading is not per-frame code).

import { Flag, Kind, type KindId } from './entity-kinds';
import { NULL_HANDLE, type EntityStore, type Handle } from './entity-store';

/** Asset-name prefixes that mark a node as a game piece or a marker. */
export const PIECE_PREFIX = 'piece-';
export const MARKER_PREFIX = 'marker-';
/** The component (src/app/components.ts) the editor shows for a piece's extra settings. */
export const PIECE_COMPONENT = 'Piece';

export interface LayoutEntity {
  /** The editor node's id. */
  id: string;
  kind: KindId;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  flags: number;
}

export interface LayoutMarker {
  id: string;
  /** What the marker means to the game, such as "gap", "goal" or "plate". */
  tag: string;
  x: number;
  y: number;
  /** `width` and `height`: the node's scale x and y, in metres. */
  params: Readonly<Record<string, number>>;
}

export interface ParsedLayout {
  entities: LayoutEntity[];
  markers: LayoutMarker[];
  /** Things that were skipped or ignored, each with the node id; empty for a clean layout. */
  problems: string[];
}

const KIND_BY_NAME: Readonly<Record<string, KindId>> = Object.fromEntries(
  Object.entries(Kind).map(([name, id]) => [name.toLowerCase(), id]),
);
/** The Piece component's flag fields and the entity flag each sets. */
const PIECE_FLAGS: readonly (readonly [string, number])[] = [
  ['isStatic', Flag.Static],
  ['isSensor', Flag.Sensor],
  ['hidden', Flag.Hidden],
];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

interface Walk {
  rootId: string | undefined;
  found: boolean;
  out: ParsedLayout;
}

/**
 * @param doc a parsed scene file
 * @param rootId when given, only the node with this id and everything under it (one puzzle in a chapter file)
 */
export function parseLayout(doc: unknown, rootId?: string): ParsedLayout {
  const out: ParsedLayout = { entities: [], markers: [], problems: [] };
  const nodes = isObj(doc) && Array.isArray(doc.nodes) ? doc.nodes : null;
  if (!nodes) {
    out.problems.push('not a scene file: no "nodes" list');
    return out;
  }
  const walk: Walk = { rootId, found: false, out };
  for (const node of nodes) visit(node, 0, 0, rootId === undefined, walk);
  if (rootId !== undefined && !walk.found)
    out.problems.push(`no node with id "${rootId}" (or it is under a node switched off in the editor)`);
  return out;
}

/** A node's x and y translation. A position that is present but not two finite numbers is reported (if `report`). */
function translation(node: Obj, id: string, out: ParsedLayout | null): [number, number] {
  const t = isObj(node.transform) ? node.transform : null;
  const p = t && Array.isArray(t.position) ? t.position : null;
  if (!p) return [0, 0];
  if (finite(p[0]) && finite(p[1])) return [p[0], p[1]];
  out?.problems.push(`${id}: position x and y must be numbers`);
  return [0, 0];
}

/**
 * `px`,`py` are the parent's position; the node's own position is added here. `collecting` is whether this
 * node is inside what was asked for (everything, or the puzzle named by `rootId`). Position, visibility and
 * parent transforms are always followed from the top, so a puzzle keeps its place and an ancestor that is
 * switched off, or rotated, counts.
 */
function visit(raw: unknown, px: number, py: number, collecting: boolean, walk: Walk): void {
  if (!isObj(raw)) return;
  const out = walk.out;
  const id = typeof raw.id === 'string' ? raw.id : '(no id)';
  const isRoot = walk.rootId !== undefined && raw.id === walk.rootId;
  if (isRoot) {
    if (walk.found) {
      out.problems.push(`more than one node has the id "${id}"; the first is used`);
      return;
    }
    walk.found = true;
  }
  if (raw.visible === false) {
    if (isRoot) out.problems.push(`${id}: switched off in the editor`);
    return;
  }
  const here = collecting || isRoot;
  const [dx, dy] = translation(raw, id, here ? out : null);
  const x = px + dx;
  const y = py + dy;
  if (here) {
    const content = isObj(raw.content) ? raw.content : null;
    const asset = content && content.type === 'asset' && typeof content.asset === 'string' ? content.asset : '';
    if (asset.startsWith(PIECE_PREFIX)) readPiece(id, asset.slice(PIECE_PREFIX.length), x, y, raw, out);
    else if (asset.startsWith(MARKER_PREFIX)) readMarker(id, asset.slice(MARKER_PREFIX.length), x, y, raw, out);
  }
  if (Array.isArray(raw.children)) {
    const foundBefore = walk.found;
    for (const child of raw.children) visit(child, x, y, here, walk);
    const t = isObj(raw.transform) ? raw.transform : null;
    const onPathToRoot = walk.found && !foundBefore;
    if ((here || onPathToRoot) && t && raw.children.length > 0 && hasRotationOrScale(t))
      out.problems.push(`${id}: rotation or scale on a parent is ignored`);
  }
}

/** The node's scale as x and y; a missing scale is 1, and anything that is not a number comes back as NaN. */
function scaleXY(node: Obj): [number, number] {
  const t = isObj(node.transform) ? node.transform : null;
  const s = t ? t.scale : undefined;
  if (s === undefined) return [1, 1];
  if (typeof s === 'number') return [s, s];
  if (Array.isArray(s)) return [typeof s[0] === 'number' ? s[0] : NaN, typeof s[1] === 'number' ? s[1] : NaN];
  return [NaN, NaN];
}

/** A piece or marker is a circle or a box on the wall, so a rotation set in the editor changes nothing in the game. */
function warnIfRotated(id: string, node: Obj, out: ParsedLayout): void {
  const t = isObj(node.transform) ? node.transform : null;
  const r = t && Array.isArray(t.rotationDeg) ? t.rotationDeg : null;
  if (r && r.some((v) => typeof v === 'number' && v !== 0)) out.problems.push(`${id}: rotation is ignored`);
}

function readMarker(id: string, tag: string, x: number, y: number, node: Obj, out: ParsedLayout): void {
  if (tag === '') {
    out.problems.push(`${id}: a marker asset needs a name after "${MARKER_PREFIX}"`);
    return;
  }
  const [width, height] = scaleXY(node);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    out.problems.push(`${id}: scale must be finite numbers`);
    return;
  }
  if (width <= 0 || height <= 0) {
    out.problems.push(`${id}: scale (the marker's width and height) must be above 0`);
    return;
  }
  warnIfRotated(id, node, out);
  out.markers.push({ id, tag, x, y, params: { width, height } });
}

function readPiece(id: string, kindName: string, x: number, y: number, node: Obj, out: ParsedLayout): void {
  const kind = Object.hasOwn(KIND_BY_NAME, kindName) ? KIND_BY_NAME[kindName] : undefined;
  if (kind === undefined) {
    out.problems.push(`${id}: unknown kind "${kindName}" (asset "${PIECE_PREFIX}${kindName}")`);
    return;
  }
  const [sx, sy] = scaleXY(node);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
    out.problems.push(`${id}: scale must be finite numbers`);
    return;
  }
  if (sx <= 0) {
    out.problems.push(`${id}: scale (the radius) must be above 0`);
    return;
  }
  if (Math.abs(sx - sy) > 0.01 * Math.max(sx, sy)) out.problems.push(`${id}: scale x and y differ; the radius uses x`);
  warnIfRotated(id, node, out);
  let vx = 0;
  let vy = 0;
  let flags = 0;
  const components = isObj(node.components) ? node.components : null;
  const piece = components ? components[PIECE_COMPONENT] : undefined;
  if (piece !== undefined) {
    if (!isObj(piece)) {
      out.problems.push(`${id}: the ${PIECE_COMPONENT} component must be an object`);
      return;
    }
    if ((piece.vx !== undefined && !finite(piece.vx)) || (piece.vy !== undefined && !finite(piece.vy))) {
      out.problems.push(`${id}: ${PIECE_COMPONENT} vx and vy must be numbers`);
      return;
    }
    vx = piece.vx === undefined ? 0 : (piece.vx as number);
    vy = piece.vy === undefined ? 0 : (piece.vy as number);
    for (const [field, bit] of PIECE_FLAGS) {
      const v = piece[field];
      if (v === undefined || v === false) continue;
      if (v !== true) {
        out.problems.push(`${id}: ${PIECE_COMPONENT} ${field} must be true or false`);
        return;
      }
      flags |= bit;
    }
  }
  out.entities.push({ id, kind, x, y, radius: sx, vx, vy, flags });
}

function hasRotationOrScale(t: Obj): boolean {
  const r = Array.isArray(t.rotationDeg) ? t.rotationDeg : null;
  if (r && r.some((v) => finite(v) && v !== 0)) return true;
  const s = t.scale;
  if (finite(s)) return s !== 1;
  return Array.isArray(s) && s.some((v) => finite(v) && v !== 1);
}

/**
 * Creates the layout's entities in the store, in the order they were authored.
 * @param handles when given, receives each created entity's handle (cleared first)
 * @returns how many were created; a kind that is full refuses the rest (see `store.overflowCount`)
 */
export function spawnLayout(store: EntityStore, layout: ParsedLayout, handles?: Handle[]): number {
  if (handles) handles.length = 0;
  let created = 0;
  for (const e of layout.entities) {
    const h = store.create(e.kind, e.x, e.y, e.radius, e.vx, e.vy, e.flags);
    if (h === NULL_HANDLE) continue;
    handles?.push(h);
    created++;
  }
  return created;
}
