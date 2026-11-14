// Scene 6, "Goodbye" (docs/STORY.md): the chapter after the player's flat hand meets the friend's, palm to palm. It starts as
// exactly the friend's flat hand, face on, where it was; it turns clockwise, and as it turns the view draws back (the whole
// picture zooms out about the touch): the one hand becomes two, side on, pressed palm to palm, and they are the boy's and the
// girl's, the two kids seen from the waist up, each reaching out an arm to the touch. They stay so a while. Then their palms
// part and their arms come down; she fades away, and he, alone, bows his head and fades too, leaving the wall empty for
// sleep. Every time is in seconds from the chapter's start.
import type { Chapter } from '../puppet/chapters';
import type { Cue, Key, PuppetPart, Track, Wobble } from '../puppet/puppet-scene';
import { KID_SCALE, standingKid } from './story-kit';

/**
 * Where the palms meet, on the wall: the middle of the friend's flat hand in scene 6 (story-script.ts: its wrist at 0, 0.06,
 * its palm part 0.405 tall from 0.135 below the wrist), so the touch starts exactly on it.
 */
export const GOODBYE_AT: readonly [number, number] = [0, 0.1275];
const FRIEND_PALM_H = 0.405;

/** A kid's hand, side on (unscaled, like the kids' parts): its size, where its palm's face is across it, and its wrist. */
const HAND_W = 0.013;
const HAND_H = 0.032;
const PALM_FACE = 0.86;
const WRIST_Y = 0.15;
/** How far above the wrist the palm's middle is, as a share of the hand's height. */
const PALM_MID = 0.35;

/** A standing kid's front shoulder, and its arm's reach from shoulder to hand (unscaled; story-kit's standingKid). */
const SHOULDER: readonly [number, number] = [0.004, 0.176];
const ARM_REACH = 0.082 * 0.94;
/** Their arms reaching out to the touch: radians forward of straight up. */
const REACH = 1.0;
/** Their arms, parting and coming down. */
const PARTED = 2.3;

/** The kids' hands at the touch, relative to the touch (in the picture's own units, before it is zoomed). */
const handFromWrist = (k: number) => KID_SCALE * k;
const PALM_FACE_DX = handFromWrist((PALM_FACE - 0.5) * HAND_W);
const PALM_MID_DY = handFromWrist(PALM_MID * HAND_H);
/** Where a kid's hand (its wrist) is, relative to its feet, with its front arm at `arm` radians forward of up. */
const wristFromFeet = (arm: number): [number, number] => [
  KID_SCALE * (SHOULDER[0] + Math.sin(arm) * ARM_REACH),
  KID_SCALE * (SHOULDER[1] + Math.cos(arm) * ARM_REACH),
];
/** The boy's feet, so that at the touch his palm's face is at the touch and its middle level with it (the girl's mirror it). */
const BOY_FEET: readonly [number, number] = [
  -PALM_FACE_DX - wristFromFeet(REACH)[0],
  -PALM_MID_DY - wristFromFeet(REACH)[1],
];

/**
 * The picture's zoom: at first a kid's hand is drawn as big as the friend's flat hand (so the one becomes the two in place),
 * and at the end the kids fill the wall from the waist up (their waists at the wall's bottom edge).
 */
const ZOOM_FROM = FRIEND_PALM_H / (KID_SCALE * HAND_H) / 1.05;
const WAIST = KID_SCALE * 0.088;
const WALL_BOTTOM = -0.52;
const ZOOM_TO = (GOODBYE_AT[1] - WALL_BOTTOM) / -(BOY_FEET[1] + WAIST);

