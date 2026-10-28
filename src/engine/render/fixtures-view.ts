// The puzzles' fixtures on the stage wall (src/game/fixtures.ts): the castle gate and its
// counterweight plate drawn as black shadow shapes like the props', the lit window at the end of the
// night, and the fan's wind as thin streaks drifting across. The drips need nothing here: the drops
// are entities the StageRenderer draws, and the plant is a prop's shadow.
//
// A simple first look for Teammate B to replace or restyle. Parented to the stage group, so positions
// are stage metres. Meshes and materials are made once; update() moves them and allocates nothing.

import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Object3D } from '@iwsdk/core';
import { SHADOW_RENDER_ORDER } from '../shadow/shadow-renderer';

/** What this view reads of a fixture (the shape of src/game/fixtures.ts's Fixture). */
export interface FixtureLike {
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly active: boolean;
  readonly value: number;
}

export interface FixtureList {
  readonly count: number;
  at(i: number): FixtureLike;
}

/** The most fixtures drawn at once (the game's pool holds 16). */
export const MAX_FIXTURES = 16;
/** Wind streaks drawn across a wind fixture. */
export const WIND_STREAKS = 10;
/** Just in front of the shadows (0.002) and behind the sprites (0.0025). */
const FIXTURE_Z = 0.0022;
const WINDOW_LIT = 0xffc870;
/** Seconds the gate takes to swing up once open. */
const GATE_OPEN_S = 0.6;
/** How far the plate dips under a rock, metres. */
const PLATE_DIP_M = 0.008;
const STREAK_SPEED = 0.6;

export class FixturesView {
  readonly group = new Group();
  private readonly quads: Mesh[] = [];
  private readonly mats: MeshBasicMaterial[] = [];
  private readonly streaks: Mesh[] = [];
  private readonly streakMat: MeshBasicMaterial;
  /** Per fixture slot: how far the gate has swung up, 0..1. */
  private readonly gateOpen = new Float64Array(MAX_FIXTURES);
  private time = 0;

  constructor(parent?: Object3D) {
    const plane = new PlaneGeometry(1, 1);
    for (let i = 0; i < MAX_FIXTURES; i++) {
      const mat = new MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, toneMapped: false });
      const quad = new Mesh(plane, mat);
      quad.renderOrder = SHADOW_RENDER_ORDER + 1;
      quad.frustumCulled = false;
      quad.visible = false;
      this.mats.push(mat);
      this.quads.push(quad);
      this.group.add(quad);
    }
    this.streakMat = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    for (let i = 0; i < WIND_STREAKS; i++) {
      const streak = new Mesh(plane, this.streakMat);
      streak.renderOrder = SHADOW_RENDER_ORDER + 1;
      streak.frustumCulled = false;
      streak.visible = false;
      this.streaks.push(streak);
      this.group.add(streak);
    }
    if (parent) parent.add(this.group);
  }

  /**
   * Once a frame. `opacity` is the shadows' (the candle's occlusion times the base opacity), so the
   * fixtures fade with the hands' and props' shadows; the lit window keeps its own light.
   */
  update(fixtures: FixtureList, opacity: number, dt: number): void {
    this.time += dt;
    const n = Math.min(fixtures.count, MAX_FIXTURES);
    let windDrawn = false;
    for (let i = 0; i < MAX_FIXTURES; i++) {
      const quad = this.quads[i];
      if (i >= n) {
        quad.visible = false;
        this.gateOpen[i] = 0;
        continue;
      }
      const f = fixtures.at(i);
      const mat = this.mats[i];
      quad.visible = true;
      quad.position.set(f.x, f.y, FIXTURE_Z);
      quad.scale.set(Math.max(f.w, 0.001), Math.max(f.h, 0.001), 1);
      switch (f.kind) {
        case 'gate': {
          // Shut: a black bar across the doorway. Open: it swings up out of the way.
          const target = f.active ? 0 : 1;
          const o = this.gateOpen[i] + Math.sign(target - this.gateOpen[i]) * Math.min(dt / GATE_OPEN_S, 1);
          this.gateOpen[i] = Math.min(1, Math.max(0, o));
          quad.position.y = f.y + this.gateOpen[i] * f.h * 0.9;
          mat.color.setHex(0x000000);
          mat.opacity = opacity;
          break;
        }
        case 'plate':
          quad.position.y = f.y - f.value * PLATE_DIP_M;
          mat.color.setHex(0x000000);
          mat.opacity = opacity;
          break;
        case 'window':
          mat.color.setHex(f.active ? WINDOW_LIT : 0x000000);
          mat.opacity = f.active ? 0.9 : opacity * 0.6;
          break;
        case 'wind':
          quad.visible = false;
          if (!windDrawn) this.drawWind(f, opacity);
          windDrawn = true;
          break;
        default:
          // The drips' source and anything newer: nothing to draw yet.
          quad.visible = false;
      }
    }
    if (!windDrawn) for (const s of this.streaks) s.visible = false;
  }

  /** Thin streaks blowing from right to left through the wind's box, fainter when sheltered. */
  private drawWind(f: FixtureLike, opacity: number): void {
    const left = f.x - f.w / 2;
    this.streakMat.opacity = opacity * 0.35 * Math.max(0, Math.min(1, f.value));
    for (let i = 0; i < WIND_STREAKS; i++) {
      const s = this.streaks[i];
      // Each streak has its own lane and phase, from its index: the same every frame, no random numbers.
      const lane = ((i * 0.618034) % 1) * 0.8 + 0.1;
      const phase = (i * 0.381966) % 1;
      const len = 0.06 + 0.05 * ((i * 0.7548) % 1);
      const travel = (phase + (this.time * STREAK_SPEED) / f.w) % 1;
      s.visible = this.streakMat.opacity > 0.001;
      s.position.set(left + f.w * (1 - travel), f.y - f.h / 2 + lane * f.h, FIXTURE_Z);
      s.scale.set(len, 0.004, 1);
    }
  }

  hide(): void {
    this.group.visible = false;
  }

  show(): void {
    this.group.visible = true;
  }
}
