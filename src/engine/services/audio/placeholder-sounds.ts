// Placeholder sounds made in code, so the audio works before the team's CC0 files exist. Each is rendered once
// into samples (nothing here runs per frame), is the same every time (a seeded random source), and has no
// third-party material in it (CREDITS.md). Replace one by putting a file named after it (rustle.ogg ...) in
// src/assets/audio/sfx and giving the engine its buffer. Plain TypeScript.
import { Sound, type SoundId } from './sounds';

const TAU = Math.PI * 2;

/** The samples for `id` at `sampleRate`, peaking at 0.8, mono. */
export function renderPlaceholder(id: SoundId, sampleRate: number): Float32Array<ArrayBuffer> {
  const out =
    id === Sound.Rustle
      ? rustle(sampleRate)
      : id === Sound.Thump
        ? thump(sampleRate)
        : id === Sound.Chime
          ? chime(sampleRate)
          : crackle(sampleRate);
  normalise(out, 0.8);
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

/** A two-second loop of a small fire: random pops of different sizes over a faint hiss, silent at both ends. */
function crackle(sr: number): Float32Array<ArrayBuffer> {
  const n = Math.floor(sr * 2);
  const out = new Float32Array(n);
  const rnd = seeded(37);
  let hiss = 0;
  for (let i = 0; i < n; i++) {
    hiss += (rnd() * 2 - 1 - hiss) * 0.2; // low-passed noise
    out[i] = hiss * 0.04;
  }
  const pops = 46;
  for (let k = 0; k < pops; k++) {
    const at = Math.floor((0.03 + 0.92 * rnd()) * n);
    const size = 0.2 + 0.8 * rnd() * rnd();
    const len = Math.floor(sr * (0.004 + 0.012 * rnd()));
    for (let j = 0; j < len && at + j < n; j++) out[at + j] += (rnd() * 2 - 1) * size * Math.exp((-5 * j) / len);
  }
  // Fade the first and last few milliseconds so the loop joins without a click.
  const edge = Math.floor(sr * 0.01);
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
