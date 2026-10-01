import type { SceneDef } from "../scenes";
import { BUILD_STEPS } from "../stage/build/script";

// Build — the script for /guide/build: a Patternflow soldered from bare parts,
// shown on the same 3D stage as Play (stage/GuideCanvas). Step N of a
// chapter here is on stage while step N of that chapter in copy/build.ts is
// in the middle of the screen; the two lists must be the same length, and
// every chapter in copy/build.ts needs a scene here with its id
// (pages.test.ts checks it, and the page warns in development).
//
// Like Play's script, it opens on a scene called "opening" and ends on one
// called "next". A step is a Step (scenes.ts): a view, the board's power and
// state, and whatever the stage should do. The comment on each step is what
// the stage shows there, in the order the build really happens
// (BUILD_GUIDE.md; the parts as pcb-v39.glb and case-v39.glb have them).
//
// There is no multimeter in this build: no short check after the soldering
// (there is no solder-5) and no powered check before the DevKit (no wire-3).
// The other step ids are the storyboard's, unchanged; after wire-2 comes
// firmware-1.
//
// Its chapter ids are its own — none of Play's ("flash", "knobs") — so the
// stage's checks on those ids never fire here.
//
// What each step does on stage — the beat of the build, the view, the
// device's state — is the stage's own ready step for that beat
// (stage/build/script.ts BUILD_STEPS; the fields are explained at the top of
// stage/build/BuildStage.tsx). Spread one to change a field.
//
// Import only TYPES from "../scenes": scenes.ts imports this file, so a value
// import from it here would be a cycle that runs before scenes.ts has set its
// constants (stage/build/script.ts follows the same rule).

export const BUILD_SCENES: SceneDef[] = [
  {
    id: "opening",
    // The finished device turning, dark: what the guide builds.
    steps: [BUILD_STEPS.opening],
  },
  {
    id: "gather",
    steps: [
      // 0 — the bare v3.9 board on the bench, printed side up; its parts
      // arrive beside it in soldering order: the two socket rows, J1, J3 and
      // J4, C11, SW1–SW4. The DevKit lands apart: it plugs in, never soldered.
      BUILD_STEPS["gather-1"],
      // 1 — the off-board parts join them: the LED panel face down (its back,
      // the IN connector, its ribbon and power cable), the M4 screws, a USB
      // cable, a power bank.
      BUILD_STEPS["gather-2"],
      // 2 — the spread holds; the tools are on the card, not the stage.
      BUILD_STEPS["gather-3"],
      // 3 — the parts settle; the camera eases to the board.
      BUILD_STEPS["gather-4"],
    ],
  },
  {
    id: "print",
    steps: [
      // 0 — the bare board turns over once: printed side, plain side, back.
      BUILD_STEPS["print-1"],
      // 1 — the case grows layer by layer on three of the Bambu project's
      // four 256 mm plates (patternflow_v3.3mf): the two frame halves on
      // one, a back-panel half and a cover on each of the other two.
      BUILD_STEPS["print-2"],
      // 2 — the fourth plate: the four knobs.
      BUILD_STEPS["print-3"],
      // 3 — the frame halves come together and the seam is taped; the back
      // panel's halves the same. Then they are the one-piece body.
      BUILD_STEPS["print-4"],
    ],
  },
  {
    id: "solder",
    steps: [
      // 0 — the two socket rows drop into U1's holes from the printed side;
      // the board flips and 44 joints appear on the plain side.
      BUILD_STEPS["solder-1"],
      // 1 — J1 beside the right-hand socket row, notch toward it; J3 and J4
      // in the bottom corners; their joints on the plain side (16 + 2 + 2).
      BUILD_STEPS["solder-2"],
      // 2 — C11 above J4, + toward the sockets, stripe to the edge; 2 joints.
      BUILD_STEPS["solder-3"],
      // 3 — an encoder on the wrong side is crossed out; the board flips to
      // the plain side, SW1–SW4 go in from there, it flips back and they are
      // soldered on the printed side; then over once more, to hold on the
      // plain side with the bodies up — which side they sit on is the step.
      BUILD_STEPS["solder-4"],
    ],
  },
  {
    id: "case",
    steps: [
      // 0 — from behind the empty frame, where its twelve tabs show: the LED
      // panel is stood up in FRONT of the frame, HUB-75E IN at the top (the
      // knob end), and goes in from the front, slowly, until its rim is on
      // the frame's ledge and tabs.
      BUILD_STEPS["case-1"],
      // 1 — the case from behind: an M4 screw through each tab into the
      // panel, 6 then the other 6.
      BUILD_STEPS["case-2"],
      // 2 — the lead first: the cut USB cable up through the small cable hole
      // in the wall between the power-bank compartment and the board bay,
      // right under J4's place — not the wide opening beside it, which is the
      // USB pass-through to the DevKit (the 330 mm body and the stage's case
      // have it; the 256 mm print has only the small hole, so the card says
      // "if your case has one"). It waits there with its red and black wires
      // fanned; then the board is carried to it and they go into J4, the
      // board still outside the case. On a phone the camera shows the hole
      // first and J4 second (two views: script.ts).
      BUILD_STEPS["case-3"],
      // 3 — the board into its bay, printed side out; the shafts through the
      // front face.
      BUILD_STEPS["case-4"],
      // 4 — from the front: a nut on each shaft. No knobs yet.
      BUILD_STEPS["case-5"],
    ],
  },
  {
    id: "wire",
    steps: [
      // 0 — the folded ribbon is carried over the case and both plugs are
      // pressed home: J1, and the panel's IN, the header at the top beside
      // the board bay. OUT, at the very bottom, stays empty.
      BUILD_STEPS["wire-1"],
      // 1 — the panel's power lead: its plug onto the panel's 4-pin header,
      // just below the middle of its back, and the pair through the bay
      // wall's notch into J3; + and − on J3 and J4 at once, showing the
      // mirror.
      BUILD_STEPS["wire-2"],
    ],
  },
  {
    id: "firmware",
    steps: [
      // 0 — the DevKit held up in front of the device, the USB-C cable in its
      // left port: flashing, which is the Play guide's 01.
      BUILD_STEPS["firmware-1"],
      // 1 — the cable out; once the camera is behind the case, the DevKit
      // comes round its side and is pressed straight onto its sockets, USB
      // end at the bottom.
      BUILD_STEPS["firmware-2"],
      // 2 — the power bank off the bench and into its tray, the lead plugged: Origin comes on.
      BUILD_STEPS["firmware-3"],
    ],
  },
  {
    id: "check",
    steps: [
      // 0 — the bare shafts turning and clicking, the knobs still off.
      BUILD_STEPS["check-1"],
      // 1 — each long-press screen in turn.
      BUILD_STEPS["check-2"],
      // 2 — the power bank unplugged and plugged back: dark, then Origin.
      BUILD_STEPS["check-3"],
      // 3 — the back panel hooks in at its edge and snaps flat; the back cover
      // (the small sliding one over the board) slides shut.
      BUILD_STEPS["check-4"],
      // 4 — the power-bank cover is picked up off the floor and slid shut
      // from the case's knob side; the four black knobs press on.
      BUILD_STEPS["check-5"],
    ],
  },
  {
    id: "next",
    // Built, and playing: the next guide is Play.
    steps: [BUILD_STEPS.next],
  },
];
