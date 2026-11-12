// Placeholder sounds made in code, so the audio works before the team's CC0 files exist. Each is rendered once
// into samples (nothing here runs per frame), is the same every time (a seeded random source), and has no
// third-party material in it (CREDITS.md). Replace one by putting a file named after it (rustle.ogg ...) in
// src/assets/audio/sfx and giving the engine its buffer. Plain TypeScript.
import { Sound, SOUND_DEFS, type SoundId } from './sounds';

const TAU = Math.PI * 2;
/** The clock and wind loops' lengths, seconds. */
export const CLOCK_S = 4;
export const WIND_S = 6;
/** The rain loop's length, seconds. */
export const RAIN_S = 6;
/** The thunder's length, seconds: a long, slow roll. */
export const THUNDER_S = 6;
/** The candle loop's length, seconds: long enough that the repeat is not noticed. */
export const CRACKLE_S = 6;
/** How loud the candle is rendered (the others peak at 0.8): it is a quiet bed, not an event. */
const CRACKLE_PEAK = 0.35;
/** The room tone's length and level: a whole number of cycles of each low note fits in it, so it can loop. */
export const HUM_S = 6;
const HUM_PEAK = 0.3;
/** The music is rendered at this rate whatever the context's (it is soft and low, with nothing above 10 kHz), to keep it small and quick to make. */
export const MUSIC_RATE = 22050;
/** Its length: four chords of six seconds. */
export const MUSIC_S = 24;
const MUSIC_PEAK = 0.5;

/**
 * The lullaby's five notes, in Hz: C5 D5 E5 G5 A5, a rising run of the pentatonic scale that A minor, F, C and G (the music's
 * chords) all fit, so any of them sounds right over the music, and a few of them alone sound like the start of a tune.
 */
export const LULLABY_HZ: readonly number[] = [523.25, 587.33, 659.25, 783.99, 880];

/** How loud each sound is rendered (it peaks here). A loop is a quiet bed, not an event, so it is lower. */
const PEAK: Readonly<Record<SoundId, number>> = {
  [Sound.Rustle]: 0.8,
  [Sound.Thump]: 0.8,
  [Sound.Chime]: 0.8,
  [Sound.Crackle]: CRACKLE_PEAK,
  [Sound.Tick]: 0.8,
  [Sound.Press]: 0.8,
  [Sound.Ignite]: 0.8,
  [Sound.Hum]: HUM_PEAK,
  [Sound.Release]: 0.8,
  [Sound.Lost]: 0.8,
  [Sound.Lift]: 0.8,
  [Sound.Set]: 0.8,
  [Sound.Music]: MUSIC_PEAK,
  [Sound.Twinkle]: 0.8,
  [Sound.Hop]: 0.8,
  [Sound.Note0]: 0.8,
  [Sound.Note1]: 0.8,
  [Sound.Note2]: 0.8,
  [Sound.Note3]: 0.8,
  [Sound.Note4]: 0.8,
  [Sound.Clock]: 0.5,
  [Sound.Wind]: 0.35,
  [Sound.Creak]: 0.7,
  [Sound.Snowtick]: 0.6,
  [Sound.Step0]: 0.6,
  [Sound.Step1]: 0.6,
  [Sound.Rain]: 0.35,
  [Sound.Thunder]: 0.8,
};

/** The samples for `id` at `sampleRate`, mono, peaking at PEAK[id]. A one-shot ends at zero; a loop joins its own start. */
export function renderPlaceholder(id: SoundId, sampleRate: number): Float32Array<ArrayBuffer> {
  const out = generate(id, sampleRate);
  normalise(out, PEAK[id]);
  if (!SOUND_DEFS[id].loop) release(out, Math.floor(sampleRate * 0.008)); // end at zero, so there is no click
  return out;
}

