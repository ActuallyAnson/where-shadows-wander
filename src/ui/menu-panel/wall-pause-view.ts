// High-contrast black-and-white Pause Menu projected directly onto the stage wall.
// Replaces the floating mid-air panel with a wall-scale, crisp paper-cut UI.
// Supports seated pointing, shadow cursor, and pinch / trigger selection.
// Zero allocations per frame. All Three.js objects imported through @iwsdk/core.

import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { JOINT, type HandFrame } from '../../engine/hands/hand';
import { distanceToPlane, type StagePlane } from '../../engine/shadow/pure/stage-plane';

export type PauseMenuAction = 'resume' | 'restart' | 'settings';

export interface PauseButtonDef {
  readonly id: PauseMenuAction;
  readonly label: string;
  readonly yMin: number;
  readonly yMax: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly canvasY: number;
  readonly canvasH: number;
  readonly canvasW: number;
}

export const PAUSE_BUTTONS: readonly PauseButtonDef[] = [
  {
    id: 'resume',
    label: 'Resume',
    yMin: -0.07,
    yMax: 0.03,
    xMin: -0.38,
    xMax: 0.38,
    canvasY: 275,
    canvasH: 70,
    canvasW: 560,
  },
  {
    id: 'restart',
    label: 'Begin this puzzle again',
    yMin: -0.2,
    yMax: -0.1,
    xMin: -0.45,
    xMax: 0.45,
    canvasY: 375,
    canvasH: 70,
    canvasW: 660,
  },
  {
    id: 'settings',
    label: 'Settings',
    yMin: -0.33,
    yMax: -0.23,
    xMin: -0.38,
    xMax: 0.38,
    canvasY: 475,
    canvasH: 70,
    canvasW: 560,
  },
];

