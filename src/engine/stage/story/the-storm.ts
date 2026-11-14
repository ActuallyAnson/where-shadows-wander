// Scene 2's prologue, the night they met (docs/STORY.md): the story's first chapter (story-stage.ts), played as soon as the
// candle's light is on the wall, before the friend's hand shows anything. His new room slides in: a rainy window over two moving
// boxes, and the boy sitting alone on the floor. Lightning, and the thunder after it (the same storm as the room's: the cue
// flashes the real window), and he pulls his blanket over his head. A torch beam wobbles in from the left: the girl from down the
// street, looking for him. She kneels by the heap, sets her torch down shining, and throws the blanket up over two chairs: the
// fort. He looks up at her, and she raises her hand, which is where the friend's rabbit hand rises (story-script.ts). The fort,
// the torch and the kids are scene 2's (how-they-met.ts), and carry on from here. Every time is in seconds from its start.
import { OFF_WALL_X, slideKeys, type Chapter } from '../puppet/chapters';
import { swingKeys, type Cue, type Key, type PuppetPart, type Track, type Wobble } from '../puppet/puppet-scene';
import { BOY_X, FORT_BASE_Y, FORT_DEPTH, FORT_H, FORT_W, FRIEND_X, WALL_HALF_H } from './how-they-met';
import { ARM_DOWN, ARM_UP, FLOOR_Y, WALK, fadeKeys, sittingKid, standingKid, stepTracks } from './story-kit';

/** His room slides in from the right with him in it (the room, further back, a little behind him). */
const SLIDE_S = 2.6;
/** Where the room goes when the story moves on (the-park.ts): far enough left that its boxes are off the wall too. */
export const ROOM_OFF_X = OFF_WALL_X + 0.2;
/** How far back the room stands: as far as the fort, which is put up in it. */
export const ROOM_DEPTH = FORT_DEPTH;
/** The lightning (a flash in the window, and the room's real window), and the thunder after it. */
const FLASH_S = 3.4;
export const STORM_THUNDER_AFTER_S = 1.5;
const THUNDER_S = FLASH_S + STORM_THUNDER_AFTER_S;
/** He pulls the blanket over his head, and it trembles until she comes. */
const HIDE_S = THUNDER_S + 0.5;
const HIDE_LEN_S = 0.7;
/** Her torch's beam comes in at the left edge ahead of her, and she walks up to the heap. */
const WALK_S = 7.4;
const WALK_END_S = 11.4;
const WALK_FROM_X = -1.25;
const WALK_TO_X = FRIEND_X - 0.04;
/** She kneels (the standing girl becomes the sitting one) and sets her torch down; it clicks on. */
const KNEEL_S = 11.8;
const KNEEL_LEN_S = 0.7;
const CLICK_S = KNEEL_S + KNEEL_LEN_S + 0.3;
/** She throws the blanket up off him: it rises and goes as the fort comes down over them both. */
const LIFT_S = 13.6;
const LIFT_LEN_S = 1.0;
const FORT_DROP_LEN_S = 1.5;
/** How high the fort hangs before it comes down: just above the wall's top, where the wall's edge cuts it off. */
const FORT_DROP = WALL_HALF_H - FORT_BASE_Y + 0.03;
/** He looks up at her... */
const LOOK_S = LIFT_S + 0.9;
/** ...and she raises her hand. The chapter ends with it raised: the friend's rabbit hand rises there. */
const RAISE_S = 16.6;
export const THE_STORM_LENGTH_S = 17.6;

/** The boy's head: bowed (he faces left, so forward is counter-clockwise), and further down when the thunder comes. */
const HEAD_LOW = 0.22;
const HEAD_COWER = 0.4;
/** Her front arm holding the torch out and a little down, at the heap (clockwise of straight up, as she faces right). */
const TORCH_ARM = -1.78;

