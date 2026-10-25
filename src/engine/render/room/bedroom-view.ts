// Child's bedroom background environment in seated VR: a cold winter room with wooden
// rafters overhead, timber floorboards below, moonlit window to the left, straw pallet bed
// and tin can on the right, and rustic timber wall framing wrapping around the stage.
//
// Zero per-frame allocations. All Three.js imports from @iwsdk/core.
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from '@iwsdk/core';
import type { BufferGeometry, Material, Quaternion } from '@iwsdk/core';
import type { LanternLight } from '../../shadow/pure/lantern-light';

export const MOONLIGHT_COLOR = 0x4a6a9d;
export const NIGHT_AMBIENT = 0x141d2e;

const BASE_FLOOR = new Color(0x221a14);
const BASE_RAFTER = new Color(0x1a120b);
const BASE_WALL = new Color(0x1c1713);
const CANDLE_AMBER = new Color(0xff9933);
const MOON_BLUE = new Color(MOONLIGHT_COLOR);

export class BedroomView {
  readonly group = new Group();
  readonly moonlight: DirectionalLight;

  // Key mesh references for testing & inspection
  readonly floorMesh: Mesh;
  readonly ceilingMesh: Mesh;
  readonly windowGroup = new Group();
  readonly strawPalletGroup = new Group();
  readonly tinCanGroup = new Group();
  readonly frontWallMesh: Mesh;

  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  private readonly floorMat: MeshBasicMaterial;
  private readonly rafterMat: MeshBasicMaterial;
  private readonly wallMat: MeshBasicMaterial;
  private readonly slatMat: MeshBasicMaterial;

  private readonly scratchColor = new Color();

