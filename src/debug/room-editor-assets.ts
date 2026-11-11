// The room editor's asset browser: the model files under src/assets/models, docked along the bottom of the window. The folder
// tree is on the left; the folder open in it is shown on the right as tiles with a thumbnail of each model. Drag the top edge
// to resize it. Import .glb files (the Import button, or drag them from the computer onto a folder), make, rename, move (drag
// onto a folder) and delete files and folders, and place a model in the room (Add to room, a double click, or drag it into
// the view). Changes go through the dev server (asset-client.ts, vite.config.ts); without one the tree is read-only.
import {
  baseName,
  joinPath,
  parentOf,
  suggestModelName,
  type AssetFileInfo,
  type AssetFolder,
} from '../engine/services/assets/asset-tree';
import type { AssetClient, AssetResult, AssetState } from './asset-client';
import { AssetThumbs } from './asset-thumbs';

/** The drag data type of an asset dragged from the browser: JSON `{ path, folder }`. */
export const ASSET_DRAG_TYPE = 'application/x-wsw-asset';
/** Below this window width the browser is not shown (the editor's own panel takes the bottom). */
const MIN_WINDOW_W = 700;
const FOLDED_H = 34;
const MIN_H = 150;
const DEFAULT_H = 240;
const HEIGHT_KEY = 'wsw.roomEditor.assetsHeight';

export interface AssetDrag {
  readonly path: string;
  readonly folder: boolean;
}

export interface AssetPanelHost {
  /** Places a model in the room where the view is looking. */
  addToRoom(file: AssetFileInfo): void;
  /** The files changed (the tree is `state`). */
  changed(state: AssetState): void;
  /** The browser was shown, hidden, folded or resized: the view fits the space again. */
  resized(): void;
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const kb = (bytes: number): string => (bytes === 0 ? '' : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const thumbKey = (file: AssetFileInfo): string => `${file.path}:${file.mtimeMs}`;

/** Reads the drag data of an asset dragged from the browser, or null. */
export function assetDragOf(e: DragEvent): AssetDrag | null {
  const raw = e.dataTransfer?.getData(ASSET_DRAG_TYPE);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as AssetDrag;
    return typeof d.path === 'string' ? d : null;
  } catch {
    return null;
  }
}

export class AssetPanel {
  readonly root = document.createElement('aside');
  private readonly picker = document.createElement('input');
  private readonly grip = document.createElement('div');
  private readonly body = document.createElement('div');
  private readonly thumbs = new AssetThumbs();
  /** Folders open in the tree (the models folder always is). */
  private readonly expanded = new Set<string>();
  /** The folder whose files are shown as tiles. */
  private cwd = '';
  private selected: { path: string; folder: boolean } | null = null;
  private message = '';
  private folded = false;
  private shown = false;
  private openHeight = readHeight();

  /** @param right how much of the window's right side the editor's own panel covers */
  constructor(
    private readonly client: AssetClient,
    private readonly host: AssetPanelHost,
    private right: number,
  ) {
    this.mount();
  }

  /** Follows the editor's panel when it is resized. */
  setRight(px: number): void {
    if (px === this.right) return;
    this.right = px;
    this.root.style.right = `${px}px`;
  }

  /** How much of the window's bottom the browser covers (0 when hidden). */
  get height(): number {
    if (!this.shown || window.innerWidth < MIN_WINDOW_W) return 0;
    return this.folded ? FOLDED_H : this.clampedHeight();
  }

  show(): void {
    this.shown = true;
    this.root.style.display = '';
    this.applyHeight();
    void this.refresh();
  }

  hide(): void {
    this.shown = false;
    this.root.style.display = 'none';
    this.thumbs.dispose();
  }

  /** Reads the tree again. */
  async refresh(): Promise<void> {
    const state = await this.client.refresh();
    if (!folderAt(state.tree, this.cwd)) this.cwd = '';
    this.render();
    this.host.changed(state);
  }