const parts: PuppetPart[] = [
  // His room, standing back: the window with the rain on its glass, and two moving boxes stacked under it. He is new here.
  { id: 'room', art: '', w: 1, h: 1, x: OFF_WALL_X, depth: ROOM_DEPTH },
  {
    id: 'window-light',
    art: 'pane',
    look: 'glow',
    tint: [0.62, 0.72, 1],
    parent: 'room',
    w: 0.26,
    h: 0.24,
    x: 0.5,
    y: 0.25,
    opacity: 0.22,
  },
  { id: 'window', art: 'window', parent: 'room', w: 0.4, h: 0.3, x: 0.5, y: 0.24 },
  { id: 'box-low', art: 'box', parent: 'room', w: 0.2, h: 0.15, pivot: [0.5, 0], x: 0.55, y: FLOOR_Y - 0.01 },
  {
    id: 'box-high',
    art: 'box',
    parent: 'room',
    w: 0.15,
    h: 0.12,
    pivot: [0.5, 0],
    x: 0.53,
    y: FLOOR_Y + 0.115,
    angle: 0.05,
  },
  // The fort, hung above the wall until she puts it up. It fills the wall, so the kids are inside it with the player.
  {
    id: 'fort',
    art: 'fort',
    w: FORT_W,
    h: FORT_H,
    pivot: [0.5, 0],
    y: FORT_BASE_Y + FORT_DROP,
    depth: FORT_DEPTH,
  },
  // In front: the torch (off until she sets it down) and the two kids, sliding in with the room.
  { id: 'scenery', art: '', w: 1, h: 1, x: OFF_WALL_X },
  { id: 'torch-on', art: '', parent: 'scenery', w: 1, h: 1, opacity: 0 },
  {
    id: 'torch-light',
    art: 'orb',
    look: 'glow',
    tint: [1, 0.8, 0.5],
    parent: 'torch-on',
    w: 0.46,
    h: 0.46,
    y: FLOOR_Y + 0.05,
    opacity: 0.55,
  },
  {
    id: 'torch',
    art: 'torch',
    parent: 'torch-on',
    w: 0.06,
    h: 0.025,
    pivot: [0.5, 0],
    y: FLOOR_Y,
    angle: 0.15,
  },
  ...sittingKid('friend', FRIEND_X, 1, { parent: 'scenery', y: FLOOR_Y, armUp: true, girl: true, opacity: 0 }),
  ...sittingKid('boy', BOY_X, -1, { parent: 'scenery', y: FLOOR_Y }),
  // His blanket, pulled over his head: a heap over him, a little bigger than he is.
  {
    id: 'boy-blanket',
    art: 'blanket',
    parent: 'boy',
    w: 0.2,
    h: 0.235,
    pivot: [0.5, 0],
    x: -0.006,
    opacity: 0,
    mirror: true,
  },
  // The girl from down the street, walking in with her torch held out, its beam ahead of her.
  ...standingKid('arrive-friend', WALK_FROM_X, 1, { girl: true }),
  {
    id: 'arrive-torch',
    art: 'torch',
    parent: 'arrive-friend-arm-front',
    w: 0.042,
    h: 0.018,
    pivot: [0.2, 0.5],
    y: 0.068,
    angle: Math.PI / 2,
  },
  {
    id: 'arrive-beam',
    art: 'beam',
    look: 'glow',
    tint: [1, 0.85, 0.58],
    parent: 'arrive-torch',
    w: 0.34,
    h: 0.15,
    pivot: [0, 0.5],
    x: 0.034,
    opacity: 0.5,
  },
];

/** A lightning flash: a quick flicker, a second one, then a fade (as storm.ts flashes the room's window). */
function flashKeys(t0: number, rest: number, peak: number): Key[] {
  return [
    [t0, rest],
    [t0 + 0.05, peak, 'out'],
    [t0 + 0.13, rest + (peak - rest) * 0.25],
    [t0 + 0.2, rest + (peak - rest) * 0.7],
    [t0 + 0.75, rest, 'in'],
  ];
}

