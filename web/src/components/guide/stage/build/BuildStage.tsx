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
// It is mounted beside <Device /> on the build page only, and runs after it
// each frame: it takes Device's own objects (the board and its parts, the
// case, the knobs, the DevKit, the panel) and puts them where the build has
// them, and adds what the build needs besides (beats.ts, layout.ts,
// props.ts). Everything is a function of one timeline value (beats.ts), so
// any step, reached any way, shows the build as it stands.
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
//           boardC11, boardSW, panelIn, screwsBack, caseBack, caseBackClose,
//           leadBack, leadHole, leadJ4, wireBack, terminalsBack, trayFront).
//           narrowView is the view on a narrow screen where that must differ
//           (wire-2, case-3); narrowLate is a second narrow view for the
//           later part of the beat (case-3: the hole, then J4).
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

import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getSim, useGuideStore } from "../../store";
import { buildClock } from "../../timing";
import { stepOf } from "../../scenes";
import { DRACO_URL, KNOB_PRESS, MODEL_OFFSET, MODEL_SCALE, MODEL_URL } from "../geometry";
import { CASE_URL, DEVKIT_PRESENT, DEVKIT_SEAT, PCB_PLACEMENT, PCB_URL } from "../parts";
import { placeTag, type TagSide } from "../tags";
import { at, BEATS, beatIndex, beatSeconds, beatStill, clamp01, settle, smooth, span } from "./beats";
import { Path, Tube } from "./cable";
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
  USB_COIL,
} from "./layout";
import { PADS } from "./pads";
import * as props from "./props";

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
  SW1: [S4 + 0.38, S4 + 0.5],
  SW2: [S4 + 0.42, S4 + 0.54],
  SW3: [S4 + 0.46, S4 + 0.58],
  SW4: [S4 + 0.5, S4 + 0.62],
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
  [S4 + 0.29, S4 + 0.36],
  [S4 + 0.64, S4 + 0.71],
  [S4 + 0.9, S4 + 0.98],
  [C1 + 0.04, C1 + 0.2],
];
/** Rounds of joints: which pads, and when the iron walks them. */
const ROUNDS: { refs: string[]; from: number; to: number }[] = [
  { refs: ["U1"], from: S1 + 0.6, to: S1 + 0.88 },
  { refs: ["J1", "J3", "J4"], from: S2 + 0.52, to: S2 + 0.88 },
  { refs: ["C11"], from: S3 + 0.55, to: S3 + 0.8 },
  { refs: ["SW1", "SW2", "SW3", "SW4"], from: S4 + 0.73, to: S4 + 0.87 },
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

/** The print's layer, model units (0.2 mm). */
const LAYER = 0.02;

/** How far apart (timeline) the parts land on the mat. */
const ARRIVE0 = G1 + 0.3;
const ARRIVE_STEP = 0.036;

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

function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, u: number, out: THREE.Vector3) {
  const v = 1 - u;
  return out
    .copy(p0)
    .multiplyScalar(v * v * v)
    .addScaledVector(p1, 3 * v * v * u)
    .addScaledVector(p2, 3 * v * u * u)
    .addScaledVector(p3, u * u * u);
}

/** Between two poses, lifted on an arc. */
function arcPose(a: Pose, b: Pose, u: number, lift: number, out: Pose) {
  out.p.lerpVectors(a.p, b.p, u);
  out.p.y += lift * 4 * u * (1 - u);
  out.q.slerpQuaternions(a.q, b.q, smooth(u * 1.15 - 0.05));
  return out;
}

const tmpR = { ca: V(), cb: V(), c: V() };
/** Between two rigid placements of a part whose centre (unplaced) is `c`: the centre travels, lifted on an arc; the turn is about it. */
function arcRigid(c: THREE.Vector3, a: Rigid, b: Rigid, u: number, lift: number, out: Rigid) {
  tmpR.ca.copy(c).applyQuaternion(a.q).add(a.T);
  tmpR.cb.copy(c).applyQuaternion(b.q).add(b.T);
  tmpR.c.lerpVectors(tmpR.ca, tmpR.cb, u);
  tmpR.c.y += lift * 4 * u * (1 - u);
  out.q.slerpQuaternions(a.q, b.q, smooth(u * 1.2 - 0.1));
  out.T.copy(c).applyQuaternion(out.q).negate().add(tmpR.c);
  return out;
}

/** A rigid placement that puts a part's centre `c` at `p`, turned by `q`. */
function placeCentre(c: THREE.Vector3, p: THREE.Vector3, q: THREE.Quaternion): Rigid {
  return { q: q.clone(), T: c.clone().applyQuaternion(q).negate().add(p) };
}

function setRigid(o: THREE.Object3D, r: Rigid) {
  o.quaternion.copy(r.q);
  o.position.copy(r.T);
}