  /** Imports files from the computer into `folder`; one already there is replaced only if the user says so. */
  async importFiles(files: readonly File[], folder: string): Promise<void> {
    const done: string[] = [],
      failed: string[] = [];
    for (const file of files) {
      if (!/\.glb$/i.test(file.name)) {
        failed.push(`${file.name}: only .glb models can be imported`);
        continue;
      }
      const path = joinPath(folder, suggestModelName(file.name));
      const bytes = await file.arrayBuffer();
      let result = await this.client.writeFile(path, bytes);
      if (!result.ok && result.error.startsWith('there is already') && confirm(`Replace ${path}?`))
        result = await this.client.writeFile(path, bytes, true);
      if (result.ok) done.push(path);
      else failed.push(`${file.name}: ${result.error}`);
    }
    this.openFolder(folder);
    if (done.length === 1) this.selected = { path: done[0], folder: false };
    this.message = [done.length ? `Imported ${done.join(', ')}` : '', ...failed].filter(Boolean).join('\n');
    this.afterChange();
  }

  /** Writes bytes to a model file (an exported piece), as a change the browser shows. */
  async write(path: string, bytes: Uint8Array, overwrite: boolean): Promise<AssetResult> {
    const result = await this.client.writeFile(path, bytes, overwrite);
    if (result.ok) {
      this.openFolder(parentOf(path));
      this.selected = { path, folder: false };
      this.afterChange();
    }
    return result;
  }

  /** Shows `folder`'s files, opening the tree down to it. */
  private openFolder(folder: string): void {
    this.cwd = folder;
    for (let f = folder; f !== ''; f = parentOf(f)) this.expanded.add(f);
  }

  private async change(result: Promise<AssetResult>, done: string): Promise<boolean> {
    const r = await result;
    this.message = r.ok ? done : r.error;
    if (r.ok && !folderAt(r.state.tree, this.cwd)) this.cwd = '';
    this.afterChange();
    return r.ok;
  }

  private afterChange(): void {
    this.render();
    const state = this.client.current;
    if (state) this.host.changed(state);
  }

  /** The folder an action applies to: the selected folder, else the folder shown. */
  private targetFolder(): string {
    return this.selected?.folder ? this.selected.path : this.cwd;
  }

  private async newFolder(): Promise<void> {
    const parent = this.targetFolder();
    const name = prompt(`New folder in ${parent === '' ? 'models' : parent}:`, 'new-folder');
    if (!name) return;
    const path = joinPath(parent, name.trim());
    if (await this.change(this.client.makeFolder(path), `Made ${path}`)) {
      this.openFolder(parent);
      this.selected = { path, folder: true };
      this.render();
    }
  }

  private async rename(): Promise<void> {
    const sel = this.selected;
    if (!sel || sel.path === '') return;
    const old = baseName(sel.path);
    const stem = sel.folder ? old : old.replace(/\.glb$/, '');
    const name = prompt(`Rename ${sel.path} to:`, stem)?.trim();
    if (!name || name === stem) return;
    const to = joinPath(parentOf(sel.path), sel.folder ? name : `${name.replace(/\.glb$/i, '')}.glb`);
    if (await this.change(this.client.move(sel.path, to), `Renamed to ${to}`)) {
      if (sel.folder && (this.cwd === sel.path || this.cwd.startsWith(`${sel.path}/`)))
        this.openFolder(to + this.cwd.slice(sel.path.length));
      this.selected = { path: to, folder: sel.folder };
      this.render();
    }
  }

  private async moveInto(drag: AssetDrag, folder: string): Promise<void> {
    const to = joinPath(folder, baseName(drag.path));
    if (to === drag.path || folder === drag.path || folder.startsWith(`${drag.path}/`)) return;
    if (await this.change(this.client.move(drag.path, to), `Moved to ${to}`)) {
      if (folder !== '') this.expanded.add(folder);
      this.selected = { path: to, folder: drag.folder };
      this.render();
    }
  }

  private async remove(): Promise<void> {
    const sel = this.selected;
    if (!sel || sel.path === '') return;
    if (!confirm(`Delete ${sel.path}${sel.folder ? ' and everything in it' : ''}? This deletes the file(s).`)) return;
    if (await this.change(this.client.remove(sel.path), `Deleted ${sel.path}`)) {
      this.selected = null;
      this.render();
    }
  }

  private fileAt(path: string): AssetFileInfo | undefined {
    const find = (f: AssetFolder): AssetFileInfo | undefined =>
      f.files.find((x) => x.path === path) ?? f.folders.map(find).find(Boolean);
    const tree = this.client.current?.tree;
    return tree ? find(tree) : undefined;
  }

  // --- size ---

