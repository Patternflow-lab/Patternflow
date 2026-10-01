"use client";

/* eslint-disable react-hooks/immutability --
   Three.js objects are imperative; the stage moves them every frame from the
   timeline below, and nothing of it feeds back into React. */

// ── The Build guide's stage ─────────────────────────────────────────────────
//
// A Patternflow built from bare parts on the same 3D stage as Play
// (GuideCanvas), in the order the build really happens (BUILD_GUIDE.md,
// v3.9): parts arrive on a bench, the case prints and is bonded, the board is
// soldered in a holder, then the panel goes into the frame from the front
// and is screwed from behind, the J4 lead (through the small slot under J4,
// not the wide opening beside it), the board, the nuts, the ribbon and J3's
// wires go into the case, the DevKit is flashed (Play's 01 Flash,
// Device + KitFx) and seated, the power bank goes in, and the back, the
// cover, the lid and the knobs close it up. Nothing is measured on the way:
// the build has no continuity or voltage checks (build.test.ts keeps the
// instrument for them off this stage).
//
// It is mounted beside <Device /> for the Build guide (GuideCanvas, by
// store.buildLive), on the one stage every page of the guide shares, and
// runs after Device each frame: it takes Device's own objects (the board and
// its parts, the case, the knobs, the DevKit, the panel) and puts them where
// the build has them, and adds what the build needs besides (beats.ts,
// layout.ts, props.ts). Everything is a function of one timeline value (beats.ts), so
// any step, reached any way, shows the build as it stands.
//
// Coming and going. The stage is the same one the hub and Play use, so this
// takes the device over and hands it back while it is on screen:
//   - Its opening is the device as the hub left it: apart, when the reader
//     came by pointing at Build there (stage/Explode keeps it apart through
//     Build's opening), whole under reduced motion. It takes the device over
//     as it hangs — every part it places at its opening it places by
//     Explode's amount (`open`, in the frame loop) — and what is inside a
//     closed case and was never on the hub's device (the screws, the cables,
//     the power bank) stays off until the case is shut, so nothing changes
//     on screen when it does. Scrolled into the build, that device goes
//     where it hangs as the bench comes up: the case fades, the board and the
//     DevKit are drawn in to nothing. (It used to wait for the parts to come
//     home first, and open on a whole, dark device: pointing at Build took
//     the device apart and choosing Build put it back together.)
//   - Before it starts it gets its shaders built, a piece of the stage a
//     frame (warmStep, below), and only while nothing on stage is moving
//     much: taking over with them unbuilt froze the page for half a second,
//     in the middle of the scene it had just flowed into. It can do that
//     ahead of time, on the hub: when the reader lingers on Build there, the
//     hub mounts this in standby (world/HubAnswers → store.setBuildLive), and
//     by the time Build is chosen there is nothing left to wait for.
//   - What it adds to the stage is made once (keepKit, below) and kept for
//     as long as the canvas is: the guide left and come back to finds its
//     bench, its buffers and its built shaders where they were.
//   - When the reader leaves the guide it does not vanish: it runs the
//     timeline to the nearer end at which the device is whole — back to the
//     opening, or on to the end — at the pace it uses between steps, waits
//     for Device to have the DevKit on its pins and the back cover shut (they
//     are Device's to move, and may still be on their way from the bench),
//     and only then takes itself off (store.setBuildLive), giving Device its
//     objects back as it found them: nothing changes on screen when it goes.
//     Coming back before that carries on from there.
//   - Where the whole device is more than a couple of steps away — the guide
//     left from its middle, or opened on a step in its middle — running the
//     build through would be a second of parts flying past a camera that is
//     going somewhere else: it cuts instead, with the canvas dipped to dark
//     for the jump (store.requestCut).
//
// What a step in scenes/build.ts sets for this stage (the rest of a Step is
// Play's: scenes.ts):
//
//   build   The beat this step shows: one of beats.ts BEATS, the
//           storyboard's step ids ("gather-1" … "check-5", plus "opening"
//           and "next"). Required on every build step; the stage plays the
//           beats in order and holds each one's end.
//   view    A camera view: Play's (hero, front, back, knobs, screenKnobs,
//           esp, …) or the build's own (build/views.ts: bench, benchWide,
//           boardLift, plates, platesKnobs, bond, boardF, boardParts,
//           boardC11, boardSW, panelIn, screwsBack, caseBack, backShut, caseBackClose,
//           leadBack, leadHole, leadJ4, wireBack, terminalsBack, trayFront,
//           shafts, powerOn, finish).
//           narrowView is the view on a narrow screen where that must differ
//           (wire-2, case-3); narrowLate is a second narrow view for the
//           later part of the beat (case-3: the hole, then J4).
//           A build view is where the camera ENDS: while the beat plays it
//           is still coming in, and two of them open somewhere else — close
//           on the first screw (case-2), on the tray (firmware-3) — and are
//           left for the authored frame part-way through (views.ts settleIn,
//           called from the frame loop below).
//   power   The panel. On a build step it lights only once the power bank is
//           plugged in (firmware-3); before that the stage keeps it dark.
//   esp     1 from gather-1 to firmware-1 (the DevKit is never in the case
//           before firmware-2; the stage holds it on the bench and brings it
//           up to the reader at firmware-1), 0 from firmware-2 on (Device
//           seats it — at firmware-2 for the reader: once the camera is
//           behind the case, at its own pace, and again on Replay). cable / flashing at firmware-1 as Play's
//           flash steps; labels / demo / mode at the checks as Play's knobs.
//
// build/script.ts has a ready Step for every beat (BUILD_STEPS), which the
// script can use as it is or spread and change.
//
// How things move. Nothing here moves in a straight line at a steady pace.
// A part let go over the mat comes down under its own weight, rebounds and
// rocks still (drop); one carried is picked up, taken across and put down
// (carry); one that fits another goes in until it meets the fit, and is
// pushed home (motion.ts press); a cover swings onto its catch and is
// pressed shut (latch); a screw and a nut go in as far as they turn; the
// iron is on a pad, then over to the next; a joint is a molten bead, then a
// fillet, then cold; a cable hangs from where it is held. All of it is
// still a function of the timeline value alone (motion.ts: every curve
// clamps), so Replay, scrolling back, a jump and reduced motion all land on
// the same picture. scratchpad craft/build/pops.py steps the whole timeline
// and reports any part that jumps between two phases of a move.

import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getSim, useGuideStore } from "../../store";
import { buildClock } from "../../timing";
import { stepOf } from "../../scenes";
import { type ExplodePart, explodeState, partOffset } from "../explodeParts";
import { DRACO_URL, KNOB_PRESS, MODEL_OFFSET, MODEL_SCALE, MODEL_URL } from "../geometry";
import { CASE_URL, DEVKIT_PRESENT, DEVKIT_SEAT, PCB_PLACEMENT, PCB_URL } from "../parts";
import { placeTag, type TagSide } from "../tags";
import { at, BEATS, beatIndex, beatSeconds, beatStill, clamp01, OPENING_GONE, smooth, span } from "./beats";
import { Path, Tube } from "./cable";
import { buildFocus } from "./focus";
import { ease, fall, glide, grow, land, latch, past, press, reach, rock, scatter, setDown, shake, sway, swing, windUp } from "./motion";
import {
  BACK_HINGE,
  BACK_OPEN_ANGLE,
  BACK_REST,
  BANK_BENCH,
  BOARD_FLAT,
  BOARD_HOVER,
  BOARD_IN_CASE,
  BOARD_LIFT,
  BOARD_PARK,
  BOARD_WORK,
  boardToModel,
  CABLE_HOLE,
  DEVKIT_BENCH,
  FRONT_Z,
  HOLDER_Z,
  J1_MOUTH,
  KNOB_PLATE_XZ,
  KNOB_REST_X,
  KNOB_REST_Z,
  LID_CLEAR,
  LID_REST,
  MAT_TOP,
  NOTCH,
  NUT_ROW_Z,
  PANEL_BENCH,
  PANEL_CENTRE,
  PANEL_FRONT_GAP,
  PANEL_IN,
  PANEL_PCB_Z,
  PANEL_POWER,
  PART_ORDER,
  type PartName,
  PLATE_HEIGHT,
  PLATE_POSES,
  type PlatePart,
  PLATE_SIZE,
  plateCorner,
  PLATES_URL,
  type Pose,
  POWER_COIL,
  RIBBON_BENCH,
  RIBBON_CENTRE,
  RIBBON_HOVER,
  ROW,
  ROW_Z,
  SCREW_BENCH_DX,
  SCREW_BENCH_X0,
  SCREW_BENCH_Z,
  SCREW_HOLES,
  SLIDER_OUT_X,
  SLIDER_REST,
  SPLIT_URL,
  TAB_BACK_Z,
  TRAY,
  USB_COIL,
} from "./layout";
import { PADS } from "./pads";
import * as props from "./props";
import { settleIn } from "./views";
import { brassMaterial, goldMaterial, LOOK, plaMaterial, screwMaterial, solderMaterial, steelMaterial } from "../look/materials";

// ── the timeline's landmarks ────────────────────────────────────────────────

const G1 = at("gather-1");
const G2 = at("gather-2");
const P1 = at("print-1");
const P2 = at("print-2");
const P3 = at("print-3");
const P4 = at("print-4");
const S1 = at("solder-1");
const S2 = at("solder-2");
const S3 = at("solder-3");
const S4 = at("solder-4");
const C1 = at("case-1");
const C2 = at("case-2");
const C3 = at("case-3");
const C4 = at("case-4");
const C5 = at("case-5");
const W1 = at("wire-1");
const W2 = at("wire-2");
const F1 = at("firmware-1");
const F2 = at("firmware-2");
const F3 = at("firmware-3");
const K1 = at("check-1");
const K4 = at("check-4");
const K5 = at("check-5");

/** When each part leaves the row for its holes, and seats (solder-1 … solder-4). */
const INSERT: Record<PartName, [number, number]> = {
  "U1_socket_pins1-22": [S1 + 0.24, S1 + 0.38],
  "U1_socket_pins23-44": [S1 + 0.3, S1 + 0.44],
  J1: [S2 + 0.04, S2 + 0.18],
  J3: [S2 + 0.12, S2 + 0.26],
  J4: [S2 + 0.2, S2 + 0.34],
  C11: [S3 + 0.04, S3 + 0.34],
  SW1: [S4 + 0.31, S4 + 0.43],
  SW2: [S4 + 0.345, S4 + 0.465],
  SW3: [S4 + 0.38, S4 + 0.5],
  SW4: [S4 + 0.415, S4 + 0.535],
};
/**
 * The board turns over (B side up) and back for each round of joints. The
 * encoders' round ends with it turned over once more: solder-4 holds on the
 * plain side, where their bodies are — what the step is about. It is turned
 * printed side up again at the bench while the panel goes into the case
 * (case-1), ready to be carried over at case-3.
 */
const FLIPS: [number, number][] = [
  [S1 + 0.48, S1 + 0.57],
  [S1 + 0.91, S1 + 0.99],
  [S2 + 0.4, S2 + 0.49],
  [S2 + 0.91, S2 + 0.99],
  [S3 + 0.4, S3 + 0.49],
  [S3 + 0.88, S3 + 0.97],
  [S4 + 0.22, S4 + 0.29],
  [S4 + 0.55, S4 + 0.62],
  [S4 + 0.9, S4 + 0.98],
  [C1 + 0.04, C1 + 0.2],
];
/** Rounds of joints: which pads, and when the iron walks them. */
const ROUNDS: { refs: string[]; from: number; to: number }[] = [
  { refs: ["U1"], from: S1 + 0.6, to: S1 + 0.88 },
  { refs: ["J1", "J3", "J4"], from: S2 + 0.52, to: S2 + 0.88 },
  { refs: ["C11"], from: S3 + 0.55, to: S3 + 0.8 },
  { refs: ["SW1", "SW2", "SW3", "SW4"], from: S4 + 0.64, to: S4 + 0.87 },
];

/** When the soldered board is carried from the bench to behind its bay (case-3): after the lead is through the hole. */
const BOARD_OVER: [number, number] = [C3 + 0.4, C3 + 0.7];

/**
 * Small things carried from the bench to the case's back go over its top on a
 * cubic whose two middle points are this high (near the bench, then above
 * the case's back) and this far behind: the curve is past the case's back
 * face before it comes below the case's top (y 32.56).
 */
const OVER_TOP = [52, 60, -9] as const;

/** From here on the device is whole again: the last knob is on (check-5), the bench long gone. */
const WHOLE_AGAIN = at("next");

/** Further than this (beats) from where the stage must be when the guide is opened or left, it cuts there instead of running through. */
const CUT_FAR = 2;
/** How long after asking for a cut the canvas is out, ms (Guide.module.css [data-cut]: 0.14 s). */
const CUT_DARK_MS = 170;

/** Before it takes the device over, the stage builds its shaders only while the camera is slower than this, world units a second (the opening's own sway is a quarter of it). */
const WARM_STILL = 1.2;

/** The print's layer, model units (0.2 mm). */
const LAYER = 0.02;
/** How many pieces of the bead behind the nozzle are drawn, and how long each is (a share of the tour). */
const BEAD = 20;
const BEAD_STEP = 0.009;

type TourStop = { x: number; z: number; at: number; part: number };
/** Where on a plate's tour (BuildStage kit.plates) the nozzle is, `along` of the way round (0…1): writes x, z; returns which part's wall it is laying there, −1 while it crosses to the next part. */
function tourAt(tour: TourStop[], length: number, along: number, out: THREE.Vector3) {
  const d = along * length;
  let i = 1;
  while (i < tour.length - 1 && tour[i].at < d) i++;
  const a = tour[i - 1];
  const b = tour[i];
  const f = b.at > a.at ? (d - a.at) / (b.at - a.at) : 0;
  out.set(a.x + (b.x - a.x) * f, 0, a.z + (b.z - a.z) * f);
  return b.part;
}

/**
 * When each part lands on the mat (gather-1): in the order they are
 * soldered, one kind after another with a breath between the kinds — the
 * socket rows, the three connectors, the capacitor, the four encoders (each
 * with its washer and nut a moment behind it) — and the DevKit last, apart.
 */
const ARRIVE_BOARD = G1 + 0.24;
const ARRIVE: Record<PartName, number> = {
  "U1_socket_pins1-22": G1 + 0.4,
  "U1_socket_pins23-44": G1 + 0.43,
  J1: G1 + 0.49,
  J3: G1 + 0.52,
  J4: G1 + 0.55,
  C11: G1 + 0.61,
  SW1: G1 + 0.67,
  SW2: G1 + 0.7,
  SW3: G1 + 0.73,
  SW4: G1 + 0.76,
};
const ARRIVE_DEVKIT = G1 + 0.84;
/** When what came besides the board's parts lands (gather-2): the panel, its ribbon and power lead, the screws, the USB cable, the power bank. */
const ARRIVE2 = { panel: G2 + 0.16, ribbon: G2 + 0.25, power: G2 + 0.29, screws: G2 + 0.42, usb: G2 + 0.52, bank: G2 + 0.56, named: G2 + 0.76 };
/** Pads no further apart than this (mm) are a row of pins: 2.54 mm, with a little to spare. */
const ROW_PITCH = 3;

/**
 * A part's pads in the order the iron makes them. A header's or a socket's
 * (rows of pins): down one row and back up the next, so the tip is drawn
 * along a row and crosses once — in pin order, a 2 × 8 header's pins
 * alternate between its rows, and the tip stitched back and forth sixteen
 * times. Anything else: round the part by the nearest pad not yet made.
 */
function ironOrder(ref: string): { ref: string; p: (typeof PADS)[string][number] }[] {
  const pads = PADS[ref].map((p) => ({ ref, p }));
  if (pads.length >= 8) {
    // Rows run down the board (z): pads within a millimetre across are one row.
    const rows: (typeof pads)[] = [];
    for (const pad of [...pads].sort((a, b) => a.p[0] - b.p[0])) {
      const row = rows[rows.length - 1];
      if (row && pad.p[0] - row[row.length - 1].p[0] < 0.001) row.push(pad);
      else rows.push([pad]);
    }
    return rows.flatMap((row, n) => row.sort((a, b) => (n % 2 ? b.p[1] - a.p[1] : a.p[1] - b.p[1])));
  }
  const out = [pads[0]];
  const left = pads.slice(1);
  while (left.length) {
    const from = out[out.length - 1].p;
    let best = 0;
    left.forEach((pad, i) => {
      if (Math.hypot(pad.p[0] - from[0], pad.p[1] - from[1]) < Math.hypot(left[best].p[0] - from[0], left[best].p[1] - from[1])) best = i;
    });
    out.push(left.splice(best, 1)[0]);
  }
  return out;
}

/** A board turned over in its holder: it leans back a few degrees, goes over, and is a few degrees past before it is level. */
const turnOver = (x: number) => swing(x, 0.022, 0.018);

// ── small maths ─────────────────────────────────────────────────────────────

type Rigid = { q: THREE.Quaternion; T: THREE.Vector3 };
const rigid = (): Rigid => ({ q: new THREE.Quaternion(), T: new THREE.Vector3() });
const pose = (): Pose => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() });
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const IDENTITY = new THREE.Quaternion();
const qx = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);
const qy = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
/** Where Device holds the DevKit up to the reader (parts.ts). */
const KIT_PRESENTED: Pose = { p: DEVKIT_PRESENT.position, q: DEVKIT_PRESENT.quaternion };
/** Turned over about the board's long axis (z). */
const TURNED = new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI);
/** Upside down about x: a joint on the board's plain side. */
const FLIPPED = qx(Math.PI);
/** The way the iron is held: its tip on the joint, its handle up and toward the reader's right. */
const IRON_AXIS = V(0.5, 1, 0.62).normalize();

function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, u: number, out: THREE.Vector3) {
  const v = 1 - u;
  return out
    .copy(p0)
    .multiplyScalar(v * v * v)
    .addScaledVector(p1, 3 * v * v * u)
    .addScaledVector(p2, 3 * v * u * u)
    .addScaledVector(p3, u * u * u);
}

// A part carried from one place to another is picked up, taken across and put
// down — not slid along a parabola. `x` is how far through the move the
// timeline is, straight (0…1): the part comes up off where it lay before it
// goes anywhere (its way across starts slowly, its rise at once), is turned
// while it is in the air, and is over its place and level before it comes
// down onto it. `lift` is how high it is carried.
const carryUp = (x: number) => smooth(x / 0.36) * (1 - smooth((x - 0.6) / 0.4));
const carryTurn = (x: number) => glide((x - 0.12) / 0.66);

/** Between two poses, carried. */
function carry(a: Pose, b: Pose, x: number, lift: number, out: Pose) {
  const c = clamp01(x);
  out.p.lerpVectors(a.p, b.p, glide(c));
  out.p.y += lift * carryUp(c);
  out.q.slerpQuaternions(a.q, b.q, carryTurn(c));
  return out;
}

