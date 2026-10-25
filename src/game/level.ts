// Loads one puzzle onto the stage: reads its layout, moves it to stage space, builds the ground
// (the ground line and its props' shadows), and spawns its pieces. Runs on puzzle load, never per
// frame, so it may allocate. Plain TypeScript.
//
// A layout comes from one of two places. The bedroom puzzles write theirs in TypeScript
// (`LevelLayout`, beside their props; ADR 0014). The older puzzles read a group from the chapter
// file, as described next.
//
// Layout space → stage space. A chapter file (public/scenes/chapter-N.iwsdk.scene.json) holds one
// group per puzzle (`puzzle-1`, `puzzle-2`, ...), spread out in the editor so they don't overlap.
// Inside a group, positions are stage metres relative to the group's own position, which is the
// stage centre: x in [-0.8, 0.8] and y in [-0.5, 0.5] for the 1.6 × 1.0 m wall. The loader adds a
// group's translation (and its parents'), so this file subtracts the group's own position back out.
//
// The ground. Every puzzle has a ground line along the bottom of the stage, its top at `groundY`.
// Each `marker-gap` cuts a hole in it: the hole spans the marker's width (its height and y are only
// for the editor's view). A puzzle can go without the line (`ground: false`) when its props'
// shadows are all the ground there is. Everything else a puzzle needs beyond pieces, markers and
// props (wind, rain, gates) is built in its puzzle code.
//
// Props. Each solid prop's shadow becomes terrain through a PropCaster (src/game/props.ts), tagged
// PROP_TAG_BASE + its index. Props are static: they are projected once, here, from wherever the
// lantern is when the puzzle loads.

import { CAPSULE_STRIDE } from '../engine/hands/hand-shadow';
import { Kind, type KindId } from '../engine/sim/entity-kinds';
import type { EntityStore, Handle } from '../engine/sim/entity-store';
import { parseLayout, spawnLayout, type LayoutMarker, type ParsedLayout } from '../engine/sim/scene-layout';
import type { Solver } from '../engine/sim/solver';
import { WALL_WIDTH_M } from '../engine/stage/stage-frame';
import { MAX_PROPS, PROP_TAG_BASE, type LevelProp, type PropCaster } from './props';

/** Labels for terrain capsules (`solver.terrain.tag`), so gameplay can tell what something stood on. */
export const TerrainTag = {
  Ground: 1,
  Gate: 2,
  // 3 and 4 were the rope and the fox's soft ground, cut with the companions.
  Wall: 5,
} as const;

/** Top of the ground line, stage metres (0.2 m above the bottom of a 1.0 m wall). */
export const GROUND_Y = -0.3;
/** The traveller's radius in a TypeScript layout (the chapter file's pieces say their own). */
export const TRAVELLER_RADIUS = 0.04;
/** The ground is a capsule this thick, so a falling drop can't skip through it in one step. */
export const GROUND_THICKNESS = 0.1;
/** How far the ground runs past each side of the wall, so nothing walks off the end of the world. */
const GROUND_OVERHANG = 0.3;

export interface LoadedLayout {
  /** The puzzle's pieces and markers, in stage space. */
  layout: ParsedLayout;
  /** The puzzle group's position in the chapter file (what was subtracted). */
  originX: number;
  originY: number;
}

/** Reads `rootId` from a chapter file and moves it to stage space. Problems are in `layout.problems`. */
export function loadLayout(doc: unknown, rootId: string): LoadedLayout {
  const layout = parseLayout(doc, rootId);
  const origin = nodeOrigin(doc, rootId);
  const ox = origin ? origin[0] : 0,
    oy = origin ? origin[1] : 0;
  for (const e of layout.entities) {
    e.x -= ox;
    e.y -= oy;
  }
  for (const m of layout.markers) {
    m.x -= ox;
    m.y -= oy;
  }
  return { layout, originX: ox, originY: oy };
}

/** The markers with a tag, in authoring order. */
export function markersOf(layout: ParsedLayout, tag: string): LayoutMarker[] {
  return layout.markers.filter((m) => m.tag === tag);
}

/** The first marker with a tag, or null. */
export function markerOf(layout: ParsedLayout, tag: string): LayoutMarker | null {
  for (const m of layout.markers) if (m.tag === tag) return m;
  return null;
}

/**
 * Lays the ground along y = `groundY` (its top), from beyond the left edge of the wall to beyond the
 * right, with a hole under each gap marker. @returns how many ground capsules were added.
 */
export function buildGround(solver: Solver, layout: ParsedLayout, groundY = GROUND_Y, width = WALL_WIDTH_M): number {
  const holes = markersOf(layout, 'gap')
    .map((m) => [m.x - m.params.width / 2, m.x + m.params.width / 2] as const)
    .sort((a, b) => a[0] - b[0]);
  const r = GROUND_THICKNESS / 2;
  const y = groundY - r;
  let from = -width / 2 - GROUND_OVERHANG;
  const to = width / 2 + GROUND_OVERHANG;
  let added = 0;
  // A capsule's round end reaches r past its end point, so pull each end in by r: the walkable top
  // then stops at the hole's edge.
  for (const [l, rt] of holes) {
    if (l - from > 2 * r && solver.terrain.add(from + r, y, l - r, y, r, TerrainTag.Ground) >= 0) added++;
    if (rt > from) from = rt;
  }
  if (to - from > 2 * r && solver.terrain.add(from + r, y, to - r, y, r, TerrainTag.Ground) >= 0) added++;
  return added;
}

