import * as THREE from "three";

// The guide's device is four files put together in the model frame of
// 3dforweb.glb (see geometry.ts: the device stands facing +z, knobs top
// right, 10 mm per unit):
//   - case-v39.glb   the v3.9 enclosure (body, back_slider, back_plate,
//                    top_lid) and knobs c1..c4, exported from
//                    hardware/case/source/patternflow_case.blend (collection
//                    0904_v3.9, its assembled copy) by the pure translation
//                    (−300.2723, +58.4313, −1.9078) that lands the blend's LED
//                    panel exactly on 3dforweb.glb's
//   - 3dforweb.glb   the landing page's model, of which only that LED mesh,
//                    "l", is used
//   - pcb-v39.glb    the v3.9 board, exported from hardware/pcb/kicad with
//                    kicad-cli, placed so its four encoders sit under the knobs
//   - devkit.glb     the ESP32-S3 DevKit, in a canonical frame: origin at the
//                    board's centre, +Y toward the antenna, +Z out of the
//                    component side, +X to the reader's right, metres.

export const CASE_URL = "/guide/case-v39.glb";
export const PCB_URL = "/guide/pcb-v39.glb";
export const DEVKIT_URL = "/guide/devkit.glb";

/** Metres → model units. */
export const M_TO_MODEL = 100;

// kicad-cli pcb export glb --user-origin 91.5x101.375mm --include-soldermask
// --include-silkscreen --include-pads (metres, board centre at the origin,
// +Y the F side). SW1..SW4's shafts land on the knob axes (within 1e-4). In
// depth the board sits where the blend's assembly has it: the encoders'
// bodies bear on the inside of the front face (z 1.2628; their tops end at
// 1.2622), which puts the board at z 0.506…0.657 — within 0.07 mm of the
// blend's own board.
export const PCB_PLACEMENT = {
  position: new THREE.Vector3(8.0515, 24.9577, 0.6572),
  quaternion: new THREE.Quaternion(0, Math.SQRT1_2, -Math.SQRT1_2, 0),
  scale: 100,
};

// Seated on U1's sockets on the back of the board: centred on the socket rows
// (x 6.79 / 9.33, pins 19.81…25.14), component side to the back (−z), pins
// toward the board, USB-C end at the bottom (the v3.9 silkscreen's "USB") —
// a half turn about y. Its pin housings (4.8 mm under its board) rest on the
// socket tops at z −0.352; it spans z −1.208…0.076, the depth the blend's
// assembly gives its own DevKit (the blend's sits 1.8 mm further right, on
// the older board's sockets). 4.3 mm clear of the closed back slider.
export const DEVKIT_SEAT = {
  position: new THREE.Vector3(8.0565, 22.4732, -0.8323),
  quaternion: new THREE.Quaternion(0, 1, 0, 0),
};

// Held up in front of the reader, right of the device, antenna up,
// component side to the camera, a little turned.
export const DEVKIT_PRESENT = {
  position: new THREE.Vector3(26, 15, 24),
  quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, -0.32, 0.02)),
};

/**
 * The back slider (case-v39.glb's "back_slider"): the cover over the board
 * and the DevKit on the back of the case. Dovetails along its top and bottom
 * edges run in grooves in the body along x, a tongue on its inner end sits in
 * a groove of the body's inner wall, and a flex tab there clicks into a notch
 * in the back plate; its outer end is flush with the case's right side (seen
 * from the front), where the side wall stops short of it. It opens by
 * sliding out that side, +x, and comes off after its own length (10.30).
 *
 * sliderPose's travel b: 0 shut; SLIDER_OFF slid 4 mm clear of the case
 * (10.7 along +x); 1 carried on the same way and laid down on the floor well
 * to the right, outer face up, out of the chapter's shots, so the DevKit
 * shots don't have a loose cover in them. It stays right of the case's side
 * the whole way, so it never crosses the case or the DevKit (whose lift
 * waits for it to clear the rails, and whose carry waits for it to be down).
 */
export const SLIDER_OFF = 0.5;
/** Seconds for each leg: along the rails, then away and down onto the floor. */
export const SLIDER_SECONDS = { slide: 0.8, setDown: 1.2 };
const SLIDER_TRAVEL = 10.7;
// The slider's own centre in the model frame (its node sits at the origin).
const SLIDER_CENTRE = new THREE.Vector3(7.0095, 25.4965, -1.7695);
// Lying flat: a quarter turn about x (outer face up); its 2.77 mm thickness
// then rests on the floor (world y −1.66 = model y −0.1).
const SLIDER_DOWN_CENTRE = new THREE.Vector3(60, -0.1 + 0.1385 + 0.003, -14);
const SLIDER_DOWN_QUAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

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

