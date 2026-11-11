// High-contrast black-and-white Pause & Settings Menu projected directly onto the stage wall.
// Replaces the floating mid-air panel with a wall-scale, crisp paper-cut UI.
// Supports seated pointing, shadow cursor, 3-second hover dwell selection, and controller trigger.
// Zero allocations per frame. All Three.js objects imported through @iwsdk/core.

import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { JOINT, type HandFrame } from '../../engine/hands/hand';
import { distanceToPlane, type StagePlane } from '../../engine/shadow/pure/stage-plane';
import type { SettingsStore } from '../../engine/services/settings/settings-store';

export type PauseMenuAction = 'resume' | 'settings' | 'developer';
export type WallMenuMode = 'pause' | 'settings';

export interface WallButtonDef {
  readonly id: string;
  readonly label: string | ((store: SettingsStore | null) => string);
  readonly yMin: number;
  readonly yMax: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly canvasY: number;
  readonly canvasH: number;
  readonly canvasW: number;
}

export const PAUSE_BUTTONS: readonly WallButtonDef[] = [
  {
    id: 'resume',
    label: 'Light the candle',
    yMin: -0.07,
    yMax: 0.03,
    xMin: -0.38,
    xMax: 0.38,
    canvasY: 275,
    canvasH: 70,
    canvasW: 560,
  },
  {
    id: 'settings',
    label: 'Settings',
    yMin: -0.2,
    yMax: -0.1,
    xMin: -0.38,
    xMax: 0.38,
    canvasY: 375,
    canvasH: 70,
    canvasW: 560,
  },
];

/** The pause screen's third button in debug builds: opens the Developer page (src/app/developer-page.ts) in the room. */
export const DEVELOPER_BUTTON: WallButtonDef = {
  id: 'developer',
  label: 'Developer',
  yMin: -0.33,
  yMax: -0.23,
  xMin: -0.38,
  xMax: 0.38,
  canvasY: 475,
  canvasH: 70,
  canvasW: 560,
};

export interface WallPauseOptions {
  /** Adds the Developer button under Settings (debug builds only). */
  developer?: boolean;
}

export const SETTINGS_BUTTONS: readonly WallButtonDef[] = [
  {
    id: 'setting_volume',
    label: (store) => `Master Volume: ${Math.round((store?.value.volumeMaster ?? 1) * 100)}%`,
    yMin: 0.08,
    yMax: 0.18,
    xMin: -0.45,
    xMax: 0.45,
    canvasY: 180,
    canvasH: 58,
    canvasW: 660,
  },
  {
    id: 'setting_music',
    label: (store) => `Music: ${(store?.value.volumeMusic ?? 1) > 0 ? 'On' : 'Off'}`,
    yMin: -0.04,
    yMax: 0.06,
    xMin: -0.45,
    xMax: 0.45,
    canvasY: 260,
    canvasH: 58,
    canvasW: 660,
  },
  {
    id: 'setting_contrast',
    label: (store) => `High Contrast: ${store?.value.highContrast ? 'On' : 'Off'}`,
    yMin: -0.16,
    yMax: -0.06,
    xMin: -0.45,
    xMax: 0.45,
    canvasY: 340,
    canvasH: 58,
    canvasW: 660,
  },
  {
    id: 'setting_flicker',
    label: (store) => `Lantern Flicker: ${store?.value.flicker ? 'On' : 'Off'}`,
    yMin: -0.28,
    yMax: -0.18,
    xMin: -0.45,
    xMax: 0.45,
    canvasY: 420,
    canvasH: 58,
    canvasW: 660,
  },
  {
    id: 'setting_back',
    label: 'Back',
    yMin: -0.4,
    yMax: -0.3,
    xMin: -0.32,
    xMax: 0.32,
    canvasY: 505,
    canvasH: 58,
    canvasW: 460,
  },
];

const CANVAS_W = 1024;
const CANVAS_H = 640;
const WALL_W = 1.45;
const WALL_H = 0.92;
export const DWELL_SELECTION_S = 3.0;
/** A pointer that slips off a button for less than this (hand jitter, tracking dropping a frame) keeps the dwell it had built up. */
export const HOVER_GRACE_S = 0.5;

export class WallPauseView {
  readonly group = new Group();

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly texture: CanvasTexture;
  private readonly wallGeometry: PlaneGeometry;
  private readonly wallMaterial: MeshBasicMaterial;
  private readonly wallMesh: Mesh;

