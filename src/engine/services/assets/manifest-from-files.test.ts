import { AssetType } from '@iwsdk/core';
import { describe, expect, it } from 'vitest';
import { manifestFromFiles } from './manifest-from-files';

describe('manifestFromFiles', () => {
  const files = {
    '../assets/models/crow.glb': '/src/assets/models/crow.glb',
    '../assets/critical/paper.webp': '/src/assets/critical/paper.webp',
    '../assets/audio/sfx/rustle.ogg': '/src/assets/audio/sfx/rustle.ogg',
    '../assets/notes.txt': '/src/assets/notes.txt',
  };

  it('makes one entry per asset file with its type, priority and url, and skips other files', () => {
    expect(manifestFromFiles(files)).toEqual({
      crow: { url: '/src/assets/models/crow.glb', type: AssetType.GLTF, priority: 'lazy', name: 'crow' },
      paper: { url: '/src/assets/critical/paper.webp', type: AssetType.Texture, priority: 'critical', name: 'paper' },
      rustle: {
        url: '/src/assets/audio/sfx/rustle.ogg',
        type: AssetType.Audio,
        priority: 'background',
        name: 'rustle',
      },
    });
  });

  it('is the same whatever order the files come in', () => {
    const reversed = Object.fromEntries(Object.entries(files).reverse());
    expect(Object.keys(manifestFromFiles(reversed))).toEqual(Object.keys(manifestFromFiles(files)));
  });

  it('gives a nested folder named critical or audio no say in the priority', () => {
    const m = manifestFromFiles({
      '../assets/models/critical/a.glb': '/1',
      '../assets/models/audio/rug.webp': '/2',
    });
    expect(m.a.priority).toBe('lazy');
    expect(m.rug.priority).toBe('lazy');
  });

  it('skips .gltf (the budget check reports it) and refuses ids that belong to IWSDK', () => {
    expect(manifestFromFiles({ '../assets/models/crow.gltf': '/1' })).toEqual({});
    expect(() => manifestFromFiles({ '../assets/models/primitive-box.glb': '/1' })).toThrow(/primitive-/);
  });

  it('refuses two files with one id, or an id another entry already has', () => {
    expect(() => manifestFromFiles({ '../assets/a/crow.glb': '/1', '../assets/b/Crow.png': '/2' })).toThrow(
      /two assets would have the id "crow"/,
    );
    expect(() => manifestFromFiles({ '../assets/crow.glb': '/1' }, new Set(['crow']))).toThrow(/"crow"/);
  });
});
