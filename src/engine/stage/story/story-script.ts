// The story as the game plays it (docs/STORY.md): the scenes after waking, in order, each a list of beats (story-director.ts).
// Scene 1 (waking) runs before this, from the candle; scenes 3 to 7 are added here as they are built.
import { HOW_THEY_MET_SCENE } from './how-they-met';
import type { StoryScene } from './story-director';

export const STORY_SCRIPT: readonly StoryScene[] = [
  {
    id: 'how-they-met',
    beats: [
      // The friend's hand makes a rabbit on the left of the wall and waits for the player to copy it.
      { kind: 'friend', shape: 'rabbit', x: -0.28, y: 0.04 },
      // The player's rabbit becomes the puppet rabbit, and the memory plays.
      { kind: 'memory', scene: HOW_THEY_MET_SCENE, from: 'rabbit' },
    ],
  },
];