  // Pointer cursor dot on the wall
  private readonly cursorGeometry: RingGeometry;
  private readonly cursorMaterial: MeshBasicMaterial;
  private readonly cursorMesh: Mesh;

  // Sleek laser pointer beam connecting index fingertip to the wall
  private readonly beamGeometry: CylinderGeometry;
  private readonly beamMaterial: MeshBasicMaterial;
  private readonly beamMesh: Mesh;

  private _visible = false;
  private _mode: WallMenuMode = 'pause';
  private hoveredButtonIndex = -1;
  private hoverDwellTime = 0;
  /** Seconds the pointer has been off the hovered button (it keeps the hover until this passes HOVER_GRACE_S). */
  private hoverAwayTime = 0;
  private lastPaintKey = -1;
  private cursorX = 0;
  private cursorY = 0;
  private cursorVisible = false;
  private prevControllerTrigger = false;

  private settingsStore: SettingsStore | null = null;
  private readonly pauseButtons: readonly WallButtonDef[];

  // Scratch vectors for zero allocation beam orientation
  private readonly beamStart = new Vector3();
  private readonly beamEnd = new Vector3();
  private readonly beamMid = new Vector3();
  private readonly beamDir = new Vector3();
  private readonly beamQuat = new Quaternion();
  private readonly upVec = new Vector3(0, 1, 0);

