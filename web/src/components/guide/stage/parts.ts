import * as THREE from "three";

// The guide's device is three files put together in the model frame of
// 3dforweb.glb (see geometry.ts: the device stands facing +z, knobs top
// right, about 10 mm per unit):
//   - 3dforweb.glb   the case, the knobs and the LED panel (the landing
//                    page's model; its own old PCB, node "p", is hidden)
//   - pcb-v39.glb    the v3.9 board, exported from hardware/pcb/kicad with
//                    kicad-cli, placed so its four encoders sit under the knobs
//   - devkit.glb     the ESP32-S3 DevKit, in a canonical frame: origin at the
//                    board's centre, +Y toward the antenna, +Z out of the
//                    component side, +X to the reader's right, metres.

export const PCB_URL = "/guide/pcb-v39.glb";
export const DEVKIT_URL = "/guide/devkit.glb";

/** Metres → model units. */
export const M_TO_MODEL = 100;

// kicad-cli pcb export glb --user-origin 91.5x101.375mm --include-soldermask
// --include-silkscreen --include-pads (metres, board centre at the origin,
// +Y the F side). Placed so SW1..SW4's shafts land on the knob axes (within
// 1e-4) and the board sits where the old one did (z 0.56…0.71).
export const PCB_PLACEMENT = {
  position: new THREE.Vector3(8.0515, 24.9577, 0.7107),
  quaternion: new THREE.Quaternion(0, Math.SQRT1_2, -Math.SQRT1_2, 0),
  scale: 100,
};

// Seated on U1's sockets on the back of the board: centred on the socket rows
// (x 6.79 / 9.33, pins 19.81…25.14), component side to the back (−z), pins
// toward the board, USB-C end at the bottom (the v3.9 silkscreen's "USB") —
// a half turn about y. Its pin housings (4.8 mm under its board) rest on the
// socket tops at z −0.299.
export const DEVKIT_SEAT = {
  position: new THREE.Vector3(8.0565, 22.4732, -0.7788),
  quaternion: new THREE.Quaternion(0, 1, 0, 0),
};

// Held up in front of the reader, right of the device, antenna up,
// component side to the camera, a little turned.
export const DEVKIT_PRESENT = {
  position: new THREE.Vector3(26, 15, 24),
  quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, -0.32, 0.02)),
};

/** Feature points on the DevKit, canonical frame, metres. */
// Measured off devkit.glb (a USB-C DevKitC-1 clone: native USB on the left,
// the CH343P UART bridge beside the right port; RST above BOOT, as its
// silkscreen has them).
export const KIT = {
  /** Port mouths; plugs slide in along +Y. */
  usb: new THREE.Vector3(-0.00595, -0.02853, 0.00216),
  uart: new THREE.Vector3(0.00595, -0.02853, 0.00216),
  boot: new THREE.Vector3(0.00514, -0.0003, 0.00221),
  rst: new THREE.Vector3(0.00514, 0.00491, 0.00221),
  module: new THREE.Vector3(0.0001, 0.01903, 0.0037),
  /** The printed antenna on the module's overhang. */
  antenna: new THREE.Vector3(-0.0004, 0.0315, 0.0013),
  /** How far a button cap travels when pressed. */
  press: 0.00025,
};

/**
 * Where the DevKit is for a travel parameter t (0 = seated, 1 = presented):
 * straight back out of the sockets first, then round the side to the front.
 */
export function devkitPose(t: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  const home = DEVKIT_SEAT.position;
  // Straight off the pins first (they are 8.6 mm long), then out behind.
  const lift = new THREE.Vector3(home.x + 1.5, home.y, home.z - 6);
  const swing = new THREE.Vector3(24, 16, -4);
  const end = DEVKIT_PRESENT.position;
  const e = t * t * (3 - 2 * t);
  if (e < 0.3) {
    outPos.lerpVectors(home, lift, e / 0.3);
    outQuat.copy(DEVKIT_SEAT.quaternion);
  } else {
    const u = (e - 0.3) / 0.7;
    const a = new THREE.Vector3().lerpVectors(lift, swing, u);
    const b = new THREE.Vector3().lerpVectors(swing, end, u);
    outPos.lerpVectors(a, b, u);
    outQuat.slerpQuaternions(DEVKIT_SEAT.quaternion, DEVKIT_PRESENT.quaternion, u);
  }
}
