// Converts MediaPipe Hand Landmarker output (21 landmarks per hand, from a
// webcam) into the HandFrame format (25 WebXR joints), so the classifier and
// the webcam test page see the same data shape as on a headset.
//
// Caveats compared with a headset: depth comes from one camera (approximate),
// the viewpoint is the webcam's (facing the player), and the noise differs.
import { JOINT_COUNT, type HandFrame, type Handedness } from '../hands/hand';

/** A MediaPipe landmark: image coords are 0..1 (x right, y down); world coords are metres. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// WebXR joint index -> MediaPipe landmark index. -1 marks the four finger
// metacarpal joints, which MediaPipe doesn't have (they sit near the wrist).
// MediaPipe: 0 wrist; thumb 1 CMC, 2 MCP, 3 IP, 4 tip; fingers MCP, PIP, DIP, tip
// (index 5-8, middle 9-12, ring 13-16, pinky 17-20).
const FROM_MEDIAPIPE = [
  0,
  1, 2, 3, 4,
  -1, 5, 6, 7, 8,
  -1, 9, 10, 11, 12,
  -1, 13, 14, 15, 16,
  -1, 17, 18, 19, 20,
];
/** Where an estimated metacarpal joint sits, as a fraction of the way from the wrist to the knuckle. */
const METACARPAL_T = 0.15;
const TIP_JOINTS = new Set([4, 9, 14, 19, 24]);

/**
 * MediaPipe's handedness label for an unmirrored camera frame. Its docs say the
 * label assumes a mirrored image, but on a real photo (person facing the camera,
 * unmirrored) the label matched the person's actual hands, and swapping it also
 * flipped both palm normals the wrong way. So the label is used as is.
 * We pass raw getUserMedia frames; only the on-screen preview is mirrored, with CSS.
 */
export function handednessFromLabel(label: string): Handedness {
  return label.toLowerCase() === 'left' ? 'left' : 'right';
}

/**
 * Writes one MediaPipe hand into `out`.
 * Scene axes: the webcam is the viewer at the origin looking down -Z, +Y up,
 * +X to the camera's right. MediaPipe world axes are x right, y down, z away
 * from the camera; flipping y and z is a rotation, so left and right hands keep
 * their true shape (which derivePalm relies on).
 *
 * @param world  worldLandmarks for this hand (metres, origin near the hand centre)
 * @param image  landmarks for this hand (0..1 image coords), used to place the hand in the scene
 * @param depthM how far in front of the camera to place the hand
 * @param widthM scene width that the camera image spans at that depth
 */
export function mediapipeToHandFrame(world: Landmark[], image: Landmark[], out: HandFrame, depthM = 0.5, widthM = 0.6): HandFrame {
  if (world.length !== 21 || image.length !== 21) {
    out.tracked = false;
    out.validJoints = 0;
    return out;
  }
  // Hand centre in the scene from the wrist's image position.
  const cx = (image[0].x - 0.5) * widthM;
  const cy = (0.5 - image[0].y) * widthM * 0.75;
  const ox = cx - world[0].x, oy = cy + world[0].y, oz = -depthM + world[0].z;
  const p = out.positions;
  for (let j = 0; j < JOINT_COUNT; j++) {
    let m = FROM_MEDIAPIPE[j];
    let x: number, y: number, z: number;
    if (m >= 0) {
      ({ x, y, z } = world[m]);
    } else {
      m = FROM_MEDIAPIPE[j + 1]; // the knuckle after it
      x = world[0].x + (world[m].x - world[0].x) * METACARPAL_T;
      y = world[0].y + (world[m].y - world[0].y) * METACARPAL_T;
      z = world[0].z + (world[m].z - world[0].z) * METACARPAL_T;
    }
    p[j * 3] = x + ox;
    p[j * 3 + 1] = -y + oy;
    p[j * 3 + 2] = -z + oz;
    out.radii[j] = TIP_JOINTS.has(j) ? 0.006 : 0.008;
  }
  out.tracked = true;
  out.validJoints = JOINT_COUNT;
  return out;
}
