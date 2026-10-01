import * as THREE from "three";
import { MODEL_OFFSET, MODEL_SCALE } from "../geometry";
import type { View } from "../views";

// The build guide's camera views, in the same terms as views.ts: a target,
// the direction the camera looks at it from, and the points that must fit
// the part of the screen the copy leaves free (the rig in GuideCanvas backs
// off until they do). Written in the model frame (10 mm per unit, layout.ts)
// and turned into world units here.
//
// The bench is a mat on the floor in front of where the case will stand
// (model z 18…42), the print plates are behind it (z −71…−20), the case at
// the origin. Every view looks from outside the case's box, and the moves
// between them are swings round a target, never through the case: from the
// bench (in front, above) to the case's back the camera rises and swings
// over the side.

const w = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);

function box(min: [number, number, number], max: [number, number, number]): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push(w(x, y, z));
  return out;
}

/** A view from a direction (model-frame vector, need not be unit). */
function look(target: [number, number, number], dir: [number, number, number], frame: THREE.Vector3[], fill = 0.9, minR = 0.8): View {
  return { target: w(...target), dir: new THREE.Vector3(...dir).normalize(), minR, frame, fill };
}

// The board on the bench: lying flat, or held in the holder at y 2.95 (it
// flips about its long axis there, so a frame round it holds both sides).
const BOARD_HELD = box([-4, 0.2, 23.6], [4, 4.6, 36.4]);