/** A part dropping onto the mat: how far through, as (height factor, scale). */
function drop(t: number, t0: number, dur = 0.07) {
  const u = clamp01((t - t0) / dur);
  // Down onto the mat and no lower (the landing ease runs past its end: without the floor, a part sank into the mat).
  return { fall: Math.max(0, 1 - settle(u)), scale: 0.35 + 0.65 * smooth(u * 1.6), on: t >= t0 };
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

export default function BuildStage() {
  const [splitGltf, platesGltf, caseGltf, ledGltf, pcbGltf] = useGLTF([SPLIT_URL, PLATES_URL, CASE_URL, MODEL_URL, PCB_URL], DRACO_URL);
  const { scene: world, gl, camera, size } = useThree();

  // ── everything the build adds ─────────────────────────────────────────────
  const kit = useMemo(() => {
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
    const white = () => std("#eceae4", 0.55, 0, { transparent: true });
    const metal = std("#c3c6cc", 0.32, 0.85);
    // The encoders' washers and nuts: the brushed finish their bodies have
    // (find(), below). Polished, the eight of them lying flat on the mat
    // mirrored the key light straight into the bloom — four white lamps.
    const brushed = std("#8d9096", 0.6, 0.7);
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
    const pinMat = std("#c9a44a", 0.35, 0.85, { transparent: true });
    const canMat = std("#7f8389", 0.45, 0.6, { transparent: true });
    const brassMat = std("#8f7440", 0.55, 0.55, { transparent: true });
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
    const washers = add(new THREE.InstancedMesh(props.washerGeometry(), brushed, 4));
    const nuts = add(new THREE.InstancedMesh(props.nutGeometry(), brushed, 4));
    for (const m of [screws, washers, nuts]) {
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
    {
      const rz = (mouthZ: number) => mouthZ + props.IDC_PLUG.into - (props.IDC_PLUG.d - 0.12);
      const rg = props.foldedRibbon(J1_MOUTH.x, J1_MOUTH.y, rz(J1_MOUTH.z) - 0.045, PANEL_IN.x, PANEL_IN.y, rz(PANEL_IN.z) - 0.045);
      add(new THREE.Mesh(rg.cable, std("#b8b7b2", 0.7, 0, { side: THREE.DoubleSide })), ribbon);
      add(new THREE.Mesh(rg.stripe, std("#b3231d", 0.7, 0, { side: THREE.DoubleSide })), ribbon);
      const p0 = add(new THREE.Mesh(props.idcPlug("y"), idcMat), ribbon);
      p0.position.set(J1_MOUTH.x, J1_MOUTH.y, J1_MOUTH.z + props.IDC_PLUG.into);
      const p1 = add(new THREE.Mesh(props.idcPlug("x"), idcMat), ribbon);
      p1.position.set(PANEL_IN.x, PANEL_IN.y, PANEL_IN.z + props.IDC_PLUG.into);
    }
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

    // Tools: the iron and its glint.
    const ig = props.iron();
    const iron = add(new THREE.Group());
    add(new THREE.Mesh(ig.metal, std("#b5b9c0", 0.28, 0.9)), iron);
    add(new THREE.Mesh(ig.grip, std("#25272b", 0.75)), iron);
    const glint = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: props.glowTexture(), color: new THREE.Color(2.4, 2.1, 1.7), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }),
    );
    group.add(glint);

    // Solder joints: a small fillet at every through-hole pad (pads.ts),
    // children of the board once it is found.
    const jointList: { pos: THREE.Vector3; up: boolean; r: number; at: number; ref: string }[] = [];
    for (const round of ROUNDS) {
      const pads = round.refs.flatMap((ref) => PADS[ref].map((p) => ({ ref, p })));
      pads.forEach(({ ref, p }, i) => {
        const up = ref.startsWith("SW"); // encoders: joints on the F side
        jointList.push({
          ref,
          up,
          pos: V(p[0], up ? 0.0016 : 0, p[1]),
          r: Math.min(0.0011, p[2] / 2 + 0.0001),
          at: round.from + ((round.to - round.from) * i) / Math.max(1, pads.length - 1),
        });
      });
    }
    const jointGeo = new THREE.ConeGeometry(1, 1, 14, 1, true);
    jointGeo.translate(0, 0.5, 0);
    const joints = new THREE.InstancedMesh(jointGeo, std("#d9dce1", 0.22, 0.95), jointList.length);
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
    const clip = [1, 2, 3, 4].map(() => new THREE.Plane(V(0, -1, 0), 1e4));
    const plates = [1, 2, 3, 4].map((p) => {
      const g = add(new THREE.Group());
      g.position.copy(plateCorner(p));
      const slab = add(new THREE.Mesh(props.plate(), plateMat), g, false);
      const partMat = std(p === 4 ? "#161616" : "#eceae4", p === 4 ? 0.82 : 0.55, 0, { clippingPlanes: [clip[p - 1]], clipShadows: true });
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
      return { group: g, slab, parts, cuts, line };
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
    const tapeMat = std("#3b78d0", 0.9, 0, { transparent: true });
    const frameTape = [-8, 0, 8].map((x) => {
      const m = add(new THREE.Mesh(props.tapeStrip(2.4), tapeMat), group, false);
      m.position.set(x, 17.07, FRONT_Z + 0.02);
      return m;
    });
    const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff8a4d").multiplyScalar(2), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    const frameSeam = add(new THREE.Mesh(new THREE.BoxGeometry(24.4, 0.06, 0.03), seamMat), group, false);
    frameSeam.position.set(-0.18, 17.07, FRONT_Z + 0.02);
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
    group.add(dash);

    return {
      group,
      matMat,
      holder,
      panel,
      backGroup,
      screws,
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
      powerPlug,
      powerPaths,
      powerWires,
      coils,
      iron,
      glint,
      jointList,
      joints,
      ghost,
      ghostMat,
      plates,
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
    };
  }, [splitGltf, platesGltf, caseGltf, ledGltf, pcbGltf]);

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
    const fade: THREE.Material[] = [];
    for (const m of [body, backPlate, topLid]) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
      fade.push(mat);
    }
    const knobMats = knobs.map((k) => {
      const mat = k.material as THREE.MeshStandardMaterial;
      mat.transparent = true;
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
      knobHome: knobs.map((k) => (k.userData.buildHome ??= { p: k.position.clone(), q: k.quaternion.clone() }) as { p: THREE.Vector3; q: THREE.Quaternion }),
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
    return () => {
      gl.localClippingEnabled = prev;
    };
  }, [gl]);

  // The timeline is not running once this is gone (timing.ts buildClock).
  useEffect(
    () => () => {
      buildClock.t = -1;
    },
    [],
  );

  // ── tags: DOM pills beside what they name ─────────────────────────────────
  const tagEls = useRef<Partial<Record<TagKey, { wrap: HTMLDivElement; pill: HTMLDivElement }>>>({});
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const layer = document.createElement("div");
    layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:20";
    // The page's language (GuideExperience puts it on the guide's root).
    const lang: TagLang = host.closest("[lang]")?.getAttribute("lang") === "ko" ? "ko" : "en";
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
  }, [gl]);

  // Frames since mount, for the one-off warm-up draw below.
  const warmed = useRef(0);
  const clock = useRef({ beat: -1, start: 0, t: -1, mounted: 0, replay: useGuideStore.getState().replay, heldOff: false });
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
      tags: new Map<TagKey, THREE.Vector3>(),
      jacket: V(),
    }),
    [],
  );

  useFrame((state, rawDt) => {
    if (!dev.current) dev.current = find();
    const d = dev.current;
    if (!d) return;
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
    if (B !== c.beat) {
      // Forward, a step plays its own motion; back, it shows how it ends.
      c.start = c.beat >= 0 && B < c.beat ? now - beatSeconds(B) * 1000 : now;
      c.beat = B;
    }
    // A step plays for its card. A chapter's first step is the current one
    // from the chapter's title on, a screen and more before its card: until
    // the card is on screen (store.ts cardIn) the beat waits at its start —
    // the build as the last chapter left it — and plays when the reader gets
    // there. Scrolling back up to the title winds it back, to play again.
    if (!cardIn) c.start = now;
    // "Replay" on the card: this step's motion again, from its start.
    if (replay !== c.replay) {
      c.replay = replay;
      c.start = now;
      c.t = B;
    }
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const target = B + Math.min(0.999, (now - c.start) / 1000 / beatSeconds(B));
    if (c.t < 0 || now - c.mounted < 700) c.t = target;
    else if (reduced) c.t = B + (cardIn ? beatStill(B) : 0);
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
    // For the camera and the scripted demos (timing.ts).
    buildClock.t = t;

    const finished = t < G1; // the opening: the device as it will end up
    const caseFade = finished ? 1 : 1 - span(t, G1, G1 + 0.16);

    // ── the board ───────────────────────────────────────────────────────────
    const bp = tmp.board;
    let boardScale = 1;
    let boardOn = true;
    if (t < G1) {
      bp.p.copy(BOARD_IN_CASE.p);
      bp.q.copy(BOARD_IN_CASE.q);
    } else if (t < G1 + 0.12) {
      boardOn = false;
    } else if (t < P1) {
      const dr = drop(t, G1 + 0.12, 0.09);
      bp.p.copy(BOARD_FLAT.p).setY(BOARD_FLAT.p.y + dr.fall * 4);
      bp.q.copy(BOARD_FLAT.q);
      boardScale = dr.scale;
    } else if (t < S1) {
      // Up off the mat, over once — the PATTERNFLOW face, the plain face —
      // and held up to be read (print-1); off to the side while the case
      // prints (print-2 on).
      if (t < P1 + 0.3) arcPose(BOARD_FLAT, BOARD_LIFT, span(t, P1, P1 + 0.3), 0.5, bp);
      else if (t < P2) {
        bp.p.copy(BOARD_LIFT.p);
        bp.q.copy(BOARD_LIFT.q).multiply(tmp.q.setFromAxisAngle(V(0, 0, 1), Math.PI * 2 * span(t, P1 + 0.3, P1 + 0.8, smooth)));
      } else arcPose(BOARD_LIFT, BOARD_PARK, span(t, P2, P2 + 0.14), 2, bp);
    } else if (t < C3) {
      if (t < S1 + 0.22) arcPose(BOARD_PARK, BOARD_WORK, span(t, S1, S1 + 0.22), 4, bp);
      else bp.p.copy(BOARD_WORK.p);
      let flip = 0;
      FLIPS.forEach(([a, b], i) => {
        flip += (i % 2 ? -1 : 1) * span(t, a, b);
      });
      if (t >= S1 + 0.22) bp.q.copy(tmp.q.setFromAxisAngle(V(0, 0, 1), Math.PI * flip)).multiply(BOARD_WORK.q);
    } else if (t < C4) {
      // Round the case's right side to behind its bay, turning to face the
      // back — once the lead is through the case's cable hole and waiting
      // there (BUILD_GUIDE §7.3: the cable goes through first).
      const u = span(t, BOARD_OVER[0], BOARD_OVER[1], smooth);
      bezier(BOARD_WORK.p, V(16, 10, 30), V(27, 22, -12), BOARD_HOVER.p, u, bp.p);
      bp.q.slerpQuaternions(BOARD_WORK.q, BOARD_HOVER.q, smooth((u - 0.12) / 0.7));
    } else {
      // Straight in, the encoder shafts through the front face.
      const u = span(t, C4, C4 + 0.55, smooth);
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
      const arrive = ARRIVE0 + k * ARRIVE_STEP;
      let scale = 1;
      let on = true;
      if (t < G1) onBoard(tmp.a);
      else if (t < i0) {
        const dr = drop(t, arrive);
        on = dr.on;
        row(tmp.a);
        tmp.a.p.y += dr.fall * 3;
        scale = dr.scale;
      } else if (t < i1) {
        const u = span(t, i0, i1, clamp01);
        row(tmp.b);
        if (u < 0.68) {
          onBoard(tmp.c, 0.022);
          if (name === "C11") tmp.c.q.premultiply(tmp.q.setFromAxisAngle(V(0, 1, 0).applyQuaternion(boardPose.q), Math.PI * 2 * smooth(u / 0.68)));
          arcPose(tmp.b, tmp.c, smooth(u / 0.68), 3.5, tmp.a);
        } else {
          onBoard(tmp.b, 0.022);
          onBoard(tmp.c);
          const v = smooth((u - 0.68) / 0.32);
          tmp.a.p.lerpVectors(tmp.b.p, tmp.c.p, v);
          tmp.a.q.copy(tmp.c.q);
        }
      } else onBoard(tmp.a);
      node.visible = t < G1 || (on && (t < i1 || boardOn));
      node.position.copy(tmp.a.p);
      node.quaternion.copy(tmp.a.q);
      node.scale.setScalar(PCB_PLACEMENT.scale * scale * (t < i0 ? 1 : boardScale));
    });

    // ── solder joints and the iron ──────────────────────────────────────────
    let ironTip: THREE.Vector3 | null = null;
    let lastPop = -1;
    {
      const m = tmp.m;
      kit.jointList.forEach((j, i) => {
        const pop = finished ? 1 : span(t, j.at, j.at + 0.012, smooth);
        if (!finished && t >= j.at && (lastPop < 0 || j.at > kit.jointList[lastPop].at)) lastPop = i;
        const r = j.r * pop;
        tmp.q.copy(j.up ? IDENTITY : qx(Math.PI));
        m.compose(j.pos, tmp.q, tmp.s.set(r, pop * 0.0011, r));
        kit.joints.setMatrixAt(i, m);
      });
      kit.joints.instanceMatrix.needsUpdate = true;
      kit.joints.visible = boardOn;
      // The iron walks the round of joints being made.
      for (const round of ROUNDS) {
        if (t < round.from - 0.035 || t > round.to + 0.035) continue;
        const list = kit.jointList.filter((j) => round.refs.includes(j.ref));
        const g = clamp01((t - round.from) / (round.to - round.from)) * (list.length - 1);
        const i = Math.min(list.length - 2, Math.floor(g));
        const f = g - i;
        const a = list[Math.max(0, i)];
        const b = list[Math.min(list.length - 1, i + 1)];
        tmp.v.lerpVectors(a.pos, b.pos, smooth(f));
        tmp.v.y = a.up ? 0.0028 : -0.0012;
        ironTip = d.pcb.localToWorld(tmp.v2.copy(tmp.v));
        kit.group.worldToLocal(ironTip);
        // Away between joints, in and out at either end.
        const away = Math.sin(Math.PI * f) * 0.12 + (1 - span(t, round.from - 0.035, round.from)) * 4 + span(t, round.to, round.to + 0.035) * 4;
        ironTip.addScaledVector(tmp.v3.set(0.5, 1, 0.62).normalize(), away);
      }
    }
    kit.iron.visible = !!ironTip;
    if (ironTip) {
      kit.iron.position.copy(ironTip);
      kit.iron.quaternion.setFromUnitVectors(Y, tmp.v3.set(0.5, 1, 0.62).normalize());
    }
    {
      const j = lastPop >= 0 ? kit.jointList[lastPop] : null;
      const age = j ? t - j.at : 1;
      const glow = j && ironTip ? Math.max(0, 1 - age / 0.025) : 0;
      kit.glint.visible = glow > 0.01;
      if (j && glow > 0.01) {
        kit.glint.position.copy(d.pcb.localToWorld(tmp.v.copy(j.pos)));
        kit.group.worldToLocal(kit.glint.position);
        kit.glint.scale.setScalar(0.9 * glow + 0.2);
        (kit.glint.material as THREE.SpriteMaterial).opacity = glow;
      }
    }

    // The encoder that went in from the wrong side (solder-4).
    {
      const u = span(t, S4 + 0.02, S4 + 0.17);
      const fade = 1 - span(t, S4 + 0.19, S4 + 0.27);
      const on = t > S4 && t < S4 + 0.27;
      kit.ghost.visible = on;
      kit.ghostMat.opacity = 0.5 * fade * Math.min(1, u * 4);
      // Mirrored onto the F side, coming down onto SW1's place.
      const c0 = SW_CENTRES[0];
      kit.ghost.position.set(0, 0.0016 + 0.028 * (1 - u), 0);
      kit.ghost.scale.set(1, -1, 1);
      void c0;
    }

    // ── the holder ──────────────────────────────────────────────────────────
    {
      const up = span(t, S1, S1 + 0.1) * (1 - span(t, BOARD_OVER[1], BOARD_OVER[1] + 0.1));
      kit.holder.group.visible = up > 0.001;
      kit.holder.posts.forEach((p) => p.scale.set(1, 2.75 * up + 0.001, 1));
      kit.holder.jaws.forEach((j) => {
        j.visible = up > 0.98;
        j.position.y = BOARD_WORK.p.y + 0.075;
      });
    }

    // ── the DevKit ──────────────────────────────────────────────────────────
    {
      const kp = d.kit;
      if (t < G1) {
        // Device has it on its pins inside the closed case; back from the
        // bench, it is not shown on its way there.
        kp.visible = true;
        kp.scale.setScalar(kp.position.distanceToSquared(DEVKIT_SEAT.position) < 1e-4 ? 100 : 1e-4);
      } else if (t < F1 + 0.45) {
        // Not on the mat yet: shrunk away rather than hidden — KitFx keeps a
        // light on it, and a light going out changes every lit shader in the
        // scene (a frozen frame while they all rebuild).
        const dr = drop(t, G1 + 0.68, 0.09);
        kp.visible = true;
        if (t < F1) {
          kp.position.copy(DEVKIT_BENCH.p).setY(DEVKIT_BENCH.p.y + dr.fall * 3);
          kp.quaternion.copy(DEVKIT_BENCH.q);
          kp.scale.setScalar(dr.on ? 100 * dr.scale : 1e-4);
        } else {
          // Up from the mat into the reader's hands (Device and KitFx take it from there).
          arcPose(DEVKIT_BENCH, KIT_PRESENTED, span(t, F1, F1 + 0.42), 6, tmp.a);
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
    const swapAt = P4 + 0.62;
    {
      // Device's body: the finished device, then gone until the halves are bonded.
      d.body.visible = finished ? true : t < G1 + 0.17 || t >= swapAt;
      for (const mat of d.fade) mat.opacity = t < G1 + 0.17 ? caseFade : 1;
      d.deviceSlider.visible = false;
      d.deviceSlider.position.set(0, 0, 0);
      d.deviceSlider.quaternion.identity();

      // The back panel: bonded at rest, then hooked in and swung shut (check-4).
      const bpMesh = d.backPlate;
      if (t < G1 + 0.17) {
        bpMesh.visible = true;
        setRigid(bpMesh, places.home);
      } else if (t < swapAt) bpMesh.visible = false;
      else {
        bpMesh.visible = true;
        if (t < K4) setRigid(bpMesh, places.backRest);
        else if (t < K4 + 0.32) setRigid(bpMesh, arcRigid(centres.back_plate, places.backRest, places.hingeAway, span(t, K4 + 0.1, K4 + 0.32), 6, tmp.r));
        else if (t < K4 + 0.44) {
          tmp.r.q.copy(places.hingeOpen.q);
          tmp.r.T.lerpVectors(places.hingeAway.T, places.hingeOpen.T, span(t, K4 + 0.32, K4 + 0.43));
          setRigid(bpMesh, tmp.r);
        }
        else {
          // Shut, and no further: an ease that overshoots swung the panel on through the ribbon.
          const u = span(t, K4 + 0.44, K4 + 0.62, smooth);
          const a = BACK_OPEN_ANGLE * (1 - u);
          tmp.r.q.setFromAxisAngle(Y, a);
          tmp.r.T.copy(BACK_HINGE).sub(tmp.v.copy(BACK_HINGE).applyQuaternion(tmp.r.q));
          setRigid(bpMesh, tmp.r);
        }
      }
      if (d.notch) d.notch.visible = finished || t >= K4 + 0.58;

      // The PCB cover (the stage's copy). Printed on plate 3 (the plate's own
      // mesh shows it until print-4), it stays on its plate until it is
      // lifted off: from P4 this one is there, in the same place.
      const sl = kit.slider;
      const slMat = sl.material as THREE.MeshStandardMaterial;
      slMat.opacity = t < G1 + 0.17 ? caseFade : 1;
      if (t < G1 + 0.17) {
        sl.visible = true;
        setRigid(sl, places.home);
      } else if (t < P4) sl.visible = false;
      else {
        sl.visible = true;
        if (t < P4 + 0.55) setRigid(sl, arcRigid(centres.back_slider, places.plate.back_slider, places.sliderRest, span(t, P4 + 0.3, P4 + 0.55), 10, tmp.r));
        else if (t < K4 + 0.65) setRigid(sl, places.sliderRest);
        else if (t < K4 + 0.85) setRigid(sl, arcRigid(centres.back_slider, places.sliderRest, places.sliderOut, span(t, K4 + 0.65, K4 + 0.85), 6, tmp.r));
        else {
          tmp.r.q.identity();
          tmp.r.T.set(SLIDER_OUT_X * (1 - span(t, K4 + 0.86, K4 + 0.98)), 0, 0);
          setRigid(sl, tmp.r);
        }
      }

      // The lid over the power-bank tray: printed, laid down beside the
      // case with the other covers, and slid in from the case's side at the
      // end (check-5).
      const lid = d.topLid;
      if (t < G1 + 0.17) {
        lid.visible = true;
        setRigid(lid, places.home);
      } else if (t < P4) lid.visible = false;
      else {
        lid.visible = true;
        if (t < P4 + 0.62) setRigid(lid, arcRigid(centres.top_lid, places.plate.top_lid, places.lidRest, span(t, P4 + 0.4, P4 + 0.62), 9, tmp.r));
        else if (t < K5) setRigid(lid, places.lidRest);
        else if (t < K5 + 0.32) setRigid(lid, arcRigid(centres.top_lid, places.lidRest, places.lidApproach, span(t, K5 + 0.18, K5 + 0.32), 5, tmp.r));
        else {
          // Along its rails, in from the case's side.
          tmp.r.q.identity();
          tmp.r.T.set(LID_CLEAR * (1 - span(t, K5 + 0.32, K5 + 0.5)), 0, 0);
          setRigid(lid, tmp.r);
        }
      }
    }

    // ── printing and bonding ────────────────────────────────────────────────
    {
      const platesOn = t >= P2 && t < P4 + 0.92;
      const plateFade = span(t, P2, P2 + 0.05) * (1 - span(t, P4 + 0.72, P4 + 0.92));
      (kit.plates[0].slab.material as THREE.MeshStandardMaterial).opacity = plateFade;
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
      });

      // The halves: off their plates, turned to stand as they will, closed up.
      const bonding = t >= P4 && t < swapAt;
      const sp = kit.split;
      for (const n of ["frame_bottom", "frame_top", "back_bottom", "back_top"]) sp[n].visible = bonding;
      if (bonding) {
        const uF = span(t, P4, P4 + 0.3, clamp01);
        setRigid(sp.frame_bottom, arcRigid(centres.frame_bottom, places.plate.frame_bottom, places.home, uF, 12, tmp.r));
        if (t < P4 + 0.3) setRigid(sp.frame_top, arcRigid(centres.frame_top, places.plate.frame_top, places.frameTopApart, uF, 14, tmp.r));
        else {
          tmp.r.q.identity();
          tmp.r.T.set(0, 3.2 * (1 - span(t, P4 + 0.3, P4 + 0.44)), 0);
          setRigid(sp.frame_top, tmp.r);
        }
        const uB = span(t, P4 + 0.04, P4 + 0.32, clamp01);
        setRigid(sp.back_bottom, arcRigid(centres.back_bottom, places.plate.back_bottom, places.backRest, uB, 10, tmp.r));
        if (t < P4 + 0.32) setRigid(sp.back_top, arcRigid(centres.back_top, places.plate.back_top, places.backTopApart, uB, 10, tmp.r));
        else {
          tmp.r.q.copy(places.backRest.q);
          tmp.r.T.lerpVectors(places.backTopApart.T, places.backRest.T, span(t, P4 + 0.32, P4 + 0.46));
          setRigid(sp.back_top, tmp.r);
        }
      }
      // Tape and a glow along each seam while it cures.
      const tape = t >= P4 + 0.47 && t < swapAt;
      kit.frameTape.forEach((m, i) => {
        m.visible = tape && t >= P4 + 0.47 + i * 0.03;
      });
      setRigid(kit.backSeamGroup, places.backRest);
      kit.backTape.forEach((m, i) => {
        m.visible = tape && t >= P4 + 0.48 + i * 0.03;
      });
      const pulse = t >= P4 + 0.44 && t < swapAt ? (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 7)) * (1 - span(t, swapAt - 0.06, swapAt)) : 0;
      kit.seamMat.opacity = pulse;
      kit.frameSeam.visible = pulse > 0.01;
      kit.backSeamGroup.visible = t >= P4 + 0.44 && t < swapAt;
    }

    // ── the knobs ───────────────────────────────────────────────────────────
    d.knobs.forEach((k, i) => {
      const home = d.knobHome[i];
      const mat = d.knobMats[i] as THREE.MeshStandardMaterial;
      mat.opacity = t < G1 + 0.17 ? caseFade : 1;
      const onAt = K5 + 0.52 + i * 0.09;
      const doneAt = onAt + 0.2;
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
        // Fading with the case.
        k.position.copy(home.p);
        k.quaternion.copy(home.q);
      } else if (t < P4) shown = false;
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
        } else if (t < P4 + 0.8) {
          arcPose(plateP, rest, span(t, P4 + 0.5 + i * 0.04, P4 + 0.68 + i * 0.04), 8, tmp.c);
          k.position.copy(tmp.c.p);
          k.quaternion.copy(tmp.c.q);
        } else if (t < onAt) {
          k.position.copy(rest.p);
          k.quaternion.copy(rest.q);
        } else {
          // Over to the front of its shaft, then pressed on.
          const above = tmp.c;
          above.p.copy(home.p).add(V(0, 0, 2.4));
          above.q.copy(home.q);
          if (t < onAt + 0.13) {
            arcPose(rest, above, span(t, onAt, onAt + 0.13), 6, tmp.a);
            k.position.copy(tmp.a.p);
            k.quaternion.copy(tmp.a.q);
          } else {
            k.position.lerpVectors(above.p, home.p, span(t, onAt + 0.13, onAt + 0.2));
            k.position.z -= KNOB_PRESS * Math.sin(Math.PI * span(t, onAt + 0.17, onAt + 0.2, clamp01));
            k.quaternion.copy(home.q);
          }
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
      const arrive = G2 + 0.05;
      let on = true;
      let scale = 1;
      let alpha = 1;
      if (t < G1 + 0.17) {
        pg.position.copy(PANEL_CENTRE);
        pg.quaternion.identity();
        alpha = caseFade;
      } else if (t < C1) {
        const dr = drop(t, arrive, 0.1);
        on = dr.on;
        pg.position.copy(PANEL_BENCH.p).setY(PANEL_BENCH.p.y + dr.fall * 3);
        pg.quaternion.copy(PANEL_BENCH.q);
        scale = dr.scale;
      } else if (t < C1 + 0.5) {
        // Up off the mat and stood up in FRONT of the frame, its back to the
        // frame, IN end up: the panel only goes in from the front (the
        // frame's ledge and its twelve tabs are behind it).
        const u = span(t, C1 + 0.12, C1 + 0.5, smooth);
        const front = tmp.v.copy(PANEL_CENTRE).add(V(0, 0, PANEL_FRONT_GAP));
        bezier(PANEL_BENCH.p, V(PANEL_BENCH.p.x, 15, PANEL_BENCH.p.z), V(-9, 21, 21), front, u, pg.position);
        pg.quaternion.slerpQuaternions(PANEL_BENCH.q, IDENTITY, smooth((u - 0.08) / 0.8));
      } else {
        // In along −z, slowly, its bottom edge first and the top pressed home
        // after it — the fit has almost no clearance — until its rim is on
        // the ledge and the tabs.
        const u = span(t, C1 + 0.54, C1 + 0.96, clamp01);
        const tilt = 0.06 * smooth(u / 0.3) * (1 - smooth((u - 0.62) / 0.38));
        pg.quaternion.setFromAxisAngle(tmp.v.set(1, 0, 0), tilt);
        // About its bottom back edge, which travels straight in.
        const edge = tmp.v2.set(0, -16, -0.85);
        pg.position
          .copy(PANEL_CENTRE)
          .add(edge)
          .add(tmp.v3.set(0, 0, PANEL_FRONT_GAP * (1 - smooth(u / 0.72))))
          .sub(edge.applyQuaternion(pg.quaternion));
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
        const s0 = k < 6 ? C2 + 0.14 + k * 0.07 : C2 + 0.56 + (k - 6) * 0.035;
        const bench = tmp.b;
        bench.p.set(SCREW_BENCH_X0 + k * SCREW_BENCH_DX, MAT_TOP + 0.36, SCREW_BENCH_Z);
        bench.q.copy(lying);
        let p: Pose = seated;
        if (finished) p = seated;
        else if (t < s0) {
          const dr = drop(t, G2 + 0.3 + k * 0.012, 0.06);
          scale = dr.on ? dr.scale : 0;
          bench.p.y += dr.fall * 2.5;
          p = bench;
        } else if (t < s0 + 0.16) {
          // Over the top of the case and down behind it to its tab: high and
          // far enough back that it is past the case before it comes down
          // (a lower arc took the screws for the low tabs through the panel).
          const u = span(t, s0, s0 + 0.16, smooth);
          const hover = tmp.v.set(hx, hy, TAB_BACK_Z - 3.2);
          bezier(bench.p, tmp.v2.set(bench.p.x, OVER_TOP[0], bench.p.z / 2), tmp.v3.set(hx, OVER_TOP[1], OVER_TOP[2]), hover, u, tmp.c.p);
          tmp.c.q.copy(lying);
          p = tmp.c;
        } else {
          // Driven in: 1.2 units along +z, turning.
          const u = span(t, s0 + 0.16, s0 + 0.24, smooth);
          tmp.c.p.set(hx, hy, TAB_BACK_Z + 1.0 - (1 - u) * 3.2 + (u < 0.4 ? 0 : 0));
          tmp.c.q.copy(lying).multiply(tmp.q.setFromAxisAngle(Y, -u * Math.PI * 8));
          p = tmp.c;
        }
        if (!finished && t >= G1 && t < G2 + 0.3) scale = 0;
        m.compose(p.p, p.q, tmp.s.setScalar(scale));
        kit.screws.setMatrixAt(k, m);
      });
      kit.screws.instanceMatrix.needsUpdate = true;
    }

    // ── washers and nuts on the encoder bushings ────────────────────────────
    {
      const m = tmp.m;
      const upZ = qx(Math.PI / 2);
      for (let k = 0; k < 4; k++) {
        const ax = boardToModel(tmp.v.copy(SW_CENTRES[k]), BOARD_IN_CASE, V());
        const sx = ROW[`SW${k + 1}`];
        const arrive = ARRIVE0 + (6 + k) * ARRIVE_STEP + 0.02;
        const s0 = C5 + 0.2 + k * 0.18;
        for (const which of [0, 1] as const) {
          const seatZ = which === 0 ? FRONT_Z : FRONT_Z + 0.05;
          const restP = V(sx + (which ? 0.15 : 0), MAT_TOP, which ? NUT_ROW_Z - 1.3 : NUT_ROW_Z);
          const lift0 = s0 + which * 0.04;
          let scale = 1;
          if (finished) {
            tmp.a.p.set(ax.x, ax.y, seatZ);
            tmp.a.q.copy(upZ);
          } else if (t < lift0) {
            const dr = drop(t, arrive, 0.06);
            scale = dr.on ? dr.scale : 0;
            tmp.a.p.copy(restP).setY(restP.y + dr.fall * 2.5);
            tmp.a.q.identity();
          } else if (t < lift0 + 0.1) {
            tmp.b.p.copy(restP);
            tmp.b.q.identity();
            tmp.c.p.set(ax.x, ax.y, seatZ + 3);
            tmp.c.q.copy(upZ);
            arcPose(tmp.b, tmp.c, span(t, lift0, lift0 + 0.1, clamp01), 10, tmp.a);
          } else {
            const u = span(t, lift0 + 0.1, lift0 + 0.16, smooth);
            tmp.a.p.set(ax.x, ax.y, seatZ + 3 * (1 - u));
            tmp.a.q.copy(upZ).multiply(tmp.q.setFromAxisAngle(Y, which ? -u * Math.PI * 6 : 0));
          }
          m.compose(tmp.a.p, tmp.a.q, tmp.s.setScalar(scale));
          (which ? kit.nuts : kit.washers).setMatrixAt(k, m);
        }
      }
      kit.washers.instanceMatrix.needsUpdate = true;
      kit.nuts.instanceMatrix.needsUpdate = true;
    }

    // ── the power bank, the plug, the J4 lead ───────────────────────────────
    const plugIn = finished || t >= F3 + 0.76;
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
      if (finished || t >= F3 + 0.7) {
        b.position.copy(BANK_IN.p);
        b.quaternion.identity();
      } else if (t < F3) {
        const dr = drop(t, G2 + 0.4, 0.08);
        on = dr.on;
        scale = dr.scale;
        b.position.copy(BANK_BENCH.p).setY(BANK_BENCH.p.y + dr.fall * 3);
        b.quaternion.copy(BANK_BENCH.q);
      } else if (t < F3 + 0.44) {
        arcPose(BANK_BENCH, BANK_FRONT, span(t, F3 + 0.2, F3 + 0.42), 6, tmp.a);
        b.position.copy(tmp.a.p);
        b.quaternion.copy(tmp.a.q);
      } else {
        b.position.lerpVectors(BANK_FRONT.p, BANK_IN.p, span(t, F3 + 0.46, F3 + 0.7, smooth));
        b.quaternion.identity();
      }
      b.visible = on;
      b.scale.setScalar(scale);
      kit.bankLed.visible = plugIn && sim.snapshot().mode !== "off";

      // The plug: loose in the tray once the lead is through; held up out of
      // the bank's way as it slides in, then into it. At the power cycle
      // (check-3) it follows the panel: out while it is off.
      const plugPos = tmp.v4;
      const above = (p: THREE.Vector3, h: number) => plugPos.copy(p).setY(p.y + h);
      if (plugIn) {
        const track = plugTrack.current;
        const out = !finished && t >= K1 && sim.snapshot().mode === "off" ? 1 : 0;
        track.out += (out - track.out) * Math.min(1, dt * 8);
        above(PORT_IN, finished ? 0 : Math.max(1.1 * track.out, 1.4 * (1 - span(t, F3 + 0.76, F3 + 0.84))));
      } else if (t < F3) plugPos.copy(PLUG_LOOSE);
      else plugPos.lerpVectors(PLUG_LOOSE, tmp.v2.copy(PORT_IN).setY(PORT_IN.y + 1.4), span(t, F3 + 0.22, F3 + 0.42, smooth));
      // The cable as it came: a coil on the mat, its USB-A plug lying at
      // the coil's end, mouth toward the reader — a bare coil did not read
      // as a USB cable. At case-3 it is the lead, its plug in the tray.
      const coilDrop = drop(t, G2 + 0.36, 0.07);
      const cableOn = finished || t >= C3 + 0.05;
      if (cableOn) {
        kit.plug.position.copy(plugPos);
        kit.plug.quaternion.identity();
        kit.plug.scale.setScalar(1);
        kit.plug.visible = true;
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
      const held = finished ? 1 : span(t, C3 + 0.72, C3 + 0.84, smooth);
      // Out and round J4's side on its way under it, not through its body.
      const jacketEnd = onBoard.lerpVectors(LEAD_FREE, onBoard, held).addScaledVector(LEAD_ROUND, Math.sin(Math.PI * held));
      const inCase = finished || t >= C4 + 0.55 ? 1 : t >= C4 ? span(t, C4, C4 + 0.55, smooth) : 0;
      pts[5].lerpVectors(BAY_OUT, BAY_IN, inCase);
      pts[6].lerpVectors(tmp.v.lerpVectors(LEAD_FREE_MID, SAG, held), tmp.v2.lerpVectors(pts[5], jacketEnd, 0.45), inCase);
      pts[7].lerpVectors(pts[6], jacketEnd, 0.7);
      pts[8].copy(jacketEnd);
      kit.usbPath.touch();
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
      if (cableOn && grow > 0) kit.usb.update(kit.usbPath, grow);
      kit.usb.mesh.visible = cableOn && grow > 0;
      // Red to +5V, black to GND: fanned out of the jacket while they wait, then into J4's entries.
      const wireGrow = finished ? 1 : span(t, C3 + 0.37, C3 + 0.42, clamp01);
      [1, 0].forEach((pad, w) => {
        const path = kit.j4Paths[w];
        const fan = w === 0 ? -0.22 : 0.22;
        path.points[0].copy(jacketEnd);
        boardToModel(tmp.v.copy(J4_ENTRY[pad]).setZ(J4_ENTRY[pad].z + 0.0012), boardPose, path.points[1]);
        boardToModel(tmp.v.copy(J4_ENTRY[pad]).setZ(J4_ENTRY[pad].z - 0.0025), boardPose, path.points[2]);
        path.points[1].lerpVectors(tmp.v.copy(LEAD_FREE).add(tmp.v2.set(fan * 0.5, 0.12, -0.45)), path.points[1], held);
        path.points[2].lerpVectors(tmp.v.copy(LEAD_FREE).add(tmp.v2.set(fan, 0.3, -0.85)), path.points[2], held);
        path.touch();
        if (cableOn && wireGrow > 0) kit.j4Wires[w].update(path, wireGrow);
        kit.j4Wires[w].mesh.visible = cableOn && wireGrow > 0;
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
      if (finished || t >= W1 + 0.74) {
        rq.identity();
        rc.copy(RIBBON_CENTRE);
      } else if (t < W1 + 0.16) {
        const dr = drop(t, G2 + 0.12, 0.07);
        rOn = t >= G1 && dr.on;
        rs = dr.scale;
        rq.copy(RIBBON_BENCH.q);
        rc.copy(RIBBON_BENCH.p).setY(RIBBON_BENCH.p.y + dr.fall * 2.5);
      } else if (t < W1 + 0.56) {
        // Quick over the top of the case, where the camera is not looking, and slow down behind it, where it is.
        const u = 1 - Math.pow(1 - span(t, W1 + 0.16, W1 + 0.56, clamp01), 2.4);
        const hover = tmp.v2.copy(RIBBON_CENTRE).setZ(RIBBON_CENTRE.z - RIBBON_HOVER);
        bezier(RIBBON_BENCH.p, tmp.v3.set(RIBBON_BENCH.p.x, 44, 28), tmp.v4.set(RIBBON_CENTRE.x, 50, -8), hover, u, rc);
        rq.slerpQuaternions(RIBBON_BENCH.q, IDENTITY, smooth((u - 0.1) / 0.7));
      } else {
        rq.identity();
        rc.copy(RIBBON_CENTRE).setZ(RIBBON_CENTRE.z - RIBBON_HOVER * (1 - span(t, W1 + 0.6, W1 + 0.74, smooth)));
      }
      rb.visible = rOn;
      rb.quaternion.copy(rq);
      rb.scale.setScalar(rs);
      // Turned and scaled about its own middle.
      rb.position.copy(RIBBON_CENTRE).applyQuaternion(rq).multiplyScalar(-rs).add(rc);

      // The power lead: its plug onto the panel's header (below the band, as
      // photo 08c has it), then the pair laid up the panel's back, through
      // the notch's low end and down the bay's side into J3 from above.
      const seat = tmp.v2.set(PANEL_POWER.x, PANEL_POWER.y, PANEL_PCB_Z - 0.3);
      const pp = kit.powerPlug;
      const pc = drop(t, G2 + 0.15, 0.07);
      // On the mat it lies in its coil, mating face up.
      const plugBench = tmp.v5.set(POWER_COIL.x, POWER_COIL.y + 0.9, POWER_COIL.z);
      pp.scale.setScalar(1);
      if (finished || t >= W2 + 0.24) {
        pp.position.copy(seat);
        pp.quaternion.identity();
        pp.visible = true;
      } else if (t < W2 + 0.02) {
        pp.visible = t >= G1 && pc.on;
        pp.position.copy(plugBench).setY(MAT_TOP + 0.9 * pc.scale + pc.fall * 2.5);
        pp.quaternion.copy(qx(-Math.PI / 2));
        pp.scale.setScalar(pc.scale);
      } else if (t < W2 + 0.18) {
        const u = span(t, W2 + 0.02, W2 + 0.18, smooth);
        bezier(plugBench, tmp.v3.set(POWER_COIL.x, OVER_TOP[0], POWER_COIL.z / 2), tmp.v4.set(seat.x, OVER_TOP[1], OVER_TOP[2]), tmp.v.copy(seat).setZ(seat.z - 2.4), u, pp.position);
        pp.quaternion.slerpQuaternions(qx(-Math.PI / 2), IDENTITY, smooth((u - 0.1) / 0.7));
        pp.visible = true;
      } else {
        pp.position.copy(seat).setZ(seat.z - 2.4 * (1 - span(t, W2 + 0.18, W2 + 0.24, smooth)));
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
        kit.powerPaths[w].touch();
        if (pwrOn) kit.powerWires[w].update(kit.powerPaths[w], tail);
        kit.powerWires[w].mesh.visible = pwrOn && tail > 0;
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
      kit.dash.computeLineDistances();
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
      if (t >= G2 + 0.5 && t < at("gather-4")) {
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
      if (t >= S4 + 0.07 && t < S4 + 0.26) tags.set("wrong", local(V(SW_CENTRES[0].x, 0.03, SW_CENTRES[0].z)));
      // Which side is which, while the joints are made and where the step holds.
      if (t >= S4 + 0.72 && t < S4 + 0.89) tags.set("swPins", local(V(0, 0.004, SW_CENTRES[0].z - 0.004)));
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

// How far the plug is out of the bank, shown (check-3's power cycle eases it).
const plugTrack = { current: { out: 0 } };

useGLTF.preload([SPLIT_URL, PLATES_URL], DRACO_URL);