  constructor(customCanvas?: HTMLCanvasElement, options: WallPauseOptions = {}) {
    this.pauseButtons = options.developer ? [...PAUSE_BUTTONS, DEVELOPER_BUTTON] : PAUSE_BUTTONS;
    let cvs = customCanvas;
    if (!cvs && typeof document !== 'undefined') {
      cvs = document.createElement('canvas');
    }
    if (!cvs) {
      cvs = {
        width: CANVAS_W,
        height: CANVAS_H,
        getContext: () => null,
      } as unknown as HTMLCanvasElement;
    }
    cvs.width = CANVAS_W;
    cvs.height = CANVAS_H;
    this.canvas = cvs;
    this.ctx = cvs.getContext ? cvs.getContext('2d') : null;

    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;

    // 1. Wall Panel Mesh: attached directly to stageGroup at Z = +0.005
    this.wallGeometry = new PlaneGeometry(WALL_W, WALL_H);
    this.wallMaterial = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    });
    this.wallMesh = new Mesh(this.wallGeometry, this.wallMaterial);
    this.wallMesh.position.set(0, 0, 0.005);
    this.wallMesh.renderOrder = 2.5;

    // 2. Cursor Mesh: ring with glowing dot
    this.cursorGeometry = new RingGeometry(0.012, 0.024, 24);
    this.cursorMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.cursorMesh = new Mesh(this.cursorGeometry, this.cursorMaterial);
    this.cursorMesh.position.set(0, 0, 0.008);
    this.cursorMesh.renderOrder = 2.6;
    this.cursorMesh.visible = false;

    // 3. Pointer Beam Mesh: slender white beam
    this.beamGeometry = new CylinderGeometry(0.0018, 0.0018, 1.0, 6);
    this.beamMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    this.beamMesh = new Mesh(this.beamGeometry, this.beamMaterial);
    this.beamMesh.renderOrder = 2.6;
    this.beamMesh.visible = false;

    this.group.add(this.wallMesh, this.cursorMesh, this.beamMesh);
    this.group.visible = false;

    this.paint();
  }

  get visible(): boolean {
    return this._visible;
  }

  get mode(): WallMenuMode {
    return this._mode;
  }

  setSettingsStore(store: SettingsStore): void {
    this.settingsStore = store;
  }

  show(): void {
    this._visible = true;
    this._mode = 'pause';
    this.group.visible = true;
    this.hoveredButtonIndex = -1;
    this.hoverAwayTime = 0;
    this.hoverDwellTime = 0;
    this.cursorVisible = false;
    this.beamMesh.visible = false;
    this.prevControllerTrigger = false;
    this.paint();
  }

  showSettings(): void {
    this._visible = true;
    this._mode = 'settings';
    this.group.visible = true;
    this.hoveredButtonIndex = -1;
    this.hoverAwayTime = 0;
    this.hoverDwellTime = 0;
    this.cursorVisible = false;
    this.beamMesh.visible = false;
    this.prevControllerTrigger = false;
    this.paint();
  }

  hide(): void {
    this._visible = false;
    this.group.visible = false;
    this.cursorMesh.visible = false;
    this.beamMesh.visible = false;
    this.hoveredButtonIndex = -1;
    this.hoverAwayTime = 0;
    this.hoverDwellTime = 0;
  }

  /**
   * Follows what the pointer is over. Moving to another button starts its dwell over; slipping off the button for a moment
   * (under HOVER_GRACE_S) keeps the dwell, so a jittery hand does not have to start the three seconds again. Repaints only
   * when the highlighted button or the countdown's tenth of a second changes.
   */
  private trackHover(hovered: number, delta: number): void {
    if (hovered === this.hoveredButtonIndex && hovered >= 0) {
      this.hoverAwayTime = 0;
      this.hoverDwellTime += delta;
    } else if (hovered < 0 && this.hoveredButtonIndex >= 0) {
      this.hoverAwayTime += delta;
      if (this.hoverAwayTime >= HOVER_GRACE_S) {
        this.hoveredButtonIndex = -1;
        this.hoverAwayTime = 0;
        this.hoverDwellTime = 0;
      }
    } else if (hovered !== this.hoveredButtonIndex) {
      this.hoveredButtonIndex = hovered;
      this.hoverDwellTime = hovered >= 0 ? delta : 0;
      this.hoverAwayTime = 0;
    }
    const key = this.hoveredButtonIndex * 1000 + Math.floor(this.hoverDwellTime * 10);
    if (key !== this.lastPaintKey) {
      this.lastPaintKey = key;
      this.paint();
    }
  }

  /**
   * Updates pointer tracking, hover state, and 3-second dwell / trigger selection.
   * Zero per-frame allocations.
   */
  update(
    hands: readonly HandFrame[],
    stage: StagePlane,
    isControllerTriggerPressed = false,
    delta = 0.016,
  ): PauseMenuAction | null {
    if (!this._visible) return null;

    let hitX = 0;
    let hitY = 0;
    let hasPointer = false;

    let pointerWorldX = 0;
    let pointerWorldY = 0;
    let pointerWorldZ = 0;

    let hitWorldX = 0;
    let hitWorldY = 0;
    let hitWorldZ = 0;

    for (let i = 0; i < hands.length; i++) {
      const h = hands[i];
      if (!h.tracked || h.validJoints < 5) continue;
      const p = h.positions;

      const idx = JOINT['index-finger-tip'] * 3;
      const mcp = JOINT['index-finger-metacarpal'] * 3;
      const wrist = JOINT['wrist'] * 3;

      // Index tip world coordinates
      const tx = p[idx];
      const ty = p[idx + 1];
      const tz = p[idx + 2];

      // Pointing vector: prefer wrist -> index tip; fallback to mcp -> tip if wrist is at origin
      let dirX = tx - p[wrist];
      let dirY = ty - p[wrist + 1];
      let dirZ = tz - p[wrist + 2];
      let dirLen = Math.hypot(dirX, dirY, dirZ);

      if (dirLen > 1.5 || (p[wrist] === 0 && p[wrist + 1] === 0 && p[wrist + 2] === 0 && (tx !== 0 || ty !== 0))) {
        dirX = tx - p[mcp];
        dirY = ty - p[mcp + 1];
        dirZ = tz - p[mcp + 2];
        dirLen = Math.hypot(dirX, dirY, dirZ);
      }

      const dToWall = distanceToPlane(stage, tx, ty, tz);

      if (dirLen > 1e-4) {
        dirX /= dirLen;
        dirY /= dirLen;
        dirZ /= dirLen;

        const normalDot = dirX * stage.normal[0] + dirY * stage.normal[1] + dirZ * stage.normal[2];

        // Ray pointing towards the wall
        if (normalDot < -0.12 && dToWall > 0.04) {
          const t = -dToWall / normalDot;
          if (t > 0 && t < 3.5) {
            const wx = tx + dirX * t;
            const wy = ty + dirY * t;
            const wz = tz + dirZ * t;

            const dx = wx - stage.origin[0];
            const dy = wy - stage.origin[1];
            const dz = wz - stage.origin[2];

            hitX = dx * stage.right[0] + dy * stage.right[1] + dz * stage.right[2];
            hitY = dx * stage.up[0] + dy * stage.up[1] + dz * stage.up[2];
            hitWorldX = wx;
            hitWorldY = wy;
            hitWorldZ = wz;
            pointerWorldX = tx;
            pointerWorldY = ty;
            pointerWorldZ = tz;
            hasPointer = true;
          }
        }
      }

      // Fallback: direct perpendicular projection
      if (!hasPointer && dToWall > 0.01 && dToWall < 1.4) {
        const dx = tx - stage.origin[0] - dToWall * stage.normal[0];
        const dy = ty - stage.origin[1] - dToWall * stage.normal[1];
        const dz = tz - stage.origin[2] - dToWall * stage.normal[2];
        hitX = dx * stage.right[0] + dy * stage.right[1] + dz * stage.right[2];
        hitY = dx * stage.up[0] + dy * stage.up[1] + dz * stage.up[2];
        hitWorldX = tx - dToWall * stage.normal[0];
        hitWorldY = ty - dToWall * stage.normal[1];
        hitWorldZ = tz - dToWall * stage.normal[2];
        pointerWorldX = tx;
        pointerWorldY = ty;
        pointerWorldZ = tz;
        hasPointer = true;
      }
    }

    const currentButtons = this._mode === 'settings' ? SETTINGS_BUTTONS : this.pauseButtons;

    if (hasPointer) {
      this.cursorX = hitX;
      this.cursorY = hitY;
      this.cursorMesh.position.set(hitX, hitY, 0.008);
      this.cursorMesh.visible = true;
      this.cursorVisible = true;

      // Position and orient laser beam in local stage space
      this.beamStart.set(pointerWorldX, pointerWorldY, pointerWorldZ);
      this.group.worldToLocal(this.beamStart);
      this.beamEnd.set(hitWorldX, hitWorldY, hitWorldZ);
      this.group.worldToLocal(this.beamEnd);

      this.beamMid.addVectors(this.beamStart, this.beamEnd).multiplyScalar(0.5);
      this.beamMesh.position.copy(this.beamMid);

      this.beamDir.subVectors(this.beamEnd, this.beamStart);
      const beamLen = this.beamDir.length();
      if (beamLen > 0.05) {
        this.beamMesh.scale.set(1.0, beamLen, 1.0);
        this.beamDir.normalize();
        this.beamQuat.setFromUnitVectors(this.upVec, this.beamDir);
        this.beamMesh.quaternion.copy(this.beamQuat);
        this.beamMesh.visible = true;
      } else {
        this.beamMesh.visible = false;
      }

      // Check which button is hovered
      let hovered = -1;
      for (let b = 0; b < currentButtons.length; b++) {
        const btn = currentButtons[b];
        if (hitX >= btn.xMin && hitX <= btn.xMax && hitY >= btn.yMin && hitY <= btn.yMax) {
          hovered = b;
          break;
        }
      }

      this.trackHover(hovered, delta);
    } else {
      if (this.cursorVisible) {
        this.cursorVisible = false;
        this.cursorMesh.visible = false;
        this.beamMesh.visible = false;
      }
      this.trackHover(-1, delta);
    }

    // Trigger activation on 3-second hover dwell OR immediate controller trigger
    const triggerClicked = isControllerTriggerPressed && !this.prevControllerTrigger;
    this.prevControllerTrigger = isControllerTriggerPressed;

    const dwellComplete = this.hoveredButtonIndex >= 0 && this.hoverDwellTime >= DWELL_SELECTION_S;

    if ((dwellComplete || triggerClicked) && this.hoveredButtonIndex >= 0) {
      const btn = currentButtons[this.hoveredButtonIndex];
      this.hoverDwellTime = 0;

      if (this._mode === 'settings') {
        this.handleSettingsAction(btn.id);
        return null;
      }

      // Pause mode
      if (btn.id === 'settings') {
        this._mode = 'settings';
        this.hoveredButtonIndex = -1;
        this.hoverAwayTime = 0;
        this.paint();
        return null;
      }

      return btn.id as PauseMenuAction;
    }

    return null;
  }

  private handleSettingsAction(btnId: string): void {
    if (!this.settingsStore) {
      if (btnId === 'setting_back') {
        this._mode = 'pause';
        this.hoveredButtonIndex = -1;
        this.hoverAwayTime = 0;
        this.paint();
      }
      return;
    }

    const store = this.settingsStore;
    switch (btnId) {
      case 'setting_volume': {
        const cur = store.value.volumeMaster;
        const next = cur <= 0.05 ? 1.0 : cur <= 0.25 ? 0.0 : cur <= 0.5 ? 0.25 : cur <= 0.75 ? 0.5 : 0.75;
        store.set('volumeMaster', next);
        break;
      }
      case 'setting_music': {
        const cur = store.value.volumeMusic;
        store.set('volumeMusic', cur > 0 ? 0 : 1);
        break;
      }
      case 'setting_contrast': {
        store.set('highContrast', !store.value.highContrast);
        break;
      }
      case 'setting_flicker': {
        store.set('flicker', !store.value.flicker);
        break;
      }
      case 'setting_back': {
        this._mode = 'pause';
        this.hoveredButtonIndex = -1;
        this.hoverAwayTime = 0;
        break;
      }
    }

    this.paint();
  }

  private paint(): void {
    if (!this.ctx) return;
    const g = this.ctx;

    // 1. Deep charcoal/black paper background with soft border vignette
    g.fillStyle = '#08090d';
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Decorative inner border line
    g.strokeStyle = '#2d3345';
    g.lineWidth = 2;
    g.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);

    const isSettings = this._mode === 'settings';

    // 2. Title & Subtitle
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 48px "Cinzel", "Cinzel Decorative", Georgia, serif';
    g.fillStyle = '#ffffff';
    g.fillText(isSettings ? 'SETTINGS' : 'PAUSED', CANVAS_W * 0.5, isSettings ? 80 : 120);

    g.font = '400 20px "Cinzel", sans-serif';
    g.fillStyle = '#9ea8bc';
    g.fillText(isSettings ? 'Sound & Comfort' : 'The candle waits.', CANVAS_W * 0.5, isSettings ? 125 : 175);

    // Ornamental thin divider
    g.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    g.lineWidth = 1.5;
    g.beginPath();
    const dividerY = isSettings ? 150 : 210;
    g.moveTo(CANVAS_W * 0.5 - 160, dividerY);
    g.lineTo(CANVAS_W * 0.5 + 160, dividerY);
    g.stroke();

    // 3. Buttons: High-Contrast Black & White with 3-second golden hover progress
    const buttons = isSettings ? SETTINGS_BUTTONS : this.pauseButtons;

    for (let b = 0; b < buttons.length; b++) {
      const btn = buttons[b];
      const isHovered = b === this.hoveredButtonIndex;
      const bx = (CANVAS_W - btn.canvasW) * 0.5;
      const by = btn.canvasY;
      const bw = btn.canvasW;
      const bh = btn.canvasH;

      const labelText = typeof btn.label === 'function' ? btn.label(this.settingsStore) : btn.label;

      if (isHovered) {
        // Inverted: Solid chalk white background, deep black text
        g.fillStyle = '#ffffff';
        g.fillRect(bx, by, bw, bh);

        g.strokeStyle = '#ffffff';
        g.lineWidth = 3;
        g.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);

        // 3-second hover dwell progress bar
        const progress = Math.min(1.0, this.hoverDwellTime / DWELL_SELECTION_S);
        if (progress > 0) {
          g.fillStyle = '#f5c062'; // Warm golden flame fill
          g.fillRect(bx, by + bh - 8, bw * progress, 8);
        }

        g.font = '700 24px "Cinzel", Georgia, serif';
        g.fillStyle = '#0a0a0f';
        g.fillText(labelText, CANVAS_W * 0.5, by + (bh - 4) * 0.5);

        // Countdown prompt
        if (progress > 0.05) {
          const remaining = Math.max(0, DWELL_SELECTION_S - this.hoverDwellTime).toFixed(1);
          g.font = '600 13px "Cinzel", sans-serif';
          g.fillStyle = '#7a5200';
          g.fillText(`Hold ${remaining}s`, bx + bw - 65, by + (bh - 4) * 0.5);
        }
      } else {
        // Default: Dark background with crisp white border and white text
        g.fillStyle = '#12151e';
        g.fillRect(bx, by, bw, bh);

        g.strokeStyle = '#7c88a2';
        g.lineWidth = 2;
        g.strokeRect(bx, by, bw, bh);

        g.font = '600 23px "Cinzel", Georgia, serif';
        g.fillStyle = '#e8edf6';
        g.fillText(labelText, CANVAS_W * 0.5, by + bh * 0.5);
      }
    }

    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.wallGeometry.dispose();
    this.wallMaterial.dispose();
    this.texture.dispose();
    this.cursorGeometry.dispose();
    this.cursorMaterial.dispose();
    this.beamGeometry.dispose();
    this.beamMaterial.dispose();
  }
}
