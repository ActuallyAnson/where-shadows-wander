import { describe, expect, it } from 'vitest';
import { POSE_STRIDE, validateScene } from './puppet-scene';
import { EMBER_S, PATH_Y, PROLOGUE_SCENE, WALK_TO_S, WISP_OUT_FROM_S } from './prologue-scene';
import { ScenePlayer } from './scene-player';

const index = (id: string) => PROLOGUE_SCENE.parts.findIndex((p) => p.id === id);
const pose = (p: ScenePlayer, id: string, prop: number) => p.world[index(id) * POSE_STRIDE + prop];

describe('the prologue', () => {
  it('is a sound scene', () => {
    expect(validateScene(PROLOGUE_SCENE)).toEqual([]);
  });

  it('puts each light out, last sleeper first', () => {
    const p = new ScenePlayer(PROLOGUE_SCENE);
    p.seek(5);
    for (let i = 0; i < 5; i++) expect(pose(p, `wisp-${i}`, 4)).toBeGreaterThan(0.5);
    p.seek(WISP_OUT_FROM_S + 0.7);
    expect(pose(p, 'wisp-4', 4)).toBe(0);
    expect(pose(p, 'wisp-0', 4)).toBeGreaterThan(0.5);
    p.seek(EMBER_S - 0.5);
    for (let i = 0; i < 5; i++) expect(pose(p, `wisp-${i}`, 4)).toBe(0);
  });

  it('walks the traveller in along the path and stops it on the stage', () => {
    const p = new ScenePlayer(PROLOGUE_SCENE);
    p.seek(WALK_TO_S + 1);
    expect(pose(p, 'traveller', 0)).toBeGreaterThan(-0.8); // inside the 1.6 m stage
    expect(pose(p, 'traveller', 1)).toBeCloseTo(PATH_Y);
  });

  it('lights the ember after the lights are out, and ends off the wall', () => {
    const p = new ScenePlayer(PROLOGUE_SCENE);
    p.seek(EMBER_S - 0.3);
    expect(pose(p, 'ember', 4)).toBe(0);
    p.seek(EMBER_S + 1.5);
    expect(pose(p, 'ember', 4)).toBeGreaterThan(0.5);
    p.seek(PROLOGUE_SCENE.length);
    for (const part of PROLOGUE_SCENE.parts) expect(p.world[index(part.id) * POSE_STRIDE + 4]).toBeCloseTo(0, 3);
  });

  it('plays through at 72 Hz with every pose finite', () => {
    const p = new ScenePlayer(PROLOGUE_SCENE);
    p.start();
    let bad = 0;
    while (p.playing) {
      p.update(1 / 72);
      for (let i = 0; i < p.world.length; i++) if (!Number.isFinite(p.world[i])) bad++;
    }
    expect(bad).toBe(0);
  });
});