const tmpR = { ca: V(), cb: V(), c: V() };
/** Between two rigid placements of a part whose centre (unplaced) is `c`: the centre is carried; the turn is about it. */
function carryRigid(c: THREE.Vector3, a: Rigid, b: Rigid, x: number, lift: number, out: Rigid) {
  const u = clamp01(x);
  tmpR.ca.copy(c).applyQuaternion(a.q).add(a.T);
  tmpR.cb.copy(c).applyQuaternion(b.q).add(b.T);
  tmpR.c.lerpVectors(tmpR.ca, tmpR.cb, glide(u));
  tmpR.c.y += lift * carryUp(u);
  out.q.slerpQuaternions(a.q, b.q, carryTurn(u));
  out.T.copy(c).applyQuaternion(out.q).negate().add(tmpR.c);
  return out;
}

/** Between two poses through the air, on a low arc: for a part brought up to the reader, where there is nothing to put it down on. `u` is already eased. */
function arc(a: Pose, b: Pose, u: number, lift: number, out: Pose) {
  out.p.lerpVectors(a.p, b.p, u);
  out.p.y += lift * Math.sin(Math.PI * clamp01(u));
  out.q.slerpQuaternions(a.q, b.q, glide(u * 1.15 - 0.05));
  return out;
}

const tmpTilt = { axis: V(), q: new THREE.Quaternion() };
/**
 * The lean a part has while it comes down, and the rock as it finds its feet:
 * a turn of `angle` about a level axis — a different one for each part
 * (`i`), the same one every time.
 */
function tilt(i: number, angle: number) {
  const a = scatter(i, 3) * Math.PI;
  return tmpTilt.q.setFromAxisAngle(tmpTilt.axis.set(Math.cos(a), 0, Math.sin(a)), angle);
}

/** A rigid placement that puts a part's centre `c` at `p`, turned by `q`. */
function placeCentre(c: THREE.Vector3, p: THREE.Vector3, q: THREE.Quaternion): Rigid {
  return { q: q.clone(), T: c.clone().applyQuaternion(q).negate().add(p) };
}

function setRigid(o: THREE.Object3D, r: Rigid) {
  o.quaternion.copy(r.q);
  o.position.copy(r.T);
}

/**
 * A part arriving on the mat, `dur` of a beat from `t0`: let go a little
 * above it, it comes down under its own weight, rebounds once (twice, the
 * second barely) and is still. `fall` is its height as a share of the drop
 * (1 → 0, never below: it lands ON the mat), `scale` its size (it comes out
 * of nothing, full size before it touches), `lean` what is left of the angle
 * it comes down at (1 → 0, a rock the other way after it touches). `heavy`
 * things — the panel, the power bank — are let down instead: no rebound.
 */
function drop(t: number, t0: number, dur = 0.1, heavy = false) {
  const u = clamp01((t - t0) / dur);
  return { fall: heavy ? setDown(u) : land(u), scale: grow(u), lean: heavy ? 1 - reach(u) : rock(u), on: t >= t0, u };
}

// ── materials ───────────────────────────────────────────────────────────────

function std(color: string, roughness: number, metalness = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

// ── tags ────────────────────────────────────────────────────────────────────

type TagKey =
  | "u1"
  | "j1"
  | "j3"
  | "j4"
  | "plus5a"
  | "plus5b"
  | "c11"
  | "c11p"
  | "c11m"
  | "wrong"
  | "in"
  | "j4p"
  | "j4m"
  | "j3p"
  | "j3m"
  | "usb"
  | "hole"
  | "swPins"
  | "swBodies"
  | "gPanel"
  | "gScrews"
  | "gUsb"
  | "gBank";

type TagLang = "en" | "ko";
/** A tag's words: the same in both languages (a reference, a reading), or one each. */
type TagText = string | Record<TagLang, string>;

const TAGS: { key: TagKey; text: TagText; side: TagSide; r: number }[] = [
  { key: "u1", text: "U1", side: "left", r: 0.03 },
  { key: "j1", text: "J1", side: "right", r: 0.06 },
  { key: "j3", text: "J3", side: "down", r: 0.07 },
  { key: "j4", text: "J4", side: "down", r: 0.07 },
  { key: "plus5a", text: "+5V", side: "up", r: 0.02 },
  { key: "plus5b", text: "+5V", side: "up", r: 0.02 },
  { key: "c11", text: "C11", side: "up", r: 0.06 },
  { key: "c11p", text: "+", side: "right", r: 0.02 },
  { key: "c11m", text: "−", side: "left", r: 0.02 },
  { key: "wrong", text: "✕", side: "up", r: 0.08 },
  { key: "in", text: "IN ↑", side: "up", r: 0.06 },
  // Seen from the back of the case: J4's +5V is its right-hand screw, J3's its left-hand one.
  // Pushed well out to the side: beside the terminal, not over the wires going into it.
  { key: "j4p", text: "+5V", side: "right", r: 0.065 },
  { key: "j4m", text: "GND", side: "left", r: 0.065 },
  { key: "j3p", text: "+5V", side: "left", r: 0.065 },
  { key: "j3m", text: "GND", side: "right", r: 0.065 },
  // The slot the power lead comes up through (case-3): the small one, beside the wide opening.
  { key: "hole", text: { en: "small hole", ko: "작은 구멍" }, side: "left", r: 0.05 },
  // The DevKit's USB end, toward the board's "USB" mark — never the power lead's.
  { key: "usb", text: { en: "USB end ↓", ko: "USB 쪽 ↓" }, side: "left", r: 0.05 },
  // The encoders' two sides (solder-4): where the pins are soldered, where the bodies sit.
  { key: "swPins", text: { en: "pins: printed side", ko: "다리: 글씨 있는 면" }, side: "up", r: 0.02 },
  { key: "swBodies", text: { en: "bodies: plain side", ko: "몸통: 글씨 없는 면" }, side: "up", r: 0.02 },
  // What came besides the board's parts (gather-2), each named on itself.
  { key: "gPanel", text: { en: "LED panel, its back", ko: "LED 패널 뒷면" }, side: "up", r: 0.02 },
  { key: "gScrews", text: { en: "M4 screws", ko: "M4 나사" }, side: "down", r: 0.05 },
  { key: "gUsb", text: { en: "USB cable", ko: "USB 케이블" }, side: "up", r: 0.2 },
  { key: "gBank", text: { en: "power bank", ko: "보조배터리" }, side: "up", r: 0 },
];

// ── board-local feature points (pcb-v39.glb frame, metres) ─────────────────

const SW_CENTRES = ["SW1", "SW2", "SW3", "SW4"].map((ref) => {
  // PEC12R footprint: the shaft is 7.5 mm along and 2.5 mm down from pad A.
  const a = PADS[ref][0];
  return V(a[0] + 0.0075, 0, a[1] + 0.0025);
});
/** The terminals' wire entries face away from their screws: J4's toward the board's bottom edge, J3's (turned 180°) up toward the DevKit. */
const J4_ENTRY = PADS.J4.map((p) => V(p[0], 0.006, 0.0533));
const J3_ENTRY = PADS.J3.map((p) => V(p[0], 0.006, 0.0476));
/** The "+5v" silkscreen by each terminal (KiCad gr_text). */
const PLUS5_J4 = V(-0.019364, 0.0017, 0.053311);
const PLUS5_J3 = V(0.019752, 0.0017, 0.048993);
/** The "USB" silkscreen at U1's bottom end. */
const USB_MARK = V(-0.00005, 0.0017, 0.053515);
const U1_MID = V(0, 0.009, 0.0255);

// ── the kit, made once ──────────────────────────────────────────────────────
//
// Everything the build adds to the stage is a pure function of the models
// and is drawn on one canvas for the whole visit (world/GuideWorld), so it is
// made once and kept here, outside the component: this stage comes and goes
// with its guide, and making the kit again on every visit left the last
// one's two hundred buffers, its vertex arrays and its textures on the GPU —
// React never disposes what is handed to it as a <primitive>, and the canvas
// that used to take them with it now outlives the page. A kit made for
// another canvas (the guide was left altogether, and come back to) or other
// models is let go before the next is made.

type KitParts = { group: THREE.Object3D; joints: THREE.Object3D; ghost: THREE.Object3D };
let kept: { key: unknown[]; kit: KitParts } | null = null;

function disposeKit(kit: KitParts) {
  const all = new Set<{ dispose: () => void }>();
  for (const root of [kit.group, kit.joints, kit.ghost]) {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) all.add(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
        all.add(mat);
        for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) all.add(v as THREE.Texture);
      }
    });
  }
  all.forEach((x) => x.dispose());
}

function keepKit<T extends KitParts>(key: unknown[], make: () => T): T {
  if (kept && kept.key.length === key.length && kept.key.every((k, i) => k === key[i])) return kept.kit as T;
  if (kept) disposeKit(kept.kit);
  const kit = make();
  kept = { key, kit };
  return kit;
}

