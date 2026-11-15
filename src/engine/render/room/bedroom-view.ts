// Child's bedroom background environment in seated VR: a cold winter room with wooden
// rafters overhead, timber floorboards below, moonlit window to the left, straw pallet bed
// and tin can on the right, and rustic timber wall framing wrapping around the stage.
//
// Zero per-frame allocations. All Three.js imports from @iwsdk/core.
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from '@iwsdk/core';
import type { BufferGeometry, Material, Quaternion } from '@iwsdk/core';
import { mergeBoxes } from '../../shadow/merge-boxes';
import type { LanternLight } from '../../shadow/pure/lantern-light';
import { ROOM_BACK_WALL_Z, ROOM_DEPTH_M, ROOM_MID_Z, ROOM_WALL_BEHIND_STAGE_M } from '../../stage/stage-frame';
import type { CandleLight } from '../../shadow/candle-light';
import { placement, placementOr, type RoomLayout } from '../../stage/room-layout';
import { applyPlacement, type EditablePiece, type EditableSource } from '../../shadow/room-placement';

/** The bedroom view's pieces the room layout file places (`room` section). */
export const BEDROOM_VIEW_PIECE_IDS: readonly string[] = ['tin-can', 'player'];

/**
 * How far the player's spot may be from the room's middle (m): on x, inside the side walls; on z, from where the front wall
 * (which keeps the stage's distance ahead of the player) would pass the far end of the room's walls, to short of the back wall.
 */
export const PLAYER_SPOT_LIMITS = { x: 1.6, zMin: -0.85, zMax: ROOM_BACK_WALL_Z - 0.45 } as const;

export const MOONLIGHT_COLOR = 0x4a6a9d;
export const NIGHT_AMBIENT = 0x141d2e;

const BASE_FLOOR = new Color(0x221a14);
const BASE_RAFTER = new Color(0x1a120b);
const BASE_WALL = new Color(0x1c1713);
const CANDLE_AMBER = new Color(0xff9933);
const MOON_BLUE = new Color(MOONLIGHT_COLOR);
/** How much brighter the shell's own colours are than its old final look (they are lit now: dim moonlight, the candle's light). */
const ALBEDO_GAIN = 3.5;

function createFloorTexture(customCanvas?: HTMLCanvasElement): CanvasTexture {
  let canvas = customCanvas;
  if (!canvas && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
  }
  if (!canvas) {
    canvas = {
      width: 256,
      height: 256,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
  }
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx) {
    // Base rich timber plank tone
    ctx.fillStyle = '#221a14';
    ctx.fillRect(0, 0, 256, 256);

    // 4 vertical floor planks with subtle tone differences
    const pw = 256 / 4;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)';
      ctx.fillRect(i * pw, 0, pw, 256);

      // Clean dark wood plank seam line (2px wide) baked directly into texture
      // Eliminates depth-buffer z-fighting and flickering lines completely
      ctx.fillStyle = '#0f0a07';
      ctx.fillRect(i * pw, 0, 2, 256);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(2, (4 * ROOM_DEPTH_M) / 5); // the planks keep their size (4 repeats were drawn for 5 m)
  return texture;
}

export class BedroomView implements EditableSource {
  readonly group = new Group();
  readonly moonlight: DirectionalLight;

  // Key mesh references for testing & inspection
  readonly floorMesh: Mesh;
  readonly ceilingMesh: Mesh;
  readonly windowGroup = new Group();
  readonly strawPalletGroup = new Group();
  readonly tinCanGroup = new Group();
  /**
   * Where the player sits, in room space (the `player` piece): the room is placed so this spot is under the head. Only its x and
   * z count (the eyes' height is the headset's, and the player always faces the wall ahead). The room editor hangs its headset
   * marker on it.
   */
  readonly playerSpot = new Object3D();
  readonly frontWallMesh: Mesh;
  private readonly leftWallMesh: Mesh;
  private readonly rightWallMesh: Mesh;
  private readonly backWallMesh: Mesh;
  private readonly skyMesh: Mesh;

  private readonly floorTexture: CanvasTexture;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  private readonly floorMat: MeshBasicMaterial;
  private readonly rafterMat: MeshBasicMaterial;
  private readonly wallMat: MeshBasicMaterial;

