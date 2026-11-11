// The room editor's scene tree: the room's pieces grouped by layout section (Room, Lap) and by what owns them (Furniture,
// Dressing, ...; the models placed in the editor are "Added"). Grouping only: the pieces are not children of one another.
// No three.js and no DOM, so it is tested in Node.
import { LAYOUT_SECTIONS, type LayoutSection } from '../engine/stage/room-layout';

export interface TreeEntry {
  /** `section:id`, as the editor keys pieces. */
  readonly key: string;
  readonly id: string;
  readonly section: LayoutSection;
  /** The group it is listed under (the label of what owns it). */
  readonly group: string;
}

export interface TreeGroup {
  readonly label: string;
  readonly entries: TreeEntry[];
}

export interface TreeSection {
  readonly section: LayoutSection;
  readonly label: string;
  readonly groups: TreeGroup[];
}

const SECTION_LABEL: Readonly<Record<LayoutSection, string>> = { room: 'Room', lap: 'Lap' };

/**
 * The tree: sections in the layout's order, groups in `groupOrder` (any other after them, by name), pieces by id. Empty
 * groups and sections are left out.
 */
export function sceneTree(entries: readonly TreeEntry[], groupOrder: readonly string[] = []): TreeSection[] {
  const rank = (label: string) => {
    const at = groupOrder.indexOf(label);
    return at < 0 ? groupOrder.length : at;
  };
  const out: TreeSection[] = [];
  for (const section of LAYOUT_SECTIONS) {
    const groups = new Map<string, TreeEntry[]>();
    for (const e of entries) {
      if (e.section !== section) continue;
      const list = groups.get(e.group);
      if (list) list.push(e);
      else groups.set(e.group, [e]);
    }
    if (groups.size === 0) continue;
    const sorted = [...groups.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([label, list]) => ({ label, entries: list.sort((a, b) => a.id.localeCompare(b.id)) }));
    out.push({ section, label: SECTION_LABEL[section], groups: sorted });
  }
  return out;
}
