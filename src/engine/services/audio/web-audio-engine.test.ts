import { describe, expect, it } from 'vitest';
import { FakeContext, FakeLegacyContext, FakeSource } from './fake-audio';
import { Bus, Mixer } from './mixer';
import { Sound, SOUND_DEFS } from './sounds';
import { AudioEngine } from './web-audio-engine';

const POSE = [0, 1.2, 0, 0, 0, -1, 0, 1, 0];
/** Creation order in the engine: master, then one gain per bus, then each voice's gain. */
const BUS_GAIN = (ctx: FakeContext, bus: number) => ctx.gains[1 + bus];

function make(opts: { voices?: number; allowResume?: boolean; asyncResume?: boolean } = {}) {
  const ctx = new FakeContext();
  ctx.allowResume = opts.allowResume ?? true;
  ctx.asyncResume = opts.asyncResume ?? false;
  const mixer = new Mixer();
  const engine = new AudioEngine({ mixer, voices: opts.voices, contextFactory: () => ctx as unknown as AudioContext });
  return { ctx, engine, mixer };
}

const loops = (ctx: FakeContext): FakeSource[] => ctx.sources.filter((s) => s.loop);

describe('unlocking', () => {
  it('makes no context and plays nothing until unlock is called', () => {
    const { engine, ctx } = make();
    expect(engine.context).toBeNull();
    expect(engine.playAt(Sound.Thump, 0, 1, -2)).toBe(false);
    expect(engine.stats.beforeUnlock).toBe(1);
    expect(ctx.sources).toHaveLength(0);
    expect(engine.state).toBe('locked');
  });

  it('starts the context on unlock, and plays after it is running', () => {
    const { engine, ctx } = make();
    engine.unlock();
    expect(ctx.resumeCalls).toBe(1);
    expect(engine.state).toBe('running');
    expect(engine.playAt(Sound.Thump, 0, 1, -2)).toBe(true);
    expect(ctx.sources[0].started).toBe(true);
  });

  it('stays locked, and drops sounds, while the browser keeps the context suspended', () => {
    const { engine, ctx } = make({ allowResume: false });
    engine.unlock();
    expect(engine.state).toBe('locked');
    expect(engine.playAt(Sound.Thump, 0, 0, 0)).toBe(false);
    expect(ctx.sources).toHaveLength(0);
  });

  it('plays only once the resume has actually finished, as in a browser', async () => {
    const { engine } = make({ asyncResume: true });
    engine.unlock();
    expect(engine.playAt(Sound.Thump, 0, 0, 0)).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.playAt(Sound.Thump, 0, 0, 0)).toBe(true);
  });

  it('unlocks on the first gesture and then stops listening', () => {
    const { engine, ctx } = make();
    const target = new EventTarget();
    engine.attachGestureUnlock(target);
    target.dispatchEvent(new Event('pointerdown'));
    expect(ctx.state).toBe('running');
    const calls = ctx.resumeCalls;
    target.dispatchEvent(new Event('keydown'));
    expect(ctx.resumeCalls).toBe(calls);
  });

  it('keeps listening if the first gesture did not unlock it', () => {
    const { engine, ctx } = make({ allowResume: false });
    const target = new EventTarget();
    engine.attachGestureUnlock(target);
    target.dispatchEvent(new Event('click'));
    ctx.allowResume = true;
    target.dispatchEvent(new Event('click'));
    expect(ctx.state).toBe('running');
  });

  it('unlocks on a headset pinch or squeeze during a session, when the page never saw a click', () => {
    const { engine, ctx } = make({ allowResume: false });
    const session = new EventTarget() as EventTarget & {
      addEventListener(t: string, l: () => void): void;
      removeEventListener(t: string, l: () => void): void;
    };
    engine.attachSessionUnlock(session);
    engine.unlock(); // the session start: the browser keeps it suspended
    expect(ctx.state).toBe('suspended');
    ctx.allowResume = true;
    session.dispatchEvent(new Event('select'));
    expect(ctx.state).toBe('running');
  });

  it('tries again every couple of seconds of frames while locked', () => {
    const { engine, ctx } = make({ allowResume: false });
    engine.unlock();
    const first = ctx.resumeCalls;
    for (let i = 0; i < 179; i++) engine.update(POSE);
    expect(ctx.resumeCalls).toBe(first);
    ctx.allowResume = true;
    engine.update(POSE);
    expect(ctx.resumeCalls).toBe(first + 1);
    expect(ctx.state).toBe('running');
  });

  it('goes on silently when Web Audio cannot be made', () => {
    const engine = new AudioEngine({
      contextFactory: () => {
        throw new Error('no audio');
      },
    });
    engine.unlock();
    expect(engine.playAt(Sound.Chime, 0, 0, 0)).toBe(false);
    expect(() => engine.update(POSE)).not.toThrow();
  });

  it('makes a fresh context if used again after dispose', () => {
    const made: FakeContext[] = [];
    const engine = new AudioEngine({
      contextFactory: () => {
        made.push(new FakeContext());
        return made.at(-1) as unknown as AudioContext;
      },
    });
    engine.unlock();
    engine.setLoop(Sound.Crackle, true, 0, 1, 0);
    engine.dispose();
    expect(made[0].state).toBe('closed');
    engine.unlock();
    expect(made).toHaveLength(2);
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(true);
    expect(made[1].sources.filter((s) => s.started)).toHaveLength(1); // the new context has only the rustle, not the old loop's voice
  });
});

