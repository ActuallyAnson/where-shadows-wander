import { afterEach, beforeEach, describe as suite, expect, it, vi } from 'vitest';
import { createHandFrame } from '../engine/hands/hand';
import { Diagnostics, describe } from './diagnostics';

// The test environment is Node: give the report the few browser globals it reads.
let stored: Record<string, string>;
let writes: number;
const realConsoleError = console.error;

beforeEach(() => {
  stored = {};
  writes = 0;
  vi.stubGlobal('__BUILD_ID__', 'test');
  vi.stubGlobal('location', { href: 'http://localhost/' });
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('addEventListener', () => undefined);
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored[k] ?? null,
    setItem: (k: string, v: string) => {
      writes++;
      stored[k] = v;
    },
  });
  console.error = () => undefined; // the constructor wraps this, so the wrapped copy stays quiet
});

afterEach(() => {
  console.error = realConsoleError;
  vi.unstubAllGlobals();
});

function fakeSession(): XRSession {
  return { environmentBlendMode: 'opaque', frameRate: 72 } as unknown as XRSession;
}

function fakeFrame(session: XRSession, planes?: { size: number }): XRFrame {
  return { session, detectedPlanes: planes, getViewerPose: () => null } as unknown as XRFrame;
}

const renderer = { xr: { getBaseLayer: () => null, getFoveation: () => 0.5 } } as never;
const hands = { left: createHandFrame('left'), right: createHandFrame('right') };
const refSpace = {} as XRReferenceSpace;

suite('describe', () => {
  it('writes an Error as its name and message, not "{}"', () => {
    expect(describe(new TypeError('bad thing'))).toBe('TypeError: bad thing');
  });

  it('writes a circular object as its plain string instead of throwing', () => {
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(describe(a)).toBe('[object Object]');
  });

  it('writes plain values and objects', () => {
    expect(describe('hi')).toBe('hi');
    expect(describe(7)).toBe('7');
    expect(describe(null)).toBe('null');
    expect(describe(undefined)).toBe('undefined');
    expect(describe({ a: 1 })).toBe('{"a":1}');
  });

  it('survives values JSON cannot hold', () => {
    expect(describe({ n: 1n })).toBe('[object Object]');
  });
});

suite('Diagnostics', () => {
  it('keeps recording when console.error is given a circular object', () => {
    const d = new Diagnostics({ live: false });
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => console.error('three.js said', a)).not.toThrow();
    expect((d.snapshot().errors as string[])[0]).toContain('three.js said [object Object]');
  });

  it('cuts a very long error message', () => {
    const d = new Diagnostics({ live: false });
    d.error('x'.repeat(10_000));
    expect((d.snapshot().errors as string[])[0].length).toBeLessThan(520);
  });

  it('saves the report every two seconds while live', () => {
    const d = new Diagnostics({ live: true });
    const session = fakeSession();
    d.sessionStarted(session, renderer);
    const atStart = writes;
    const spy = vi.spyOn(performance, 'now');
    spy.mockReturnValue(10_000);
    d.frame(fakeFrame(session), refSpace, hands, 1);
    spy.mockReturnValue(10_500);
    d.frame(fakeFrame(session), refSpace, hands, 1);
    expect(writes).toBe(atStart + 1);
    spy.mockReturnValue(12_600);
    d.frame(fakeFrame(session), refSpace, hands, 1);
    expect(writes).toBe(atStart + 2);
    spy.mockRestore();
  });

  it('does not save or probe each frame when not live, but still saves when the session ends', () => {
    const d = new Diagnostics({ live: false });
    const session = fakeSession();
    d.sessionStarted(session, renderer);
    const atStart = writes;
    const spy = vi.spyOn(performance, 'now');
    for (let i = 0; i < 5; i++) {
      spy.mockReturnValue(10_000 + i * 5_000);
      d.frame(fakeFrame(session, { size: 0 }), refSpace, hands, 1);
    }
    spy.mockRestore();
    expect(writes).toBe(atStart);
    // The plane probe did not run, so the report has no plane section from it.
    expect(d.snapshot().planes).toBeUndefined();
    d.sessionEnded();
    expect(writes).toBe(atStart + 1);
  });

  it('reports the frame rate and foveation of the session', () => {
    const d = new Diagnostics({ live: false });
    d.sessionStarted(fakeSession(), renderer);
    const session = d.snapshot().session as { frameRate: number; foveation: number };
    expect(session.frameRate).toBe(72);
    expect(session.foveation).toBe(0.5);
  });

  it('still counts frames and hand tracking when not live', () => {
    const d = new Diagnostics({ live: false });
    const session = fakeSession();
    d.sessionStarted(session, renderer);
    d.frame(fakeFrame(session), refSpace, hands, 1);
    d.frame(fakeFrame(session), refSpace, hands, 1);
    const frames = d.snapshot().frames as { xrFrames: number };
    expect(frames.xrFrames).toBe(2);
  });
});
