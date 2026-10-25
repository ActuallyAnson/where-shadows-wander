// Loads one puzzle of a chapter file onto the stage: reads its layout, moves it to stage space,
// builds the ground, and spawns its pieces. Runs on puzzle load, never per frame, so it may allocate.
// Plain TypeScript.
//
// Layout space → stage space. A chapter file (public/scenes/chapter-N.iwsdk.scene.json) holds one
// group per puzzle (`puzzle-1`, `puzzle-2`, ...), spread out in the editor so they don't overlap.
// Inside a group, positions are stage metres relative to the group's own position, which is the
// stage centre: x in [-0.8, 0.8] and y in [-0.5, 0.5] for the 1.6 × 1.0 m wall. The loader adds a
// group's translation (and its parents'), so this file subtracts the group's own position back out.
//
// The ground. Every puzzle has a ground line along the bottom of the stage, its top at `groundY`.
// Each `marker-gap` cuts a hole in it: the hole spans the marker's width (its height and y are only
// for the editor's view). Everything else a puzzle needs beyond pieces and markers (wind, rain,
// gates) is built in its puzzle code.

import { CAPSULE_STRIDE } from '../engine/hands/hand-shadow';
import type { EntityStore, Handle } from '../engine/sim/entity-store';
import { parseLayout, spawnLayout, type LayoutMarker, type ParsedLayout } from '../engine/sim/scene-layout';
import type { Solver } from '../engine/sim/solver';
import { WALL_WIDTH_M } from '../engine/stage/stage-frame';

/** Labels for terrain capsules (`solver.terrain.tag`), so gameplay can tell what something stood on. */
export const TerrainTag = {
  Ground: 1,
  Gate: 2,
  // 3 and 4 were the rope and the fox's soft ground, cut with the companions.
  Wall: 5,
} as const;

/** Top of the ground line, stage metres (0.2 m above the bottom of a 1.0 m wall). */
export const GROUND_Y = -0.3;
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

/**
 * Loads a whole puzzle: layout to stage space, the ground, and its pieces spawned into `store`.
 * The store and the solver's terrain are cleared first.
 */
export function loadPuzzle(
  doc: unknown,
  rootId: string,
  store: EntityStore,
  solver: Solver,
  handles: Handle[] = [],
  groundY = GROUND_Y,
): LoadedLayout {
  store.clear();
  solver.reset();
  const loaded = loadLayout(doc, rootId);
  buildGround(solver, loaded.layout, groundY);
  spawnLayout(store, loaded.layout, handles);
  return loaded;
}

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