export const BUILD_VIEWS = {
  // The bare board and the row of parts behind it, the DevKit beside it.
  bench: look([2.6, 0, 28.6], [0.12, 1.05, 0.62], box([-8.2, 0, 19.6], [13.6, 1.4, 36.2]), 0.94),
  // Everything that came: the panel, the screws, the cable and the power bank too.
  benchWide: look([-9, 0, 30.5], [0.08, 1.0, 0.72], box([-40.5, 0, 18.4], [23.2, 2, 42.5]), 0.95),
  // The board lifted off the mat and turning over (print-1).
  boardLift: look([0, 6.4, 29], [0.2, 0.55, 1], box([-4, 0.8, 25.4], [4, 12, 32.6]), 0.8),
  // The four plates printing, from in front and high up.
  plates: look([0, 4, -46], [0, 1.15, 0.85], box([-28.6, 0, -71.4], [28.6, 17.6, -19.6]), 0.95),
  // The four knobs on their plate, close: they are 20 mm across on a 256 mm
  // plate, black on dark — framed on the whole plate they were four dots.
  // The near half of the plate, with its edge in shot for bearings.
  platesKnobs: look([17.2, 0.8, -34.4], [0.3, 0.8, 0.75], box([12.2, 0, -40.4], [22.2, 2.4, -28.4]), 0.86),
  // The halves coming off their plates and closing up: the frame stands at the
  // origin, the back panel lies left of it.
  bond: look([-6, 9, 0], [0.42, 0.42, 1], box([-36, 0, -10], [12.6, 32.6, 22]), 0.94, 2),
  // Soldering: the board in its holder, close; it flips, the camera stays.
  boardF: look([0, 2.6, 30.4], [0.16, 1.05, 0.58], box([-3.6, 1, 22.8], [3.6, 3.6, 35.2]), 0.9),
  // The row behind the board too, for parts coming over from it.
  boardParts: look([1, 2, 28], [0.14, 1.0, 0.7], box([-7.4, 0, 19.6], [8.4, 4, 35.6]), 0.92),
  // C11 and the board's bottom-left corner (seen from the F side).
  boardC11: look([-1.2, 3, 33.6], [0.3, 1, 0.75], box([-4.4, 1.6, 31.2], [4.4, 4.6, 36.4]), 0.8),
  // The encoders' end of the board, from in front and a little low, so the
  // wrong-side ghost on top and the encoders under it both show.
  boardSW: look([0, 2.4, 26.6], [0.18, 0.75, 0.9], [...BOARD_HELD, ...box([-3.6, 0.2, 22.8], [3.6, 6.2, 30])], 0.9),
  // The panel going into the frame from the front, seen from behind the
  // frame, off its panel side and above: the panel's back — the IN header at
  // its top — faces the camera the whole way, it comes in from the far
  // (front) side, and it stops against the ledge and the twelve tabs, which
  // are on this side of it. The frame takes in the panel held 9 units in
  // front.
  panelIn: look([-3.4, 16.4, 3.2], [-0.62, 0.5, -1], box([-12.6, 0, -2], [12.4, 32.6, 10.6]), 0.94, 2),
  // The panel's back in the frame, from behind and a little above, close
  // enough that an M4 head is a thing on screen: the twelve tabs, a screw
  // into each (case-2). The screws wait 3 units behind their tabs.
  screwsBack: look([-1.2, 16.3, -0.6], [0.34, 0.3, -1], box([-12.6, 0.4, -3.6], [9.4, 32.4, 0.4]), 0.96, 1.6),
  // The whole case from behind (looking +z), a little from the knob side and above.
  caseBack: look([-0.4, 16, -1], [0.3, 0.42, -1], box([-12.6, 0, -9], [12.4, 32.6, 1.6]), 0.94, 2),
  // Closing the back (check-4): from behind, well round to the knob side and
  // low. Square on and from above (caseBack) the shut back was a blank slab
  // under flat light — nothing of the edge that hooks in, of the cover on its
  // rails or of the print. From here the back is seen along its face: the
  // panel swings shut toward the camera, the cover slides in along the near
  // edge, and the light rakes across both.
  backShut: look([-0.6, 15.6, -1.6], [0.74, 0.17, -1], box([-12.6, 0, -9], [12.4, 32.6, 1.6]), 0.94, 2),
  // The board bay from behind and the knob side, with room for the board
  // hovering 7 units behind it (case-3, case-4) and the cable coming out.
  caseBackClose: look([7.4, 22.4, -3.6], [0.75, 0.42, -1], box([2.6, 16.6, -8.2], [12.6, 32.4, 1.2]), 0.94, 1.2),
  // The bottom of the board bay from behind and well above, close: its floor,
  // with the small slot the power lead comes up through beside the wide
  // opening (layout.ts CABLE_HOLE), and room behind for the lead's end and
  // for the bottom of the board hovering there with J4 (case-3). From the
  // knob side and lower (caseBackClose) the floor is edge-on and the two
  // cuts cannot be told apart.
  //
  // Far enough to the knob side that the line of sight down through the wide
  // opening, and out of the tray's open front, ends on bare mat: from nearer
  // straight behind (x 0.3) it ended on the soldered board in its holder,
  // and the hole the step says NOT to use showed a bright green strip.
  leadBack: look([8.9, 21.4, -3.4], [0.62, 0.62, -1], box([5.6, 18.2, -8.2], [12.4, 25.2, 0.3]), 0.94, 1),
  // The same step on a narrow screen, where one view of both leaves the slot
  // and J4 a few pixels each in the strip above the card: first the bay's
  // floor alone — the slot, the wide opening beside it, the lead coming up —
  // then (script.ts narrowLate) J4 on the board held behind the case, the
  // two wires going up into it.
  leadHole: look([9.4, 19.2, -0.7], [0.62, 0.85, -1], box([7.6, 18.85, -1.5], [11.0, 19.7, 0.25]), 0.94, 1),
  leadJ4: look([10.2, 19.9, -7.4], [0.3, 0.3, -1], box([9.1, 18.9, -8.2], [11.5, 20.9, -6.8]), 0.94, 1),
  // The bay and the panel's back from IN down to its power header (below the
  // band across the middle, y 14.2), for the ribbon and the panel's power wires.
  wireBack: look([1.6, 20.6, -1.4], [0.42, 0.55, -1], box([-7.4, 11.8, -2.4], [12.4, 31.4, 0.8]), 0.94, 1.2),
  // The board's bottom edge from behind, close: J4 and J3 side by side, for a
  // narrow screen (wire-2), where wireBack leaves the two terminals a
  // thumb's width apart and their four tags on top of each other.
  terminalsBack: look([8.05, 20.9, -0.6], [0.22, 0.34, -1], box([4.3, 18.8, -1.8], [11.9, 23.4, 0.7]), 0.94, 1),
  // The four encoder shafts through the case's front face, close, from the
  // knob side and a little above: a washer and a nut on each (case-5), with
  // room in front for the one being brought up. Play's "knobs" view is for
  // four knobs and a screen behind them; a washer is a third of a knob across.
  shafts: look([8.0, 28.0, 2.4], [0.62, 0.3, 1], box([5.0, 25.2, 1.5], [11.2, 31.2, 5.2]), 0.9, 0.9),
  // The front tray, its lid slid out to the right, from the front and the right.
  trayFront: look([8.6, 9, 3], [0.62, 0.32, 1], box([2.8, 0, -1.6], [21, 20.4, 7.6]), 0.92, 1.2),
  // The whole device from the front and the knob side, a little above
  // (check-5): the lid comes in along its rails from that side, toward the
  // camera's left, and each knob is seen going ONTO its shaft — from square
  // in front a knob pushed on is a disc that appears. Close to where the
  // guide's last view (Play's "hero") stands, so the end is a short move.
  finish: look([0.4, 16.2, 0.8], [0.52, 0.2, 1], box([-12.4, 0, -2], [13.2, 32.6, 4.2]), 0.92, 2),
  // The whole device from the front, as the panel comes on (firmware-3):
  // Play's "front" view (views.ts — the same target, direction, distance and
  // frame, in world units). It is a view of its own because the step does
  // not start there: it opens on the tray, from the front and the knob side
  // (below), where the bank going in and the plug going into it can be seen
  // — from square in front, a bank sliding 7 units straight away from the
  // camera is a bank standing still — and comes round to the front as the
  // plug goes home and the panel lights.
  powerOn: {
    target: new THREE.Vector3(0.2, 0, 0),
    dir: new THREE.Vector3(0.4, 0.3, 11.8).normalize(),
    minR: new THREE.Vector3(0.4, 0.3, 11.8).length(),
    frame: [-1.23, 1.23].flatMap((x) => [-1.63, 1.58].flatMap((y) => [-0.2, 0.37].map((z) => new THREE.Vector3(x, y, z)))),
    fill: 0.92,
  },
} satisfies Record<string, View>;