  constructor() {
    // -------------------------------------------------------------
    // 1. Floor & Timber Plank Slat Grooves (Y = 0)
    // -------------------------------------------------------------
    const floorGeo = new PlaneGeometry(4.0, 4.5);
    floorGeo.rotateX(-Math.PI / 2);
    this.floorMat = new MeshBasicMaterial({ color: BASE_FLOOR });
    this.floorMesh = new Mesh(floorGeo, this.floorMat);
    this.floorMesh.position.set(0, 0, -0.4); // Centered under seated player
    this.register(floorGeo, this.floorMat);

    // Floor plank accent slats (dark grooved divisions along Z)
    const slatGeo = new BoxGeometry(0.02, 0.004, 4.5);
    this.slatMat = new MeshBasicMaterial({ color: 0x120c08 });
    this.register(slatGeo, this.slatMat);
    for (let x = -1.6; x <= 1.6; x += 0.4) {
      const slat = new Mesh(slatGeo, this.slatMat);
      slat.position.set(x, 0.002, -0.4);
      this.group.add(slat);
    }

    // -------------------------------------------------------------
    // 2. Ceiling & Timber Rafter Crossbeams (Y = 2.5m)
    // -------------------------------------------------------------
    const ceilingGeo = new PlaneGeometry(4.0, 4.5);
    ceilingGeo.rotateX(Math.PI / 2);
    const ceilingMat = new MeshBasicMaterial({ color: 0x140e0a });
    this.ceilingMesh = new Mesh(ceilingGeo, ceilingMat);
    this.ceilingMesh.position.set(0, 2.5, -0.4);
    this.register(ceilingGeo, ceilingMat);

    // Ceiling rafter crossbeams (dark transverse timber beams overhead)
    const rafterGeo = new BoxGeometry(4.0, 0.12, 0.12);
    this.rafterMat = new MeshBasicMaterial({ color: BASE_RAFTER });
    this.register(rafterGeo, this.rafterMat);
    const rafterZ = [-2.0, -1.2, -0.4, 0.4, 1.2];
    for (const rz of rafterZ) {
      const rafter = new Mesh(rafterGeo, this.rafterMat);
      rafter.position.set(0, 2.44, rz);
      this.group.add(rafter);
    }

    // -------------------------------------------------------------
    // 3. Walls Framing (Left, Right, Back, Front Behind Stage)
    // -------------------------------------------------------------
    this.wallMat = new MeshBasicMaterial({ color: BASE_WALL });
    this.materials.push(this.wallMat);

    // Left Wall (X = -2.0m)
    const leftWallGeo = new PlaneGeometry(4.5, 2.5);
    leftWallGeo.rotateY(Math.PI / 2);
    const leftWall = new Mesh(leftWallGeo, this.wallMat);
    leftWall.position.set(-2.0, 1.25, -0.4);
    this.register(leftWallGeo);

    // Right Wall (X = +2.0m)
    const rightWallGeo = new PlaneGeometry(4.5, 2.5);
    rightWallGeo.rotateY(-Math.PI / 2);
    const rightWall = new Mesh(rightWallGeo, this.wallMat);
    rightWall.position.set(2.0, 1.25, -0.4);
    this.register(rightWallGeo);

    // Back Wall (Z = +1.85m behind the player)
    const backWallGeo = new PlaneGeometry(4.0, 2.5);
    backWallGeo.rotateY(Math.PI);
    const backWall = new Mesh(backWallGeo, this.wallMat);
    backWall.position.set(0, 1.25, 1.85);
    this.register(backWallGeo);

    // Front Wall (Z = -1.75m, behind the shadow stage at ~1.45m)
    const frontWallGeo = new PlaneGeometry(4.0, 2.5);
    this.frontWallMesh = new Mesh(frontWallGeo, this.wallMat);
    this.frontWallMesh.position.set(0, 1.25, -1.75);
    this.register(frontWallGeo);

    // Front wall baseboard
    const baseboardGeo = new BoxGeometry(4.0, 0.25, 0.04);
    const baseboard = new Mesh(baseboardGeo, this.wallMat);
    baseboard.position.set(0, 0.125, -1.74);
    this.register(baseboardGeo);

    // -------------------------------------------------------------
    // 4. Window with Moonbeam on Left Wall (X = -2.0m, Z = -1.0m)
    // -------------------------------------------------------------
    const frameWoodMat = new MeshBasicMaterial({ color: 0x2e2318 });
    this.materials.push(frameWoodMat);

    // Vertical frame sides
    const wPostGeo = new BoxGeometry(0.06, 1.2, 0.06);
    this.register(wPostGeo);
    const wPostL = new Mesh(wPostGeo, frameWoodMat);
    wPostL.position.set(-1.97, 1.45, -1.45);
    const wPostR = new Mesh(wPostGeo, frameWoodMat);
    wPostR.position.set(-1.97, 1.45, -0.55);

    // Horizontal frame top & bottom
    const wBarGeo = new BoxGeometry(0.06, 0.06, 0.96);
    this.register(wBarGeo);
    const wBarT = new Mesh(wBarGeo, frameWoodMat);
    wBarT.position.set(-1.97, 2.02, -1.0);
    const wBarB = new Mesh(wBarGeo, frameWoodMat);
    wBarB.position.set(-1.97, 0.88, -1.0);

    // Window Mullions (cross)
    const mullionVGeo = new BoxGeometry(0.03, 1.08, 0.03);
    const mullionHGeo = new BoxGeometry(0.03, 0.03, 0.84);
    this.register(mullionVGeo);
    this.register(mullionHGeo);
    const mullionV = new Mesh(mullionVGeo, frameWoodMat);
    mullionV.position.set(-1.97, 1.45, -1.0);
    const mullionH = new Mesh(mullionHGeo, frameWoodMat);
    mullionH.position.set(-1.97, 1.45, -1.0);

    // Window Sill
    const sillGeo = new BoxGeometry(0.16, 0.05, 1.1);
    const sill = new Mesh(sillGeo, frameWoodMat);
    sill.position.set(-1.94, 0.85, -1.0);
    this.register(sillGeo);

    // Midnight Sky Quad outside the window
    const skyGeo = new PlaneGeometry(1.1, 1.3);
    skyGeo.rotateY(Math.PI / 2);
    const skyMat = new MeshBasicMaterial({ color: 0x050811 });
    const skyMesh = new Mesh(skyGeo, skyMat);
    skyMesh.position.set(-2.02, 1.45, -1.0);
    this.register(skyGeo, skyMat);

    // Soft moon wash polygon
    const moonWashGeo = new PlaneGeometry(0.85, 1.05);
    moonWashGeo.rotateY(Math.PI / 2);
    const moonWashMat = new MeshBasicMaterial({
      color: MOONLIGHT_COLOR,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: DoubleSide,
    });
    const moonWash = new Mesh(moonWashGeo, moonWashMat);
    moonWash.position.set(-1.96, 1.45, -1.0);
    this.register(moonWashGeo, moonWashMat);

    this.windowGroup.add(wPostL, wPostR, wBarT, wBarB, mullionV, mullionH, sill, skyMesh, moonWash);

    // -------------------------------------------------------------
    // 5. Straw Pallet (Bed) on Floor Against Right Wall (X = 1.4m)
    // -------------------------------------------------------------
    const palletGeo = new BoxGeometry(0.85, 0.14, 1.65);
    const palletMat = new MeshBasicMaterial({ color: 0x423522 });
    const palletMesh = new Mesh(palletGeo, palletMat);
    palletMesh.position.set(1.4, 0.07, -1.0);
    this.register(palletGeo, palletMat);

    // Folded quilt blanket on the straw bed
    const foldedBlanketGeo = new BoxGeometry(0.82, 0.04, 1.15);
    const foldedBlanketMat = new MeshBasicMaterial({ color: 0x2b3442 });
    const foldedBlanket = new Mesh(foldedBlanketGeo, foldedBlanketMat);
    foldedBlanket.position.set(1.4, 0.15, -0.85);
    this.register(foldedBlanketGeo, foldedBlanketMat);

    // Crude burlap pillow
    const pillowGeo = new BoxGeometry(0.65, 0.09, 0.35);
    const pillowMat = new MeshBasicMaterial({ color: 0x4f422e });
    const pillow = new Mesh(pillowGeo, pillowMat);
    pillow.position.set(1.4, 0.16, -1.55);
    this.register(pillowGeo, pillowMat);

    this.strawPalletGroup.add(palletMesh, foldedBlanket, pillow);

    // -------------------------------------------------------------
    // 6. Reused Tin Can & Wooden Spoon on Floor Near Bed
    // -------------------------------------------------------------
    const canGeo = new CylinderGeometry(0.045, 0.045, 0.075, 10, 1, true);
    const canMat = new MeshBasicMaterial({ color: 0x5a5d62 });
    const canMesh = new Mesh(canGeo, canMat);
    canMesh.position.set(0.95, 0.038, -0.5);
    this.register(canGeo, canMat);

    // Whittled wooden spoon tilted in can
    const spoonGeo = new BoxGeometry(0.016, 0.12, 0.008);
    spoonGeo.rotateZ(0.35);
    const spoonMat = new MeshBasicMaterial({ color: 0x6e5238 });
    const spoonMesh = new Mesh(spoonGeo, spoonMat);
    spoonMesh.position.set(0.96, 0.07, -0.5);
    this.register(spoonGeo, spoonMat);

    this.tinCanGroup.add(canMesh, spoonMesh);

    // -------------------------------------------------------------
    // 7. Directional Moonlight (Entering through the Left Window)
    // -------------------------------------------------------------
    this.moonlight = new DirectionalLight(MOONLIGHT_COLOR, 0.28);
    this.moonlight.position.set(-2.4, 2.2, -1.0);
    this.moonlight.target.position.set(0, 0.5, -0.8);

    // Assemble group
    this.group.add(
      this.floorMesh,
      this.ceilingMesh,
      leftWall,
      rightWall,
      backWall,
      this.frontWallMesh,
      baseboard,
      this.windowGroup,
      this.strawPalletGroup,
      this.tinCanGroup,
      this.moonlight,
      this.moonlight.target,
    );
  }

