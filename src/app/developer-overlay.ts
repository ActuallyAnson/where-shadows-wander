// The developer overlay (dev and tester builds only): a 🛠 button at the top left of the page that opens a panel in the
// style of the emulator's own (the toolbar, the Hand [L]/[R] panels). It is page UI, not part of the room: at a desk it
// sits over the emulator's view during the session (top left: the Hand Lab panel is on the right, the emulator's
// Hand [L] panel at the bottom left); inside a real headset it cannot be seen (a page is not drawn in VR).
// The rows are the developer buttons (developer-page.ts) and the debug menu's pages (DebugController.pages()):
// each row shows its current value, and a click presses it. Built when opened; refreshed on a press, on a debug key, and
// twice a second while open (a recording's state changes by itself).
import type { ExtraPageItems } from '../ui/settings-panel/screen-model';

export interface DeveloperOverlay {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  toggle(open?: boolean): void;
  /** Reads every row's value (and the error line) again. */
  refresh(): void;
}

const PANEL_CSS =
  'position:fixed;top:56px;left:12px;z-index:10000;width:300px;max-height:max(200px,calc(100vh - 260px));overflow-y:auto;' +
  'display:none;flex-direction:column;gap:2px;padding:10px;box-sizing:border-box;border-radius:10px;' +
  'background:rgba(28,28,32,0.94);border:1px solid rgba(255,255,255,0.08);box-shadow:0 6px 20px rgba(0,0,0,0.45);' +
  'font:12px/1.4 system-ui,-apple-system,sans-serif;color:#e6e6e6;overscroll-behavior:contain;';
const TOGGLE_CSS =
  'position:fixed;top:8px;left:12px;z-index:10000;height:38px;padding:0 12px;border-radius:10px;cursor:pointer;' +
  'background:rgba(28,28,32,0.94);border:1px solid rgba(255,255,255,0.08);color:#e6e6e6;' +
  'font:600 13px system-ui,-apple-system,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,0.45);';
const VALUE_CSS =
  'flex:none;min-width:72px;max-width:120px;padding:4px 8px;border-radius:6px;cursor:pointer;text-align:center;' +
  'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#e6e6e6;font:600 11px system-ui,sans-serif;' +
  'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
const ON = /^(ON|SHOWN|on|Recording|Replaying)/;

export function mountDeveloperOverlay(
  sections: () => ExtraPageItems[],
  parent: HTMLElement = document.body,
): DeveloperOverlay {
  let open = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const rows: { item: ExtraPageItems['items'][number]; value: HTMLButtonElement; note: HTMLElement | null }[] = [];

  const toggleButton = document.createElement('button');
  toggleButton.type = 'button';
  toggleButton.id = 'wsw-dev-toggle';
  toggleButton.textContent = '🛠 Dev';
  toggleButton.title = 'Developer tools (dev and tester builds)';
  toggleButton.style.cssText = TOGGLE_CSS;

  const panel = document.createElement('div');
  panel.id = 'wsw-dev-overlay';
  panel.style.cssText = PANEL_CSS;

  const refresh = () => {
    for (const r of rows) {
      const text = r.item.text();
      r.value.textContent = text;
      const on = ON.test(text);
      r.value.style.color = on ? '#7ee787' : '#e6e6e6';
      r.value.style.borderColor = on ? 'rgba(46,160,67,0.6)' : 'rgba(255,255,255,0.1)';
      if (r.note) r.note.textContent = r.item.help;
    }
  };

  const build = () => {
    panel.replaceChildren();
    rows.length = 0;
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;font-size:13px;';
    title.textContent = '🛠 Developer';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '✕';
    close.title = 'Close';
    close.style.cssText =
      'background:none;border:none;color:#ff7b72;font-size:14px;cursor:pointer;padding:2px 4px;line-height:1;';
    close.onclick = () => toggle(false);
    header.append(title, close);
    panel.append(header);

    for (const section of sections()) {
      const h = document.createElement('div');
      h.style.cssText =
        'margin:8px 0 2px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#8b949e;';
      h.textContent = section.title.replace(/^Debug: /, '');
      panel.append(h);
      for (const item of section.items) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:3px 0;';
        row.title = item.help;
        const labelBox = document.createElement('div');
        labelBox.style.cssText = 'flex:1;min-width:0;';
        const label = document.createElement('div');
        label.textContent = item.label;
        labelBox.append(label);
        // The error row says the newest error under its label; the others keep their help as a tooltip.
        let note: HTMLElement | null = null;
        if (item.id === 'errors') {
          note = document.createElement('div');
          note.style.cssText = 'font-size:10px;color:#8b949e;word-break:break-word;';
          labelBox.append(note);
        }
        const value = document.createElement('button');
        value.type = 'button';
        value.style.cssText = VALUE_CSS;
        value.onclick = () => {
          value.blur(); // keep Space and the Hand Lab's keys from pressing it again
          try {
            item.press();
          } finally {
            refresh();
          }
        };
        row.append(labelBox, value);
        panel.append(row);
        rows.push({ item, value, note });
      }
    }
    refresh();
  };

  const toggle = (next = !open) => {
    open = next;
    toggleButton.blur();
    if (open) {
      build();
      timer ??= setInterval(refresh, 500);
    } else if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    panel.style.display = open ? 'flex' : 'none';
  };
  toggleButton.onclick = () => toggle();

  parent.append(toggleButton, panel);
  return {
    element: panel,
    get isOpen() {
      return open;
    },
    toggle,
    refresh: () => {
      if (open) refresh();
    },
  };
}
