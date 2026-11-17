import { describe, expect, it } from 'vitest';
import { POSE_STRIDE, validateScene, type Cue, type PuppetScene } from '../puppet/puppet-scene';
import { ScenePlayer } from '../puppet/scene-player';
import {
  FRIEND_DELAY_S,
  FRIEND_FROM_Y,
  FRIEND_IN_S,
  FRIEND_OUT_S,
  FRIEND_SWAP_S,
  HANDOFF_S,
  MIRROR_REACH_M,
  MIRROR_SWITCH_S,
  StoryDirector,
  validateStory,
  type StoryScene,
} from './story-director';
import { FORM_S, FRIEND_FLAT, OUTLINE_SIZE } from './friend-puppet';
import { STORY_SCRIPT } from './story-script';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

const memory: PuppetScene = {
  id: 'memory',
  length: 3,
  parts: [{ id: 'rabbit', art: 'rabbit', w: 0.1, h: 0.1, x: 0.1, y: 0.2 }],
  tracks: [],
  cues: [{ t: 1, kind: 'step', variant: 0, x: 1, y: 0 }],
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
    const d = new StoryDirector(story, (c: Cue) => c.kind === 'step' && heard.push(c.x));
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
        { t: 1, kind: 'step', variant: 0, x: 1, y: 0 },
        { t: 3, kind: 'step', variant: 0, x: 3, y: 0 },
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
      (c) => c.kind === 'step' && heard.push(c.x),
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
    // How far down it still is, for the palm to turn with (0 in place, 1 right down).
    expect(d.friendLower).toBeGreaterThan(0);
    expect(d.friendLower).toBeLessThan(1);
    // It comes up loose, and forms its shape as it arrives.
    expect(d.friendShapeT).toBeLessThan(0.1);
    run(d, FRIEND_IN_S);
    expect(d.friendDrop).toBe(0);
    expect(d.friendLower).toBe(0);
    expect(d.friendShapeT).toBeGreaterThan(0);
    d.commit('fox');
    run(d, FRIEND_OUT_S / 2);
    expect(d.friendOpacity).toBe(1);
    expect(d.friendDrop).toBeGreaterThan(0);
    expect(d.friendLower).toBeGreaterThan(0);
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

  it('scene 2 waits on her flat hand, then the night they met, then the friend’s rabbit, its memory from the player’s rabbit', () => {
    const [gate, prologue, first, second] = STORY_SCRIPT[0].beats;
    // The gate into the story: her flat hand left of the middle, its outline facing it on the right.
    expect(gate).toMatchObject({ kind: 'friend', shape: 'flat' });
    if (gate.kind !== 'friend') throw new Error('no gate');
    expect(gate.x).toBeLessThan(0);
    expect(gate.guide).toEqual([-gate.x, gate.y]);
    // Made at the outline, with a generous margin.
    expect(gate.near).toBeGreaterThanOrEqual(0.5);
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

  it('hides the player’s hand only while a memory that asks for it plays', () => {
    const d = new StoryDirector([
      {
        id: 'goodbye',
        beats: [
          { kind: 'friend', shape: 'flat', x: 0, y: 0 },
          { kind: 'memory', scene: memory, hideHand: true },
          { kind: 'memory', scene: memory },
        ],
      },
    ]);
    d.start();
    expect(d.handHidden).toBe(false);
    run(d, FRIEND_DELAY_S + 0.5, 0.1);
    expect(d.commit('flat', 0, 0)).toBe(true);
    run(d, 1, 0.1);
    expect(d.handHidden).toBe(true);
    run(d, memory.length + 0.5, 0.1);
    expect(d.handHidden).toBe(false);
  });

  it('reports friendGuide false only when a friend beat asks to hide the outline', () => {
    const d = new StoryDirector(STORY_SCRIPT);
    d.start(0);
    expect(d.beat?.kind).toBe('friend');
    expect(d.friendGuide).toBe(true);
    const hidden = new StoryDirector([
      { id: 'x', beats: [{ kind: 'friend', shape: 'flat', x: 0, y: 0, guide: false }] },
    ]);
    hidden.start();
    expect(hidden.friendGuide).toBe(false);
    expect(hidden.guideX).toBeNaN();
    expect(hidden.guideY).toBeNaN();
  });

  it('lays the outline in scene 6 round her own palm: the middle of the flat hand as drawn, as it waits', () => {
    const goodbyeIndex = STORY_SCRIPT.findIndex((s) => s.id === 'goodbye');
    const d = new StoryDirector(STORY_SCRIPT);
    d.start(goodbyeIndex);
    const b = d.beat;
    if (b?.kind !== 'friend') throw new Error('scene 6 opens on her hand');
    expect(d.friendGuide).toBe(true);
    const palm = new ScenePlayer(FRIEND_FLAT);
    palm.offset[0] = b.x;
    palm.offset[1] = b.y;
    palm.seek(FORM_S);
    const i = palm.partIndex('palm');
    const part = FRIEND_FLAT.parts[i];
    // Held upright as it waits, the palm stands on its bottom edge: its middle is half its drawn height above that.
    expect(palm.world[i * POSE_STRIDE + 2]).toBeCloseTo(0);
    const midY = palm.world[i * POSE_STRIDE + 1] + (part.h * palm.world[i * POSE_STRIDE + 3]) / 2;
    expect(d.guideX).toBeCloseTo(palm.world[i * POSE_STRIDE]);
    expect(d.guideY).toBeCloseTo(midY);
    // The outline is the palm's own size, so it lies just round it.
    expect(OUTLINE_SIZE.flat).toBeCloseTo(part.h * palm.world[i * POSE_STRIDE + 3]);
  });

  it('plays the whole story, a shape at a time, to sleep', () => {
    const d = new StoryDirector(STORY_SCRIPT);
    d.start();
    for (let guard = 0; guard < 40 && !d.waitingForSleep; guard++) {
      const b = d.beat;
      if (b?.kind === 'friend') {
        run(d, FRIEND_DELAY_S + 0.5, 0.1);
        const at = b.guide ? b.guide : [0, 0];
        expect(d.commit(b.shape, at[0], at[1])).toBe(true);
      }
      run(d, 70, 0.1);
    }
    expect(d.waitingForSleep).toBe(true);
    expect(d.sleep()).toBe(true);
  });

  describe('a shape that counts only made at the outline (FriendBeat.near)', () => {
    const atOutline: StoryScene[] = [
      {
        id: 'gate',
        beats: [
          { kind: 'friend', shape: 'flat', x: -0.3, y: 0, guide: [0.3, 0], near: 0.6 },
          { kind: 'wait', seconds: 1 },
        ],
      },
    ];

    it('turns down the shape made far from the outline, and takes it made near it, within a share of the outline’s size', () => {
      const reach = 0.6 * OUTLINE_SIZE.flat;
      expect(OUTLINE_SIZE.flat).toBeCloseTo(0.3 * 1.35);
      const d = new StoryDirector(atOutline);
      d.start();
      expect(d.commit('flat', -0.3, 0)).toBe(false);
      expect(d.commit('flat', NaN, NaN)).toBe(false);
      expect(d.commit('flat', 0.3 + reach + 0.01, 0)).toBe(false);
      expect(d.waitingForShape).toBe(true);
      expect(d.commit('flat', 0.3 + reach * 0.7, reach * 0.7)).toBe(true);
      expect(d.waitingForShape).toBe(false);
    });

    it('takes a shape held from before once it is moved onto the outline, after her hand is in place', () => {
      const d = new StoryDirector(atOutline);
      d.start();
      // Held at the outline while her hand is still rising: not yet.
      d.follow(0.3, 0, 'flat');
      run(d, FRIEND_DELAY_S + 0.5, 0.1);
      expect(d.waitingForShape).toBe(true);
      run(d, FRIEND_IN_S, 0.1);
      expect(d.waitingForShape).toBe(false);
      // Held away from it, it waits; the wrong shape at it, it waits.
      d.start();
      d.follow(-0.2, 0, 'flat');
      run(d, FRIEND_DELAY_S + FRIEND_IN_S + 1, 0.1);
      expect(d.waitingForShape).toBe(true);
      // Measured from the middle of the hand, not the point it is followed by (a flat hand's wrist).
      d.follow(0.3, 0, 'flat', -0.2, 0);
      run(d, FRIEND_DELAY_S + FRIEND_IN_S + 1, 0.1);
      d.follow(0.3, 0, 'fist');
      run(d, 1, 0.1);
      expect(d.waitingForShape).toBe(true);
      d.follow(0.6, 0, 'flat', 0.35, 0.1);
      run(d, 0.1, 0.1);
      expect(d.waitingForShape).toBe(false);
    });

    it('is a story problem without an outline to make it at', () => {
      expect(
        validateStory([{ id: 'x', beats: [{ kind: 'friend', shape: 'flat', x: 0, y: 0, near: 0.2 }] }]),
      ).toHaveLength(1);
      expect(
        validateStory([{ id: 'x', beats: [{ kind: 'friend', shape: 'fist', x: 0, y: 0, guide: [0, 0], near: 0.2 }] }]),
      ).toHaveLength(1);
      expect(validateStory(atOutline)).toEqual([]);
    });
  });

  describe('a hand that copies the player’s first (FriendBeat.mirror)', () => {
    const mirrored: StoryScene[] = [
      { id: 'm', beats: [{ kind: 'friend', shape: 'rabbit', x: -0.3, y: 0.1, mirror: 2 }] },
    ];
    const inPlace = FRIEND_DELAY_S + FRIEND_IN_S + 0.1;

    it('rises open, follows the player’s hand and makes the shape it makes, then shows its own', () => {
      const d = new StoryDirector(mirrored);
      d.start();
      expect(d.friendPuppet).toBe('flat');
      run(d, inPlace);
      expect(d.mirroring).toBe(true);
      expect(d.friendShowing).toBe(false);
      d.follow(0.2, 0.1, null);
      d.update(0.05);
      d.follow(0.3, 0.15, 'fox');
      run(d, 1);
      expect(d.friendDX).toBeCloseTo(0.1, 2);
      expect(d.friendDY).toBeCloseTo(0.05, 2);
      expect(d.friendPuppet).toBe('fox');
      expect(d.friendShapeT).toBeLessThan(1.1); // it formed the fox afresh
      d.follow(0.3, 0.15, 'fist'); // no painted fist: an open hand
      run(d, 0.5);
      expect(d.friendPuppet).toBe('flat');
      run(d, 1);
      expect(d.mirroring).toBe(false);
      expect(d.friendShowing).toBe(true);
      expect(d.friendPuppet).toBe('rabbit');
      run(d, 4);
      expect(Math.abs(d.friendDX)).toBeLessThan(0.001);
    });

    it('only counts the time it has a hand to copy, and keeps within reach of its place', () => {
      const d = new StoryDirector(mirrored);
      d.start();
      run(d, inPlace + 10);
      expect(d.mirroring).toBe(true);
      d.follow(0, 0, null);
      d.update(0.05);
      d.follow(2, -2, null);
      run(d, 1);
      expect(d.friendDX).toBeCloseTo(MIRROR_REACH_M, 3);
      expect(d.friendDY).toBeCloseTo(-MIRROR_REACH_M, 3);
      expect(d.mirroring).toBe(true);
    });

    it('keeps its copy through a shape the player’s hand only flickers into', () => {
      const d = new StoryDirector(mirrored);
      d.start();
      run(d, inPlace);
      d.follow(0, 0, null);
      d.update(0.05);
      for (let i = 0; i < 60; i++) {
        d.follow(0, 0, i % 6 < 3 ? 'rabbit' : null); // three frames of a rabbit, three of none, over and over
        d.update(1 / 60);
      }
      expect(d.friendPuppet).toBe('flat');
      expect(d.friendPrevPuppet).toBe(null);
      d.follow(0, 0, 'rabbit');
      run(d, MIRROR_SWITCH_S + 0.05);
      expect(d.friendPuppet).toBe('rabbit');
    });

    it('changes hands by overlapping the old and the new, never thinning out, and lets the old one go', () => {
      const d = new StoryDirector(mirrored);
      d.start();
      run(d, inPlace);
      expect(d.friendSwapIn).toBe(1);
      expect(d.friendSwapOut).toBe(0);
      d.follow(0, 0, null);
      run(d, 2.5); // the copying runs out: her own rabbit
      expect(d.friendPuppet).toBe('rabbit');
      expect(d.friendPrevPuppet).toBe('flat');
      let least = 2;
      for (let t = 0; t < FRIEND_SWAP_S; t += 1 / 60) {
        least = Math.min(least, Math.max(d.friendSwapIn, d.friendSwapOut));
        d.update(1 / 60);
      }
      expect(least).toBeGreaterThan(0.5);
      expect(d.friendSwapIn).toBe(1);
      expect(d.friendPrevPuppet).toBe(null);
      expect(d.friendSwapOut).toBe(0);
    });

    it('takes the shape it waits for even while still copying', () => {
      const d = new StoryDirector(mirrored);
      d.start();
      run(d, inPlace);
      expect(d.mirroring).toBe(true);
      expect(d.commit('rabbit')).toBe(true);
    });
  });
});

describe('StoryDirector.bed', () => {
  const bedded: PuppetScene = {
    id: 'bedded',
    length: 4,
    parts: [{ id: 'rabbit', art: 'rabbit', w: 0.1, h: 0.1 }],
    tracks: [],
    cues: [
      { t: 1, kind: 'bed', bed: 'crickets' },
      { t: 3, kind: 'bed', bed: 'wind' },
    ],
  };
  const script: StoryScene[] = [
    {
      id: 'a',
      beats: [
        { kind: 'memory', scene: bedded, start: 0, end: 2 },
        { kind: 'friend', shape: 'rabbit', x: 0, y: 0 },
      ],
    },
    {
      id: 'b',
      beats: [
        { kind: 'memory', scene: bedded, start: 2, end: 4 },
        { kind: 'friend', shape: 'fox', x: 0, y: 0 },
      ],
    },
  ];

  it('follows the memory, holds through the friend’s wait, survives a skip, and is gone when the story stops', () => {
    const d = new StoryDirector(script);
    expect(d.bed).toBeNull();
    d.start();
    expect(d.memoryPlaying).toBe(true);
    expect(d.bed).toBeNull();
    d.update(0.1);
    d.skipMemory(); // skipped: the crickets' cue at 1 s never fired, but its time has passed
    expect(d.memoryPlaying).toBe(false);
    expect(d.bed).toBe('crickets');
    d.start(1); // a jump to the second scene: it opens on the first memory's last picture
    expect(d.bed).toBe('crickets');
    d.stop();
    expect(d.bed).toBeNull();
  });
});
