// The page's title screen, shown before the player enters VR (docs/UI-STYLE.md). A full-page layer over the scene: the
// title, a button per item, and a candle-coloured glow that follows the pointer. Its markup and style are title-markup.ts.
import { TITLE_CSS, titleMarkup, type TitleItem } from './title-markup';

const STYLE_ID = 'wsw-title-style';

export interface TitleScreenItem extends TitleItem {
  onPress: () => void;
}

export interface TitleScreen {
  readonly element: HTMLElement;
  /** A short message under the menu (what went wrong); an empty string clears it. */
  setNote(text: string): void;
  /** Shows or hides the whole screen (hidden while a VR session runs). */
  setVisible(visible: boolean): void;
}

export function createTitleScreen(items: readonly TitleScreenItem[], parent: HTMLElement = document.body): TitleScreen {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = TITLE_CSS;
    document.head.append(style);
  }

  const element = document.createElement('section');
  element.id = 'wsw-title';
  element.className = 'wsw-screen';
  element.setAttribute('aria-label', 'Where Shadows Wander');
  element.innerHTML = titleMarkup(items);

  const buttons = element.querySelectorAll<HTMLButtonElement>('.wsw-item');
  buttons.forEach((b, i) => b.addEventListener('click', () => items[i].onPress()));

  // The glow follows the pointer by two CSS variables: no layout, only the one gradient repaints.
  element.addEventListener('pointermove', (e) => {
    const r = element.getBoundingClientRect();
    element.style.setProperty('--gx', `${e.clientX - r.left}px`);
    element.style.setProperty('--gy', `${e.clientY - r.top}px`);
  });

  const note = element.querySelector<HTMLElement>('.wsw-note')!;
  parent.append(element);
  return {
    element,
    setNote(text) {
      note.textContent = text;
      note.hidden = text === '';
    },
    setVisible(visible) {
      element.style.display = visible ? 'flex' : 'none';
    },
  };
}
