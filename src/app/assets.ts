import { BoxGeometry, defineAssets, Mesh, MeshBasicMaterial, SphereGeometry } from '@iwsdk/core';
import { manifestFromFiles } from '../engine/services/assets/manifest-from-files';
import { Kind } from '../engine/sim/entity-kinds';

// IWSDK asset manifest. These are editor stand-ins for game pieces, not final art. In the scene editor
// the asset a node uses says what it is to the game (docs/adr/0006-editor-authored-layouts.md):
//   piece-<kind>  an entity of that kind: a unit sphere, so the node's scale is its radius in metres
//   marker-<tag>  a named spot for puzzle code: a flat unit box, so the node's scale is its width and height
// Files dropped into src/assets are added too (docs/adr/0009-asset-pipeline.md): critical/ blocks startup,
// audio/ loads in the background, everything else loads when first used, and each shows in the editor's
// Assets panel under its id (the file name in lower case with hyphens).
// Each Kind has a piece asset (src/app/scene-files.test.ts checks), so a new kind shows up in the editor.

const PIECE_COLOURS: Readonly<Record<keyof typeof Kind, number>> = {
  Traveller: 0x7ec8e3,
  Rock: 0xb08968,
  Raindrop: 0x4fa3d9,
  Crow: 0x9aa0b4,
  Rabbit: 0xe8d9c5,
  Fox: 0xe07a3f,
  Firefly: 0xf2e16b,
};
const MARKER_COLOURS = { gap: 0x58a6ff, goal: 0x7ee787, plate: 0xd2a8ff } as const;

const sphere = (color: number) => new Mesh(new SphereGeometry(1, 24, 16), new MeshBasicMaterial({ color }));
const flatBox = (color: number) => new Mesh(new BoxGeometry(1, 1, 0.05), new MeshBasicMaterial({ color }));

const files = import.meta.glob('../assets/**/*.{glb,png,jpg,jpeg,webp,ktx2,hdr,exr,mp3,ogg,opus,m4a,wav}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const standIns = {
  ...Object.fromEntries(
    (Object.keys(Kind) as (keyof typeof Kind)[]).map((name) => [
      `piece-${name.toLowerCase()}`,
      sphere(PIECE_COLOURS[name]),
    ]),
  ),
  ...Object.fromEntries(Object.entries(MARKER_COLOURS).map(([tag, color]) => [`marker-${tag}`, flatBox(color)])),
};

export default defineAssets({ ...standIns, ...manifestFromFiles(files, new Set(Object.keys(standIns))) });