function generate(id: SoundId, sr: number): Float32Array<ArrayBuffer> {
  switch (id) {
    case Sound.Note0:
    case Sound.Note1:
    case Sound.Note2:
    case Sound.Note3:
    case Sound.Note4:
      return musicBoxNote(sr, LULLABY_HZ[id - Sound.Note0]);
    case Sound.Clock:
      return clockTick(sr);
    case Sound.Wind:
      return wind(sr);
    case Sound.Creak:
      return creak(sr);
    case Sound.Snowtick:
      return snowTick(sr);
    case Sound.Step0:
      return footstep(sr, 0);
    case Sound.Step1:
      return footstep(sr, 1);
    case Sound.Rain:
      return rain(sr);
    case Sound.Thunder:
      return thunder(sr);
    case Sound.Twinkle:
      return twinkle(sr);
    case Sound.Hop:
      return hop(sr);
    case Sound.Rustle:
      return rustle(sr);
    case Sound.Thump:
      return thump(sr);
    case Sound.Chime:
      return chime(sr);
    case Sound.Crackle:
      return crackle(sr);
    case Sound.Tick:
      return tick(sr);
    case Sound.Press:
      return press(sr);
    case Sound.Ignite:
      return ignite(sr);
    case Sound.Hum:
      return hum(sr);
    case Sound.Release:
      return letGo(sr);
    case Sound.Lost:
      return lost(sr);
    case Sound.Lift:
      return lift(sr);
    case Sound.Set:
      return set(sr);
    case Sound.Music:
      return music(sr);
    default: {
      const unreachable: never = id;
      throw new Error(`no placeholder for sound ${String(unreachable)}`);
    }
  }
}

/** Paper: a short burst of noise with a few quick crinkles, high-passed so it is dry and light. */
function rustle(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.35);
  const out = new Float32Array(n);
  const rnd = seeded(11);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = rnd() * 2 - 1;
    const hp = noise - prev * 0.85; // a one-pole high-pass
    prev = noise;
    const crinkle = 0.55 + 0.45 * Math.sin(TAU * 38 * t + 3 * Math.sin(TAU * 7 * t));
    out[i] = hp * crinkle * Math.min(1, t / 0.01) * Math.exp(-t * 9);
  }
  return out;
}

/** A soft low knock: a sine falling from 110 to 45 Hz, with a short dull click at the start. */
function thump(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.3);
  const out = new Float32Array(n);
  const rnd = seeded(23);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += (TAU * (45 + 65 * Math.exp(-t * 18))) / sr;
    out[i] = Math.sin(phase) * Math.exp(-t * 11) + (rnd() * 2 - 1) * 0.15 * Math.exp(-t * 90);
  }
  return out;
}

/** Fairy dust: four soft high notes, each a little lower than the last, each a pure tone that dies away quickly. */
function twinkle(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.9);
  const out = new Float32Array(n);
  const notes = [2093, 1760, 2349, 1568]; // C7, A6, D7, G6
  for (let k = 0; k < notes.length; k++) {
    const start = Math.floor(sr * 0.11 * k);
    for (let i = start; i < n; i++) {
      const t = (i - start) / sr;
      out[i] += Math.sin(TAU * notes[k] * t) * Math.exp(-t * 11) * Math.min(1, t / 0.003) * (1 - k * 0.15);
    }
  }
  return out;
}

/**
 * One music-box note: a bright pluck with a touch of the inharmonic partials a small tuned comb has, ringing out for just under
 * two seconds. The same shape for every note, so the five make one voice.
 */
function musicBoxNote(sr: number, hz: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 1.9);
  const out = new Float32Array(n);
  const partials: readonly (readonly [number, number, number])[] = [
    [1, 1, 2.6],
    [2.76, 0.38, 4.5],
    [5.4, 0.16, 8],
    [8.93, 0.06, 14],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (let k = 0; k < partials.length; k++)
      s += Math.sin(TAU * hz * partials[k][0] * t) * partials[k][1] * Math.exp(-t * partials[k][2]);
    out[i] = s * Math.min(1, t / 0.0015);
  }
  return out;
}

/** A wooden clock's slow tick-tock: four soft knocks a second apart, alternating a little high and a little low. Silent at both ends. */
function clockTick(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * CLOCK_S);
  const out = new Float32Array(n);
  const rnd = seeded(83);
  for (let k = 0; k < CLOCK_S; k++) {
    const start = Math.floor(sr * (0.5 + k));
    const hz = k % 2 === 0 ? 230 : 175;
    const gain = k % 2 === 0 ? 1 : 0.7;
    let lp = 0;
    for (let i = start; i < n && i < start + sr * 0.25; i++) {
      const t = (i - start) / sr;
      lp += (rnd() * 2 - 1 - lp) * 0.3;
      out[i] +=
        gain * (Math.sin(TAU * hz * t) * Math.exp(-t * 38) + lp * 0.35 * Math.exp(-t * 90)) * Math.min(1, t / 0.001);
    }
  }
  return out;
}

