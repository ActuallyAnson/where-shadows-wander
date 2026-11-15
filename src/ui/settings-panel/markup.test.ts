import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTING_SPECS, specFor, type NumberSpec } from '../../engine/services/settings/settings';
import {
  BUTTON_PX,
  formatValue,
  ids,
  METRES_PER_PX,
  nextValue,
  PAGES,
  SETTING_PAGES,
  pageButtonText,
  settingsMarkup,
  stepValue,
} from './markup';

describe('settingsMarkup', () => {
  const text = settingsMarkup(DEFAULT_SETTINGS);

  it('has a control for every setting, with its label and one-line help', () => {
    for (const s of SETTING_SPECS) {
      expect(text).toContain(s.label);
      expect(text).toContain(s.help);
      if (s.kind === 'number') {
        expect(text).toContain(`id="${ids.dec(s.key)}"`);
        expect(text).toContain(`id="${ids.inc(s.key)}"`);
        expect(text).toContain(`id="${ids.value(s.key)}"`);
      } else expect(text).toContain(`id="${ids.button(s.key)}"`);
    }
    expect(text).toContain(`id="${ids.reset}"`);
    expect(text).toContain(`id="${ids.close}"`);
  });

  it('puts every setting on exactly one page, at most six to a page', () => {
    const all = PAGES.flat();
    expect([...all].sort()).toEqual(SETTING_SPECS.map((s) => s.key).sort());
    for (const p of PAGES) expect(p.length).toBeLessThanOrEqual(6);
    PAGES.forEach((_, n) => expect(text).toContain(`id="${ids.page(n)}"`));
  });

  it('categorises volume controls under Basic and shadow adjustments under Advanced', () => {
    const byCategory = (cat: 'Basic' | 'Advanced') =>
      SETTING_PAGES.filter((p) => p.category === cat).flatMap((p) => p.keys);
    expect(byCategory('Basic')).toEqual(
      expect.arrayContaining(['volumeMaster', 'volumeMusic', 'volumeEffects', 'volumeAmbience', 'hand', 'captions']),
    );
    expect(byCategory('Advanced')).toEqual(
      expect.arrayContaining(['shadowSize', 'sharpen', 'flicker', 'tolerance', 'holdTime']),
    );
  });

  it('has a page button that names where it goes', () => {
    expect(text).toContain(`id="${ids.pageButton}"`);
    expect(pageButtonText(0, 2)).not.toBe(pageButtonText(1, 2));
    expect(pageButtonText(1, 4)).toBe(pageButtonText(0, 4)); // a middle page goes on to the next, like the first
  });

  it('uses each id once', () => {
    const found = [...text.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(found).size).toBe(found.length);
  });

  it('shows the values it is given', () => {
    const shown = settingsMarkup({ ...DEFAULT_SETTINGS, highContrast: true, hand: 'left', holdTime: 0.6 });
    expect(shown).toContain('>0.6 s<');
    expect(shown).toContain('>Left<');
  });

  it('sizes every press target to at least 4 cm at the panel real size', () => {
    expect(BUTTON_PX * METRES_PER_PX).toBeGreaterThanOrEqual(0.04);
    // .step and .wide are declared 16 px bigger than BUTTON_PX, so they have margin over it.
    expect(text).toContain(`width: ${BUTTON_PX + 16}px`);
  });

  it('is well-formed enough that every opened tag closes', () => {
    const open = (text.match(/<(div|button)\b/g) ?? []).length;
    const close = (text.match(/<\/(div|button)>/g) ?? []).length;
    expect(open).toBe(close);
  });
});

describe('formatValue', () => {
  it('reads naturally', () => {
    expect(formatValue('holdTime', 0.4)).toBe('0.4 s');
    expect(formatValue('tolerance', 1)).toBe('1.0');
    expect(formatValue('shadowSize', 1.4)).toBe('140%');
    expect(formatValue('volumeMusic', 0.7)).toBe('70%');
    expect(formatValue('flicker', 0)).toBe('0%');
    expect(formatValue('highContrast', true)).toBe('On');
    expect(formatValue('captions', false)).toBe('Off');
    expect(formatValue('hand', 'right')).toBe('Right');
  });
});

describe('stepValue', () => {
  const hold = specFor('holdTime') as NumberSpec;
  it('moves by one step and stops at the ends, without float noise', () => {
    expect(stepValue(hold, 0.4, 1)).toBe(0.5);
    expect(stepValue(hold, 0.3, 1)).toBe(0.4);
    expect(stepValue(hold, 0.2, -1)).toBe(0.2);
    expect(stepValue(hold, 1, 1)).toBe(1);
  });
  it('reaches both ends of every stepper within its range', () => {
    for (const s of SETTING_SPECS) {
      if (s.kind !== 'number') continue;
      let v = s.min;
      for (let i = 0; i < 40; i++) v = stepValue(s, v, 1);
      expect(v).toBe(s.max);
      for (let i = 0; i < 40; i++) v = stepValue(s, v, -1);
      expect(v).toBe(s.min);
    }
  });
});

describe('nextValue', () => {
  it('flips a toggle and cycles a choice', () => {
    expect(nextValue(specFor('highContrast'), false)).toBe(true);
    expect(nextValue(specFor('captions'), true)).toBe(false);
    expect(nextValue(specFor('hand'), 'right')).toBe('left');
    expect(nextValue(specFor('hand'), 'left')).toBe('right');
  });
  it('refuses a stepper', () => {
    expect(() => nextValue(specFor('tolerance'), 1)).toThrow();
  });
});
