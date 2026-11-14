// The story's puppet show (docs/STORY.md, "One story, not seven"): every memory, a chapter each, joined end to end into one
// puppet scene, so the kids, the rabbit and the places carry over from one memory into the next and the wall never goes blank.
// The story script plays it a chapter at a time (STORY_CHAPTER) and holds each chapter's last picture while the friend's hand
// shows the next shape. Scenes 6 and 7 have no memory: the wall is empty after scene 5's.
import { joinChapters } from '../puppet/chapters';
import { FIREFLIES } from './fireflies';
import { HOW_THEY_MET } from './how-they-met';
import { LAST_ORDINARY_DAY } from './last-ordinary-day';
import { THE_PARK } from './the-park';
import { THE_STORM } from './the-storm';

const joined = joinChapters('story', [THE_STORM, HOW_THEY_MET, THE_PARK, FIREFLIES, LAST_ORDINARY_DAY]);

export const STORY_STAGE = joined.scene;
/** Each chapter's stretch of STORY_STAGE, by chapter id: where it starts and ends, seconds. */
export const STORY_CHAPTER = joined.at;
