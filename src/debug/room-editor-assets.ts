// The room editor's asset browser: the model files under src/assets/models as a tree of folders, docked on the left. Import
// .glb files (the Import button, or drag them from the computer onto a folder), make, rename, move (drag onto a folder) and
// delete files and folders, and place a model in the room (Add to room, a double click, or drag it into the view).
// Changes go through the dev server (asset-client.ts, vite.config.ts); without one the tree is read-only.
import {
  baseName,
  joinPath,
  parentOf,
  suggestModelName,
  type AssetFileInfo,
  type AssetFolder,
} from '../engine/services/assets/asset-tree';
import type { AssetClient, AssetResult, AssetState } from './asset-client';

/** The drag data type of an asset dragged from the browser: JSON `{ path, folder }`. */
export const ASSET_DRAG_TYPE = 'application/x-wsw-asset';
export const ASSET_PANEL_W = 260;
/** Below this window width the browser is not shown (the editor's own panel takes the space). */
const MIN_WINDOW_W = 1000;

export interface AssetDrag {
  readonly path: string;
  readonly folder: boolean;
}

export interface AssetPanelHost {
  /** Places a model in the room where the view is looking. */
  addToRoom(file: AssetFileInfo): void;
  /** The files changed (the tree is `state`). */
  changed(state: AssetState): void;
  /** The browser was shown, hidden or folded: the view fits the space again. */
  resized(): void;
}

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const kb = (bytes: number): string => (bytes === 0 ? '' : `${Math.max(1, Math.round(bytes / 1024))} KB`);

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
  /** Folders open in the tree (the models folder always is). */
  private readonly expanded = new Set<string>();
  private selected: { path: string; folder: boolean } | null = null;
  private message = '';
  private folded = false;
  private shown = false;

  constructor(
    private readonly client: AssetClient,
    private readonly host: AssetPanelHost,
  ) {
    this.mount();
  }

  /** How much of the window's left side the browser covers (0 when hidden or folded). */
  get width(): number {
    if (!this.shown || window.innerWidth < MIN_WINDOW_W) return 0;
    return this.folded ? 28 : ASSET_PANEL_W;
  }

  show(): void {
    this.shown = true;
    this.root.style.display = '';
    void this.refresh();
  }

  hide(): void {
    this.shown = false;
    this.root.style.display = 'none';
  }

  /** Reads the tree again. */
  async refresh(): Promise<void> {
    const state = await this.client.refresh();
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
    if (folder !== '') this.expanded.add(folder);
    if (done.length === 1) this.selected = { path: done[0], folder: false };
    this.message = [done.length ? `Imported ${done.join(', ')}` : '', ...failed].filter(Boolean).join('\n');
    this.afterChange();
  }

  /** Writes bytes to a model file (an exported piece), as a change the browser shows. */
  async write(path: string, bytes: Uint8Array, overwrite: boolean): Promise<AssetResult> {
    const result = await this.client.writeFile(path, bytes, overwrite);
    if (result.ok) {
      const folder = parentOf(path);
      for (let f = folder; f !== ''; f = parentOf(f)) this.expanded.add(f);
      this.selected = { path, folder: false };
      this.afterChange();
    }
    return result;
  }

  private async change(result: Promise<AssetResult>, done: string): Promise<boolean> {
    const r = await result;
    this.message = r.ok ? done : r.error;
    this.afterChange();
    return r.ok;
  }

  private afterChange(): void {
    this.render();
    const state = this.client.current;
    if (state) this.host.changed(state);
  }

  /** The folder an action applies to: the selected folder, the selected file's, or the models folder. */
  private targetFolder(): string {
    if (!this.selected) return '';
    return this.selected.folder ? this.selected.path : parentOf(this.selected.path);
  }

  private async newFolder(): Promise<void> {
    const parent = this.targetFolder();
    const name = prompt(`New folder in ${parent === '' ? 'models' : parent}:`, 'new-folder');
    if (!name) return;
    const path = joinPath(parent, name.trim());
    if (await this.change(this.client.makeFolder(path), `Made ${path}`)) {
      if (parent !== '') this.expanded.add(parent);
      this.selected = { path, folder: true };
      this.render();
    }
  }

  private async rename(): Promise<void> {
    const sel = this.selected;
    if (!sel) return;
    const old = baseName(sel.path);
    const stem = sel.folder ? old : old.replace(/\.glb$/, '');
    const name = prompt(`Rename ${sel.path} to:`, stem)?.trim();
    if (!name || name === stem) return;
    const to = joinPath(parentOf(sel.path), sel.folder ? name : `${name.replace(/\.glb$/i, '')}.glb`);
    if (await this.change(this.client.move(sel.path, to), `Renamed to ${to}`)) {
      this.selected = { path: to, folder: sel.folder };
      this.render();
    }
  }

  private async moveInto(drag: AssetDrag, folder: string): Promise<void> {
    const to = joinPath(folder, baseName(drag.path));
    if (to === drag.path) return;
    if (await this.change(this.client.move(drag.path, to), `Moved to ${to}`)) {
      if (folder !== '') this.expanded.add(folder);
      this.selected = { path: to, folder: drag.folder };
      this.render();
    }
  }

  private async remove(): Promise<void> {
    const sel = this.selected;
    if (!sel || !confirm(`Delete ${sel.path}${sel.folder ? ' and everything in it' : ''}? This deletes the file(s).`))
      return;
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

  private mount(): void {
    const style = document.createElement('style');
    style.textContent = PANEL_CSS;
    document.head.append(style);
    this.root.className = 'room-assets';
    this.root.style.display = 'none';
    this.picker.type = 'file';
    this.picker.accept = '.glb';
    this.picker.multiple = true;
    this.picker.hidden = true;
    this.picker.addEventListener('change', () => {
      const files = [...(this.picker.files ?? [])];
      this.picker.value = '';
      if (files.length) void this.importFiles(files, this.targetFolder());
    });
    this.root.append(this.picker);

    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-path]');
      if (!el) return;
      const act = el.dataset.act;
      if (act === 'import') return this.picker.click();
      if (act === 'mkdir') return void this.newFolder();
      if (act === 'refresh') return void this.refresh();
      if (act === 'fold') {
        this.folded = !this.folded;
        this.render();
        return this.host.resized();
      }
      if (act === 'rename') return void this.rename();
      if (act === 'delete') return void this.remove();
      if (act === 'add') {
        const file = this.selected && !this.selected.folder ? this.fileAt(this.selected.path) : undefined;
        if (file) this.host.addToRoom(file);
        return;
      }
      const path = el.dataset.path;
      if (path === undefined) return;
      const folder = el.dataset.kind === 'folder';
      if (folder && !this.expanded.delete(path)) this.expanded.add(path);
      this.selected = { path, folder };
      this.render();
    });
    this.root.addEventListener('dblclick', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-kind="file"]');
      const file = el?.dataset.path !== undefined ? this.fileAt(el.dataset.path) : undefined;
      if (file) this.host.addToRoom(file);
    });

    // Dragging: a file or folder of the tree (onto a folder to move it, or into the view to place it), or files from the computer.
    this.root.addEventListener('dragstart', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-path]');
      if (!el || !e.dataTransfer || !this.client.current) return;
      const drag: AssetDrag = { path: el.dataset.path ?? '', folder: el.dataset.kind === 'folder' };
      e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(drag));
      e.dataTransfer.setData('text/plain', drag.path);
      e.dataTransfer.effectAllowed = 'copyMove';
    });
    const dropFolder = (e: DragEvent): string => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-path]');
      if (!el) return '';
      return el.dataset.kind === 'folder' ? (el.dataset.path ?? '') : parentOf(el.dataset.path ?? '');
    };
    const accepts = (e: DragEvent) => {
      const types = e.dataTransfer?.types ?? [];
      return types.includes('Files') || types.includes(ASSET_DRAG_TYPE);
    };
    this.root.addEventListener('dragover', (e) => {
      if (!accepts(e)) return;
      e.preventDefault();
      for (const el of this.root.querySelectorAll('.drop')) el.classList.remove('drop');
      const folder = dropFolder(e);
      this.root.querySelector(`[data-kind="folder"][data-path="${CSS_escape(folder)}"]`)?.classList.add('drop');
    });
    this.root.addEventListener('dragleave', (e) => {
      if (e.target === this.root) for (const el of this.root.querySelectorAll('.drop')) el.classList.remove('drop');
    });
    this.root.addEventListener('drop', (e) => {
      if (!accepts(e)) return;
      e.preventDefault();
      for (const el of this.root.querySelectorAll('.drop')) el.classList.remove('drop');
      const folder = dropFolder(e);
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
    if (this.folded) {
      this.root.querySelectorAll(':scope > :not(input)').forEach((el) => el.remove());
      this.root.insertAdjacentHTML(
        'beforeend',
        '<button class="unfold" data-act="fold" title="Show the assets">›</button>',
      );
      return;
    }
    const live = state?.live ?? false;
    const used = new Set(state?.used ?? []);
    const sel = this.selected;
    const row = (depth: number, inner: string, attrs: string, on: boolean) =>
      `<div class="item${on ? ' on' : ''}" style="padding-left:${6 + depth * 14}px" ${attrs}>${inner}</div>`;
    const folderRows = (f: AssetFolder, depth: number): string =>
      f.folders
        .map((sub) => {
          const open = this.expanded.has(sub.path);
          return (
            row(
              depth,
              `<span class="tw">${open ? '▾' : '▸'}</span><span class="ic">▣</span>${esc(sub.name)}`,
              `data-path="${esc(sub.path)}" data-kind="folder" draggable="${live}"`,
              sel?.path === sub.path,
            ) + (open ? folderRows(sub, depth + 1) : '')
          );
        })
        .join('') +
      f.files
        .map((file) =>
          row(
            depth,
            `<span class="tw"></span><span class="ic">◆</span><span class="nm">${esc(baseName(file.path))}</span>
             ${used.has(file.id) ? '<span class="used" title="Placed in the room">●</span>' : ''}<small>${kb(file.bytes)}</small>`,
            `data-path="${esc(file.path)}" data-kind="file" draggable="true" title="${esc(file.id)}"`,
            sel?.path === file.path,
          ),
        )
        .join('');
    const actions = !sel
      ? '<p class="hint">Pick a model to place it, or drag it into the room.</p>'
      : sel.folder
        ? `<div class="bar"><button data-act="mkdir" ${live ? '' : 'disabled'}>New folder</button>
            <button data-act="rename" ${live ? '' : 'disabled'}>Rename</button>
            <button data-act="delete" ${live ? '' : 'disabled'}>Delete</button></div>`
        : `<div class="bar"><button data-act="add" class="primary">Add to room</button>
            <button data-act="rename" ${live && !used.has(this.fileAt(sel.path)?.id ?? '') ? '' : 'disabled'}>Rename</button>
            <button data-act="delete" ${live && !used.has(this.fileAt(sel.path)?.id ?? '') ? '' : 'disabled'}>Delete</button></div>`;
    this.root.querySelectorAll(':scope > :not(input)').forEach((el) => el.remove());
    this.root.insertAdjacentHTML(
      'beforeend',
      `<header><h1>Assets</h1><button data-act="fold" title="Fold the assets away">‹</button></header>
      <div class="bar"><button data-act="import" ${live ? '' : 'disabled'} title="Or drag .glb files onto a folder">Import…</button>
        <button data-act="mkdir" ${live ? '' : 'disabled'}>New folder</button><button data-act="refresh">Refresh</button></div>
      ${live ? '' : '<p class="hint">No dev server: read-only.</p>'}
      <div class="tree">${row(0, '<span class="tw">▾</span><span class="ic">▣</span>models', 'data-path="" data-kind="folder"', sel?.path === '')}
        ${state ? folderRows(state.tree, 1) : '<p class="hint">Reading…</p>'}</div>
      ${actions}
      ${this.message ? `<p class="msg">${esc(this.message)}</p>` : ''}`,
    );
  }
}