  private readonly scratchColor = new Color();
  /** Whether the candle lights the room (useCandleLight): then update() leaves the colours alone. */
  private candleLit = false;

  private readonly pieces: EditablePiece[] = [];
  private candle: CandleLight | null = null;

  /** @param layout where the tin can stands (the room layout file); its default where it says nothing */
  constructor(layout: Readonly<RoomLayout> | null = null) {
    // -------------------------------------------------------------
    // 1. Floor with Baked Plank Seams (Zero Z-Fighting, No Flickering)
    // -------------------------------------------------------------
    this.floorTexture = createFloorTexture();
    const floorGeo = new PlaneGeometry(4.0, ROOM_DEPTH_M);
    floorGeo.rotateX(-Math.PI / 2);
    this.floorMat = new MeshBasicMaterial({
      map: this.floorTexture,
      color: BASE_FLOOR,
    });
    this.floorMesh = new Mesh(floorGeo, this.floorMat);
    this.floorMesh.position.set(0, 0, ROOM_MID_Z); // from the room's front end to the back wall
    this.register(floorGeo, this.floorMat);

    // -------------------------------------------------------------
    // 2. Ceiling & Timber Rafter Crossbeams (Y = 2.5m)
    // -------------------------------------------------------------
    const ceilingGeo = new PlaneGeometry(4.0, ROOM_DEPTH_M);
    ceilingGeo.rotateX(Math.PI / 2);
    const ceilingMat = new MeshBasicMaterial({ color: 0x140e0a });
    this.ceilingMesh = new Mesh(ceilingGeo, ceilingMat);
    this.ceilingMesh.position.set(0, 2.5, ROOM_MID_Z);
    this.register(ceilingGeo, ceilingMat);

    // Ceiling rafter crossbeams (dark transverse timber beams overhead)
    const rafterGeo = new BoxGeometry(4.0, 0.12, 0.12);
    this.rafterMat = new MeshBasicMaterial({ color: BASE_RAFTER });
    this.register(rafterGeo, this.rafterMat);
    const rafterZ = [-2.2, -1.4, -0.6, 0.2].filter((z) => z < ROOM_BACK_WALL_Z - 0.1);
    const rafters = new InstancedMesh(rafterGeo, this.rafterMat, rafterZ.length);
    const rafterMatrix = new Matrix4();
    rafterZ.forEach((rz, i) => rafters.setMatrixAt(i, rafterMatrix.makeTranslation(0, 2.44, rz)));
    rafters.instanceMatrix.needsUpdate = true;
    rafters.matrixAutoUpdate = false;
    this.group.add(rafters); // five beams, one draw call

    // -------------------------------------------------------------
    // 3. Walls Framing (Left, Right, Back, Front Safely Behind Stage)
    // -------------------------------------------------------------
    this.wallMat = new MeshBasicMaterial({
      color: BASE_WALL,
      depthWrite: false, // Ensures walls never block or occlude stage paper or shadows
    });
    this.materials.push(this.wallMat);

    // Left Wall (X = -2.0m)
    const leftWallGeo = new PlaneGeometry(ROOM_DEPTH_M, 2.5);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = (this.leftWallMesh = new Mesh(leftWallGeo, this.wallMat));
    leftWall.position.set(-2.0, 1.25, ROOM_MID_Z);
    this.register(leftWallGeo);

    // Right Wall (X = +2.0m)
    const rightWallGeo = new PlaneGeometry(ROOM_DEPTH_M, 2.5);
    rightWallGeo.rotateY(-Math.PI / 2);
    const rightWall = (this.rightWallMesh = new Mesh(rightWallGeo, this.wallMat));
    rightWall.position.set(2.0, 1.25, ROOM_MID_Z);
    this.register(rightWallGeo);

    // Back Wall, behind the player, against the bed's headboard
    const backWallGeo = new PlaneGeometry(4.0, 2.5);
    backWallGeo.rotateY(Math.PI);
    const backWall = (this.backWallMesh = new Mesh(backWallGeo, this.wallMat));
    backWall.position.set(0, 1.25, ROOM_BACK_WALL_Z);
    this.register(backWallGeo);

    // Front Wall Backdrop (Positioned well behind stage at Z = -2.4m, renderOrder -10)
    const frontWallGeo = new PlaneGeometry(4.0, 2.5);
    this.frontWallMesh = new Mesh(frontWallGeo, this.wallMat);
    this.frontWallMesh.position.set(0, 1.25, -2.4);
    this.frontWallMesh.renderOrder = -10;
    this.register(frontWallGeo);

    // -------------------------------------------------------------
    // 4. Window with Moonbeam on Left Wall (X = -2.0m, Z = -0.8m)
    // -------------------------------------------------------------
    const frameWoodMat = new MeshBasicMaterial({ color: 0x2e2318 });
    this.materials.push(frameWoodMat);

    // The frame (two posts, top and bottom bars, the cross mullions and the sill) is one mesh: they share a material.
    const wPostGeo = new BoxGeometry(0.06, 1.2, 0.06);
    const wBarGeo = new BoxGeometry(0.06, 0.06, 0.96);
    const mullionVGeo = new BoxGeometry(0.03, 1.08, 0.03);
    const mullionHGeo = new BoxGeometry(0.03, 0.03, 0.84);
    const sillGeo = new BoxGeometry(0.16, 0.05, 1.1);
    const frameGeo = mergeBoxes([
      { geo: wPostGeo, x: -1.97, y: 1.45, z: -1.25 },
      { geo: wPostGeo, x: -1.97, y: 1.45, z: -0.35 },
      { geo: wBarGeo, x: -1.97, y: 2.02, z: -0.8 },
      { geo: wBarGeo, x: -1.97, y: 0.88, z: -0.8 },
      { geo: mullionVGeo, x: -1.97, y: 1.45, z: -0.8 },
      { geo: mullionHGeo, x: -1.97, y: 1.45, z: -0.8 },
      { geo: sillGeo, x: -1.94, y: 0.85, z: -0.8 },
    ]);
    for (const g of [wPostGeo, wBarGeo, mullionVGeo, mullionHGeo, sillGeo]) g.dispose();
    this.register(frameGeo);
    const frame = new Mesh(frameGeo, frameWoodMat);

    // Midnight Sky Quad outside the window
    const skyGeo = new PlaneGeometry(1.1, 1.3);
    skyGeo.rotateY(Math.PI / 2);
    const skyMat = new MeshBasicMaterial({ color: 0x050811 });
    const skyMesh = (this.skyMesh = new Mesh(skyGeo, skyMat));
    skyMesh.position.set(-2.02, 1.45, -0.8);
    this.register(skyGeo, skyMat);

    // Soft moon wash polygon
    const moonWashGeo = new PlaneGeometry(0.85, 1.05);
    moonWashGeo.rotateY(Math.PI / 2);
    const moonWashMat = new MeshBasicMaterial({
      color: MOONLIGHT_COLOR,
      transparent: true,
      opacity: 0.04, // faint: the night outside is dark
      depthWrite: false,
      side: DoubleSide,
    });
    const moonWash = new Mesh(moonWashGeo, moonWashMat);
    moonWash.position.set(-1.96, 1.45, -0.8);
    this.register(moonWashGeo, moonWashMat);

    this.windowGroup.add(frame, skyMesh, moonWash);

    // -------------------------------------------------------------
    // 5. Straw Pallet (Bed) on Floor Against Right Wall (X = 1.4m)
    // -------------------------------------------------------------
    const palletGeo = new BoxGeometry(0.85, 0.14, 1.65);
    const palletMat = new MeshBasicMaterial({ color: 0x423522 });
    const palletMesh = new Mesh(palletGeo, palletMat);
    palletMesh.position.set(1.4, 0.07, -0.8);
    this.register(palletGeo, palletMat);

    // Folded quilt blanket on the straw bed
    const foldedBlanketGeo = new BoxGeometry(0.82, 0.04, 1.15);
    const foldedBlanketMat = new MeshBasicMaterial({ color: 0x2b3442 });
    const foldedBlanket = new Mesh(foldedBlanketGeo, foldedBlanketMat);
    foldedBlanket.position.set(1.4, 0.15, -0.65);
    this.register(foldedBlanketGeo, foldedBlanketMat);

    // Crude burlap pillow
    const pillowGeo = new BoxGeometry(0.65, 0.09, 0.35);
    const pillowMat = new MeshBasicMaterial({ color: 0x4f422e });
    const pillow = new Mesh(pillowGeo, pillowMat);
    pillow.position.set(1.4, 0.16, -1.35);
    this.register(pillowGeo, pillowMat);

    this.strawPalletGroup.add(palletMesh, foldedBlanket, pillow);

    // -------------------------------------------------------------
    // 6. Reused Tin Can & Wooden Spoon on Floor Near Bed
    // -------------------------------------------------------------
    const canGeo = new CylinderGeometry(0.045, 0.045, 0.075, 10, 1, true);
    const canMat = new MeshBasicMaterial({ color: 0x5a5d62 });
    const canMesh = new Mesh(canGeo, canMat);
    canMesh.position.set(0, 0.038, 0);
    this.register(canGeo, canMat);

    // Whittled wooden spoon tilted in can
    const spoonGeo = new BoxGeometry(0.016, 0.12, 0.008);
    spoonGeo.rotateZ(0.35);
    const spoonMat = new MeshBasicMaterial({ color: 0x6e5238 });
    const spoonMesh = new Mesh(spoonGeo, spoonMat);
    spoonMesh.position.set(0.01, 0.07, 0);
    this.register(spoonGeo, spoonMat);

    this.tinCanGroup.add(canMesh, spoonMesh);
    this.tinCanGroup.name = 'tin-can';
    const canDefault = placement([0.95, 0, -0.4]);
    applyPlacement(this.tinCanGroup, placementOr(layout, 'room', 'tin-can', canDefault));
    this.pieces.push({ id: 'tin-can', section: 'room', object: this.tinCanGroup, fallback: canDefault });

    this.playerSpot.name = 'player';
    const playerDefault = placement([0, 0, 0]);
    applyPlacement(this.playerSpot, placementOr(layout, 'room', 'player', playerDefault));
    this.pieces.push({ id: 'player', section: 'room', object: this.playerSpot, fallback: playerDefault });

    // -------------------------------------------------------------
    // 7. Directional Moonlight (Entering through the Left Window)
    // -------------------------------------------------------------
    this.moonlight = new DirectionalLight(MOONLIGHT_COLOR, 0.05);
    this.moonlight.position.set(-2.4, 2.2, -0.8);
    this.moonlight.target.position.set(0, 0.5, -0.6);

    // Assemble group
    this.group.add(
      this.floorMesh,
      this.ceilingMesh,
      leftWall,
      rightWall,
      backWall,
      this.frontWallMesh,
      this.windowGroup,
      this.strawPalletGroup,
      this.tinCanGroup,
      this.playerSpot,
      this.moonlight,
      this.moonlight.target,
    );
  }