export type BuildViewName = keyof typeof BUILD_VIEWS;

// ── the camera's move within a step ──────────────────────────────────────────
//
// A view above is where the camera ends up: the frame the step holds on. It
// does not arrive there and stop dead. While the step's own motion plays the
// camera is still coming in — from a few degrees round and a few per cent
// further out — so that it settles into the authored frame as the motion
// ends. The rig (GuideCanvas) follows whatever the view says on its springs;
// BuildStage calls settleIn every frame with how far through the beat it is.
//
// `turn` is how far round (radians, about the vertical) the camera starts,
// `push` how much further out (a share of the frame). The views that look
// through a gap at one particular thing do not turn: from a few degrees off
// they look through it at something else (build.test.ts, case-3).

// A step whose subject is small in the frame it must end on opens close on
// it — `open`: another target and frame, held until `until` of the way
// through the beat, and left for the authored ones by `by` — so the reader
// sees what is being done before seeing it done twelve times.

type Open = { target: THREE.Vector3; frame: THREE.Vector3[]; minR: number; dir?: THREE.Vector3; until: number; by: number };
type Move = { turn: number; push: number; open?: Open };
const MOVE: Move = { turn: 0.06, push: 0.05 };
const MOVES: Partial<Record<BuildViewName, Move>> = {
  bench: { turn: 0.04, push: 0.04 },
  benchWide: { turn: 0.03, push: 0.03 },
  plates: { turn: 0.05, push: 0.05 },
  boardF: { turn: -0.05, push: 0.05 },
  boardParts: { turn: 0.04, push: 0.04 },
  boardC11: { turn: -0.07, push: 0.05 },
  boardSW: { turn: 0.05, push: 0.04 },
  panelIn: { turn: -0.07, push: 0.05 },
  // The first screw into its tab (the bottom corner on the panel's outer
  // side), with room for the screw waiting 3 units behind it; then back, for
  // the other eleven.
  screwsBack: {
    turn: 0.06,
    push: 0.04,
    open: { target: w(-10.6, 4.4, -1.2), frame: box([-12.6, 0.6, -4.4], [-7, 8.6, 0.4]), minR: 0.9, until: 0.38, by: 0.56 },
  },
  shafts: { turn: -0.06, push: 0.05 },
  finish: { turn: 0.07, push: 0.04 },
  // The tray, the bank standing in front of it and going in, the plug above
  // its port; then round to the front for the panel.
  powerOn: {
    turn: 0,
    push: 0,
    open: { target: w(8.4, 9.6, 2.4), dir: new THREE.Vector3(0.7, 0.34, 1).normalize(), frame: box([3.6, 0, -1.6], [13, 19.4, 8]), minR: 1.2, until: 0.68, by: 0.9 },
  },
  caseBack: { turn: -0.07, push: 0.05 },
  backShut: { turn: -0.08, push: 0.05 },
  caseBackClose: { turn: 0.05, push: 0.05 },
  leadBack: { turn: 0, push: 0.05 },
  leadHole: { turn: 0, push: 0.04 },
  leadJ4: { turn: 0, push: 0.04 },
  wireBack: { turn: -0.05, push: 0.05 },
  terminalsBack: { turn: 0, push: 0.04 },
};
const REST = new Map<string, { dir: THREE.Vector3; fill: number; target: THREE.Vector3; frame: THREE.Vector3[]; minR: number }>();
const UP = new THREE.Vector3(0, 1, 0);
const TURNED = new THREE.Vector3();
let moving: BuildViewName | null = null;

