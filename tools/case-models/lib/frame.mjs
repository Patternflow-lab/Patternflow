// The model frame every case model is built in, and where the official
// device's parts sit in it. These are the guide's numbers
// (web/src/components/guide/stage/parts.ts and geometry.ts), copied here so
// this folder runs without the web app; if those move, move these with them.
//
// One unit is 10 mm. The device stands facing +z: +y up with the knobs at the
// top, +x to the reader's right, the LED panel on the left and the knob
// column on the right — the frame of the landing page's first model, which
// the guide's v3.9 case was exported into.

/** Metres (pcb-v39.glb, devkit.glb) → model units. */
export const M_TO_MODEL = 100;

/** pcb-v39.glb's root, seated so SW1..SW4's shafts land on the knob axes. */
export const PCB_PLACEMENT = {
  translation: [8.0515, 24.9577, 0.6572],
  rotation: [0, Math.SQRT1_2, -Math.SQRT1_2, 0],
  scale: [M_TO_MODEL, M_TO_MODEL, M_TO_MODEL],
};

/** devkit.glb's root, on U1's sockets on the back of the board. */
export const DEVKIT_SEAT = {
  translation: [8.0565, 22.4732, -0.8323],
  rotation: [0, 1, 0, 0],
  scale: [M_TO_MODEL, M_TO_MODEL, M_TO_MODEL],
};

/**
 * The knobs' bases on the official case: on the encoder axes, 0.8 mm off the
 * front face. Named after the PCB encoder nets as case-v39.glb names them;
 * seen from the front c1 is top-left, c2 top-right, c3 bottom-left, c4
 * bottom-right.
 */
export const KNOB_BASES = {
  c1: [6.5265, 29.6952, 1.6437],
  c2: [9.6265, 29.6952, 1.6437],
  c3: [6.5265, 26.6452, 1.6437],
  c4: [9.6265, 26.6452, 1.6437],
};

/** The official case's front face, which the encoders bear on from inside. */
export const OFFICIAL_FRONT_Z = 1.5635;

/**
 * The tips of the encoders' shafts with the board where the official case
 * holds it: SW1..SW4 of pcb-v39.glb, placed as above, end at this z. A knob
 * cap whose bore is shallower than the shaft stands where the shaft bottoms
 * out in it.
 */
export const SHAFT_TIP_Z = 3.2172;

/** Where the LED panel's node ("l") sits on the official case. */
export const LED_TRANSLATION = [-4.1908, 16.2677, 1.4977];

/** The LED panel's size in model units: 160 × 320 mm, 16.99 mm deep. */
export const LED_SIZE = [16, 32, 1.699];

/** Adds two 3-vectors. */
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
