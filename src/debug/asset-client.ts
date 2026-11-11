// Talks to the dev server's asset endpoints (/__wsw/assets/, vite.config.ts) for the room editor's asset browser. Without a dev
// server (a tester build) the tree is read-only, built from the files the bundler saw when the page loaded.
import { assetIdOf } from '../engine/services/assets/budgets.mjs';
import {
  buildAssetTree,
  filesOf,
  modelPathsFromGlob,
  type AssetFileInfo,
  type AssetFolder,
} from '../engine/services/assets/asset-tree';

export interface AssetState {
  readonly tree: AssetFolder;
  /** Asset ids the room layouts place (these may not be renamed or deleted). */
  readonly used: readonly string[];
  /** Whether the dev server is there to change files (false: read-only). */
  readonly live: boolean;
}

/** What a change came to: the new state, or why it was refused. */
export type AssetResult = { ok: true; state: AssetState } | { ok: false; error: string };

const ENDPOINT = './__wsw/assets/';

export class AssetClient {
  private state: AssetState | null = null;

  /** @param bundled every asset file the bundler saw (source path → URL): the read-only tree when there is no dev server */
  constructor(private readonly bundled: Readonly<Record<string, string>>) {}

  /** The last tree read. */
  get current(): AssetState | null {
    return this.state;
  }

  /** Reads the tree from the dev server, or from the bundled files without one. */
  async refresh(): Promise<AssetState> {
    try {
      const res = await fetch(`${ENDPOINT}tree`, { cache: 'no-store' });
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
        const body = (await res.json()) as { tree: AssetFolder; used: string[] };
        return (this.state = { tree: body.tree, used: body.used, live: true });
      }
    } catch {
      // No dev server: fall through to the bundled list.
    }
    const files: AssetFileInfo[] = modelPathsFromGlob(Object.keys(this.bundled)).map((path) => ({
      path,
      id: assetIdOf(path),
      bytes: 0,
      mtimeMs: 0,
    }));
    return (this.state = { tree: buildAssetTree([], files), used: [], live: false });
  }

  /** The file with asset id `id` in the last tree read, if any. */
  fileOf(id: string): AssetFileInfo | undefined {
    return this.state ? filesOf(this.state.tree).find((f) => f.id === id) : undefined;
  }

  /** Where the page fetches a model from: by its path, with its change time so a file written again is fetched again. */
  urlOf(file: AssetFileInfo): string {
    if (!this.state?.live) {
      const key = Object.keys(this.bundled).find((k) => k.endsWith(`/assets/models/${file.path}`));
      if (key) return this.bundled[key];
    }
    return `./src/assets/models/${file.path.split('/').map(encodeURIComponent).join('/')}?v=${file.mtimeMs}`;
  }

  writeFile(path: string, bytes: ArrayBuffer | Uint8Array, overwrite = false): Promise<AssetResult> {
    return this.post(`file?path=${encodeURIComponent(path)}${overwrite ? '&overwrite=1' : ''}`, bytes);
  }

  makeFolder(path: string): Promise<AssetResult> {
    return this.post(`mkdir?path=${encodeURIComponent(path)}`);
  }

  move(from: string, to: string): Promise<AssetResult> {
    return this.post(`move?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  remove(path: string): Promise<AssetResult> {
    return this.post(`delete?path=${encodeURIComponent(path)}`);
  }

  private async post(query: string, body?: ArrayBuffer | Uint8Array): Promise<AssetResult> {
    if (this.state && !this.state.live)
      return { ok: false, error: 'no dev server: the asset folder is read-only here' };
    try {
      const res = await fetch(`${ENDPOINT}${query}`, { method: 'POST', body: body as BodyInit | undefined });
      if (!res.ok) return { ok: false, error: await res.text() };
      const parsed = (await res.json()) as { tree: AssetFolder; used: string[] };
      this.state = { tree: parsed.tree, used: parsed.used, live: true };
      return { ok: true, state: this.state };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}
