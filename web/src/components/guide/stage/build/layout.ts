import * as THREE from "three";
import { PCB_PLACEMENT } from "../parts";

// Where everything is on the build stage, in the guide's model frame
// (geometry.ts: 10 mm per unit, the device stands facing +z with its knob
// column on +x, top +y; the floor is at y −0.1). Every number that says where
// a part goes was measured, not placed by eye:
//
//   - the board, its parts and its pads: hardware/pcb/kicad/patternflow.kicad_pcb
//     (pads.ts, generated) and pcb-v39.glb, whose frame is KiCad's
//     (x, z) = ((X − 91.5) / 1000, (Y − 101.375) / 1000) m, +y out of the
//     F side; PCB_PLACEMENT puts it in the case
//   - the case: the 0904_v3.9 collection of hardware/case/source/
//     patternflow_case.blend, sectioned (scratchpad build3d/analyze_case.py):
//     the frame's twelve panel-screw slots, the hole from the power-bank tray
//     into the board bay, and the notch in the bay wall the cables go through
//   - the print plates: hardware/case/bed_256mm/patternflow_v3.3mf, laid out
//     as the slicer has them, and each part's pose on its plate registered
//     against the same part in the case (build3d/register_plates.py)
//
// The re-runnable scripts are kept with the guide's other asset pipelines
// (the scratchpad's build3d/): export_build.py (Blender: case-split.glb and
// plates.glb), kicad_pads.py (pads.ts), register_plates.py (PLATE_POSES).

export const SPLIT_URL = "/guide/build/case-split.glb";
export const PLATES_URL = "/guide/build/plates.glb";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const q = (x: number, y: number, z: number, order: THREE.EulerOrder = "XYZ") => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));

/** A place and a turn in the model frame. */
export type Pose = { p: THREE.Vector3; q: THREE.Quaternion };

// ── the board ────────────────────────────────────────────────────────────────

/** In the case (parts.ts). */
export const BOARD_IN_CASE: Pose = { p: PCB_PLACEMENT.position.clone(), q: PCB_PLACEMENT.quaternion.clone() };
/** Hovering 7 units behind its bay, PATTERNFLOW side to the back, while J4 is wired (BUILD_GUIDE §7.3). */
export const BOARD_HOVER: Pose = { p: PCB_PLACEMENT.position.clone().add(v(0, 0, -7)), q: PCB_PLACEMENT.quaternion.clone() };

/** The bench: a mat on the floor in front of where the case will stand. */
export const BENCH = v(0, 0, 30);
export const MAT_TOP = 0.03;
/** The bare board lying flat on the mat, PATTERNFLOW (F) side up, encoders' end away from the reader. */
export const BOARD_FLAT: Pose = { p: v(0, MAT_TOP, 30), q: new THREE.Quaternion() };
/**
 * Held in a PCB holder for soldering, high enough that the encoders (25.6 mm
 * below the board once fitted) clear the mat; it flips about its long axis
 * (z), so the holder's jaws grip its two short edges.
 */
export const BOARD_WORK: Pose = { p: v(0, 2.95, 30), q: new THREE.Quaternion() };
/**
 * Lifted off the mat and held up to the reader (print-1): stood up 60° about
 * x, so its PATTERNFLOW face looks back along the view (boardLift) and its
 * encoder end is up; its bottom edge stays just clear of the mat.
 */
export const BOARD_LIFT: Pose = { p: v(0, 6.4, 29), q: q(1.05, 0, 0) };
/** Out of the way while the case prints (print-1 → solder-1). */
export const BOARD_PARK: Pose = { p: v(34, MAT_TOP, 26), q: q(0, -0.4, 0) };
/** The holder's two posts, at the board's short edges (its z ends, 11.6 units apart). */
export const HOLDER_Z = [30 - 6.15, 30 + 6.15] as const;

/** Board-local (pcb-v39.glb, metres) → model, for a board pose. */
export function boardToModel(local: THREE.Vector3, pose: Pose, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(local).multiplyScalar(PCB_PLACEMENT.scale).applyQuaternion(pose.q).add(pose.p);
}

// The parts as they arrive on the mat: a row behind the board in the order
// they are soldered (BUILD_GUIDE_v2 §4's small-to-tall order mapped onto v3's
// refs), each upright as it will sit on the board; the encoders shaft-up with
// their washer and nut in front of them.
export const ROW_Z = 21.6;
export const ROW: Record<string, number> = {
  "U1_socket_pins1-22": -6.8,
  "U1_socket_pins23-44": -5.6,
  J1: -3.9,
  J3: -1.6,
  J4: 0.6,
  C11: 2.9,
  SW1: 5.4,
  SW2: 7.8,
  SW3: 10.2,
  SW4: 12.6,
};
/** Where each encoder's washer and nut wait, in front of it. */
export const NUT_ROW_Z = 19.1;
/** The order the parts arrive in, and are soldered in. */
export const PART_ORDER = ["U1_socket_pins1-22", "U1_socket_pins23-44", "J1", "J3", "J4", "C11", "SW1", "SW2", "SW3", "SW4"] as const;
export type PartName = (typeof PART_ORDER)[number];

