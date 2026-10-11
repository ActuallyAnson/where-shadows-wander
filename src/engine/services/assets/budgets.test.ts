import { describe, expect, it } from 'vitest';
import {
  assetIdOf,
  BUDGETS,
  checkCriticalTotal,
  checkFile,
  checkInitialBundle,
  checkSourceName,
  classify,
  extensionOf,
  firstLoadFiles,
  foldersUnderAssets,
  priorityOf,
} from './budgets.mjs';

describe('classify', () => {
  it('sorts files by extension, with audio in a music folder counting as music', () => {
    expect(classify('a/paper.PNG')).toBe('texture');
    expect(classify('a/room.hdr')).toBe('texture');
    expect(classify('a/crow.glb')).toBe('model');
    expect(classify('a/rustle.ogg')).toBe('sfx');
    expect(classify('src/assets/audio/music/night.mp3')).toBe('music');
    expect(classify('src/assets/audio/musical/night.mp3')).toBe('sfx');
    expect(classify('src/assets/audio/music.mp3')).toBe('sfx');
    expect(classify('a/crow.gltf')).toBeNull();
    expect(classify('a/readme.md')).toBeNull();
    expect(classify('a/noext')).toBeNull();
  });

  it('ignores a query string, and takes Windows separators', () => {
    expect(extensionOf('/assets/crow-abc123.glb?import&url')).toBe('glb');
    expect(classify('src\\assets\\audio\\music\\night.mp3')).toBe('music');
  });
});

describe('priorityOf', () => {
  it('reads the first folder under assets, not a deeper one or the file name', () => {
    expect(foldersUnderAssets('../assets/critical/paper.png')).toEqual(['critical']);
    expect(priorityOf('../assets/critical/paper.png')).toBe('critical');
    expect(priorityOf('src/assets/audio/sfx/rustle.ogg')).toBe('background');
    expect(priorityOf('../assets/models/crow.glb')).toBe('lazy');
    expect(priorityOf('../assets/crow.glb')).toBe('lazy');
    expect(priorityOf('../assets/models/critical/x.glb')).toBe('lazy');
    expect(priorityOf('../assets/models/audio/rug.webp')).toBe('lazy');
    expect(priorityOf('../assets/audio.png')).toBe('lazy');
    expect(priorityOf('somewhere/critical/x.png')).toBe('lazy');
  });
});

describe('checkSourceName', () => {
  it('flags files that would not reach the game as intended', () => {
    expect(checkSourceName('src/assets/models/crow.glb')).toBeNull();
    expect(checkSourceName('src/assets/models/crow.gltf')).toMatch(/single-file \.glb/);
    expect(checkSourceName('src/assets/models/crow.bin')).toMatch(/single-file \.glb/);
    expect(checkSourceName('src/assets/models/Crow.GLB')).toMatch(/lower case \(\.glb\)/);
    expect(checkSourceName('src/assets/models/.gitkeep')).toBeNull();
  });
});

describe('checkFile', () => {
  it('passes a file at its limit and names one a byte over', () => {
    expect(checkFile('x.png', BUDGETS.perFileBytes.texture)).toBeNull();
    expect(checkFile('x.png', BUDGETS.perFileBytes.texture + 1)).toMatch(/x\.png is .* over the .* texture budget/);
    expect(checkFile('x.glb', BUDGETS.perFileBytes.model + 1)).toMatch(/model budget/);
    expect(checkFile('src/assets/audio/sfx/x.ogg', BUDGETS.perFileBytes.sfx + 1)).toMatch(/sfx budget/);
    expect(checkFile('src/assets/audio/music/x.ogg', BUDGETS.perFileBytes.music)).toBeNull();
    expect(checkFile('src/assets/audio/music/x.ogg', BUDGETS.perFileBytes.music + 1)).toMatch(/music budget/);
  });

  it('does not check files that are not assets', () => {
    expect(checkFile('x.json', 1e9)).toBeNull();
  });
});

describe('checkCriticalTotal and checkInitialBundle', () => {
  it('add up the critical files', () => {
    const half = BUDGETS.criticalTotalBytes / 2;
    expect(checkCriticalTotal([])).toBeNull();
    expect(
      checkCriticalTotal([
        { path: 'a', bytes: half },
        { path: 'b', bytes: half },
      ]),
    ).toBeNull();
    expect(
      checkCriticalTotal([
        { path: 'a', bytes: half },
        { path: 'b', bytes: half + 1 },
      ]),
    ).toMatch(/critical assets total/);
  });

  it('flags a bundle over budget', () => {
    expect(checkInitialBundle(BUDGETS.initialBundleGzipBytes)).toBeNull();
    expect(checkInitialBundle(BUDGETS.initialBundleGzipBytes + 1)).toMatch(/initial bundle is/);
  });
});

describe('firstLoadFiles', () => {
  const files: Record<string, string> = {
    'assets/main-A.js': 'import{a}from"./chunk-B.js";import"./chunk-C.js";const lazy=()=>import("./lazy-D.js");',
    'assets/chunk-B.js': 'export const a=1;import{x}from"./chunk-C.js";',
    'assets/chunk-C.js': 'export const x=2;',
    'assets/preload-E.js': 'export const e=1;',
    'assets/lazy-D.js': 'export const d=1;',
  };
  const read = (f: string) => files[f] ?? null;

  it('follows scripts, preloads and static imports, and skips import()', () => {
    const html =
      '<script type="module" src="./assets/main-A.js"></script><link rel="modulepreload" href="./assets/preload-E.js">';
    expect(firstLoadFiles(html, read).sort()).toEqual([
      'assets/chunk-B.js',
      'assets/chunk-C.js',
      'assets/main-A.js',
      'assets/preload-E.js',
    ]);
  });

  it('takes src without the ./ prefix too, and returns nothing when the page names nothing', () => {
    expect(firstLoadFiles('<script src="assets/main-A.js"></script>', read)).toContain('assets/main-A.js');
    expect(firstLoadFiles('<script src="/where-shadows-wander/assets/main-A.js"></script>', read)).toEqual([]);
    expect(firstLoadFiles('<html></html>', read)).toEqual([]);
  });
});

describe('assetIdOf', () => {
  it('uses the lower-case file name with hyphens', () => {
    expect(assetIdOf('../assets/models/Paper Crow_v2.glb')).toBe('paper-crow-v2');
    expect(assetIdOf('a/b/night.ambience.ogg')).toBe('night-ambience');
    expect(assetIdOf('a/--x--.png')).toBe('x');
  });
});