/** CSS.escape where there is one (a selector for a data attribute's value). */
function CSS_escape(s: string): string {
  return typeof globalThis.CSS?.escape === 'function' ? globalThis.CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
}

const PANEL_CSS = `
.room-assets {
  --ink: #ece6d8; --muted: #a8a294; --panel: #1b1e26; --line: #2e333f; --accent: #f0a24a;
  position: fixed; top: 0; left: 0; bottom: 0; width: ${ASSET_PANEL_W}px; z-index: 11; overflow-y: auto;
  /* The debug line (debug-tools.ts) sits 64 px up on the left, over this panel: keep the panel's buttons above it. */
  box-sizing: border-box; padding: 12px 10px 96px; display: flex; flex-direction: column; gap: 8px;
  background: #14161c; color: var(--ink); border-right: 1px solid var(--line);
  font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
.room-assets.folded { width: 28px; padding: 8px 2px; }
@media (max-width: ${MIN_WINDOW_W - 1}px) { .room-assets { display: none !important; } }
.room-assets header { display: flex; align-items: center; justify-content: space-between; }
.room-assets h1 { margin: 0; font-size: 16px; font-weight: 650; }
.room-assets button { font: 500 12px inherit; font-family: inherit; color: var(--ink); background: var(--panel);
  border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; cursor: pointer; }
.room-assets button:hover:not(:disabled) { border-color: var(--muted); }
.room-assets button:disabled { opacity: .4; cursor: default; }
.room-assets button.primary { background: var(--accent); border-color: var(--accent); color: #1b1307; font-weight: 650; }
.room-assets .unfold { padding: 4px 6px; }
.room-assets .bar { display: flex; flex-wrap: wrap; gap: 5px; }
.room-assets .hint, .room-assets .msg { margin: 0; color: var(--muted); font-size: 12px; white-space: pre-wrap; }
.room-assets .msg { color: var(--ink); }
.room-assets .tree { flex: 1; min-height: 120px; overflow-y: auto; border: 1px solid var(--line); border-radius: 6px; padding: 4px 0; }
.room-assets .item { display: flex; align-items: center; gap: 4px; padding: 2px 6px; cursor: default; user-select: none;
  border: 1px solid transparent; border-radius: 4px; white-space: nowrap; }
.room-assets .item:hover { background: #1b1e26; }
.room-assets .item.on { border-color: var(--accent); }
.room-assets .item.drop { background: #2a2416; border-color: var(--accent); }
.room-assets .item .tw { width: 10px; color: var(--muted); font-size: 10px; }
.room-assets .item .ic { color: var(--muted); font-size: 10px; }
.room-assets .item .nm { overflow: hidden; text-overflow: ellipsis; }
.room-assets .item small { margin-left: auto; color: var(--muted); font-size: 11px; padding-left: 6px; }
.room-assets .item .used { color: var(--accent); font-size: 9px; }
`;
