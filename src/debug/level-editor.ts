// The level editor behind the Hand Lab's "Level editor" row: nudges, resizes, adds and removes the pieces of the
// puzzle being played (the traveller's start, the goal, the props whose shadows are the ground) and writes the
// result out as TypeScript to paste back into the puzzle's file. Plain TypeScript, no three.js.
//
// It edits the puzzle's own `layout` and `props` in place (the types say readonly; this is a debug tool), so the next
// load of that puzzle (a restart) uses them. Only a puzzle with a TypeScript layout can be edited: a puzzle read from
// the chapter file says so. What a puzzle's hooks do with its own constants (a drip's position, the fan's wind) is not
// touched; the editor moves the ground and the two ends.
import type { LevelLayout, LevelRect, LevelSource } from '../game/level';
import { MAX_PROPS, type LevelProp } from '../game/props';

/** How far one press moves a piece, and how much it grows, metres. */
export const NUDGE_M = 0.02;
const MIN_SIZE_M = 0.04;
/** Where a new ledge is put: a short one in the middle, on the ledge line. */
const NEW_LEDGE = { width: 0.3, height: 0.14, top: -0.26 };

export type EditAction =
  | 'prev'
  | 'next'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'wider'
  | 'narrower'
  | 'taller'
  | 'shorter'
  | 'add'
  | 'remove'
  | 'revert';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type EditableSource = Mutable<LevelSource>;

const round = (v: number) => Math.round(v * 1000) / 1000;

function copyLayout(l: LevelLayout): LevelLayout {
  return {
    traveller: { ...l.traveller },
    goal: { ...l.goal },
    markers: l.markers?.map((m) => ({ ...m })),
    pieces: l.pieces?.map((p) => ({ ...p })),
  };
}
const copyProps = (p: readonly LevelProp[]): LevelProp[] => p.map((x) => ({ ...x, size: [...x.size] }));

export class LevelEditor {
  /** Which piece is selected: 0 the start, 1 the goal, 2 and up the props. */
  selected = 0;
  /** What the editor last did or why it could not, for the panel. */
  message = '';
  private readonly original: { layout: LevelLayout; props: LevelProp[] } | null;

  constructor(private readonly def: LevelSource) {
    this.original = def.layout ? { layout: copyLayout(def.layout), props: copyProps(def.props ?? []) } : null;
  }

  /** Whether this puzzle can be edited (it has a TypeScript layout). */
  get editable(): boolean {
    return this.original !== null;
  }

  get count(): number {
    return this.editable ? 2 + (this.def.props?.length ?? 0) : 0;
  }

  /** One line about the selected piece. */
  describe(): string {
    if (!this.editable) return 'This puzzle is laid out in the chapter file, so it cannot be edited here.';
    const l = this.def.layout!;
    const at = `${this.selected + 1}/${this.count}`;
    if (this.selected === 0) return `${at} start  x ${round(l.traveller.x)}  y ${round(l.traveller.y)}`;
    if (this.selected === 1) {
      const g = l.goal;
      return `${at} goal  x ${round(g.x)}  y ${round(g.y)}  ${round(g.width)} x ${round(g.height)}`;
    }
    const p = this.def.props![this.selected - 2];
    return `${at} ${p.id} (${p.shape})  x ${round(p.x)}  y ${round(p.y)}  size ${p.size.map(round).join(' x ')}`;
  }

  /** Does one edit. Returns true when the puzzle changed (and so should be loaded again). */
  run(action: EditAction): boolean {
    this.message = '';
    if (!this.editable) return false;
    const n = this.count;
    switch (action) {
      case 'prev':
        this.selected = (this.selected + n - 1) % n;
        return false;
      case 'next':
        this.selected = (this.selected + 1) % n;
        return false;
      case 'left':
        return this.move(-NUDGE_M, 0);
      case 'right':
        return this.move(NUDGE_M, 0);
      case 'up':
        return this.move(0, NUDGE_M);
      case 'down':
        return this.move(0, -NUDGE_M);
      case 'wider':
        return this.resize(NUDGE_M * 2, 0);
      case 'narrower':
        return this.resize(-NUDGE_M * 2, 0);
      case 'taller':
        return this.resize(0, NUDGE_M * 2);
      case 'shorter':
        return this.resize(0, -NUDGE_M * 2);
      case 'add':
        return this.add();
      case 'remove':
        return this.remove();
      case 'revert':
        return this.revert();
    }
  }

  private source(): EditableSource {
    return this.def as EditableSource;
  }

