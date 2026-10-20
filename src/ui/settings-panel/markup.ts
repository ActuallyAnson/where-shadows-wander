// The settings panel as UIKitML text, built from the settings table so labels, help lines and ranges have one
// source of truth. Plain TypeScript: the panel loads the string, and the tests read it. No three.js here.
//
// Layout: two pages of six cards, two columns each. A card has the setting's name, big press targets (a
// stepper for numbers, one button for a toggle or a choice) and one line of help. At the panel's real size every
// press target is at least 4 cm square (see PANEL_WIDTH_M), because a fingertip poke is not precise.
import {
  SETTING_SPECS,
  type NumberSpec,
  type SettingSpec,
  type Settings,
} from '../../engine/services/settings/settings';

/** The panel's size in UIKit pixels. */
export const PANEL_WIDTH_PX = 960;
/** The real width of the panel in the room. Pixel sizes below turn into metres through this. */
export const PANEL_WIDTH_M = 0.62;
export const METRES_PER_PX = PANEL_WIDTH_M / PANEL_WIDTH_PX;
/** Every press target is at least this many pixels across: 64 px is 4.1 cm at the panel's real size. */
export const BUTTON_PX = 64;

/** Which settings are on which page: how you play, then sound and extras. Every setting is on exactly one page. */
export const PAGES: readonly (readonly (keyof Settings)[])[] = [
  ['tolerance', 'holdTime', 'shadowSize', 'sharpen', 'flicker', 'highContrast'],
  ['volumeMaster', 'volumeMusic', 'volumeEffects', 'volumeAmbience', 'captions', 'hand'],
];

export const ids = {
  dec: (key: string) => `${key}-dec`,
  inc: (key: string) => `${key}-inc`,
  value: (key: string) => `${key}-value`,
  button: (key: string) => `${key}-button`,
  page: (n: number) => `settings-page-${n}`,
  pageButton: 'settings-page-button',
  reset: 'settings-reset',
  close: 'settings-close',
  title: 'settings-title',
} as const;

/** How a setting's value reads on the panel. */
export function formatValue<K extends keyof Settings>(key: K, value: Settings[K]): string {
  const spec = SETTING_SPECS.find((s) => s.key === key)!;
  if (spec.kind === 'toggle') return value ? 'On' : 'Off';
  if (spec.kind === 'choice') return String(value).replace(/^./, (c) => c.toUpperCase());
  const n = value as number;
  switch (key) {
    case 'holdTime':
      return `${n.toFixed(1)} s`;
    case 'tolerance':
      return n.toFixed(1);
    default:
      return `${Math.round(n * 100)}%`; // shadow size, sharpen, flicker and the volumes
  }
}

/** The text of the page button: it goes on to the next page, and from the last page back to the first. */
export function pageButtonText(page: number, total: number = PAGES.length): string {
  return page < total - 1 ? 'Next page >' : '< First page';
}

/** A page of extra buttons (the debug menu's), as plain data: the panel needs no debug code to show it. */
export interface ExtraPage {
  title: string;
  items: readonly { id: string; label: string; help: string; text(): string }[];
}
export const extraId = (itemId: string) => `extra-${itemId}`;

/** The next value a stepper press gives: `direction` is -1 or 1, and the result stays on the grid and in range. */
export function stepValue(spec: NumberSpec, current: number, direction: -1 | 1): number {
  const next = current + direction * spec.step;
  return Math.min(Math.max(Math.round(next * 1000) / 1000, spec.min), spec.max);
}

/** The value a toggle or a choice moves to when pressed. */
export function nextValue(spec: SettingSpec, current: unknown): boolean | string {
  if (spec.kind === 'toggle') return !current;
  if (spec.kind === 'choice') {
    const i = spec.options.indexOf(current as never);
    return spec.options[(i + 1) % spec.options.length];
  }
  throw new Error(`${spec.key} is a stepper, not a button`);
}

const BIG = BUTTON_PX + 16;

