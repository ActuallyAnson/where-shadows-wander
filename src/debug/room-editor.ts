// The room editor: arrange the bedroom's static pieces in the running game and save them to the room layout file
// (content/rooms/bedroom.json, src/engine/stage/room-layout.ts). Development and tester builds only; it opens in the Hand Lab
// with `?mock=1&edit=room`, and main.ts loads it with a dynamic import behind DEBUG_TOOLS.
//
// Click a piece to select it (or pick it from the list), then drag the gizmo or type exact numbers. The numbers are the
// piece's placement as the file stores it: position in metres, rotation in degrees and scale, in the piece's own space
// (room space for the room, the tray's space for the lap). Save writes the file through the dev server.
//
//   W move · E rotate · R scale · Q local/world · hold Shift to snap (1 cm, 5°, 0.05) · Esc deselect
//   Ctrl+Z undo · Ctrl+Y or Ctrl+Shift+Z redo · Ctrl+S save
//
// The candle's shadows are baked: they are cast again while a piece is dragged (once a frame) and whenever it is placed. The
// headset marker shows where the player's eyes are and roughly what the headset can see, in every view but Eye.
import {
  AssetManager,
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Object3D,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
  type PerspectiveCamera,
} from '@iwsdk/core';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  copyPlacement,
  mergeLayout,
  nextPieceId,
  placement,
  placementOr,
  roundPlacement,
  serializeRoomLayout,
} from '../engine/stage/room-layout';
import type { LayoutSection, Placement, RoomLayout, Vec3 } from '../engine/stage/room-layout';
import type { ModelLoader, PlacedModels, PlacedPiece } from '../engine/shadow/placed-models';
import type { AssetFileInfo } from '../engine/services/assets/asset-tree';
import { AssetClient } from './asset-client';
import { AssetPanel, assetDragOf, ASSET_DRAG_TYPE } from './room-editor-assets';
import { exportGlb, prepareForExport } from './piece-export';
import { MODEL_MAX_BYTES } from '../engine/services/assets/asset-tree';
import { applyPlacement, readPlacement } from '../engine/shadow/room-placement';
import type { EditablePiece, EditableSource } from '../engine/shadow/room-placement';
import { RoomEditHistory } from './room-edit-history';
import { sceneTree } from './room-scene-tree';

export interface RoomEditorDeps {
  camera: PerspectiveCamera;
  canvas: HTMLCanvasElement;
  scene: Object3D;
  /** The room's root (room space): the view presets are placed in it. */
  room: Object3D;
  /**
   * The height (m) of the player's eyes above the floor when the room was placed. The room stands round the player's head (room
   * space has the player at x = 0, z = 0), so the headset marker and the Eye view stand at (0, this, 0).
   */
  eyeHeight(): number;
  /** What owns the built-in pieces: each view of the room, with the name the scene tree groups its pieces under. */
  sources: readonly { label: string; source: EditableSource }[];
  /** The models placed in the room (layout entries with a `model`): the editor adds, copies and removes these. */
  placed: PlacedModels;
  /** The ids of the built-in pieces, per section, which a new piece may not take. */
  knownIds: Readonly<Record<LayoutSection, readonly string[]>>;
  /** Every asset file the bundler saw when the page loaded (source path → URL): the asset browser without a dev server. */
  assetFiles: Readonly<Record<string, string>>;
  /** The layout the game was built from; Save writes the pieces' placements into it and then to the file. */
  layout: RoomLayout;
  /** The file's name under content/rooms/. */
  fileName: string;
  /** Scene roots that are part of the room, still shown with "Room only" on (everything else at the top of the scene is hidden). */
  roomRoots: readonly Object3D[];
  /** Takes the desk view from the Hand Lab (true) or gives it back (false). */
  suspendDesk(on: boolean): void;
}

type Mode = 'translate' | 'rotate' | 'scale';

const SNAP = { translate: 0.01, rotateDeg: 5, scale: 0.05 };
const FIELDS = ['pos', 'rotDeg', 'scale'] as const;
const FIELD_LABEL = { pos: 'Position (m)', rotDeg: 'Rotation (°)', scale: 'Scale' } as const;
const PANEL_W = 300;
const PANEL_MIN_W = 240;
const PANEL_W_KEY = 'wsw.roomEditor.panelWidth';
type Tab = 'inspect' | 'scene';

/** The headset's field of view (a Quest 3's is about 110° across and 96° up and down). */
const HEADSET_FOV_DEG = { across: 110, upDown: 96 };
/** How far the marker draws the view (m): z -1.5, the nearest the wall ahead comes. */
const VIEW_DEPTH_M = 1.5;
/** The marker is hidden when the camera is this close to the eyes (m), as in the Eye view, where it would only be in the way. */
const MARKER_HIDE_NEAR_M = 0.3;

/** View presets, in room space: where the camera stands and what it looks at. Eye's heights are above the player's eyes. */
const VIEWS: Readonly<Record<string, readonly [Vec3, Vec3]>> = {
  Eye: [
    [0, 0, 0],
    [0, -0.3, -1.6],
  ],
  Overview: [
    [0.2, 2.2, 1.7],
    [0, 0.6, -0.5],
  ],
  Left: [
    [1.7, 1.4, 0.6],
    [-1.9, 1.1, -0.6],
  ],
  Right: [
    [-1.7, 1.4, 0.6],
    [1.9, 1.1, -0.4],
  ],
};

const keyOf = (p: EditablePiece): string => `${p.section}:${p.id}`;
const isPlaced = (p: EditablePiece): p is PlacedPiece => typeof (p as Partial<PlacedPiece>).model === 'string';
/** The scene tree's group for the models placed in the editor. */
const ADDED = 'Added';
/** How far a copy stands from what it copies (m, along x). */
const COPY_OFFSET_M = 0.1;
/** Escapes text for HTML. */
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

