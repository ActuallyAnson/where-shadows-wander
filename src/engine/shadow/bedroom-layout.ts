// The bedroom's layout file (content/rooms/bedroom.json), read once when the game starts. Every view that places static
// pieces takes its placements from here; the dev room editor (Developer panel) edits this same object and saves it back.
import doc from '../../../content/rooms/bedroom.json';
import { parseRoomLayout, type ParsedRoomLayout } from '../stage/room-layout';
import { LAP_PIECE_IDS } from '../render/room/bed-tray-view';
import { BEDROOM_VIEW_PIECE_IDS } from '../render/room/bedroom-view';
import { DRESSING_PIECE_IDS } from './room-dressing-view';
import { ROOM_PIECE_IDS } from './room-models';

/** The file's name under content/rooms/, which the dev server's save endpoint writes. */
export const BEDROOM_LAYOUT_FILE = 'bedroom.json';

/** The ids each section of the file may hold. */
export const BEDROOM_PIECE_IDS = {
  room: [...ROOM_PIECE_IDS, ...DRESSING_PIECE_IDS, ...BEDROOM_VIEW_PIECE_IDS],
  lap: [...LAP_PIECE_IDS] as string[],
};

/** Reads the bedroom's layout file (anything it can't use is in `problems`, and those pieces stand at their defaults). */
export function readBedroomLayout(file: unknown = doc): ParsedRoomLayout {
  return parseRoomLayout(file, BEDROOM_PIECE_IDS);
}
