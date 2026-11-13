import { describe, expect, it } from 'vitest';
import { POSE_STRIDE, validateScene, type Cue, type PuppetScene } from '../puppet/puppet-scene';
import {
  FRIEND_DELAY_S,
  FRIEND_IN_S,
  FRIEND_OUT_S,
  HANDOFF_S,
  StoryDirector,
  validateStory,
  type StoryScene,
} from './story-director';
import { HOW_THEY_MET_SCENE } from './how-they-met';
import { STORY_SCRIPT } from './story-script';

const memory: PuppetScene = {
  id: 'memory',
  length: 3,
  parts: [{ id: 'rabbit', art: 'rabbit', w: 0.1, h: 0.1, x: 0.1, y: 0.2 }],
  tracks: [],
  cues: [{ t: 1, kind: 'note', note: 1 }],
};
const story: StoryScene[] = [
  {
    id: 'a',
    beats: [
      { kind: 'friend', shape: 'rabbit', x: -0.3, y: 0 },
      { kind: 'memory', scene: memory, from: 'rabbit' },
    ],
  },
  { id: 'b', beats: [{ kind: 'friend', shape: 'fox', x: 0, y: 0 }] },
];

const run = (d: StoryDirector, s: number, step = 0.05) => {
  for (let t = 0; t < s - 1e-9; t += step) d.update(step);
};

describe('StoryDirector', () => {
  it('shows the friend’s hand after a moment, fading in, and waits for as long as it takes', () => {
    const d = new StoryDirector(story);
    d.start();
    expect(d.friendShape).toBe('rabbit');
    run(d, FRIEND_DELAY_S);
    expect(d.friendLevel).toBe(0);
    run(d, FRIEND_IN_S + 0.1);
    expect(d.friendOpacity).toBe(1);
    run(d, 600);
    expect(d.waitingForShape).toBe(true);
    expect(d.memory).toBeNull();
  });

  it('moves on only for the shape it shows, then the hand fades as the memory plays', () => {
    const heard: number[] = [];
    const d = new StoryDirector(story, (c: Cue) => c.kind === 'note' && heard.push(c.note));
    d.start();
    run(d, 4);
    expect(d.commit('fox')).toBe(false);
    expect(d.commit('rabbit')).toBe(true);
    expect(d.memory?.scene).toBe(memory);
    run(d, FRIEND_OUT_S + 0.1);
    expect(d.friendShape).toBeNull();
    run(d, 1);
    expect(heard).toEqual([1]);
  });

  it('starts the memory’s puppet where the player’s shadow was and eases it home', () => {
    const d = new StoryDirector(story);
    d.start();
    run(d, 4);
    d.commit('rabbit', -0.2, 0.05);
    const world = d.memory!.world;
    expect(world[0]).toBeCloseTo(-0.2);
    expect(world[1]).toBeCloseTo(0.05);
    run(d, HANDOFF_S + 0.1);
    expect(world[0]).toBeCloseTo(0.1);
    expect(world[1]).toBeCloseTo(0.2);
    expect(world[POSE_STRIDE - 1]).toBe(1);
  });

  it('after the memory, goes on to the next scene, and stops at the end of the script', () => {
    const d = new StoryDirector(story);
    d.start();
    run(d, 3);
    d.commit('rabbit');
    run(d, memory.length + 0.2);
    expect(d.sceneIndex).toBe(1);
    expect(d.friendShape).toBe('fox');
    run(d, 4);
    d.commit('fox');
    expect(d.playing).toBe(false);
  });

  it('holds still while paused', () => {
    const d = new StoryDirector(story);
    d.start();
    run(d, 3);
    const level = d.friendLevel;
    d.update(0);
    expect(d.friendLevel).toBe(level);
  });

  it('refuses a memory that starts from a part it does not have', () => {
    const bad: StoryScene[] = [{ id: 'x', beats: [{ kind: 'memory', scene: memory, from: 'fox' }] }];
    expect(validateStory(bad).join()).toMatch(/starts from fox/);
    expect(() => new StoryDirector(bad)).toThrow();
  });
});

describe('the story script', () => {
  it('is sound, and so is every memory in it', () => {
    expect(validateStory(STORY_SCRIPT)).toEqual([]);
    expect(validateScene(HOW_THEY_MET_SCENE)).toEqual([]);
  });

  it('scene 2 opens with the friend’s rabbit, and its memory starts from the player’s rabbit', () => {
    const [first, second] = STORY_SCRIPT[0].beats;
    expect(first).toMatchObject({ kind: 'friend', shape: 'rabbit' });
    expect(second).toMatchObject({ kind: 'memory', from: 'rabbit' });
  });

  it('gives each part of a memory at most one track per prop', () => {
    for (const s of STORY_SCRIPT)
      for (const b of s.beats) {
        if (b.kind !== 'memory') continue;
        const seen = new Set<string>();
        for (const t of b.scene.tracks) {
          const key = `${t.part}.${t.prop}`;
          expect(seen.has(key), key).toBe(false);
          seen.add(key);
        }
      }
  });
});