  /** The tin can and the player's spot, for the room editor. */
  editables(): readonly EditablePiece[] {
    return this.pieces;
  }

  /** Called after the room editor moves the player's spot, before the shadows are cast again (main.ts places the rig again). */
  onPlayerMoved: (() => void) | null = null;

  /** A piece moved (in the editor): the candle's shadows are cast again; if it was the player's spot, the rig follows it. */
  moved(piece?: EditablePiece): void {
    if (piece?.object === this.playerSpot) this.onPlayerMoved?.();
    this.candle?.rebake();
  }

  /** The player's spot in room space (x, z), kept inside the room (PLAYER_SPOT_LIMITS). */
  playerX(): number {
    const { x } = PLAYER_SPOT_LIMITS;
    return Math.min(x, Math.max(-x, this.playerSpot.position.x));
  }
  playerZ(): number {
    return Math.min(PLAYER_SPOT_LIMITS.zMax, Math.max(PLAYER_SPOT_LIMITS.zMin, this.playerSpot.position.z));
  }

  /**
   * Hides the plain left, right, back and front walls and the sky quad behind the window, for when something painted covers them (the
   * room dressing's own walls sit just in front of them and are drawn first): they would be drawn only to fail the depth test.
   */
  setWallsCovered(covered: boolean): void {
    this.leftWallMesh.visible = !covered;
    this.rightWallMesh.visible = !covered;
    this.backWallMesh.visible = !covered;
    this.frontWallMesh.visible = !covered;
    this.skyMesh.visible = !covered;
  }