const CANVAS_W = 1024;
const CANVAS_H = 640;
const WALL_W = 1.45;
const WALL_H = 0.92;

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

  private _visible = false;
  private hoveredButtonIndex = -1;
  private lastPaintedHover = -2;
  private cursorX = 0;
  private cursorY = 0;
  private cursorVisible = false;
  private pinchArmed = true;

  constructor(customCanvas?: HTMLCanvasElement) {
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
    this.cursorGeometry = new RingGeometry(0.012, 0.022, 24);
    this.cursorMaterial = new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.cursorMesh = new Mesh(this.cursorGeometry, this.cursorMaterial);
    this.cursorMesh.position.set(0, 0, 0.008);
    this.cursorMesh.renderOrder = 2.6;
    this.cursorMesh.visible = false;

    this.group.add(this.wallMesh, this.cursorMesh);
    this.group.visible = false;

    this.paint();
  }

  get visible(): boolean {
    return this._visible;
  }

  show(): void {
    this._visible = true;
    this.group.visible = true;
    this.hoveredButtonIndex = -1;
    this.cursorVisible = false;
    this.pinchArmed = true;
    this.paint();
  }

  hide(): void {
    this._visible = false;
    this.group.visible = false;
    this.cursorMesh.visible = false;
  }

  /**
   * Updates pointer tracking, hover state, and pinch/click detection.
   * Zero per-frame allocations.
   */
  update(hands: readonly HandFrame[], stage: StagePlane, isControllerTriggerPressed = false): PauseMenuAction | null {
    if (!this._visible) return null;

    let hitX = 0;
    let hitY = 0;
    let hasPointer = false;
    let isPinching = false;

    for (let i = 0; i < hands.length; i++) {
      const h = hands[i];
      if (!h.tracked || h.validJoints < 5) continue;
      const p = h.positions;

      const idx = JOINT['index-finger-tip'] * 3;
      const mcp = JOINT['index-finger-metacarpal'] * 3;
      const thmb = JOINT['thumb-tip'] * 3;

      // Index tip world coordinates
      const tx = p[idx];
      const ty = p[idx + 1];
      const tz = p[idx + 2];

      // Pointing vector from knuckle to tip
      let dirX = tx - p[mcp];
      let dirY = ty - p[mcp + 1];
      let dirZ = tz - p[mcp + 2];
      const dirLen = Math.hypot(dirX, dirY, dirZ);

      const dToWall = distanceToPlane(stage, tx, ty, tz);

      if (dirLen > 1e-4) {
        dirX /= dirLen;
        dirY /= dirLen;
        dirZ /= dirLen;

        const normalDot = dirX * stage.normal[0] + dirY * stage.normal[1] + dirZ * stage.normal[2];

        // Ray pointing towards the wall (normalDot < -0.15)
        if (normalDot < -0.15 && dToWall > 0.05) {
          const t = -dToWall / normalDot;
          if (t > 0 && t < 3.0) {
            const wx = tx + dirX * t;
            const wy = ty + dirY * t;
            const wz = tz + dirZ * t;

            const dx = wx - stage.origin[0];
            const dy = wy - stage.origin[1];
            const dz = wz - stage.origin[2];

            hitX = dx * stage.right[0] + dy * stage.right[1] + dz * stage.right[2];
            hitY = dx * stage.up[0] + dy * stage.up[1] + dz * stage.up[2];
            hasPointer = true;
          }
        }
      }

      // Fallback: direct perpendicular projection if pointing Ray wasn't steep enough
      if (!hasPointer && dToWall > 0.01 && dToWall < 1.2) {
        const dx = tx - stage.origin[0] - dToWall * stage.normal[0];
        const dy = ty - stage.origin[1] - dToWall * stage.normal[1];
        const dz = tz - stage.origin[2] - dToWall * stage.normal[2];
        hitX = dx * stage.right[0] + dy * stage.right[1] + dz * stage.right[2];
        hitY = dx * stage.up[0] + dy * stage.up[1] + dz * stage.up[2];
        hasPointer = true;
      }

      // Check pinch gesture
      const pdx = p[idx] - p[thmb];
      const pdy = p[idx + 1] - p[thmb + 1];
      const pdz = p[idx + 2] - p[thmb + 2];
      const pinchDist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
      if (pinchDist < 0.065) {
        isPinching = true;
      }
    }

    if (hasPointer) {
      this.cursorX = hitX;
      this.cursorY = hitY;
      this.cursorMesh.position.set(hitX, hitY, 0.008);
      this.cursorMesh.visible = true;
      this.cursorVisible = true;

      // Check which button is hovered
      let hovered = -1;
      for (let b = 0; b < PAUSE_BUTTONS.length; b++) {
        const btn = PAUSE_BUTTONS[b];
        if (hitX >= btn.xMin && hitX <= btn.xMax && hitY >= btn.yMin && hitY <= btn.yMax) {
          hovered = b;
          break;
        }
      }

      if (hovered !== this.hoveredButtonIndex) {
        this.hoveredButtonIndex = hovered;
        this.paint();
      }
    } else {
      if (this.cursorVisible) {
        this.cursorVisible = false;
        this.cursorMesh.visible = false;
      }
      if (this.hoveredButtonIndex !== -1) {
        this.hoveredButtonIndex = -1;
        this.paint();
      }
    }

    // Trigger activation on pinch or controller button
    const activate = isPinching || isControllerTriggerPressed;
    if (!activate) {
      this.pinchArmed = true;
    }

    if (this.pinchArmed && activate && this.hoveredButtonIndex >= 0) {
      this.pinchArmed = false;
      return PAUSE_BUTTONS[this.hoveredButtonIndex].id;
    }

    return null;
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

    // 2. Title: "PAUSED"
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 48px "Cinzel", "Cinzel Decorative", Georgia, serif';
    g.fillStyle = '#ffffff';
    g.fillText('PAUSED', CANVAS_W * 0.5, 120);

    // Subtitle
    g.font = '400 20px "Cinzel", sans-serif';
    g.fillStyle = '#9ea8bc';
    g.fillText('The candle waits.', CANVAS_W * 0.5, 175);

    // Ornamental thin divider
    g.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(CANVAS_W * 0.5 - 140, 210);
    g.lineTo(CANVAS_W * 0.5 + 140, 210);
    g.stroke();

    // 3. Buttons: High-Contrast Black & White
    for (let b = 0; b < PAUSE_BUTTONS.length; b++) {
      const btn = PAUSE_BUTTONS[b];
      const isHovered = b === this.hoveredButtonIndex;
      const bx = (CANVAS_W - btn.canvasW) * 0.5;
      const by = btn.canvasY;
      const bw = btn.canvasW;
      const bh = btn.canvasH;

      if (isHovered) {
        // Inverted: Solid chalk white background, deep black text
        g.fillStyle = '#ffffff';
        g.fillRect(bx, by, bw, bh);

        g.strokeStyle = '#ffffff';
        g.lineWidth = 3;
        g.strokeRect(bx - 3, by - 3, bw + 6, bh + 6);

        g.font = '700 26px "Cinzel", Georgia, serif';
        g.fillStyle = '#0a0a0f';
        g.fillText(btn.label, CANVAS_W * 0.5, by + bh * 0.5);
      } else {
        // Default: Dark background with crisp white border and white text
        g.fillStyle = '#12151e';
        g.fillRect(bx, by, bw, bh);

        g.strokeStyle = '#7c88a2';
        g.lineWidth = 2;
        g.strokeRect(bx, by, bw, bh);

        g.font = '600 24px "Cinzel", Georgia, serif';
        g.fillStyle = '#e8edf6';
        g.fillText(btn.label, CANVAS_W * 0.5, by + bh * 0.5);
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
  }
}
