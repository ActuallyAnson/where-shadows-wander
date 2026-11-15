import { describe, expect, it } from 'vitest';
import { FRIEND_PUPPETS } from '../stage/story/friend-puppet';
import { STORY_STAGE } from '../stage/story/story-stage';
import { isImageArt, PUPPET_ART } from './puppet-art';

describe('puppet art', () => {
  it('paints every cut-out the story’s scenes and the friend’s hands name', () => {
    for (const scene of [STORY_STAGE, ...Object.values(FRIEND_PUPPETS)])
      for (const p of scene.parts)
        if (p.art && !isImageArt(p.art)) expect(PUPPET_ART[p.art], `${scene.id}: ${p.art}`).toBeTypeOf('function');
  });
});
