// The settings as a plain page over the title screen, for before the player puts the headset on (the same rows the in-room
// settings screen shows, from screen-model.ts, and the same SettingsStore, so a change here is the change there). Buttons
// and text only; it stays out of the way until opened.
import type { Settings } from '../../engine/services/settings/settings';
import type { SettingsStore } from '../../engine/services/settings/settings-store';
import { PAGES } from './markup';
import { pressedValue, rowsFor, type Row } from './screen-model';

const STYLE_ID = 'wsw-settings-page-style';
const CSS = `
.wsw-sp{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:rgba(5,7,13,.92);color:#e9eef6;font-family:'Cinzel','Cinzel Decorative',Georgia,serif;overflow:auto}
.wsw-sp.wsw-open{display:flex}
.wsw-sp-box{width:min(560px,92vw);padding:4vmin 3vmin;box-sizing:border-box}
.wsw-sp h2{margin:0 0 1vmin;text-align:center;font-weight:400;letter-spacing:.3em;font-size:clamp(20px,4vmin,32px)}
.wsw-sp-help{min-height:2.6em;text-align:center;font-size:clamp(12px,2vmin,15px);color:#8d97a8;margin:0 0 1.5vmin}
.wsw-sp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;border-bottom:1px solid rgba(170,179,196,.15)}
.wsw-sp-name{font-size:clamp(14px,2.4vmin,18px);color:#b6beca}
.wsw-sp-ctl{display:flex;align-items:center;gap:8px}
.wsw-sp button{font-family:inherit;color:#e9eef6;background:rgba(170,179,196,.1);border:1px solid rgba(170,179,196,.35);border-radius:6px;min-width:48px;min-height:44px;font-size:18px;cursor:pointer;padding:0 12px}
.wsw-sp button:hover,.wsw-sp button:focus-visible{background:rgba(255,216,154,.18);border-color:#ffd89a;outline:none}
.wsw-sp-val{min-width:84px;text-align:center;font-size:clamp(14px,2.4vmin,18px)}
.wsw-sp-foot{display:flex;justify-content:center;gap:12px;margin-top:2.5vmin}
`;

export interface SettingsPage {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

export function createSettingsPage(store: SettingsStore, parent: HTMLElement = document.body): SettingsPage {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.append(style);
  }
  const el = document.createElement('section');
  el.className = 'wsw-sp';
  el.setAttribute('aria-label', 'Settings');
  const box = document.createElement('div');
  box.className = 'wsw-sp-box';
  const title = document.createElement('h2');
  title.textContent = 'SETTINGS';
  const help = document.createElement('p');
  help.className = 'wsw-sp-help';
  const list = document.createElement('div');
  const foot = document.createElement('div');
  foot.className = 'wsw-sp-foot';
  const make = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };
  foot.append(
    make('Reset', () => store.reset()),
    make('Back', () => page.close()),
  );
  box.append(title, help, list, foot);
  el.append(box);
  parent.append(el);

  // Every setting, on one scrolling page (the in-room screen needs pages; a window does not).
  const rows = (): Row[] => PAGES.flatMap((_, p) => rowsFor(p, store.value as Readonly<Settings>, []));
  const draw = (): void => {
    list.replaceChildren();
    for (const row of rows()) {
      const r = document.createElement('div');
      r.className = 'wsw-sp-row';
      const name = document.createElement('span');
      name.className = 'wsw-sp-name';
      name.textContent = row.label;
      const ctl = document.createElement('div');
      ctl.className = 'wsw-sp-ctl';
      const val = document.createElement('span');
      val.className = 'wsw-sp-val';
      val.textContent = row.value;
      const apply = (code: number) => {
        const change = pressedValue(row, code, store.value as Readonly<Settings>);
        if (change) store.set(change.key, change.value as never);
      };
      if (row.kind === 'step')
        ctl.append(
          make('−', () => apply(0)),
          val,
          make('+', () => apply(1)),
        );
      else ctl.append(make(row.value, () => apply(1)));
      r.addEventListener('pointerenter', () => (help.textContent = row.help));
      r.addEventListener('focusin', () => (help.textContent = row.help));
      r.append(name, ctl);
      list.append(r);
    }
  };
  store.subscribe(() => {
    if (page.isOpen) draw();
  });
  const page: SettingsPage = {
    get isOpen() {
      return el.classList.contains('wsw-open');
    },
    open() {
      draw();
      help.textContent = '';
      el.classList.add('wsw-open');
    },
    close() {
      el.classList.remove('wsw-open');
    },
  };
  return page;
}
