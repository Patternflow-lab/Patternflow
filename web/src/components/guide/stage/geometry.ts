import * as THREE from "three";

// Where things are on the model. The frame is public/3dforweb.glb's (the
// landing page's model, whose LED mesh the guide still uses); the v3.9 case,
// case-v39.glb, is exported into the same frame (parts.ts). One unit is
// 10 mm: the 320 × 160 mm LED panel is 32 × 16 units.
//
// The device stands facing +z with the panel on the left and the knob column
// on the right, knobs at the top — the portrait the firmware's screens are
// drawn for. The stage scales the model by MODEL_SCALE and lifts it by
// MODEL_OFFSET so its middle sits at the origin.

export const MODEL_URL = "/3dforweb.glb";
export const DRACO_URL = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
export const MODEL_SCALE = 0.1;
export const MODEL_OFFSET = new THREE.Vector3(0, -1.65, 0);

// case-v39.glb's knob nodes keep the landing model's names, after the PCB
// encoder nets. Seen from the front: c1 top-left, c2 top-right, c3
// bottom-left, c4 bottom-right; the device numbers them K1 top-right, K2
// top-left, K3 bottom-right, K4 bottom-left (docs/media/device-card.png,
// patternflow.ino's KNOB MAP). Each node's origin is on its encoder's axis
// at the knob's base, its axis +z.
export const KNOB_MESH_TO_LOGICAL: Record<string, number> = { c2: 0, c1: 1, c4: 2, c3: 3 };

/** The knobs' base (0.8 mm off the front face, which is at z 1.5635) and top. */
export const KNOB_BASE_Z = 1.6437;
export const KNOB_TOP_Z = 3.6437;
/**
 * How far a press pushes a knob in. The real encoder's push travel is about
 * half a millimetre, and the knob's skirt stands 0.8 mm off the case: pushing
 * it any further would sink it into the front face.
 */
export const KNOB_PRESS = 0.06;

// Knob axes = the v3.9 board's SW1..SW4 shafts, top-of-knob height.
const KNOB_CENTERS_MODEL: [number, number, number][] = [
  [9.6265, 29.6952, KNOB_TOP_Z], // K1 (c2)
  [6.5265, 29.6952, KNOB_TOP_Z], // K2 (c1)
  [9.6265, 26.6452, KNOB_TOP_Z], // K3 (c4)
  [6.5265, 26.6452, KNOB_TOP_Z], // K4 (c3)
];

export const LED_CENTER_MODEL = new THREE.Vector3(-4.19, 16.27, 1.5);

export function modelToWorld(v: THREE.Vector3): THREE.Vector3 {
  return v.clone().multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
}

export function knobWorldCenter(i: number, space: "model" | "world" = "world"): THREE.Vector3 {
  const [x, y, z] = KNOB_CENTERS_MODEL[i];
  const v = new THREE.Vector3(x, y, z);
  return space === "model" ? v : modelToWorld(v);
}

export const KNOB_CLUSTER_WORLD = modelToWorld(new THREE.Vector3(8.0765, 28.1702, 2.98));
export const LED_CENTER_WORLD = modelToWorld(LED_CENTER_MODEL);