export type Look = 'normal' | 'high';
/** The colours of each class, per look. High contrast is pure black on pure white, with black outlines. */
const WHITE = '#ffffff';
const BLACK = '#000000';
export const PALETTE: Readonly<Record<Look, Readonly<Record<string, Readonly<Record<string, string | number>>>>>> = {
  normal: {
    'wsw-panel': { backgroundColor: '#1c1a17', borderWidth: 0, borderColor: '#1c1a17' },
    'wsw-title': { color: '#f1e9d8' },
    'wsw-card': { backgroundColor: '#2a2622', borderWidth: 0, borderColor: '#2a2622' },
    'wsw-name': { color: '#f1e9d8' },
    'wsw-help': { color: '#bdb4a2' },
    'wsw-value': { color: '#ffb454' },
    'wsw-step': { color: '#1c1a17', backgroundColor: '#e9c46a' },
    'wsw-wide': { color: '#1c1a17', backgroundColor: '#e9c46a' },
    'wsw-action': { color: '#1c1a17', backgroundColor: '#e9c46a' },
  },
  high: {
    'wsw-panel': { backgroundColor: WHITE, borderWidth: 6, borderColor: BLACK },
    'wsw-title': { color: BLACK },
    'wsw-card': { backgroundColor: WHITE, borderWidth: 3, borderColor: BLACK },
    'wsw-name': { color: BLACK },
    'wsw-help': { color: BLACK },
    'wsw-value': { color: BLACK },
    'wsw-step': { color: WHITE, backgroundColor: BLACK },
    'wsw-wide': { color: WHITE, backgroundColor: BLACK },
    'wsw-action': { color: WHITE, backgroundColor: BLACK },
  },
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const colours = (cls: string) =>
  Object.entries(PALETTE.normal[cls] ?? {})
    .map(([k, v]) => `${kebab(k)}: ${typeof v === 'number' ? `${v}px` : v};`)
    .join(' ');

const STYLE = `
<style>
  .wsw-panel { width: ${PANEL_WIDTH_PX}px; flex-direction: column; padding-top: 24px; padding-right: 24px; padding-bottom: 24px; padding-left: 24px; gap: 16px; border-radius: 28px; ${colours('wsw-panel')} }
  .wsw-title { font-size: 44px; font-weight: bold; ${colours('wsw-title')} }
  .wsw-grid { flex-direction: row; flex-wrap: wrap; gap: 16px; width: 100%; }
  .wsw-card { width: 442px; flex-direction: column; gap: 8px; padding-top: 12px; padding-right: 14px; padding-bottom: 12px; padding-left: 14px; border-radius: 18px; ${colours('wsw-card')} }
  .wsw-row { flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; }
  .wsw-name { font-size: 28px; font-weight: bold; flex-shrink: 1; ${colours('wsw-name')} }
  .wsw-help { font-size: 22px; ${colours('wsw-help')} }
  .wsw-stepper { flex-direction: row; align-items: center; gap: 6px; }
  .wsw-value { font-size: 28px; font-weight: bold; text-align: center; width: 92px; ${colours('wsw-value')} }
  .wsw-step { width: ${BIG}px; height: ${BIG}px; font-size: 44px; font-weight: bold; border-radius: 14px; ${colours('wsw-step')} }
  .wsw-wide { width: 190px; height: ${BIG}px; font-size: 30px; font-weight: bold; border-radius: 14px; ${colours('wsw-wide')} }
  .wsw-footer { flex-direction: row; gap: 14px; width: 100%; }
  .wsw-action { flex-grow: 1; flex-basis: 0; height: 84px; font-size: 32px; font-weight: bold; border-radius: 16px; ${colours('wsw-action')} }
</style>`;

function cardFor(spec: SettingSpec, settings: Readonly<Settings>): string {
  const value = formatValue(spec.key, settings[spec.key] as never);
  const control =
    spec.kind === 'number'
      ? `<div class="wsw-stepper"><button class="wsw-step" id="${ids.dec(spec.key)}">-</button><div class="wsw-value" id="${ids.value(spec.key)}">${value}</div><button class="wsw-step" id="${ids.inc(spec.key)}">+</button></div>`
      : `<button class="wsw-wide" id="${ids.button(spec.key)}">${value}</button>`;
  return `<div class="wsw-card"><div class="wsw-row"><div class="wsw-name">${escape(spec.label)}</div>${control}</div><div class="wsw-help">${escape(spec.help)}</div></div>`;
}

function extraCard(item: ExtraPage['items'][number]): string {
  return `<div class="wsw-card"><div class="wsw-row"><div class="wsw-name">${escape(item.label)}</div><button class="wsw-wide" id="${extraId(item.id)}">${escape(item.text())}</button></div><div class="wsw-help">${escape(item.help)}</div></div>`;
}

/** The whole panel as UIKitML, showing `settings`. Every page is in it; the panel hides all but the first once loaded. */
export function settingsMarkup(settings: Readonly<Settings>, extra: readonly ExtraPage[] = []): string {
  const page = (keys: readonly (keyof Settings)[], n: number) =>
    `<div class="wsw-grid" id="${ids.page(n)}">${keys
      .map((k) =>
        cardFor(
          SETTING_SPECS.find((s) => s.key === k)!,
          settings,
        ),
      )
      .join('')}</div>`;
  return `${STYLE}
<div class="wsw-panel">
  <div class="wsw-title" id="${ids.title}">Settings</div>
  ${PAGES.map((keys, n) => page(keys, n)).join('\n  ')}
  ${extra.map((p, i) => `<div class="wsw-grid" id="${ids.page(PAGES.length + i)}">${p.items.map(extraCard).join('')}</div>`).join('\n  ')}
  <div class="wsw-footer"><button class="wsw-action" id="${ids.pageButton}">${pageButtonText(0, PAGES.length + extra.length)}</button><button class="wsw-action" id="${ids.reset}">Reset to defaults</button><button class="wsw-action" id="${ids.close}">Close</button></div>
</div>`;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