export default function BuildStage() {
  const [splitGltf, platesGltf, caseGltf, ledGltf, pcbGltf] = useGLTF([SPLIT_URL, PLATES_URL, CASE_URL, MODEL_URL, PCB_URL], DRACO_URL);
  const { scene: world, gl, camera, size } = useThree();

  // ── everything the build adds ─────────────────────────────────────────────
  const kit = useMemo(() => keepKit([gl, splitGltf, platesGltf, caseGltf, ledGltf, pcbGltf], () => {
    const group = new THREE.Group();
    group.name = "build_stage";
    const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = group, shadow = true): T => {
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = shadow;
          m.receiveShadow = true;
        }
      });
      parent.add(o);
      return o;
    };
    // What the stage's things are made of is look/materials.ts' — the same
    // printed PLA, turned steel and solder the Device has.
    const white = () => plaMaterial({ extra: { transparent: true } });
    const metal = screwMaterial();
    // The encoders' washers and nuts: the brushed finish their bodies have
    // (find(), below). Polished, the eight of them lying flat on the mat
    // mirrored the key light straight into the bloom — four white lamps.
    const brushed = steelMaterial();
    const darkMetal = std("#5d6168", 0.4, 0.8);

    // The bench mat, under everything that arrives.
    const matMat = std("#1c2321", 0.96, 0, { transparent: true, opacity: 0 });
    const matMesh = add(new THREE.Mesh(props.mat(66, 26.5), matMat), group, false);
    matMesh.position.set(-9.2, 0, 30.4);

    // The PCB holder: two posts, a base each, a jaw on each of the board's short edges.
    const hg = props.holder();
    const holderMat = std("#3b3f45", 0.45, 0.7);
    const holder = { group: add(new THREE.Group()), posts: [] as THREE.Mesh[], jaws: [] as THREE.Mesh[] };
    for (const z of HOLDER_Z) {
      const base = new THREE.Mesh(hg.base, holderMat);
      base.position.set(0, MAT_TOP, z);
      const post = new THREE.Mesh(hg.post, holderMat);
      post.position.set(0, MAT_TOP, z);
      const jaw = new THREE.Mesh(hg.jaw, darkMetal);
      jaw.position.set(0, 3.0, z + (z < 30 ? -0.12 : 0.12));
      add(base, holder.group);
      add(post, holder.group);
      add(jaw, holder.group);
      holder.posts.push(post);
      holder.jaws.push(jaw);
    }

    // The LED panel, for everything but lighting up: the landing model's LED
    // mesh in a plain dark finish, and its back.
    const panel = { group: add(new THREE.Group()), slab: null as THREE.Mesh | null, mats: [] as THREE.MeshStandardMaterial[] };
    const slabMat = std("#0d0d0e", 0.62, 0, { transparent: true });
    // The moulded frame is a glossier black than the LED face; the driver
    // board under it carries its parts and lettering as a texture.
    const frameMat = std("#17171a", 0.46, 0, { transparent: true });
    const headerMat = std("#1d1d20", 0.5, 0, { transparent: true });
    const pinMat = goldMaterial({ transparent: true });
    const canMat = std("#7f8389", 0.45, 0.6, { transparent: true });
    const brassMat = brassMaterial({ transparent: true });
    const powerMat = std("#e6e1d6", 0.6, 0, { transparent: true });
    const lSrc = ledGltf.scene.getObjectByName("l") as THREE.Mesh | undefined;
    if (lSrc) {
      const slab = new THREE.Mesh(lSrc.geometry, slabMat);
      slab.position.copy(lSrc.userData.originalX !== undefined ? V(lSrc.userData.originalX, lSrc.userData.originalY, lSrc.userData.originalZ) : lSrc.position).sub(PANEL_CENTRE);
      slab.quaternion.copy(lSrc.quaternion);
      slab.scale.copy(lSrc.userData.originalScale ?? lSrc.scale);
      panel.slab = add(slab, panel.group);
    }
    const pb = props.panelBack();
    const boardMat = std("#ffffff", 0.7, 0.05, { transparent: true, map: pb.boardTexture });
    panel.mats.push(slabMat, frameMat, headerMat, pinMat, canMat, brassMat, powerMat, boardMat);
    const backGroup = add(new THREE.Group(), panel.group);
    add(new THREE.Mesh(pb.frame, frameMat), backGroup);
    add(new THREE.Mesh(pb.board, boardMat), backGroup, false);
    add(new THREE.Mesh(pb.shroud, headerMat), backGroup);
    add(new THREE.Mesh(pb.pins, pinMat), backGroup, false);
    add(new THREE.Mesh(pb.cans, canMat), backGroup, false);
    add(new THREE.Mesh(pb.inserts, brassMat), backGroup, false);
    add(new THREE.Mesh(pb.power, powerMat), backGroup);

    // Fasteners.
    const screws = add(new THREE.InstancedMesh(props.screwGeometry(), metal, SCREW_HOLES.length));
    // The cross in each head: what shows a screw turning.
    const screwSlots = add(new THREE.InstancedMesh(props.screwRecessGeometry(), std("#17181b", 0.7, 0.4), SCREW_HOLES.length), group, false);
    const washers = add(new THREE.InstancedMesh(props.washerGeometry(), brushed, 4));
    const nuts = add(new THREE.InstancedMesh(props.nutGeometry(), brushed, 4));
    for (const m of [screws, screwSlots, washers, nuts]) {
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }

    // The power bank and the sacrificial cable's plug.
    const bg = props.powerBank();
    const bank = add(new THREE.Group());
    // Light grey: dark, it could not be told from the mat it lies on, or from the panel beside it.
    add(new THREE.Mesh(bg.body, std("#8b9099", 0.48, 0.2)), bank);
    add(new THREE.Mesh(bg.port, std("#050505", 0.8)), bank);
    const bankLed = new THREE.Mesh(bg.led, new THREE.MeshBasicMaterial({ color: new THREE.Color("#4fc3ff").multiplyScalar(2), toneMapped: false }));
    add(bankLed, bank, false);
    const pg = props.usbPlug();
    const plug = add(new THREE.Group());
    add(new THREE.Mesh(pg.shell, std("#c9ccd2", 0.3, 0.9)), plug);
    add(new THREE.Mesh(pg.boot, std("#8d9096", 0.62)), plug);

    // Cables.
    // The USB cable's jacket: grey, for the same reason.
    const jacket = std("#8d9096", 0.62, 0, { side: THREE.DoubleSide });
    const red = std("#b3231d", 0.5, 0, { side: THREE.DoubleSide });
    const black = std("#161616", 0.5, 0, { side: THREE.DoubleSide });
    const usbPath = new Path(9);
    const usb = new Tube(90, 10, 0.18, jacket);
    add(usb.mesh);
    const j4Paths = [new Path(3), new Path(3)];
    const j4Wires = [new Tube(12, 8, 0.07, red), new Tube(12, 8, 0.07, black)];
    j4Wires.forEach((w) => add(w.mesh));
    // The HUB75 ribbon, one rigid piece as it is fitted: J1's plug, the flat
    // run through the notch, the fold, the run up to IN's plug. Built where
    // it sits in the case, so the group is at the origin when it is seated.
    const idcMat = std("#b9b9b4", 0.62);
    const ribbon = add(new THREE.Group());
    const rz = (mouthZ: number) => mouthZ + props.IDC_PLUG.into - (props.IDC_PLUG.d - 0.12);
    const ribbonFlex = props.foldedRibbon(J1_MOUTH.x, J1_MOUTH.y, rz(J1_MOUTH.z) - 0.045, PANEL_IN.x, PANEL_IN.y, rz(PANEL_IN.z) - 0.045);
    for (const m of [new THREE.Mesh(ribbonFlex.cable, std("#b8b7b2", 0.7, 0, { side: THREE.DoubleSide })), new THREE.Mesh(ribbonFlex.stripe, std("#b3231d", 0.7, 0, { side: THREE.DoubleSide }))]) {
      // It bends (the frame loop moves its strips): never culled by where it was built.
      m.frustumCulled = false;
      add(m, ribbon);
    }
    // Its two plugs, on its ends wherever they are: J1's, then IN's.
    const ribbonPlugs = [
      { mesh: add(new THREE.Mesh(props.idcPlug("y"), idcMat), ribbon), home: V(J1_MOUTH.x, J1_MOUTH.y, J1_MOUTH.z + props.IDC_PLUG.into) },
      { mesh: add(new THREE.Mesh(props.idcPlug("x"), idcMat), ribbon), home: V(PANEL_IN.x, PANEL_IN.y, PANEL_IN.z + props.IDC_PLUG.into) },
    ];
    for (const rp of ribbonPlugs) rp.mesh.position.copy(rp.home);
    // The panel's power lead: its plug on the panel's header, a red and a black wire to J3.
    const powerPlug = add(new THREE.Mesh(props.vhPlug(), std("#e9e5da", 0.6)));
    const powerPaths = [new Path(7), new Path(7)];
    const powerWires = [new Tube(70, 8, 0.075, red), new Tube(70, 8, 0.075, black)];
    powerWires.forEach((w) => add(w.mesh));

    // Coils on the mat: the USB cable and the panel's power lead.
    const coils = {
      usb: add(new THREE.Mesh(props.coil(1.7, 0.18, 3), jacket)),
      power: add(new THREE.Group()),
    };
    coils.usb.position.copy(USB_COIL);
    add(new THREE.Mesh(props.coil(1.3, 0.075, 3), red), coils.power);
    const pc2 = add(new THREE.Mesh(props.coil(1.2, 0.075, 3), black), coils.power);
    pc2.position.set(0.22, 0, 0.16);
    coils.power.position.copy(POWER_COIL);

    // A soft round glow for a point of heat: the print's nozzles.
    const glowMap = props.glowTexture();
    // Tools: the iron — a plated tip, the heater's steel barrel, a rubber
    // handle with its guard. Nothing glows where its tip touches: that was a
    // flat disc of light lying on the board, a sprite and seen to be one.
    // What says the tip is on a pad is the joint that grows under it.
    const ig = props.iron();
    const iron = add(new THREE.Group());
    add(new THREE.Mesh(ig.tip, metal), iron);
    add(new THREE.Mesh(ig.barrel, brushed), iron);
    add(new THREE.Mesh(ig.grip, std("#232528", 0.82)), iron);

    // Solder joints: a small fillet at every through-hole pad (pads.ts),
    // children of the board once it is found.
    type Joint = { pos: THREE.Vector3; up: boolean; r: number; at: number; ref: string; life: number; hold: number; hop: number };
    const jointList: Joint[] = [];
    const rounds = ROUNDS.map((round) => {
      const secs = beatSeconds(Math.floor(round.from));
      const pads = round.refs.flatMap((ref) => ironOrder(ref));
      // The time from one joint to the next is the time on the pad plus the
      // way to the next: quick along a row of pins, longer across the board.
      const gaps = pads.map(({ p }, i) => (i ? Math.min(40, Math.hypot(p[0] - pads[i - 1].p[0], p[1] - pads[i - 1].p[1]) * 1000) : 0));
      // A pin down a row is one beat of it; a move across the board is a
      // short touch and then the way over, which is given its time — the
      // iron is carried, not thrown.
      const dab = 0.6;
      const way = (mm: number) => (mm <= ROW_PITCH ? 1 + mm * 0.2 : dab + mm * 0.45);
      const cost: number[] = [];
      gaps.forEach((mm, i) => cost.push(i ? cost[i - 1] + way(mm) : 0));
      const total = Math.max(1e-6, cost[cost.length - 1]);
      const list = pads.map(({ ref, p }, i) => {
        const up = ref.startsWith("SW"); // encoders: joints on the F side
        const j: Joint = {
          ref,
          up,
          pos: V(p[0], up ? 0.0016 : 0, p[1]),
          r: Math.min(0.0011, p[2] / 2 + 0.0001),
          at: round.from + ((round.to - round.from) * cost[i]) / total,
          // Half a second from bead to cold fillet, whatever the beat's length.
          life: 0.5 / secs,
          // On the pad before it for this share of the way here; lifted this
          // high (model units) on the way. Down a row of pins (a pitch
          // apart) it does neither: the tip is drawn along the row.
          hold: gaps[i] <= ROW_PITCH ? 0 : dab / way(gaps[i]),
          hop: gaps[i] <= ROW_PITCH ? 0 : Math.min(1.1, 0.03 + gaps[i] * 0.035),
        };
        jointList.push(j);
        return j;
      });
      return { from: round.from, to: round.to, secs, list };
    });
    const jointGeo = new THREE.ConeGeometry(1, 1, 14, 1, true);
    jointGeo.translate(0, 0.5, 0);
    const joints = new THREE.InstancedMesh(jointGeo, solderMaterial(), jointList.length);
    // Each joint's own heat (look/materials.ts solderMaterial): 1 as it is made, 0 once it has set.
    const jointHeat = new THREE.InstancedBufferAttribute(new Float32Array(jointList.length), 1).setUsage(THREE.DynamicDrawUsage);
    jointGeo.setAttribute("aHeat", jointHeat);
    joints.frustumCulled = false;
    joints.castShadow = false;
    joints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // The encoder on the wrong side: red, see-through, crossed out.
    const sw1 = pcbGltf.scene.getObjectByName("SW1");
    const ghostMat = new THREE.MeshStandardMaterial({ color: "#ff4a3d", emissive: "#ff2a1d", emissiveIntensity: 0.6, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const ghost = new THREE.Group();
    sw1?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) ghost.add(new THREE.Mesh(m.geometry, ghostMat));
    });

    // The print plates, the parts on them (plates.glb), a layer line each.
    const plateMat = std("#45474d", 0.72, 0.15, { transparent: true });
    // What they stand on. The floor of the room is black, and four dark
    // plates on it were four squares hanging in the dark, in another and
    // flatter world than the bench before them: a mat like the bench's, and
    // on it the shade each plate keeps round its foot (drawn, not cast: the
    // key light's shadow map is fitted to the device and does not reach the
    // far plates).
    const plateGround = add(new THREE.Group(), group, false);
    plateGround.position.set(PLATES_GROUND.x, 0, PLATES_GROUND.z);
    const plateGroundMat = std("#232b29", 0.96, 0, { transparent: true, opacity: 0 });
    const groundSlab = add(new THREE.Mesh(props.mat(PLATES_GROUND.w, PLATES_GROUND.d), plateGroundMat), plateGround, false);
    groundSlab.position.y = -0.05;
    // One shade for each plate, and with its plate (the knobs' comes for the second print).
    const plateShadeMat = new THREE.MeshBasicMaterial({
      color: "#000000",
      alphaMap: props.plateShade(PLATE_SHADE),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
    });
    const plateShadeGeo = new THREE.PlaneGeometry(PLATE_SIZE + PLATE_SHADE * 2, PLATE_SIZE + PLATE_SHADE * 2);
    plateShadeGeo.rotateX(-Math.PI / 2);
    const clip = [1, 2, 3, 4].map(() => new THREE.Plane(V(0, -1, 0), 1e4));
    const plates = [1, 2, 3, 4].map((p) => {
      const g = add(new THREE.Group());
      g.position.copy(plateCorner(p));
      const slab = add(new THREE.Mesh(props.plate(), plateMat), g, false);
      // Its shade on the mat, just above the mat's top (the plate's corner is PLATE_TOP up).
      const shade = new THREE.Mesh(plateShadeGeo, plateShadeMat);
      shade.position.set(PLATE_SIZE / 2, -0.008 - plateCorner(p).y, -PLATE_SIZE / 2);
      g.add(shade);
      // Printed lying on the plate: its layers stack along the plate's up.
      const partMat = plaMaterial({ axis: "y", ...(p === 4 ? { color: LOOK.plaBlack, roughness: 0.74 } : {}), extra: { clippingPlanes: [clip[p - 1]], clipShadows: true } });
      // The layer being laid: where the cut opens a part, its inside is drawn
      // in one flat tone — a solid section, not the inside of a hollow shell.
      // Drawn a little toward the camera in depth: a part's underside lies
      // 0.06 mm above the plate, and from the plates' view the two fought
      // for the same depth — the dark plate showing through in streaks.
      const cutMat = new THREE.MeshBasicMaterial({
        color: p === 4 ? "#0d0d0d" : "#b4b1a9",
        side: THREE.BackSide,
        clippingPlanes: [clip[p - 1]],
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -12,
      });
      const parts: THREE.Mesh[] = [];
      const cuts: THREE.Mesh[] = [];
      platesGltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.name.startsWith(`p${p}_`)) return;
        parts.push(add(new THREE.Mesh(m.geometry, partMat), g));
        cuts.push(add(new THREE.Mesh(m.geometry, cutMat), g, false));
      });
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(PLATE_SIZE, 0, 0), V(PLATE_SIZE, 0, -PLATE_SIZE), V(0, 0, -PLATE_SIZE)]),
        new THREE.LineBasicMaterial({ color: new THREE.Color("#ff8a4d").multiplyScalar(2.2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
      );
      g.add(line);
      // The nozzle: a point of heat going round each part's outer wall at the
      // layer being laid, with the bead it has just put down cooling behind
      // it — something laying the part, where the layer line only says how
      // high it has got. One closed tour of the plate's parts: round each
      // one's outline (props.ts footprint), and across to the next.
      const tour: TourStop[] = [];
      let length = 0;
      // `part` is which part's wall the way TO this stop lays; −1 for the way across to a part.
      const stop = (x: number, z: number, part: number) => {
        const last = tour[tour.length - 1];
        if (last) length += Math.hypot(x - last.x, z - last.z);
        tour.push({ x, z, at: length, part });
      };
      parts.forEach((part, n) => {
        const outline = props.footprint(part.geometry);
        outline.forEach(([x, z], i) => stop(x, z, i > 0 ? n : -1));
        stop(outline[0][0], outline[0][1], n);
      });
      if (tour.length) stop(tour[0].x, tour[0].z, -1);
      const nozzle = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowMap, color: new THREE.Color(2.6, 1.7, 0.9), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      );
      nozzle.scale.setScalar(0.7);
      g.add(nozzle);
      // In pieces, so that it stops where the nozzle lifted to cross to the next part.
      const bead = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(BEAD * 6), 3).setUsage(THREE.DynamicDrawUsage)),
        new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
      );
      const fade = new Float32Array(BEAD * 6);
      for (let i = 0; i < BEAD * 2; i++) {
        // Piece i runs from sample i to sample i + 1: hottest at the nozzle.
        const k = Math.pow(1 - (Math.floor(i / 2) + (i % 2)) / BEAD, 1.6);
        fade.set([2.2 * k, 1.1 * k, 0.4 * k], i * 3);
      }
      bead.geometry.setAttribute("color", new THREE.BufferAttribute(fade, 3));
      bead.frustumCulled = false;
      g.add(bead);
      return { group: g, slab, parts, cuts, line, tour, length, nozzle, bead };
    });

    // The 256 mm print's halves where they sit in the case (case-split.glb).
    const split: Record<string, THREE.Mesh> = {};
    splitGltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) split[m.name] = add(new THREE.Mesh(m.geometry, white()));
    });
    // The back slider: the stage's own copy, so Device's — whose place tells
    // KitFx the back is shut — can stay put.
    const sliderSrc = caseGltf.scene.getObjectByName("back_slider") as THREE.Mesh | undefined;
    const slider = add(new THREE.Mesh(sliderSrc ? sliderSrc.geometry : new THREE.BufferGeometry(), white()));

    // Bonding: tape across the seams, and a glow along them while they cure.
    //
    // The frame's seam (y 17.07) is only where the frame is: at that height
    // its front is two openings — the panel's and the power-bank tray's — so
    // the seam runs across the tray's back wall and down the case's two
    // sides, and that is where the tape and the glow are. (They used to lie
    // straight across the front: a line of light and two strips of tape in
    // the air of the panel's opening.)
    const tapeMat = std("#3b78d0", 0.9, 0, { transparent: true });
    const SEAM_Y = 17.07;
    const trayBack = TRAY.z0 + 0.02;
    const side = 12.41;
    const frameTape = [
      { x: 6.3, z: trayBack, turn: 0 },
      { x: 9.9, z: trayBack, turn: 0 },
      { x: side, z: -0.2, turn: Math.PI / 2 },
    ].map(({ x, z, turn }) => {
      const m = add(new THREE.Mesh(props.tapeStrip(2.4), tapeMat), group, false);
      m.position.set(x, SEAM_Y, z);
      m.rotation.y = turn;
      return m;
    });
    const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff8a4d").multiplyScalar(2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    const frameSeam = add(new THREE.Group(), group, false);
    const seamAt = (w: number, d: number, x: number, z: number) => {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), seamMat), frameSeam, false);
      m.position.set(x, SEAM_Y, z);
    };
    seamAt(TRAY.x1 - TRAY.x0, 0.03, (TRAY.x0 + TRAY.x1) / 2, trayBack);
    seamAt(0.03, 3.4, side, -0.17);
    seamAt(0.03, 3.4, -12.61, -0.17);
    const backSeamGroup = add(new THREE.Group(), group, false);
    const backSeam = add(new THREE.Mesh(new THREE.BoxGeometry(15.8, 0.06, 0.03), seamMat), backSeamGroup, false);
    backSeam.position.set(-4.21, 17.03, -1.93);
    const backTape = [-9, -4.2, 0.6].map((x) => {
      const m = add(new THREE.Mesh(props.tapeStrip(2.4), tapeMat), backSeamGroup, false);
      m.position.set(x, 17.03, -1.93);
      return m;
    });

    // The two "+" of J3 and J4, joined: they are mirror images.
    const dash = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([V(), V()]),
      new THREE.LineDashedMaterial({ color: new THREE.Color("#ff6a3d").multiplyScalar(1.6), dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }),
    );
    dash.geometry.setAttribute("lineDistance", new THREE.BufferAttribute(new Float32Array(2), 1).setUsage(THREE.DynamicDrawUsage));
    group.add(dash);

    return {
      group,
      matMat,
      holder,
      panel,
      backGroup,
      screws,
      screwSlots,
      washers,
      nuts,
      bank,
      bankLed,
      plug,
      usb,
      usbPath,
      j4Paths,
      j4Wires,
      ribbon,
      ribbonFlex,
      ribbonPlugs,
      powerPlug,
      powerPaths,
      powerWires,
      coils,
      iron,
      jointList,
      rounds,
      joints,
      jointHeat,
      ghost,
      ghostMat,
      plates,
      plateGround,
      plateGroundMat,
      plateShadeMat,
      clip,
      split,
      slider,
      frameTape,
      frameSeam,
      backSeamGroup,
      backTape,
      seamMat,
      tapeMat,
      dash,
      // Its shaders have all been built and drawn once (warmStep): a kit that is kept does not do it again.
      warm: { done: false },
    };
  }), [gl, splitGltf, platesGltf, caseGltf, ledGltf, pcbGltf]);

  // Centres of the case parts (unplaced), for turning them about themselves.
  const centres = useMemo(() => {
    const c = (o: THREE.Object3D | undefined) => {
      const g = (o as THREE.Mesh | undefined)?.geometry;
      if (!g) return V();
      if (!g.boundingBox) g.computeBoundingBox();
      return g.boundingBox!.getCenter(V());
    };
    return {
      frame_bottom: c(kit.split.frame_bottom),
      frame_top: c(kit.split.frame_top),
      back_bottom: c(kit.split.back_bottom),
      back_top: c(kit.split.back_top),
      back_plate: c(caseGltf.scene.getObjectByName("back_plate")),
      top_lid: c(caseGltf.scene.getObjectByName("top_lid")),
      back_slider: c(kit.slider),
    };
  }, [kit, caseGltf]);

  // Fixed placements: on the plates, at rest, open.
  const places = useMemo(() => {
    const onPlate = (name: PlatePart): Rigid => {
      const { plate, matrix } = PLATE_POSES[name];
      const m = new THREE.Matrix4().fromArray(matrix as unknown as number[]).premultiply(new THREE.Matrix4().makeTranslation(plateCorner(plate)));
      const r = rigid();
      const s = V();
      m.decompose(r.T, r.q, s);
      return r;
    };
    const backRest = placeCentre(centres.back_plate, V(BACK_REST.p.x, 0.27, BACK_REST.p.z), BACK_REST.q);
    // The back's halves come together at rest, the top half 3 units off along its own up.
    const backTopApart: Rigid = { q: backRest.q.clone(), T: backRest.T.clone().add(V(0, 3, 0).applyQuaternion(backRest.q)) };
    const hingeOpen: Rigid = { q: qy(BACK_OPEN_ANGLE), T: BACK_HINGE.clone().sub(BACK_HINGE.clone().applyQuaternion(qy(BACK_OPEN_ANGLE))) };
    return {
      plate: {
        frame_bottom: onPlate("frame_bottom"),
        frame_top: onPlate("frame_top"),
        back_bottom: onPlate("back_bottom"),
        back_top: onPlate("back_top"),
        top_lid: onPlate("top_lid"),
        back_slider: onPlate("back_slider"),
      },
      home: rigid(),
      frameTopApart: { q: new THREE.Quaternion(), T: V(0, 3.2, 0) } as Rigid,
      backRest,
      backTopApart,
      hingeOpen,
      // Stood up as it will hook in, but out behind the case's corner: where it is brought first, so it never crosses the case.
      hingeAway: { q: hingeOpen.q.clone(), T: hingeOpen.T.clone().add(V(-9, 0, -6)) } as Rigid,
      sliderRest: placeCentre(centres.back_slider, V(SLIDER_REST.p.x, 0.14, SLIDER_REST.p.z), SLIDER_REST.q),
      sliderOut: { q: new THREE.Quaternion(), T: V(SLIDER_OUT_X, 0, 0) } as Rigid,
      lidRest: placeCentre(centres.top_lid, V(LID_REST.p.x, 0.1, LID_REST.p.z), LID_REST.q),
      lidApproach: { q: new THREE.Quaternion(), T: V(LID_CLEAR, 0, 0) } as Rigid,
    };
  }, [centres]);

  // ── Device's objects, found once they are in the scene ───────────────────
  type DeviceRig = {
    root: THREE.Object3D;
    pcb: THREE.Object3D;
    parts: Record<PartName, { node: THREE.Object3D; hp: THREE.Vector3; hq: THREE.Quaternion; min: THREE.Vector3; max: THREE.Vector3 }>;
    body: THREE.Mesh;
    backPlate: THREE.Mesh;
    topLid: THREE.Mesh;
    deviceSlider: THREE.Mesh;
    notch: THREE.Object3D | null;
    knobs: THREE.Mesh[];
    knobHome: { p: THREE.Vector3; q: THREE.Quaternion }[];
    led: THREE.Mesh;
    kit: THREE.Object3D;
    dials: THREE.Object3D[];
    fade: THREE.Material[];
    knobMats: THREE.Material[];
    released: boolean[];
  };
  const dev = useRef<DeviceRig | null>(null);

  const find = (): DeviceRig | null => {
    const root = world.getObjectByName("patternflow");
    const pcb = root?.getObjectByName("pcb_v39");
    const kitPivot = root?.getObjectByName("devkit_pivot");
    if (!root || !pcb || !kitPivot) return null;
    const get = (n: string) => root.getObjectByName(n) as THREE.Mesh;
    const body = get("body");
    const backPlate = get("back_plate");
    const topLid = get("top_lid");
    const deviceSlider = get("back_slider");
    const led = get("l");
    const knobs = ["c1", "c2", "c3", "c4"].map(get);
    if (!body || !backPlate || !topLid || !deviceSlider || !led || knobs.some((k) => !k)) return null;
    pcb.updateMatrixWorld(true);
    const parts = {} as DeviceRig["parts"];
    for (const name of PART_ORDER) {
      const node = pcb.getObjectByName(name) ?? root.getObjectByName(name);
      if (!node) return null;
      // Where it sits on the board, as the file has it (kept on the node, so
      // finding it again — React runs effects twice in development — starts
      // from the same place).
      const home = (node.userData.buildHome ??= { p: node.position.clone(), q: node.quaternion.clone() }) as { p: THREE.Vector3; q: THREE.Quaternion };
      // Its extent in the board's frame, from its own geometry.
      const box = new THREE.Box3();
      const toBoard = new THREE.Matrix4().compose(home.p, home.q, V(1, 1, 1));
      node.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        const rel = new THREE.Matrix4();
        for (let n: THREE.Object3D | null = m; n && n !== node; n = n.parent) {
          n.updateMatrix();
          rel.premultiply(n.matrix);
        }
        rel.premultiply(toBoard);
        box.union(m.geometry.boundingBox!.clone().applyMatrix4(rel));
      });
      parts[name] = { node, hp: home.p, hq: home.q, min: box.min, max: box.max };
    }
    // The parts fly free of the board: hang them on the device's root, in
    // the model frame (the board's own scale, metres, comes with them).
    for (const name of PART_ORDER) {
      const node = parts[name].node;
      root.add(node);
      node.scale.setScalar(PCB_PLACEMENT.scale);
    }
    // Device's case and knobs fade here (with the opening; while they wait
    // beside the case). The flag alone is not enough: three keeps the shader
    // it built for an opaque material — which writes alpha 1 whatever the
    // opacity says — until the material says it has changed, and the case
    // never faded at all: it stood solid for the length of the fade and was
    // then switched off. The see-through variant is the one the stage's own
    // printed parts use (white(), in the kit), built and drawn in the
    // warm-up, so this costs a look-up, not a compile.
    const seeThrough = (mat: THREE.Material) => {
      if (mat.transparent) return;
      mat.transparent = true;
      mat.needsUpdate = true;
    };
    const fade: THREE.Material[] = [];
    for (const m of [body, backPlate, topLid]) {
      const mat = m.material as THREE.MeshStandardMaterial;
      seeThrough(mat);
      fade.push(mat);
    }
    const knobMats = knobs.map((k) => {
      const mat = k.material as THREE.MeshStandardMaterial;
      seeThrough(mat);
      return mat;
    });
    // The encoders' simplified metal reads as a mirror under the bench
    // light (it was made to sit inside the case): brushed steel instead.
    for (const ref of ["SW1", "SW2", "SW3", "SW4"] as const) {
      parts[ref].node.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && m.name === "encoder_metal" && !m.userData.buildTuned) {
          m.userData.buildTuned = true;
          m.color.set("#8d9096");
          m.metalness = 0.7;
          m.roughness = 0.6;
        }
      });
    }
    pcb.add(kit.joints);
    pcb.add(kit.ghost);
    const dials = root.children.filter((c) => typeof c.userData.knob === "number" && !(c as THREE.Mesh).isMesh);
    return {
      root,
      pcb,
      parts,
      body,
      backPlate,
      topLid,
      deviceSlider,
      notch: root.getObjectByName("notch_floor") ?? null,
      knobs,
      // (Device's own home for it — userData.home — not where it is now: the device may be standing apart, its knobs out in front.)
      knobHome: knobs.map((k) => (k.userData.buildHome ??= { p: ((k.userData.home as THREE.Vector3 | undefined) ?? k.position).clone(), q: k.quaternion.clone() }) as { p: THREE.Vector3; q: THREE.Quaternion }),
      led,
      kit: kitPivot,
      dials,
      fade,
      knobMats,
      released: [false, false, false, false],
    };
  };

  // On the way out, give Device its objects back as they were (and find
  // them again if this mounts again).
  useEffect(
    () => () => {
      const d = dev.current;
      dev.current = null;
      if (!d) return;
      for (const name of PART_ORDER) {
        const p = d.parts[name];
        d.pcb.add(p.node);
        p.node.position.copy(p.hp);
        p.node.quaternion.copy(p.hq);
        p.node.scale.setScalar(1);
        p.node.visible = true;
      }
      d.pcb.remove(kit.joints);
      d.pcb.remove(kit.ghost);
      d.knobs.forEach((k, i) => {
        k.position.copy(d.knobHome[i].p);
        k.quaternion.copy(d.knobHome[i].q);
        k.scale.setScalar(1);
        k.visible = true;
      });
      for (const m of [d.body, d.backPlate, d.topLid]) {
        m.position.set(0, 0, 0);
        m.quaternion.identity();
        m.visible = true;
      }
      d.led.visible = true;
      d.kit.visible = true;
      d.kit.scale.setScalar(100);
      d.dials.forEach((g) => g.scale.setScalar(1));
    },
    [kit],
  );

  // Clipping for the print, on this canvas only (the build page's).
  useEffect(() => {
    const prev = gl.localClippingEnabled;
    gl.localClippingEnabled = true;
    // A context the GPU took away and gave back has none of the kit's shaders: they are built again before the next takeover.
    const canvas = gl.domElement;
    const restored = () => {
      kit.warm.done = false;
    };
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      gl.localClippingEnabled = prev;
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, kit]);

  // The timeline is not running once this is gone (timing.ts buildClock).
  useEffect(
    () => () => {
      buildClock.t = -1;
      buildFocus.on = false;
      settleIn(null, 0);
    },
    [],
  );

  // ── tags: DOM pills beside what they name ─────────────────────────────────
  const tagEls = useRef<Partial<Record<TagKey, { wrap: HTMLDivElement; pill: HTMLDivElement }>>>({});
  // The page's language: the stage outlives a page, so it is read from the store, not from the DOM round the canvas.
  const lang: TagLang = useGuideStore((st) => st.lang);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const layer = document.createElement("div");
    layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20";
    for (const t of TAGS) {
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:absolute;left:0;top:0;will-change:transform";
      const pill = document.createElement("div");
      pill.className = "guide-knob-tag";
      pill.dataset.on = "0";
      pill.textContent = typeof t.text === "string" ? t.text : t.text[lang];
      pill.style.transform = "translate(-50%, -50%)";
      wrap.appendChild(pill);
      layer.appendChild(wrap);
      tagEls.current[t.key] = { wrap, pill };
    }
    host.appendChild(layer);
    return () => {
      layer.remove();
      tagEls.current = {};
    };
  }, [gl, lang]);

  // ── shaders before it takes over ──────────────────────────────────────────
  //
  // three builds a material's shader the first time it draws it, and this
  // stage brings some forty materials with it. Drawn for the first time all
  // at once — the frame it takes the device over, and the warm-up draw after
  // it — that was two frames of a quarter of a second each. So before it
  // starts: first every material is compiled in the background, where the
  // browser can (compileAsync, parallel shader compile — nothing waits on
  // it); then each piece the build adds is drawn once on its own, off
  // screen, one piece a frame, for what compiling alone misses (the clipping
  // planes' variant of a shader, the shadow pass's) — a few slow frames
  // instead of two frozen ones. Returns true once all of it has been drawn.
  const warm = useRef<{ i: number; target: THREE.WebGLRenderTarget | null; compiled: "no" | "busy" | "yes"; cam: THREE.Vector3; seen: boolean }>({
    i: 0,
    target: null,
    compiled: "no",
    // Where the camera was last frame, for how fast it is moving (the gate at the top of the frame loop).
    cam: new THREE.Vector3(),
    seen: false,
  });
  const warmUnits = useMemo(() => {
    // The print plates bring the clipped shaders — a part's, its cut's, and
    // the shadow pass's for both — and one plate drawn whole was the one long
    // frame left: its pieces go one at a time, ahead of the plates themselves.
    const plate = kit.plates[0];
    const platePieces: THREE.Object3D[] = [plate.slab, plate.parts[0], plate.cuts[0], plate.line].filter(Boolean);
    return [...platePieces, ...kit.group.children, kit.joints, kit.ghost];
  }, [kit]);
  useEffect(
    () => () => {
      warm.current.target?.dispose();
      warm.current.target = null;
    },
    [],
  );
  const warmStep = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera): boolean => {
    if (kit.warm.done) return true;
    const w = warm.current;
    if (w.compiled !== "yes") {
      if (w.compiled === "no") {
        w.compiled = "busy";
        const done = () => {
          w.compiled = "yes";
        };
        // For the buffer the frame is really drawn into (the effects
        // composer's: its linear colour space is part of the shader), and
        // with the loose pieces in the tree for the moment it is walked.
        const loosePieces = warmUnits.filter((u) => !u.parent);
        for (const u of loosePieces) kit.group.add(u);
        w.target ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
        const before = renderer.getRenderTarget();
        const planes = renderer.clippingPlanes;
        try {
          renderer.setRenderTarget(w.target);
          const jobs: Promise<unknown>[] = [renderer.compileAsync(kit.group, cam, scene)];
          // The print's parts are cut by a clipping plane, and a cut material
          // is a shader of its own — which compile() does not make: it builds
          // for as many planes as the renderer last drew with, and that is
          // none. So that one was built where it could not be put off, on
          // the piece's first draw: the one long frame (130–270 ms) left in
          // the whole way from the hub into Build. Here the renderer is left
          // counting one plane — an empty scene, drawn with one that cuts
          // nothing — and the cut materials are compiled again, for that
          // count, in the background with the rest.
          renderer.clippingPlanes = [UNCUT];
          renderer.render(NOTHING, cam);
          const plate = kit.plates[0];
          for (const cut of [plate.parts[0], plate.cuts[0], kit.plates[3].parts[0]]) if (cut) jobs.push(renderer.compileAsync(cut, cam, scene));
          Promise.all(jobs).then(done, done);
        } catch {
          done();
        } finally {
          renderer.clippingPlanes = planes;
          renderer.setRenderTarget(before);
          for (const u of loosePieces) kit.group.remove(u);
        }
      }
      return false;
    }
    const unit = warmUnits[w.i];
    if (!unit) {
      w.target?.dispose();
      w.target = null;
      kit.warm.done = true;
      return true;
    }
    w.i++;
    // The solder joints and the wrong-side encoder hang on the board once it is found; until then they are loose.
    const loose = !unit.parent;
    if (loose) kit.group.add(unit);
    // Only this piece, wherever in the build's tree it hangs: everything
    // off, then the piece and the way down to it on.
    const saved: [THREE.Object3D, boolean, boolean][] = [];
    kit.group.traverse((o) => {
      saved.push([o, o.visible, o.frustumCulled]);
      o.visible = false;
    });
    unit.traverse((o) => {
      o.visible = true;
      o.frustumCulled = false;
    });
    for (let up = unit.parent; up && up !== kit.group; up = up.parent) up.visible = true;
    kit.group.visible = true;
    w.target ??= new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    const prev = renderer.getRenderTarget();
    const t0 = performance.now();
    try {
      renderer.setRenderTarget(w.target);
      renderer.render(scene, cam);
      if (process.env.NODE_ENV !== "production") {
        // For measuring (scratchpad craft/world/hitch.py): what each piece's first draw cost.
        const log = ((window as unknown as { __pfWarm?: { piece: number; kind: string; ms: number }[] }).__pfWarm ??= []);
        log.push({ piece: w.i - 1, kind: unit.type + (unit.name ? ":" + unit.name : ""), ms: Math.round(performance.now() - t0) });
      }
    } catch {
      // Nothing lost: the shader builds on first use instead.
    } finally {
      renderer.setRenderTarget(prev);
      for (const [o, vis, culled] of saved) {
        o.visible = vis;
        o.frustumCulled = culled;
      }
      kit.group.visible = false;
      if (loose) kit.group.remove(unit);
    }
    return false;
  };

  // Frames since mount, for the one-off warm-up draw below.
  const warmed = useRef(0);
  const clock = useRef({ beat: -1, start: 0, since: 0, t: -1, mounted: 0, replay: useGuideStore.getState().replay, heldOff: false, cutAt: 0, shown: NaN });
  const tmp = useMemo(
    () => ({
      a: pose(),
      b: pose(),
      c: pose(),
      r: rigid(),
      board: pose(),
      v: V(),
      v2: V(),
      v3: V(),
      v4: V(),
      v5: V(),
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      m: new THREE.Matrix4(),
      s: V(1, 1, 1),
      world: V(),
      open: V(),
      plugShown: V(1e9, 0, 0),
      tags: new Map<TagKey, THREE.Vector3>(),
      jacket: V(),
    }),
    [],
  );

  useFrame((state, rawDt) => {
    const onPage = useGuideStore.getState().page === "build";
    if (!dev.current) {
      // Nothing of the build is on stage until it takes the device over.
      kit.group.visible = false;
      if (!onPage) {
        // Standby on the hub: the shaders, while the device hangs apart and
        // still. Anywhere else it has no business — off the guide before it
        // ever drew, with nothing to hand back.
        if (useGuideStore.getState().page !== "hub") useGuideStore.getState().setBuildLive(false);
        else if (explodeState.amount === 1) warmStep(state.gl, state.scene, state.camera);
        return;
      }
      // On the guide: the device is taken over as it stands, apart or whole.
      // First what is left of the shaders — unless the reader is already
      // scrolling into the guide, then it starts at once — and those only
      // while the stage is still: the parts neither on their way out nor in,
      // the camera arrived (a slow frame in the middle of its move from the
      // hub is the stutter this is here to keep off the screen).
      if (useGuideStore.getState().scene === "opening") {
        const w = warm.current;
        const speed = w.seen ? state.camera.position.distanceTo(w.cam) / Math.max(rawDt, 1e-3) : Infinity;
        w.cam.copy(state.camera.position);
        w.seen = true;
        const still = speed < WARM_STILL && (explodeState.amount === 0 || explodeState.amount === 1);
        if (!kit.warm.done && !still) return;
        if (!warmStep(state.gl, state.scene, state.camera)) return;
      }
      dev.current = find();
    }
    const d = dev.current;
    if (!d) return;
    kit.group.visible = true;
    // Where Device has its own back cover and the DevKit this frame (it ran
    // just before this; the cover's place is overwritten further down).
    const deviceWhole =
      d.deviceSlider.position.lengthSq() < 1e-8 &&
      Math.abs(d.deviceSlider.quaternion.w) > 0.99999 &&
      d.kit.position.distanceToSquared(DEVKIT_SEAT.position) < 1e-6;
    if (warmed.current < 3 && ++warmed.current === 2) {
      // Draw everything the build adds once, off screen, before it is
      // needed: compiling alone misses the clipping planes' variant of a
      // shader and the shadow pass's, and a first draw mid-step froze the
      // page for a quarter of a second (the plates appearing).
      // Everything on, and nothing culled (the bench is outside the
      // opening's view and the shadow camera's).
      const saved: [THREE.Object3D, boolean, boolean][] = [];
      const all = (r: THREE.Object3D) =>
        r.traverse((o) => {
          saved.push([o, o.visible, o.frustumCulled]);
          o.visible = true;
          o.frustumCulled = false;
        });
      for (const r of [kit.group, kit.ghost, kit.joints]) all(r);
      all(d.root);
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
      const prev = gl.getRenderTarget();
      try {
        gl.setRenderTarget(target);
        gl.render(world, camera);
      } catch {
        // Nothing lost: the shaders build on first use instead.
      } finally {
        gl.setRenderTarget(prev);
        target.dispose();
        for (const [o, vis, culled] of saved) {
          o.visible = vis;
          o.frustumCulled = culled;
        }
      }
    }

    // ── where on the timeline ───────────────────────────────────────────────
    const dt = Math.min(rawDt, 0.1);
    const { scene: sid, step, cardIn, replay, narrow } = useGuideStore.getState();
    const s = stepOf(sid, step);
    let B = beatIndex(s.build);
    if (B < 0) B = sid === "next" ? BEATS.length - 1 : 0;
    const now = performance.now();
    const c = clock.current;
    if (!c.mounted) c.mounted = now;
    // The guide has been left: to the nearer end at which the device is whole.
    if (!onPage) B = c.t >= WHOLE_AGAIN / 2 ? BEATS.length - 1 : 0;
    if (B !== c.beat) {
      // Forward, a step plays its own motion; back, it shows how it ends.
      c.start = c.beat >= 0 && B < c.beat ? now - beatSeconds(B) * 1000 : now;
      c.beat = B;
      c.since = now;
    }
    // A step plays for its card. A chapter's first step is the current one
    // from the chapter's title on, a screen and more before its card: until
    // the card is on screen (store.ts cardIn) the beat waits at its start —
    // the build as the last chapter left it — and plays when the reader gets
    // there. Scrolling back up to the title winds it back, to play again.
    //
    // One thing does not wait for a card: the opening's device. It goes as
    // the opening is left — the first sixth of gather-1, the case fading and
    // the mat coming up — under the first chapter's title, while the camera
    // comes down to the bench. Held for the card, it hung in the top of the
    // bench's frame for as long as the title took to pass.
    if (!cardIn && onPage) c.start = now - (B === beatIndex("gather-1") ? Math.min(now - c.since, (OPENING_GONE - G1) * beatSeconds(B) * 1000) : 0);
    // "Replay" on the card: this step's motion again, from its start.
    if (replay !== c.replay) {
      c.replay = replay;
      c.start = now;
      c.t = B;
    }
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // On the guide, the step's own motion; off it, the end the build is being run to.
    const target = onPage ? B + Math.min(0.999, (now - c.start) / 1000 / beatSeconds(B)) : B === 0 ? 0 : B + 0.999;
    // It takes over a whole device: until told otherwise, the build stands at its opening.
    if (c.t < 0) c.t = Math.min(target, 0.5);
    const arriving = now - c.mounted < 700;
    const far = (arriving || !onPage) && Math.abs(target - c.t) > CUT_FAR;
    if (!far) c.cutAt = 0;
    if (far) {
      // Too much of the build lies between what is on stage and where it
      // must be — the guide opened on a step in its middle (a link, Back,
      // Forward), or left from one — to run through in view: a cut, made in
      // the dark. The world dips the canvas (store.requestCut →
      // Guide.module.css [data-cut]); the timeline jumps once it is out.
      if (!c.cutAt) {
        c.cutAt = now;
        useGuideStore.getState().requestCut();
      }
      if (now - c.cutAt >= CUT_DARK_MS) {
        c.t = target;
        c.cutAt = 0;
      }
    } else if (arriving && onPage) c.t = target;
    else if (reduced) c.t = onPage ? B + (cardIn ? beatStill(B) : 0) : target;
    else {
      const dlt = target - c.t;
      // Its own pace forward within the beat; quick from another beat, and
      // quick back to the beat's start.
      const sameBeat = Math.floor(c.t) === B && dlt >= 0;
      const rate = sameBeat ? 1.6 / beatSeconds(B) : Math.max(2.6, Math.abs(dlt) / 1.1);
      c.t += Math.sign(dlt) * Math.min(Math.abs(dlt), rate * dt);
    }
    if (process.env.NODE_ENV !== "production") {
      // For the filming and measuring scripts (scratchpad build3d/): the
      // timeline value, the stage's objects, and a way to hold the timeline
      // at a value (window.__pfBuildSeek = 14.37), to film a beat frame by frame.
      const w = window as unknown as { __pfBuildT?: number; __pfBuildSeek?: number; __pfBuild?: unknown };
      if (typeof w.__pfBuildSeek === "number") c.t = w.__pfBuildSeek;
      w.__pfBuildT = c.t;
      w.__pfBuild ??= { kit, dev: d, THREE };
    }
    const t = c.t;
    // The timeline has not moved since the last frame — a step holding its
    // end, which is most of the time a reader spends on it: the cables, each
    // a tube rebuilt from a curve, are as they were, and are left alone.
    const tStill = t === c.shown;
    c.shown = t;
    // For the camera and the scripted demos (timing.ts).
    buildClock.t = t;
    // The camera is still coming in while the step's motion plays, and is in
    // its frame as it ends (views.ts settleIn) — on the guide, on this step,
    // and not for a reader who has asked for less motion.
    {
      const late = narrow && s.narrowLate && t - B >= s.narrowLate.from ? s.narrowLate.view : null;
      const viewName = late ?? ((narrow && s.narrowView) || s.view);
      const through = Math.floor(t) === B ? t - B : t > B ? 1 : 0;
      settleIn(onPage && !reduced ? viewName : null, 1 - glide(through / 0.9), Math.min(1, beatSeconds(B) / 4), through);
    }
    // Left, the build at an end, and Device's own parts home: this frame
    // draws the whole device, and is the last (see the end of the frame).
    const handBack = !onPage && (t < G1 || t >= WHOLE_AGAIN) && deviceWhole;

    const finished = t < G1; // the opening: the device as it will end up
    // What this frame is about, for whoever wants to know (focus.ts): set by the parts below that are.
    buildFocus.on = false;
    const caseFade = finished ? 1 : 1 - span(t, G1, G1 + 0.16);
    // The opening's device may be standing apart (stage/Explode: the hub's
    // answer to Build, kept through Build's opening): how far, 0 whole … 1,
    // and each part's way out by it. Everything this stage places at its
    // opening it places by this, until that device has faded (OPENING_GONE).
    const apart = t < OPENING_GONE ? explodeState.amount : 0;
    const open = (part: ExplodePart) => partOffset(part, apart, tmp.open) as THREE.Vector3;
    // Apart, the board and the DevKit are out in the open, and cannot simply
    // stop being there when the bench comes up (whole, they are inside the
    // case and nobody sees them go): they are drawn in to nothing where they
    // hang, as the case fades round them.
    const going = apart > 0 && !finished;
    const gone = going ? 1 - span(t, G1, G1 + 0.15, ease) : 1;
    // What is inside the closed case and is not Device's — the screws, the
    // nuts, the cables, the power bank: the hub's device has none of them,
    // so apart they are not drawn. The case is shut again before the amount
    // is back at 0, so they are never seen to come or go.
    const shut = !(finished && apart > 0);

    // ── the board ───────────────────────────────────────────────────────────
    const bp = tmp.board;
    let boardScale = 1;
    let boardOn = true;
    if (t < G1) {
      bp.p.copy(BOARD_IN_CASE.p).add(open("board"));
      bp.q.copy(BOARD_IN_CASE.q);
    } else if (t < ARRIVE_BOARD) {
      if (going && gone > 0.002) {
        bp.p.copy(BOARD_IN_CASE.p).add(open("board"));
        bp.q.copy(BOARD_IN_CASE.q);
        boardScale = gone;
      } else boardOn = false;
    } else if (t < P1) {
      const dr = drop(t, ARRIVE_BOARD, 0.13);
      bp.p.copy(BOARD_FLAT.p).setY(BOARD_FLAT.p.y + dr.fall * 4);
      bp.q.copy(tilt(40, 0.1 * dr.lean)).multiply(BOARD_FLAT.q);
      boardScale = dr.scale;
    } else if (t < S1) {
      // Up off the mat, over once — the PATTERNFLOW face, the plain face —
      // and held up to be read (print-1); off to the side while the case
      // prints (print-2 on).
      if (t < P1 + 0.3) carry(BOARD_FLAT, BOARD_LIFT, span(t, P1, P1 + 0.3, clamp01), 0.5, bp);
      else if (t < P2) {
        // Once over about its long axis: a lean back, round, a hair past and level.
        bp.p.copy(BOARD_LIFT.p);
        bp.q.copy(BOARD_LIFT.q).multiply(tmp.q.setFromAxisAngle(V(0, 0, 1), Math.PI * 2 * span(t, P1 + 0.34, P1 + 0.86, (x) => swing(x, 0.012, 0.012))));
      } else carry(BOARD_LIFT, BOARD_PARK, span(t, P2, P2 + 0.16, clamp01), 2, bp);
    } else if (t < C3) {
      if (t < S1 + 0.22) carry(BOARD_PARK, BOARD_WORK, span(t, S1 + 0.03, S1 + 0.22, clamp01), 4, bp);
      else bp.p.copy(BOARD_WORK.p);
      let flip = 0;
      FLIPS.forEach(([a, b], i) => {
        flip += (i % 2 ? -1 : 1) * span(t, a, b, turnOver);
      });
      if (t >= S1 + 0.22) bp.q.copy(tmp.q.setFromAxisAngle(V(0, 0, 1), Math.PI * flip)).multiply(BOARD_WORK.q);
    } else if (t < C4) {
      // Round the case's right side to behind its bay, turning to face the
      // back — once the lead is through the case's cable hole and waiting
      // there (BUILD_GUIDE §7.3: the cable goes through first).
      const u = span(t, BOARD_OVER[0], BOARD_OVER[1], glide);
      bezier(BOARD_WORK.p, tmp.v.set(16, 10, 30), tmp.v2.set(27, 22, -12), BOARD_HOVER.p, u, bp.p);
      bp.q.slerpQuaternions(BOARD_WORK.q, BOARD_HOVER.q, glide((u - 0.12) / 0.7));
    } else {
      // Straight in: up to the bay, the four shafts found in their holes, and
      // pushed home through the front face.
      const u = span(t, C4 + 0.14, C4 + 0.7, (x) => press(x, 0.8));
      bp.p.lerpVectors(BOARD_HOVER.p, BOARD_IN_CASE.p, u);
      bp.q.copy(BOARD_IN_CASE.q);
    }
    d.pcb.visible = boardOn;
    d.pcb.position.copy(bp.p);
    d.pcb.quaternion.copy(bp.q);
    d.pcb.scale.setScalar(PCB_PLACEMENT.scale * boardScale);
    d.pcb.updateMatrixWorld(true);
    const boardPose: Pose = bp;

    // ── the parts: on the board, arriving on the mat, in the row, into their holes ──
    PART_ORDER.forEach((name, k) => {
      const part = d.parts[name];
      const node = part.node;
      const enc = name.startsWith("SW");
      const onBoard = (out: Pose, approach = 0) => {
        out.p.copy(part.hp);
        if (approach) out.p.y += enc ? -approach : approach;
        boardToModel(out.p, boardPose, out.p);
        out.q.copy(boardPose.q).multiply(part.hq);
        return out;
      };
      // In the row: as it sits on a flat board (an encoder turned over,
      // shaft up), standing on the mat. A board placed so that the part's
      // box (board frame, min/max) is centred on its spot and rests on the
      // mat, and the part where that board would hold it.
      const row = (out: Pose) => {
        const sx = ROW[name];
        const cx = ((part.min.x + part.max.x) / 2) * 100;
        const cz = ((part.min.z + part.max.z) / 2) * 100;
        const hp = tmp.v4.copy(part.hp).multiplyScalar(100);
        if (enc) {
          // Turned over about z: x → −x, y → −y; the box's top becomes its bottom.
          out.q.copy(TURNED).multiply(part.hq);
          out.p.set(sx + cx, MAT_TOP + part.max.y * 100, ROW_Z - cz).add(hp.applyQuaternion(TURNED));
        } else {
          out.q.copy(part.hq);
          out.p.set(sx - cx, MAT_TOP - part.min.y * 100, ROW_Z - cz).add(hp);
        }
        return out;
      };
      const [i0, i1] = INSERT[name];
      let scale = 1;
      let on = true;
      if (t < G1) onBoard(tmp.a);
      else if (going && boardOn) {
        // Still on the board, as the opening has it, and going with it: drawn in toward the board's middle.
        onBoard(tmp.a);
        tmp.a.p.sub(boardPose.p).multiplyScalar(gone).add(boardPose.p);
        scale = gone;
      } else if (t < i0) {
        const dr = drop(t, ARRIVE[name]);
        on = dr.on;
        row(tmp.a);
        tmp.a.p.y += dr.fall * 3;
        tmp.a.q.premultiply(tilt(k, 0.26 * dr.lean));
        scale = dr.scale;
      } else if (t < i1) {
        // Picked out of the row and carried to just over its holes; then its
        // pins found in them, and pushed down until its body is on the board.
        const x = span(t, i0, i1, clamp01);
        const over = 0.62;
        row(tmp.b);
        if (x < over) {
          onBoard(tmp.c, 0.022);
          carry(tmp.b, tmp.c, x / over, 2.6, tmp.a);
          // The capacitor is turned once round on its way — its stripe and its
          // long lead go by — on top of the carry: as a pose for the carry to
          // turn toward, a turn past half-way came back the short way, in one frame.
          if (name === "C11") tmp.a.q.premultiply(tmp.q.setFromAxisAngle(tmp.v.set(0, 1, 0).applyQuaternion(boardPose.q), Math.PI * 2 * glide(x / over)));
        } else {
          onBoard(tmp.b, 0.022);
          onBoard(tmp.c);
          tmp.a.p.lerpVectors(tmp.b.p, tmp.c.p, press((x - over) / (1 - over), 0.72));
          tmp.a.q.copy(tmp.c.q);
        }
      } else onBoard(tmp.a);
      node.visible = t < G1 || (on && (t < i1 || boardOn));
      node.position.copy(tmp.a.p);
      node.quaternion.copy(tmp.a.q);
      node.scale.setScalar(PCB_PLACEMENT.scale * scale * (t < i0 ? 1 : boardScale));
    });

    // ── solder joints and the iron ──────────────────────────────────────────
    //
    // The iron comes in along its own length to the round's first pad, and
    // works through them: on a pad for a moment, over to the next — a short
    // slide along a row of pins, a real lift across the board — and away
    // again the way it came once the last is made. A joint starts when the
    // iron reaches its pad: a bead of molten solder, which then wets — it
    // draws in to the pad and climbs the pin into a fillet — and cools: liquid
    // and mirror-bright under the tip, frosting over a joint or two behind
    // the iron (look/materials.ts solderMaterial: its heat is in its
    // surface, not in a glow).
    let ironTip: THREE.Vector3 | null = null;
    {
      const m = tmp.m;
      const heat = kit.jointHeat.array as Float32Array;
      kit.jointList.forEach((j, i) => {
        const age = finished ? 2 : (t - j.at) / j.life;
        if (age <= 0) {
          m.compose(j.pos, IDENTITY, tmp.s.setScalar(0));
          kit.joints.setMatrixAt(i, m);
          heat[i] = 0;
          return;
        }
        const melt = ease(age / 0.22);
        const wet = glide((age - 0.18) / 0.42);
        const r = j.r * (1.5 * melt - 0.5 * wet);
        const h = 0.0011 * (0.4 * melt + 0.6 * wet);
        tmp.q.copy(j.up ? IDENTITY : FLIPPED);
        m.compose(j.pos, tmp.q, tmp.s.set(r, h, r));
        kit.joints.setMatrixAt(i, m);
        heat[i] = 1 - glide((age - 0.1) / 0.9);
      });
      kit.joints.instanceMatrix.needsUpdate = true;
      kit.jointHeat.needsUpdate = true;
      kit.joints.visible = boardOn;
      for (const round of kit.rounds) {
        const lead = 0.36 / round.secs;
        const dwell = 0.12 / round.secs;
        if (t < round.from - lead || t > round.to + dwell + lead) continue;
        const list = round.list;
        let i = 0;
        while (i < list.length - 2 && t >= list[i + 1].at) i++;
        const a = list[i];
        const b = list[Math.min(list.length - 1, i + 1)];
        const f = clamp01((t - a.at) / Math.max(1e-6, b.at - a.at));
        // On the pad for `hold` of the way to the next one, then over to it; along a row, straight on.
        const go = b.hop === 0 ? f : glide((f - b.hold) / (1 - b.hold));
        tmp.v.lerpVectors(a.pos, b.pos, go);
        tmp.v.y = a.up ? 0.0028 : -0.0012;
        ironTip = d.pcb.localToWorld(tmp.v2.copy(tmp.v));
        kit.group.worldToLocal(ironTip);
        // Lifted between pads by how far apart they are; in before the first, out after the last.
        const hop = Math.sin(Math.PI * go) * b.hop;
        const coming = 1 - span(t, round.from - lead, round.from, reach);
        const leaving = span(t, round.to + dwell, round.to + dwell + lead, fall);
        ironTip.addScaledVector(IRON_AXIS, hop + (coming + leaving) * 4.4);
      }
    }
    kit.iron.visible = !!ironTip;
    if (ironTip) {
      kit.iron.position.copy(ironTip);
      kit.iron.quaternion.setFromUnitVectors(Y, IRON_AXIS);
      buildFocus.on = true;
      buildFocus.size = 0.06;
      buildFocus.world.copy(ironTip).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
    }

    // The encoder that went in from the wrong side (solder-4).
    {
      const u = span(t, S4 + 0.02, S4 + 0.11, clamp01);
      const fade = 1 - span(t, S4 + 0.15, S4 + 0.2);
      const on = t > S4 && t < S4 + 0.2;
      kit.ghost.visible = on;
      kit.ghostMat.opacity = 0.5 * fade * Math.min(1, u * 4);
      // Mirrored onto the F side, coming down onto SW1's place.
      const c0 = SW_CENTRES[0];
      // It comes down onto the printed side, is refused — a shake of the head — and goes back up as it fades.
      kit.ghost.position.set(0.0014 * shake((t - (S4 + 0.11)) / 0.05), 0.0016 + 0.028 * (1 - reach(u)) + 0.012 * (1 - fade), 0);
      kit.ghost.scale.set(1, -1, 1);
      void c0;
    }

    // ── the holder ──────────────────────────────────────────────────────────
    {
      const up = span(t, S1, S1 + 0.1, ease) * (1 - span(t, BOARD_OVER[1], BOARD_OVER[1] + 0.1));
      // The jaws stand open until the board is between them, close on its two
      // short edges, and let go of it just before it is carried off.
      const grip = span(t, S1 + 0.2, S1 + 0.26, ease) * (1 - span(t, BOARD_OVER[0] - 0.05, BOARD_OVER[0] - 0.01, ease));
      kit.holder.group.visible = up > 0.001;
      kit.holder.posts.forEach((p) => p.scale.set(1, 2.75 * up + 0.001, 1));
      kit.holder.jaws.forEach((j, i) => {
        j.visible = up > 0.98;
        j.position.y = BOARD_WORK.p.y + 0.075;
        j.position.z = HOLDER_Z[i] + (i === 0 ? -1 : 1) * (0.12 + 0.6 * (1 - grip));
      });
    }

    // ── the DevKit ──────────────────────────────────────────────────────────
    {
      const kp = d.kit;
      if (t < G1) {
        // Device has it on its pins inside the closed case; back from the
        // bench, it is not shown on its way there.
        // (Apart, its pins are where Explode has put them: that far behind the board's sockets.)
        kp.visible = true;
        kp.scale.setScalar(kp.position.distanceToSquared(tmp.v.copy(DEVKIT_SEAT.position).add(open("devkit"))) < 1e-4 ? 100 : 1e-4);
      } else if (going) {
        // Hanging apart behind the board: it goes as the board does.
        kp.visible = true;
        kp.position.copy(DEVKIT_SEAT.position).add(open("devkit"));
        kp.quaternion.copy(DEVKIT_SEAT.quaternion);
        kp.scale.setScalar(Math.max(1e-4, 100 * gone));
      } else if (t < F1 + 0.45) {
        // Not on the mat yet: shrunk away rather than hidden — KitFx keeps a
        // light on it, and a light going out changes every lit shader in the
        // scene (a frozen frame while they all rebuild).
        const dr = drop(t, ARRIVE_DEVKIT, 0.13);
        kp.visible = true;
        if (t < F1) {
          kp.position.copy(DEVKIT_BENCH.p).setY(DEVKIT_BENCH.p.y + dr.fall * 3);
          kp.quaternion.copy(tilt(20, 0.16 * dr.lean)).multiply(DEVKIT_BENCH.q);
          kp.scale.setScalar(dr.on ? Math.max(1e-4, 100 * dr.scale) : 1e-4);
        } else {
          // Up from the mat into the reader's hands (Device and KitFx take it from there).
          arc(DEVKIT_BENCH, KIT_PRESENTED, span(t, F1 + 0.02, F1 + 0.42, glide), 3, tmp.a);
          const w = 1 - span(t, F1 + 0.36, F1 + 0.45);
          // Blend into wherever Device has it, so handing over never jumps.
          kp.position.lerp(tmp.a.p, w);
          kp.quaternion.slerp(tmp.a.q, w);
          kp.scale.setScalar(100);
        }
      } else {
        kp.visible = true;
        kp.scale.setScalar(100);
      }
    }

    // ── the case ────────────────────────────────────────────────────────────
    // When the bonded halves become the one-piece body (the same shape in the same place: nothing shows).
    const swapAt = P4 + 0.72;
    // The printed parts that wait for the end of the build — the back, the
    // two covers, the knobs — lie beside the case from the moment they are
    // bonded. They are put away with the bench (the mat goes at firmware-1)
    // and are back as each is wanted: lying there through first light they
    // were white slabs cut by the frame's left edge and running under the
    // card, at the one moment the stage should hold nothing but the device
    // and its light. (Device does the same with its own back cover, set down
    // for Play's first chapter.)
    const away = 1 - span(t, F1 + 0.55, F1 + 0.95);
    const spare = {
      back: t < K4 ? away : span(t, K4, K4 + 0.05),
      // (The cover lies at the edge of check-4's frame: it is back as it is picked up, not before.)
      slider: t < K4 + 0.66 ? away : span(t, K4 + 0.66, K4 + 0.74),
      // The lid and the knobs: for the last step.
      late: t < K5 ? away : span(t, K5, K5 + 0.08),
    };
    {
      // Device's body: the finished device, then gone until the halves are bonded.
      d.body.visible = finished ? true : t < G1 + 0.17 || t >= swapAt;
      for (const mat of d.fade) mat.opacity = t < G1 + 0.17 ? caseFade : 1;
      d.deviceSlider.visible = false;
      d.deviceSlider.position.set(0, 0, 0);
      d.deviceSlider.quaternion.identity();

      // The back panel: bonded at rest, then hooked in and swung shut (check-4).
      const bpMesh = d.backPlate;
      bpMesh.castShadow = t < swapAt || spare.back > 0.5;
      if (t < G1 + 0.17) {
        bpMesh.visible = true;
        setRigid(bpMesh, places.home);
        bpMesh.position.add(open("backPlate"));
      } else if (t < swapAt) bpMesh.visible = false;
      else {
        // Lying beside the case until it is wanted — and put away with the bench in between (`spare`, above).
        (bpMesh.material as THREE.MeshStandardMaterial).opacity = spare.back;
        bpMesh.visible = spare.back > 0.01;
        if (t < K4) setRigid(bpMesh, places.backRest);
        else if (t < K4 + 0.32) setRigid(bpMesh, carryRigid(centres.back_plate, places.backRest, places.hingeAway, span(t, K4 + 0.06, K4 + 0.32, clamp01), 6, tmp.r));
        else if (t < K4 + 0.44) {
          // Its outer edge brought up to the case's and hooked in.
          tmp.r.q.copy(places.hingeOpen.q);
          tmp.r.T.lerpVectors(places.hingeAway.T, places.hingeOpen.T, span(t, K4 + 0.32, K4 + 0.43, reach));
          setRigid(bpMesh, tmp.r);
        } else {
          // Swung shut: it comes to rest on its catch, a couple of degrees
          // open, and is pressed home — the click. Shut and no further: an
          // ease that overshoots swung the panel on through the ribbon.
          const a = BACK_OPEN_ANGLE * latch(span(t, K4 + 0.45, K4 + 0.67, clamp01));
          tmp.r.q.setFromAxisAngle(Y, a);
          tmp.r.T.copy(BACK_HINGE).sub(tmp.v.copy(BACK_HINGE).applyQuaternion(tmp.r.q));
          setRigid(bpMesh, tmp.r);
        }
        if (t >= K4 + 0.06 && t < K4 + 0.68) {
          buildFocus.on = true;
          buildFocus.size = 2.4;
          buildFocus.world.copy(centres.back_plate).applyQuaternion(bpMesh.quaternion).add(bpMesh.position).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
        }
      }
      if (d.notch) d.notch.visible = finished || t >= K4 + 0.655;

      // The PCB cover (the stage's copy). Printed on plate 3 (the plate's own
      // mesh shows it until print-4), it stays on its plate until it is
      // lifted off: from P4 this one is there, in the same place.
      const sl = kit.slider;
      const slMat = sl.material as THREE.MeshStandardMaterial;
      slMat.opacity = t < G1 + 0.17 ? caseFade : spare.slider;
      sl.castShadow = t < G1 + 0.17 || spare.slider > 0.5;
      if (t < G1 + 0.17) {
        sl.visible = true;
        setRigid(sl, places.home);
        sl.position.add(open("slider"));
      } else if (t < P4) sl.visible = false;
      else {
        sl.visible = spare.slider > 0.01;
        if (t < P4 + 0.56) setRigid(sl, carryRigid(centres.back_slider, places.plate.back_slider, places.sliderRest, span(t, P4 + 0.3, P4 + 0.56, clamp01), 10, tmp.r));
        else if (t < K4 + 0.68) setRigid(sl, places.sliderRest);
        else if (t < K4 + 0.86) setRigid(sl, carryRigid(centres.back_slider, places.sliderRest, places.sliderOut, span(t, K4 + 0.68, K4 + 0.86, clamp01), 6, tmp.r));
        else {
          // Along its rails: freely until the catch, then pushed over it.
          tmp.r.q.identity();
          tmp.r.T.set(SLIDER_OUT_X * (1 - span(t, K4 + 0.865, K4 + 0.99, (x) => press(x, 0.9))), 0, 0);
          setRigid(sl, tmp.r);
        }
        if (t >= K4 + 0.68 && t < K5) {
          buildFocus.on = true;
          buildFocus.size = 1.2;
          buildFocus.world.copy(centres.back_slider).applyQuaternion(sl.quaternion).add(sl.position).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
        }
      }

      // The lid over the power-bank tray: printed, laid down beside the
      // case with the other covers, and slid in from the case's side at the
      // end (check-5).
      const lid = d.topLid;
      lid.castShadow = t < P4 || spare.late > 0.5;
      if (t < G1 + 0.17) {
        lid.visible = true;
        setRigid(lid, places.home);
        lid.position.add(open("lid"));
      } else if (t < P4) lid.visible = false;
      else {
        (lid.material as THREE.MeshStandardMaterial).opacity = spare.late;
        lid.visible = spare.late > 0.01;
        if (t < P4 + 0.62) setRigid(lid, carryRigid(centres.top_lid, places.plate.top_lid, places.lidRest, span(t, P4 + 0.38, P4 + 0.62, clamp01), 9, tmp.r));
        else if (t < K5) setRigid(lid, places.lidRest);
        else if (t < K5 + 0.32) setRigid(lid, carryRigid(centres.top_lid, places.lidRest, places.lidApproach, span(t, K5 + 0.12, K5 + 0.32, clamp01), 5, tmp.r));
        else {
          // Along its rails, in from the case's side: freely, then pushed the last of the way.
          tmp.r.q.identity();
          tmp.r.T.set(LID_CLEAR * (1 - span(t, K5 + 0.33, K5 + 0.5, (x) => press(x, 0.92))), 0, 0);
          setRigid(lid, tmp.r);
        }
      }
    }

    // ── printing and bonding ────────────────────────────────────────────────
    {
      const platesOn = t >= P2 && t < P4 + 0.92;
      const plateFade = span(t, P2, P2 + 0.05) * (1 - span(t, P4 + 0.72, P4 + 0.92));
      (kit.plates[0].slab.material as THREE.MeshStandardMaterial).opacity = plateFade;
      kit.plateGround.visible = platesOn;
      kit.plateGroundMat.opacity = plateFade;
      kit.plateShadeMat.opacity = 0.6 * plateFade;
      kit.plates.forEach((pl, i) => {
        const p = i + 1;
        pl.group.visible = platesOn && (p < 4 || t >= P3);
        const from = p < 4 ? P2 + 0.05 : P3 + 0.05;
        const to = p < 4 ? P2 + 0.95 : P3 + 0.9;
        const u = clamp01((t - from) / (to - from));
        // The cut rises a layer at a time and stands in the middle of one,
        // never in a face: a plane sliding up through the flat parts (5.4 mm
        // tall, their tops and pockets all level) grazed them, and the cut's
        // tone showed through in smudges and streaks.
        const h = Math.min(PLATE_HEIGHT[p], (Math.floor((PLATE_HEIGHT[p] * u) / LAYER) + 0.5) * LAYER);
        const printing = u > 0 && u < 1;
        // The cut, in world units (clipping planes are in world space).
        kit.clip[i].constant = u >= 1 ? 1e4 : (plateCorner(p, tmp.v).y + h) * MODEL_SCALE + MODEL_OFFSET.y + (u <= 0 ? -1 : 0.0005);
        pl.parts.forEach((m) => {
          m.visible = t < P4 && u > 0;
        });
        pl.cuts.forEach((m) => {
          m.visible = printing;
        });
        pl.line.position.y = h;
        (pl.line.material as THREE.LineBasicMaterial).opacity = printing ? 0.9 : 0;
        pl.slab.visible = true;
        // The nozzle, round the plate's parts about once a second.
        const laying = printing && pl.length > 0;
        pl.nozzle.visible = laying;
        pl.bead.visible = laying;
        if (laying) {
          const secs = beatSeconds(Math.floor(from)) * (to - from);
          const laps = Math.max(1, Math.round(secs / 1.15));
          const along = (((u * laps) % 1) + 1) % 1;
          let part = tourAt(pl.tour, pl.length, along, tmp.v);
          pl.nozzle.position.set(tmp.v.x, h + 0.05, tmp.v.z);
          // In at the start of the print and out at its end; dim on the way across to the next part.
          const on = span(u, 0, 0.03, clamp01) * (1 - span(u, 0.97, 1, clamp01));
          (pl.nozzle.material as THREE.SpriteMaterial).opacity = on * (part >= 0 ? 1 : 0.2);
          const pos = pl.bead.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let k = 0; k < BEAD; k++) {
            // The bead behind it: no further back than the print's start, and
            // only where both ends of a piece are on the same part's wall.
            const back = Math.min((k + 1) * BEAD_STEP, u * laps);
            const next = tourAt(pl.tour, pl.length, (((along - back) % 1) + 1) % 1, tmp.v2);
            const laid = part >= 0 && next === part;
            pos.setXYZ(k * 2, tmp.v.x, h + 0.012, tmp.v.z);
            pos.setXYZ(k * 2 + 1, laid ? tmp.v2.x : tmp.v.x, h + 0.012, laid ? tmp.v2.z : tmp.v.z);
            tmp.v.copy(tmp.v2);
            part = next;
          }
          pos.needsUpdate = true;
          (pl.bead.material as THREE.LineBasicMaterial).opacity = on;
        }
      });

      // The halves: off their plates, turned to stand as they will, closed up.
      const bonding = t >= P4 && t < swapAt;
      const sp = kit.split;
      for (const n of ["frame_bottom", "frame_top", "back_bottom", "back_top"]) sp[n].visible = bonding;
      if (bonding) {
        // Each half is lifted off its plate, turned to stand as it will,
        // and set down — the lower one first, the upper one held over it —
        // then the two are pressed together: up to the seam, a breath while
        // the edges line up, and closed.
        setRigid(sp.frame_bottom, carryRigid(centres.frame_bottom, places.plate.frame_bottom, places.home, span(t, P4, P4 + 0.28, clamp01), 12, tmp.r));
        if (t < P4 + 0.31) setRigid(sp.frame_top, carryRigid(centres.frame_top, places.plate.frame_top, places.frameTopApart, span(t, P4 + 0.04, P4 + 0.31, clamp01), 14, tmp.r));
        else {
          tmp.r.q.identity();
          tmp.r.T.set(0, 3.2 * (1 - span(t, P4 + 0.32, P4 + 0.46, (x) => press(x, 0.86))), 0);
          setRigid(sp.frame_top, tmp.r);
        }
        setRigid(sp.back_bottom, carryRigid(centres.back_bottom, places.plate.back_bottom, places.backRest, span(t, P4 + 0.05, P4 + 0.31, clamp01), 10, tmp.r));
        if (t < P4 + 0.34) setRigid(sp.back_top, carryRigid(centres.back_top, places.plate.back_top, places.backTopApart, span(t, P4 + 0.08, P4 + 0.34, clamp01), 10, tmp.r));
        else {
          tmp.r.q.copy(places.backRest.q);
          tmp.r.T.lerpVectors(places.backTopApart.T, places.backRest.T, span(t, P4 + 0.35, P4 + 0.48, (x) => press(x, 0.86)));
          setRigid(sp.back_top, tmp.r);
        }
      }
      // Tape and a glow along each seam while it cures.
      // A strip at a time, laid across the seam from its middle and smoothed
      // down to both ends; and peeled off again, the same way, once it has cured.
      const tape = t >= P4 + 0.48 && t < swapAt;
      const peel = (i: number) => 1 - span(t, swapAt - 0.09 + i * 0.015, swapAt - 0.05 + i * 0.015, ease);
      kit.frameTape.forEach((m, i) => {
        const on = span(t, P4 + 0.48 + i * 0.025, P4 + 0.51 + i * 0.025, ease) * peel(i);
        m.visible = tape && on > 0;
        m.scale.set(1, Math.max(0.02, on), 1);
      });
      setRigid(kit.backSeamGroup, places.backRest);
      kit.backTape.forEach((m, i) => {
        const on = span(t, P4 + 0.5 + i * 0.025, P4 + 0.53 + i * 0.025, ease) * peel(i);
        m.visible = tape && on > 0;
        m.scale.set(1, Math.max(0.02, on), 1);
      });
      const pulse = t >= P4 + 0.46 && t < swapAt ? (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 7)) * (1 - span(t, swapAt - 0.14, swapAt - 0.08)) : 0;
      kit.seamMat.opacity = pulse;
      kit.frameSeam.visible = pulse > 0.01;
      kit.backSeamGroup.visible = t >= P4 + 0.48 && t < swapAt;
    }

    // ── the knobs ───────────────────────────────────────────────────────────
    d.knobs.forEach((k, i) => {
      const home = d.knobHome[i];
      const mat = d.knobMats[i] as THREE.MeshStandardMaterial;
      const onAt = K5 + 0.52 + i * 0.09;
      const doneAt = onAt + 0.2;
      // With the case at the opening; put away with the bench while they wait on the floor (`spare`).
      mat.opacity = t < G1 + 0.17 ? caseFade : t < doneAt ? spare.late : 1;
      if (finished || t >= doneAt) {
        // Device's: home, turning and pressing as the encoder does.
        if (!d.released[i]) {
          d.released[i] = true;
          k.quaternion.copy(home.q);
          k.position.copy(home.p);
        }
        k.scale.setScalar(1);
        k.visible = true;
        return;
      }
      d.released[i] = false;
      let shown = true;
      if (t < G1 + 0.17) {
        // Fading with the case, where the opening has it.
        k.position.copy(home.p);
        k.position.z += open("knobs").z;
        k.quaternion.copy(home.q);
      } else if (t < P4 || spare.late < 0.01) shown = false;
      else {
        const plateP = tmp.a;
        plateCorner(4, plateP.p).add(V(KNOB_PLATE_XZ[i][0], 2, KNOB_PLATE_XZ[i][1]));
        plateP.q.copy(qx(Math.PI / 2));
        const rest = tmp.b;
        rest.p.set(KNOB_REST_X, 2.0, KNOB_REST_Z[i]);
        rest.q.copy(qx(Math.PI / 2));
        if (t < P4 + 0.5) {
          k.position.copy(plateP.p);
          k.quaternion.copy(plateP.q);
        } else if (t < P4 + 0.84) {
          carry(plateP, rest, span(t, P4 + 0.5 + i * 0.045, P4 + 0.7 + i * 0.045, clamp01), 8, tmp.c);
          k.position.copy(tmp.c.p);
          k.quaternion.copy(tmp.c.q);
        } else if (t < onAt) {
          k.position.copy(rest.p);
          k.quaternion.copy(rest.q);
        } else {
          // Up to the front of its shaft; turned until its flat finds the
          // shaft's; pushed on — it goes on tight, most of the way and then
          // home — and the encoder gives under the last of the push.
          const above = tmp.c;
          above.p.copy(home.p);
          above.p.z += 2.4;
          above.q.copy(home.q);
          // It arrives turned a little off, and is turned true as it goes on.
          const off = (i % 2 ? -0.7 : 0.7) * span(t, onAt + 0.03, onAt + 0.12, glide) * (1 - span(t, onAt + 0.12, onAt + 0.16, glide));
          if (t < onAt + 0.12) {
            arc(rest, above, span(t, onAt, onAt + 0.12, glide), 2.2, tmp.a);
            k.position.copy(tmp.a.p);
            k.quaternion.copy(tmp.a.q);
          } else {
            const x = span(t, onAt + 0.12, onAt + 0.2, clamp01);
            k.position.lerpVectors(above.p, home.p, press(x, 0.66));
            k.position.z -= KNOB_PRESS * Math.sin(Math.PI * clamp01((x - 0.74) / 0.26));
            k.quaternion.copy(home.q);
          }
          k.quaternion.multiply(tmp.q.setFromAxisAngle(tmp.v.set(0, 0, 1), off));
          buildFocus.on = true;
          buildFocus.size = 0.3;
          buildFocus.world.copy(k.position).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
        }
      }
      k.visible = shown;
      k.scale.setScalar(shown ? 1 : 1e-4);
    });
    // The dials round the knobs only once the device is whole enough to turn.
    const dialsOn = finished || t >= K1;
    d.dials.forEach((g) => g.scale.setScalar(dialsOn ? 1 : 1e-4));

    // ── the panel ───────────────────────────────────────────────────────────
    {
      // Device's LED mesh where it can light (the finished device, and from
      // the moment the panel is seated); the stage's dark copy everywhere else.
      const pg = kit.panel.group;
      const ledOn = finished || t >= C2;
      d.led.visible = ledOn;
      if (kit.panel.slab) kit.panel.slab.visible = !ledOn;
      const arrive = ARRIVE2.panel;
      let on = true;
      let scale = 1;
      let alpha = 1;
      if (t < G1 + 0.17) {
        pg.position.copy(PANEL_CENTRE).add(open("panel"));
        pg.quaternion.identity();
        alpha = caseFade;
      } else if (t < C1) {
        // The heaviest thing on the bench: let down, not dropped.
        const dr = drop(t, arrive, 0.2, true);
        on = dr.on;
        pg.position.copy(PANEL_BENCH.p).setY(PANEL_BENCH.p.y + dr.fall * 3);
        pg.quaternion.copy(tilt(31, 0.07 * dr.lean)).multiply(PANEL_BENCH.q);
        scale = dr.scale;
      } else if (t < C1 + 0.5) {
        // Up off the mat and stood up in FRONT of the frame, its back to the
        // frame, IN end up: the panel only goes in from the front (the
        // frame's ledge and its twelve tabs are behind it).
        const u = span(t, C1 + 0.1, C1 + 0.5, glide);
        const front = tmp.v.copy(PANEL_CENTRE);
        front.z += PANEL_FRONT_GAP;
        bezier(PANEL_BENCH.p, tmp.v2.set(PANEL_BENCH.p.x, 15, PANEL_BENCH.p.z), tmp.v3.set(-9, 21, 21), front, u, pg.position);
        pg.quaternion.slerpQuaternions(PANEL_BENCH.q, IDENTITY, glide((u - 0.08) / 0.8));
      } else {
        // In along −z, its bottom edge first: up to the frame quickly, then
        // slowly — the fit has almost no clearance, and it is worked in, one
        // side a hair ahead of the other — until the bottom of its rim is on
        // the ledge; then the top is pressed home after it, in two pushes,
        // until the rim is on the ledge and the tabs all round.
        const x = span(t, C1 + 0.52, C1 + 0.97, clamp01);
        const gap = PANEL_FRONT_GAP * (1 - 0.87 * reach(x / 0.34) - 0.09 * span(x, 0.34, 0.58, clamp01) - 0.04 * span(x, 0.58, 0.68, ease));
        const lean = 0.075 * glide(x / 0.3) * (1 - 0.6 * span(x, 0.68, 0.78, reach) - 0.4 * span(x, 0.86, 0.96, reach));
        const work = 0.011 * Math.sin((x - 0.34) * 46) * span(x, 0.34, 0.4, clamp01) * (1 - span(x, 0.56, 0.68, clamp01));
        pg.quaternion.setFromAxisAngle(tmp.v.set(1, 0, 0), lean).multiply(tmp.q.setFromAxisAngle(Y, work));
        // About its bottom back edge, which travels straight in.
        const edge = tmp.v2.set(0, -16, -0.85);
        pg.position.copy(PANEL_CENTRE).add(edge);
        pg.position.z += gap;
        pg.position.sub(edge.applyQuaternion(pg.quaternion));
      }
      if (t >= C1 + 0.1 && t < C2) {
        buildFocus.on = true;
        buildFocus.size = 3;
        buildFocus.world.copy(pg.position).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
      }
      pg.visible = on;
      pg.scale.setScalar(scale);
      for (const m of kit.panel.mats) m.opacity = alpha;
    }

    // ── screws ──────────────────────────────────────────────────────────────
    {
      const m = tmp.m;
      const lying = qx(-Math.PI / 2);
      SCREW_HOLES.forEach(([hx, hy], k) => {
        const seated = tmp.a;
        seated.p.set(hx, hy, TAB_BACK_Z + 1.0);
        seated.q.copy(lying);
        let scale = 1;
        // The first one alone, with the camera close on it (views.ts): what
        // is done. Then five more to the corners and middles — the six that
        // hold the panel — and the other six quickly.
        const s0 = k === 0 ? C2 + 0.12 : k < 6 ? C2 + 0.38 + (k - 1) * 0.06 : C2 + 0.63 + (k - 6) * 0.023;
        const bench = tmp.b;
        bench.p.set(SCREW_BENCH_X0 + k * SCREW_BENCH_DX, MAT_TOP + 0.36, SCREW_BENCH_Z);
        bench.q.copy(lying);
        let p: Pose = seated;
        if (finished) p = seated;
        else if (t < s0) {
          // A handful let fall along the row: one after another, each rocking still.
          const dr = drop(t, ARRIVE2.screws + k * 0.014, 0.08);
          scale = dr.on ? dr.scale : 0;
          bench.p.y += dr.fall * 2.5;
          bench.q.premultiply(tilt(70 + k, 0.3 * dr.lean));
          p = bench;
        } else if (t < s0 + 0.16) {
          // Over the top of the case and down behind it to its tab: high and
          // far enough back that it is past the case before it comes down
          // (a lower arc took the screws for the low tabs through the panel).
          const u = span(t, s0, s0 + 0.16, glide);
          // (Its tip, 3.2 behind where it ends up: where the drive below takes it from.)
          const hover = tmp.v.set(hx, hy, TAB_BACK_Z + 1.0 - 3.2);
          bezier(bench.p, tmp.v2.set(bench.p.x, OVER_TOP[0], bench.p.z / 2), tmp.v3.set(hx, OVER_TOP[1], OVER_TOP[2]), hover, u, tmp.c.p);
          tmp.c.q.copy(lying);
          p = tmp.c;
        } else {
          // In through its slot until the thread meets the panel's insert,
          // then driven: it goes in as far as it turns, a turn for every
          // sixth of a unit, slower as the head comes down on the tab —
          // clockwise, seen from behind.
          const x = span(t, s0 + 0.16, s0 + 0.25, clamp01);
          const near = reach(x / 0.36);
          const driven = 1 - Math.pow(1 - clamp01((x - 0.3) / 0.7), 2.4);
          tmp.c.p.set(hx, hy, TAB_BACK_Z + 1.0 - 3.2 + 2.45 * near + 0.75 * driven);
          tmp.c.q.copy(lying).multiply(tmp.q.setFromAxisAngle(Y, -driven * Math.PI * 9));
          p = tmp.c;
          if (x < 1) {
            buildFocus.on = true;
            buildFocus.size = 0.12;
            buildFocus.world.copy(tmp.c.p).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
          }
        }
        if (!finished && t >= G1 && t < ARRIVE2.screws) scale = 0;
        if (!shut) scale = 0;
        m.compose(p.p, p.q, tmp.s.setScalar(scale));
        kit.screws.setMatrixAt(k, m);
        kit.screwSlots.setMatrixAt(k, m);
      });
      kit.screws.instanceMatrix.needsUpdate = true;
      kit.screwSlots.instanceMatrix.needsUpdate = true;
    }

    // ── washers and nuts on the encoder bushings ────────────────────────────
    //
    // One encoder at a time, top to bottom: its washer is brought up from the
    // mat, slipped over the shaft and rings down flat against the case; the
    // nut comes after it, is started on the thread and run down — it turns as
    // far as it travels — until it is snug.
    {
      const m = tmp.m;
      const upZ = qx(Math.PI / 2);
      for (let k = 0; k < 4; k++) {
        const ax = boardToModel(tmp.v.copy(SW_CENTRES[k]), BOARD_IN_CASE, tmp.v5);
        const sx = ROW[`SW${k + 1}`];
        const s0 = C5 + 0.22 + k * 0.17;
        for (const which of [0, 1] as const) {
          const seatZ = which === 0 ? FRONT_Z : FRONT_Z + 0.05;
          const restP = tmp.b.p.set(sx + (which ? 0.15 : 0), MAT_TOP, which ? NUT_ROW_Z - 1.3 : NUT_ROW_Z);
          tmp.b.q.identity();
          const lift0 = s0 + which * 0.045;
          let scale = 1;
          if (finished) {
            tmp.a.p.set(ax.x, ax.y, seatZ);
            tmp.a.q.copy(upZ);
            if (!shut) scale = 0;
          } else if (t < lift0) {
            const dr = drop(t, ARRIVE[`SW${k + 1}` as PartName] + 0.03 + which * 0.02, 0.09);
            scale = dr.on ? dr.scale : 0;
            tmp.a.p.copy(restP).setY(restP.y + dr.fall * 2.5);
            tmp.a.q.copy(tilt(50 + k * 2 + which, 0.3 * dr.lean));
          } else if (t < lift0 + 0.1) {
            // Up from the mat to in front of its shaft, turned to face it.
            tmp.c.p.set(ax.x, ax.y, seatZ + 3);
            tmp.c.q.copy(upZ);
            arc(tmp.b, tmp.c, span(t, lift0, lift0 + 0.1, glide), 2.4, tmp.a);
          } else if (which === 0) {
            // The washer: over the shaft and down it, and it rings flat against the case.
            const u = span(t, lift0 + 0.1, lift0 + 0.15, reach);
            const ring = sway((t - (lift0 + 0.145)) / 0.05, 1.5, 2.2);
            const lean = 0.16 * Math.abs(ring);
            tmp.a.p.set(ax.x, ax.y, seatZ + 3 * (1 - u) + 0.53 * Math.sin(lean));
            tmp.a.q.copy(upZ).multiply(tmp.q.setFromAxisAngle(tmp.v.set(Math.cos(k * 1.7 + ring * 3), 0, Math.sin(k * 1.7 + ring * 3)), lean));
          } else {
            // The nut: up to the end of the thread, then on — a turn for every
            // 0.2 of the way, slower as it tightens.
            const near = span(t, lift0 + 0.1, lift0 + 0.135, reach);
            const on = span(t, lift0 + 0.135, lift0 + 0.21, (x) => 1 - Math.pow(1 - clamp01(x), 2.2));
            tmp.a.p.set(ax.x, ax.y, seatZ + 0.7 + 2.3 * (1 - near) - 0.7 * on);
            tmp.a.q.copy(upZ).multiply(tmp.q.setFromAxisAngle(Y, -on * Math.PI * 7));
          }
          m.compose(tmp.a.p, tmp.a.q, tmp.s.setScalar(scale));
          (which ? kit.nuts : kit.washers).setMatrixAt(k, m);
          // The one in hand is what the step is about.
          if (!finished && t >= lift0 && t < lift0 + 0.21) {
            buildFocus.on = true;
            buildFocus.size = 0.12;
            buildFocus.world.copy(tmp.a.p).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
          }
        }
      }
      kit.washers.instanceMatrix.needsUpdate = true;
      kit.nuts.instanceMatrix.needsUpdate = true;
    }

    // ── the power bank, the plug, the J4 lead ───────────────────────────────
    // The plug starts into the bank's port at PLUG_GO and is home — power on — at PLUG_HOME.
    const plugIn = finished || t >= PLUG_HOME;
    {
      // The panel lights only once the bank is plugged in (firmware-3): a
      // lit step reached while the timeline is still short of that — it runs
      // there from wherever it was — is held dark, and comes on when the
      // plug goes in. Only a panel held dark here is turned on here: check-3
      // turns it off itself, for its power cycle. (This used to ask whether
      // the timeline was still before check-1 instead, and a slow frame that
      // carried it past that in one step left the panel off.)
      const sim = getSim();
      if (s.power && !plugIn) {
        if (sim.snapshot().mode !== "off") sim.setMode("off");
        c.heldOff = true;
      } else if (c.heldOff) {
        c.heldOff = false;
        if (s.power && sim.snapshot().mode === "off") sim.setMode(s.mode && s.mode !== "off" ? s.mode : "run");
      }

      // The bank: dropped on the mat, where it stays until the DevKit is
      // seated — it has no business near the case while that goes in with
      // the power off — then stood up in front of the tray and slid in
      // (firmware-3).
      const b = kit.bank;
      let on = true;
      let scale = 1;
      if (finished || t >= F3 + 0.63) {
        b.position.copy(BANK_IN.p);
        b.quaternion.identity();
      } else if (t < F3) {
        const dr = drop(t, ARRIVE2.bank, 0.18, true);
        on = dr.on;
        scale = dr.scale;
        b.position.copy(BANK_BENCH.p).setY(BANK_BENCH.p.y + dr.fall * 3);
        b.quaternion.copy(tilt(33, 0.1 * dr.lean)).multiply(BANK_BENCH.q);
      } else if (t < F3 + 0.44) {
        carry(BANK_BENCH, BANK_FRONT, span(t, F3 + 0.14, F3 + 0.43, clamp01), 5, tmp.a);
        b.position.copy(tmp.a.p);
        b.quaternion.copy(tmp.a.q);
      } else {
        // Slid into its tray: it has weight — drawn back a little, then pushed, and up against the tray's back without a knock.
        b.position.lerpVectors(BANK_FRONT.p, BANK_IN.p, span(t, F3 + 0.44, F3 + 0.63, (x) => windUp(x, 0.035)));
        b.quaternion.identity();
      }
      if (t >= F3 + 0.14 && t < F3 + 0.64) {
        buildFocus.on = true;
        buildFocus.size = 1.2;
        buildFocus.world.copy(b.position).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
      }
      b.visible = on && shut;
      b.scale.setScalar(scale);
      kit.bankLed.visible = plugIn && sim.snapshot().mode !== "off";

      // The plug: loose in the tray once the lead is through; held up out of
      // the bank's way as it slides in, then into it. At the power cycle
      // (check-3) it follows the panel: out while it is off.
      const plugPos = tmp.v4;
      const above = (p: THREE.Vector3, h: number) => plugPos.copy(p).setY(p.y + h);
      if (finished || t >= PLUG_GO) {
        // Down into the port: its mouth found, then pushed in until it stops.
        const track = plugTrack.current;
        const out = !finished && t >= K1 && sim.snapshot().mode === "off" ? 1 : 0;
        track.out += (out - track.out) * Math.min(1, dt * 8);
        above(PORT_IN, finished ? 0 : Math.max(1.1 * track.out, 1.4 * (1 - span(t, PLUG_GO, PLUG_HOME, (x) => press(x, 0.55)))));
        if (!finished && t < PLUG_HOME + 0.04) {
          buildFocus.on = true;
          buildFocus.size = 0.2;
          buildFocus.world.copy(plugPos).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
        }
      } else if (t < F3) plugPos.copy(PLUG_LOOSE);
      else plugPos.lerpVectors(PLUG_LOOSE, tmp.v2.copy(PORT_IN).setY(PORT_IN.y + 1.4), span(t, F3 + 0.2, F3 + 0.42, glide));
      // The cable as it came: a coil on the mat, its USB-A plug lying at
      // the coil's end, mouth toward the reader — a bare coil did not read
      // as a USB cable. At case-3 it is the lead, its plug in the tray.
      const coilDrop = drop(t, ARRIVE2.usb, 0.09);
      const cableOn = finished || t >= C3 + 0.05;
      if (cableOn) {
        kit.plug.position.copy(plugPos);
        kit.plug.quaternion.identity();
        kit.plug.scale.setScalar(1);
        kit.plug.visible = shut;
      } else {
        kit.plug.position.copy(USB_PLUG_BENCH).setY(USB_PLUG_BENCH.y + coilDrop.fall * 2);
        kit.plug.quaternion.copy(PLUG_FLAT);
        kit.plug.scale.setScalar(coilDrop.scale * (1 - span(t, C3, C3 + 0.05)) + 0.001);
        kit.plug.visible = coilDrop.on;
      }

      // The lead, in the order it is really done (BUILD_GUIDE §7.3): the cut
      // end goes through the case's cable hole FIRST — out of the plug in the
      // tray, up the tray to the SMALL slot in its roof (layout.ts
      // CABLE_HOLE: the one straight under J4, not the wide opening beside
      // it), into the bay and out of its open back, its two stripped wires
      // fanned — and waits there; then the board is brought to it and the
      // wires go into J4 (case-3); then the board goes in and the lead's
      // slack goes back down the hole after it (case-4).
      const pts = kit.usbPath.points;
      pts[0].copy(plugPos).setY(plugPos.y + 1.55);
      pts[1].copy(plugPos).setY(plugPos.y + 2.5);
      pts[3].copy(CABLE_HOLE).setY(CABLE_HOLE.y - 0.7);
      pts[2].lerpVectors(pts[1], pts[3], 0.55).setZ(-0.5);
      pts[4].copy(CABLE_HOLE);
      const entryMid = tmp.v2.copy(J4_ENTRY[0]).add(J4_ENTRY[1]).multiplyScalar(0.5);
      const onBoard = boardToModel(tmp.v3.copy(entryMid).setZ(entryMid.z + 0.0022), boardPose, tmp.jacket);
      // 0 while the end is free, 1 once it is in J4.
      const held = finished ? 1 : span(t, C3 + 0.72, C3 + 0.86, glide);
      // A lead pushed up through a hole comes out swinging, and is still by
      // the time the board is brought to it; and once it is in J4 the slack
      // behind the board swings once and hangs.
      const whip = finished ? 0 : 0.42 * sway((t - (C3 + 0.26)) / 0.16, 1.6, 1.5) * (1 - held);
      const hang = finished ? 0 : 0.3 * sway((t - (C3 + 0.85)) / 0.12, 1.2, 2);
      // Out and round J4's side on its way under it, not through its body.
      const jacketEnd = onBoard.lerpVectors(LEAD_FREE, onBoard, held).addScaledVector(LEAD_ROUND, Math.sin(Math.PI * held));
      jacketEnd.x += whip;
      jacketEnd.z += whip * 0.4;
      // The slack goes back down the hole as the board goes in: with it, not ahead of it.
      const inCase = finished || t >= C4 + 0.7 ? 1 : t >= C4 ? span(t, C4 + 0.14, C4 + 0.7, (x) => press(x, 0.8)) : 0;
      pts[5].lerpVectors(BAY_OUT, BAY_IN, inCase);
      pts[6].lerpVectors(tmp.v.lerpVectors(LEAD_FREE_MID, SAG, held), tmp.v2.lerpVectors(pts[5], jacketEnd, 0.45), inCase);
      pts[6].x += whip * 0.45 + hang;
      pts[6].z += hang * 0.6;
      pts[7].lerpVectors(pts[6], jacketEnd, 0.7);
      pts[8].copy(jacketEnd);
      // (Its plug end also follows the power cycle at check-3, eased on the frame clock.)
      const usbStill = tStill && plugPos.distanceToSquared(tmp.plugShown) < 1e-10;
      tmp.plugShown.copy(plugPos);
      if (!usbStill) kit.usbPath.touch();
      // Up the tray first (behind the case, out of this step's view), then
      // out of the hole at a pace that can be watched: the hole's share of
      // the lead's length, by its chords.
      let toHole = 0;
      let whole = 0;
      for (let i = 1; i < pts.length; i++) {
        whole += pts[i].distanceTo(pts[i - 1]);
        if (i === 4) toHole = whole;
      }
      const holeAt = toHole / Math.max(1e-6, whole);
      const grow = finished ? 1 : holeAt * span(t, C3 + 0.06, C3 + 0.2, clamp01) + (1 - holeAt) * span(t, C3 + 0.2, C3 + 0.38, smooth);
      if (cableOn && grow > 0 && !usbStill) kit.usb.update(kit.usbPath, grow);
      kit.usb.mesh.visible = cableOn && grow > 0 && shut;
      // Red to +5V, black to GND: fanned out of the jacket while they wait, then into J4's entries.
      const wireGrow = finished ? 1 : span(t, C3 + 0.37, C3 + 0.42, clamp01);
      // The two wires spring apart as they come out of the jacket.
      const spread = finished ? 1 : span(t, C3 + 0.38, C3 + 0.5, (x) => past(x, 0.18));
      [1, 0].forEach((pad, w) => {
        const path = kit.j4Paths[w];
        const fan = (w === 0 ? -0.22 : 0.22) * spread;
        path.points[0].copy(jacketEnd);
        boardToModel(tmp.v.copy(J4_ENTRY[pad]).setZ(J4_ENTRY[pad].z + 0.0012), boardPose, path.points[1]);
        boardToModel(tmp.v.copy(J4_ENTRY[pad]).setZ(J4_ENTRY[pad].z - 0.0025), boardPose, path.points[2]);
        path.points[1].lerpVectors(tmp.v.copy(LEAD_FREE).add(tmp.v2.set(fan * 0.5, 0.12, -0.45)), path.points[1], held);
        path.points[2].lerpVectors(tmp.v.copy(LEAD_FREE).add(tmp.v2.set(fan, 0.3, -0.85)), path.points[2], held);
        if (!tStill) {
          path.touch();
          if (cableOn && wireGrow > 0) kit.j4Wires[w].update(path, wireGrow);
        }
        kit.j4Wires[w].mesh.visible = cableOn && wireGrow > 0 && shut;
      });
      // The coil it came as, on the mat.
      kit.coils.usb.visible = !finished && coilDrop.on && t < C3 + 0.08;
      kit.coils.usb.scale.setScalar(coilDrop.scale * (1 - span(t, C3, C3 + 0.08)) + 0.001);
      kit.coils.usb.position.y = USB_COIL.y + coilDrop.fall * 2;
    }

    // ── the ribbon (J1 → the panel's IN) and the panel's power lead (→ J3) ──
    {
      // The ribbon is one folded piece (props.ts foldedRibbon), built where it
      // is fitted. It lies on the mat with the rest; at wire-1 it is carried
      // over the top of the case to behind the board and the panel, and its
      // two plugs are pressed home — onto J1, and into the panel's IN.
      const rb = kit.ribbon;
      const rq = tmp.q2;
      const rc = tmp.v;
      let rs = 1;
      let rOn = true;
      // How far out of its seat each end and the fold are held, and how far it hangs (props.ts foldedRibbon).
      let endJ1 = 0;
      let fold = 0;
      let endIn = 0;
      const sag = tmp.v5.set(0, 0, 0);
      if (finished || t >= W1 + 0.88) {
        rq.identity();
        rc.copy(RIBBON_CENTRE);
      } else if (t < W1 + 0.1) {
        const dr = drop(t, ARRIVE2.ribbon, 0.1);
        rOn = t >= G1 && dr.on;
        rs = dr.scale;
        rq.copy(tilt(32, 0.14 * dr.lean)).multiply(RIBBON_BENCH.q);
        rc.copy(RIBBON_BENCH.p).setY(RIBBON_BENCH.p.y + dr.fall * 2.5);
      } else {
        // Picked up by its fold — its two runs hang from it, the long one
        // most — and carried over the top of the case: quick where the
        // camera is not looking, slow down behind it, where it is. There it
        // is held just off its seat, and goes on one end at a time: J1's
        // plug pressed home, the run laid flat after it, then IN's plug.
        const x = span(t, W1 + 0.1, W1 + 0.54, clamp01);
        const u = 1 - Math.pow(1 - smooth(x), 1.7);
        bezier(RIBBON_BENCH.p, tmp.v2.set(RIBBON_BENCH.p.x, 44, 28), tmp.v3.set(RIBBON_CENTRE.x, 50, -8), RIBBON_CENTRE, u, rc);
        const turned = glide((u - 0.1) / 0.7);
        rq.slerpQuaternions(RIBBON_BENCH.q, IDENTITY, turned);
        // Off its seat by the hover, once it is turned to face it (lying on the mat that way is down, into it).
        const off = RIBBON_HOVER * turned;
        endJ1 = off * (1 - span(t, W1 + 0.58, W1 + 0.69, (y) => press(y, 0.72)));
        fold = off * (1 - span(t, W1 + 0.63, W1 + 0.8, glide));
        endIn = off * (1 - span(t, W1 + 0.74, W1 + 0.87, (y) => press(y, 0.72)));
        // It hangs while it is in the air, swings a little as it is brought to a stop, and is taken up as its ends are held.
        const hang = 0.85 * span(t, W1 + 0.1, W1 + 0.18, glide) * (1 - span(t, W1 + 0.5, W1 + 0.62, glide)) + 0.3 * sway((t - (W1 + 0.5)) / 0.1, 1.2, 2) * (1 - span(t, W1 + 0.58, W1 + 0.66, clamp01));
        // Down, in the ribbon's own frame.
        sag.set(0, -hang, 0).applyQuaternion(tmp.q.copy(rq).invert());
        if (t >= W1 + 0.56) {
          buildFocus.on = true;
          buildFocus.size = 0.3;
          buildFocus.world.copy(t < W1 + 0.71 ? J1_MOUTH : PANEL_IN).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
        }
      }
      kit.ribbonFlex.bend(endJ1, fold, endIn, sag);
      kit.ribbonPlugs.forEach((rp, i) => rp.mesh.position.copy(rp.home).add(kit.ribbonFlex.ends[i]));
      rb.visible = rOn && shut;
      rb.quaternion.copy(rq);
      rb.scale.setScalar(rs);
      // Turned and scaled about its own middle.
      rb.position.copy(RIBBON_CENTRE).applyQuaternion(rq).multiplyScalar(-rs).add(rc);

      // The power lead: its plug onto the panel's header (below the band, as
      // photo 08c has it), then the pair laid up the panel's back, through
      // the notch's low end and down the bay's side into J3 from above.
      const seat = tmp.v2.set(PANEL_POWER.x, PANEL_POWER.y, PANEL_PCB_Z - 0.3);
      const pp = kit.powerPlug;
      const pc = drop(t, ARRIVE2.power, 0.09);
      // On the mat it lies in its coil, mating face up.
      const plugBench = tmp.v5.set(POWER_COIL.x, POWER_COIL.y + 0.9, POWER_COIL.z);
      pp.scale.setScalar(1);
      if (finished || t >= W2 + 0.26) {
        pp.position.copy(seat);
        pp.quaternion.identity();
        pp.visible = shut;
      } else if (t < W2 + 0.02) {
        pp.visible = t >= G1 && pc.on;
        pp.position.copy(plugBench).setY(MAT_TOP + 0.9 * pc.scale + pc.fall * 2.5);
        pp.quaternion.copy(qx(-Math.PI / 2));
        pp.scale.setScalar(pc.scale);
      } else if (t < W2 + 0.18) {
        const u = span(t, W2 + 0.02, W2 + 0.18, glide);
        bezier(plugBench, tmp.v3.set(POWER_COIL.x, OVER_TOP[0], POWER_COIL.z / 2), tmp.v4.set(seat.x, OVER_TOP[1], OVER_TOP[2]), tmp.v.copy(seat).setZ(seat.z - 2.4), u, pp.position);
        pp.quaternion.slerpQuaternions(qx(-Math.PI / 2), IDENTITY, glide((u - 0.1) / 0.7));
        pp.visible = true;
      } else {
        // Onto its header: found, then pushed until its latch is over.
        pp.position.copy(seat).setZ(seat.z - 2.4 * (1 - span(t, W2 + 0.18, W2 + 0.26, (y) => press(y, 0.7))));
        pp.quaternion.identity();
        pp.visible = true;
      }
      // The lead is one piece and is carried as one: the pair trails from
      // the plug's back as it comes off the mat (the coil paying out into
      // it), hangs from it while the plug is seated, and then its free ends
      // are brought up behind the case, let down into the notch's low end,
      // and pushed into J3 from above. `lay` is that last part, 0…1.
      const tail = finished ? 1 : span(t, W2 + 0.02, W2 + 0.1, clamp01);
      const lay = finished ? 1 : span(t, W2 + 0.27, W2 + 0.6, clamp01);
      const pwrOn = finished || t >= W2 + 0.02;
      const over = smooth(lay / 0.68); // across to above where they will lie
      const lower = smooth((lay - 0.68) / 0.18); // down into the notch
      const insert = smooth((lay - 0.86) / 0.14); // the ends down into J3
      const lifted = smooth(lay / 0.12);
      const backDir = tmp.v3.set(0, 0, -1).applyQuaternion(pp.quaternion);
      [1, 0].forEach((pad, w) => {
        const pts = kit.powerPaths[w].points;
        const off = w === 0 ? -0.2 : 0.2;
        const o = off * 0.45;
        // Where it lies in the end.
        pts[0].set(seat.x + off, seat.y, seat.z - 0.85);
        pts[1].set(seat.x + off + 0.2, seat.y + 0.5, -0.95);
        pts[2].set(0.4 + o, 21.4 - o, -1.1);
        pts[3].set(NOTCH.x - 0.5, 22.5 - o, -1.2);
        pts[4].set(4.95 + o, 22.0 - o, -1.0);
        boardToModel(tmp.v.copy(J3_ENTRY[pad]).setZ(J3_ENTRY[pad].z - 0.004), BOARD_IN_CASE, pts[5]);
        boardToModel(tmp.v.copy(J3_ENTRY[pad]).setZ(J3_ENTRY[pad].z + 0.002), BOARD_IN_CASE, pts[6]);
        if (lay < 1) {
          // Where it hangs from the plug, wherever the plug is: out of its
          // back, then down.
          const exit = tmp.v.set(off, 0, -0.85).applyQuaternion(pp.quaternion).add(pp.position);
          for (let k = 0; k < pts.length; k++) {
            const hang = tmp.v4.copy(exit);
            if (k > 0) hang.addScaledVector(backDir, 0.5).add(tmp.world.set(off * 0.35 * (k - 1), -0.12 - 1.45 * (k - 1), 0));
            const laid = pts[k];
            const y = laid.y + POWER_RISE[k] * (1 - insert);
            const z = laid.z;
            laid.set(hang.x + (laid.x - hang.x) * over, hang.y + (y - hang.y) * over, hang.z + (z - hang.z) * over);
            // Carried behind the case's back, clear of the bay's wall and of everything on the board.
            const carried = laid.z + (POWER_CARRY_Z - laid.z) * Math.min(1, k / 2) * lifted;
            laid.z = carried + (z - carried) * lower;
          }
        }
        if (!tStill) {
          kit.powerPaths[w].touch();
          if (pwrOn) kit.powerWires[w].update(kit.powerPaths[w], tail);
        }
        kit.powerWires[w].mesh.visible = pwrOn && tail > 0 && shut;
      });
      kit.coils.power.visible = !finished && pc.on && t < W2 + 0.1;
      kit.coils.power.scale.setScalar(pc.scale * (1 - span(t, W2 + 0.02, W2 + 0.1)) + 0.001);
    }

    // The two "+" joined (wire-2): J3's on the left, J4's on the right, seen from behind.
    const plusOn = !finished && t >= W2 + 0.62 && t < F1;
    const j3Plus = boardToModel(tmp.v.copy(J3_ENTRY[1]), boardPose, V());
    const j4Plus = boardToModel(tmp.v.copy(J4_ENTRY[1]), boardPose, V());
    {
      const pos = kit.dash.geometry.getAttribute("position") as THREE.BufferAttribute;
      pos.setXYZ(0, j3Plus.x, j3Plus.y, j3Plus.z - 0.9);
      pos.setXYZ(1, j4Plus.x, j4Plus.y, j4Plus.z - 0.9);
      pos.needsUpdate = true;
      // The dashes' distances along it, written in place. (computeLineDistances
      // makes a new attribute every call, and three a new buffer for each one
      // it draws — one a frame for as long as the line was on screen, and one
      // more on every visit, none of them ever let go.)
      const along = kit.dash.geometry.getAttribute("lineDistance") as THREE.BufferAttribute;
      along.setX(1, Math.hypot(j4Plus.x - j3Plus.x, j4Plus.y - j3Plus.y, j4Plus.z - j3Plus.z));
      along.needsUpdate = true;
      const lm = kit.dash.material as THREE.LineDashedMaterial;
      lm.opacity += ((plusOn ? 1 : 0) - lm.opacity) * Math.min(1, dt * 6);
      kit.dash.visible = lm.opacity > 0.01;
    }

    // ── the mat ─────────────────────────────────────────────────────────────
    kit.matMat.opacity = finished ? 0 : span(t, G1 + 0.04, G1 + 0.14) * (1 - span(t, F1 + 0.55, F1 + 0.95));

    // ── tags ────────────────────────────────────────────────────────────────
    {
      const tags = tmp.tags;
      tags.clear();
      const local = (p: THREE.Vector3) => boardToModel(p, boardPose, V());
      const partTop = (name: PartName) => {
        const pr = d.parts[name];
        return local(V((pr.min.x + pr.max.x) / 2, pr.max.y, (pr.min.z + pr.max.z) / 2));
      };
      // What came off the board (gather-2), named until the bench is left for the board.
      if (t >= ARRIVE2.named && t < at("gather-4")) {
        // Above the panel's far edge, so the pill covers nothing on its back.
        tags.set("gPanel", V(PANEL_BENCH.p.x, PANEL_BENCH.p.y + 0.9, PANEL_BENCH.p.z - 8));
        // On a narrow screen the screws lie at the stage's bottom edge, under the card: no tag there.
        if (!narrow) tags.set("gScrews", V(SCREW_BENCH_X0 + 5.5 * SCREW_BENCH_DX, MAT_TOP + 0.4, SCREW_BENCH_Z));
        tags.set("gUsb", V(USB_COIL.x, USB_COIL.y + 0.4, USB_COIL.z));
        tags.set("gBank", V(BANK_BENCH.p.x, BANK_BENCH.p.y + 0.8, BANK_BENCH.p.z));
      }
      if (t >= S1 + 0.24 && t < S2) tags.set("u1", local(U1_MID));
      if (t >= S2 + 0.04 && t < S3) {
        tags.set("j1", partTop("J1"));
        tags.set("j3", partTop("J3"));
        tags.set("j4", partTop("J4"));
      }
      if (t >= S2 + 0.36 && t < S3) {
        tags.set("plus5a", local(PLUS5_J4));
        tags.set("plus5b", local(PLUS5_J3));
      }
      if (t >= S3 + 0.3 && t < S4) {
        tags.set("c11", partTop("C11"));
        tags.set("c11p", local(V(PADS.C11[0][0], 0.0017, PADS.C11[0][1] + 0.006)));
        tags.set("c11m", local(V(PADS.C11[1][0], 0.0017, PADS.C11[1][1] + 0.006)));
      }
      if (t >= S4 + 0.06 && t < S4 + 0.19) tags.set("wrong", local(V(SW_CENTRES[0].x, 0.03, SW_CENTRES[0].z)));
      // Which side is which, while the joints are made and where the step holds.
      if (t >= S4 + 0.63 && t < S4 + 0.89) tags.set("swPins", local(V(0, 0.004, SW_CENTRES[0].z - 0.004)));
      if (t >= S4 + 0.985 && t < C1) tags.set("swBodies", local(V(0, -0.027, (SW_CENTRES[0].z + SW_CENTRES[2].z) / 2)));
      // The panel's IN header, wherever the panel is: while it is stood up and seated (case-1), and for the ribbon (wire-1).
      if ((t >= C1 + 0.26 && t < C2) || (t >= W1 && t < W2)) tags.set("in", V().copy(PANEL_IN).sub(PANEL_CENTRE).applyQuaternion(kit.panel.group.quaternion).add(kit.panel.group.position));
      // The small slot the lead comes up through, until the board is brought over.
      if (t >= C3 + 0.02 && t < BOARD_OVER[0] + 0.04) tags.set("hole", V(CABLE_HOLE.x + 0.2, CABLE_HOLE.y + 0.1, CABLE_HOLE.z - 0.38));
      if ((t >= C3 + 0.86 && t < C5) || plusOn) {
        tags.set("j4p", local(J4_ENTRY[1]));
        tags.set("j4m", local(J4_ENTRY[0]));
      }
      if (plusOn) {
        tags.set("j3p", local(J3_ENTRY[1]));
        tags.set("j3m", local(J3_ENTRY[0]));
      }
      // The board's "USB" mark, where the DevKit's ports go (firmware-2) —
      // only once the camera is behind the case and looking at the board:
      // through the case from the front the tag sat on the power lead, the
      // one thing on this board that must never be called USB.
      if (t >= F2 && t < F3) {
        const mark = local(USB_MARK);
        const wm = tmp.world.copy(mark).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
        const toCam = tmp.v.copy(state.camera.position).sub(wm).normalize();
        const facing = toCam.dot(tmp.v2.set(0, 1, 0).applyQuaternion(boardPose.q));
        if (facing > 0.45) tags.set("usb", mark);
      }
      // The guide has been left: the build is being run to an end, and nothing in it is named on the way.
      if (!onPage) tags.clear();
      const els = tagEls.current;
      for (const def of TAGS) {
        const el = els[def.key];
        if (!el) continue;
        const p = tags.get(def.key);
        if (!p) {
          el.pill.dataset.on = "0";
          continue;
        }
        const wp = tmp.world.copy(p).multiplyScalar(MODEL_SCALE).add(MODEL_OFFSET);
        tmp.v.copy(wp).project(state.camera);
        if (tmp.v.z > 1) {
          el.pill.dataset.on = "0";
          continue;
        }
        const x = (tmp.v.x * 0.5 + 0.5) * size.width;
        const y = (-tmp.v.y * 0.5 + 0.5) * size.height;
        el.wrap.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el.pill.dataset.on = "1";
        placeTag(el.pill, state.camera, size, wp, def.r, def.side, 7);
      }
    }

    // Off the stage, once the guide has been left and the device stands whole
    // (the cleanup above gives Device its objects back as they are now).
    if (handBack) useGuideStore.getState().setBuildLive(false);
  });

  return (
    <group scale={MODEL_SCALE} position={MODEL_OFFSET}>
      <primitive object={kit.group} />
    </group>
  );
}

