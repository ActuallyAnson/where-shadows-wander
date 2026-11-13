import { describe, expect, it } from 'vitest';
import { FRIEND_PUPPETS } from '../stage/story/friend-puppet';
import { HOW_THEY_MET_SCENE } from '../stage/story/how-they-met';
import { isImageArt, PUPPET_ART } from './puppet-art';

describe('puppet art', () => {
  it('paints every cut-out the story’s scenes and the friend’s hands name', () => {
    for (const scene of [HOW_THEY_MET_SCENE, ...Object.values(FRIEND_PUPPETS)])
      for (const p of scene.parts)
        if (p.art && !isImageArt(p.art)) expect(PUPPET_ART[p.art], `${scene.id}: ${p.art}`).toBeTypeOf('function');
  });
});