/** Wind round the house: low, soft noise that swells and settles, with a faint whistle high in it. A loop that joins its own start. */
function wind(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * WIND_S);
  // A little more than one loop is made; the extra is blended over the start, so the end runs on into it with no dip.
  const edge = Math.floor(sr * 0.25);
  const made = new Float32Array(n + edge);
  const rnd = seeded(89);
  let a = 0;
  let b = 0;
  for (let i = 0; i < n + edge; i++) {
    const t = i / sr;
    a += (rnd() * 2 - 1 - a) * 0.03;
    b += (a - b) * 0.05;
    const gust = 0.55 + 0.45 * Math.sin((TAU * t) / WIND_S + 1) * (0.7 + 0.3 * Math.sin((TAU * 2 * t) / WIND_S));
    const whistle = Math.sin(TAU * (610 + 35 * Math.sin((TAU * t) / WIND_S)) * t) * 0.025;
    made[i] = (b * 4 + whistle) * gust;
  }
  const out = made.slice(0, n);
  for (let i = 0; i < edge; i++) {
    const f = i / edge;
    out[i] = made[i] * f + made[n + i] * (1 - f);
  }
  return out;
}

/** A one-pole low-pass's coefficient for a cutoff of `hz` at `sr`: the same tone at any sample rate. */
function lowPass(hz: number, sr: number): number {
  return 1 - Math.exp((-TAU * hz) / sr);
}

/**
 * Rain heard from inside: a soft, steady hiss (noise with its lows and its highest highs taken off, as the glass and walls do),
 * a little low roar of it on the roof, and the patter of single drops on the window over it, each a tiny damped tick. It
 * breathes a little, so the loop does not sound like a held note. A loop that joins its own start.
 */
function rain(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * RAIN_S);
  // Made a little longer; the extra is blended over the start, so the end runs on into it with no seam.
  const edge = Math.floor(sr * 0.3);
  const total = n + edge;
  const made = new Float32Array(total);
  const rnd = seeded(103);
  const kHiss = lowPass(3200, sr);
  const kBody = lowPass(500, sr);
  const kRoof = lowPass(140, sr);
  let hiss = 0;
  let body = 0;
  let roof = 0;
  for (let i = 0; i < total; i++) {
    const t = i / sr;
    const x = rnd() * 2 - 1;
    hiss += (x - hiss) * kHiss;
    body += (hiss - body) * kBody;
    roof += (x - roof) * kRoof;
    const swell = 0.85 + 0.15 * Math.sin((TAU * t) / RAIN_S) * Math.sin((TAU * 2 * t) / RAIN_S + 1);
    made[i] = ((hiss - body) * 0.9 + roof * 2.2) * swell;
  }
  // The patter: drops at random times, each a short bright tick, some near and clear, most soft.
  const drops = Math.floor(RAIN_S * 55);
  const len = Math.floor(sr * 0.012);
  const kDrop = lowPass(2400, sr);
  for (let d = 0; d < drops; d++) {
    const start = Math.floor(rnd() * (total - len));
    const level = 0.08 + 0.35 * rnd() * rnd();
    const hz = 1400 + 1800 * rnd();
    let lp = 0;
    for (let j = 0; j < len; j++) {
      const t = j / sr;
      lp += (rnd() * 2 - 1 - lp) * kDrop;
      made[start + j] +=
        (Math.sin(TAU * hz * t) * 0.6 + lp * 0.8) * Math.exp(-t * 420) * Math.min(1, t / 0.0004) * level;
    }
  }
  const out = made.slice(0, n);
  for (let i = 0; i < edge; i++) {
    const f = i / edge;
    out[i] = made[i] * f + made[n + i] * (1 - f);
  }
  return out;
}

/**
 * Thunder a long way off, heard through the walls: no crack, only a deep, slow roll. Low-passed noise that swells in over half
 * a second, rumbles in four uneven waves, each softer, and dies away. Silent at both ends.
 */