/** The DevKit on the mat beside the board, component side up, antenna away. */
export const DEVKIT_BENCH: Pose = { p: v(9.6, MAT_TOP + 0.9, 31.4), q: q(-Math.PI / 2, 0, 0.12) };

// ── off-board parts on the bench (gather-2) ─────────────────────────────────

/**
 * The panel lying face down left of the board, its IN end (top) to the left:
 * the pose of its centre (PANEL_CENTRE when assembled). Assembled, the LED
 * face looks along +z and the top is +y; face down, +z → −y and top → −x.
 * Its front face is 0.85 in front of its centre.
 */
export const PANEL_BENCH: Pose = (() => {
  const m = new THREE.Matrix4().makeBasis(v(0, 0, 1), v(-1, 0, 0), v(0, -1, 0));
  return { p: v(-24, MAT_TOP + 0.85, 30), q: new THREE.Quaternion().setFromRotationMatrix(m) };
})();
/** The panel's place in the case: the landing model's LED mesh "l", whose front face is at z 1.4977 and back at −0.2023. */
export const PANEL_HOME = { p: v(-4.1908, 16.2677, 1.4977), back: -0.2023 };
/** The panel's centre in the model frame when assembled. */
export const PANEL_CENTRE = v(-4.1908, 16.2677, 0.6477);

/** Twelve M4 screws lying in a row in front of the board. */
export const SCREW_BENCH_Z = 39.2;
export const SCREW_BENCH_X0 = -4.4;
export const SCREW_BENCH_DX = 0.8;
/** The sacrificial USB cable, coiled. */
export const USB_COIL = v(16.5, MAT_TOP, 24.5);
/** The power bank, lying flat. */
export const BANK_BENCH: Pose = { p: v(18.6, MAT_TOP + 0.75, 33.2), q: q(-Math.PI / 2, 0, 0.18) };

// ── the case (blend sections, analyze_case.py) ──────────────────────────────

/**
 * The twelve slots in the frame's panel tabs (4.5 mm wide, 5.8–7.3 mm long,
 * along y), through which M4 × 10 screws go into the panel's threaded
 * bosses. The tabs' back face is at z −0.64, their front on the panel's
 * back. The first six are the corners and the middles (BUILD_GUIDE §6.2:
 * six spread over the corners and the middle hold it).
 */
export const SCREW_HOLES: readonly [number, number][] = [
  [-11.052, 3.993],
  [2.688, 3.993],
  [-11.052, 28.583],
  [2.688, 28.583],
  [-11.052, 13.131],
  [2.688, 19.436],
  [-8.403, 1.395],
  [0.034, 1.395],
  [-8.403, 31.162],
  [0.034, 31.162],
  [-11.052, 19.436],
  [2.688, 13.131],
];
export const TAB_BACK_Z = -0.64;

/**
 * The hole from the power-bank tray (the front pocket under the knob column,
 * y 0.25…18.85, closed by the top lid) up into the board bay (y 19.0…32.2):
 * a cut in the wall between them at x 6.98…9.51, z −1.36…−0.30.
 */
export const TRAY_HOLE = v(8.25, 18.92, -0.83);
/** The tray's inside: x 4.1…11.9, y 0.25…18.85, z −1.6 (its back) … 1.36 (under the lid). */
export const TRAY = { x0: 4.1, x1: 11.9, y0: 0.25, y1: 18.85, z0: -1.6, z1: 1.36 };
/**
 * The notch in the wall between the board bay and the panel (x ≈ 4), open
 * from the back: y 22.1…25.3, z −1.9…≈−0.5 — the ribbon and the panel's
 * power lead go through it.
 */
export const NOTCH = v(4.0, 23.7, -1.2);
/** The top lid opens by sliding out along +x (the production photos); open, it clears the tray. */
export const LID_OPEN = 8.4;
/** The case's front face (geometry.ts), where the encoder washers sit. */
export const FRONT_Z = 1.5635;

// ── the panel's back (procedural, Stage) ─────────────────────────────────────

/** Its HUB75 IN header, near the top, a little toward the board bay (production photos). */
export const PANEL_IN = v(-2.9, 28.3, -0.2023);
export const PANEL_OUT = v(-3.6, 4.3, -0.2023);
/** Its 4-pin power connector, in the middle. */
export const PANEL_POWER = v(-4.6, 15.4, -0.2023);

