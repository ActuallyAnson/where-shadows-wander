// Floating VR title emblem in world space above the tray.
// Dissolves into mist upon candle ignition.
// Belongs to Teammate B's UI domain (src/ui/title-screen).
// Zero per-frame allocations.
import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Quaternion,
} from '@iwsdk/core';

export const VR_TITLE_WIDTH_M = 0.75;
export const VR_TITLE_HEIGHT_M = 0.4;
export const DISSOLVE_DURATION_S = 1.0;

function createTitleCanvas(customCanvas?: HTMLCanvasElement): HTMLCanvasElement {
  let canvas = customCanvas;
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
  }
  if (!canvas) {
    canvas = {
      width: 512,
      height: 256,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
  }

  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Decorative diamond / star emblem at top
    ctx.fillStyle = '#ffcf70';
    ctx.beginPath();
    const cx = 256;
    const cy = 48;
    ctx.moveTo(cx, cy - 18);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 18);
    ctx.lineTo(cx - 12, cy);
    ctx.closePath();
    ctx.fill();

    // Side flourishes
    ctx.strokeStyle = 'rgba(255, 207, 112, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 120, cy);
    ctx.lineTo(cx - 24, cy);
    ctx.moveTo(cx + 24, cy);
    ctx.lineTo(cx + 120, cy);
    ctx.stroke();

    // Main Title: "WHERE SHADOWS WANDER"
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 28px serif, Georgia, "Cinzel Decorative"';
    ctx.fillStyle = '#ffebcc';
    ctx.shadowColor = 'rgba(255, 170, 60, 0.6)';
    ctx.shadowBlur = 14;
    ctx.fillText('WHERE SHADOWS WANDER', cx, 116);
    ctx.shadowBlur = 0;

    // Subtitle / Ritual Prompt
    ctx.font = '400 16px sans-serif, "Cinzel", serif';
    ctx.fillStyle = '#ffc885';
    ctx.fillText('Touch or pinch the candle to begin', cx, 172);

    // Bottom soft flourish line
    ctx.strokeStyle = 'rgba(255, 200, 130, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 60, 205);
    ctx.lineTo(cx + 60, 205);
    ctx.stroke();
  }
  return canvas;
}

export class VrTitleView {
  readonly group = new Group();
  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;
  private readonly texture: CanvasTexture;
  private readonly mesh: Mesh;

  private dissolving = false;
  private dissolveTimer = 0;
  private _isDissolved = false;

  constructor(customCanvas?: HTMLCanvasElement) {
    const canvas = createTitleCanvas(customCanvas);
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;

    this.geometry = new PlaneGeometry(VR_TITLE_WIDTH_M, VR_TITLE_HEIGHT_M);
    this.material = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 2.2;
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);

    // Floating position in world space: above bed tray at eye level
    this.group.position.set(0, 0.95, -0.55);
  }

  get isDissolved(): boolean {
    return this._isDissolved;
  }

  get opacity(): number {
    return this.material.opacity;
  }

  /** Positions the title in world space facing the player. */
  place(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  /** Begins the dissolve-into-mist transition upon ignition. */
  ignite(): void {
    if (this.dissolving || this._isDissolved) return;
    this.dissolving = true;
    this.dissolveTimer = 0;
  }

  /**
   * Advances dissolve animation and rotates to billboard toward the player.
   * Zero per-frame allocations.
   */
  update(dt: number, cameraQuat?: Quaternion): void {
    if (cameraQuat && !this._isDissolved) {
      this.group.quaternion.copy(cameraQuat);
    }

    if (!this.dissolving || this._isDissolved) return;

    this.dissolveTimer += dt;
    const progress = Math.min(1.0, this.dissolveTimer / DISSOLVE_DURATION_S);

    // Fade out and gently float upward and expand
    this.material.opacity = Math.max(0, 1.0 - progress);
    this.mesh.scale.setScalar(1.0 + progress * 0.25);
    this.mesh.position.y = progress * 0.04;

    if (progress >= 1.0) {
      this._isDissolved = true;
      this.dissolving = false;
      this.group.visible = false;
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