function thunder(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * THUNDER_S);
  const out = new Float32Array(n);
  const rnd = seeded(107);
  const k1 = lowPass(180, sr);
  const k2 = lowPass(110, sr);
  const kWobble = lowPass(9, sr);
  let a = 0;
  let b = 0;
  let wobble = 0;
  // The rolls: when each peaks (s), how wide it is (s), and how loud.
  const rolls: readonly (readonly [number, number, number])[] = [
    [0.7, 0.45, 1],
    [1.6, 0.6, 0.8],
    [2.7, 0.8, 0.55],
    [3.9, 1.0, 0.3],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const x = rnd() * 2 - 1;
    a += (x - a) * k1;
    b += (a - b) * k2;
    wobble += (rnd() * 2 - 1 - wobble) * kWobble; // a slow, uneven flutter, as a roll breaks up
    let env = 0;
    for (let k = 0; k < rolls.length; k++) {
      const d = (t - rolls[k][0]) / rolls[k][1];
      env += rolls[k][2] * Math.exp(-d * d);
    }
    const tail = Math.min(1, t / 0.5) * Math.min(1, (THUNDER_S - t) / 1.2);
    out[i] = b * env * tail * (0.75 + 2.5 * Math.abs(wobble));
  }
  return out;
}

/** A timber creaking: a low groan that slides down and up, broken into stuttering pulses, over a second. */
function creak(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 1.1);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const hz = 75 + 35 * Math.sin(Math.PI * Math.min(1, t / 1.0)) - 12 * t;
    phase += (TAU * hz) / sr;
    const body = Math.sin(phase) * 0.6 + Math.sin(2 * phase) * 0.3 + Math.sin(3 * phase) * 0.15;
    const stutter = Math.pow(Math.abs(Math.sin(TAU * 13 * t)), 0.5);
    const env = Math.min(1, t / 0.08) * Math.exp(-Math.max(0, t - 0.3) * 3.2);
    out[i] = body * stutter * env;
  }
  return out;
}

/** A few flakes ticking on glass: one very small, bright tick. */
function snowTick(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.06);
  const out = new Float32Array(n);
  const rnd = seeded(97);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const x = rnd() * 2 - 1;
    lp += (x - lp) * 0.35;
    out[i] = (x - lp) * Math.exp(-t * 110) * Math.min(1, t / 0.0004);
  }
  return out;
}

/** A small soft footstep (two variants, a little different): a low, muffled pat of a boot on paper. */
function footstep(sr: number, variant: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.1);
  const out = new Float32Array(n);
  const rnd = seeded(101 + variant);
  let lp = 0;
  const hz = variant === 0 ? 150 : 125;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    lp += (rnd() * 2 - 1 - lp) * 0.12;
    out[i] =
      (Math.sin(TAU * (hz - 55 * t) * t) * Math.exp(-t * 45) + lp * 0.5 * Math.exp(-t * 60)) * Math.min(1, t / 0.0015);
  }
  return out;
}

/** A rabbit's soft landing: a low, short, muffled thud with a little air in it. */
function hop(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.18);
  const out = new Float32Array(n);
  const noise = seeded(41);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    lp += (noise() * 2 - 1 - lp) * 0.08; // a muffled breath
    out[i] =
      (Math.sin(TAU * (95 - 40 * t) * t) * Math.exp(-t * 28) + lp * 0.5 * Math.exp(-t * 40)) * Math.min(1, t / 0.002);
  }
  return out;
}

/** A small bell: three partials a fifth and an octave apart, ringing out over a second and a half. */
function chime(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 1.5);
  const out = new Float32Array(n);
  const partials: readonly (readonly [number, number, number])[] = [
    [880, 1, 3],
    [1320, 0.5, 4.5],
    [1760, 0.3, 6],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (let k = 0; k < partials.length; k++)
      s += Math.sin(TAU * partials[k][0] * t) * partials[k][1] * Math.exp(-t * partials[k][2]);
    out[i] = s * Math.min(1, t / 0.004);
  }
  return out;
}

/**
 * A six-second loop of a candle: a quiet, soft hiss that slowly swells and settles, with a few tiny ticks. Nothing
 * sharp, so it sits under the room like a small flame and does not draw the ear. Silent at both ends.
 */
