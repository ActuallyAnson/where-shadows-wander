// The story as the game plays it (docs/STORY.md): the scenes after waking, in order, each a list of beats (story-director.ts).
// Scene 1 (waking) runs before this, from the candle. The memories are chapters of one puppet show (story-stage.ts): each
// memory beat plays its chapter, and the friend beat after it waits over that chapter's last picture. Each scene names the
// candle's mood its wait opens in, so a jump to it (the Hand Lab's Story tab) starts in the right light; the memories' mood cues
// change it on the way.
import type { StoryScene } from './story-director';
import { CUP_HOLD_S } from './fireflies';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

const chapter = (id: string) => ({ scene: STORY_STAGE, ...STORY_CHAPTER[id] });

export const STORY_SCRIPT: readonly StoryScene[] = [
  {
    id: 'how-they-met',
    title: '2 · How they met',
    candle: 'rainy',
    beats: [
      // The night they met: alone in his new room in the storm, he hides under his blanket; the girl from down the street comes
      // in with her torch, puts the blanket up into a fort over them both, and raises her hand.
      { kind: 'memory', ...chapter('the-storm') },
      // Beside the girl, in the empty wall at her left (not between the kids), the friend's hand rises making a rabbit, and waits.
      { kind: 'friend', shape: 'rabbit', x: -0.5, y: 0.17 },
      // The player's rabbit becomes the puppet rabbit and hops onto her hand. It ends on her hand raised again.
      { kind: 'memory', from: 'rabbit', ...chapter('how-they-met') },
    ],
  },
  {
    id: 'the-park',
    title: '3 · The park',
    candle: 'rainy',
    beats: [
      // In the fort, at the wall's left (clear of the kids and the rabbit on the blanket), the friend's hand rises beyond her puppet's raised one, making a fox: now this one.
      { kind: 'friend', shape: 'fox', x: -0.5, y: 0.17 },
      // The player's fox pounces at the rabbit on the blanket, and the chase carries them out of the fort into the park, where
      // they become the two kids, tumble into the grass, and lie there at dusk under a firefly.
      { kind: 'memory', from: 'fox', ...chapter('the-park') },
    ],
  },
  {
    id: 'fireflies',
    title: '4 · Fireflies',
    candle: 'dusk',
    beats: [
      // Lying in the grass, the friend reaches up; her hand rises at the wall's left, cupped.
      { kind: 'friend', shape: 'cup', x: -0.34, y: 0.24 },
      // The firefly sits in the player's cup, then the hill, the jar, and the walk to school.
      { kind: 'memory', from: 'firefly', handoff: CUP_HOLD_S, ...chapter('fireflies') },
    ],
  },
  {
    id: 'last-ordinary-day',
    title: '5 · The last ordinary day',
    candle: 'morning',
    beats: [
      // At the gate the friend raises her hand, and her hand's shadow rises beside her, waving.
      { kind: 'friend', shape: 'flat', puppet: 'wave', x: -0.32, y: 0.16 },
      // The boy waves back; they go opposite ways; the friend's second wave goes unseen; the hill comes back with one boy.
      { kind: 'memory', ...chapter('last-ordinary-day') },
    ],
  },
  {
    id: 'goodbye',
    title: '6 · Goodbye',
    candle: 'low',
    beats: [
      // The empty wall, and the friend's hand held up flat, alone: the wave from the gate and from the dream. When the player's
      // hand meets it, it fades slowly away.
      { kind: 'friend', shape: 'flat', x: 0, y: 0.06, out: 6, leave: 'fade' },
      { kind: 'wait', seconds: 4 },
    ],
  },
  {
    id: 'sleep',
    title: '7 · Sleep',
    candle: 'ember',
    beats: [
      // The candle burns down to an ember of light; the player covers the flame when they are ready, and he sleeps.
      { kind: 'wait', seconds: 3 },
      { kind: 'sleep' },
    ],
  },
];
