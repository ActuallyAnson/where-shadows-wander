import { describe, expect, it } from 'vitest';
import type { SoundPlayer } from './game-audio';
import { CAPTION_GAP_S, CaptioningPlayer } from './sound-captions';
import { Sound } from './sounds';

function setup(on = true, accepts = true) {
  const played: number[] = [];
  const shown: string[] = [];
  let time = 0;
  const inner: SoundPlayer = {
    playAt: (id) => {
      played.push(id);
      return accepts;
    },
    setLoop: () => undefined,
    moveLoop: () => undefined,
  };
  const player = new CaptioningPlayer(
    inner,
    () => on,
    (t) => void shown.push(t),
    () => time,
  );
  return { player, played, shown, advance: (s: number) => (time += s) };
}

describe('CaptioningPlayer', () => {
  it('captions the notable sounds and plays every sound as usual', () => {
    const { player, played, shown } = setup();
    player.playAt(Sound.Note2, 0, 0, 0);
    expect(shown).toEqual(['[a music-box note]']);
    expect(played).toEqual([Sound.Note2]);
  });

  it('says nothing for the busy shape sounds, when captions are off, or when the sound did not play', () => {
    const a = setup();
    a.player.playAt(Sound.Rustle, 0, 0, 0);
    a.player.playAt(Sound.Thump, 0, 0, 0);
    expect(a.shown).toEqual([]);
    const b = setup(false);
    b.player.playAt(Sound.Chime, 0, 0, 0);
    expect(b.shown).toEqual([]);
    const c = setup(true, false);
    c.player.playAt(Sound.Chime, 0, 0, 0);
    expect(c.shown).toEqual([]);
  });

  it('does not count a caption that could not be shown', () => {
    const played: number[] = [];
    let visible = false;
    const shown: string[] = [];
    const player = new CaptioningPlayer(
      { playAt: (id) => (played.push(id), true), setLoop: () => undefined, moveLoop: () => undefined },
      () => true,
      (t) => (visible ? (shown.push(t), true) : false),
      () => 0,
    );
    player.playAt(Sound.Chime, 0, 0, 0);
    visible = true;
    player.playAt(Sound.Chime, 0, 0, 0); // at once: the first one never used the gap
    expect(shown).toEqual(['[a soft chime]']);
  });

  it('leaves a gap between captions so a run of sparkles does not flood the wall', () => {
    const { player, shown, advance } = setup();
    player.playAt(Sound.Twinkle, 0, 0, 0);
    advance(0.5);
    player.playAt(Sound.Chime, 0, 0, 0);
    expect(shown).toHaveLength(1);
    advance(CAPTION_GAP_S);
    player.playAt(Sound.Chime, 0, 0, 0);
    expect(shown).toEqual(['[a tiny sparkle]', '[a soft chime]']);
  });
});
