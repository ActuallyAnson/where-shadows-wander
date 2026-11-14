import { describe, expect, it } from 'vitest';
import { POSE_STRIDE, validateScene, type Cue, type PuppetScene } from '../puppet/puppet-scene';
import { ScenePlayer } from '../puppet/scene-player';
import {
  FRIEND_DELAY_S,
  FRIEND_FROM_Y,
  FRIEND_IN_S,
  FRIEND_OUT_S,
  HANDOFF_S,
  StoryDirector,
  validateStory,
  type StoryScene,
} from './story-director';
import { STORY_SCRIPT } from './story-script';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

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
  it('shows the friend’s hand after a moment, rising into place, and waits for as long as it takes', () => {
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

  it('moves on only for the shape it shows, then the hand lowers away as the memory plays', () => {
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

  it('keeps the last memory on the wall, idling, while the next hand waits', () => {
    const swaying: PuppetScene = {
      ...memory,
      wobbles: [{ part: 'rabbit', prop: 'angle', amp: 0.1, period: 2 }],
    };
    const d = new StoryDirector([
      { id: 'a', beats: [{ kind: 'memory', scene: swaying }] },
      { id: 'b', beats: [{ kind: 'friend', shape: 'fox', x: 0, y: 0 }] },
    ]);
    d.start();
    run(d, swaying.length + 0.2);
    expect(d.waitingForShape).toBe(true);
    const held = d.memory!;
    expect(held.playing).toBe(false);
    expect(held.time).toBeCloseTo(swaying.length);
    const angle = held.world[2];
    run(d, 0.5);
    expect(d.memory).toBe(held);
    expect(held.time).toBeCloseTo(swaying.length);
    expect(held.world[0]).toBeCloseTo(0.1);
    expect(held.world[2]).not.toBeCloseTo(angle, 3);
  });

  it('plays a scene a chapter at a time, going on from where the last chapter stopped', () => {
    const long: PuppetScene = {
      id: 'long',
      length: 4,
      parts: [{ id: 'rabbit', art: 'rabbit', w: 0.1, h: 0.1 }],
      tracks: [
        {
          part: 'rabbit',
          prop: 'x',
          keys: [
            [0, 0],
            [4, 0.4],
          ],
        },
      ],
      cues: [
        { t: 1, kind: 'note', note: 1 },
        { t: 3, kind: 'note', note: 3 },
      ],
    };
    const heard: number[] = [];
    const d = new StoryDirector(
      [
        { id: 'a', beats: [{ kind: 'memory', scene: long, end: 2 }] },
        {
          id: 'b',
          beats: [
            { kind: 'friend', shape: 'fox', x: 0, y: 0 },
            { kind: 'memory', scene: long, start: 2 },
          ],
        },
      ],
      (c) => c.kind === 'note' && heard.push(c.note),
    );
    d.start();
    run(d, 2.3);
    expect(d.waitingForShape).toBe(true);
    expect(d.memory!.world[0]).toBeCloseTo(0.2);
    expect(heard).toEqual([1]);
    d.commit('fox');
    expect(d.memory!.world[0]).toBeCloseTo(0.2);
    run(d, 1.5);
    expect(d.memory!.world[0]).toBeCloseTo(0.35);
    expect(heard).toEqual([1, 3]);
  });

  it('lifts the friend’s hand up from below the wall into place, all there, and lowers it away once copied', () => {
    const d = new StoryDirector([
      {
        id: 'a',
        beats: [
          { kind: 'friend', shape: 'fox', x: 0, y: 0.2 },
          { kind: 'wait', seconds: 9 },
        ],
      },
    ]);
    d.start();
    expect(d.friendOpacity).toBe(0);
    expect(d.friendDrop).toBeCloseTo(0.2 - FRIEND_FROM_Y);
    run(d, FRIEND_DELAY_S + FRIEND_IN_S / 2);
    // Never faded in: it is a hand coming up into the light.
    expect(d.friendOpacity).toBe(1);
    expect(d.friendDrop).toBeGreaterThan(0);
    expect(d.friendDrop).toBeLessThan(0.2 - FRIEND_FROM_Y);
    // It comes up loose, and forms its shape as it arrives.
    expect(d.friendShapeT).toBeLessThan(0.1);
    run(d, FRIEND_IN_S);
    expect(d.friendDrop).toBe(0);
    expect(d.friendShapeT).toBeGreaterThan(0);
    d.commit('fox');
    run(d, FRIEND_OUT_S / 2);
    expect(d.friendOpacity).toBe(1);
    expect(d.friendDrop).toBeGreaterThan(0);
    run(d, FRIEND_OUT_S);
    expect(d.friendShape).toBeNull();
    expect(d.friendOpacity).toBe(0);
  });

  it('fades the friend’s hand where it is when its beat says so', () => {
    const d = new StoryDirector([
      {
        id: 'a',
        beats: [
          { kind: 'friend', shape: 'flat', x: 0, y: 0, out: 4, leave: 'fade' },
          { kind: 'wait', seconds: 9 },
        ],
      },
    ]);
    d.start();
    run(d, FRIEND_DELAY_S + FRIEND_IN_S + 0.1);
    d.commit('flat');
    run(d, 2);
    expect(d.friendDrop).toBe(0);
    expect(d.friendOpacity).toBeGreaterThan(0.2);
    expect(d.friendOpacity).toBeLessThan(0.8);
  });

  it('refuses a memory that plays outside its scene', () => {
    const bad: StoryScene[] = [{ id: 'x', beats: [{ kind: 'memory', scene: memory, start: 2, end: 5 }] }];
    expect(validateStory(bad).join()).toMatch(/outside/);
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
    expect(validateScene(STORY_STAGE)).toEqual([]);
  });

  it('scene 2 opens on the night they met, then the friend’s rabbit, and its memory starts from the player’s rabbit', () => {
    const [prologue, first, second] = STORY_SCRIPT[0].beats;
    expect(prologue).toMatchObject({ kind: 'memory', start: STORY_CHAPTER['the-storm'].start });
    expect(prologue).not.toHaveProperty('from');
    expect(first).toMatchObject({ kind: 'friend', shape: 'rabbit' });
    expect(second).toMatchObject({ kind: 'memory', from: 'rabbit' });
  });

  it('lights the room’s window with the night they met’s lightning', () => {
    const storm = (STORY_STAGE.cues ?? []).filter((c) => c.kind === 'storm');
    expect(storm.length).toBe(1);
    expect(storm[0].t).toBeLessThan(STORY_CHAPTER['the-storm'].end);
  });

  it('plays the memories as one show: each chapter starts where the one before it ended', () => {
    const memories = STORY_SCRIPT.flatMap((s) => s.beats).filter((b) => b.kind === 'memory');
    expect(memories.length).toBeGreaterThan(1);
    let at = 0;
    for (const m of memories) {
      expect(m.scene).toBe(STORY_STAGE);
      expect(m.start).toBeCloseTo(at);
      at = m.end!;
    }
    expect(at).toBeCloseTo(STORY_STAGE.length);
  });

  it('never fades the fort: it comes down from above the wall on the night they met, and slides off to the left', () => {
    const fort = STORY_STAGE.tracks.filter((t) => t.part === 'fort');
    expect(fort.map((t) => t.prop).sort()).toEqual(['x', 'y']);
    const x = fort.find((t) => t.prop === 'x')!.keys;
    expect(x[0][1]).toBeCloseTo(0);
    expect(x[x.length - 1][1]).toBeLessThan(-1);
    const p = new ScenePlayer(STORY_STAGE);
    const fortY = (t: number) => {
      p.seek(t);
      return p.world[p.partIndex('fort') * POSE_STRIDE + 1];
    };
    // Hung above the wall (its base past the top) when the story starts...
    expect(fortY(0)).toBeGreaterThan(0.53);
    // ...and down, in place, while the friend's rabbit waits, and still while her fox waits.
    const down = fortY(STORY_CHAPTER['the-storm'].end);
    expect(down).toBeLessThan(0);
    expect(fortY(STORY_CHAPTER['how-they-met'].end)).toBeCloseTo(down);
    expect(p.world[p.partIndex('fort') * POSE_STRIDE]).toBeCloseTo(0);
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

describe('StoryDirector: waits, sleep and checkpoints', () => {
  const chapterOne: PuppetScene = {
    id: 'one',
    length: 2,
    parts: [{ id: 'kid', art: 'kid', w: 0.1, h: 0.1 }],
    tracks: [
      {
        part: 'kid',
        prop: 'x',
        keys: [
          [0, 0],
          [2, 0.5],
        ],
      },
    ],
  };
  const ending: StoryScene[] = [
    {
      id: 'memory',
      beats: [
        { kind: 'friend', shape: 'rabbit', x: 0, y: 0 },
        { kind: 'memory', scene: chapterOne },
      ],
    },
    {
      id: 'goodbye',
      candle: 'low',
      beats: [
        { kind: 'friend', shape: 'flat', puppet: 'flat-still', x: 0, y: 0, out: 5 },
        { kind: 'wait', seconds: 2 },
      ],
    },
    { id: 'sleep', beats: [{ kind: 'sleep' }] },
  ];

  it('names the friend’s painted hand by its puppet, or by its shape', () => {
    const d = new StoryDirector(ending);
    d.start();
    expect(d.friendPuppet).toBe('rabbit');
    d.start(1);
    expect(d.friendPuppet).toBe('flat-still');
    expect(d.friendShape).toBe('flat');
  });

  it('fades the hand over the beat’s own time, waits, and then waits for sleep for as long as it takes', () => {
    const d = new StoryDirector(ending);
    d.start(1);
    run(d, 4);
    expect(d.commit('flat')).toBe(true);
    run(d, 1.5);
    expect(d.friendLevel).toBeGreaterThan(0.6);
    expect(d.waitingForSleep).toBe(false);
    run(d, 1);
    expect(d.waitingForSleep).toBe(true);
    run(d, 600);
    expect(d.waitingForSleep).toBe(true);
    expect(d.sleep()).toBe(true);
    expect(d.asleep).toBe(true);
    expect(d.playing).toBe(false);
    expect(d.sleep()).toBe(false);
  });

  it('only sleeps at a sleep beat', () => {
    const d = new StoryDirector(ending);
    d.start();
    expect(d.sleep()).toBe(false);
    expect(d.asleep).toBe(false);
  });

  it('starts part-way on the picture the memory before it ended on, holding there', () => {
    const d = new StoryDirector(ending);
    d.start(1);
    expect(d.memory?.scene).toBe(chapterOne);
    expect(d.memory?.playing).toBe(false);
    expect(d.memory?.world[0]).toBeCloseTo(0.5);
    expect(d.waitingForShape).toBe(true);
    expect(d.candleMood).toBe('low');
    d.start(0);
    expect(d.memory).toBeNull();
  });

  it('starts every scene of the real story, each waiting on its first beat', () => {
    const d = new StoryDirector(STORY_SCRIPT);
    STORY_SCRIPT.forEach((s, i) => {
      d.start(i);
      expect(d.sceneIndex, s.id).toBe(i);
      if (i > 0) expect(d.memory, s.id).not.toBeNull();
    });
  });

  it('plays the whole story, a shape at a time, to sleep', () => {
    const d = new StoryDirector(STORY_SCRIPT);
    d.start();
    for (let guard = 0; guard < 40 && !d.waitingForSleep; guard++) {
      const b = d.beat;
      if (b?.kind === 'friend') {
        run(d, FRIEND_DELAY_S + 0.5, 0.1);
        expect(d.commit(b.shape, 0, 0)).toBe(true);
      }
      run(d, 70, 0.1);
    }
    expect(d.waitingForSleep).toBe(true);
    expect(d.sleep()).toBe(true);
  });
});
