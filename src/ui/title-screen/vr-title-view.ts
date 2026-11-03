// Floating VR title emblem in world space above the tray.
// Dissolves into mist upon candle ignition.
// Belongs to Teammate B's UI domain (src/ui/title-screen).
// Zero per-frame allocations.
import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

export const VR_TITLE_WIDTH_M = 0.75;
export const VR_TITLE_HEIGHT_M = 0.4;
export const DISSOLVE_DURATION_S = 1.0;
/** How quickly the hint line fades in and out (per second). */
const HINT_FADE_RATE = 2.5;
/**
 * The lines under the title while the candle waits to be lit: a riddle first, then a plainer one if the player is still lost.
 * Index 0 is unused (no hint).
 */
export const HINT_LINES: readonly string[] = [
  '',
  'A small light is lost. Where does a flame belong?',
  'The candle sleeps. Carry the little flame to its wick.',
];

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
    const cy = 68;
    ctx.moveTo(cx, cy - 20);
    ctx.lineTo(cx + 14, cy);
    ctx.lineTo(cx, cy + 20);
    ctx.lineTo(cx - 14, cy);
    ctx.closePath();
    ctx.fill();

    // Side flourishes
    ctx.strokeStyle = 'rgba(255, 207, 112, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 120, cy);
    ctx.lineTo(cx - 26, cy);
    ctx.moveTo(cx + 26, cy);
    ctx.lineTo(cx + 120, cy);
    ctx.stroke();

    // Main Title: "WHERE SHADOWS WANDER" (no CPU shadowBlur)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 28px serif, Georgia, "Cinzel Decorative"';
    ctx.fillStyle = '#ffebcc';
    ctx.fillText('WHERE SHADOWS WANDER', cx, 136);

    // Bottom soft flourish line
    ctx.strokeStyle = 'rgba(255, 200, 130, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 70, 182);
    ctx.lineTo(cx + 70, 182);
    ctx.stroke();
  }
  return canvas;
}

const HINT_W = 768;
const HINT_H = 64;

function createHintCanvas(): HTMLCanvasElement {
  let canvas: HTMLCanvasElement | undefined;
  if (typeof document !== 'undefined') canvas = document.createElement('canvas');
  if (!canvas) canvas = { width: HINT_W, height: HINT_H, getContext: () => null } as unknown as HTMLCanvasElement;
  canvas.width = HINT_W;
  canvas.height = HINT_H;
  return canvas;
}

/** Writes a hint line on its canvas (done when the line changes, never per frame). */
function paintHint(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return;
  ctx.clearRect(0, 0, HINT_W, HINT_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 400 25px serif, Georgia';
  ctx.fillStyle = '#ffd89a';
  ctx.fillText(text, HINT_W / 2, HINT_H / 2);
}

export class VrTitleView {
  readonly group = new Group();
  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;
  private readonly texture: CanvasTexture;
  private readonly mesh: Mesh;
  private readonly hintTexture: CanvasTexture;
  private readonly hintGeometry: PlaneGeometry;
  private readonly hintMaterial: MeshBasicMaterial;
  private readonly hintCanvas: HTMLCanvasElement;
  private hintLevel = 0;
  private hintAlpha = 0;

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

    // A line under the title that fades in when lighting the candle stalls (setHint).
    this.hintCanvas = createHintCanvas();
    this.hintTexture = new CanvasTexture(this.hintCanvas);
    this.hintTexture.colorSpace = SRGBColorSpace;
    this.hintGeometry = new PlaneGeometry(VR_TITLE_WIDTH_M * 0.9, VR_TITLE_WIDTH_M * 0.9 * (HINT_H / HINT_W));
    this.hintMaterial = new MeshBasicMaterial({
      map: this.hintTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    const hint = new Mesh(this.hintGeometry, this.hintMaterial);
    hint.renderOrder = 2.2;
    hint.frustumCulled = false;
    hint.position.set(0, -VR_TITLE_HEIGHT_M * 0.5 - 0.02, 0);
    this.group.add(hint);

    // Floating position in world space: above bed tray at eye level
    this.group.position.set(0, 0.95, -0.55);
  }

  get isDissolved(): boolean {
    return this._isDissolved;
  }

  /** How visible the hint line is (0 to 1). */
  get hintOpacity(): number {
    return this.hintMaterial.opacity;
  }

  get opacity(): number {
    return this.material.opacity;
  }

  /** Positions the title in world space, turned by `yaw` to face the player who stands where the room was placed. It then stays put. */
  place(x: number, y: number, z: number, yaw = 0): void {
    this.group.position.set(x, y, z);
    this.group.rotation.set(0, yaw, 0);
  }

  /** The line showing now (0 none, 1 the riddle, 2 the plainer line); a new line fades in afresh. */
  setHint(level: number): void {
    const l = Math.max(0, Math.min(HINT_LINES.length - 1, level | 0));
    if (l === this.hintLevel) return;
    this.hintLevel = l;
    if (l > 0) {
      paintHint(this.hintCanvas, HINT_LINES[l]);
      this.hintTexture.needsUpdate = true;
      this.hintAlpha = 0;
    }
  }

  /** The hint line's text now (empty when none). */
  get hintText(): string {
    return HINT_LINES[this.hintLevel];
  }

  /** Begins the dissolve-into-mist transition upon ignition. */
  ignite(): void {
    if (this.dissolving || this._isDissolved) return;
    this.dissolving = true;
    this.dissolveTimer = 0;
  }

  /**
   * Advances the hint and the dissolve. The title hangs where it was placed and does not turn with the head, so looking about before
   * lighting the candle does not drag it along. Zero per-frame allocations.
   */
  update(dt: number): void {
    const goal = this.hintLevel > 0 && !this.dissolving && !this._isDissolved ? 1 : 0;
    this.hintAlpha += (goal - this.hintAlpha) * Math.min(1, dt * HINT_FADE_RATE);
    this.hintMaterial.opacity = this.hintAlpha < 0.01 ? 0 : this.hintAlpha;

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
    this.hintGeometry.dispose();
    this.hintMaterial.dispose();
    this.hintTexture.dispose();
  }
}