  /**
   * Makes the candle a real light for the room's shell (candle-light.ts): the floor, ceiling, rafters, walls and window frame are lit
   * by it per pixel and take the props' shadows. The night sky and the moon's wash keep their own light. Call once.
   */
  useCandleLight(candle: CandleLight): void {
    this.candle = candle;
    this.candleLit = true;
    this.floorMat.color.copy(BASE_FLOOR);
    this.rafterMat.color.copy(BASE_RAFTER);
    this.wallMat.color.copy(BASE_WALL);
    for (const m of this.materials) {
      if (!(m instanceof MeshBasicMaterial) || m.transparent || m === this.skyMesh.material) continue;
      // The colours were picked as the final, moonlit look; as the surfaces' own colours under the faint moonlight they are
      // brightened so the unlit room looks as it did.
      m.color.multiplyScalar(ALBEDO_GAIN);
      candle.light(m);
    }
  }

  private register(geo: BufferGeometry, mat?: Material): void {
    this.geometries.push(geo);
    if (mat) this.materials.push(mat);
  }

  /**
   * Aligns the bedroom around the player's seated pose: the room turns with the head's `yaw` and stands so that the player's spot
   * (playerSpot) is under the head at (head[0], head[2]). `stageDist` is how far ahead the stage is: the front wall is just
   * behind it, so it moves with the player's spot, and the stage stays where it was tuned.
   */
  place(head: ArrayLike<number>, yaw: number, stageDist = 2.0): void {
    const px = this.playerX(),
      pz = this.playerZ();
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    // The room's yaw turns its (px, pz) into the world's (px c + pz s, -px s + pz c): take that off the head.
    this.group.position.set(head[0] - (px * c + pz * s), 0, head[2] - (-px * s + pz * c));
    this.group.rotation.y = yaw;
    // The front wall is the wall the stage is on: just behind the stage plane.
    const wallZ = pz - (Math.max(stageDist, 1.5) + ROOM_WALL_BEHIND_STAGE_M);
    this.frontWallMesh.position.set(0, 1.25, wallZ);
  }

