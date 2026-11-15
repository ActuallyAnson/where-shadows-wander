import { describe, expect, it } from 'vitest';
import { sceneTree, type TreeEntry } from './room-scene-tree';

const e = (section: 'room' | 'lap', id: string, group: string): TreeEntry => ({
  key: `${section}:${id}`,
  id,
  section,
  group,
});

describe('sceneTree', () => {
  it('groups pieces by section, then by owner in the given order, then by id', () => {
    const tree = sceneTree(
      [
        e('room', 'rug', 'Furniture'),
        e('lap', 'tray', 'Tray'),
        e('room', 'chair-2', 'Added'),
        e('room', 'bed', 'Furniture'),
        e('room', 'sill', 'Dressing'),
        e('room', 'zebra', 'Other'),
        e('lap', 'mug', 'Added'),
      ],
      ['Furniture', 'Dressing', 'Tray', 'Added'],
    );
    expect(tree.map((s) => s.label)).toEqual(['Room', 'Lap']);
    expect(tree[0].groups.map((g) => g.label)).toEqual(['Furniture', 'Dressing', 'Added', 'Other']);
    expect(tree[0].groups[0].entries.map((x) => x.id)).toEqual(['bed', 'rug']);
    expect(tree[1].groups.map((g) => g.label)).toEqual(['Tray', 'Added']);
  });

  it('leaves out empty sections', () => {
    expect(sceneTree([e('lap', 'quilt', 'Tray')]).map((s) => s.section)).toEqual(['lap']);
    expect(sceneTree([])).toEqual([]);
  });
});
