// Placeholder sounds made in code, so the audio works before the team's CC0 files exist. Each is rendered once
// into samples (nothing here runs per frame), is the same every time (a seeded random source), and has no
// third-party material in it (CREDITS.md). Replace one by putting a file named after it (rustle.ogg ...) in
// src/assets/audio/sfx and giving the engine its buffer. Plain TypeScript.
import { Sound, type SoundId } from './sounds';

const TAU = Math.PI * 2;
/** The candle loop's length, seconds: long enough that the repeat is not noticed. */
export const CRACKLE_S = 6;
/** How loud the candle is rendered (the others peak at 0.8): it is a quiet bed, not an event. */
const CRACKLE_PEAK = 0.35;

/** The samples for `id` at `sampleRate`, mono, peaking at 0.8 (the candle loop at CRACKLE_PEAK). */
export function renderPlaceholder(id: SoundId, sampleRate: number): Float32Array<ArrayBuffer> {
  const out =
    id === Sound.Rustle
      ? rustle(sampleRate)
      : id === Sound.Thump
        ? thump(sampleRate)
        : id === Sound.Chime
          ? chime(sampleRate)
          : crackle(sampleRate);
  normalise(out, id === Sound.Crackle ? CRACKLE_PEAK : 0.8);
  if (id !== Sound.Crackle) release(out, Math.floor(sampleRate * 0.008)); // end at zero, so there is no click
  return out;
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