  private clampedHeight(): number {
    return Math.round(Math.min(Math.max(this.openHeight, MIN_H), window.innerHeight * 0.7));
  }

  private applyHeight(): void {
    this.root.style.height = `${this.folded ? FOLDED_H : this.clampedHeight()}px`;
    this.host.resized();
  }

  /** Dragging the top edge sets the height (kept for the next time the editor opens). */
  private startResize(e: PointerEvent): void {
    if (this.folded || e.button !== 0) return;
    e.preventDefault();
    this.grip.setPointerCapture(e.pointerId);
    this.root.classList.add('resizing');
    const move = (ev: PointerEvent) => {
      this.openHeight = window.innerHeight - ev.clientY;
      this.applyHeight();
    };
    const up = () => {
      this.grip.removeEventListener('pointermove', move);
      this.grip.removeEventListener('pointerup', up);
      this.grip.removeEventListener('pointercancel', up);
      this.root.classList.remove('resizing');
      this.openHeight = this.clampedHeight();
      try {
        localStorage.setItem(HEIGHT_KEY, String(this.openHeight));
      } catch {
        // No storage (a private window): the height is kept for this page only.
      }
    };
    this.grip.addEventListener('pointermove', move);
    this.grip.addEventListener('pointerup', up);
    this.grip.addEventListener('pointercancel', up);
  }

  // --- the page ---

