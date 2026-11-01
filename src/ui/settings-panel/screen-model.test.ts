import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../engine/services/settings/settings';
import { MENU_SIZE_M } from '../menu-panel/menu-layout';
import { PAGES } from './markup';
import {
  FOOTER_CODE,
  FOOTER_U,
  FOOTER_V,
  hitAt,
  pageCount,
  pressedValue,
  ROW_PITCH_V,
  rowsFor,
  rowV,
  VALUE_U,
  type ExtraPageItems,
} from './screen-model';

const rows = rowsFor(0, DEFAULT_SETTINGS, []);

describe('settings screen model', () => {
  it('shows every setting on exactly one page', () => {
    const all = PAGES.flatMap((_, p) => rowsFor(p, DEFAULT_SETTINGS, []).map((r) => r.id));
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(13);
  });

  it('makes each row and footer button at least 4 cm tall to poke', () => {
    expect(ROW_PITCH_V * MENU_SIZE_M).toBeGreaterThanOrEqual(0.045);
  });

  it('finds the arrows of a stepper, the whole value of a toggle and the footer', () => {
    expect(rows[0].kind).toBe('step');
    expect(hitAt(rows, 0.6, rowV(0))).toBe(0);
    expect(hitAt(rows, 0.88, rowV(0))).toBe(1);
    expect(hitAt(rows, VALUE_U, rowV(0))).toBe(-1);
    const toggle = rowsFor(0, DEFAULT_SETTINGS, [])[5];
    expect(toggle.kind).toBe('press');
    expect(hitAt(rows, VALUE_U, rowV(5))).toBe(11);
    expect(hitAt(rows, 0.2, rowV(0))).toBe(-1); // the name is not a button
    expect(hitAt(rows, FOOTER_U[2], FOOTER_V)).toBe(FOOTER_CODE + 2);
    expect(hitAt(rows, 0.5, 0.2)).toBe(-1);
  });

  it('steps a number on its grid and clamps it, and flips a toggle', () => {
    const up = pressedValue(rows[0], 1, DEFAULT_SETTINGS)!;
    expect(up).toEqual({ key: 'tolerance', value: 1.5 });
    expect(pressedValue(rows[0], 0, DEFAULT_SETTINGS)).toEqual({ key: 'tolerance', value: 1 }); // already the minimum
    const flick = rows[4];
    expect(pressedValue(flick, 1, DEFAULT_SETTINGS)!.key).toBe('flicker');
  });

  it('puts extra (debug) pages after the settings, as press rows', () => {
    let hits = 0;
    const extra: ExtraPageItems[] = [
      { title: 'Debug', items: [{ id: 'a', label: 'A', help: 'h', text: () => 'on', press: () => hits++ }] },
    ];
    expect(pageCount(extra)).toBe(PAGES.length + 1);
    const r = rowsFor(PAGES.length, DEFAULT_SETTINGS, extra);
    expect(r).toHaveLength(1);
    expect(r[0].value).toBe('on');
    expect(pressedValue(r[0], 1, DEFAULT_SETTINGS)).toBeNull();
    expect(hits).toBe(0);
  });
});
