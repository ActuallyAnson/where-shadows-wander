// Scene 1's opening, drawn (the timing is wake-timeline.ts): eyelids, a flash and a word in the dark. All follow the head: a small
// black sphere round the eyes (like FadeView's) whose shader leaves an eye-shaped opening, wider as the eyes open, with soft lids;
// a lightning flash through the shut lids, a pale glow with his friend's silhouette standing in it, soft-edged like a dream; and a
// faint word floating in front, drawn over the black. Nothing is allocated per frame.
import {
  BackSide,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { RenderOrder } from './pure/render-order';

/** Metres in front of the eyes the word floats, and how wide its line is. */
const TEXT_DISTANCE_M = 1.6;
const TEXT_WIDTH_M = 0.7;
const TEXT_COLOR = '#c9cdd6';
/** At most this visible: it is a whisper. */
const TEXT_MAX_OPACITY = 0.75;
/** The flash: how far away its picture hangs, how big it is, its colour, and how bright at most (it comes through the lids). */
const FLASH_DISTANCE_M = 3;
const FLASH_SIZE_M = 3.6;
const FLASH_COLOR = '#b4bed2';
const FLASH_MAX_OPACITY = 0.6;

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Looking down -z. The opening is an eye shape: tallest straight ahead, closing towards the sides; its edge is soft, and while the
// eyes are half open the view through them is dimmed too.
const FRAGMENT = /* glsl */ `
uniform float open;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float soft = 0.06 + 0.12 * open;
  // Shut (open 0) the edge sits below zero, so nothing shows through; open (1) it is past the edge of any headset's view.
  float edge = open * 1.5 * (1.0 - 0.55 * d.x * d.x) - soft * (1.0 - open);
  float lid = smoothstep(edge - soft, edge + soft, abs(d.y));
  if (d.z > 0.0) lid = 1.0;
  float dim = (1.0 - open) * (1.0 - open) * 0.55;
  gl_FragColor = vec4(0.0, 0.0, 0.0, max(lid, dim));
}`;

export class WakeView {
  /** Moved to the head each frame (position and turn). */
  readonly group = new Group();
  private readonly lidMat: ShaderMaterial;
  private readonly lids: Mesh;
  private readonly textMat: MeshBasicMaterial;
  private readonly textMesh: Mesh;
  private readonly texture: CanvasTexture;
  private readonly flashMat: MeshBasicMaterial;
  private readonly flashMesh: Mesh;
  private readonly flashTexture: CanvasTexture;

  constructor(text: string) {
    this.lidMat = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { open: { value: 0 } },
      transparent: true,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    });
    this.lids = new Mesh(new SphereGeometry(0.4, 32, 16), this.lidMat);
    this.lids.renderOrder = RenderOrder.fade;
    this.lids.frustumCulled = false;
    this.group.add(this.lids);

    this.texture = paint(text);
    this.textMat = new MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.textMesh = new Mesh(new PlaneGeometry(TEXT_WIDTH_M, TEXT_WIDTH_M / 4), this.textMat);
    this.textMesh.position.set(0, 0, -TEXT_DISTANCE_M);
    // Within the fade's layer, just over the lids: the word shows on the black.
    this.textMesh.renderOrder = RenderOrder.fade + 0.1;
    this.textMesh.frustumCulled = false;
    this.group.add(this.textMesh);

    this.flashTexture = paintFlash();
    this.flashMat = new MeshBasicMaterial({
      map: this.flashTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.flashMesh = new Mesh(new PlaneGeometry(FLASH_SIZE_M, FLASH_SIZE_M), this.flashMat);
    this.flashMesh.position.set(0, -0.25, -FLASH_DISTANCE_M);
    // Over the lids, under the word.
    this.flashMesh.renderOrder = RenderOrder.fade + 0.05;
    this.flashMesh.frustumCulled = false;
    this.group.add(this.flashMesh);
    this.group.visible = false;
  }

  /**
   * Once per frame: how open the eyes are (0..1, 1 hides the lids), how visible the word is (0..1), where the head is and which
   * way it faces (world), and how bright the flash through the lids is (0..1).
   */
  update(
    open: number,
    text: number,
    headPos: Readonly<{ x: number; y: number; z: number }>,
    headQuat: Readonly<{ x: number; y: number; z: number; w: number }>,
    flash = 0,
  ): void {
    const lidsOn = open < 0.999;
    const textOn = text > 0.001;
    const flashOn = flash > 0.001;
    this.lids.visible = lidsOn;
    this.textMesh.visible = textOn;
    this.flashMesh.visible = flashOn;
    this.group.visible = lidsOn || textOn || flashOn;
    if (!this.group.visible) return;
    this.lidMat.uniforms.open.value = open < 0 ? 0 : open;
    this.textMat.opacity = (text > 1 ? 1 : text) * TEXT_MAX_OPACITY;
    this.flashMat.opacity = (flash > 1 ? 1 : flash) * FLASH_MAX_OPACITY;
    this.group.position.set(headPos.x, headPos.y, headPos.z);
    this.group.quaternion.set(headQuat.x, headQuat.y, headQuat.z, headQuat.w);
  }

  /** Hides it all (eyes open, no word). */
  hide(): void {
    this.group.visible = false;
  }

  dispose(): void {
    this.lids.geometry.dispose();
    this.lidMat.dispose();
    this.textMesh.geometry.dispose();
    this.textMat.dispose();
    this.texture.dispose();
    this.flashMesh.geometry.dispose();
    this.flashMat.dispose();
    this.flashTexture.dispose();
  }
}

/**
 * The flash, drawn once: a pale glow with a boy standing in it, cut out as a soft dark
 * shape. He is small and a little way off, one hand lifted in a wave: a friend, not a stranger in the doorway.
 */
function paintFlash(): CanvasTexture {
  const size = 512;
  let canvas: HTMLCanvasElement | undefined;
  if (typeof document !== 'undefined') canvas = document.createElement('canvas');
  if (!canvas) canvas = { width: size, height: size, getContext: () => null } as unknown as HTMLCanvasElement;
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext ? canvas.getContext('2d') : null;
  if (g) {
    const glow = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    glow.addColorStop(0, FLASH_COLOR);
    glow.addColorStop(0.45, 'rgba(180,190,210,0.55)');
    glow.addColorStop(1, 'rgba(180,190,210,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    // The boy, cut out of the glow with a soft edge (the lids are black behind it, so the cut reads as his silhouette).
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.filter = 'blur(5px)';
    g.fillStyle = '#000';
    const X = (f: number) => f * size;
    const Y = (f: number) => (1 - f) * size; // f up from the bottom
    // Head, and a tuft of hair.
    g.beginPath();
    g.arc(X(0.5), Y(0.59), X(0.045), 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(X(0.488), Y(0.632), X(0.03), X(0.014), -0.4, 0, Math.PI * 2);
    g.fill();
    // Neck and body: a T-shirt, a little wider at the shoulders.
    g.fillRect(X(0.488), Y(0.55), X(0.024), X(0.02));
    g.beginPath();
    g.moveTo(X(0.455), Y(0.535));
    g.lineTo(X(0.545), Y(0.535));
    g.lineTo(X(0.54), Y(0.39));
    g.lineTo(X(0.46), Y(0.39));
    g.closePath();
    g.fill();
    // Legs (shorts and bare legs, one slightly out).
    g.lineCap = 'round';
    g.strokeStyle = '#000';
    g.lineWidth = X(0.034);
    g.beginPath();
    g.moveTo(X(0.48), Y(0.4));
    g.lineTo(X(0.474), Y(0.2));
    g.moveTo(X(0.52), Y(0.4));
    g.lineTo(X(0.532), Y(0.2));
    g.stroke();
    // The arm at his side, and the other lifted in a wave, the open hand by his head.
    g.lineWidth = X(0.026);
    g.beginPath();
    g.moveTo(X(0.46), Y(0.525));
    g.lineTo(X(0.44), Y(0.4));
    g.moveTo(X(0.54), Y(0.525));
    g.lineTo(X(0.6), Y(0.56));
    g.lineTo(X(0.615), Y(0.65));
    g.stroke();
    g.beginPath();
    g.ellipse(X(0.618), Y(0.675), X(0.021), X(0.03), 0.15, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The word, drawn once: pale, small, slanted, like something said half asleep. */
function paint(text: string): CanvasTexture {
  let canvas: HTMLCanvasElement | undefined;
  if (typeof document !== 'undefined') canvas = document.createElement('canvas');
  if (!canvas) canvas = { width: 1024, height: 256, getContext: () => null } as unknown as HTMLCanvasElement;
  canvas.width = 1024;
  canvas.height = 256;
  const g = canvas.getContext ? canvas.getContext('2d') : null;
  if (g && text) {
    g.fillStyle = TEXT_COLOR;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `italic 400 120px Georgia, 'Times New Roman', serif`;
    g.shadowColor = TEXT_COLOR;
    g.shadowBlur = 18; // a soft edge, as if seen through sleep
    g.fillText(text, 512, 128);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
