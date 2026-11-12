// Scene 1's opening, drawn (the timing is wake-timeline.ts): eyelids and a word in the dark. Both follow the head: a small black
// sphere round the eyes (like FadeView's) whose shader leaves an eye-shaped opening, wider as the eyes open, with soft lids; and a
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
    this.group.visible = false;
  }

  /**
   * Once per frame: how open the eyes are (0..1, 1 hides the lids), how visible the word is (0..1), and where the head is and
   * which way it faces (world).
   */
  update(
    open: number,
    text: number,
    headPos: Readonly<{ x: number; y: number; z: number }>,
    headQuat: Readonly<{ x: number; y: number; z: number; w: number }>,
  ): void {
    const lidsOn = open < 0.999;
    const textOn = text > 0.001;
    this.lids.visible = lidsOn;
    this.textMesh.visible = textOn;
    this.group.visible = lidsOn || textOn;
    if (!this.group.visible) return;
    this.lidMat.uniforms.open.value = open < 0 ? 0 : open;
    this.textMat.opacity = (text > 1 ? 1 : text) * TEXT_MAX_OPACITY;
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
  }
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