/** Where on devkitPose's travel the straight lift off the pins ends. */
export const DEVKIT_LIFT_END = 0.25;

// Straight back off the pins until the pin tips are 6 mm behind the case's
// back (they start at z 0.076; the back is at −1.908).
const LIFT = 2.6;
// Then two cubics joined smoothly at MID: right and down behind the case,
// staying behind its back until clear of its right side and passing under the
// slid-out slider (its bottom edge is at y 18.82; the DevKit's top stays
// below 18.0), then forward round the side to the front. Checked against the
// case, the slid-out slider, the board and the knobs at 121 points along the
// way: the DevKit's convex hull never comes within 0.6 (6 mm) of any of them
// once off its pins.
const OUT_DIR = new THREE.Vector3(3, -1.5, 0);
const MID = new THREE.Vector3(17, 14.5, -2.6);
const MID_DIR = new THREE.Vector3(2.2, -0.4, 2.2);
const LAST_CTRL = new THREE.Vector3(26.5, 14.5, 15);
const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };

function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, u: number, out: THREE.Vector3) {
  const v = 1 - u;
  const w0 = v * v * v;
  const w1 = 3 * v * v * u;
  const w2 = 3 * v * u * u;
  const w3 = u * u * u;
  return out.set(
    p0.x * w0 + p1.x * w1 + p2.x * w2 + p3.x * w3,
    p0.y * w0 + p1.y * w1 + p2.y * w2 + p3.y * w3,
    p0.z * w0 + p1.z * w1 + p2.z * w2 + p3.z * w3,
  );
}

/**
 * Where the DevKit is for a travel parameter t (0 = seated, 1 = presented).
 * Up to DEVKIT_LIFT_END it comes straight back out of its sockets and stops
 * clear of the case, behind the opening; from there it travels round the
 * case's right side to the front, turning to face the reader once it is out
 * from behind. Each leg eases in and out on its own, so the lift is its own
 * beat.
 */
export function devkitPose(t: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  const home = DEVKIT_SEAT.position;
  if (t <= DEVKIT_LIFT_END) {
    const e = smooth(t / DEVKIT_LIFT_END);
    outPos.set(home.x, home.y, home.z - LIFT * e);
    outQuat.copy(DEVKIT_SEAT.quaternion);
    return;
  }
  const u = smooth((t - DEVKIT_LIFT_END) / (1 - DEVKIT_LIFT_END));
  const lifted = tmp.a.set(home.x, home.y, home.z - LIFT);
  if (u < 0.5) {
    bezier(lifted, tmp.b.copy(lifted).add(OUT_DIR), tmp.c.copy(MID).sub(MID_DIR), MID, u * 2, outPos);
  } else {
    bezier(MID, tmp.b.copy(MID).add(MID_DIR), LAST_CTRL, DEVKIT_PRESENT.position, u * 2 - 1, outPos);
  }
  outQuat.slerpQuaternions(DEVKIT_SEAT.quaternion, DEVKIT_PRESENT.quaternion, smooth((u - 0.4) / 0.5));
}

const sliderTmp = { off: new THREE.Vector3(), c1: new THREE.Vector3(), c2: new THREE.Vector3(), c: new THREE.Vector3() };
// On along the rails' line, then over and down onto the floor.
const SLIDER_ON = new THREE.Vector3(9, 0, -1.5);
const SLIDER_ABOVE = new THREE.Vector3(0, 11, 0);
const IDENTITY = new THREE.Quaternion();

/**
 * The back slider's node transform for its travel b (see SLIDER_OFF): along
 * its rails, then carried on and laid down on the floor, turning about its
 * own centre. Writes the node's position and quaternion.
 */
export function sliderPose(b: number, outPos: THREE.Vector3, outQuat: THREE.Quaternion) {
  const t = sliderTmp;
  if (b <= SLIDER_OFF) {
    outPos.set(SLIDER_TRAVEL * smooth(b / SLIDER_OFF), 0, 0);
    outQuat.identity();
    return;
  }
  const u = smooth((b - SLIDER_OFF) / (1 - SLIDER_OFF));
  const off = t.off.copy(SLIDER_CENTRE).setX(SLIDER_CENTRE.x + SLIDER_TRAVEL);
  t.c1.copy(off).add(SLIDER_ON);
  t.c2.copy(SLIDER_DOWN_CENTRE).add(SLIDER_ABOVE);
  bezier(off, t.c1, t.c2, SLIDER_DOWN_CENTRE, u, t.c);
  outQuat.slerpQuaternions(IDENTITY, SLIDER_DOWN_QUAT, smooth((u - 0.3) / 0.6));
  // position = centre − R·(own centre)
  outPos.copy(SLIDER_CENTRE).applyQuaternion(outQuat).negate().add(t.c);
}
