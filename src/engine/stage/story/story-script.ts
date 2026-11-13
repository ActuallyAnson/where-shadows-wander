// The story as the game plays it (docs/STORY.md): the scenes after waking, in order, each a list of beats (story-director.ts).
// Scene 1 (waking) runs before this, from the candle. The memories are chapters of one puppet show (story-stage.ts): each
// memory beat plays its chapter, and the friend beat after it waits over that chapter's last picture. Scenes 3 to 7 are added
// here as they are built.
import type { StoryScene } from './story-director';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

const chapter = (id: string) => ({ scene: STORY_STAGE, ...STORY_CHAPTER[id] });

export const STORY_SCRIPT: readonly StoryScene[] = [
  {
    id: 'how-they-met',
    beats: [
      // The friend's hand makes a rabbit on the left of the empty wall, in the candle's first light, and waits.
      { kind: 'friend', shape: 'rabbit', x: -0.28, y: 0.04 },
      // The player's rabbit becomes the puppet rabbit, and the fort slides in around it. It ends on the friend's raised hand.
      { kind: 'memory', from: 'rabbit', ...chapter('how-they-met') },
    ],
  },
  {
    id: 'the-park',
    beats: [
      // In the fort, between the kids, the friend's hand rises beyond his puppet's raised one, making a fox: now this one.
      { kind: 'friend', shape: 'fox', x: -0.08, y: 0.17, rise: 0.08 },
      // The player's fox pounces at the rabbit on the blanket, and the chase carries them out of the fort.
      { kind: 'memory', from: 'fox', ...chapter('the-park') },
    ],
  },
];
