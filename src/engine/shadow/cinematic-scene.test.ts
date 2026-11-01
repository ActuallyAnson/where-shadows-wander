import { describe, expect, it } from 'vitest';
import { CinematicScene } from './cinematic-scene';
import {
  CRYSTAL,
  DUSK,
  paintCaption,
  paintCastle,
  paintFloorTile,
  paintPillar,
  paintSky,
  paintStreak,
  paintSun,
} from './cinematic-art';

/** A 2D context that accepts any call and counts the drawing ones, with gradients that take colour stops. */
function recordingContext(): { g: CanvasRenderingContext2D; calls: () => number } {
  let n = 0;
  const store: Record<string | symbol, unknown> = { measureText: () => ({ width: 100 }) };
  const g = new Proxy(store, {
    get(t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'measureText') return () => ({ width: 100 });
      if (prop in t) return t[prop];
      return () => {
        n++;
      };
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { g, calls: () => n };
}

describe('cinematic paintings', () => {
  it.each([
    ['sky', (g: CanvasRenderingContext2D) => paintSky(g, 8, 256, DUSK), 20],
    ['sun', (g: CanvasRenderingContext2D) => paintSun(g, 256, 256, DUSK), 10],
    ['castle', (g: CanvasRenderingContext2D) => paintCastle(g, 512, 205), 20],
    ['floor tile', (g: CanvasRenderingContext2D) => paintFloorTile(g, 256, 256, CRYSTAL), 20],
    ['streak', (g: CanvasRenderingContext2D) => paintStreak(g, 128, 512, DUSK), 100],
    ['pillar', (g: CanvasRenderingContext2D) => paintPillar(g, 128, 512, DUSK, 41), 10],
    ['caption', (g: CanvasRenderingContext2D) => paintCaption(g, 1024, 128, 'One spark is left.'), 2],
  ])('paints the %s without throwing, and draws something', (_name, paint, min) => {
    const { g, calls } = recordingContext();
    expect(() => paint(g)).not.toThrow();
    expect(calls()).toBeGreaterThan(min);
  });
});

describe('CinematicScene', () => {
  it('is hidden until it is entered, and hidden again when it is left', () => {
    const scene = new CinematicScene();
    expect(scene.group.visible).toBe(false);
    scene.enter({ x: 1, y: 1.2, z: 2 }, 0, -1);
    expect(scene.group.visible).toBe(true);
    expect(scene.group.position.y).toBe(1.2);
    scene.leave();
    expect(scene.group.visible).toBe(false);
    scene.dispose();
  });

  it('holds no meshes or textures until it is entered, and frees them all when it is left', () => {
    const scene = new CinematicScene();
    expect(scene.isBuilt).toBe(false);
    expect(scene.group.children).toHaveLength(0);
    scene.enter({ x: 0, y: 1.2, z: 0 }, 0, -1);
    expect(scene.isBuilt).toBe(true);
    expect(scene.group.children.length).toBeGreaterThan(5);
    scene.leave();
    expect(scene.isBuilt).toBe(false);
    expect(scene.group.children).toHaveLength(0);
    expect(() => {
      scene.update(0.1);
      scene.setSkipProgress(0.5);
      scene.setReelTime(3);
      scene.show('hello', { write: 1, hold: 1 });
    }).not.toThrow();
    scene.enter({ x: 0, y: 1.2, z: 0 }, 0, -1); // and can be entered again
    expect(scene.group.children.length).toBeGreaterThan(5);
    scene.dispose();
  });

  it('faces the way the head faces', () => {
    const scene = new CinematicScene();
    scene.enter({ x: 0, y: 1.2, z: 0 }, 0, -1); // looking down -z: no turn
    expect(Math.abs(scene.group.rotation.y)).toBeLessThan(1e-9);
    scene.enter({ x: 0, y: 1.2, z: 0 }, 1, 0); // looking along +x: the scene's front (-z) turns to +x
    const front = { x: -Math.sin(scene.group.rotation.y), z: -Math.cos(scene.group.rotation.y) };
    expect(front.x).toBeCloseTo(1, 5);
    expect(front.z).toBeCloseTo(0, 5);
    scene.dispose();
  });

  it('floats a line of words, fades it in and out, and is done when it is over', () => {
    const scene = new CinematicScene();
    scene.enter({ x: 0, y: 1.2, z: 0 }, 0, -1);
    expect(scene.playing).toBe(false);
    scene.show('One spark is left, small as a held breath.', { write: 3, hold: 1 });
    expect(scene.playing).toBe(true);
    for (let i = 0; i < 200 && scene.playing; i++) scene.update(0.05);
    expect(scene.playing).toBe(false);
    scene.show('again', { write: 1, hold: 0 });
    scene.clear();
    expect(scene.playing).toBe(false);
    scene.dispose();
  });

  it('ignores a frame time that is negative or not a number, and does nothing while hidden', () => {
    const scene = new CinematicScene();
    expect(() => scene.update(0.1)).not.toThrow(); // hidden
    scene.enter({ x: 0, y: 1.2, z: 0 }, 0, -1);
    expect(() => {
      scene.update(-1);
      scene.update(NaN);
    }).not.toThrow();
    scene.dispose();
  });
});

describe('the opening reel', () => {
  const opacities = (scene: CinematicScene) =>
    scene.group.children.map((c) => (c as unknown as { material?: { opacity?: number } }).material?.opacity ?? -1);
  // The five wisps are the meshes drawn at the glow order + 1 (after the streak); find them by their colour tint instead: they are the
  // only five with a coloured material that starts invisible and fades in. Here: count meshes that are visible at 6 s but not at 0 s.
  it('is a pure function of the time: the lights come up, go out last-first, the traveller walks in, and the title appears', () => {
    const scene = new CinematicScene();
    scene.enter({ x: 0, y: 1.2, z: 0 }, 0, -1);
    const at = (r: number) => {
      scene.setReelTime(r);
      return opacities(scene);
    };
    const start = at(0);
    const lit = at(6);
    const out = at(11.5);
    const title = at(18);
    const rose = lit.filter((o, i) => o > 0.3 && start[i] < 0.05).length;
    expect(rose).toBeGreaterThanOrEqual(5); // the five lights came up
    const stillLit = out.filter((o, i) => lit[i] > 0.3 && start[i] < 0.05 && o > 0.3).length;
    expect(stillLit).toBeLessThan(rose); // and the lights are out by 11.5 s
    expect(title.filter((o, i) => o > 0.5 && out[i] < 0.05).length).toBeGreaterThanOrEqual(2); // the title and its line
    const traveller = scene.group.children.find(
      (c) => Math.abs((c as unknown as { position: { z: number } }).position.z + 6) < 0.01,
    );
    scene.setReelTime(3);
    const x3 = (traveller as unknown as { position: { x: number } }).position.x;
    scene.setReelTime(6);
    const x6 = (traveller as unknown as { position: { x: number } }).position.x;
    scene.setReelTime(9);
    const x9 = (traveller as unknown as { position: { x: number } }).position.x;
    expect(x6).toBeGreaterThan(x3);
    expect(x9).toBeGreaterThan(x6);
    expect(() => {
      scene.setReelTime(-4);
      scene.setReelTime(NaN);
      scene.setReelTime(1e9);
    }).not.toThrow();
    scene.dispose();
  });

  it('does nothing in the hall, which has no reel', () => {
    const hall = new CinematicScene(CRYSTAL, 'hall');
    expect(() => hall.setReelTime(5)).not.toThrow();
    hall.dispose();
  });
});