  private register(geo: BufferGeometry, mat?: Material): void {
    this.geometries.push(geo);
    if (mat) this.materials.push(mat);
  }

  /**
   * Aligns the bedroom around the player's seated pose on VR start.
   * Player sits at (head[0], 0, head[2]) facing yaw.
   */
  place(head: ArrayLike<number>, yaw: number): void {
    this.group.position.set(head[0], 0, head[2]);
    this.group.rotation.y = yaw;
  }

  /**
   * Dynamically synchronizes room ambiance between warm candlelight and cold blue moonlight.
   * Zero per-frame allocations.
   */
  update(light: Readonly<LanternLight>, _cameraQuaternion?: Readonly<Quaternion>, occlusion = 1.0): void {
    const brightness = light.lit ? Math.max(0.04, occlusion * (0.2 + 0.8 * light.intensity)) : 0.04;

    if (light.lit && brightness > 0.05) {
      // Lit phase: Warm timber glow
      this.scratchColor.copy(BASE_FLOOR).lerp(CANDLE_AMBER, brightness * 0.28);
      this.floorMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_RAFTER).lerp(CANDLE_AMBER, brightness * 0.25);
      this.rafterMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_WALL).lerp(CANDLE_AMBER, brightness * 0.22);
      this.wallMat.color.copy(this.scratchColor);

      this.moonlight.intensity = 0.18; // Soft fill under warm candle
    } else {
      // Unlit/smothered phase: Room bathed in cold blue moonlight
      this.scratchColor.copy(BASE_FLOOR).lerp(MOON_BLUE, 0.35);
      this.floorMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_RAFTER).lerp(MOON_BLUE, 0.32);
      this.rafterMat.color.copy(this.scratchColor);

      this.scratchColor.copy(BASE_WALL).lerp(MOON_BLUE, 0.3);
      this.wallMat.color.copy(this.scratchColor);

      this.moonlight.intensity = 0.35; // Moonlight stands out cleanly
    }
  }

  /** Disposes all allocated geometries and materials. */
  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
