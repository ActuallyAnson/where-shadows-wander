import { describe, expect, it } from 'vitest';
import { ScenePlayer } from '../puppet/scene-player';
import { GOODBYE_AT, GOODBYE_LENGTH_S, PALMS_AT_S, PALMS_LEN_S } from './goodbye';
import { STORY_CHAPTER, STORY_STAGE } from './story-stage';

const player = new ScenePlayer(STORY_STAGE);
const start = STORY_CHAPTER['goodbye'].start;
const index = (id: string) => {
  const i = STORY_STAGE.parts.findIndex((p) => p.id === id);
  expect(i, id).toBeGreaterThanOrEqual(0);
  return i;
};
/** A part's place, angle, scale and opacity on the wall, `t` seconds into the goodbye. */
function at(id: string, t: number) {
  player.seek(start + t);
  const o = index(id) * 5;
  const w = player.world;
  return { x: w[o], y: w[o + 1], angle: w[o + 2], scale: w[o + 3], opacity: w[o + 4] };
}
/** Where the end of a kid's front arm is (its hand's place), `t` seconds in. */
function armEnd(kid: string, t: number): [number, number] {
  const a = at(`${kid}-arm-front`, t);
  const reach = 0.082 * 0.94 * a.scale;
  return [a.x - Math.sin(a.angle) * reach, a.y + Math.cos(a.angle) * reach];
}

describe('the goodbye', () => {
  it('shows nothing before it starts', () => {
    expect(at('goodbye', -1).opacity).toBe(0);
  });

  it('starts exactly on the friend’s flat hand: the same place and size', () => {
    const face = at('goodbye-face', 0.05);
    const part = STORY_STAGE.parts[index('goodbye-face')];
    expect(face.x).toBeCloseTo(GOODBYE_AT[0], 3);
    expect(face.y).toBeCloseTo(GOODBYE_AT[1], 3);
    expect(part.h * face.scale).toBeCloseTo(0.405, 3);
    expect(face.opacity).toBeGreaterThan(0.99);
    // Upright, as the friend's hand is: tilted, it would read as a second hand appearing.
    expect(Math.abs(face.angle)).toBeLessThan(0.01);
  });

  it('keeps each hand at the end of its kid’s arm, palms touching, through the hold and as they part', () => {
    for (let t = 3.5; t < 11; t += 0.25)
      for (const who of ['boy', 'girl']) {
        const h = at(`goodbye-${who}-hand`, t);
        const [ex, ey] = armEnd(`goodbye-${who}`, t);
        expect(Math.hypot(h.x - ex, h.y - ey), `${who} at ${t}`).toBeLessThan(0.006);
      }
    const boy = at('goodbye-boy-hand', 5);
    const girl = at('goodbye-girl-hand', 5);
    expect(boy.x).toBeLessThan(GOODBYE_AT[0]);
    expect(girl.x).toBeCloseTo(-boy.x, 4);
  });

  it('keeps each palm on its own side of the touch as their arms come down (no clipping)', () => {
    const palmFaceOffset = 0.013 * 1.4 * (0.86 - 0.5);
    for (let t = 5; t <= GOODBYE_LENGTH_S; t += 0.05) {
      const boy = at('goodbye-boy-hand', t);
      const girl = at('goodbye-girl-hand', t);
      const boyPalmEdge = boy.x + palmFaceOffset * boy.scale;
      const girlPalmEdge = girl.x - palmFaceOffset * girl.scale;
      expect(boyPalmEdge, `boy palm edge at ${t}`).toBeLessThanOrEqual(GOODBYE_AT[0] + 1e-6);
      expect(girlPalmEdge, `girl palm edge at ${t}`).toBeGreaterThanOrEqual(GOODBYE_AT[0] - 1e-6);
      expect(boyPalmEdge, `palms separated/touching at ${t}`).toBeLessThanOrEqual(girlPalmEdge + 1e-6);
    }
  });

  it('draws back to the kids from the waist up, and leaves the wall empty', () => {
    const boy = at('goodbye-boy-torso', 5);
    expect(boy.y).toBeGreaterThan(-0.56);
    expect(boy.y).toBeLessThan(-0.48);
    expect(at('goodbye-boy', GOODBYE_LENGTH_S).opacity).toBe(0);
    expect(at('goodbye-girl', GOODBYE_LENGTH_S).opacity).toBe(0);
  });

  it('plays the 12 s emotional piano from palm contact across parting and into her fade', () => {
    const piano = (STORY_STAGE.cues ?? []).find(
      (c) => c.kind === 'sound' && c.sound === 'palms' && c.t >= start && c.t <= start + GOODBYE_LENGTH_S,
    );
    expect(piano).toBeDefined();
    expect(piano!.t - start).toBeCloseTo(PALMS_AT_S);
    expect(PALMS_AT_S + PALMS_LEN_S).toBeLessThan(GOODBYE_LENGTH_S);
  });
});
