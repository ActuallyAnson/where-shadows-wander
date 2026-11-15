import { describe, expect, it } from 'vitest';
import { ENDING_SCRIPT, EndingTimeline } from './ending-timeline';
import { sampleKeys } from './wake-timeline';

const S = ENDING_SCRIPT;
const allKeys = [S.candleKeys, S.moonKeys, S.lidKeys, S.rainKeys, S.musicKeys, S.thanksKeys];

describe('ENDING_SCRIPT', () => {
  it('has its points in time order, all within the end', () => {
    for (const keys of allKeys) {
      for (let i = 1; i < keys.length; i++) expect(keys[i].t).toBeGreaterThanOrEqual(keys[i - 1].t);
      expect(keys[keys.length - 1].t).toBeLessThanOrEqual(S.endAt);
    }
  });

  it('yawns once the candle is out, as the eyes come back open after the first heavy blink, before the credits', () => {
    expect(S.yawnAt).toBeGreaterThan(S.outAt);
    expect(S.yawnAt).toBeLessThan(S.creditsAt);
    expect(sampleKeys(S.lidKeys, S.yawnAt)).toBeGreaterThan(0.1);
    const e = new EndingTimeline();
    e.start();
    let yawns = 0;
    for (let t = 0; t < S.endAt + 1; t += 0.1) {
      e.update(0.1);
      if (e.yawn) yawns++;
    }
    expect(yawns).toBe(1);
  });

  it('dims the candle slowly from where it was to nothing by the time it goes out', () => {
    expect(sampleKeys(S.candleKeys, 0)).toBe(1);
    expect(sampleKeys(S.candleKeys, S.outAt)).toBe(0);
    expect(S.outAt).toBeGreaterThanOrEqual(4); // slow, as the opening's light is
    let last = 1;
    for (let t = 0; t <= S.outAt; t += 0.05) {
      const v = sampleKeys(S.candleKeys, t);
      expect(v).toBeLessThanOrEqual(last + 1e-9);
      last = v;
    }
  });

  it('keeps the eyes open while the candle goes out, blinks at least twice, then shuts them before the credits', () => {
    for (let t = 0; t <= S.outAt; t += 0.05) expect(sampleKeys(S.lidKeys, t)).toBe(1);
    let closes = 0;
    let wasShut = false;
    for (let t = 0; t <= S.creditsAt; t += 0.02) {
      const shut = sampleKeys(S.lidKeys, t) < 0.1;
      if (shut && !wasShut) closes++;
      wasShut = shut;
    }
    expect(closes).toBeGreaterThanOrEqual(3); // two blinks and the last close
    const lastLid = S.lidKeys[S.lidKeys.length - 1];
    expect(lastLid.v).toBe(0);
    expect(lastLid.t).toBeLessThan(S.creditsAt);
  });

  it('thanks the player after the credits have passed, and ends once it has faded', () => {
    expect(sampleKeys(S.thanksKeys, S.creditsAt + S.creditsS / 2)).toBe(0);
    expect(Math.max(...S.thanksKeys.map((k) => k.v))).toBe(1);
    expect(sampleKeys(S.thanksKeys, S.endAt)).toBe(0);
  });
});

describe('EndingTimeline', () => {
  it('is idle until started', () => {
    const e = new EndingTimeline();
    e.update(1);
    expect(e.active).toBe(false);
    expect(e.time).toBe(0);
  });

  it('says once when the flame goes out, when the credits start and when it is over', () => {
    const e = new EndingTimeline();
    e.start();
    let outs = 0;
    let credits = 0;
    let dones = 0;
    for (let i = 0; i < 10000 && (e.active || dones === 0); i++) {
      e.update(1 / 72);
      if (e.out) outs++;
      if (e.creditsStart) credits++;
      if (e.done) dones++;
    }
    expect([outs, credits, dones]).toEqual([1, 1, 1]);
    expect(e.active).toBe(false);
    expect(e.time).toBe(S.endAt);
  });

  it('rolls the credits from 0 to 1 over their time', () => {
    const e = new EndingTimeline();
    e.start();
    e.update(S.creditsAt - 0.5);
    expect(e.credits).toBe(0);
    expect(e.creditsShowing).toBe(false);
    e.update(0.5 + S.creditsS / 2);
    expect(e.credits).toBeCloseTo(0.5);
    expect(e.creditsShowing).toBe(true);
    e.update(S.creditsS);
    expect(e.credits).toBe(1);
    expect(e.creditsShowing).toBe(false);
  });

  it('holds still for a zero or negative step, and stops where it is', () => {
    const e = new EndingTimeline();
    e.start();
    e.update(2);
    e.update(0);
    e.update(-5);
    expect(e.time).toBe(2);
    e.stop();
    e.update(1);
    expect(e.active).toBe(false);
    expect(e.time).toBe(2);
  });
});