  private mount(): void {
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    document.head.append(style);
    this.root.className = 'room-assets';
    this.root.style.display = 'none';
    this.root.style.right = `${this.right}px`;
    this.picker.type = 'file';
    this.picker.accept = '.glb';
    this.picker.multiple = true;
    this.picker.hidden = true;
    this.picker.addEventListener('change', () => {
      const files = [...(this.picker.files ?? [])];
      this.picker.value = '';
      if (files.length) void this.importFiles(files, this.targetFolder());
    });
    this.grip.className = 'grip';
    this.grip.title = 'Drag to resize';
    this.grip.addEventListener('pointerdown', (e) => this.startResize(e));
    this.grip.addEventListener('dblclick', () => {
      this.openHeight = DEFAULT_H;
      this.applyHeight();
    });
    this.body.className = 'body';
    this.root.append(this.picker, this.grip, this.body);
    window.addEventListener('resize', () => {
      if (this.shown) this.applyHeight();
    });

    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-path]');
      if (!el) {
        // A click on the empty part of the tiles clears the selection.
        if ((e.target as HTMLElement).closest('.grid')) {
          this.selected = null;
          this.render();
        }
        return;
      }
      const act = el.dataset.act;
      if (act === 'import') return this.picker.click();
      if (act === 'mkdir') return void this.newFolder();
      if (act === 'refresh') return void this.refresh();
      if (act === 'fold') {
        this.folded = !this.folded;
        this.render();
        return this.applyHeight();
      }
      if (act === 'rename') return void this.rename();
      if (act === 'delete') return void this.remove();
      if (act === 'add') {
        const file = this.selected && !this.selected.folder ? this.fileAt(this.selected.path) : undefined;
        if (file) this.host.addToRoom(file);
        return;
      }
      if (act === 'twist') {
        const path = el.dataset.folder ?? '';
        if (!this.expanded.delete(path)) this.expanded.add(path);
        return this.render();
      }
      if (act === 'crumb') {
        this.openFolder(el.dataset.folder ?? '');
        this.selected = null;
        return this.render();
      }
      const path = el.dataset.path;
      if (path === undefined) return;
      const folder = el.dataset.kind === 'folder';
      // A folder in the tree is opened (its files shown); a tile is only selected.
      if (folder && el.closest('.tree')) {
        if (this.cwd === path && path !== '') {
          if (!this.expanded.delete(path)) this.expanded.add(path);
        } else this.openFolder(path);
      }
      this.selected = { path, folder };
      this.render();
    });
    this.root.addEventListener('dblclick', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.grid [data-path]');
      if (!el || el.dataset.path === undefined) return;
      if (el.dataset.kind === 'folder') {
        this.openFolder(el.dataset.path);
        this.selected = null;
        return this.render();
      }
      const file = this.fileAt(el.dataset.path);
      if (file) this.host.addToRoom(file);
    });

    // Dragging: a file or folder (onto a folder to move it, or into the view to place it), or files from the computer.
    this.root.addEventListener('dragstart', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-path]');
      if (!el || !e.dataTransfer || !this.client.current) return;
      const drag: AssetDrag = { path: el.dataset.path ?? '', folder: el.dataset.kind === 'folder' };
      e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(drag));
      e.dataTransfer.setData('text/plain', drag.path);
      e.dataTransfer.effectAllowed = 'copyMove';
    });
    /** The folder a drop lands in: a folder row or tile, else the folder shown. */
    const dropTarget = (e: DragEvent): { folder: string; el: Element | null } => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-kind="folder"]');
      return el ? { folder: el.dataset.path ?? '', el } : { folder: this.cwd, el: this.body.querySelector('.grid') };
    };
    const accepts = (e: DragEvent) => {
      const types = e.dataTransfer?.types ?? [];
      return types.includes('Files') || types.includes(ASSET_DRAG_TYPE);
    };
    const clearDrop = () => {
      for (const el of this.root.querySelectorAll('.drop')) el.classList.remove('drop');
    };
    this.root.addEventListener('dragover', (e) => {
      if (!accepts(e)) return;
      e.preventDefault();
      clearDrop();
      dropTarget(e).el?.classList.add('drop');
    });
    this.root.addEventListener('dragleave', (e) => {
      if (!this.root.contains(e.relatedTarget as Node | null)) clearDrop();
    });
    this.root.addEventListener('drop', (e) => {
      if (!accepts(e)) return;
      e.preventDefault();
      clearDrop();
      const { folder } = dropTarget(e);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) return void this.importFiles(files, folder);
      const drag = assetDragOf(e);
      if (drag) void this.moveInto(drag, folder);
    });
    document.body.append(this.root);
  }

  private render(): void {
    const state = this.client.current;
    this.root.classList.toggle('folded', this.folded);
    const live = state?.live ?? false;
    const used = new Set(state?.used ?? []);
    const sel = this.selected;
    const selFile = sel && !sel.folder ? this.fileAt(sel.path) : undefined;
    const locked = !live || (selFile !== undefined && used.has(selFile.id)) || sel?.path === '';
    const off = (disabled: boolean) => (disabled ? 'disabled' : '');

    const crumbs = ['', ...this.cwd.split('/').filter(Boolean)]
      .map((name, i, all) => {
        const path = all.slice(1, i + 1).join('/');
        return `<button class="crumb" data-act="crumb" data-folder="${esc(path)}">${esc(i === 0 ? 'models' : name)}</button>`;
      })
      .join('<span class="sep">/</span>');
    const actions = sel
      ? `${selFile ? '<button data-act="add" class="primary">Add to room</button>' : ''}
         <button data-act="rename" ${off(locked)}>Rename</button>
         <button data-act="delete" ${off(locked)}>Delete</button>`
      : '';
    const head = `<header>
        <button class="fold" data-act="fold" title="${this.folded ? 'Show' : 'Fold away'} the assets">${this.folded ? '▴' : '▾'}</button>
        <h1>Assets</h1>
        ${this.folded ? '' : `<nav class="crumbs">${crumbs}</nav>`}
        <span class="gap"></span>
        ${this.folded ? '' : actions}
        <span class="div"></span>
        <button data-act="import" ${off(!live)} title="Or drag .glb files from your computer onto a folder">Import…</button>
        <button data-act="mkdir" ${off(!live)}>New folder</button>
        <button data-act="refresh" title="Read the folder again">↻</button>
      </header>`;
    if (this.folded) {
      this.body.innerHTML = head;
      return;
    }

    const folderRows = (f: AssetFolder, depth: number): string =>
      f.folders
        .map((sub) => {
          const open = this.expanded.has(sub.path);
          const twist = sub.folders.length
            ? `<span class="tw" data-act="twist" data-folder="${esc(sub.path)}">${open ? '▾' : '▸'}</span>`
            : '<span class="tw"></span>';
          return (
            `<div class="item${this.cwd === sub.path ? ' cwd' : ''}${sel?.path === sub.path ? ' on' : ''}"
              style="padding-left:${6 + depth * 14}px" data-path="${esc(sub.path)}" data-kind="folder" draggable="${live}">
              ${twist}<span class="ic">${open ? '📂' : '📁'}</span><span class="nm">${esc(sub.name)}</span>
              <small>${sub.files.length || ''}</small></div>` + (open ? folderRows(sub, depth + 1) : '')
          );
        })
        .join('');
    const tree = state
      ? `<div class="item${this.cwd === '' ? ' cwd' : ''}${sel?.path === '' ? ' on' : ''}" data-path="" data-kind="folder">
           <span class="tw"></span><span class="ic">📂</span><span class="nm">models</span></div>${folderRows(state.tree, 1)}`
      : '<p class="hint">Reading…</p>';

    const shown = state ? folderAt(state.tree, this.cwd) : undefined;
    const tiles = shown
      ? [
          ...shown.folders.map(
            (
              f,
            ) => `<div class="tile folder${sel?.path === f.path ? ' on' : ''}" data-path="${esc(f.path)}" data-kind="folder"
              draggable="${live}" title="${esc(f.path)} (double-click to open)">
              <div class="pic">📁</div><div class="nm">${esc(f.name)}</div></div>`,
          ),
          ...shown.files.map((file) => {
            const src = this.thumbs.get(thumbKey(file));
            const pic = src ? `<img src="${src}" alt="">` : src === '' ? '◆' : '<span class="wait"></span>';
            return `<div class="tile${sel?.path === file.path ? ' on' : ''}" data-path="${esc(file.path)}" data-kind="file"
              draggable="true" title="${esc(file.id)} · ${kb(file.bytes) || 'size unknown'}\nDouble-click or drag into the room to place it">
              <div class="pic" data-thumb="${esc(thumbKey(file))}">${pic}</div>
              <div class="nm">${used.has(file.id) ? '<span class="used" title="Placed in the room">●</span>' : ''}${esc(
                baseName(file.path).replace(/\.glb$/, ''),
              )}</div><small>${kb(file.bytes)}</small></div>`;
          }),
        ].join('')
      : '';
    const empty = shown && !tiles ? '<p class="hint">Empty. Drag .glb files here to import them.</p>' : '';
    const foot = [
      live ? '' : 'No dev server: read-only.',
      this.message,
      !this.message && !sel ? 'Double-click a model, or drag it into the room, to place it.' : '',
    ]
      .filter(Boolean)
      .join('\n');

    this.body.innerHTML = `${head}
      <div class="panes">
        <div class="tree">${tree}</div>
        <div class="files"><div class="grid">${tiles}${empty}</div>
          ${foot ? `<p class="msg">${esc(foot)}</p>` : ''}</div>
      </div>`;
    if (shown) this.loadThumbs(shown.files);
  }

  /** Draws the thumbnails the folder shown still lacks, putting each in its tile as it arrives. */
  private loadThumbs(files: readonly AssetFileInfo[]): void {
    for (const file of files) {
      const key = thumbKey(file);
      if (this.thumbs.get(key) !== undefined) continue;
      void this.thumbs.request(this.client.urlOf(file), key).then((src) => {
        const pic = this.body.querySelector(`[data-thumb="${CSS_escape(key)}"]`);
        if (pic) pic.innerHTML = src ? `<img src="${src}" alt="">` : '◆';
      });
    }
  }
}