// The power bank: in its tray (the tray's inside, layout.ts TRAY, with the
// bank's 1.5-unit thickness against the tray's back), and stood in front of
// it. Its USB-A port is in its top end, 7.2 above its centre.
const PLUG_GO = F3 + 0.65;
const PLUG_HOME = F3 + 0.76;
const BANK_IN: Pose = { p: V(8.0, 7.62, -0.78), q: new THREE.Quaternion() };
const BANK_FRONT: Pose = { p: V(8.0, 7.4, 6.6), q: new THREE.Quaternion() };
const PORT_IN = V(8.0, 14.82, -0.78);
/** The lead's plug lying loose at the bottom of the tray. */
const PLUG_LOOSE = V(7.4, 2.2, 0.3);
/**
 * Where the lead comes out of the hole into the bay: out of the open back
 * while the board hovers behind, along the board once it is in. On its way
 * out it leans to the knob side, away from the wide opening: seen from
 * behind and that side (views.ts leadBack) a lead running straight back
 * crossed the opening's end, and could be taken to come out of it.
 */
const BAY_OUT = V(11.05, 19.9, -2.5);
const BAY_IN = V(10.27, 19.14, -0.06);
/** The slack hanging behind the case while the board hovers: low and behind the board's face, so the lead comes up to J4's entries from under its bottom edge. */
const SAG = V(10.45, 18.2, -7.2);
/**
 * The lead's cut end while it waits for the board, out of the bay's open
 * back, and the bend on the way to it: above J4 and C11 and behind them, off
 * the hovering board's printed face (z −6.5).
 */
