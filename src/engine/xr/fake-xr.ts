// Fake WebXR objects for unit tests of the capability layer and plane tracker,
// in the style of src/debug/anchor-probe.test.ts. Test-only: not imported by
// the game. Only the members our code reads are filled in.

export interface FakePlaneInit {
  orientation?: 'horizontal' | 'vertical';
  /** Column-major 4x4 pose in reference space. */
  matrix: number[];
  /** x, z pairs in plane space. */
  polygon: [number, number][];
  label?: string;
  time?: number;
}

export type FakePlane = XRPlane & { matrix: Float32Array; lastChangedTime: number; polygon: DOMPointReadOnly[] };

export function fakePlane(init: FakePlaneInit): FakePlane {
  return {
    planeSpace: {} as XRSpace,
    orientation: init.orientation ?? 'horizontal',
    polygon: init.polygon.map(([x, z]) => ({ x, y: 0, z, w: 1 }) as DOMPointReadOnly),
    lastChangedTime: init.time ?? 0,
    semanticLabel: init.label,
    matrix: new Float32Array(init.matrix),
  } as unknown as FakePlane;
}

/** A pose matrix: translation (x, y, z), local +Y along `up` (only +Y or -Y supported). */
export function poseMatrix(x: number, y: number, z: number, up: 1 | -1 = 1): number[] {
  // up = -1: 180° about X, so Y and Z flip.
  return [1, 0, 0, 0, 0, up, 0, 0, 0, 0, up, 0, x, y, z, 1];
}

export interface FakeFrameInit {
  planes?: Set<XRPlane> | 'absent' | 'throws';
  meshes?: Set<unknown> | 'absent';
  createAnchor?: boolean;
  trackedAnchors?: Set<unknown>;
  /** Viewer position in reference space; null for no viewer pose. */
  viewer?: [number, number, number] | null;
  /** Planes whose getPose returns null. */
  noPose?: Set<XRPlane>;
}

export type FakeFrame = XRFrame & { poseCalls: number };

export function fakeFrame(session: XRSession, init: FakeFrameInit = {}): FakeFrame {
  const viewer = init.viewer === undefined ? [0, 1.6, 0] : init.viewer;
  const frame = {
    session,
    poseCalls: 0,
    getPose(space: XRSpace) {
      frame.poseCalls++;
      // Looked up in the set at call time, so planes added later have poses too.
      let plane: FakePlane | undefined;
      if (init.planes instanceof Set) for (const p of init.planes) if (p.planeSpace === space) plane = p as FakePlane;
      if (!plane || init.noPose?.has(plane)) return null;
      return { transform: { matrix: plane.matrix } };
    },
    getViewerPose() {
      return viewer ? { transform: { position: { x: viewer[0], y: viewer[1], z: viewer[2], w: 1 } } } : null;
    },
    trackedAnchors: init.trackedAnchors,
    createAnchor: init.createAnchor ? () => Promise.resolve({}) : undefined,
  };
  if (init.planes === 'throws')
    Object.defineProperty(frame, 'detectedPlanes', {
      get: () => {
        throw new Error('plane detection failed');
      },
    });
  else if (init.planes !== 'absent') Object.assign(frame, { detectedPlanes: init.planes ?? new Set() });
  if (init.meshes !== 'absent') Object.assign(frame, { detectedMeshes: init.meshes ?? new Set() });
  return frame as unknown as FakeFrame;
}

export interface FakeSessionInit {
  enabledFeatures?: string[];
  blend?: XREnvironmentBlendMode;
  /** Hands present as input sources. */
  hands?: ('left' | 'right')[];
  restore?: boolean;
  persistentAnchors?: string[];
}

export function fakeSession(init: FakeSessionInit = {}): XRSession & { inputSources: XRInputSource[] } {
  return {
    enabledFeatures: init.enabledFeatures,
    environmentBlendMode: init.blend,
    inputSources: (init.hands ?? []).map((handedness) => ({ handedness, hand: {} })),
    restorePersistentAnchor: init.restore ? () => Promise.resolve({}) : undefined,
    persistentAnchors: init.persistentAnchors,
  } as unknown as XRSession & { inputSources: XRInputSource[] };
}

/** A reference space with addEventListener, like a real one. */
export function fakeRefSpace(): XRReferenceSpace & { listeners: Map<string, () => void> } {
  const listeners = new Map<string, () => void>();
  return {
    listeners,
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener: (type: string, fn: () => void) => {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
  } as unknown as XRReferenceSpace & { listeners: Map<string, () => void> };
}

export const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
