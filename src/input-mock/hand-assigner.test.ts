import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../engine/hands/hand';
import { HandAssigner } from './hand-assigner';

const L: Vec3 = [-0.15, 1, 0];
const R: Vec3 = [0.15, 1, 0];

describe('hand assigner', () => {
  it('uses the labels when there is no history', () => {
    expect(new HandAssigner().assign(['left', 'right'], [L, R], 0)).toEqual(['left', 'right']);
    expect(new HandAssigner().assign(['right'], [L], 0)).toEqual(['right']);
  });

  it('keeps both hands on their sides when the labels swap for a frame', () => {
    const a = new HandAssigner();
    a.assign(['left', 'right'], [L, R], 0);
    expect(a.assign(['right', 'left'], [L, R], 33)).toEqual(['left', 'right']);
  });

  it('keeps a lone hand on its side when its label flips', () => {
    // The case from the 2 Oct webcam recording: both hands seen, then the left one labelled "right".
    const a = new HandAssigner();
    a.assign(['left', 'right'], [L, R], 0);
    expect(a.assign(['right'], [L], 33)).toEqual(['left']);
  });

  it('never gives two hands the same side', () => {
    const a = new HandAssigner();
    expect(a.assign(['right', 'right'], [L, R], 0)).toEqual(['right', 'left']);
    expect(a.assign(['left', 'left'], [L, R], 33)).toEqual(['right', 'left']);
  });

  it('trusts the label again once its memory is old', () => {
    const a = new HandAssigner();
    a.assign(['left', 'right'], [L, R], 0);
    expect(a.assign(['right'], [L], 1000)).toEqual(['right']);
  });

  it('follows a label that moves only a little (no override without a clear margin)', () => {
    const a = new HandAssigner();
    a.assign(['left', 'right'], [L, R], 0);
    // Hands close together: the left hand is a bit nearer the right's old spot, but not by the margin.
    expect(a.assign(['left'], [[0.01, 1, 0]], 33)).toEqual(['left']);
  });
});
