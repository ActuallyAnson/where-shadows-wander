import { describe, expect, it } from 'vitest';
import { createHandFrame, type HandFrame } from '../engine/hands/hand';
import { handFeatures, roughShape } from '../engine/hands/hand-features';
import { createRecording, parseRecording, recordFrame } from '../engine/hands/hand-recording';
import type { HandSource } from './hand-source';
import { MockMode, mockOptionsFromUrl } from './mock-mode';
import { ReplaySource } from './replay-source';
import { SHAPES_SCRIPT } from '../engine/hands/shape-script';
import { ScriptedSource } from './scripted-source';
import { BLEND_S, SyntheticSource } from './synthetic-source';

/** A 6 s recording made here from the scripted hands (recordings/ is gitignored, so tests can't rely on it). */
function makeRecording() {
  const rec = createRecording('test', 'ua', '2026-10-03T00:00:00Z');
  const src = new ScriptedSource();
  const l = createHandFrame('left'),
    r = createHandFrame('right');
  for (let i = 0; i <= 6 * 72; i++) {
    src.update(i / 72, l, r);
    recordFrame(rec, i / 72, l, r, null);
  }
  return parseRecording(JSON.parse(JSON.stringify(rec)));
}
const recording = makeRecording();

/** Runs a source through mock mode at a given frame rate and returns every frame's joints. */
function run(source: HandSource, fps: number, seconds: number): { t: number; left: number[]; right: number[] }[] {
  const mode = new MockMode(source);
  const left = createHandFrame('left'),
    right = createHandFrame('right');
  const out = [];
  for (let i = 0; i < fps * seconds; i++) {
    mode.update(1 / fps, left, right);
    out.push({ t: mode.time, left: snapshot(left), right: snapshot(right) });
  }
  return out;
}

function snapshot(h: HandFrame): number[] {
  return h.tracked ? [...h.positions] : [];
}

describe('mock mode options', () => {
  it('is off without ?mock', () => {
    expect(mockOptionsFromUrl('')).toBeNull();
    expect(mockOptionsFromUrl('?mock=0')).toBeNull();
    expect(mockOptionsFromUrl('?record=10')).toBeNull();
  });

  it('defaults to synthetic hands and the demo recording', () => {
    expect(mockOptionsFromUrl('?mock=1')).toEqual({
      source: 'synthetic',
      file: 'recordings/emulator-demo.handrec.json',
    });
  });

  it('reads the source and file, and ignores unknown sources', () => {
    expect(mockOptionsFromUrl('?mock=1&src=replay&file=a.json')).toEqual({ source: 'replay', file: 'a.json' });
    expect(mockOptionsFromUrl('?mock&src=webcam')?.source).toBe('webcam');
    expect(mockOptionsFromUrl('?mock=1&src=nope')?.source).toBe('synthetic');
  });
});

describe('mock mode clock', () => {
  it('stops while paused and caps long frames', () => {
    const mode = new MockMode(new SyntheticSource());
    const l = createHandFrame('left'),
      r = createHandFrame('right');
    mode.update(0.1, l, r);
    mode.paused = true;
    mode.update(0.1, l, r);
    expect(mode.time).toBeCloseTo(0.1);
    mode.paused = false;
    mode.update(5, l, r);
    expect(mode.time).toBeCloseTo(0.35);
  });

  it('restarts the clock when the source changes', () => {
    const mode = new MockMode(new SyntheticSource());
    mode.update(0.2, createHandFrame('left'), createHandFrame('right'));
    mode.setSource(new ScriptedSource());
    expect(mode.time).toBe(0);
  });
});

describe('replay source', () => {
  it('replays a recording identically twice in a row', () => {
    expect(run(new ReplaySource(recording), 72, 5)).toEqual(run(new ReplaySource(recording), 72, 5));
  });

  it('shows the recorded frame for the mock time, whatever the frame rate', () => {
    const at72 = run(new ReplaySource(recording), 72, 3);
    const at90 = run(new ReplaySource(recording), 90, 3);
    // 1 s is frame 72 at 72 fps and frame 90 at 90 fps.
    expect(at72[71].right).toEqual(at90[89].right);
    expect(at72[71].right).toHaveLength(75);
  });

  it('finds the last frame at or before a time, and loops', () => {
    const src = new ReplaySource(recording);
    const frames = recording.frames;
    expect(src.frameAt(0)).toBe(0);
    expect(frames[src.frameAt(1)].t).toBeLessThanOrEqual(1);
    expect(frames[src.frameAt(1) + 1].t).toBeGreaterThan(1);
    expect(src.frameAt(src.duration + 1)).toBe(src.frameAt(1));
    expect(new ReplaySource(recording, false).frameAt(1e6)).toBe(frames.length - 1);
  });
});

describe('scripted source', () => {
  it('makes each shape on the hand the script names', () => {
    const src = new ScriptedSource();
    const l = createHandFrame('left'),
      r = createHandFrame('right');
    // "right: fist" starts after the relaxed lead-in, flat and a rest (see SHAPES_SCRIPT).
    const fistAt = SHAPES_SCRIPT.slice(
      0,
      SHAPES_SCRIPT.findIndex((s) => s.shape === 'fist'),
    ).reduce((t, s) => t + s.seconds, 0);
    src.update(fistAt + 1, l, r);
    expect(roughShape(handFeatures(r)!)).toBe('fist');
    expect(l.tracked).toBe(false); // the left hand hasn't appeared yet
  });

  it('gives the same hands at the same time, whatever the frame rate', () => {
    const at60 = run(new ScriptedSource(), 60, 4);
    const at120 = run(new ScriptedSource(), 120, 4);
    expect(at60[149].right).toEqual(at120[299].right); // 2.5 s
  });
});

describe('synthetic source', () => {
  it('blends into a new shape over BLEND_S', () => {
    const src = new SyntheticSource();
    const l = createHandFrame('left'),
      r = createHandFrame('right');
    src.update(1, l, r);
    src.setShape('right', 'fist');
    src.update(1 + BLEND_S / 2, l, r);
    const mid = handFeatures(r)!.meanCurl;
    src.update(1 + BLEND_S, l, r);
    expect(mid).toBeLessThan(handFeatures(r)!.meanCurl);
    expect(roughShape(handFeatures(r)!)).toBe('fist');
  });

  it('hides a hand', () => {
    const src = new SyntheticSource();
    const l = createHandFrame('left'),
      r = createHandFrame('right');
    src.setShape('left', null);
    src.update(0, l, r);
    expect(l.tracked).toBe(false);
    expect(r.tracked).toBe(true);
  });
});
