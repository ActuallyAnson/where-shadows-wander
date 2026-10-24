import { describe, expect, it } from 'vitest';
import { BUTTON_PX } from '../settings-panel/markup';
import { MENU_METRES_PER_PX, MENU_PALETTE, MENU_SCREENS, menuIds, menuMarkup, type MenuScreenId } from './markup';

const ids = Object.keys(MENU_SCREENS) as MenuScreenId[];

describe('menuMarkup', () => {
  it('has the title, the line and one button per entry, each with its own id', () => {
    for (const id of ids) {
      const s = MENU_SCREENS[id];
      const text = menuMarkup(s);
      expect(text).toContain(s.title);
      expect(text).toContain(s.line);
      for (const b of s.buttons) {
        expect(text).toContain(`id="${menuIds.button(id, b.id)}"`);
        expect(text).toContain(b.label);
      }
      expect((text.match(/<button /g) ?? []).length).toBe(s.buttons.length);
    }
  });

  it('keeps every button id unique across screens', () => {
    const all = ids.flatMap((id) => MENU_SCREENS[id].buttons.map((b) => menuIds.button(id, b.id)));
    expect(new Set(all).size).toBe(all.length);
  });

  it('makes each button at least 4 cm tall at the real size', () => {
    const px = Number(/\.wsw-mbtn \{[^}]*height: (\d+)px/.exec(menuMarkup(MENU_SCREENS.pause))![1]);
    expect(px).toBeGreaterThanOrEqual(BUTTON_PX);
    expect(px * MENU_METRES_PER_PX).toBeGreaterThanOrEqual(0.04);
  });

  it('has the flame emblem and the divider with its diamond on every screen', () => {
    for (const id of ids) {
      const text = menuMarkup(MENU_SCREENS[id]);
      expect(text).toContain('class="wsw-mflame"');
      expect(text).toContain('◆');
    }
  });

  it('escapes text', () => {
    const text = menuMarkup({ id: 'end', title: '<b>&', line: '', buttons: [] });
    expect(text).toContain('&lt;b&gt;&amp;');
  });

  it('has a pure black on white look for high contrast with every class the normal look has', () => {
    expect(Object.keys(MENU_PALETTE.high)).toEqual(Object.keys(MENU_PALETTE.normal));
  });
});