const tracks: Track[] = [
  { part: 'room', prop: 'x', keys: slideKeys(0, SLIDE_S, OFF_WALL_X, 0, ROOM_DEPTH) },
  { part: 'scenery', prop: 'x', keys: slideKeys(0, SLIDE_S, OFF_WALL_X, 0) },
  { part: 'window-light', prop: 'opacity', keys: flashKeys(FLASH_S, 0.22, 0.95) },
  // He sits with his head down; the thunder makes him flinch and duck, and he pulls the blanket up over himself.
  {
    part: 'boy-head',
    prop: 'angle',
    keys: [
      [0, HEAD_LOW],
      [THUNDER_S, HEAD_LOW],
      [THUNDER_S + 0.2, HEAD_COWER, 'out'],
      // Once the blanket is off, he lifts his head and looks at her.
      [LOOK_S, HEAD_COWER],
      [LOOK_S + 1.0, 0, 'smooth'],
    ],
  },
  {
    part: 'boy-body',
    prop: 'scale',
    keys: [
      [THUNDER_S, 1],
      [THUNDER_S + 0.15, 0.94, 'out'],
      [THUNDER_S + 0.6, 0.97, 'smooth'],
      [LOOK_S, 0.97],
      [LOOK_S + 1.0, 1, 'smooth'],
    ],
  },
  {
    part: 'boy-arm',
    prop: 'angle',
    keys: [
      // His arm comes up to pull the blanket over (he faces left, so up is counter-clockwise of down).
      [HIDE_S - 0.3, ARM_DOWN],
      [HIDE_S + 0.2, ARM_UP + 0.4, 'smooth'],
      [HIDE_S + HIDE_LEN_S + 0.2, ARM_DOWN, 'smooth'],
    ],
  },
  {
    part: 'boy-blanket',
    prop: 'opacity',
    keys: [...fadeKeys(HIDE_S, HIDE_LEN_S, 0, 1), ...fadeKeys(LIFT_S + 0.3, LIFT_LEN_S - 0.3, 1, 0)],
  },
  {
    part: 'boy-blanket',
    prop: 'y',
    keys: [
      [HIDE_S, -0.03],
      [HIDE_S + HIDE_LEN_S, 0, 'out'],
      // Thrown up and away: it is the fort's blanket now.
      [LIFT_S, 0],
      [LIFT_S + LIFT_LEN_S, 0.3, 'out'],
    ],
  },
  {
    part: 'boy-blanket',
    prop: 'angle',
    keys: [
      // It trembles while he hides, and goes still as her light finds it.
      ...swingKeys(HIDE_S + HIDE_LEN_S, WALK_END_S - 1.2, 0.22, 0.018),
      [LIFT_S, 0],
      [LIFT_S + LIFT_LEN_S, 0.25, 'smooth'],
    ],
  },
  // The girl walks in from the left, sweeping her torch a little, looking: its beam comes in at the wall's edge before her.
  {
    part: 'arrive-friend',
    prop: 'opacity',
    keys: [[WALK_S - 0.01, 0], [WALK_S, 1, 'step'], ...fadeKeys(KNEEL_S, KNEEL_LEN_S, 1, 0)],
  },
  { part: 'arrive-beam', prop: 'opacity', keys: fadeKeys(WALK_S, 0.9, 0, 0.5) },
  {
    part: 'arrive-friend',
    prop: 'x',
    keys: [
      [WALK_S, WALK_FROM_X],
      [WALK_END_S, WALK_TO_X, 'out'],
    ],
  },
  ...stepTracks('arrive-friend', 1, WALK_S, WALK_END_S, WALK, { girl: true, armsBusy: 'front' }),
  {
    part: 'arrive-friend-arm-front',
    prop: 'angle',
    keys: [
      [WALK_S, TORCH_ARM + 0.12],
      [WALK_S + 1.3, TORCH_ARM - 0.1, 'smooth'],
      [WALK_S + 2.6, TORCH_ARM + 0.08, 'smooth'],
      [WALK_END_S, TORCH_ARM, 'smooth'],
    ],
  },
  // She kneels by the heap: the standing girl goes as the sitting one comes, and her torch is on the floor between them.
  { part: 'friend', prop: 'opacity', keys: fadeKeys(KNEEL_S, KNEEL_LEN_S, 0, 1) },
  // Click.
  {
    part: 'torch-on',
    prop: 'opacity',
    keys: [
      [CLICK_S, 0],
      [CLICK_S + 0.12, 1, 'out'],
    ],
  },
  // Her hand is down while she kneels and lifts the blanket, and comes up at the end: watch.
  {
    part: 'friend-arm',
    prop: 'angle',
    keys: [
      [KNEEL_S, -ARM_DOWN],
      [LIFT_S - 0.4, -ARM_DOWN],
      [LIFT_S, -ARM_UP - 0.5, 'smooth'],
      [LIFT_S + LIFT_LEN_S, -ARM_DOWN, 'smooth'],
      [RAISE_S, -ARM_DOWN],
      [RAISE_S + 0.8, -ARM_UP, 'smooth'],
    ],
  },
  {
    part: 'friend-head',
    prop: 'angle',
    keys: [
      // She looks down at the heap, then at him once he looks up.
      [KNEEL_S, 0],
      [KNEEL_S + 0.6, -0.15, 'smooth'],
      [LOOK_S + 0.3, -0.15],
      [LOOK_S + 1.0, 0, 'smooth'],
    ],
  },
  // The fort comes down over them both, settling with a little bounce.
  {
    part: 'fort',
    prop: 'y',
    keys: [
      [LIFT_S + 0.1, FORT_BASE_Y + FORT_DROP],
      [LIFT_S + 0.1 + FORT_DROP_LEN_S, FORT_BASE_Y, 'out'],
    ],
  },
];

const wobbles: Wobble[] = [
  // The torch's light breathes; the kids breathe; the rain shimmers on the glass.
  { part: 'torch-light', prop: 'scale', amp: 0.025, period: 2.3 },
  { part: 'torch-light', prop: 'opacity', amp: 0.04, period: 1.7, phase: 1 },
  { part: 'friend-body', prop: 'angle', amp: 0.012, period: 3.6 },
  { part: 'boy-body', prop: 'angle', amp: 0.012, period: 3.9, phase: 2 },
  { part: 'window-light', prop: 'opacity', amp: 0.03, period: 2.9 },
  { part: 'arrive-beam', prop: 'opacity', amp: 0.04, period: 0.9 },
];

/** The storm (the room's window flashes too, and its thunder follows), and the lullaby's first note as her torch clicks on. */
const cues: Cue[] = [
  { t: FLASH_S, kind: 'storm', thunderAfter: STORM_THUNDER_AFTER_S },
  { t: CLICK_S, kind: 'note', note: 0 },
];

export const THE_STORM: Chapter = { id: 'the-storm', length: THE_STORM_LENGTH_S, parts, tracks, wobbles, cues };