function crackle(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * CRACKLE_S);
  const out = new Float32Array(n);
  const rnd = seeded(37);
  let a = 0;
  let b = 0;
  let swell = 0;
  for (let i = 0; i < n; i++) {
    // Noise through two low-pass stages: a soft, airy hiss with no bright edge.
    a += (rnd() * 2 - 1 - a) * 0.08;
    b += (a - b) * 0.15;
    // A slow wander of the level (a flame breathing), a fraction of a second to a few seconds long.
    swell += (rnd() * 2 - 1 - swell) * (2 / sr);
    out[i] = b * (0.6 + 0.4 * Math.tanh(swell * 12));
  }
  const ticks = 9;
  for (let k = 0; k < ticks; k++) {
    const at = Math.floor((0.05 + 0.9 * rnd()) * n);
    const size = 0.08 + 0.1 * rnd();
    const len = Math.floor(sr * (0.006 + 0.008 * rnd()));
    let lp = 0;
    for (let j = 0; j < len && at + j < n; j++) {
      lp += (rnd() * 2 - 1 - lp) * 0.15; // soft: no hard noise burst
      const attack = Math.min(1, j / (sr * 0.001)); // a 1 ms rise, so it ticks and does not click
      out[at + j] += lp * size * attack * Math.exp((-5 * j) / len);
    }
  }
  // Fade the first and last 50 ms so the loop joins without a click or a jolt.
  const edge = Math.floor(sr * 0.05);
  for (let i = 0; i < edge; i++) {
    const f = i / edge;
    out[i] *= f;
    out[n - 1 - i] *= f;
  }
  return out;
}

/** A small dry tick, like a fingernail on wood: a short falling sine and a speck of noise. */
function tick(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.09);
  const out = new Float32Array(n);
  const rnd = seeded(41);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += (TAU * (1100 + 800 * Math.exp(-t * 80))) / sr;
    out[i] = Math.sin(phase) * Math.exp(-t * 55) + (rnd() * 2 - 1) * 0.12 * Math.exp(-t * 400);
  }
  return out;
}

/** A warm knock with a small bell in it: a wooden press that is not a click. */
function press(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.4);
  const out = new Float32Array(n);
  const rnd = seeded(43);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += (TAU * (60 + 95 * Math.exp(-t * 28))) / sr;
    lp += (rnd() * 2 - 1 - lp) * 0.25;
    const knock = Math.sin(phase) * Math.exp(-t * 14);
    const bell = t > 0.015 ? Math.sin(TAU * 660 * t) * 0.28 * Math.exp(-(t - 0.015) * 9) : 0;
    out[i] = knock + bell + lp * 0.2 * Math.exp(-t * 120);
  }
  return out;
}

/**
 * A match and a flame: a dry scratch, a soft whoosh that opens up as the flame catches, a low warm swell under it,
 * and a faint shimmer that rings out. About a second and a half.
 */
function ignite(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 1.6);
  const out = new Float32Array(n);
  const rnd = seeded(47);
  let prev = 0;
  let a = 0;
  let b = 0;
  let swellPhase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const noise = rnd() * 2 - 1;
    // The scratch: high-passed noise with a rough, uneven grain, over in a tenth of a second.
    const hp = noise - prev * 0.7;
    prev = noise;
    const scratch = t < 0.1 ? hp * (0.6 + 0.4 * Math.sin(TAU * 90 * t)) * Math.exp(-t * 25) * 0.7 : 0;
    // The whoosh: noise through two low-pass stages whose cutoff opens as the flame catches.
    const open = Math.min(1, Math.max(0, (t - 0.1) / 0.3));
    const k = 0.03 + 0.25 * open;
    a += (noise - a) * k;
    b += (a - b) * k;
    const whoosh = t >= 0.1 ? b * Math.min(1, (t - 0.1) / 0.12) * Math.exp(-(t - 0.25) * 2.6) * 2.2 : 0;
    // The swell: a low note that glides up a fourth while it rises and fades.
    swellPhase += (TAU * (110 + 55 * Math.min(1, t / 0.7))) / sr;
    const swell =
      t >= 0.12
        ? Math.sin(swellPhase) *
          Math.sin(Math.min(1, (t - 0.12) / 0.5) * Math.PI * 0.5) *
          Math.exp(-(t - 0.4) * 2.2) *
          0.35
        : 0;
    // The shimmer: two soft high partials that ring out after the flame has caught.
    const shimmer =
      t >= 0.35
        ? (Math.sin(TAU * 880 * t) * 0.14 * Math.exp(-(t - 0.35) * 3) +
            Math.sin(TAU * 1320 * t) * 0.08 * Math.exp(-(t - 0.35) * 4.5)) *
          Math.min(1, (t - 0.35) / 0.05)
        : 0;
    out[i] = scratch + whoosh + swell + shimmer;
  }
  return out;
}