const LEAD_FREE = V(11.3, 21.6, -7.5);
const LEAD_FREE_MID = V(11.25, 20.6, -4.8);
/** How far out of the straight line the end swings on its way into J4. */
const LEAD_ROUND = V(0.7, -0.3, -0.45);
/** The uncut cable's USB-A plug on the mat: lying flat at the end of its coil's outer turn, mouth toward the reader. */
const USB_PLUG_BENCH = V(USB_COIL.x + 1.7, MAT_TOP + 0.375, USB_COIL.z + 1.5);
const PLUG_FLAT = qx(-Math.PI / 2);

/** While the power pair's free ends are brought over: this far behind (the case's back is at z −1.9), and this much above where each point will lie (the ends: above J3's entries, to go down into them). */
const POWER_CARRY_Z = -2.7;
const POWER_RISE = [0, 0, 0, 0, 0.3, 1.2, 1.2] as const;

/** For building the cut materials' shaders ahead of their first draw (warmStep): nothing to draw, and a plane that cuts none of it. */
const NOTHING = new THREE.Scene();
const UNCUT = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);

/** The mat the four print plates stand on: its middle (the plates' own, layout.ts) and its size, a few centimetres more than the plates all round. */
const PLATES_GROUND = { x: 0, z: -48, w: 66, d: 64 } as const;
/** How far out from a plate's edge its shade on that mat reaches. */
const PLATE_SHADE = 3.2;

// How far the plug is out of the bank, shown (check-3's power cycle eases it).
const plugTrack = { current: { out: 0 } };

useGLTF.preload([SPLIT_URL, PLATES_URL], DRACO_URL);