/** The turn (clockwise, face on to side on) and the zoom out, and the kids coming into view as it draws back. */
const TURN_S = 0.1;
const TURN_LEN_S = 1.6;
const TURN_FROM = 0.7;
const ZOOM_S = 0.2;
const ZOOM_LEN_S = 3.0;
const KIDS_S = 1.3;
const KIDS_LEN_S = 1.6;
/** They stay so, then their palms part... */
const PART_S = ZOOM_S + ZOOM_LEN_S + 3.2;
const PART_LEN_S = 1.6;
/** ...she fades away... */
const GIRL_GO_S = PART_S + PART_LEN_S + 0.8;
const GIRL_GO_LEN_S = 4.0;
/** ...and he bows his head, and fades too. */
const BOW_S = GIRL_GO_S + GIRL_GO_LEN_S + 0.6;
const BOY_GO_S = BOW_S + 1.6;
const BOY_GO_LEN_S = 3.0;
export const GOODBYE_LENGTH_S = BOY_GO_S + BOY_GO_LEN_S + 0.5;

/** How far into each other the two hands start (as one, face on), before they part to just touching. */
const START_OVERLAP = PALM_FACE_DX * 0.9;

/** A kid's hand side on, at its wrist: the boy's palm faces right, the girl's (mirrored) left. */
const hand = (who: 'boy' | 'girl'): PuppetPart => ({
  id: `goodbye-${who}-hand`,
  art: 'side-hand',
  parent: 'goodbye-pair',
  w: KID_SCALE * HAND_W,
  h: KID_SCALE * HAND_H,
  pivot: [0.5, WRIST_Y],
  x: (who === 'boy' ? -1 : 1) * (PALM_FACE_DX - START_OVERLAP),
  y: -PALM_MID_DY,
  opacity: 0,
  mirror: who === 'girl',
});

const parts: PuppetPart[] = [
  // The whole picture, about the touch: zoomed in at first, drawn back as it turns.
  { id: 'goodbye', art: '', w: 0.01, h: 0.01, x: GOODBYE_AT[0], y: GOODBYE_AT[1], scale: ZOOM_FROM, opacity: 0 },
  // The two kids, waist up (their legs are below the wall), each with the front arm reaching to the touch.
  ...standingKid('goodbye-boy', BOY_FEET[0], 1, { parent: 'goodbye', y: BOY_FEET[1], opacity: 0 }),
  ...standingKid('goodbye-girl', -BOY_FEET[0], -1, { parent: 'goodbye', y: BOY_FEET[1], opacity: 0, girl: true }),
  // The hands, which turn: first the one flat hand face on, as the friend's was, then the two side on.
  { id: 'goodbye-pair', art: '', parent: 'goodbye', w: 0.01, h: 0.01, angle: TURN_FROM },
  {
    id: 'goodbye-face',
    art: 'friend-palm',
    parent: 'goodbye-pair',
    w: ((FRIEND_PALM_H / ZOOM_FROM) * 2) / 3,
    h: FRIEND_PALM_H / ZOOM_FROM,
  },
  hand('boy'),
  hand('girl'),
];

/**
 * The hands' place as the arms swing from `from` to `to` (radians forward of up) over `t0`..`t1`, eased, sampled closely so
 * each hand stays at the end of its arm (the arm turns; the hand, linearly between samples, follows its arc).
 */
function swing(t0: number, t1: number, from: number, to: number): { arm: Key[]; x: Key[]; y: Key[] } {
  const arm: Key[] = [];
  const x: Key[] = [];
  const y: Key[] = [];
  const n = 12;
  const [fx, fy] = wristFromFeet(from);
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const e = k * k * (3 - 2 * k);
    const a = from + (to - from) * e;
    const [wx, wy] = wristFromFeet(a);
    const t = t0 + (t1 - t0) * k;
    arm.push([t, a]);
    x.push([t, PALM_FACE_DX - (wx - fx)]);
    y.push([t, -PALM_MID_DY + (wy - fy)]);
  }
  return { arm, x, y };
}
const parting = swing(PART_S, PART_S + PART_LEN_S, REACH, PARTED);

