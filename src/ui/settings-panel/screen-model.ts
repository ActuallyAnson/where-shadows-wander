// The settings screen in the menu style (mist, serif text, no panel): what its rows are and which row a fingertip reaches.
// A screen is a page of up to six rows (a name, a value between arrows) and a footer (next page, reset, back). Positions are
// fractions of the square screen (u across from the left, v down from the top). Plain TypeScript: no three.js, no canvas.
import { SETTING_SPECS, type SettingSpec, type Settings } from '../../engine/services/settings/settings';
import { formatValue, PAGES, SETTING_PAGES, pageButtonText, stepValue, nextValue } from './markup';

export const ROW0_V = 0.42;
/** 4.6 cm apart at the screen's real size (0.56 m), so a fingertip poke is not precise work. */
export const ROW_PITCH_V = 0.082;
export const ROW_HALF_V = ROW_PITCH_V / 2;
export const FOOTER_V = 0.935;
export const FOOTER_HALF_V = 0.05;
export const LABEL_U = 0.1;
export const VALUE_U = 0.74;
/** The reachable zones of a row: the left arrow, the right arrow, or the whole value for a toggle or choice. */
export const DEC_U: readonly [number, number] = [0.52, 0.68];
export const INC_U: readonly [number, number] = [0.8, 0.96];
export const FOOTER_U = [0.2, 0.5, 0.8] as const;
export const FOOTER_HALF_U = 0.14;

/** Item codes: row i's left arrow is 2i, its right arrow (or its whole value, for a press row) 2i + 1; the footer is 100 + n. */
export const FOOTER_CODE = 100;
export const codeRow = (code: number) => code >> 1;
export const isFooter = (code: number) => code >= FOOTER_CODE;

export interface Row {
  readonly id: string;
  readonly label: string;
  readonly help: string;
  /** 'step' has a left and a right arrow; 'press' is one press (a toggle, a choice, or a debug button). */
  readonly kind: 'step' | 'press';
  /** What the value reads now. */
  value: string;
}

export interface ExtraItem {
  id: string;
  label: string;
  help: string;
  text(): string;
  press(): void;
}
export interface ExtraPageItems {
  title: string;
  items: ExtraItem[];
}

export function pageCount(extra: readonly ExtraPageItems[]): number {
  return PAGES.length + extra.length;
}

export function pageTitle(page: number, extra: readonly ExtraPageItems[]): string {
  return page < SETTING_PAGES.length ? SETTING_PAGES[page].category : extra[page - SETTING_PAGES.length].title;
}

export function footerLabels(page: number, extra: readonly ExtraPageItems[]): readonly [string, string, string] {
  return [pageButtonText(page, pageCount(extra)), 'Reset', 'Back'];
}

/** The rows of a page, with their values read from `values`. */
export function rowsFor(page: number, values: Readonly<Settings>, extra: readonly ExtraPageItems[]): Row[] {
  if (page < PAGES.length) {
    return PAGES[page].map((key) => {
      const spec = SETTING_SPECS.find((s) => s.key === key)!;
      return {
        id: key,
        label: spec.label,
        help: spec.help,
        kind: spec.kind === 'number' ? 'step' : 'press',
        value: formatValue(key, values[key] as never),
      };
    });
  }
  return extra[page - PAGES.length].items.map((it) => ({
    id: it.id,
    label: it.label,
    help: it.help,
    kind: 'press',
    value: it.text(),
  }));
}

export function rowV(i: number): number {
  return ROW0_V + i * ROW_PITCH_V;
}

/** The item code under (u, v) on a page whose rows are `rows`, or -1. */
export function hitAt(rows: readonly Row[], u: number, v: number): number {
  for (let i = 0; i < rows.length; i++) {
    if (Math.abs(v - rowV(i)) > ROW_HALF_V) continue;
    if (rows[i].kind === 'press') return u >= DEC_U[0] && u <= INC_U[1] ? i * 2 + 1 : -1;
    if (u >= DEC_U[0] && u <= DEC_U[1]) return i * 2;
    if (u >= INC_U[0] && u <= INC_U[1]) return i * 2 + 1;
    return -1;
  }
  if (Math.abs(v - FOOTER_V) <= FOOTER_HALF_V)
    for (let j = 0; j < FOOTER_U.length; j++) if (Math.abs(u - FOOTER_U[j]) <= FOOTER_HALF_U) return FOOTER_CODE + j;
  return -1;
}

/** The new value a press on a setting row gives: [key, value], or null when the row is not a setting (a debug button). */
export function pressedValue(
  row: Row,
  code: number,
  values: Readonly<Settings>,
): { key: keyof Settings; value: number | boolean | string } | null {
  const spec: SettingSpec | undefined = SETTING_SPECS.find((s) => s.key === row.id);
  if (!spec) return null;
  const current = values[spec.key];
  if (spec.kind === 'number')
    return { key: spec.key, value: stepValue(spec, current as number, code % 2 === 0 ? -1 : 1) };
  return { key: spec.key, value: nextValue(spec, current) };
}