/**
 * The room at night, as a six-second loop: two very low notes (each a whole number of cycles long, so they join),
 * a slow breath, and a soft low rumble of air. The air is noise, so the end is crossfaded into the start.
 */
function hum(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * HUM_S);
  const fade = Math.floor(sr * 0.6);
  const raw = new Float32Array(n + fade);
  const rnd = seeded(53);
  let a = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < raw.length; i++) {
    const t = i / sr;
    a += (rnd() * 2 - 1 - a) * 0.012;
    b += (a - b) * 0.05;
    c += (b - c) * 0.2;
    const breath = 0.85 + 0.15 * Math.sin((TAU * t) / HUM_S);
    const notes =
      Math.sin(TAU * 55 * t) * 0.5 + Math.sin(TAU * 82.5 * t + 0.7) * 0.24 + Math.sin(TAU * 110 * t + 1.9) * 0.1;
    raw[i] = (notes * 0.5 + c * 28) * breath;
  }
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw[i];
  // Blend the tail (which carries on past the loop point) under the head, with equal-power curves.
  for (let i = 0; i < fade; i++) {
    const w = (i / fade) * Math.PI * 0.5;
    out[i] = raw[i] * Math.sin(w) + raw[n + i] * Math.cos(w);
  }
  return out;
}

/** Letting go of a shape: a soft breath of paper settling and a small falling note. Quieter and rounder than the rustle. */
function letGo(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.3);
  const out = new Float32Array(n);
  const rnd = seeded(59);
  let a = 0;
  let b = 0;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    a += (rnd() * 2 - 1 - a) * 0.22;
    b += (a - b) * 0.3;
    phase += (TAU * (340 - 120 * Math.min(1, t / 0.25))) / sr;
    const air = b * Math.min(1, t / 0.05) * Math.exp(-t * 11) * 1.6;
    out[i] = air + Math.sin(phase) * 0.35 * Math.min(1, t / 0.01) * Math.exp(-t * 13);
  }
  return out;
}

/** Tracking lost: two soft notes, the second a fourth below, as if a breath went out. Gentle: it is a hint, not an alarm. */
function lost(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.9);
  const out = new Float32Array(n);
  const notes: readonly (readonly [number, number])[] = [
    [494, 0],
    [370, 0.24],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    for (const [f, start] of notes) {
      if (t < start) continue;
      const u = t - start;
      s += (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * f * 2 * t)) * Math.min(1, u / 0.012) * Math.exp(-u * 5.5);
    }
    out[i] = s;
  }
  return out;
}

/** The candle lifted off the table: a small wooden tap and a hush of cloth sliding. */
function lift(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.25);
  const out = new Float32Array(n);
  const rnd = seeded(61);
  let phase = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += (TAU * (160 + 70 * Math.exp(-t * 40))) / sr;
    const noise = rnd() * 2 - 1;
    const hp = noise - prev * 0.8;
    prev = noise;
    out[i] = Math.sin(phase) * Math.exp(-t * 30) + hp * 0.14 * Math.min(1, t / 0.02) * Math.exp(-t * 12);
  }
  return out;
}

/** The candle set down: a low settled thud and a tiny ceramic tink. */
function set(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 0.35);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    phase += (TAU * (50 + 50 * Math.exp(-t * 20))) / sr;
    const thud = Math.sin(phase) * Math.exp(-t * 15);
    const tink =
      t > 0.004
        ? Math.sin(TAU * 1180 * t) * 0.2 * Math.exp(-(t - 0.004) * 30) +
          Math.sin(TAU * 1790 * t) * 0.1 * Math.exp(-(t - 0.004) * 38)
        : 0;
    out[i] = thud + tink;
  }
  return out;
}

/**
 * Slow, cosy background music, made of nothing but sines: four soft chords (A minor, F, C, G) that swell and fade into
 * each other, and a few music-box notes picked from each chord. Twenty-four seconds that loop with no seam: every
 * pad note fits a whole number of cycles in the loop, the chord swells wrap round, and the bell tails wrap too.
 */