// ── the print plates (register_plates.py) ────────────────────────────────────

/** Four 256 mm plates, laid out as the slicer has them, behind where the case will stand. */
export const PLATE_SIZE = 25.6;
export const PLATE_TOP = 0.12;
const PLATES_CENTRE = v(0, 0, -48);
const PLATE_STRIDE = PLATE_SIZE * 1.2;
/** The plate's corner (plate-local origin: x right, z toward −z, y up), model frame. */
export function plateCorner(plate: number, out = new THREE.Vector3()): THREE.Vector3 {
  const i = plate - 1;
  const cx = PLATES_CENTRE.x + ((i % 2) - 0.5) * PLATE_STRIDE;
  const cz = PLATES_CENTRE.z + (Math.floor(i / 2) - 0.5) * PLATE_STRIDE;
  return out.set(cx - PLATE_SIZE / 2, PLATE_TOP, cz + PLATE_SIZE / 2);
}
export function plateCentre(plate: number, out = new THREE.Vector3()): THREE.Vector3 {
  return plateCorner(plate, out).add(v(PLATE_SIZE / 2, 0, -PLATE_SIZE / 2));
}

/**
 * Each printed part where it lies on its plate, as the transform that takes
 * it from its place in the case (model frame) to the plate (plate-local).
 * Column-major (Matrix4.fromArray). Mean surface distance after the fit:
 * 0.01–0.5 mm.
 */
export const PLATE_POSES = {
  frame_bottom: { plate: 1, matrix: [0.70718, 5.8432e-5, 0.707033, 0, -9.24964e-5, 1, 9.87166e-6, 0, -0.707033, -7.2379e-5, 0.70718, 0, 11.0594, 0.0698205, -11.2853, 1] },
  frame_top: { plate: 1, matrix: [0.707166, -0.00125591, 0.707046, 0, -0.000637844, -0.999999, -0.00113832, 0, 0.707047, 0.000353999, -0.707166, 0, 14.4433, 32.5353, -14.3883, 1] },
  back_bottom: { plate: 2, matrix: [0.999909, -0.00529471, -0.0124181, 0, 0.0124236, 0.00100351, 0.999922, 0, -0.00528183, -0.999985, 0.0010692, 0, 12.8581, -1.69178, -22.4946, 1] },
  back_top: { plate: 3, matrix: [1, -0.000545417, 0.000831393, 0, 0.000831857, 0.000850963, -0.999999, 0, 0.000544709, 0.999999, 0.000851416, 0, 12.7126, 1.88265, 7.64514, 1] },
  top_lid: { plate: 2, matrix: [-0.99983, 7.17554e-6, 0.0184238, 0, -0.0184238, -0.00103156, -0.99983, 0, 1.18309e-5, -0.999999, 0.00103152, 0, 29.2624, 1.56815, -4.91301, 1] },
  back_slider: { plate: 3, matrix: [0.999997, -0.000496362, 0.00218818, 0, 0.00218817, -5.67203e-6, -0.999998, 0, 0.000496373, 1, -4.58589e-6, 0, 12.9848, 1.91228, 17.7163, 1] },
} as const;
export type PlatePart = keyof typeof PLATE_POSES;

/** The four knobs on plate 4, printed top down (closed top on the plate): their axes, plate-local. */
export const KNOB_PLATE_XZ: readonly [number, number][] = [
  [14.6751, -11.0632],
  [14.6751, -13.4202],
  [14.6751, -15.7773],
  [14.6751, -18.1344],
];
/** The plate parts' heights, for the print's rising layer line (plates.glb). */
export const PLATE_HEIGHT = [0, 17.53, 0.54, 0.54, 2.0] as const;

// ── where the printed parts wait (print-4 → chapter 07) ──────────────────────

/** The bonded back panel, lying flat outer face up, left of the case. */
export const BACK_REST: Pose = { p: v(-27, 0, 6), q: q(Math.PI / 2, 0, 0) };
/** The PCB cover, lying flat right of the case. */
export const SLIDER_REST: Pose = { p: v(25, 0, 3), q: q(Math.PI / 2, 0, 0) };
/** The knobs, standing on their tops in a row right of the case. */
export const KNOB_REST_X = 17.2;
export const KNOB_REST_Z = [4, 6.6, 9.2, 11.8] as const;

/**
 * The back panel hooks in by its outer edge (the case's left side seen from
 * the front: x −12.2 at the back face) and swings shut about it.
 */
export const BACK_HINGE = v(-12.2, 16.2, -1.9);
export const BACK_OPEN_ANGLE = THREE.MathUtils.degToRad(72);

/** Where the closed back slider slides in from (parts.ts sliderPose's off-the-rails point). */
export const SLIDER_OUT_X = 10.7;
