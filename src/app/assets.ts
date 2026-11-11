import { defineAssets } from '@iwsdk/core';
import { manifestFromFiles } from '../engine/services/assets/manifest-from-files';

// IWSDK asset manifest: every file dropped into src/assets (docs/adr/0009-asset-pipeline.md). critical/ blocks startup,
// audio/ loads in the background, everything else loads when first used, and each shows in the editor's Assets panel
// under its id (the file name in lower case with hyphens).

const files = import.meta.glob('../assets/**/*.{glb,png,jpg,jpeg,webp,ktx2,hdr,exr,mp3,ogg,opus,m4a,wav}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export default defineAssets(manifestFromFiles(files));

/** Every asset file as the bundler saw it when the page loaded (source path → URL), for the room editor's asset browser. */
export const assetFiles: Readonly<Record<string, string>> = files;