function music(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * MUSIC_S);
  const out = new Float32Array(n);
  const chordS = MUSIC_S / 4;
  // Each chord's notes in Hz, each nudged to a whole number of cycles in MUSIC_S (a change of under 0.02 Hz).
  const whole = (f: number) => Math.round(f * MUSIC_S) / MUSIC_S;
  const chords: readonly (readonly number[])[] = [
    [110, 164.81, 220, 261.63], // A minor
    [87.31, 130.81, 220, 329.63], // F major seventh
    [130.81, 196, 261.63, 329.63], // C
    [98, 146.83, 246.94, 329.63], // G with a sixth
  ].map((c) => c.map(whole));
  const pad = new Float32Array(n);
  for (let k = 0; k < 4; k++) {
    const centre = k * chordS + chordS / 2;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // How far from this chord's middle, going the short way round the loop.
      let d = Math.abs(t - centre);
      if (d > MUSIC_S / 2) d = MUSIC_S - d;
      if (d >= chordS) continue;
      const c = Math.cos((Math.PI / 2) * (d / chordS));
      const w = c * c; // overlapping swells that always add up to one
      let s = 0;
      for (let j = 0; j < chords[k].length; j++) s += Math.sin(TAU * chords[k][j] * t + j);
      pad[i] += s * w * (0.9 + 0.1 * Math.sin(TAU * 0.25 * t + k));
    }
  }
  for (let i = 0; i < n; i++) out[i] = pad[i] * 0.07;
  // The music box: a note every 0.75 s from the chord that is sounding, some left out, high and bell-like.
  const rnd = seeded(71);
  const steps = Math.floor(MUSIC_S / 0.75);
  for (let st = 0; st < steps; st++) {
    if (rnd() < 0.42) continue;
    const at = st * 0.75;
    const chord = chords[Math.floor(at / chordS) % 4];
    const f = chord[1 + Math.floor(rnd() * 3)] * (rnd() < 0.5 ? 4 : 2);
    const amp = 0.1 + 0.06 * rnd();
    const len = Math.floor(sr * 3);
    for (let j = 0; j < len; j++) {
      const u = j / sr;
      const v =
        (Math.sin(TAU * f * u) * Math.exp(-u * 2.2) + Math.sin(TAU * f * 2 * u) * 0.3 * Math.exp(-u * 4.5)) *
        Math.min(1, u / 0.004);
      out[(Math.floor(at * sr) + j) % n] += v * amp; // the tail wraps round to the start
    }
  }
  return out;
}

/** Sounds rendered ahead of time (the music, while the title screen is idle) so starting one does not cost a frame. */
const prewarmed = new Map<SoundId, Float32Array<ArrayBuffer>>();

/** The rate to render `id` at for a context running at `contextRate`. */
export function renderRateFor(id: SoundId, contextRate: number): number {
  return id === Sound.Music ? Math.min(contextRate, MUSIC_RATE) : contextRate;
}

/** Renders the music now and keeps it for the engine to take. Safe to call twice. */
export function prewarmMusic(): void {
  if (!prewarmed.has(Sound.Music)) prewarmed.set(Sound.Music, renderPlaceholder(Sound.Music, MUSIC_RATE));
}

/** Sounds rendered ahead by a worker (sound-prerender.ts), by sound and rate, to be handed over once. */
const prerendered = new Map<string, Float32Array<ArrayBuffer>>();
const prerenderKey = (id: SoundId, rate: number) => `${id}@${rate}`;

/** Keeps a sound rendered somewhere else (a worker) for `takeSamples` to hand over. */
export function storePrerendered(id: SoundId, rate: number, samples: Float32Array<ArrayBuffer>): void {
  prerendered.set(prerenderKey(id, rate), samples);
}

/** How many sounds are waiting rendered (for the report and the tests). */
export function prerenderedCount(): number {
  return prerendered.size;
}

/** The samples for `id` at `rate`: the prewarmed ones if they are at that rate (handed over once), else rendered now. */
export function takeSamples(id: SoundId, rate: number): Float32Array<ArrayBuffer> {
  const ahead = prerendered.get(prerenderKey(id, rate));
  if (ahead) {
    prerendered.delete(prerenderKey(id, rate));
    return ahead;
  }
  const ready = prewarmed.get(id);
  if (ready && rate === MUSIC_RATE) {
    prewarmed.delete(id);
    return ready;
  }
  return renderPlaceholder(id, rate);
}

/** Fades the last `n` samples to silence. */
function release(samples: Float32Array, n: number): void {
  for (let i = 0; i < n && i < samples.length; i++) samples[samples.length - 1 - i] *= i / n;
}

function normalise(samples: Float32Array, peak: number): void {
  let max = 0;
  for (let i = 0; i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= k;
}

/** A small deterministic random source (mulberry32), 0 up to 1. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