function folderAt(tree: AssetFolder, path: string): AssetFolder | undefined {
  if (path === '') return tree;
  for (const f of tree.folders) {
    if (f.path === path) return f;
    if (path.startsWith(`${f.path}/`)) return folderAt(f, path);
  }
  return undefined;
}

function readHeight(): number {
  try {
    const h = Number(localStorage.getItem(HEIGHT_KEY));
    return Number.isFinite(h) && h > 0 ? h : DEFAULT_H;
  } catch {
    return DEFAULT_H;
  }
}

/** CSS.escape where there is one (a selector for a data attribute's value). */
function CSS_escape(s: string): string {
  return typeof globalThis.CSS?.escape === 'function' ? globalThis.CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}

const PANEL_CSS = `
.room-assets {
  --ink: #ece6d8; --muted: #a8a294; --panel: #1b1e26; --line: #2e333f; --accent: #f0a24a;
  /* Over the debug line (debug-tools.ts), which sits 64 px up on the left. */
  position: fixed; left: 0; bottom: 0; z-index: 10000; box-sizing: border-box;
  background: #14161c; color: var(--ink); border-top: 1px solid var(--line);
  font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (max-width: ${MIN_WINDOW_W - 1}px) { .room-assets { display: none !important; } }
.room-assets .grip { position: absolute; left: 0; right: 0; top: -4px; height: 8px; cursor: ns-resize; z-index: 1; }
.room-assets .grip:hover, .room-assets.resizing .grip { background: linear-gradient(transparent 3px, var(--accent) 3px, var(--accent) 5px, transparent 5px); }
.room-assets.folded .grip { display: none; }
.room-assets.resizing { user-select: none; }
.room-assets .body { height: 100%; display: flex; flex-direction: column; min-height: 0; }
.room-assets header { flex: none; display: flex; align-items: center; gap: 6px; height: ${FOLDED_H - 1}px; padding: 0 8px;
  background: #1a1d24; border-bottom: 1px solid var(--line); box-sizing: border-box; }
.room-assets.folded header { border-bottom: 0; }
.room-assets h1 { margin: 0 6px 0 0; font-size: 13px; font-weight: 650; }
.room-assets .gap { flex: 1; }
.room-assets .div { width: 1px; align-self: stretch; margin: 6px 2px; background: var(--line); }
.room-assets .crumbs { display: flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden; }
.room-assets .crumbs .sep { color: var(--muted); }
.room-assets button { font: 500 12px inherit; font-family: inherit; color: var(--ink); background: var(--panel);
  border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px; cursor: pointer; white-space: nowrap; }
.room-assets button:hover:not(:disabled) { border-color: var(--muted); }
.room-assets button:disabled { opacity: .4; cursor: default; }
.room-assets button.primary { background: var(--accent); border-color: var(--accent); color: #1b1307; font-weight: 650; }
.room-assets button.crumb, .room-assets button.fold { background: none; border-color: transparent; padding: 2px 5px; }
.room-assets button.crumb:last-child { color: var(--accent); }
.room-assets .panes { flex: 1; min-height: 0; display: grid; grid-template-columns: 220px 1fr; }
.room-assets .tree { overflow: auto; padding: 4px; border-right: 1px solid var(--line); }
.room-assets .item { display: flex; align-items: center; gap: 4px; padding: 2px 6px; cursor: default; user-select: none;
  border: 1px solid transparent; border-radius: 4px; white-space: nowrap; }
.room-assets .item:hover { background: #1b1e26; }
.room-assets .item.cwd { background: #232733; }
.room-assets .item.on { border-color: var(--accent); }
.room-assets .item .tw { width: 12px; color: var(--muted); font-size: 10px; cursor: pointer; text-align: center; }
.room-assets .item .ic { font-size: 12px; }
.room-assets .item .nm { overflow: hidden; text-overflow: ellipsis; }
.room-assets .item small { margin-left: auto; color: var(--muted); font-size: 11px; padding-left: 6px; }
.room-assets .files { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.room-assets .grid { flex: 1; overflow: auto; padding: 8px; display: grid; gap: 8px; align-content: start;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); border: 1px solid transparent; }
.room-assets .tile { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px 4px;
  border: 1px solid transparent; border-radius: 6px; user-select: none; cursor: default; min-width: 0; }
.room-assets .tile:hover { background: #1b1e26; border-color: var(--line); }
.room-assets .tile.on { border-color: var(--accent); background: #221f1a; }
.room-assets .tile .pic { width: 80px; height: 80px; display: grid; place-items: center; border-radius: 4px;
  background: radial-gradient(circle at 50% 40%, #2a2f3a, #181b22); color: var(--muted); font-size: 34px; overflow: hidden; }
.room-assets .tile.folder .pic { background: none; font-size: 48px; }
.room-assets .tile img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.room-assets .tile .wait { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--line);
  border-top-color: var(--muted); animation: room-assets-spin 0.9s linear infinite; }
@keyframes room-assets-spin { to { transform: rotate(360deg); } }
.room-assets .tile .nm { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.room-assets .tile small { color: var(--muted); font-size: 10.5px; }
.room-assets .used { color: var(--accent); font-size: 9px; margin-right: 3px; }
.room-assets .drop { background: #2a2416 !important; border-color: var(--accent) !important; }
.room-assets .hint, .room-assets .msg { margin: 0; color: var(--muted); font-size: 12px; white-space: pre-wrap; }
.room-assets .msg { flex: none; padding: 4px 10px 6px; border-top: 1px solid var(--line); max-height: 3.6em; overflow: auto; }
`;