describe('playing', () => {
  it('puts the sound where asked, on its bus, with its own range', () => {
    const { engine, ctx } = make();
    engine.unlock();
    engine.playAt(Sound.Rustle, -0.4, 1.2, -1.95);
    const rustle = SOUND_DEFS[Sound.Rustle];
    const panner = ctx.panners.find((p) => p.positionX.value === -0.4)!;
    expect(panner.positionY.value).toBe(1.2);
    expect(panner.positionZ.value).toBe(-1.95);
    expect(panner.refDistance).toBe(rustle.refDistance);
    expect(panner.maxDistance).toBe(rustle.maxDistance);
    expect(panner.connected).toBe(BUS_GAIN(ctx, Bus.Effects));
  });

  it('renders each placeholder the first time it is needed, not at unlock', () => {
    const { engine, ctx } = make();
    const made: number[] = [];
    const real = ctx.createBuffer;
    ctx.createBuffer = (c: number, length: number) => {
      made.push(length);
      return real(c, length);
    };
    engine.unlock();
    expect(made).toHaveLength(0);
    engine.playAt(Sound.Chime, 0, 0, 0);
    engine.playAt(Sound.Chime, 0, 0, 0);
    expect(made).toHaveLength(1);
  });

  it('refuses a sound that repeats inside its gap, and allows it after', () => {
    const { engine, ctx } = make();
    engine.unlock();
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(true);
    ctx.currentTime += 0.1;
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(false);
    expect(engine.stats.tooSoon).toBe(1);
    ctx.currentTime += SOUND_DEFS[Sound.Rustle].minGapS;
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(true);
  });

  it('gives each hand its own gap, so both hands can sound together', () => {
    const { engine } = make();
    engine.unlock();
    expect(engine.playAt(Sound.Thump, -0.3, 1, -2, 0)).toBe(true);
    expect(engine.playAt(Sound.Thump, 0.3, 1, -2, 1)).toBe(true);
    expect(engine.playAt(Sound.Thump, 0.3, 1, -2, 1)).toBe(false);
  });

  it('does not use up the gap when no voice was free for the sound', () => {
    const { engine, ctx } = make({ voices: 1 });
    engine.unlock();
    expect(engine.playAt(Sound.Chime, 0, 0, 0)).toBe(true); // priority 3 holds the only voice
    ctx.currentTime += 1;
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(false);
    expect(engine.stats.noVoice).toBe(1);
    ctx.sources[0].end(); // the chime ends
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(true); // not "too soon"
  });

  it('frees a voice when its sound ends, and a stolen voice’s old end does not free the new sound', () => {
    const { engine, ctx } = make({ voices: 1 });
    engine.unlock();
    engine.playAt(Sound.Rustle, 0, 0, 0); // priority 1
    ctx.currentTime += 1;
    expect(engine.playAt(Sound.Thump, 0, 0, 0)).toBe(true); // priority 2 takes the only voice
    expect(ctx.sources[0].stopped).toBe(true);
    ctx.sources[0].end(); // the old sound's end arrives late
    ctx.currentTime += 1;
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(false); // the thump still holds the voice
    ctx.sources[1].end();
    ctx.currentTime += 1;
    expect(engine.playAt(Sound.Rustle, 0, 0, 0)).toBe(true);
  });

  it('only reconnects a voice when its bus changes', () => {
    const { engine, ctx } = make({ voices: 1 });
    engine.unlock();
    engine.playAt(Sound.Rustle, 0, 0, 0);
    const panner = ctx.panners[0];
    let disconnects = 0;
    const real = panner.disconnect.bind(panner);
    panner.disconnect = () => {
      disconnects++;
      real();
    };
    ctx.sources[0].end();
    ctx.currentTime += 1;
    engine.playAt(Sound.Rustle, 0, 0, 0); // same bus again
    expect(disconnects).toBe(0);
  });
});

