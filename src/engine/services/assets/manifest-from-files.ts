// Turns the files in src/assets into IWSDK manifest entries, so dropping a file in is all it takes for it
// to appear in the scene editor's Assets panel (and be loadable by id). Where a file sits sets its priority:
//   src/assets/critical/...   critical    the world waits for these before it starts, and a missing or slow one
//                                         stops the game starting (IWSDK allows 30 s): keep them tiny, in the repo
//   src/assets/audio/...      background  starts loading after the critical ones, does not block
//   anywhere else             lazy        fetched when first used (or prefetched)
// The first folder under src/assets decides; a deeper folder named critical or audio does not.
// The id is the file name without folder or extension (assetIdOf). Two files with one id is an error.
import { AssetType, type LoadableAssetManifestEntry } from '@iwsdk/core';
import { assetIdOf, extensionOf, priorityOf } from './budgets.mjs';

const TYPE_BY_EXTENSION: Readonly<Record<string, AssetType>> = {
  glb: AssetType.GLTF,
  png: AssetType.Texture,
  jpg: AssetType.Texture,
  jpeg: AssetType.Texture,
  webp: AssetType.Texture,
  ktx2: AssetType.Texture,
  hdr: AssetType.HDRTexture,
  exr: AssetType.HDRTexture,
  mp3: AssetType.Audio,
  ogg: AssetType.Audio,
  opus: AssetType.Audio,
  m4a: AssetType.Audio,
  wav: AssetType.Audio,
};

/**
 * @param files source path (as the bundler sees it) to the URL the page fetches it from
 * @param taken ids already used by other manifest entries, which a file may not reuse
 */
export function manifestFromFiles(
  files: Readonly<Record<string, string>>,
  taken: ReadonlySet<string> = new Set(),
): Record<string, LoadableAssetManifestEntry> {
  const out: Record<string, LoadableAssetManifestEntry> = {};
  for (const path of Object.keys(files).sort()) {
    const type = TYPE_BY_EXTENSION[extensionOf(path)];
    if (type === undefined) continue;
    const id = assetIdOf(path);
    if (id === '') throw new Error(`asset file "${path}" has no usable name`);
    // IWSDK's own primitive-box, primitive-sphere... are in every manifest; a file may not replace one.
    if (id.startsWith('primitive-')) throw new Error(`"${path}": ids starting with "primitive-" belong to IWSDK`);
    if (id in out || taken.has(id)) throw new Error(`two assets would have the id "${id}" ("${path}"): rename one`);
    out[id] = { url: files[path], type, priority: priorityOf(path), name: id };
  }
  return out;
}
