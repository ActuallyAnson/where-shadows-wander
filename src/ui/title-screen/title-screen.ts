// The page's title screen, shown before the player enters VR (docs/UI-STYLE.md). A full-page layer over the scene: the
// title, a button per item, and a candle-coloured glow that follows the pointer. Its markup and style are title-markup.ts.
import { fontFaceCss, TITLE_CSS, titleMarkup, type TitleItem } from './title-markup';
import font400 from './fonts/cinzel-decorative-latin-400-normal.woff2?url';
import font700 from './fonts/cinzel-decorative-latin-700-normal.woff2?url';

const STYLE_ID = 'wsw-title-style';

export interface TitleScreenItem extends TitleItem {
  onPress: () => void;
  /** BEGIN is the item that starts the game, which the sounds treat differently from the rest. */
  begin?: boolean;
}

/** Called as a fingertip or the keyboard reaches an item, and as one is pressed (for the sounds; this file knows none). */
export interface TitleScreenHooks {
  onReach?(item: TitleScreenItem): void;
  onPressed?(item: TitleScreenItem): void;
  /** Five quick taps on the emblem (a switch for the people making the demo video, not shown anywhere). */
  onEmblemTaps?(): void;
}

export interface TitleScreen {
  readonly element: HTMLElement;
  /** A short message under the menu (what went wrong); an empty string clears it. */
  setNote(text: string): void;
  /** Shows or hides the whole screen (hidden while a VR session runs). */
  setVisible(visible: boolean): void;
  /** While VR is starting: nothing can be pressed twice, the emblem's flame gutters and the screen fades to black. false undoes it. */
  setBusy(busy: boolean): void;
}

export function createTitleScreen(
  items: readonly TitleScreenItem[],
  hooks: TitleScreenHooks = {},
  parent: HTMLElement = document.body,
): TitleScreen {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = fontFaceCss(font400, font700) + TITLE_CSS;
    document.head.append(style);
  }

  const element = document.createElement('section');
  element.id = 'wsw-title';
  element.className = 'wsw-screen';
  element.setAttribute('aria-label', 'Where Shadows Wander');
  element.innerHTML = titleMarkup(items);

  const buttons = element.querySelectorAll<HTMLButtonElement>('.wsw-item');
  buttons.forEach((b, i) => {
    // Reach, not move: one sound as the pointer arrives, not a stream while it crosses the item.
    b.addEventListener('pointerenter', () => hooks.onReach?.(items[i]));
    b.addEventListener('focus', () => hooks.onReach?.(items[i]));
    b.addEventListener('click', () => {
      hooks.onPressed?.(items[i]);
      items[i].onPress();
    });
  });

  // The film grain over the backdrop is a small noise tile drawn once here. (It used to be an SVG feTurbulence filter inside the
  // animated backdrop, which was worked out again at full-screen size every time the bird, the flame or the steam moved.)
  const grain = element.querySelector<HTMLElement>('.wsw-grain');
  if (grain && typeof document !== 'undefined') {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const g = tile.getContext ? tile.getContext('2d') : null;
    if (g) {
      const image = g.createImageData(128, 128);
      let s = 4;
      for (let i = 0; i < image.data.length; i += 4) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        image.data[i] = 255;
        image.data[i + 1] = 220;
        image.data[i + 2] = 178;
        image.data[i + 3] = (s >>> 24) % 22;
      }
      g.putImageData(image, 0, 0);
      grain.style.backgroundImage = `url(${tile.toDataURL()})`;
    }
  }

  // Five taps within three seconds on the emblem.
  const taps: number[] = [];
  element.querySelector('.wsw-emblem')?.addEventListener('click', () => {
    const now = performance.now();
    taps.push(now);
    while (taps.length > 0 && now - taps[0] > 3000) taps.shift();
    if (taps.length >= 5) {
      taps.length = 0;
      hooks.onEmblemTaps?.();
    }
  });

  // The glow follows the pointer by two CSS variables: no layout, only the one gradient repaints.
  element.addEventListener('pointermove', (e) => {
    const r = element.getBoundingClientRect();
    element.style.setProperty('--gx', `${e.clientX - r.left}px`);
    element.style.setProperty('--gy', `${e.clientY - r.top}px`);
    // The backdrop's layers lean the other way, a few pixels, by where the pointer is (-1 to 1).
    element.style.setProperty('--px', String(((e.clientX - r.left) / r.width) * 2 - 1));
    element.style.setProperty('--py', String(((e.clientY - r.top) / r.height) * 2 - 1));
  });

  const note = element.querySelector<HTMLElement>('.wsw-note')!;
  parent.append(element);
  return {
    element,
    setNote(text) {
      note.textContent = text;
      note.hidden = text === '';
    },
    setBusy(busy) {
      element.classList.toggle('wsw-busy', busy);
      buttons.forEach((b) => {
        b.disabled = busy;
      });
    },
    setVisible(visible) {
      element.style.display = visible ? 'flex' : 'none';
    },
  };
}