function rest(name: BuildViewName) {
  const r = REST.get(name);
  if (!r) return;
  const view = BUILD_VIEWS[name] as View;
  view.dir.copy(r.dir);
  view.fill = r.fill;
  view.target.copy(r.target);
  view.frame.forEach((q, i) => q.copy(r.frame[i]));
  view.minR = r.minR;
}

/**
 * Put view `name` where the camera should be `left` of the way from its
 * authored frame (1 at the start of a step's motion, 0 once it has ended);
 * `weight` scales the whole move (a one-second beat has no room for it);
 * `phase` is how far through its beat the step is (0…1), for a view that
 * opens close. Any other view is put back as authored. With no name, all of
 * them are.
 */
export function settleIn(name: string | null | undefined, left: number, weight = 1, phase = 1) {
  if (moving && moving !== name) {
    rest(moving);
    moving = null;
  }
  if (!name || !(name in BUILD_VIEWS)) return;
  const key = name as BuildViewName;
  const view = BUILD_VIEWS[key] as View;
  let r = REST.get(key);
  if (!r) {
    r = { dir: view.dir.clone(), fill: view.fill, target: view.target.clone(), frame: view.frame.map((q) => q.clone()), minR: view.minR };
    REST.set(key, r);
  }
  const m = MOVES[key] ?? MOVE;
  const k = Math.min(1, Math.max(0, left)) * weight;
  view.dir.copy(r.dir).applyAxisAngle(UP, m.turn * k);
  view.fill = r.fill * (1 - m.push * k);
  TURNED.copy(view.dir);
  if (m.open && m.open.frame.length === r.frame.length) {
    const x = Math.min(1, Math.max(0, (phase - m.open.until) / (m.open.by - m.open.until)));
    // 1 close on the subject, 0 the authored frame; eased both ways.
    const close = weight > 0 ? 1 - (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2) : 0;
    view.target.lerpVectors(r.target, m.open.target, close);
    view.frame.forEach((q, i) => q.lerpVectors(r.frame[i], m.open!.frame[i], close));
    view.minR = r.minR + (m.open.minR - r.minR) * close;
    // The direction goes round the short way, on the sphere: a straight line
    // between two directions dips toward the target on the way.
    if (m.open.dir) view.dir.copy(TURNED).lerp(m.open.dir, close).normalize();
  }
  moving = key;
}