/** The x extent of a terrain capsule including its round ends: [left, right]. */
export function terrainSpan(solver: Solver, i: number, out: [number, number]): [number, number] {
  const d = solver.terrain.data,
    o = i * CAPSULE_STRIDE;
  const r = d[o + 4];
  out[0] = Math.min(d[o], d[o + 2]) - r;
  out[1] = Math.max(d[o], d[o + 2]) + r;
  return out;
}

/** A box in stage space: centre and full size, metres. */
export interface LevelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A puzzle's layout written in TypeScript, in stage space. */
export interface LevelLayout {
  /** Where the traveller starts (the centre of its body). */
  readonly traveller: { readonly x: number; readonly y: number };
  readonly goal: LevelRect;
  /** Other markers by tag ("gap", "plate"), as the chapter file's markers. */
  readonly markers?: readonly (LevelRect & { readonly tag: string })[];
  /** Other pieces (rocks, crows, fireflies). */
  readonly pieces?: readonly {
    readonly kind: KindId;
    readonly x: number;
    readonly y: number;
    readonly radius: number;
  }[];
}

/** Builds the ParsedLayout the game reads from a TypeScript layout. */
export function layoutFromDef(def: LevelLayout): ParsedLayout {
  const piece = (id: string, kind: KindId, x: number, y: number, radius: number) => ({
    id,
    kind,
    x,
    y,
    radius,
    vx: 0,
    vy: 0,
    flags: 0,
  });
  const marker = (id: string, tag: string, r: LevelRect) => ({
    id,
    tag,
    x: r.x,
    y: r.y,
    params: { width: r.width, height: r.height },
  });
  const entities = [piece('traveller', Kind.Traveller, def.traveller.x, def.traveller.y, TRAVELLER_RADIUS)];
  (def.pieces ?? []).forEach((p, i) => entities.push(piece(`piece-${i}`, p.kind, p.x, p.y, p.radius)));
  const markers = [marker('goal', 'goal', def.goal)];
  (def.markers ?? []).forEach((m, i) => markers.push(marker(`${m.tag}-${i}`, m.tag, m)));
  return { entities, markers, problems: [] };
}

/** Where a puzzle's layout and ground come from (the parts of PuzzleDef the loader reads). */
export interface LevelSource {
  /** A group in the chapter file, used when there is no `layout`. */
  readonly layoutId?: string;
  readonly layout?: LevelLayout;
  readonly props?: readonly LevelProp[];
  /** Lay the ground line along the bottom (default true). */
  readonly ground?: boolean;
}

/**
 * Adds each solid prop's shadow to the solver's terrain through `caster`, tagged PROP_TAG_BASE + the
 * prop's index. A solid prop that casts no ground is listed in `problems`. @returns capsules added.
 */
export function addProps(
  solver: Solver,
  props: readonly LevelProp[],
  caster: PropCaster,
  problems: string[] = [],
): number {
  if (props.length > MAX_PROPS) throw new RangeError(`more than ${MAX_PROPS} props in one puzzle`);
  let added = 0;
  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    if (p.solid === false) continue;
    const n = caster.cast(p, PROP_TAG_BASE + i, solver.terrain);
    if (n === 0) problems.push(`${p.id}: its shadow adds no ground (no shadow, or the terrain pool is full)`);
    added += n;
  }
  return added;
}

/**
 * Loads a whole puzzle: its layout in stage space, the ground line and its props' ground, and its
 * pieces spawned into `store`. The store and the solver's terrain are cleared first.
 */
export function loadLevel(
  doc: unknown,
  src: LevelSource,
  store: EntityStore,
  solver: Solver,
  caster: PropCaster,
  groundY = GROUND_Y,
  handles: Handle[] = [],
): LoadedLayout {
  store.clear();
  solver.reset();
  let loaded: LoadedLayout;
  if (src.layout) loaded = { layout: layoutFromDef(src.layout), originX: 0, originY: 0 };
  else if (src.layoutId) loaded = loadLayout(doc, src.layoutId);
  else throw new Error('a puzzle needs a layout or a layoutId');
  if (src.ground !== false) buildGround(solver, loaded.layout, groundY);
  if (src.props) addProps(solver, src.props, caster, loaded.layout.problems);
  spawnLayout(store, loaded.layout, handles);
  return loaded;
}

/** Loads a chapter-file puzzle with a ground line and no props (the older puzzles' shape). */
export function loadPuzzle(
  doc: unknown,
  rootId: string,
  store: EntityStore,
  solver: Solver,
  handles: Handle[] = [],
  groundY = GROUND_Y,
): LoadedLayout {
  return loadLevel(doc, { layoutId: rootId }, store, solver, NO_PROPS, groundY, handles);
}

const NO_PROPS: PropCaster = { cast: () => 0 };

/**
 * The summed translation of the node `id` and its ancestors, as the layout loader adds them up,
 * or null if there is no such node.
 */
function nodeOrigin(doc: unknown, id: string): [number, number] | null {
  const nodes = isObj(doc) && Array.isArray(doc.nodes) ? doc.nodes : null;
  if (!nodes) return null;
  const walk = (list: unknown[], px: number, py: number): [number, number] | null => {
    for (const raw of list) {
      if (!isObj(raw)) continue;
      const t = isObj(raw.transform) ? raw.transform : null;
      const p = t && Array.isArray(t.position) ? t.position : null;
      const x = px + (p && typeof p[0] === 'number' ? p[0] : 0);
      const y = py + (p && typeof p[1] === 'number' ? p[1] : 0);
      if (raw.id === id) return [x, y];
      if (Array.isArray(raw.children)) {
        const found = walk(raw.children, x, y);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(nodes, 0, 0);
}

type Obj = Record<string, unknown>;
function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
