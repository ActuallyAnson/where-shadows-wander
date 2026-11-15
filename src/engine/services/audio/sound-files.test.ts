import { describe, expect, it } from 'vitest';
import { loadSoundFiles, soundFiles } from './sound-files';
import { Sound } from './sounds';

describe('soundFiles', () => {
  it('matches files in audio/sfx to sounds by name', () => {
    const files = {
      '../assets/audio/sfx/thunder.ogg': '/t.ogg',
      '../assets/audio/sfx/Rain.ogg': '/r.ogg',
      '../assets/audio/sfx/not-a-sound.ogg': '/x.ogg',
      '../assets/audio/music/thunder.ogg': '/m.ogg',
      '../assets/models/thunder.glb': '/g.glb',
    };
    expect(soundFiles(files)).toEqual([
      { sound: Sound.Rain, url: '/r.ogg' },
      { sound: Sound.Thunder, url: '/t.ogg' },
    ]);
  });

  it('takes one file per sound', () => {
    const files = { '../assets/audio/sfx/thunder.ogg': '/a', '../assets/audio/sfx/thunder.wav': '/b' };
    expect(soundFiles(files)).toEqual([{ sound: Sound.Thunder, url: '/a' }]);
  });
});

describe('loadSoundFiles', () => {
  it('hands over what decodes and keeps the placeholder for what fails', async () => {
    const used: [number, string][] = [];
    const loaded = await loadSoundFiles(
      [
        { sound: Sound.Thunder, url: 'ok' },
        { sound: Sound.Rain, url: 'bad' },
      ],
      async (url) => {
        if (url === 'bad') throw new Error('404');
        return new ArrayBuffer(4);
      },
      async (bytes) => `decoded ${bytes.byteLength}`,
      (sound, buffer) => used.push([sound, buffer]),
    );
    expect(loaded).toEqual([Sound.Thunder]);
    expect(used).toEqual([[Sound.Thunder, 'decoded 4']]);
  });
});