export class RoomEditor {
  private readonly orbit: OrbitControls;
  private readonly gizmo: TransformControls;
  private readonly helper: Object3D;
  /** The player's headset and what it sees, in room space. */
  private readonly marker: LineSegments;
  private readonly markerEye = new Vector3();
  /** A piece dragged since the last frame: its view is told it moved (and the shadows are baked again) once a frame. */
  private draggedPiece: EditablePiece | null = null;
  private draggedFrame = 0;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly downAt = new Vector2();
  private readonly history = new RoomEditHistory<PlacedPiece>();
  /** Keys (`section:id`) of placed models taken out of the room: Save drops their entries from the file. */
  private readonly removed = new Set<string>();
  /** Scene tree groups folded shut (`section:label`). */
  private readonly folded = new Set<string>();
  private readonly root = document.createElement('aside');
  private readonly client: AssetClient;
  private readonly assets: AssetPanel;
  /** How the game loads placed models (through the manifest); the editor loads by file while it is open. */
  private gameLoader: ModelLoader | null = null;
  private readonly floor = new Plane();
  private readonly up = new Vector3();
  /** What "Room only" hid, to show again when it is turned off. */
  private readonly hiddenByRoomOnly = new Set<Object3D>();
  private restoreBeforeRender: Object3D['onBeforeRender'] | null = null;
  private selected: EditablePiece | null = null;
  /** The selected piece's placement when the current drag began. */
  private dragStart: Placement | null = null;
  private savedText: string;
  private status = '';
  private roomOnly = false;
  private open = false;
  /** The piece the selection section was last built for (it is rebuilt only when that changes, so typing keeps its focus). */
  private shownKey: string | null | undefined = undefined;
  private readonly onKeyDown = (e: KeyboardEvent) => this.key(e, true);
  private readonly onKeyUp = (e: KeyboardEvent) => this.key(e, false);
  private readonly onPointerDown = (e: PointerEvent) => this.downAt.set(e.clientX, e.clientY);
  private readonly onPointerUp = (e: PointerEvent) => this.click(e);
  private readonly onResize = () => this.applyPanelWidth();
  /** The panel's width as last dragged (kept for the next time the editor opens), and the tab it shows. */
  private panelW = readStoredWidth();
  private tab: Tab = 'inspect';
  private readonly onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.dirty) e.preventDefault();
  };
  /** A file dropped anywhere else on the page would open it in the tab and end the session: refuse it. */
  private readonly onWindowDrag = (e: DragEvent) => e.preventDefault();
  private readonly onCanvasDragOver = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes(ASSET_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  private readonly onCanvasDrop = (e: DragEvent) => {
    const drag = assetDragOf(e);
    if (!drag || drag.folder) return;
    e.preventDefault();
    const file = this.client.current ? this.findFile(drag.path) : undefined;
    const spot = this.spotAt(e.clientX, e.clientY);
    if (file && spot) void this.addModel(file.id, placement(spot.pos), spot.section);
  };
  /** Loads a model from its file while the editor is open, so one imported since the page loaded can be placed. */
  private readonly editorLoader: ModelLoader = async (id) => {
    if (!this.client.current) await this.client.refresh();
    const file = this.client.fileOf(id);
    if (!file || !this.client.current?.live) return this.gameLoader ? this.gameLoader(id) : null;
    const key = `editor:${file.path}:${file.mtimeMs}`;
    await AssetManager.loadGLTF(this.client.urlOf(file), key);
    return AssetManager.getGLTF(key)?.scene ?? null;
  };

  constructor(private readonly deps: RoomEditorDeps) {
    this.savedText = serializeRoomLayout(this.collect());
    this.orbit = new OrbitControls(deps.camera, deps.canvas);
    this.orbit.enabled = false;
    this.gizmo = new TransformControls(deps.camera, deps.canvas);
    this.gizmo.enabled = false;
    this.helper = this.gizmo.getHelper();
    this.gizmo.addEventListener('dragging-changed', (e) => {
      const dragging = (e as unknown as { value: boolean }).value;
      this.orbit.enabled = this.open && !dragging;
    });
    this.gizmo.addEventListener('mouseDown', () => {
      if (this.selected) this.dragStart = readPlacement(this.selected.object);
    });
    this.gizmo.addEventListener('objectChange', () => {
      if (this.selected) {
        this.selected.object.updateMatrix();
        this.movedWhileDragging(this.selected);
      }
      this.renderFields();
    });
    this.gizmo.addEventListener('mouseUp', () => {
      const piece = this.selected;
      if (!piece || !this.dragStart) return;
      this.commit(piece, this.dragStart, readPlacement(piece.object));
      this.dragStart = null;
    });
    this.marker = new LineSegments(
      new BufferGeometry(),
      new LineBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.8, depthTest: false }),
    );
    this.marker.renderOrder = 999;
    this.marker.matrixAutoUpdate = false;
    this.orbit.addEventListener('change', () => this.fadeMarker());
    this.client = new AssetClient(deps.assetFiles);
    this.assets = new AssetPanel(
      this.client,
      {
        addToRoom: (file) => void this.addInView(file),
        changed: () => this.render(),
        resized: () => this.fitCamera(),
      },
      PANEL_W,
    );
    this.mount();
  }

  /** Opens the editor: it takes the desk view, and the Hand Lab's panel, orbit and keys stand aside. */
  show(): void {
    if (this.open) return;
    this.open = true;
    this.deps.suspendDesk(true);
    this.deps.scene.add(this.helper);
    this.placeMarker();
    this.orbit.enabled = true;
    this.gizmo.enabled = true;
    this.root.style.display = '';
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.deps.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.deps.canvas.addEventListener('pointerup', this.onPointerUp);
    this.deps.canvas.addEventListener('dragover', this.onCanvasDragOver);
    this.deps.canvas.addEventListener('drop', this.onCanvasDrop);
    window.addEventListener('dragover', this.onWindowDrag);
    window.addEventListener('drop', this.onWindowDrag);
    this.gameLoader = this.deps.placed.currentLoader;
    this.deps.placed.setLoader(this.editorLoader);
    this.assets.show();
    this.applyPanelWidth();
    this.view('Overview');
    this.setRoomOnly(true);
    this.render();
  }

  /** Closes the editor and gives the desk view back to the Hand Lab. Unsaved changes stay in the room until reload. */
  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.select(null);
    this.setRoomOnly(false);
    this.deps.scene.remove(this.helper);
    this.deps.room.remove(this.marker);
    cancelAnimationFrame(this.draggedFrame);
    this.draggedFrame = 0;
    this.draggedPiece = null;
    this.orbit.enabled = false;
    this.gizmo.enabled = false;
    this.root.style.display = 'none';
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.deps.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.deps.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.deps.canvas.removeEventListener('dragover', this.onCanvasDragOver);
    this.deps.canvas.removeEventListener('drop', this.onCanvasDrop);
    window.removeEventListener('dragover', this.onWindowDrag);
    window.removeEventListener('drop', this.onWindowDrag);
    if (this.gameLoader) this.deps.placed.setLoader(this.gameLoader);
    this.assets.hide();
    this.deps.camera.clearViewOffset();
    this.deps.suspendDesk(false);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Whether there are changes not yet in the file. */
  get dirty(): boolean {
    return serializeRoomLayout(this.collect()) !== this.savedText;
  }

  /** Every piece there is now (models that load late are added as they arrive), the placed models last. */
  pieces(): EditablePiece[] {
    return [...this.deps.sources.flatMap((s) => [...s.source.editables()]), ...this.deps.placed.editables()];
  }

  /**
   * Places a copy of the model `model` (an asset id) in `section` at `at`, as one undoable step, and selects it. Its id is the
   * model's, or the model's with the next free number. Resolves with the piece, or null if the model would not load.
   */
  async addModel(model: string, at: Readonly<Placement>, section: LayoutSection = 'room'): Promise<PlacedPiece | null> {
    const id = nextPieceId(model, (candidate) => this.taken(candidate));
    const piece = await this.deps.placed.add(section, id, model, at);
    if (!piece) {
      this.status = `"${model}" did not load (see the console)`;
      this.render();
      return null;
    }
    this.removed.delete(keyOf(piece));
    this.history.pushAdd(keyOf(piece), piece);
    this.status = '';
    this.select(piece);
    return piece;
  }

  /** Places a copy of the selected model next to it (built-in pieces cannot be copied). */
  async duplicate(): Promise<PlacedPiece | null> {
    const piece = this.selected;
    if (!piece || !isPlaced(piece)) return null;
    const at = readPlacement(piece.object);
    at.pos[0] += COPY_OFFSET_M;
    return this.addModel(piece.model, at, piece.section);
  }

  /** Takes the selected model out of the room, as one undoable step (built-in pieces cannot be removed). */
  remove(): boolean {
    const piece = this.selected;
    if (!piece || !isPlaced(piece)) return false;
    this.select(null);
    this.takeOut(piece);
    this.history.pushRemove(keyOf(piece), piece);
    this.status = '';
    this.render();
    return true;
  }

  /**
   * Exports the selected built-in piece as a .glb into src/assets/models/exported/ (a file of the same name is replaced), where
   * the asset browser shows it and copies can be placed. Its textures are scaled down if it would be over the model budget. If
   * its id is another asset's (the bed is "bed", which no file is, but the chair is "chair"), the file takes the next free
   * number. Without a dev server the file is downloaded. Resolves with what happened.
   */
  async exportSelected(): Promise<string> {
    const piece = this.selected;
    if (!piece || isPlaced(piece)) return this.say('Pick a built-in piece to export');
    const { root, warnings } = prepareForExport(piece.object, piece.id);
    let bytes: Uint8Array | null = null;
    for (const size of [Infinity, 512, 256]) {
      bytes = await exportGlb(root, size);
      if (bytes.length <= MODEL_MAX_BYTES) break;
    }
    if (!bytes || bytes.length > MODEL_MAX_BYTES)
      return this.say(
        `${piece.id} is over the ${Math.round(MODEL_MAX_BYTES / 1024)} KB model budget even with small textures`,
      );
    const kb = `${Math.max(1, Math.round(bytes.length / 1024))} KB`;
    const notes = warnings.length ? ` Note: ${warnings.join('; ')}.` : '';
    if (!this.client.current?.live) {
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'model/gltf-binary' }));
      Object.assign(document.createElement('a'), { href: url, download: `${piece.id}.glb` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return this.say(`No dev server: downloaded ${piece.id}.glb (${kb}).${notes}`);
    }
    for (let n = 1; n < 20; n++) {
      const path = `exported/${n === 1 ? piece.id : `${piece.id}-${n}`}.glb`;
      const result = await this.assets.write(path, bytes, true);
      if (result.ok) return this.say(`Exported ${path} (${kb}).${notes}`);
      if (!/is taken by/.test(result.error)) return this.say(`Not exported: ${result.error}`);
    }
    return this.say(`Not exported: no free name for ${piece.id}`);
  }

  private say(status: string): string {
    this.status = status;
    this.render();
    return status;
  }

  /** Whether a new piece may not take `id`: a piece there is now, an entry in the file, a built-in id, or one undo could bring back. */
  private taken(id: string): boolean {
    const { layout, knownIds } = this.deps;
    if (this.pieces().some((p) => p.id === id)) return true;
    if (this.history.items().some((p) => p.id === id)) return true;
    for (const section of ['room', 'lap'] as const)
      if (Object.prototype.hasOwnProperty.call(layout[section], id) || knownIds[section].includes(id)) return true;
    return false;
  }

  private takeOut(piece: PlacedPiece): void {
    if (this.selected === piece) this.select(null);
    this.deps.placed.detach(piece);
    this.removed.add(keyOf(piece));
  }

  private putBack(piece: PlacedPiece): void {
    this.deps.placed.reattach(piece);
    this.removed.delete(keyOf(piece));
  }

  /** Selects a piece by id (`bed`, or `lap:quilt` for another section), for scripts and tests. */
  selectId(id: string): boolean {
    const key = id.includes(':') ? id : `room:${id}`;
    const piece = this.pieces().find((p) => keyOf(p) === key) ?? null;
    this.select(piece);
    return piece !== null;
  }

  /** Moves a piece to a placement, as one undoable step. */
  set(piece: EditablePiece, to: Readonly<Placement>): void {
    this.commit(piece, readPlacement(piece.object), to);
  }

  /**
   * The layout as Save would write it: the file's own entries, less the models taken out, with every piece there now at its
   * current placement (and a placed model's asset).
   */
  collect(): RoomLayout {
    return mergeLayout(
      this.deps.layout,
      this.pieces().map((p) => ({
        section: p.section,
        id: p.id,
        placement: readPlacement(p.object),
        model: isPlaced(p) ? p.model : undefined,
      })),
      this.removed,
    );
  }

  /** Writes the layout file through the dev server; on a built page (no dev server) it downloads it instead. */
  async save(): Promise<string> {
    const layout = this.collect();
    const text = serializeRoomLayout(layout);
    let result: string;
    try {
      const res = await fetch(`./__wsw/rooms/${this.deps.fileName}`, { method: 'POST', body: text });
      if (res.ok) {
        this.deps.layout.room = layout.room;
        this.deps.layout.lap = layout.lap;
        this.savedText = text;
        result = `Saved content/rooms/${this.deps.fileName}`;
      } else result = `Not saved: ${await res.text()}`;
    } catch {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      Object.assign(document.createElement('a'), { href: url, download: this.deps.fileName }).click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      result = `No dev server: downloaded ${this.deps.fileName} (put it in content/rooms/)`;
    }
    this.status = result;
    this.render();
    return result;
  }

  private commit(piece: EditablePiece, before: Readonly<Placement>, after: Readonly<Placement>): void {
    this.place(piece, after);
    this.history.push(keyOf(piece), before, after);
    this.status = '';
    this.render();
  }

  private place(piece: EditablePiece, p: Readonly<Placement>): void {
    applyPlacement(piece.object, p);
    this.moved(piece);
  }

  /** Tells the piece's view it moved: what follows it goes with it, and the candle's shadows are baked again. */
  private moved(piece: EditablePiece): void {
    if (isPlaced(piece)) return this.deps.placed.moved();
    this.deps.sources.find((s) => s.source.editables().includes(piece))?.source.moved?.(piece);
  }

  /** The gizmo moves a piece many times a frame; its view is told once, just before the next frame. */
  private movedWhileDragging(piece: EditablePiece): void {
    this.draggedPiece = piece;
    if (this.draggedFrame) return;
    this.draggedFrame = requestAnimationFrame(() => {
      this.draggedFrame = 0;
      const dragged = this.draggedPiece;
      this.draggedPiece = null;
      if (dragged) this.moved(dragged);
    });
  }

  /** Builds the headset marker at the player's eyes: the headset, a line down to the floor, and the view out to the wall. */
  private placeMarker(): void {
    const eyeY = this.deps.eyeHeight();
    const v: number[] = [];
    const line = (a: Vec3, b: Vec3) => v.push(...a, ...b);
    // The headset: a box 18 x 10 x 10 cm round the eyes.
    const [hx, hy, hz] = [0.09, 0.05, 0.05];
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) line([-hx, eyeY + sy * hy, sz * hz], [hx, eyeY + sy * hy, sz * hz]);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) line([sx * hx, eyeY - hy, sz * hz], [sx * hx, eyeY + hy, sz * hz]);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) line([sx * hx, eyeY + sy * hy, -hz], [sx * hx, eyeY + sy * hy, hz]);
    // Where the player sits: straight down to the floor, and a small cross there.
    line([0, eyeY - hy, 0], [0, 0, 0]);
    line([-0.1, 0, 0], [0.1, 0, 0]);
    line([0, 0, -0.1], [0, 0, 0.1]);
    // The view: from the eyes out to a rectangle at the nearest the wall comes, and straight ahead.
    const d = VIEW_DEPTH_M;
    const w = d * Math.tan(((HEADSET_FOV_DEG.across / 2) * Math.PI) / 180);
    const h = d * Math.tan(((HEADSET_FOV_DEG.upDown / 2) * Math.PI) / 180);
    const far: Vec3[] = [
      [-w, eyeY - h, -d],
      [w, eyeY - h, -d],
      [w, eyeY + h, -d],
      [-w, eyeY + h, -d],
    ];
    for (let i = 0; i < 4; i++) {
      line([0, eyeY, 0], far[i]);
      line(far[i], far[(i + 1) % 4]);
    }
    line([0, eyeY, 0], [0, eyeY, -d]);
    this.marker.geometry.dispose();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(v, 3));
    this.marker.geometry = geo;
    this.marker.updateMatrix();
    this.deps.room.add(this.marker);
    this.fadeMarker();
  }

  /** Hides the marker when the camera is at the player's eyes (it would fill the view), shows it otherwise. */
  private fadeMarker(): void {
    const room = this.deps.room;
    room.updateMatrixWorld(true);
    room.localToWorld(this.markerEye.set(0, this.deps.eyeHeight(), 0));
    this.marker.visible = this.deps.camera.position.distanceTo(this.markerEye) > MARKER_HIDE_NEAR_M;
  }

  private step(undo: boolean): void {
    const e = undo ? this.history.undo() : this.history.redo();
    if (!e) return;
    if (e.kind === 'move') {
      const piece = this.pieces().find((p) => keyOf(p) === e.key);
      if (piece) {
        this.place(piece, undo ? e.before : e.after);
        this.select(piece);
      }
    } else if ((e.kind === 'add') === undo) {
      // Undoing an add, or redoing a remove.
      this.takeOut(e.item);
    } else {
      this.putBack(e.item);
      this.select(e.item);
    }
    this.status = '';
    this.render();
  }

  private reset(): void {
    const piece = this.selected;
    if (!piece) return;
    this.commit(piece, readPlacement(piece.object), piece.fallback);
  }

  /** Puts the selected piece back where the file had it when the page loaded (or last saved). */
  private revert(): void {
    const piece = this.selected;
    if (!piece) return;
    this.commit(
      piece,
      readPlacement(piece.object),
      placementOr(this.deps.layout, piece.section, piece.id, piece.fallback),
    );
  }

  private select(piece: EditablePiece | null): void {
    this.selected = piece;
    if (piece) this.gizmo.attach(piece.object);
    else this.gizmo.detach();
    this.render();
  }

  private setMode(mode: Mode): void {
    this.gizmo.setMode(mode);
    this.render();
  }

  private setSnap(on: boolean): void {
    this.gizmo.setTranslationSnap(on ? SNAP.translate : null);
    this.gizmo.setRotationSnap(on ? (SNAP.rotateDeg * Math.PI) / 180 : null);
    this.gizmo.setScaleSnap(on ? SNAP.scale : null);
  }

  /**
   * "Room only" hides everything at the top of the scene that is not part of the room (the stage, the reading page, the
   * story's views). The game sets some of those visible every frame, so it is done again just before each render.
   */
  private setRoomOnly(on: boolean): void {
    if (on === this.roomOnly) return;
    this.roomOnly = on;
    const scene = this.deps.scene;
    if (on) {
      const before = scene.onBeforeRender;
      this.restoreBeforeRender = before;
      scene.onBeforeRender = (...args) => {
        before.apply(scene, args);
        this.hideNonRoom();
      };
      this.hideNonRoom();
    } else {
      if (this.restoreBeforeRender) scene.onBeforeRender = this.restoreBeforeRender;
      this.restoreBeforeRender = null;
      for (const child of this.hiddenByRoomOnly) child.visible = true;
      this.hiddenByRoomOnly.clear();
    }
    this.render();
  }

  private hideNonRoom(): void {
    for (const child of this.deps.scene.children)
      if (child.visible && child !== this.helper && !this.deps.roomRoots.includes(child) && !isCameraOrLight(child)) {
        child.visible = false;
        this.hiddenByRoomOnly.add(child);
      }
  }

  /** Puts the camera at a view preset (room space). */
  private view(name: string): void {
    const v = VIEWS[name];
    if (!v) return;
    const room = this.deps.room;
    room.updateMatrixWorld(true);
    // Eye stands at the player's eyes; the others stand where they say.
    const up = name === 'Eye' ? this.deps.eyeHeight() : 0;
    const eye = room.localToWorld(new Vector3(v[0][0], v[0][1] + up, v[0][2]));
    const target = room.localToWorld(new Vector3(v[1][0], v[1][1] + up, v[1][2]));
    this.deps.camera.position.copy(eye);
    this.orbit.target.copy(target);
    this.orbit.update();
  }

  /** The view is centred in the part of the window the panels don't cover (the editor's on the right, the assets' below). */
  private fitCamera(): void {
    const w = window.innerWidth,
      h = window.innerHeight;
    if (w < 700) this.deps.camera.clearViewOffset();
    else this.deps.camera.setViewOffset(w, h, this.panelWidth() / 2, this.assets.height / 2, w, h);
  }

  private panelWidth(): number {
    return Math.round(Math.min(Math.max(this.panelW, PANEL_MIN_W), Math.max(PANEL_MIN_W, window.innerWidth * 0.5)));
  }

  /** Sizes the panel (narrow windows put it along the bottom instead, at full width), the asset dock beside it, and the view. */
  private applyPanelWidth(): void {
    const narrow = window.innerWidth < 700;
    this.root.style.width = narrow ? '' : `${this.panelWidth()}px`;
    this.assets.setRight(this.panelWidth());
    this.fitCamera();
  }

  /** Dragging the panel's left edge sets its width. */
  private startResize(e: PointerEvent, grip: HTMLElement): void {
    if (e.button !== 0) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    this.root.classList.add('resizing');
    const move = (ev: PointerEvent) => {
      this.panelW = window.innerWidth - ev.clientX;
      this.applyPanelWidth();
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      this.root.classList.remove('resizing');
      this.panelW = this.panelWidth();
      try {
        localStorage.setItem(PANEL_W_KEY, String(this.panelW));
      } catch {
        // No storage (a private window): the width is kept for this page only.
      }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  }

  private findFile(path: string): AssetFileInfo | undefined {
    const state = this.client.current;
    if (!state) return undefined;
    const files = (f: typeof state.tree): AssetFileInfo[] => [...f.files, ...f.folders.flatMap(files)];
    return files(state.tree).find((f) => f.path === path);
  }

  /** Places a model where the view is looking: on the floor under the point the view turns about. */
  private async addInView(file: AssetFileInfo): Promise<void> {
    const room = this.deps.placed.parent('room');
    room.updateMatrixWorld(true);
    const at = room.worldToLocal(this.orbit.target.clone());
    await this.addModel(file.id, placement([at.x, 0, at.z]));
  }

  /**
   * Where a model dropped at a point of the window would stand: on the first upward-facing surface of the room under it (a
   * table, the bed, the tray: then on the lap), else on the floor. In the section's own space; null if it misses the floor.
   */
  private spotAt(clientX: number, clientY: number): { section: LayoutSection; pos: Vec3 } | null {
    const rect = this.deps.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.deps.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.deps.camera);
    const lap = this.deps.placed.parent('lap');
    for (const hit of this.raycaster.intersectObjects([...this.deps.roomRoots], true)) {
      if (!hit.face || hit.object === this.marker || !isShown(hit.object)) continue;
      const normal = this.up.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      if (normal.y < 0.7) continue;
      const section: LayoutSection = isWithin(hit.object, lap) ? 'lap' : 'room';
      const p = this.deps.placed.parent(section).worldToLocal(hit.point.clone());
      return { section, pos: [p.x, p.y, p.z] };
    }
    const room = this.deps.placed.parent('room');
    room.updateMatrixWorld(true);
    this.up.set(0, 1, 0).transformDirection(room.matrixWorld);
    this.floor.setFromNormalAndCoplanarPoint(this.up, room.getWorldPosition(new Vector3()));
    const point = this.raycaster.ray.intersectPlane(this.floor, new Vector3());
    if (!point) return null;
    const p = room.worldToLocal(point);
    return { section: 'room', pos: [p.x, 0, p.z] };
  }

  /** A click on the canvas (not a drag of the view or the gizmo) selects the piece under it, or nothing. */
  private click(e: PointerEvent): void {
    if (e.button !== 0 || this.gizmo.dragging || this.gizmo.axis !== null) return;
    if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 4) return;
    const rect = this.deps.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.deps.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.deps.camera);
    const pieces = this.pieces().filter((p) => p.object.visible);
    const hits = this.raycaster.intersectObjects(
      pieces.map((p) => p.object),
      true,
    );
    for (const hit of hits) {
      if (!isShown(hit.object)) continue;
      const piece = pieces.find((p) => isWithin(hit.object, p.object));
      if (piece) return this.select(piece);
    }
    this.select(null);
  }

  private key(e: KeyboardEvent, down: boolean): void {
    if (e.key === 'Shift') return this.setSnap(down);
    if (!down || e.altKey || e.metaKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey) {
      if (k === 'z') this.step(!e.shiftKey);
      else if (k === 'y') this.step(false);
      else if (k === 's') void this.save();
      else if (k === 'd') void this.duplicate();
      else return;
    } else if (e.key === 'Delete') this.remove();
    else if (k === 'w') this.setMode('translate');
    else if (k === 'e') this.setMode('rotate');
    else if (k === 'r') this.setMode('scale');
    else if (k === 'q') {
      this.gizmo.setSpace(this.gizmo.space === 'local' ? 'world' : 'local');
      this.render();
    } else if (e.key === 'Escape') this.select(null);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  private mount(): void {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    this.root.className = 'room-ed';
    this.root.style.display = 'none';
    this.root.innerHTML = `
      <div class="grip" title="Drag to resize (double-click: default width)"></div>
      <header><h1>Room editor</h1></header>
      <nav class="tabs"><button data-act="tab:inspect">Inspector</button>
        <button data-act="tab:scene">Scene <small id="re-count"></small></button></nav>
      <div class="pane" data-tab="inspect">
        <p class="hint">Click a piece, then drag the gizmo or type numbers. W move · E rotate · R scale · Q local/world ·
        Shift snaps · Esc deselects · Ctrl+Z / Ctrl+Y undo, redo · Ctrl+D copies · Delete removes · Ctrl+S saves.
        Drag empty space to look around.</p>
        <section><div class="row" id="re-modes"></div><div class="row" id="re-views"></div></section>
        <section class="card" id="re-piece"></section>
      </div>
      <div class="pane" data-tab="scene"><div class="tree" id="re-tree"></div></div>
      <section class="save"><button id="re-save" class="primary">Save room layout</button>
        <p id="re-status"></p><button id="re-close">Close editor</button></section>`;
    const grip = this.root.querySelector<HTMLElement>('.grip')!;
    grip.addEventListener('pointerdown', (e) => this.startResize(e, grip));
    grip.addEventListener('dblclick', () => {
      this.panelW = PANEL_W;
      this.applyPanelWidth();
      try {
        localStorage.removeItem(PANEL_W_KEY);
      } catch {
        // No storage.
      }
    });
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!b) return;
      const [act, arg] = (b.dataset.act ?? '').split(':');
      if (act === 'tab') {
        this.tab = arg as Tab;
        this.render();
      } else if (act === 'mode') this.setMode(arg as Mode);
      else if (act === 'space') {
        this.gizmo.setSpace(this.gizmo.space === 'local' ? 'world' : 'local');
        this.render();
      } else if (act === 'view') this.view(arg);
      else if (act === 'roomonly') this.setRoomOnly(!this.roomOnly);
      else if (act === 'pick') this.selectId(b.dataset.key ?? '');
      else if (act === 'undo') this.step(true);
      else if (act === 'redo') this.step(false);
      else if (act === 'reset') this.reset();
      else if (act === 'revert') this.revert();
      else if (act === 'copy') void this.duplicate();
      else if (act === 'export') void this.exportSelected();
      else if (act === 'remove') this.remove();
      else if (act === 'fold') {
        const group = b.dataset.group ?? '';
        if (!this.folded.delete(group)) this.folded.add(group);
        this.render();
      }
    });
    this.root.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const piece = this.selected;
      if (!piece || !input.dataset.field) return;
      const value = Number(input.value);
      if (!Number.isFinite(value)) return this.renderFields();
      const field = input.dataset.field as (typeof FIELDS)[number];
      const before = readPlacement(piece.object);
      const after = copyPlacement(before);
      after[field][Number(input.dataset.axis)] = value;
      this.commit(piece, before, roundPlacement(after));
    });
    // Enter keeps the number and hands the keys back to the editor (so Ctrl+Z undoes the edit, not the typing).
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.target.blur();
    });
    this.root.querySelector('#re-save')!.addEventListener('click', () => void this.save());
    this.root.querySelector('#re-close')!.addEventListener('click', () => this.hide());
    document.body.append(this.root);
  }

  private render(): void {
    if (!this.open) return;
    for (const b of this.root.querySelectorAll<HTMLElement>('.tabs [data-act]'))
      b.classList.toggle('on', b.dataset.act === `tab:${this.tab}`);
    for (const p of this.root.querySelectorAll<HTMLElement>('.pane'))
      p.classList.toggle('active', p.dataset.tab === this.tab);
    const mode = this.gizmo.mode as Mode;
    this.root.querySelector('#re-modes')!.innerHTML =
      (['translate', 'rotate', 'scale'] as const)
        .map(
          (m, i) =>
            `<button data-act="mode:${m}" class="${m === mode ? 'on' : ''}">${['Move W', 'Rotate E', 'Scale R'][i]}</button>`,
        )
        .join('') + `<button data-act="space">${this.gizmo.space === 'local' ? 'Local' : 'World'} Q</button>`;
    this.root.querySelector('#re-views')!.innerHTML =
      Object.keys(VIEWS)
        .map((v) => `<button data-act="view:${v}">${v}</button>`)
        .join('') + `<button data-act="roomonly" class="${this.roomOnly ? 'on' : ''}">Room only</button>`;

    const piece = this.selected;
    const shown = piece ? keyOf(piece) : null;
    if (shown !== this.shownKey) {
      this.shownKey = shown;
      this.root.querySelector('#re-piece')!.innerHTML = piece
        ? `<h2>Selected <span>${esc(piece.id)}</span> <small>${piece.section === 'lap' ? 'tray space' : 'room space'}${
            isPlaced(piece) ? ` · ${esc(piece.model)}` : ''
          }</small></h2><div class="body">
          ${FIELDS.map(
            (f) =>
              `<div class="field"><label>${FIELD_LABEL[f]}</label>${[0, 1, 2]
                .map(
                  (a) =>
                    `<input type="number" step="${f === 'rotDeg' ? 1 : 0.01}" data-field="${f}" data-axis="${a}" aria-label="${FIELD_LABEL[f]} ${'xyz'[a]}">`,
                )
                .join('')}</div>`,
          ).join('')}
          <div class="row"><button data-act="undo">Undo</button><button data-act="redo">Redo</button>
            <button data-act="revert" title="Back to where the file has it">Revert</button>
            <button data-act="reset" title="Back to the code's default">Reset</button></div>
          ${
            isPlaced(piece)
              ? `<div class="row"><button data-act="copy" title="Ctrl+D">Duplicate</button>
                  <button data-act="remove" title="Delete">Remove</button></div>`
              : `<div class="row"><button data-act="export"
                  title="Write it as a .glb to src/assets/models/exported/, to place copies or edit it in Blender">Export .glb</button></div>`
          }</div>`
        : `<h2>Selected <span>nothing</span></h2><div class="body"><p class="hint">Click a piece in the room, or pick one in the Scene tab.</p>
          <div class="row"><button data-act="undo">Undo</button><button data-act="redo">Redo</button></div></div>`;
    }
    this.root.querySelector<HTMLButtonElement>('[data-act="undo"]')!.disabled = !this.history.canUndo;
    this.root.querySelector<HTMLButtonElement>('[data-act="redo"]')!.disabled = !this.history.canRedo;
    this.renderFields();

    this.renderTree();

    const dirty = this.dirty;
    this.root.querySelector('#re-save')!.textContent = dirty ? 'Save room layout ●' : 'Save room layout';
    this.root.querySelector('#re-status')!.textContent =
      this.status || (dirty ? 'Unsaved changes' : 'Everything saved');
  }

  /** The scene tree: Room and Lap, each grouped by what owns the pieces (the models placed here are "Added"). */
  private renderTree(): void {
    const entries = [
      ...this.deps.sources.flatMap(({ label, source }) =>
        source.editables().map((p) => ({ key: keyOf(p), id: p.id, section: p.section, group: label })),
      ),
      ...this.deps.placed.editables().map((p) => ({ key: keyOf(p), id: p.id, section: p.section, group: ADDED })),
    ];
    const order = [...this.deps.sources.map((s) => s.label), ADDED];
    const selected = this.selected ? keyOf(this.selected) : null;
    this.root.querySelector('#re-count')!.textContent = `${entries.length} pieces`;
    this.root.querySelector('#re-tree')!.innerHTML = sceneTree(entries, order)
      .map(
        (section) =>
          `<div class="sec"><span>${section.label}</span><small>${section.section === 'lap' ? 'tray space' : 'room space'}</small></div>` +
          section.groups
            .map((g) => {
              const group = `${section.section}:${g.label}`;
              const open = !this.folded.has(group);
              const rows = open
                ? `<div class="kids">${g.entries
                    .map(
                      (e) =>
                        `<button class="node${e.key === selected ? ' on' : ''}" data-act="pick" data-key="${esc(e.key)}">${esc(e.id)}</button>`,
                    )
                    .join('')}</div>`
                : '';
              return `<button class="grp" data-act="fold" data-group="${esc(group)}"><span class="tw">${open ? '▾' : '▸'}</span>${esc(g.label)}
                <small>${g.entries.length}</small></button>${rows}`;
            })
            .join(''),
      )
      .join('');
  }

  /** Fills the number boxes from the selected piece (skipping the one being typed in). */
  private renderFields(): void {
    const piece = this.selected;
    if (!piece) return;
    const p = roundPlacement(readPlacement(piece.object));
    for (const input of this.root.querySelectorAll<HTMLInputElement>('input[data-field]')) {
      if (input === document.activeElement) continue;
      const field = input.dataset.field as (typeof FIELDS)[number];
      input.value = String(p[field][Number(input.dataset.axis)]);
    }
  }
}

