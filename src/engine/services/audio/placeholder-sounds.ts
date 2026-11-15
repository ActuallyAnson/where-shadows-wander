// Placeholder sounds made in code: what plays for a sound with no file in src/assets/audio/sfx, and for one whose file has
// not loaded yet or failed to. Each is rendered once into samples (nothing here runs per frame), is the same every time (a
// seeded random source), and has no third-party material in it (CREDITS.md). Plain TypeScript.
import { Sound, SOUND_DEFS, type SoundId } from './sounds';

const TAU = Math.PI * 2;
/** The rain loop's length, seconds. */
export const RAIN_S = 6;
/** The thunder's length, seconds: a long, slow roll. */
export const THUNDER_S = 6;
/** The candle loop's length, seconds: long enough that the repeat is not noticed. */
export const CRACKLE_S = 6;
/** How loud the candle is rendered (the others peak at 0.8): it is a quiet bed, not an event. */
const CRACKLE_PEAK = 0.35;

/** How loud each sound is rendered (it peaks here). A loop is a quiet bed, not an event, so it is lower. */
const PEAK: Readonly<Record<SoundId, number>> = {
  [Sound.Rustle]: 0.8,
  [Sound.Thump]: 0.8,
  [Sound.Crackle]: CRACKLE_PEAK,
  [Sound.Tick]: 0.8,
  [Sound.Press]: 0.8,
  [Sound.Ignite]: 0.8,
  [Sound.Release]: 0.8,
  [Sound.Lost]: 0.8,
  [Sound.Step0]: 0.6,
  [Sound.Step1]: 0.6,
  [Sound.Rain]: 0.35,
  [Sound.Thunder]: 0.8,
  [Sound.Covers]: 0.8,
  [Sound.Music]: 0.8,
  [Sound.Laugh]: 0.8,
  [Sound.Click]: 0.8,
  [Sound.Rumble]: 0.8,
  [Sound.Yawn]: 0.8,
  [Sound.Giggle]: 0.8,
  [Sound.Hop]: 0.8,
  [Sound.Blanket]: 0.8,
  [Sound.Run]: 0.8,
  [Sound.Jar]: 0.8,
  [Sound.Bell]: 0.8,
  [Sound.Gate]: 0.8,
  [Sound.Creak]: 0.8,
  [Sound.Gust]: 0.8,
  [Sound.Crickets]: 0.35,
  [Sound.Wind]: 0.35,
  [Sound.Firefly]: 0.8,
  [Sound.Palms]: 0.8,
  [Sound.Slide]: 0.8,
  [Sound.Snuff]: 0.8,
  [Sound.Breath]: 0.8,
  [Sound.Birds]: 0.35,
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
    case Sound.Step0:
      return footstep(sr, 0);
    case Sound.Step1:
      return footstep(sr, 1);
    case Sound.Rain:
      return rain(sr);
    case Sound.Thunder:
      return thunder(sr);
    case Sound.Covers:
      return covers(sr);
    case Sound.Rustle:
      return rustle(sr);
    case Sound.Thump:
      return thump(sr);
    case Sound.Crackle:
      return crackle(sr);
    case Sound.Tick:
      return tick(sr);
    case Sound.Press:
      return press(sr);
    case Sound.Ignite:
      return ignite(sr);
    case Sound.Release:
      return letGo(sr);
    case Sound.Lost:
      return lost(sr);
    case Sound.Click:
      return tick(sr); // the torch's switch: a tiny tick will do
    case Sound.Rumble:
      return thunder(sr); // the room's thunder, played softer (SOUND_DEFS)
    case Sound.Music:
    case Sound.Laugh:
    case Sound.Yawn:
    case Sound.Giggle:
    case Sound.Hop:
    case Sound.Blanket:
    case Sound.Run:
    case Sound.Jar:
    case Sound.Bell:
    case Sound.Gate:
    case Sound.Creak:
    case Sound.Gust:
    case Sound.Crickets:
    case Sound.Wind:
    case Sound.Firefly:
    case Sound.Palms:
    case Sound.Slide:
    case Sound.Snuff:
    case Sound.Breath:
    case Sound.Birds:
      // Never played (each waits for its file: SoundDef.fileOnly), so the stand-in is a moment of silence.
      return new Float32Array(Math.floor(sr * 0.05));
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
 * The bedclothes as he sits up: a soft slide of heavy cloth, not paper. Low-passed noise (dull, no crinkle) in two pulls, the
 * second longer, as the quilt slides down from the shoulders to the lap, with a faint uneven grain of cloth rubbing on cloth.
 */
function covers(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 1.4);
  const out = new Float32Array(n);
  const rnd = seeded(131);
  const k1 = lowPass(1400, sr);
  const k2 = lowPass(700, sr);
  const kGrain = lowPass(30, sr);
  let a = 0;
  let b = 0;
  let grain = 0;
  // The pulls: when each peaks (s), how wide it is (s), and how loud.
  const pulls: readonly (readonly [number, number, number])[] = [
    [0.18, 0.1, 0.7],
    [0.6, 0.28, 1],
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const x = rnd() * 2 - 1;
    a += (x - a) * k1;
    b += (a - b) * k2;
    grain += (rnd() * 2 - 1 - grain) * kGrain;
    let env = 0;
    for (let k = 0; k < pulls.length; k++) {
      const d = (t - pulls[k][0]) / pulls[k][1];
      env += pulls[k][2] * Math.exp(-d * d);
    }
    out[i] = b * env * (0.75 + 2.5 * grain) * Math.min(1, t / 0.02);
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

/** The samples for `id` at `rate`: the ones a worker rendered ahead at that rate (handed over once), else rendered now. */
export function takeSamples(id: SoundId, rate: number): Float32Array<ArrayBuffer> {
  const ahead = prerendered.get(prerenderKey(id, rate));
  if (ahead) {
    prerendered.delete(prerenderKey(id, rate));
    return ahead;
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
