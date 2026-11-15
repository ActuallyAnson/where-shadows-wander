// What the pause screen says, as plain data. How they look is menu-art.ts; what a button does is the
// game flow's business (menu-panel.ts reports a press by screen and button id). Plain TypeScript.

export type MenuScreenId = 'pause';
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
      { id: 'resume', label: 'Light the candle' },
      { id: 'settings', label: 'Settings' },
      { id: 'exit', label: 'Leave the game' },
    ],
  },
};
