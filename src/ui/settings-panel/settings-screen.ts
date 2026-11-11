// The settings screen in the room, in the menu style (mist, serif text, a lit item with arrows). It is content for the
// MenuPanel: this file paints it, turns a press into a change in the SettingsStore (which applies it live and saves it),
// and keeps the same small interface the old UIKit panel had (open, close, isOpen, refreshExtra). Painted again only when
// a value or the reached item changes; nothing here runs per frame.
import type { Settings } from '../../engine/services/settings/settings';
import type { SettingsStore } from '../../engine/services/settings/settings-store';
import { TITLE_V, RULE_V, LINE_V } from '../menu-panel/menu-layout';
import { arrow, HIGH, INK, MENU_CANVAS_PX, MENU_FONT, ornament } from '../menu-panel/menu-art';
import type { MenuContent, MenuPanel } from '../menu-panel/menu-panel';
import { PAGES } from './markup';
import {
  codeRow,
  DEC_U,
  FOOTER_CODE,
  FOOTER_U,
  FOOTER_V,
  footerLabels,
  hitAt,
  INC_U,
  isFooter,
  LABEL_U,
  pageCount,
  pageTitle,
  pressedValue,
  rowsFor,
  rowV,
  VALUE_U,
  type ExtraPageItems,
  type Row,
} from './screen-model';

const FAMILY = `'${MENU_FONT}', 'Cinzel Decorative', Georgia, serif`;
const LABEL_MAX_PX = 0.4 * MENU_CANVAS_PX;

export class SettingsScreen implements MenuContent {
  private extra: ExtraPageItems[] = [];
  private extraLoaded = false;
  private page = 0;
  private rows: Row[] = [];
  private opened = false;
  private readonly unsubscribe: () => void;
  /** Why the screen could not open, for the diagnostics report. */
  lastError: string | null = null;
  /** Called after the screen opens or closes. */
  onVisibilityChange: ((open: boolean) => void) | null = null;

  constructor(
    private readonly menu: MenuPanel,
    private readonly store: SettingsStore,
    /** Extra pages after the settings (the debug menu), asked for once, when the screen first opens. */
    private readonly extraPages: () => ExtraPageItems[] = () => [],
  ) {
    this.unsubscribe = store.subscribe(() => this.changed());
  }

  get isOpen(): boolean {
    return this.opened && this.menu.showing === this;
  }

  /** Opens in front of `head`, facing (fx, fz), at the first page, or at the extra page titled `startAt` if there is one. */
  async open(head: ArrayLike<number>, fx: number, fz: number, startAt?: string): Promise<boolean> {
    if (!this.extraLoaded) {
      this.extra = this.extraPages();
      this.extraLoaded = true;
    }
    const extra = startAt === undefined ? -1 : this.extra.findIndex((p) => p.title === startAt);
    this.page = extra < 0 ? 0 : PAGES.length + extra;
    this.readRows();
    const ok = await this.menu.showContent(this, head, fx, fz);
    if (ok && !this.opened) {
      this.opened = true;
      this.onVisibilityChange?.(true);
    }
    return ok;
  }

  close(): void {
    if (this.menu.showing === this) this.menu.hide();
    this.finishClose();
  }

  dispose(): void {
    this.close();
    this.unsubscribe();
  }

  /** The debug buttons' text changed (a key press elsewhere): draw it again. */
  refreshExtra(): void {
    if (this.isOpen && this.page >= PAGES.length) this.changed();
  }

  hitAt(u: number, v: number): number {
    return hitAt(this.rows, u, v);
  }

  press(code: number): void {
    try {
      if (isFooter(code)) return this.pressFooter(code - FOOTER_CODE);
      const row = this.rows[codeRow(code)];
      const change = pressedValue(row, code, this.store.value);
      if (change) this.store.set(change.key, change.value as never);
      else this.extra[this.page - PAGES.length]?.items.find((i) => i.id === row.id)?.press();
      this.changed();
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
    }
  }

  private pressFooter(n: number): void {
    if (n === 0) {
      this.page = (this.page + 1) % pageCount(this.extra);
      this.changed();
    } else if (n === 1) this.store.reset();
    else this.close();
  }

  private finishClose(): void {
    if (this.opened) {
      this.opened = false;
      this.onVisibilityChange?.(false);
    }
  }

  private readRows(): void {
    this.rows = rowsFor(this.page, this.store.value as Readonly<Settings>, this.extra);
  }

  private changed(): void {
    if (this.menu.showing !== this) return;
    this.readRows();
    this.menu.repaint();
  }

  paint(g: CanvasRenderingContext2D, hover: number, high: boolean): void {
    const W = MENU_CANVAS_PX;
    const ink = high ? HIGH : INK;
    const cx = W / 2;
    g.clearRect(0, 0, W, W);
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    const spaced = (px: string) => ((g as unknown as { letterSpacing: string }).letterSpacing = px);

    g.fillStyle = ink.title;
    g.font = `400 84px ${FAMILY}`;
    spaced('10px');
    g.fillText(pageTitle(this.page, this.extra).toUpperCase(), cx + 5, TITLE_V * W);
    spaced('0px');
    ornament(g, cx, RULE_V * W, 250, ink.rule);

    // The help line of the reached row sits under the title (so each setting still says what it does).
    const reached = hover >= 0 && !isFooter(hover) ? this.rows[codeRow(hover)] : undefined;
    g.fillStyle = ink.line;
    let help = 26;
    do {
      g.font = `400 ${help}px ${FAMILY}`;
      help -= 2;
    } while (g.measureText(reached?.help ?? '').width > W * 0.88 && help > 14);
    g.fillText(reached?.help ?? '', cx, LINE_V * W);

    const lit = hover >= 0 && !isFooter(hover) ? codeRow(hover) : -1;
    this.rows.forEach((row, i) => {
      const y = rowV(i) * W;
      const on = i === lit;
      g.shadowColor = on && !high ? 'rgba(220,230,255,0.75)' : 'transparent';
      g.shadowBlur = on && !high ? 18 : 0;
      g.fillStyle = on ? ink.lit : ink.dim;
      g.textAlign = 'left';
      let size = 32;
      do {
        g.font = `400 ${size}px ${FAMILY}`;
        size -= 2;
      } while (g.measureText(row.label).width > LABEL_MAX_PX && size > 14);
      g.fillText(row.label, LABEL_U * W, y);
      g.textAlign = 'center';
      g.font = `400 32px ${FAMILY}`;
      g.fillText(row.value, VALUE_U * W, y);
      if (row.kind === 'step') {
        g.fillStyle = on ? ink.lit : ink.dim;
        arrow(g, ((DEC_U[0] + DEC_U[1]) / 2) * W, y, -1);
        arrow(g, ((INC_U[0] + INC_U[1]) / 2) * W, y, 1);
      }
      g.shadowBlur = 0;
      g.shadowColor = 'transparent';
    });

    const labels = footerLabels(this.page, this.extra);
    labels.forEach((text, j) => {
      const on = hover === FOOTER_CODE + j;
      g.shadowColor = on && !high ? 'rgba(220,230,255,0.75)' : 'transparent';
      g.shadowBlur = on && !high ? 18 : 0;
      g.fillStyle = on ? ink.lit : ink.dim;
      g.font = `400 ${on ? 36 : 32}px ${FAMILY}`;
      g.fillText(text, FOOTER_U[j] * W, FOOTER_V * W);
    });
    g.shadowBlur = 0;
    g.shadowColor = 'transparent';
  }
}