const tracks: Track[] = [
  // At once all there, exactly over the friend's hand (which fades under it); nothing of it shows before.
  {
    part: 'goodbye',
    prop: 'opacity',
    keys: [
      [0, 0],
      [0.001, 1, 'step'],
    ],
  },
  // Turning clockwise to upright, face on becoming side on...
  {
    part: 'goodbye-pair',
    prop: 'angle',
    keys: [
      [TURN_S, TURN_FROM],
      [TURN_S + TURN_LEN_S, 0, 'smooth'],
    ],
  },
  {
    part: 'goodbye-face',
    prop: 'opacity',
    keys: [
      [TURN_S, 1],
      [TURN_S + TURN_LEN_S * 0.55, 0, 'smooth'],
    ],
  },
  // ...as the picture draws back to show whose hands they are.
  {
    part: 'goodbye',
    prop: 'scale',
    keys: [
      [ZOOM_S, ZOOM_FROM],
      [ZOOM_S + ZOOM_LEN_S, ZOOM_TO, 'smooth'],
    ],
  },
  ...(['boy', 'girl'] as const).flatMap((who): Track[] => {
    const side = who === 'boy' ? -1 : 1;
    const fades: Key[] =
      who === 'girl'
        ? [
            [GIRL_GO_S, 1],
            [GIRL_GO_S + GIRL_GO_LEN_S, 0, 'smooth'],
          ]
        : [
            [BOY_GO_S, 1],
            [BOY_GO_S + BOY_GO_LEN_S, 0, 'smooth'],
          ];
    return [
      { part: `goodbye-${who}`, prop: 'opacity', keys: [[KIDS_S, 0], [KIDS_S + KIDS_LEN_S, 1, 'smooth'], ...fades] },
      // The front arm reaching to the touch, then coming down as the palms part.
      {
        part: `goodbye-${who}-arm-front`,
        prop: 'angle',
        keys: [[0, side * REACH], ...parting.arm.map(([t, a]): Key => [t, side * a])],
      },
      // The hand: as one with the other at first, parting to just touching as it turns; then at the end of the arm as it
      // comes down, fading as it goes (the arm's own end is enough of a hand at the kids' size).
      {
        part: `goodbye-${who}-hand`,
        prop: 'opacity',
        keys: [
          [TURN_S, 0],
          [TURN_S + TURN_LEN_S * 0.55, 1, 'smooth'],
          [PART_S + PART_LEN_S * 0.3, 1],
          [PART_S + PART_LEN_S, 0, 'smooth'],
        ],
      },
      {
        part: `goodbye-${who}-hand`,
        prop: 'x',
        keys: [
          [TURN_S, side * (PALM_FACE_DX - START_OVERLAP)],
          [TURN_S + TURN_LEN_S, side * PALM_FACE_DX, 'smooth'],
          ...parting.x.map(([t, x]): Key => [t, side * x]),
        ],
      },
      { part: `goodbye-${who}-hand`, prop: 'y', keys: parting.y },
    ];
  }),
  // He bows his head, alone.
  {
    part: 'goodbye-boy-head',
    prop: 'angle',
    keys: [
      [BOW_S, 0],
      [BOW_S + 1.4, -0.22, 'smooth'],
    ],
  },
];

const wobbles: Wobble[] = [
  // They breathe.
  { part: 'goodbye-boy-torso', prop: 'angle', amp: 0.008, period: 3.6 },
  { part: 'goodbye-girl-torso', prop: 'angle', amp: 0.008, period: 3.9, phase: 2 },
];

/** A note as the palms meet, one as they part, and one as she goes. */
const cues: Cue[] = [
  { t: 0.2, kind: 'note', note: 2 },
  { t: PART_S, kind: 'note', note: 1 },
  { t: GIRL_GO_S, kind: 'note', note: 0 },
];

export const GOODBYE: Chapter = { id: 'goodbye', length: GOODBYE_LENGTH_S, parts, tracks, wobbles, cues };
