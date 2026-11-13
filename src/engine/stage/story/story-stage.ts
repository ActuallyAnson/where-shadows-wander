// The story's puppet show (docs/STORY.md, "One story, not seven"): every memory, a chapter each, joined end to end into one
// puppet scene, so the kids, the rabbit and the places carry over from one memory into the next and the wall never goes blank.
// The story script plays it a chapter at a time (STORY_CHAPTER) and holds each chapter's last picture while the friend's hand
// shows the next shape. Chapters are added here as they are built.
import { joinChapters } from '../puppet/chapters';
import { HOW_THEY_MET } from './how-they-met';
import { THE_PARK } from './the-park';

const joined = joinChapters('story', [HOW_THEY_MET, THE_PARK]);

export const STORY_STAGE = joined.scene;
/** Each chapter's stretch of STORY_STAGE, by chapter id: where it starts and ends, seconds. */
export const STORY_CHAPTER = joined.at;
