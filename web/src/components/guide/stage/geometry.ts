import * as THREE from "three";

// Where things are on the model, measured off public/3dforweb.glb's node
// table (python: parse the GLB's JSON chunk). Model units are the GLB's own:
// the LED panel is 16 × 32 of them, so one unit is 8 mm of real device.
//
// The device stands facing +z with the panel on the left and the knob column
// on the right, knobs at the top — the portrait the firmware's screens are
// drawn for. The stage scales the model by MODEL_SCALE and lifts it by
// MODEL_OFFSET so its middle sits at the origin.

export const MODEL_URL = "/3dforweb.glb";
export const DRACO_URL = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
export const MODEL_SCALE = 0.1;
export const MODEL_OFFSET = new THREE.Vector3(0, -1.65, 0);

// The GLB's knob meshes are named after the PCB encoder nets. Seen from the
// front: c1 top-left, c2 top-right, c3 bottom-left, c4 bottom-right; the
// device numbers them K1 top-right, K2 top-left, K3 bottom-right, K4
// bottom-left (docs/media/device-card.png, patternflow.ino's KNOB MAP).
export const KNOB_MESH_TO_LOGICAL: Record<string, number> = { c2: 0, c1: 1, c4: 2, c3: 3 };

const KNOB_CENTERS_MODEL: [number, number, number][] = [
  [9.63, 29.7, 3.68], // K1 (c2)
  [6.53, 29.7, 3.68], // K2 (c1)
  [9.63, 26.65, 3.68], // K3 (c4)
  [6.53, 26.65, 3.68], // K4 (c3)
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

export const KNOB_CLUSTER_WORLD = modelToWorld(new THREE.Vector3(8.08, 28.18, 3.0));
export const LED_CENTER_WORLD = modelToWorld(LED_CENTER_MODEL);