  /**
   * Dynamically synchronizes room ambiance between warm candlelight and cold blue moonlight.
   * Zero per-frame allocations.
   */
  update(light: Readonly<LanternLight>, _cameraQuaternion?: Readonly<Quaternion>, occlusion = 1.0): void {
    const brightness = light.lit ? Math.max(0.04, occlusion * (0.2 + 0.8 * light.intensity)) : 0.04;
    // With the candle as a light (useCandleLight) the light does the colouring: the surfaces keep their own colours, and the
    // moonlight stays as it is (the candle adds to it).
    if (this.candleLit) return;

    if (light.lit && brightness > 0.05) {
      // Lit phase: Warm timber glow
      this.scratchColor.copy(BASE_FLOOR).lerp(CANDLE_AMBER, brightness * 0.2);
      this.floorMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_RAFTER).lerp(CANDLE_AMBER, brightness * 0.035);
      this.rafterMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_WALL).lerp(CANDLE_AMBER, brightness * 0.25);
      this.wallMat.color.copy(this.scratchColor);

      this.moonlight.intensity = 0.2; // Soft fill under warm candle
    } else {
      // Unlit/smothered/start phase: Dark, quiet moonlit room matching pause menu
      this.scratchColor.copy(BASE_FLOOR).lerp(MOON_BLUE, 0.12);
      this.floorMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_RAFTER).lerp(MOON_BLUE, 0.12);
      this.rafterMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_WALL).lerp(MOON_BLUE, 0.12);
      this.wallMat.color.copy(this.scratchColor);

      this.moonlight.intensity = 0.05; // Deep quiet darkness
    }
  }

  /** Disposes all allocated geometries and materials. */
  dispose(): void {
    this.floorTexture.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
