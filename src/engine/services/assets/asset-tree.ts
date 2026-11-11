// The rules for the models folder (src/assets/models) as the room editor's asset browser changes it through the dev server
// (vite.config.ts): which paths are allowed, which ids would clash in the asset manifest, which moves are safe, whether bytes
// are a single-file .glb, and the folder tree the browser shows. Plain TypeScript with no file system access, so the dev
// server, the editor and the unit tests share one copy of the rules.
//
// Paths here are relative to the models folder, with forward slashes ('' is the folder itself): 'furniture/lamp.glb'.
// An asset's id is its file name without folder or extension, in lower case with hyphens (assetIdOf, ADR 0009), so moving a
// file between folders keeps its id, and two files with one id anywhere under src/assets would break the manifest.
import { assetIdOf, BUDGETS } from './budgets.mjs';

/** The models folder, under src/assets. */
export const MODELS_FOLDER = 'models';

/** Ids the manifest keeps for its own entries (the scene editor's stand-ins and IWSDK's primitives). */
export const RESERVED_ID_PREFIXES: readonly string[] = ['piece-', 'marker-', 'primitive-'];

/** The most a model file may weigh (the asset budget, ADR 0009). */
export const MODEL_MAX_BYTES: number = BUDGETS.perFileBytes.model;

/** One name in a path: a letter or digit, then letters, digits, hyphens or underscores (no spaces, no dots). */
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** Names Windows will not create, whatever the extension. */
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
/** How deep folders may nest. */
const MAX_DEPTH = 8;

function namesProblem(parts: readonly string[]): string | null {
  if (parts.length > MAX_DEPTH) return `folders nest at most ${MAX_DEPTH} deep`;
  for (const part of parts) {
    if (!NAME.test(part))
      return `"${part}" is not a usable name (letters, digits, hyphens and underscores, starting with a letter or digit)`;
    if (WINDOWS_RESERVED.test(part)) return `"${part}" is a name Windows keeps for itself`;
  }
  return null;
}

/** What is wrong with a folder path ('' is the models folder itself), or null if it is fine. */
export function folderPathProblem(rel: string): string | null {
  if (rel === '') return null;
  if (rel.includes('\\')) return 'use forward slashes';
  if (rel.startsWith('/') || rel.endsWith('/')) return 'a path may not start or end with a slash';
  return namesProblem(rel.split('/'));
}

/** What is wrong with a model file's path (it must end in a lower-case .glb), or null if it is fine. */
export function modelPathProblem(rel: string): string | null {
  if (!rel.endsWith('.glb')) return 'a model must be a .glb file (lower-case extension)';
  const slash = rel.lastIndexOf('/');
  const folder = slash < 0 ? '' : rel.slice(0, slash);
  const stem = rel.slice(slash + 1, -'.glb'.length);
  return folderPathProblem(folder) ?? namesProblem([stem]);
}

/** The folder a path is in ('' for the models folder itself). */
export function parentOf(rel: string): string {
  const slash = rel.lastIndexOf('/');
  return slash < 0 ? '' : rel.slice(0, slash);
}

/** The last name in a path. */
export function baseName(rel: string): string {
  return rel.slice(rel.lastIndexOf('/') + 1);
}

/** Joins a folder and a name ('' is the models folder). */
export function joinPath(folder: string, name: string): string {
  return folder === '' ? name : `${folder}/${name}`;
}

/** A usable file name for a file picked from the computer: `Chair (1).GLB` → `Chair-1.glb`. */
export function suggestModelName(osName: string): string {
  const dot = osName.lastIndexOf('.');
  const stem = (dot > 0 ? osName.slice(0, dot) : osName)
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 64);
  const safe = stem === '' || WINDOWS_RESERVED.test(stem) ? `model${stem === '' ? '' : `-${stem}`}` : stem;
  return `${safe}.glb`;
}

/** What is wrong with the id a file at `rel` would have, or null. `others` are the other asset files (any folder under src/assets). */
export function idProblem(rel: string, others: readonly string[], self?: string): string | null {
  const id = assetIdOf(rel);
  if (id === '') return `"${baseName(rel)}" gives no usable asset id`;
  for (const prefix of RESERVED_ID_PREFIXES)
    if (id.startsWith(prefix)) return `ids starting with "${prefix}" are kept for the editor's own pieces`;
  const selfLower = self?.toLowerCase();
  for (const other of others) {
    if (selfLower !== undefined && other.toLowerCase() === selfLower) continue;
    if (assetIdOf(other) === id) return `the id "${id}" is taken by ${other}: rename one of them`;
  }
  return null;
}

/**
 * What is wrong with moving (or renaming) a file or folder from `from` to `to`, or null. `assetFiles` are every asset file
 * under src/assets as `models/...` paths (and other folders'), `used` the asset ids the room layouts use.
 */
