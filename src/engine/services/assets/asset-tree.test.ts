import { describe, expect, it } from 'vitest';
import {
  buildAssetTree,
  filesOf,
  folderPathProblem,
  glbProblem,
  idProblem,
  modelPathProblem,
  modelPathsFromGlob,
  moveProblem,
  suggestModelName,
  type AssetFileInfo,
} from './asset-tree';

/** A minimal .glb: the header and one JSON chunk (padded to 4 bytes with spaces). */
function glb(json: unknown, opts: { version?: number; lengthDelta?: number; magic?: number } = {}): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4 !== 0) text += ' ';
  const body = new TextEncoder().encode(text);
  const bytes = new Uint8Array(20 + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, opts.magic ?? 0x46546c67, true);
  view.setUint32(4, opts.version ?? 2, true);
  view.setUint32(8, bytes.length + (opts.lengthDelta ?? 0), true);
  view.setUint32(12, body.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(body, 20);
  return bytes;
}

describe('paths', () => {
  it('takes plain nested folders and lower-case .glb files', () => {
    expect(folderPathProblem('')).toBeNull();
    expect(folderPathProblem('furniture/kitchen')).toBeNull();
    expect(modelPathProblem('lamp.glb')).toBeNull();
    expect(modelPathProblem('furniture/bedSingle.glb')).toBeNull();
    expect(modelPathProblem('a_b/c-d.glb')).toBeNull();
  });

  it('refuses anything that could leave the folder or trip up a file system', () => {
    for (const bad of ['..', 'a/../b', './a', '/a', 'a/', 'a//b', 'a\\b', 'C:', 'a b', '.hidden', 'con', 'a/LPT1'])
      expect(folderPathProblem(bad), bad).not.toBeNull();
    for (const bad of ['lamp.GLB', 'lamp.gltf', 'lamp', '../lamp.glb', 'a/.glb', 'lamp.v2.glb', 'nul.glb'])
      expect(modelPathProblem(bad), bad).not.toBeNull();
    expect(folderPathProblem('a/b/c/d/e/f/g/h')).toBeNull();
    expect(folderPathProblem('a/b/c/d/e/f/g/h/i')).toMatch(/at most 8/);
  });

  it('suggests a usable name for a file from the computer', () => {
    expect(suggestModelName('Chair (1).GLB')).toBe('Chair-1.glb');
    expect(suggestModelName('my lamp.v2.glb')).toBe('my-lamp-v2.glb');
    expect(suggestModelName('...glb')).toBe('model.glb');
    expect(suggestModelName('nul.glb')).toBe('model-nul.glb');
    for (const name of ['Chair (1).GLB', 'my lamp.v2.glb', '???.glb', 'CON.glb'])
      expect(modelPathProblem(suggestModelName(name)), name).toBeNull();
  });
});

describe('ids', () => {
  const files = ['models/bedSingle.glb', 'models/furniture/chair.glb', 'audio/rain.ogg'];

  it('refuses an id another asset has, in any folder and whatever its case', () => {
    expect(idProblem('models/lamp.glb', files)).toBeNull();
    expect(idProblem('models/new/Chair.glb', files)).toMatch(/"chair" is taken by models\/furniture\/chair\.glb/);
    expect(idProblem('models/bed-single.glb', files)).toBeNull(); // bedSingle is "bedsingle"
    expect(idProblem('models/rain.glb', files)).toMatch(/taken by audio\/rain\.ogg/);
    // Overwriting a file keeps its own id.
    expect(idProblem('models/furniture/chair.glb', files, 'models/furniture/chair.glb')).toBeNull();
  });

  it("keeps the editor stand-ins' and IWSDK's ids", () => {
    expect(idProblem('models/piece-fox.glb', [])).toMatch(/piece-/);
    expect(idProblem('models/marker-gap.glb', [])).toMatch(/marker-/);
    expect(idProblem('models/primitive-box.glb', [])).toMatch(/primitive-/);
  });
});

describe('moves', () => {
  const files = ['models/chair.glb', 'models/lamp.glb', 'models/kit/table.glb'];
  const used = new Set(['chair']);

  it('moves a file between folders even while it is placed, since its id stays', () => {
    expect(moveProblem('chair.glb', 'kit/chair.glb', false, files, used)).toBeNull();
  });

  it("refuses to rename a placed asset, or to take another asset's id", () => {
    expect(moveProblem('chair.glb', 'seat.glb', false, files, used)).toMatch(/placed in the room/);
    expect(moveProblem('lamp.glb', 'kit/Table.glb', false, files, used)).toMatch(/taken by models\/kit\/table\.glb/);
    expect(moveProblem('lamp.glb', 'Lamp.glb', false, files, used)).toBeNull(); // same id, a case change
  });

  it('refuses a folder into itself, the root, and bad targets', () => {
    expect(moveProblem('kit', 'kit/inner', true, files, used)).toMatch(/inside itself/);
    expect(moveProblem('kit', 'kit', true, files, used)).toMatch(/already there/);
    expect(moveProblem('', 'x', true, files, used)).toMatch(/models folder itself/);
    expect(moveProblem('kit', 'other/kit', true, files, used)).toBeNull();
    expect(moveProblem('lamp.glb', '../lamp.glb', false, files, used)).not.toBeNull();
  });
});

describe('the tree', () => {
  const file = (path: string, bytes = 1): AssetFileInfo => ({ path, id: path, bytes, mtimeMs: 0 });

  it('nests folders, makes missing parents and sorts folders, then files, by name', () => {
    const tree = buildAssetTree(['b', 'a/empty'], [file('z.glb'), file('A.glb'), file('a/x/y.glb'), file('b/c.glb')]);
    expect(tree.folders.map((f) => f.name)).toEqual(['a', 'b']);
    expect(tree.files.map((f) => f.path)).toEqual(['A.glb', 'z.glb']);
    const a = tree.folders[0];
    expect(a.folders.map((f) => f.path)).toEqual(['a/empty', 'a/x']);
    expect(a.folders[1].files.map((f) => f.path)).toEqual(['a/x/y.glb']);
    expect(filesOf(tree).map((f) => f.path)).toEqual(['A.glb', 'z.glb', 'a/x/y.glb', 'b/c.glb']);
  });

  it("reads the model files from the bundler's glob keys", () => {
    expect(
      modelPathsFromGlob([
        '../assets/models/chair.glb',
        '../assets/models/kit/Table.glb',
        '../assets/audio/rain.ogg',
        '../assets/models/notes.png',
      ]),
    ).toEqual(['chair.glb', 'kit/Table.glb']);
  });
});

describe('glbProblem', () => {
  it('takes a self-contained .glb', () => {
    expect(glbProblem(glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] }))).toBeNull();
    expect(glbProblem(glb({ asset: { version: '2.0' }, images: [{ uri: 'data:image/png;base64,AA==' }] }))).toBeNull();
  });

  it('refuses other files, other versions, cut files and outside references', () => {
    expect(glbProblem(new TextEncoder().encode('{"asset":{"version":"2.0"}}'))).toMatch(/not a \.glb|too short/);
    expect(glbProblem(glb({}, { magic: 0x12345678 }))).toMatch(/not a \.glb/);
    expect(glbProblem(glb({}, { version: 1 }))).toMatch(/version 1/);
    expect(glbProblem(glb({}, { lengthDelta: 8 }))).toMatch(/cut short/);
    expect(glbProblem(glb({ buffers: [{ uri: 'scene.bin', byteLength: 4 }] }))).toMatch(/other files/);
    expect(glbProblem(glb({ images: [{ uri: 'wood.png' }] }))).toMatch(/other files/);
  });
});
