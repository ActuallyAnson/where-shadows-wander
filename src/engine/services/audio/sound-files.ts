// Real sound files in place of the placeholders made in code. A file in src/assets/audio/sfx (or music) named after a sound
// (thunder.ogg is Sound.Thunder, music/music.ogg is Sound.Music, by SOUND_DEFS[].name) replaces that sound once it is fetched and decoded; until then,
// or if it fails, the placeholder plays. Plain TypeScript: the fetch and the decoder are passed in.
import { assetIdOf } from '../assets/budgets.mjs';
import { SOUND_COUNT, SOUND_DEFS, type SoundId } from './sounds';

const SFX_FILE = /(^|\/)assets\/audio\/(sfx|music)\/[^/]+\.(ogg|opus|mp3|m4a|wav)$/;

/** The sounds that have a file, with its URL, from the asset files (source path → URL). A file named after no sound is left out. */
export function soundFiles(files: Readonly<Record<string, string>>): { sound: SoundId; url: string }[] {
  const out: { sound: SoundId; url: string }[] = [];
  for (const path of Object.keys(files).sort()) {
    if (!SFX_FILE.test(path)) continue;
    const id = assetIdOf(path);
    for (let i = 0; i < SOUND_COUNT; i++)
      if (SOUND_DEFS[i].name === id && !out.some((f) => f.sound === i))
        out.push({ sound: i as SoundId, url: files[path] });
  }
  return out;
}

/**
 * Fetches and decodes each sound's file and hands it to `use`. Resolves with the sounds that loaded; one that fails keeps its
 * placeholder.
 */
export async function loadSoundFiles<B>(
  files: readonly { sound: SoundId; url: string }[],
  fetchBytes: (url: string) => Promise<ArrayBuffer>,
  decode: (bytes: ArrayBuffer) => Promise<B>,
  use: (sound: SoundId, buffer: B) => void,
): Promise<SoundId[]> {
  const loaded: SoundId[] = [];
  await Promise.all(
    files.map(async ({ sound, url }) => {
      try {
        use(sound, await decode(await fetchBytes(url)));
        loaded.push(sound);
      } catch {
        // The placeholder plays instead.
      }
    }),
  );
  return loaded;
}
