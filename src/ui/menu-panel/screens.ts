// What the pause, solved and end screens say, as plain data. How they look is menu-art.ts; what a button does is the
// game flow's business (menu-panel.ts reports a press by screen and button id). Plain TypeScript.

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
    title: 'Paused',
    line: 'The candle waits.',
    buttons: [
      { id: 'resume', label: 'Resume' },
      { id: 'settings', label: 'Settings' },
      { id: 'restart', label: 'Begin this puzzle again' },
    ],
  },
  solved: {
    id: 'solved',
    title: 'Solved',
    line: 'The shadows found their way.',
    buttons: [
      { id: 'next', label: 'Onward' },
      { id: 'replay', label: 'Play it again' },
    ],
  },
  end: {
    id: 'end',
    title: 'The End',
    line: 'The light is yours to keep.',
    buttons: [{ id: 'again', label: 'Begin again' }],
  },
};
