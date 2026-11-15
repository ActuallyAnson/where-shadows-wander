// Thumbnails of model files for the room editor's asset browser: each .glb is loaded once, drawn from three-quarters above on
// a small offscreen renderer of its own, and kept as an image URL. One model is drawn at a time; a file written again (a new
// change time) gets a new thumbnail.
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from '@iwsdk/core';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SIZE = 160;

export class AssetThumbs {
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.01, 100);
  private readonly loader = new GLTFLoader();
  /** key → image URL ('' when the model could not be drawn). */
  private readonly done = new Map<string, string>();
  private readonly waiting = new Map<string, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    this.scene.add(new AmbientLight(0xffffff, 1.4));
    const sun = new DirectionalLight(0xfff2e0, 2.4);
    sun.position.set(2, 4, 3);
    this.scene.add(sun);
    const fill = new DirectionalLight(0xc8d8ff, 0.8);
    fill.position.set(-3, 1, -2);
    this.scene.add(fill);
  }

  /** The thumbnail drawn for `key`, if there is one yet ('' if it failed). */
  get(key: string): string | undefined {
    return this.done.get(key);
  }

  /** Draws the model at `url` (once per `key`); resolves to its image URL, or '' if it could not be drawn. */
  request(url: string, key: string): Promise<string> {
    const known = this.done.get(key);
    if (known !== undefined) return Promise.resolve(known);
    let p = this.waiting.get(key);
    if (!p) {
      p = this.queue.then(() => this.draw(url)).catch(() => '');
      this.queue = p;
      this.waiting.set(key, p);
      void p.then((src) => {
        this.done.set(key, src);
        this.waiting.delete(key);
      });
    }
    return p;
  }

  dispose(): void {
    this.renderer?.dispose();
    this.renderer = null;
  }

  private async draw(url: string): Promise<string> {
    const gltf = await this.loader.loadAsync(url);
    const model = gltf.scene;
    const renderer = (this.renderer ??= this.makeRenderer());
    const box = new Box3().setFromObject(model);
    if (box.isEmpty()) return '';
    const center = box.getCenter(new Vector3());
    const radius = Math.max(box.getSize(new Vector3()).length() / 2, 1e-3);
    model.position.sub(center);
    this.scene.add(model);
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance = (radius / Math.sin(fov / 2)) * 1.05;
    this.camera.position.set(1, 0.75, 1.3).normalize().multiplyScalar(distance);
    this.camera.near = distance / 100;
    this.camera.far = distance * 4;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    renderer.render(this.scene, this.camera);
    const src = renderer.domElement.toDataURL('image/png');
    this.scene.remove(model);
    disposeTree(model);
    return src;
  }

  private makeRenderer(): WebGLRenderer {
    const canvas = document.createElement('canvas');
    const r = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(SIZE, SIZE, false);
    r.setClearColor(0x000000, 0);
    return r;
  }
}

function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as { geometry?: { dispose(): void }; material?: Material | Material[] };
    mesh.geometry?.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
      for (const v of Object.values(m)) if ((v as Texture | null)?.isTexture) (v as Texture).dispose();
      m.dispose();
    }
  });
}
