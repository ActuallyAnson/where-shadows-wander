// Size budgets for what the game downloads, and the checks against them. Plain JavaScript (typed by
// budgets.d.mts) so the same code runs in the game's bundle, in the unit tests, and in
// scripts/check-budgets.mjs under Node: there is one copy of the rules, and the copy that gates CI is tested.

export const BUDGETS = {
  /** First-load JavaScript, gzipped. */
  initialBundleGzipBytes: 800 * 1024,
  /** All critical files together (the world waits for these at start). */
  criticalTotalBytes: 1024 * 1024,
  /** Each file as shipped, by kind. */
  perFileBytes: { texture: 512 * 1024, model: 500 * 1024, sfx: 300 * 1024, music: 1536 * 1024 },
  /** What each extension is. Everything the manifest loads must be listed here. `.gltf` is left out on purpose: it points at separate files that would not ship. */
  extensions: {
    texture: ['png', 'jpg', 'jpeg', 'webp', 'ktx2', 'hdr', 'exr'],
    model: ['glb'],
    audio: ['mp3', 'ogg', 'opus', 'm4a', 'wav'],
  },
};

const kb = (bytes) => (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0);
const segments = (path) => path.split('?')[0].split(/[\\/]/);

/** Extension without the dot, as written ('' if none). */
export function extensionOf(path) {
  const name = segments(path).at(-1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1);
}

/** The folders of `path` below the first `assets` folder ('../assets/critical/x.png' gives ['critical']), or [] if there is none. */
export function foldersUnderAssets(path) {
  const parts = segments(path);
  const at = parts.indexOf('assets');
  return at < 0 ? [] : parts.slice(at + 1, -1);
}

/** 'critical' (the world waits for it), 'background' (audio) or 'lazy', from the first folder under `assets`. */
export function priorityOf(path) {
  const top = foldersUnderAssets(path)[0];
  return top === 'critical' ? 'critical' : top === 'audio' ? 'background' : 'lazy';
}

/**
 * What a file counts as for its budget, or null if it is not a texture, model or sound. Audio in a folder
 * named `music` is music (longer, so a larger budget); other audio is a sound effect.
 */
export function classify(path) {
  const ext = extensionOf(path).toLowerCase();
  if (BUDGETS.extensions.texture.includes(ext)) return 'texture';
  if (BUDGETS.extensions.model.includes(ext)) return 'model';
  if (BUDGETS.extensions.audio.includes(ext)) return foldersUnderAssets(path).includes('music') ? 'music' : 'sfx';
  return null;
}

/** A message if a file in src/assets would not reach the game as intended (wrong case, unsupported kind), else null. */
export function checkSourceName(path) {
  const ext = extensionOf(path);
  if (ext === 'gltf' || ext === 'bin') return `${path}: use a single-file .glb (a .gltf's separate files do not ship)`;
  if (ext !== ext.toLowerCase())
    return `${path}: make the extension lower case (.${ext.toLowerCase()}), or it is not picked up`;
  return null;
}

/** A message if the file is over its kind's budget, else null. Files of no known kind are not checked. */
export function checkFile(path, bytes) {
  const cls = classify(path);
  if (cls === null) return null;
  const limit = BUDGETS.perFileBytes[cls];
  return bytes > limit ? `${path} is ${kb(bytes)} KB, over the ${kb(limit)} KB ${cls} budget` : null;
}

/** A message if the critical files together are over budget, else null. */
export function checkCriticalTotal(files) {
  let total = 0;
  for (const f of files) total += f.bytes;
  return total > BUDGETS.criticalTotalBytes
    ? `critical assets total ${kb(total)} KB, over the ${kb(BUDGETS.criticalTotalBytes)} KB budget`
    : null;
}

/** A message if the first-load JavaScript (gzipped) is over budget, else null. */
export function checkInitialBundle(gzipBytes) {
  return gzipBytes > BUDGETS.initialBundleGzipBytes
    ? `the initial bundle is ${kb(gzipBytes)} KB gzipped, over the ${kb(BUDGETS.initialBundleGzipBytes)} KB budget`
    : null;
}

/**
 * The JavaScript files the page loads before it can start: the scripts and preloads its HTML names, and
 * everything they import statically (not `import()`), as paths relative to the HTML. `read` returns a file's
 * text, or null if it does not exist. Returns [] if the HTML names nothing, which callers must treat as an error.
 */
export function firstLoadFiles(html, read) {
  const queue = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const seen = [];
  while (queue.length) {
    const file = queue.pop();
    if (seen.includes(file)) continue;
    const code = read(file);
    if (code === null) continue;
    seen.push(file);
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
    for (const m of code.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g)) queue.push(dir + m[1]);
  }
  return seen;
}

/** The manifest id for a file: its name without folder or extension, lower case, other characters as hyphens. */
export function assetIdOf(path) {
  const name = segments(path).at(-1);
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