function readStoredWidth(): number {
  try {
    const w = Number(localStorage.getItem(PANEL_W_KEY));
    return Number.isFinite(w) && w > 0 ? w : PANEL_W;
  } catch {
    return PANEL_W;
  }
}

function isCameraOrLight(o: Object3D): boolean {
  const flags = o as { isCamera?: boolean; isLight?: boolean };
  return !!flags.isCamera || !!flags.isLight;
}

/** Whether `o` is `ancestor` or under it. */
function isWithin(o: Object3D, ancestor: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (p === ancestor) return true;
  return false;
}

/** Whether `o` and everything above it is visible (a hidden painted stand-in is not picked). */
function isShown(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

const CSS = `
.room-ed {
  --ink: #ece6d8; --muted: #a8a294; --panel: #1b1e26; --line: #2e333f; --accent: #f0a24a;
  position: fixed; top: 0; right: 0; bottom: 0; width: ${PANEL_W}px; z-index: 11;
  box-sizing: border-box; display: flex; flex-direction: column;
  background: #14161c; color: var(--ink); border-left: 1px solid var(--line);
  font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (max-width: 699px) { .room-ed { top: auto; left: 0; width: auto; height: 45vh; border-left: 0; border-top: 1px solid var(--line); }
  .room-ed .grip { display: none; } }
.room-ed .grip { position: absolute; top: 0; bottom: 0; left: -4px; width: 8px; cursor: ew-resize; z-index: 2; }
.room-ed .grip:hover, .room-ed.resizing .grip { background: linear-gradient(90deg, transparent 3px, var(--accent) 3px, var(--accent) 5px, transparent 5px); }
.room-ed.resizing { user-select: none; }
.room-ed header { flex: none; padding: 12px 14px 8px; }
.room-ed h1 { margin: 0; font-size: 18px; font-weight: 650; }
.room-ed .tabs { flex: none; display: flex; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--line); }
.room-ed .tabs button { flex: 1; border: 1px solid transparent; border-bottom: 0; border-radius: 6px 6px 0 0; background: none;
  color: var(--muted); padding: 7px 8px; margin-bottom: -1px; }
.room-ed .tabs button:hover:not(:disabled) { border-color: transparent; color: var(--ink); }
.room-ed .tabs button.on { background: #1b1e26; border-color: var(--line); border-bottom: 1px solid #1b1e26; color: var(--ink); }
.room-ed .tabs small { color: var(--muted); font-weight: 400; margin-left: 3px; }
.room-ed .pane { flex: 1; min-height: 0; overflow-y: auto; background: #1b1e26; }
.room-ed .pane:not(.active) { display: none; }
.room-ed .pane[data-tab="inspect"] { padding: 12px 14px; display: none; flex-direction: column; gap: 14px; }
.room-ed .pane[data-tab="inspect"].active { display: flex; }
.room-ed .save { flex: none; padding: 12px 14px; border-top: 1px solid var(--line); }
.room-ed .hint, .room-ed #re-status { margin: 4px 0 0; color: var(--muted); font-size: 12px; }
.room-ed h2 { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
.room-ed h2 span { text-transform: none; letter-spacing: 0; color: var(--ink); font-size: 13px; margin-left: 6px; }
.room-ed h2 small { text-transform: none; letter-spacing: 0; margin-left: 6px; }
.room-ed .row, .room-ed .list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.room-ed button { font: 500 12.5px inherit; font-family: inherit; color: var(--ink); background: var(--panel);
  border: 1px solid var(--line); border-radius: 6px; padding: 6px 9px; cursor: pointer; }
.room-ed button:hover:not(:disabled) { border-color: var(--muted); }
.room-ed button:disabled { opacity: .4; cursor: default; }
.room-ed button.on { border-color: var(--accent); color: var(--accent); }
.room-ed button.primary { width: 100%; background: var(--accent); border-color: var(--accent); color: #1b1307; font-weight: 650; }
.room-ed .save { display: grid; gap: 6px; }
.room-ed .field { display: grid; grid-template-columns: 82px repeat(3, 1fr); gap: 4px; align-items: center; margin-bottom: 6px; }
.room-ed .field label { font-size: 12px; color: var(--muted); }
.room-ed input { width: 100%; box-sizing: border-box; font: 12.5px ui-monospace, Consolas, monospace; color: var(--ink);
  background: var(--panel); border: 1px solid var(--line); border-radius: 5px; padding: 4px 5px; }
.room-ed input:focus { outline: none; border-color: var(--accent); }
.room-ed .card { background: #15171d; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.room-ed .card > h2 { margin: 0; padding: 7px 10px; background: #1f232c; border-bottom: 1px solid var(--line); }
.room-ed .card > .body { padding: 10px 10px 4px; }
.room-ed .tree { padding-bottom: 8px; }
.room-ed .tree .sec { position: sticky; top: 0; z-index: 1; display: flex; align-items: baseline; justify-content: space-between;
  padding: 6px 12px; background: #262b36; border-bottom: 1px solid var(--line); font-size: 11px; font-weight: 650;
  text-transform: uppercase; letter-spacing: .07em; }
.room-ed .tree .sec:not(:first-child) { border-top: 1px solid var(--line); margin-top: 4px; }
.room-ed .tree .sec small { text-transform: none; letter-spacing: 0; font-weight: 400; color: var(--muted); }
.room-ed .tree button { display: block; width: 100%; text-align: left; border: 1px solid transparent; background: none;
  padding: 3px 6px; border-radius: 4px; }
.room-ed .tree button:hover { background: #1f232c; }
.room-ed .tree .grp { margin: 2px 4px 0; width: calc(100% - 8px); color: var(--muted); font-weight: 600; }
.room-ed .tree .grp .tw { display: inline-block; width: 14px; font-size: 10px; }
.room-ed .tree .grp small { margin-left: 4px; opacity: .7; font-weight: 400; }
.room-ed .tree .kids { margin: 0 6px 2px 16px; padding-left: 6px; border-left: 1px solid var(--line); }
.room-ed .tree .node.on { color: var(--accent); border-color: var(--accent); background: #221f1a; }
`;