  private move(dx: number, dy: number): boolean {
    const l = this.def.layout!;
    if (this.selected === 0) {
      (l.traveller as { x: number; y: number }).x += dx;
      (l.traveller as { x: number; y: number }).y += dy;
    } else if (this.selected === 1) {
      const g = l.goal as Mutable<LevelRect>;
      g.x += dx;
      g.y += dy;
    } else {
      const p = this.def.props![this.selected - 2] as Mutable<LevelProp>;
      p.x += dx;
      p.y += dy;
    }
    return true;
  }

  private resize(dw: number, dh: number): boolean {
    if (this.selected === 0) {
      this.message = 'The start has no size.';
      return false;
    }
    if (this.selected === 1) {
      const g = this.def.layout!.goal as Mutable<LevelRect>;
      g.width = Math.max(MIN_SIZE_M, g.width + dw);
      g.height = Math.max(MIN_SIZE_M, g.height + dh);
      return true;
    }
    const p = this.def.props![this.selected - 2];
    const size = p.size as number[];
    const before = size.join();
    if (p.shape === 'box') {
      size[0] = Math.max(MIN_SIZE_M, size[0] + dw);
      size[1] = Math.max(MIN_SIZE_M, size[1] + dh);
    } else {
      // A sphere or cylinder has a radius: wider and narrower change that.
      size[0] = Math.max(MIN_SIZE_M / 2, size[0] + dw / 2);
      if (p.shape === 'cylinder') size[1] = Math.max(MIN_SIZE_M, size[1] + dh);
    }
    if (size.join() === before) {
      this.message = 'That does not change this shape.';
      return false;
    }
    return true;
  }

  private add(): boolean {
    const props = (this.source().props ??= []) as LevelProp[];
    if (props.length >= MAX_PROPS) {
      this.message = `A puzzle can have at most ${MAX_PROPS} props.`;
      return false;
    }
    let k = props.length + 1;
    while (props.some((p) => p.id === `new-${k}`)) k++;
    props.push({
      id: `new-${k}`,
      shape: 'box',
      x: 0,
      y: NEW_LEDGE.top - NEW_LEDGE.height / 2,
      size: [NEW_LEDGE.width, NEW_LEDGE.height, 0.04],
    });
    this.selected = 1 + props.length;
    return true;
  }

  private remove(): boolean {
    if (this.selected < 2) {
      this.message = 'The start and the goal stay.';
      return false;
    }
    (this.def.props as LevelProp[]).splice(this.selected - 2, 1);
    this.selected = Math.min(this.selected, this.count - 1);
    return true;
  }

  private revert(): boolean {
    const o = this.original!;
    const s = this.source();
    s.layout = copyLayout(o.layout);
    s.props = copyProps(o.props);
    this.selected = Math.min(this.selected, this.count - 1);
    this.message = 'Back to how the puzzle was written.';
    return true;
  }

  /** The layout and props as TypeScript, ready to paste into the puzzle's file. */
  toSource(): string {
    if (!this.editable) return '';
    const l = this.def.layout!;
    const num = (v: number) => String(round(v));
    const rect = (r: LevelRect) =>
      `{ x: ${num(r.x)}, y: ${num(r.y)}, width: ${num(r.width)}, height: ${num(r.height)} }`;
    const lines = [
      'layout: {',
      `  traveller: { x: ${num(l.traveller.x)}, y: ${num(l.traveller.y)} },`,
      `  goal: ${rect(l.goal)},`,
    ];
    if (l.markers?.length) {
      lines.push('  markers: [');
      for (const m of l.markers)
        lines.push(
          `    { tag: '${m.tag}', x: ${num(m.x)}, y: ${num(m.y)}, width: ${num(m.width)}, height: ${num(m.height)} },`,
        );
      lines.push('  ],');
    }
    if (l.pieces?.length) {
      lines.push('  pieces: [');
      for (const q of l.pieces)
        lines.push(`    { kind: ${q.kind}, x: ${num(q.x)}, y: ${num(q.y)}, radius: ${num(q.radius)} },`);
      lines.push('  ],');
    }
    lines.push('},', 'props: [');
    for (const p of this.def.props ?? []) {
      const extra =
        (p.depth !== undefined ? `, depth: ${num(p.depth)}` : '') +
        (p.tilt ? `, tilt: ${num(p.tilt)}` : '') +
        (p.solid === false ? ', solid: false' : '');
      lines.push(
        `  { id: '${p.id}', shape: '${p.shape}', x: ${num(p.x)}, y: ${num(p.y)}, size: [${p.size.map(num).join(', ')}]${extra} },`,
      );
    }
    lines.push('],');
    return lines.join('\n');
  }
}