export function moveProblem(
  from: string,
  to: string,
  isFolder: boolean,
  assetFiles: readonly string[],
  used: ReadonlySet<string>,
): string | null {
  if (from === '') return 'the models folder itself cannot be moved';
  const pathProblem = isFolder ? folderPathProblem(to) : modelPathProblem(to);
  if (pathProblem) return pathProblem;
  if (!isFolder && modelPathProblem(from)) return 'not a model file';
  if (isFolder && folderPathProblem(from)) return 'not a folder';
  if (from === to) return 'it is already there';
  if (isFolder && (to === from || to.startsWith(`${from}/`))) return 'a folder cannot go inside itself';
  if (!isFolder) {
    const oldId = assetIdOf(from),
      newId = assetIdOf(to);
    if (oldId !== newId) {
      if (used.has(oldId)) return `"${oldId}" is placed in the room: remove it there first, or keep its name`;
      const clash = idProblem(
        `${MODELS_FOLDER}/${to}`,
        assetFiles.filter((f) => f.toLowerCase() !== `${MODELS_FOLDER}/${from}`.toLowerCase()),
      );
      if (clash) return clash;
    }
  }
  return null;
}

/** A model file in the browser. */
export interface AssetFileInfo {
  /** Path in the models folder ('furniture/lamp.glb'). */
  readonly path: string;
  /** Its asset id ('lamp'). */
  readonly id: string;
  readonly bytes: number;
  /** When it last changed (ms since 1970), to load a fresh copy after it is overwritten. */
  readonly mtimeMs: number;
}

export interface AssetFolder {
  /** Its name ('' for the models folder). */
  readonly name: string;
  /** Its path ('' for the models folder). */
  readonly path: string;
  readonly folders: AssetFolder[];
  readonly files: AssetFileInfo[];
}

const byName = (a: string, b: string): number => a.toLowerCase().localeCompare(b.toLowerCase()) || a.localeCompare(b);

/** The folder tree: folders first, then files, each sorted by name (ignoring case). Files' and folders' parents are made as needed. */
export function buildAssetTree(folders: readonly string[], files: readonly AssetFileInfo[]): AssetFolder {
  const root: AssetFolder = { name: '', path: '', folders: [], files: [] };
  const all = new Map<string, AssetFolder>([['', root]]);
  const folder = (path: string): AssetFolder => {
    const found = all.get(path);
    if (found) return found;
    const made: AssetFolder = { name: baseName(path), path, folders: [], files: [] };
    all.set(path, made);
    folder(parentOf(path)).folders.push(made);
    return made;
  };
  for (const f of folders) folder(f);
  for (const file of files) folder(parentOf(file.path)).files.push(file);
  for (const f of all.values()) {
    f.folders.sort((a, b) => byName(a.name, b.name));
    f.files.sort((a, b) => byName(baseName(a.path), baseName(b.path)));
  }
  return root;
}

/** Every file in a tree, depth first. */
export function filesOf(tree: AssetFolder): AssetFileInfo[] {
  return [...tree.files, ...tree.folders.flatMap(filesOf)];
}

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'

/** What is wrong with these bytes as a single-file .glb (glTF 2, binary, nothing loaded from other files), or null. */
export function glbProblem(bytes: Uint8Array): string | null {
  if (bytes.length < 20) return 'too short to be a .glb';
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) return 'not a .glb (binary glTF) file';
  if (view.getUint32(4, true) !== 2) return `glTF version ${view.getUint32(4, true)}; only version 2 loads`;
  if (view.getUint32(8, true) !== bytes.length) return 'the file is cut short or has extra bytes';
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLength > bytes.length)
    return 'its first chunk is not glTF JSON';
  let doc: unknown;
  try {
    doc = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  } catch {
    return 'its glTF JSON does not read';
  }
  if (typeof doc !== 'object' || doc === null) return 'its glTF JSON is not an object';
  const external = (list: unknown): boolean =>
    Array.isArray(list) &&
    list.some((item: unknown) => {
      const uri = (item as { uri?: unknown } | null)?.uri;
      return typeof uri === 'string' && !uri.startsWith('data:');
    });
  const d = doc as { buffers?: unknown; images?: unknown };
  if (external(d.buffers) || external(d.images))
    return 'it loads data or textures from other files; export it as one self-contained .glb';
  return null;
}

/** The model files in the browser's tree from the bundler's glob keys ('../assets/models/a/b.glb' → 'a/b.glb'). */
export function modelPathsFromGlob(keys: readonly string[]): string[] {
  const marker = `/assets/${MODELS_FOLDER}/`;
  const out: string[] = [];
  for (const key of keys) {
    const at = key.indexOf(marker);
    if (at < 0) continue;
    const rel = key.slice(at + marker.length);
    if (modelPathProblem(rel) === null) out.push(rel);
  }
  return out.sort(byName);
}
