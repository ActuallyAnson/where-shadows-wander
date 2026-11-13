// Scene 1's opening, drawn (the timing is wake-timeline.ts): eyelids, a dream and a word in the dark. All follow the head: a small
// black sphere round the eyes (like FadeView's) whose shader leaves an eye-shaped opening, wider as the eyes open, with soft lids;
// his friend in the black behind the shut lids, a faint pale glow of her slowly gathering, soft-edged like a dream; and a
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
/** The friend in the dark: how far away her picture hangs, how big it is, her colour, and how bright at most: faint, half there. */
const FRIEND_DISTANCE_M = 3;
const FRIEND_SIZE_M = 3.6;
const FRIEND_COLOR = '#aeb8cc';
const FRIEND_MAX_OPACITY = 0.3;

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
  private readonly friendMat: MeshBasicMaterial;
  private readonly friendMesh: Mesh;
  private readonly friendTexture: CanvasTexture;

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

    // The friend: a faint pale glow of her in the black, over the lids and under the word.
    this.friendTexture = paintFriend();
    this.friendMat = new MeshBasicMaterial({
      map: this.friendTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.friendMesh = new Mesh(new PlaneGeometry(FRIEND_SIZE_M, FRIEND_SIZE_M), this.friendMat);
    this.friendMesh.position.set(0, -0.25, -FRIEND_DISTANCE_M);
    this.friendMesh.renderOrder = RenderOrder.fade + 0.06;
    this.friendMesh.frustumCulled = false;
    this.group.add(this.friendMesh);
    this.group.visible = false;
  }

  /**
   * Once per frame: how open the eyes are (0..1, 1 hides the lids), how visible the word is (0..1), where the head is and which
   * way it faces (world), and how clearly the friend shows in the dark (0..1).
   */
  update(
    open: number,
    text: number,
    headPos: Readonly<{ x: number; y: number; z: number }>,
    headQuat: Readonly<{ x: number; y: number; z: number; w: number }>,
    friend = 0,
  ): void {
    const lidsOn = open < 0.999;
    const textOn = text > 0.001;
    const friendOn = friend > 0.001;
    this.lids.visible = lidsOn;
    this.textMesh.visible = textOn;
    this.friendMesh.visible = friendOn;
    this.group.visible = lidsOn || textOn || friendOn;
    if (!this.group.visible) return;
    this.lidMat.uniforms.open.value = open < 0 ? 0 : open;
    this.textMat.opacity = (text > 1 ? 1 : text) * TEXT_MAX_OPACITY;
    this.friendMat.opacity = (friend > 1 ? 1 : friend) * FRIEND_MAX_OPACITY;
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
    this.friendMesh.geometry.dispose();
    this.friendMat.dispose();
    this.friendTexture.dispose();
  }
}

/**
 * The friend, drawn once: a pale, softly glowing shape of a girl on transparent, with a wider faint halo round her. She is small and a little way off, one hand lifted in a wave: a friend, not a stranger in the doorway.
 */
function paintFriend(): CanvasTexture {
  const size = 512;
  let canvas: HTMLCanvasElement | undefined;
  if (typeof document !== 'undefined') canvas = document.createElement('canvas');
  if (!canvas) canvas = { width: size, height: size, getContext: () => null } as unknown as HTMLCanvasElement;
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext ? canvas.getContext('2d') : null;
  // Twice: a wide faint halo, then the girl herself, still soft-edged.
  if (g)
    for (const [blur, alpha] of [
      [22, 0.45],
      [7, 1],
    ] as const) {
      g.save();
      g.filter = `blur(${blur}px)`;
      g.globalAlpha = alpha;
      drawGirl(g, size);
      g.restore();
    }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The girl's shape, filled and stroked in the friend's colour over the whole square. */
function drawGirl(g: CanvasRenderingContext2D, size: number): void {
  g.fillStyle = FRIEND_COLOR;
  const X = (f: number) => f * size;
  const Y = (f: number) => (1 - f) * size; // f up from the bottom
  // Head, the hair over it, and two bunches tied out at the sides: she reads as a girl even soft and faint.
  g.beginPath();
  g.arc(X(0.5), Y(0.59), X(0.045), 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(X(0.5), Y(0.61), X(0.05), X(0.042), 0, Math.PI, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(X(0.443), Y(0.585), X(0.018), X(0.03), 0.5, 0, Math.PI * 2);
  g.ellipse(X(0.557), Y(0.585), X(0.018), X(0.03), -0.5, 0, Math.PI * 2);
  g.fill();
  // Neck and a dress: narrow at the shoulders, flaring to a hem at the knees.
  g.fillRect(X(0.488), Y(0.55), X(0.024), X(0.02));
  g.beginPath();
  g.moveTo(X(0.46), Y(0.535));
  g.lineTo(X(0.54), Y(0.535));
  g.lineTo(X(0.545), Y(0.47));
  g.lineTo(X(0.575), Y(0.33));
  g.lineTo(X(0.425), Y(0.33));
  g.lineTo(X(0.455), Y(0.47));
  g.closePath();
  g.fill();
  // Legs below the hem.
  g.lineCap = 'round';
  g.strokeStyle = FRIEND_COLOR;
  g.lineWidth = X(0.03);
  g.beginPath();
  g.moveTo(X(0.48), Y(0.34));
  g.lineTo(X(0.476), Y(0.2));
  g.moveTo(X(0.52), Y(0.34));
  g.lineTo(X(0.53), Y(0.2));
  g.stroke();
  // The arm at her side, and the other lifted in a wave, the open hand by her head.
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