describe('the crackle loop', () => {
  it('starts looping at the flame, follows it only when it moves, and fades out on stop', () => {
    const { engine, ctx } = make();
    engine.unlock();
    engine.setLoop(Sound.Crackle, true, 0, 1, 0);
    expect(loops(ctx)).toHaveLength(1);
    expect(loops(ctx)[0].started).toBe(true);
    engine.setLoop(Sound.Crackle, true, 0, 1, 0); // already looping
    expect(loops(ctx)).toHaveLength(1);
    engine.moveLoop(Sound.Crackle, 0.2, 1, 0);
    expect(ctx.panners.some((p) => p.positionX.value === 0.2)).toBe(true);
    engine.setLoop(Sound.Crackle, false, 0, 0, 0);
    expect(loops(ctx)[0].stopped).toBe(true);
  });

  it('restarting during the fade makes a fresh voice, so two copies never share a gain', () => {
    const { engine, ctx } = make();
    engine.unlock();
    engine.setLoop(Sound.Crackle, true, 0, 1, 0);
    const voiceGains = ctx.gains.length;
    engine.setLoop(Sound.Crackle, false, 0, 1, 0);
    engine.setLoop(Sound.Crackle, true, 0, 1, 0);
    expect(loops(ctx)).toHaveLength(2);
    expect(ctx.gains.length).toBe(voiceGains + 1); // a new voice's gain
    expect(loops(ctx)[0].connected).not.toBe(loops(ctx)[1].connected);
  });

  it('is kept when asked for while locked, and starts at the last position once audio is running', () => {
    const { engine, ctx } = make();
    engine.setLoop(Sound.Crackle, true, 0, 1, 0);
    engine.moveLoop(Sound.Crackle, 0.3, 1, 0);
    expect(ctx.sources).toHaveLength(0);
    engine.unlock();
    engine.update(POSE);
    expect(loops(ctx)[0]?.started).toBe(true);
    expect(ctx.panners.some((p) => p.positionX.value === 0.3)).toBe(true);
  });

  it('is not started if it was switched off while locked', () => {
    const { engine, ctx } = make();
    engine.setLoop(Sound.Crackle, true, 0, 1, 0);
    engine.setLoop(Sound.Crackle, false, 0, 1, 0);
    engine.unlock();
    engine.update(POSE);
    expect(loops(ctx)).toHaveLength(0);
  });
});

describe('update', () => {
  it('writes the listener only when the head moved', () => {
    const { engine, ctx } = make();
    engine.unlock();
    engine.update([0, 1.2, 0.5, 0, 0, -1, 0, 1, 0]);
    expect(ctx.listener.positionY.value).toBe(1.2);
    expect(ctx.listener.forwardZ.value).toBe(-1);
    ctx.listener.positionY.value = 99; // a write would overwrite this
    engine.update([0, 1.2, 0.5, 0, 0, -1, 0, 1, 0]);
    expect(ctx.listener.positionY.value).toBe(99);
    engine.update([0, 1.3, 0.5, 0, 0, -1, 0, 1, 0]);
    expect(ctx.listener.positionY.value).toBe(1.3);
  });

  it('passes the head’s real up direction, so a rolled head is heard rolled', () => {
    const { engine, ctx } = make();
    engine.unlock();
    engine.update([0, 1.2, 0, 0, 0, -1, 0.5, 0.866, 0]);
    expect(ctx.listener.upX.value).toBeCloseTo(0.5, 12);
    expect(ctx.listener.upY.value).toBeCloseTo(0.866, 12);
  });

  it('uses setPosition and setOrientation on a listener with no parameters', () => {
    const ctx = new FakeLegacyContext();
    const engine = new AudioEngine({ contextFactory: () => ctx as unknown as AudioContext });
    engine.unlock();
    engine.update([1, 2, 3, 0, 0, -1, 0, 1, 0]);
    expect(ctx.calls).toEqual(['position 1 2 3', 'orientation 0 0 -1 0 1 0']);
  });

  it('applies mixer changes to the bus gains, once', () => {
    const { engine, ctx, mixer } = make();
    engine.unlock();
    const effects = BUS_GAIN(ctx, Bus.Effects);
    engine.update(POSE);
    const before = effects.gain.targets.length;
    mixer.setVolume(Bus.Effects, 0.5);
    engine.update(POSE);
    engine.update(POSE);
    expect(effects.gain.targets).toHaveLength(before + 1);
    expect(effects.gain.targets.at(-1)).toBeCloseTo(0.25, 12);
    mixer.setMuted(Bus.Effects, true);
    engine.update(POSE);
    expect(effects.gain.targets.at(-1)).toBe(0);
  });
});

describe('setPaused', () => {
  it('suspends the context while paused and resumes it after', () => {
    const { engine, ctx } = make();
    engine.unlock();
    engine.setPaused(true);
    expect(ctx.suspendCalls).toBe(1);
    expect(ctx.state).toBe('suspended');
    expect(engine.state).toBe('suspended');
    engine.setPaused(true); // no change, no second call
    expect(ctx.suspendCalls).toBe(1);
    engine.setPaused(false);
    expect(ctx.state).toBe('running');
  });

  it('does not start audio from a gesture or a retry while paused', () => {
    const { engine, ctx } = make();
    engine.unlock();
    engine.setPaused(true);
    const calls = ctx.resumeCalls;
    engine.unlock();
    for (let i = 0; i < 400; i++) engine.update(POSE);
    expect(ctx.resumeCalls).toBe(calls);
    expect(ctx.state).toBe('suspended');
  });

  it('does nothing before audio exists, and the pause is remembered', () => {
    const { engine, ctx } = make();
    engine.setPaused(true);
    engine.unlock();
    expect(ctx.state).toBe('suspended');
    engine.setPaused(false);
    expect(ctx.state).toBe('running');
  });
});
