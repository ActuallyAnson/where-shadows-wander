// The pause, solved and end screens in the room, as UIKitML text, in the night, pale and candle style
// (docs/UI-STYLE.md). A screen is a title, one line and a few big buttons; what each button does is the game flow's
// business (menu-panel.ts reports the press by id). Plain TypeScript: no three.js here.
import { BUTTON_PX } from '../settings-panel/markup';

export const MENU_WIDTH_PX = 720;
/** The real width in the room (0.46 m: narrower than settings, one column of buttons within easy reach). */
export const MENU_WIDTH_M = 0.46;
export const MENU_METRES_PER_PX = MENU_WIDTH_M / MENU_WIDTH_PX;

export type MenuScreenId = 'pause' | 'solved' | 'end';
export interface MenuButton {
  readonly id: string;
  readonly label: string;
}
export interface MenuScreen {
  readonly id: MenuScreenId;
  readonly title: string;
  readonly line: string;
  readonly buttons: readonly MenuButton[];
}

export const MENU_SCREENS: Readonly<Record<MenuScreenId, MenuScreen>> = {
  pause: {
    id: 'pause',
    title: 'PAUSED',
    line: 'The candle waits.',
    buttons: [
      { id: 'resume', label: 'Resume' },
      { id: 'settings', label: 'Settings' },
      { id: 'restart', label: 'Start this puzzle again' },
    ],
  },
  solved: {
    id: 'solved',
    title: 'SOLVED',
    line: 'The shadows found their way.',
    buttons: [
      { id: 'next', label: 'Next' },
      { id: 'replay', label: 'Play it again' },
    ],
  },
  end: {
    id: 'end',
    title: 'THE END',
    line: 'The light is yours to keep.',
    buttons: [{ id: 'again', label: 'Play again' }],
  },
};

export const menuIds = {
  button: (screen: MenuScreenId, id: string) => `menu-${screen}-${id}`,
} as const;

export type Look = 'normal' | 'high';
const WHITE = '#ffffff';
const BLACK = '#000000';
export const MENU_PALETTE: Readonly<Record<Look, Readonly<Record<string, Readonly<Record<string, string | number>>>>>> =
  {
    normal: {
      'wsw-menu': { backgroundColor: '#05070d', borderWidth: 2, borderColor: '#1b2233' },
      'wsw-mtitle': { color: '#f2f5f9' },
      'wsw-mline': { color: '#9aa5b8' },
      'wsw-mbtn': { color: '#f2f5f9', backgroundColor: '#101728', borderWidth: 2, borderColor: '#ffd89a' },
    },
    high: {
      'wsw-menu': { backgroundColor: WHITE, borderWidth: 6, borderColor: BLACK },
      'wsw-mtitle': { color: BLACK },
      'wsw-mline': { color: BLACK },
      'wsw-mbtn': { color: WHITE, backgroundColor: BLACK, borderWidth: 4, borderColor: BLACK },
    },
  };

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const colours = (cls: string) =>
  Object.entries(MENU_PALETTE.normal[cls] ?? {})
    .map(([k, v]) => `${kebab(k)}: ${typeof v === 'number' ? `${v}px` : v};`)
    .join(' ');

const BIG = BUTTON_PX + 24;

const STYLE = `
<style>
  .wsw-menu { width: ${MENU_WIDTH_PX}px; flex-direction: column; align-items: center; padding-top: 36px; padding-right: 32px; padding-bottom: 36px; padding-left: 32px; gap: 20px; border-radius: 28px; ${colours('wsw-menu')} }
  .wsw-mtitle { font-size: 56px; font-weight: bold; letter-spacing: 8px; ${colours('wsw-mtitle')} }
  .wsw-mline { font-size: 28px; margin-bottom: 8px; ${colours('wsw-mline')} }
  .wsw-mbtn { width: 100%; height: ${BIG}px; font-size: 34px; font-weight: bold; border-radius: 16px; ${colours('wsw-mbtn')} }
</style>`;

/** One screen as UIKitML. */
export function menuMarkup(screen: MenuScreen): string {
  const buttons = screen.buttons
    .map((b) => `<button class="wsw-mbtn" id="${menuIds.button(screen.id, b.id)}">${escape(b.label)}</button>`)
    .join('\n  ');
  return `${STYLE}
<div class="wsw-menu">
  <div class="wsw-mtitle">${escape(screen.title)}</div>
  <div class="wsw-mline">${escape(screen.line)}</div>
  ${buttons}
</div>`;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
