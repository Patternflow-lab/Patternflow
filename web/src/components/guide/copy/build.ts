import type { ClosingCopy, OpeningCopy, SceneCopy } from "../copy";
import type { GuideLang } from "../store";
import type { CheckCard, LinkCard } from "../build/cards";

// Build (/guide/build) — every word of the guide, in both languages: for
// someone who solders a Patternflow from bare parts. Its title for search and
// sharing, the opening, the chapters, the end, and the words on the cards
// inside its steps (build/BuildCards.tsx). The chapters line up with
// scenes/build.ts by id, and their steps one-to-one (pages.test.ts checks
// both). The small print every guide shares — "Stuck here?" — is copy.ts's
// `ui`.
//
// The written sources are the truth: BUILD_GUIDE.md (the v3.9 board), the BOM
// (hardware/bom/bom_v3.9.csv), hardware/**/README.md. The parts list on the
// page is the CSV itself (build/bom.ts); what is here is only what a card
// says about a line, keyed by its reference (build/build.test.ts checks every
// line has one). The board's known issues are BUILD_GUIDE.md §10: link there,
// don't restate them. The board has one power input, J4, the screw terminal:
// USB-C is never power. Firmware is the Play guide's 01 Flash, not repeated
// here. There are no kits.
//
// The board's two faces are "the printed side" (all its lettering, the
// sockets, J1, J3, J4 and C11 — KiCad's F side) and "the plain side" (where
// the encoders' bodies sit). Not "front" and "back": the docs use "back" for
// both the encoder side and J4's, which are opposite faces.
//
// The two covers are named as the Play guide names them, because a builder
// is sent into its 01 Flash mid-build: "the back panel" is the big snap-fit
// plate, "the back cover" the small one that slides over the board.

export type BuildLink = { label: string; href: string };

/** The words on the cards inside the steps (build/BuildCards.tsx). */
export type BuildCardsCopy = {
  bom: {
    /** What a card says about a line, by its reference ("SW1-SW4") — or, for a part with none, its name. */
    tips: Record<string, string>;
    /** The link to the file under the list. */
    source: string;
    /** In place of the list when the page was built without the file. */
    missing: string;
  };
  tools: {
    items: { label: string; where: string; href: string }[];
    /** Under the list: where the ticks are kept. */
    kept: string;
  };
  figures: { value: string; label: string }[];
  caseFiles: {
    head: [bed: string, file: string, note: string];
    rows: { bed: string; file: string; href: string; note: string }[];
    settingsLabel: string;
    settings: string[];
    links: BuildLink[];
  };
  order: {
    /** Sockets, J1/J3/J4, C11, the encoders — the chapter's steps 1–4. */
    steps: [string, string, string, string];
    video: BuildLink;
    /** The video's note: the v3.0 board's USB-C part, which v3.9 doesn't have. */
    skip: string;
  };
  terminals: {
    /** How the drawing is seen. */
    seen: string;
    red: string;
    black: string;
    /** The DevKit's end, at the bottom edge. */
    usb: string;
    /** What each terminal is for. */
    j4: string;
    j3: string;
  };
  checks: Record<CheckCard, string[]>;
  handoff: { label: string; href: string; line: string };
  /** The long-press screens, K1..K4. */
  knobMap: { screens: [string, string, string, string] };
  links: Record<LinkCard, BuildLink[]>;
};

export type BuildCopy = {
  meta: { title: string; description: string };
  /** The guide's name: in the hub, and where a "Stuck here?" issue says the reader was. */
  name: string;
  opening: OpeningCopy;
  /** The chapters, in order: each one's id (its scene in scenes/build.ts, its #anchor) and words. */
  chapters: { id: string; copy: SceneCopy }[];
  next: ClosingCopy;
  cards: BuildCardsCopy;
};

const REPO = "https://github.com/engmung/Patternflow";
const BUILD_GUIDE_MD = `${REPO}/blob/main/BUILD_GUIDE.md`;
const BLOB = `${REPO}/blob/main`;
const TREE = `${REPO}/tree/main`;
const PCBWAY = "https://www.pcbway.com/project/shareproject/Patternflow_An_LED_synthesizer_776d796c.html";
const MAKERWORLD = "https://makerworld.com/en/models/3072492-patternflow-open-source-led-synthesizer-case#profileId-3459015";
const SOLDER_VIDEO = "https://youtu.be/NZCjMBCsDAc";
const ASSEMBLY_VIDEO = "https://youtu.be/J9C9bZgkNKs";
const GUIDE_SECTION = {
  bom: `${BUILD_GUIDE_MD}#1-bill-of-materials-bom`,
  tools: `${BUILD_GUIDE_MD}#what-you-also-need-not-in-bom`,
  print: `${BUILD_GUIDE_MD}#4-3d-printing`,
  solder: `${BUILD_GUIDE_MD}#5-pcb-assembly`,
  gpio0: `${BUILD_GUIDE_MD}#5-pcb-assembly`,
  case: `${BUILD_GUIDE_MD}#6-case-assembly`,
  wiring: `${BUILD_GUIDE_MD}#7-wiring--first-power-up`,
  issues: `${BUILD_GUIDE_MD}#10-known-issues--design-notes`,
};
const ISSUE_16 = `${REPO}/issues/16`;
const PANEL_DOC = `${BLOB}/docs/panel-compatibility.md`;
const BOM_README = `${BLOB}/hardware/bom/README.md#sourcing-notes`;
const GERBER = `${BLOB}/hardware/pcb/gerber/patternflow_v3.9_gerber.zip`;
const KICAD = `${TREE}/hardware/pcb/kicad`;
const CASE_256 = `${BLOB}/hardware/case/bed_256mm/encloser.stl`;
const CASE_330 = `${BLOB}/hardware/case/bed_330mm/encloser.stl`;
const CASE_OTHER = `${TREE}/hardware/case/bed_256mm/for_other_panels`;
const CASE_DIR = `${TREE}/hardware/case`;
const THREE_MF = `${BLOB}/hardware/case/bed_256mm/patternflow_v3.3mf`;

const en: BuildCopy = {
  meta: {
    title: "Build a Patternflow",
    description:
      "The Build guide: a Patternflow soldered from bare parts — the parts list, the board order, the printed case, soldering, putting it together and first power — shown on the real v3.9 hardware in 3D.",
  },
  name: "Build",
  opening: {
    kicker: "The guide · Build",
    title: "Build one from scratch.",
    lede: "The board comes from a fab, the case from your printer, the parts from the parts list. Then about an hour of soldering and putting it together — shown here on the real parts, in the order it really happens.",
    scroll: "Scroll",
    chapters: ["Gather", "Order & print", "Solder", "Into the case", "Wire & power", "Firmware", "Check & close"],
    back: { label: "All guides", to: "hub" },
  },
  chapters: [
    {
      id: "gather",
      copy: {
        num: "01",
        title: "Gather the parts",
        lede: "Everything is on the parts list. Order first: shipping is the slow part.",
        steps: [
          {
            kicker: "On the board",
            title: "Seven lines. Everything you solder is through-hole.",
            body: [
              "Order by part number, from Mouser, DigiKey or anywhere with the same one. The list is the BOM file itself.",
            ],
            extra: "build:bomBoard",
          },
          {
            kicker: "Off the board",
            title: "A panel, screws, a cable, a power bank.",
            body: [
              "Buy the LED panel by its listing, not a part number: the case is measured around the one the build guide links. It comes with its ribbon and power cable.",
              "The USB cable is one you don't mind cutting: it becomes the power lead.",
            ],
            warn: "Another panel? Its driver IC decides, not “HUB75E” in the title. S-PWM “video wall” panels stay completely dark, and no firmware fixes that.",
            extra: "build:bomOff",
          },
          {
            kicker: "On the bench",
            title: "And the tools.",
            body: ["Tick them off as you find them."],
            extra: "build:tools",
          },
          {
            kicker: "Budget and time",
            title: "Order first, build later.",
            body: [
              "Budget US$100–200. Take $100 as the floor, not the estimate: shipping, minimum order quantities and a reprint or two add up.",
            ],
            extra: "build:figures",
          },
        ],
      },
    },
    {
      id: "print",
      copy: {
        num: "02",
        title: "Order the board, print the case",
        lede: "The board comes from a PCB fab. The case and the knobs come off your printer.",
        steps: [
          {
            kicker: "The board",
            title: "Order the v3.9 board.",
            body: [
              "The PCBWay shared project needs no upload, and ordering through it supports Patternflow. Any fab works too: upload the v3.9 Gerber zip. JLCPCB tends to be the cheapest.",
            ],
            warn: "v3.x only. The v2.1 board is a different size and won't fit these cases. Nothing in gerber/experiment/ is verified.",
            extra: "build:linksPcb",
          },
          {
            kicker: "The case",
            title: "Pick the file by your printer's bed.",
            body: [
              "Print the body in white PLA, about 10 hours in all. On a Bambu printer, MakerWorld has it with tuned profiles, one click; the same four-plate project is in the repo.",
            ],
            extra: "build:caseFiles",
          },
          {
            kicker: "Knobs",
            title: "The knobs in black, on their own.",
            body: [
              "Print knobs_20mm.stl, all four on one plate, as its own job in black PLA. It fits the BOM's 20 mm-shaft encoders; 15 mm shafts take knobs_15mm.stl.",
              "White body, black knobs: that contrast is the Patternflow look.",
            ],
          },
          {
            kicker: "256 mm only",
            title: "Glue the halves right away.",
            body: [
              "The 256 mm print splits the frame and the back panel into upper and lower halves. As soon as they're off the bed, glue each pair with CA glue and hold it with masking tape while it cures.",
              "Backlit, a bonded seam shows a hairline gap. That's normal: putty, or baking soda with CA, fills it.",
              "Let it cure while you solder. Printed the 330 mm one-piece body? Skip this.",
            ],
          },
        ],
      },
    },
    {
      id: "solder",
      copy: {
        num: "03",
        title: "Solder the board",
        lede: "Every joint is big and through-hole. Small parts first, the encoders last.",
        steps: [
          {
            kicker: "Sockets",
            title: "Sockets first, on the printed side.",
            body: [
              "Set the two 1×22 sockets into U1's two rows of holes from the printed side, the one with all the lettering. Solder all 44 pins from the plain side, and keep both rows straight and flush.",
              "The DevKit plugs in much later. It is never soldered.",
            ],
            extra: "build:order",
          },
          {
            kicker: "J1 · J3 · J4",
            title: "Then the header and the two terminals.",
            body: [
              "J1, the 2×8 box header, goes beside the right-hand row of sockets, its notch toward them: the board prints hole! on that side.",
              "The two screw terminals go in the bottom corners. With the printed side up and the encoders at the top, J3 is on the right and J4 on the left. J4 is the board's only power input.",
              "Seat each one flush, then solder from the plain side: 16 joints for J1, two each for J3 and J4.",
            ],
            extra: "build:order",
          },
          {
            kicker: "C11",
            title: "The capacitor, the right way round.",
            body: [
              "C11, the 1000 µF electrolytic, goes above J4. Its long lead is +: it goes in the hole marked + on the board, the one nearer the sockets. The stripe down the can marks −.",
              "Solder it, then trim the leads.",
            ],
            warn: "It only goes in one way. Check the long lead is in + before you solder.",
            extra: "build:order",
          },
          {
            kicker: "SW1–SW4",
            title: "The encoders last, from the other side.",
            body: [
              "Turn the board over. The four encoders go in from the plain side: their bodies sit there, and their pins come through to the printed side, which says it four times: ENCODER FACING OTHER SIDE.",
              "Solder the pins on the printed side.",
            ],
            warn: "Check the side twice before you solder each one. On the wrong side the shafts can't reach the front of the case, and a soldered encoder is very hard to get back out.",
            extra: "build:order",
          },
          {
            kicker: "Before any power",
            title: "Check for a short.",
            body: [
              "Set the multimeter to continuity and touch +5 V and GND: J4's two screws are the easy place. It must read open, no beep.",
              "Leave the DevKit out. It goes in only after the first power check, in 05.",
            ],
            extra: "build:checkShort",
          },
        ],
      },
    },
    {
      id: "case",
      copy: {
        num: "04",
        title: "Into the case",
        lede: "The panel first, then the board — with its power lead already through the case.",
        steps: [
          {
            kicker: "The panel",
            title: "HUB-75E IN toward the top.",
            body: [
              "Glue cured? Seat the LED panel in the frame from the back, its LEDs to the window and the connector marked HUB-75E IN toward the top, the knob end. That's the side the ribbon reaches J1 from.",
            ],
            warn: "The fit is very tight, with almost no clearance. Work it in slowly: forced, the print can crack.",
          },
          {
            kicker: "M4 screws",
            title: "Screw the panel in.",
            body: [
              "Fix it with the M4 screws. All 12 is the exact fit; 6, spread over the corners and the middle, hold it firmly.",
              "Another panel's holes and screws may differ. That's what the for_other_panels print is for.",
            ],
          },
          {
            kicker: "Power lead",
            title: "The lead goes in before the board.",
            body: [
              "Cut the USB cable and strip the red and black wires: red is +5 V, black GND. The other wires aren't used.",
              "Thread the cut end through the case's cable hole first, from the power-bank compartment into the board bay.",
              "Board still outside the case, clamp the wires into J4, red to the side marked +5v. Tighten, and tug each wire.",
            ],
            warn: "J4 is the only way power gets in. Never through the DevKit's USB ports.",
            extra: "build:j4",
          },
          {
            kicker: "The board",
            title: "Set the board into its bay.",
            body: [
              "Printed side facing you, encoders first: the four shafts go through the four holes in the front face. The sockets and the terminals face the open back, and the J4 lead follows the board in.",
            ],
          },
          {
            kicker: "Nuts",
            title: "Lock it from the front.",
            body: [
              "On the front, screw the nut that came with each encoder onto its shaft and tighten it with pliers or a wrench. The nuts are what hold the board against the front face.",
              "Keep the knobs off. They go on last, after the checks.",
            ],
          },
        ],
      },
    },
    {
      id: "wire",
      copy: {
        num: "05",
        title: "Wiring and first power",
        lede: "Two cables from the panel to the board, then one careful power-up — still without the DevKit.",
        steps: [
          {
            kicker: "Ribbon",
            title: "From J1 to the panel's IN.",
            body: [
              "Plug the panel's HUB75 ribbon into J1 on the board and into the connector marked IN on the panel. IN, not OUT. The plugs are keyed: match each key to its header's notch.",
            ],
          },
          {
            kicker: "J3",
            title: "The panel's power into J3.",
            body: [
              "Clamp the panel's power cable into J3: red to the side marked +5v, black to GND.",
              "J3 is J4's mirror image. From this side J3's +5v is on the left and J4's on the right, so go by the +5v mark, not by left and right.",
            ],
            warn: "Reversed, J3 can destroy the panel. Check it twice before any power.",
            extra: "build:j3",
          },
          {
            kicker: "First power",
            title: "One check with power, no DevKit.",
            body: [
              "Power still off, check continuity across J3's +5 V and GND: open. Then plug the J4 lead into the power bank once, measure about 5 V across J3, and unplug.",
              "The panel stays dark. It has no brain yet.",
            ],
            extra: "build:checkPower",
          },
        ],
      },
    },
    {
      id: "firmware",
      copy: {
        num: "06",
        title: "Firmware and first light",
        lede: "The DevKit gets its firmware on its own, then goes in.",
        steps: [
          {
            kicker: "Flash",
            title: "Flash it in the Play guide.",
            body: [
              "The DevKit is flashed on its own, out of the board, from desktop Chrome or Edge. The Play guide's 01 Flash walks through it: the left USB port, BOOT and RST, your Wi-Fi on 2.4 GHz.",
            ],
            extra: "build:handoff",
          },
          {
            kicker: "Seat it",
            title: "Power off, then seat the DevKit.",
            body: [
              "Press the flashed DevKit straight into the two sockets, its USB-C ports toward the board's bottom edge, where the board says USB, and its antenna end toward the encoders.",
              "All 44 pins in, neither row shifted by one.",
            ],
          },
          {
            kicker: "First light",
            title: "Plug in the power bank.",
            body: [
              "Slide the power bank into its compartment and plug in the J4 lead. Within a second or two the panel lights with Origin.",
              "One pattern is right, not a failed install. The Basics pack goes on in the Play guide's 03.",
            ],
            extra: "build:linksPlay03",
          },
        ],
      },
    },
    {
      id: "check",
      copy: {
        num: "07",
        title: "Check and close",
        lede: "Every knob, every screen, one power cycle. Then the back goes on, and the knobs last.",
        steps: [
          {
            kicker: "Turn and click",
            title: "Every knob, both ways.",
            body: [
              "Turn each of the four shafts: each one should visibly change the pattern. Then click each once: on Origin, a click zeroes that knob.",
              "From the front: K2 and K1 on top, K4 and K3 below.",
            ],
            extra: "build:checkKnobs",
          },
          {
            kicker: "Hold",
            title: "Hold each knob for a second.",
            body: [
              "Each opens its own screen. K4's is the pattern list: turn to browse, hold again to close it.",
            ],
            extra: "build:knobMap",
          },
          {
            kicker: "Power cycle",
            title: "Off, on, no RESET.",
            body: [
              "Unplug the power bank and plug it back in. It must boot cleanly without a RESET press. If it doesn't, the build guide's GPIO0 note is for exactly that.",
            ],
            extra: "build:linksGpio0",
          },
          {
            kicker: "Close the back",
            title: "Right edge in first, then click.",
            body: [
              "Hook the back panel's right edge in first, then press along the snap-fit until it clicks shut. Keep the cables clear of the edge.",
              "Then slide the back cover over the board bay until it clicks: the small sliding one, over the board.",
            ],
            extra: "build:linksBack",
          },
          {
            kicker: "Last",
            title: "Cover shut, knobs on.",
            body: [
              "Slide the power-bank cover shut. Then press the four black knobs onto the shafts, last of all.",
              "That's a Patternflow, built.",
            ],
          },
        ],
      },
    },
  ],
  next: {
    title: "It's alive. Now play it.",
    lede: "The next guide is what comes after first light: the four knobs, more patterns, and the device's own console.",
    groups: [{ label: "The next guide", items: ["Knobs — turn, press, hold", "Patterns — 33 more, over Wi-Fi", "Console — every setting, in a browser"], to: "play" }],
    until: "Something not right? The board's known issues are written down:",
    links: [
      { label: "Known issues · BUILD_GUIDE §10", href: GUIDE_SECTION.issues },
      { label: "Soldering video", href: SOLDER_VIDEO },
      { label: "Assembly video", href: ASSEMBLY_VIDEO },
      { label: "BUILD_GUIDE.md", href: BUILD_GUIDE_MD },
    ],
    report: { title: "stuck", where: "The Build guide, somewhere not listed" },
  },
  cards: {
    bom: {
      tips: {
        U1: "Plugs into the sockets, never soldered. AliExpress ones usually work too.",
        "U1 (sockets)": "Soldered into U1's two rows of holes.",
        "SW1-SW4": "Bodies on the plain side. Any 5-pin EC11 with a push switch works; the cheapest fail more often.",
        J1: "The panel's ribbon. Notch toward the sockets.",
        J3: "+5 V out to the panel.",
        J4: "The only power input.",
        C11: "Long lead to +.",
        "LED matrix panel": "Check the driver IC before you buy.",
        "M4 screw": "12 is the exact fit; 6 hold it firmly.",
        "USB cable (sacrificial)": "Cut, stripped, clamped into J4.",
        "USB power bank": "Must fit the case's compartment.",
      },
      source: "The BOM file",
      missing: "The parts list is the BOM file:",
    },
    tools: {
      items: [
        { label: "A 3D printer with a 256 mm bed or bigger", where: "§4", href: GUIDE_SECTION.print },
        { label: "White PLA for the body, black PLA for the knobs", where: "§4", href: GUIDE_SECTION.print },
        { label: "Soldering iron, solder, flux, tweezers", where: "§1", href: GUIDE_SECTION.tools },
        { label: "Wire cutters, a Phillips screwdriver, a small flathead for the terminals", where: "§1", href: GUIDE_SECTION.tools },
        { label: "CA glue, for bonding the printed halves", where: "§4", href: GUIDE_SECTION.print },
        { label: "Putty, or baking soda with CA, for the seams (optional)", where: "§4", href: GUIDE_SECTION.print },
        { label: "A multimeter, for the short check and the 5 V check", where: "§5 · §7", href: GUIDE_SECTION.wiring },
        { label: "Pliers or a wrench, for the encoder nuts", where: "§6", href: GUIDE_SECTION.case },
      ],
      kept: "Your ticks stay in this browser.",
    },
    figures: [
      { value: "~2 weeks", label: "for the parts to arrive" },
      { value: "~10 h", label: "of printing" },
      { value: "~1 h", label: "hands-on: 30 min soldering, 30 min assembly" },
    ],
    caseFiles: {
      head: ["Your bed", "Print", ""],
      rows: [
        { bed: "256 mm · P1S, X1C, A1", file: "bed_256mm/encloser.stl", href: CASE_256, note: "In halves you glue." },
        { bed: "330 mm+ · H2S", file: "bed_330mm/encloser.stl", href: CASE_330, note: "One piece, no gluing. Its DevKit opening is for data, never power." },
        { bed: "Another panel", file: "bed_256mm/for_other_panels/", href: CASE_OTHER, note: "Instead of the 256 mm file: its panel mount adjusts to other hole layouts." },
      ],
      settingsLabel: "Print settings",
      settings: ["0.4 mm nozzle", "0.2 mm layers", "standard supports, not tree", "brim off", "aux fan ~20%"],
      links: [
        { label: "MakerWorld", href: MAKERWORLD },
        { label: "patternflow_v3.3mf", href: THREE_MF },
        { label: "All the case files", href: CASE_DIR },
      ],
    },
    order: {
      steps: ["Sockets", "J1 · J3 · J4", "C11", "Encoders"],
      video: { label: "The soldering, start to finish", href: SOLDER_VIDEO },
      skip: "Filmed on a v3.0 board: skip 11:00–15:18, the USB-C part. v3.9 has no USB-C footprint.",
    },
    terminals: {
      seen: "The printed side, encoders up: how you see the board through the open back.",
      red: "red",
      black: "black",
      usb: "USB",
      j4: "power in",
      j3: "out to the panel",
    },
    checks: {
      checkShort: ["+5 V ↔ GND reads open", "The DevKit is still out"],
      checkPower: ["Power off: J3 reads open", "Power on: about 5 V across J3", "Unplugged again"],
      checkKnobs: ["K1 turns and clicks", "K2 turns and clicks", "K3 turns and clicks", "K4 turns and clicks"],
    },
    handoff: {
      label: "Flash it — Play 01",
      href: "/guide/play#flash-2",
      line: "It opens in a new tab. Stop at its last step, “Back in. Power on.”, and come back to this tab.",
    },
    knobMap: { screens: ["Brightness", "Network: Wi-Fi and IP address", "Each knob's number", "Pattern select"] },
    links: {
      linksPcb: [
        { label: "PCBWay shared project", href: PCBWAY },
        { label: "Gerber zip, v3.9", href: GERBER },
        { label: "KiCad source", href: KICAD },
      ],
      linksPanel: [
        { label: "LED panel compatibility", href: PANEL_DOC },
        { label: "Where to buy the panel", href: BOM_README },
      ],
      linksWiring: [{ label: "The wiring at 06:57 in the assembly video", href: `${ASSEMBLY_VIDEO}?t=417` }],
      linksPlay03: [{ label: "More patterns: Play 03", href: "/guide/play#patterns" }],
      linksGpio0: [
        { label: "The GPIO0 note · BUILD_GUIDE §5", href: GUIDE_SECTION.gpio0 },
        { label: "Issue #16", href: ISSUE_16 },
      ],
      linksBack: [{ label: "Closing the back at 09:11 in the assembly video", href: `${ASSEMBLY_VIDEO}?t=551` }],
    },
  },
};

const ko: BuildCopy = {
  meta: {
    title: "패턴플로우 조립하기",
    description:
      "조립 가이드. 맨 부품에서 납땜해 패턴플로우를 만들어요. 부품 목록, 기판 주문, 케이스 출력, 납땜, 조립, 첫 전원까지 실제 v3.9 하드웨어를 3D로 보여줘요.",
  },
  name: "조립",
  opening: {
    kicker: "가이드 · 조립",
    title: "처음부터 직접 만들어요.",
    lede: "기판은 PCB 업체에서, 케이스는 내 3D 프린터에서, 부품은 부품 목록대로. 그다음 납땜과 조립에 한 시간쯤. 실제 부품으로, 실제 순서대로 보여줘요.",
    scroll: "스크롤",
    chapters: ["부품", "주문과 출력", "납땜", "케이스", "배선과 전원", "펌웨어", "점검과 마무리"],
    back: { label: "가이드 전체", to: "hub" },
  },
  chapters: [
    {
      id: "gather",
      copy: {
        num: "01",
        title: "부품 모으기",
        lede: "전부 부품 목록에 있어요. 주문부터 해요. 배송이 제일 오래 걸려요.",
        steps: [
          {
            kicker: "기판 위",
            title: "일곱 줄. 납땜하는 건 전부 스루홀.",
            body: [
              "부품 번호로 주문해요. Mouser, DigiKey, 아니면 같은 번호를 파는 어디든요. 아래 목록이 부품 목록(BOM) 파일 그 자체예요.",
            ],
            extra: "build:bomBoard",
          },
          {
            kicker: "기판 밖",
            title: "패널, 나사, 케이블, 보조배터리.",
            body: [
              "LED 패널만은 부품 번호가 아니라 판매 페이지로 사요. 케이스가 빌드 가이드에 링크된 그 패널에 맞춰져 있거든요. 리본 케이블과 전원 케이블이 같이 와요.",
              "USB 케이블은 잘라도 괜찮은 걸로. 그게 전원선이 돼요.",
            ],
            warn: "다른 패널을 산다면? 제목의 ‘HUB75E’가 아니라 드라이버 IC가 결정해요. S-PWM ‘비디오 월’ 패널은 아예 켜지지 않고, 펌웨어로도 못 고쳐요.",
            extra: "build:bomOff",
          },
          {
            kicker: "작업대 위",
            title: "그리고 공구.",
            body: ["찾는 대로 하나씩 체크해요."],
            extra: "build:tools",
          },
          {
            kicker: "예산과 시간",
            title: "주문 먼저, 조립은 나중에.",
            body: [
              "예산은 100~200달러. 100달러는 예상치가 아니라 바닥이에요. 배송비, 최소 주문 수량, 한두 번의 재출력이 더해져요.",
            ],
            extra: "build:figures",
          },
        ],
      },
    },
    {
      id: "print",
      copy: {
        num: "02",
        title: "기판 주문, 케이스 출력",
        lede: "기판은 PCB 업체에서 와요. 케이스와 노브는 내 프린터에서 나와요.",
        steps: [
          {
            kicker: "기판",
            title: "v3.9 기판을 주문해요.",
            body: [
              "PCBWay 공유 프로젝트는 파일을 올릴 필요가 없고, 거기서 주문하면 패턴플로우에 도움이 돼요. 다른 업체도 괜찮아요. v3.9 거버 zip을 올리면 돼요. JLCPCB가 대개 제일 싸요.",
            ],
            warn: "v3.x만 주문해요. v2.1 기판은 크기가 달라서 이 케이스에 안 들어가요. gerber/experiment/ 안의 것은 검증되지 않았어요.",
            extra: "build:linksPcb",
          },
          {
            kicker: "케이스",
            title: "프린터 베드 크기로 파일을 골라요.",
            body: [
              "본체는 흰색 PLA로, 다 해서 10시간쯤 걸려요. 뱀부 프린터라면 MakerWorld에 맞춘 프로필이 있어서 클릭 한 번이에요. 같은 4플레이트 프로젝트가 레포에도 있어요.",
            ],
            extra: "build:caseFiles",
          },
          {
            kicker: "노브",
            title: "노브는 검정으로, 따로.",
            body: [
              "knobs_20mm.stl을 검정 PLA로 따로 뽑아요. 네 개가 한 플레이트에 다 있어요. BOM의 20 mm 축 엔코더에 맞는 파일이고, 15 mm 축이면 knobs_15mm.stl이에요.",
              "흰 본체에 검은 노브. 그 대비가 패턴플로우의 얼굴이에요.",
            ],
          },
          {
            kicker: "256 mm만",
            title: "출력하자마자 반쪽을 붙여요.",
            body: [
              "256 mm용 출력물은 프레임과 뒤판이 위아래 반쪽으로 나뉘어 있어요. 베드에서 떼자마자 짝끼리 CA 접착제로 붙이고, 굳는 동안 마스킹 테이프로 잡아 둬요.",
              "빛을 비추면 이음매에 머리카락 같은 틈이 보여요. 정상이에요. 퍼티나 베이킹소다에 CA를 부어 메우면 돼요.",
              "굳는 동안 납땜을 해요. 330 mm 일체형 본체를 뽑았다면 이 단계는 건너뛰어요.",
            ],
          },
        ],
      },
    },
    {
      id: "solder",
      copy: {
        num: "03",
        title: "기판 납땜",
        lede: "모든 납땜이 큼직한 스루홀이에요. 작은 부품부터, 엔코더는 마지막에.",
        steps: [
          {
            kicker: "소켓",
            title: "소켓부터, 글씨 있는 면에.",
            body: [
              "1×22 소켓 두 개를 글씨가 인쇄된 면에서 U1의 구멍 두 줄에 꽂아요. 44핀을 전부 글씨 없는 면에서 납땜하고, 두 줄 다 곧고 바닥에 딱 붙게 해요.",
              "DevKit은 한참 뒤에 꽂아요. 절대 납땜하지 않아요.",
            ],
            extra: "build:order",
          },
          {
            kicker: "J1 · J3 · J4",
            title: "다음은 헤더와 나사 단자 두 개.",
            body: [
              "2×8 박스 헤더 J1은 오른쪽 소켓 줄 옆에, 홈이 소켓 쪽을 보게 꽂아요. 기판에도 그쪽에 hole!이라고 적혀 있어요.",
              "나사 단자 두 개는 아래쪽 양 귀퉁이에 가요. 글씨 있는 면을 위로, 엔코더를 위쪽에 두고 보면 J3가 오른쪽, J4가 왼쪽이에요. J4가 기판의 유일한 전원 입력이에요.",
              "하나씩 바닥에 붙여 꽂고 글씨 없는 면에서 납땜해요. J1은 16곳, J3와 J4는 두 곳씩.",
            ],
            extra: "build:order",
          },
          {
            kicker: "C11",
            title: "커패시터는 방향을 맞춰서.",
            body: [
              "1000 µF 전해 커패시터 C11은 J4 위에 가요. 긴 다리가 +예요. 기판에 +라고 적힌, 소켓에 더 가까운 구멍에 넣어요. 몸통의 띠는 − 표시예요.",
              "납땜하고 다리를 잘라요.",
            ],
            warn: "한 방향으로만 들어가요. 납땜 전에 긴 다리가 +에 들어갔는지 확인해요.",
            extra: "build:order",
          },
          {
            kicker: "SW1–SW4",
            title: "엔코더는 마지막, 반대쪽에서.",
            body: [
              "기판을 뒤집어요. 엔코더 네 개는 글씨 없는 면에서 꽂아요. 몸통이 그쪽에 앉고, 다리는 글씨 있는 면으로 나와요. 기판에도 네 번이나 적혀 있어요. ENCODER FACING OTHER SIDE.",
              "다리는 글씨 있는 면에서 납땜해요.",
            ],
            warn: "하나 납땜할 때마다 면을 두 번 확인해요. 반대로 달면 축이 케이스 앞면에 닿지 않고, 한번 납땜한 엔코더는 빼기가 정말 힘들어요.",
            extra: "build:order",
          },
          {
            kicker: "전원 넣기 전에",
            title: "쇼트부터 확인해요.",
            body: [
              "멀티미터를 도통 모드로 놓고 +5 V와 GND에 대요. J4의 나사 두 개가 대기 쉬워요. 열려 있어야 해요. 삑 소리가 나면 안 돼요.",
              "DevKit은 아직 빼 둬요. 05의 첫 전원 확인이 끝난 뒤에 꽂아요.",
            ],
            extra: "build:checkShort",
          },
        ],
      },
    },
    {
      id: "case",
      copy: {
        num: "04",
        title: "케이스에 넣기",
        lede: "패널 먼저, 그다음 기판. 전원선은 미리 케이스에 통과시켜 두고요.",
        steps: [
          {
            kicker: "패널",
            title: "HUB-75E IN은 위쪽으로.",
            body: [
              "접착제가 다 굳었나요? LED 패널을 뒤에서 프레임에 넣어요. LED는 창 쪽으로, HUB-75E IN이라고 적힌 커넥터는 위쪽, 노브가 있는 쪽으로요. 리본 케이블이 J1에 닿는 쪽이에요.",
            ],
            warn: "아주 빡빡해요. 틈이 거의 없어요. 천천히 밀어 넣어요. 억지로 넣으면 출력물이 깨질 수 있어요.",
          },
          {
            kicker: "M4 나사",
            title: "패널을 나사로 고정해요.",
            body: [
              "M4 나사로 고정해요. 12개 다 박으면 딱 맞고, 6개만 모서리와 가운데에 고루 박아도 단단히 잡혀요.",
              "다른 패널은 구멍과 나사가 다를 수 있어요. 그래서 for_other_panels 출력물이 있어요.",
            ],
          },
          {
            kicker: "전원선",
            title: "기판보다 전원선이 먼저.",
            body: [
              "USB 케이블을 자르고 빨강, 검정 두 가닥의 피복을 벗겨요. 빨강이 +5 V, 검정이 GND. 나머지 선은 안 써요.",
              "자른 끝을 먼저 케이스의 케이블 구멍에 통과시켜요. 보조배터리 칸에서 기판 칸 쪽으로요.",
              "기판이 아직 케이스 밖에 있을 때 J4에 물려요. 빨강은 +5v라고 적힌 쪽. 조이고, 한 가닥씩 당겨 봐요.",
            ],
            warn: "전원이 들어가는 길은 J4 하나뿐이에요. DevKit의 USB 포트로는 절대 넣지 않아요.",
            extra: "build:j4",
          },
          {
            kicker: "기판",
            title: "기판을 자리에 넣어요.",
            body: [
              "글씨 있는 면이 나를 보게, 엔코더부터 넣어요. 축 네 개가 앞면의 구멍 네 개로 나가요. 소켓과 단자는 열린 뒤쪽을 보고, J4 전원선은 기판을 따라 들어가요.",
            ],
          },
          {
            kicker: "너트",
            title: "앞에서 너트로 고정해요.",
            body: [
              "앞면에서 엔코더마다 딸려 온 너트를 축에 끼우고 펜치나 렌치로 조여요. 이 너트들이 기판을 앞면에 붙잡아 줘요.",
              "노브는 아직 끼우지 않아요. 점검이 끝난 뒤 맨 마지막에.",
            ],
          },
        ],
      },
    },
    {
      id: "wire",
      copy: {
        num: "05",
        title: "배선과 첫 전원",
        lede: "패널에서 기판으로 케이블 두 개, 그리고 조심스러운 첫 전원. 아직 DevKit 없이요.",
        steps: [
          {
            kicker: "리본 케이블",
            title: "J1에서 패널의 IN으로.",
            body: [
              "패널의 HUB75 리본 케이블을 기판의 J1과 패널의 IN이라고 적힌 커넥터에 꽂아요. OUT 말고 IN이에요. 플러그에 돌기가 있어요. 헤더의 홈에 맞춰 꽂아요.",
            ],
          },
          {
            kicker: "J3",
            title: "패널 전원은 J3로.",
            body: [
              "패널의 전원 케이블을 J3에 물려요. 빨강은 +5v라고 적힌 쪽, 검정은 GND로.",
              "J3는 J4의 거울상이에요. 이쪽에서 보면 J3의 +5v는 왼쪽, J4의 +5v는 오른쪽이에요. 왼쪽 오른쪽 말고 +5v 표시를 보고 맞춰요.",
            ],
            warn: "거꾸로 물리면 패널이 망가질 수 있어요. 전원 넣기 전에 두 번 확인해요.",
            extra: "build:j3",
          },
          {
            kicker: "첫 전원",
            title: "DevKit 없이 전원 한 번.",
            body: [
              "전원을 넣기 전에 J3의 +5 V와 GND 사이 도통을 봐요. 열려 있어야 해요. 그다음 J4 전원선을 보조배터리에 한 번 꽂고, J3에서 5 V쯤 나오는지 재고, 다시 빼요.",
              "패널은 꺼진 그대로예요. 아직 두뇌가 없거든요.",
            ],
            extra: "build:checkPower",
          },
        ],
      },
    },
    {
      id: "firmware",
      copy: {
        num: "06",
        title: "펌웨어와 첫 불빛",
        lede: "DevKit은 따로 펌웨어를 받고, 그다음 기판에 들어가요.",
        steps: [
          {
            kicker: "굽기",
            title: "굽기는 연주 가이드에서.",
            body: [
              "DevKit은 기판에서 뺀 채로, 데스크톱 크롬이나 엣지에서 따로 구워요. 연주 가이드의 01 굽기가 왼쪽 USB 포트, BOOT와 RST, 2.4 GHz 와이파이까지 차례로 보여줘요.",
            ],
            extra: "build:handoff",
          },
          {
            kicker: "꽂기",
            title: "전원을 빼고, DevKit을 꽂아요.",
            body: [
              "구운 DevKit을 소켓 두 줄에 곧게 눌러 꽂아요. USB-C 포트는 기판의 아래쪽 가장자리, USB라고 적힌 쪽으로, 안테나 끝은 엔코더 쪽으로요.",
              "44핀이 전부 들어가고, 어느 줄도 한 칸 밀리지 않게요.",
            ],
          },
          {
            kicker: "첫 불빛",
            title: "보조배터리를 꽂아요.",
            body: [
              "보조배터리를 칸에 밀어 넣고 J4 전원선을 꽂아요. 1~2초 안에 패널이 Origin으로 켜져요.",
              "패턴이 하나뿐인 게 맞아요. 설치 실패가 아니에요. Basics 팩은 연주 가이드의 03에서 넣어요.",
            ],
            extra: "build:linksPlay03",
          },
        ],
      },
    },
    {
      id: "check",
      copy: {
        num: "07",
        title: "점검과 마무리",
        lede: "노브 하나하나, 화면 하나하나, 전원 한 번 껐다 켜기. 그다음 뒤판을 닫고, 노브는 맨 마지막에.",
        steps: [
          {
            kicker: "돌리고 누르기",
            title: "노브마다, 돌리고 눌러요.",
            body: [
              "축 네 개를 하나씩 돌려요. 돌릴 때마다 패턴이 눈에 띄게 바뀌어야 해요. 그다음 하나씩 한 번 눌러요. Origin에선 누르면 그 노브가 0으로 돌아가요.",
              "앞에서 보면 위에 K2와 K1, 아래에 K4와 K3예요.",
            ],
            extra: "build:checkKnobs",
          },
          {
            kicker: "꾹 누르기",
            title: "노브마다 1초 꾹.",
            body: ["노브마다 자기 화면이 열려요. K4는 패턴 목록이에요. 돌려서 고르고, 다시 꾹 눌러 닫아요."],
            extra: "build:knobMap",
          },
          {
            kicker: "껐다 켜기",
            title: "껐다 켜도, RESET 없이.",
            body: [
              "보조배터리를 뺐다가 다시 꽂아요. RESET을 누르지 않아도 깔끔하게 켜져야 해요. 안 그렇다면 빌드 가이드의 GPIO0 메모가 바로 그 얘기예요.",
            ],
            extra: "build:linksGpio0",
          },
          {
            kicker: "뒤판 닫기",
            title: "오른쪽 가장자리부터, 딸깍.",
            body: [
              "뒤판의 오른쪽 가장자리를 먼저 걸고, 스냅핏을 따라 눌러 딸깍 닫아요. 케이블이 가장자리에 끼지 않게 해요.",
              "그다음 기판 칸 위의 뒷면 덮개(밀어 닫는 작은 덮개)를 밀어 딸깍 닫아요.",
            ],
            extra: "build:linksBack",
          },
          {
            kicker: "마지막",
            title: "덮개 닫고, 노브 끼우기.",
            body: [
              "보조배터리 칸 덮개를 밀어 닫아요. 그리고 검은 노브 네 개를 축에 눌러 끼워요. 맨 마지막에요.",
              "패턴플로우 완성이에요.",
            ],
          },
        ],
      },
    },
  ],
  next: {
    title: "살아났어요. 이제 연주해요.",
    lede: "다음 가이드는 첫 불빛 그다음이에요. 노브 네 개, 패턴 더 넣기, 그리고 기기의 웹 콘솔.",
    groups: [{ label: "다음 가이드", items: ["노브 — 돌리고, 누르고, 꾹", "패턴 — 와이파이로 33개 더", "콘솔 — 모든 설정을 브라우저에서"], to: "play" }],
    until: "뭔가 이상하면, 기판의 알려진 문제가 정리돼 있어요:",
    links: [
      { label: "알려진 문제 · BUILD_GUIDE §10", href: GUIDE_SECTION.issues },
      { label: "납땜 영상", href: SOLDER_VIDEO },
      { label: "조립 영상", href: ASSEMBLY_VIDEO },
      { label: "BUILD_GUIDE.md", href: BUILD_GUIDE_MD },
    ],
    report: { title: "stuck", where: "조립 가이드 어딘가 (단계 없음)" },
  },
  cards: {
    bom: {
      tips: {
        U1: "소켓에 꽂기만 하고 납땜 안 해요. 알리익스프레스 것도 대개 돼요.",
        "U1 (sockets)": "U1의 구멍 두 줄에 납땜해요.",
        "SW1-SW4": "몸통은 글씨 없는 면에. 누름 스위치 달린 5핀 EC11이면 되고, 제일 싼 건 불량이 좀 잦아요.",
        J1: "패널 리본 케이블. 홈은 소켓 쪽으로.",
        J3: "패널로 나가는 +5 V.",
        J4: "유일한 전원 입력.",
        C11: "긴 다리가 +.",
        "LED matrix panel": "사기 전에 드라이버 IC를 확인해요.",
        "M4 screw": "12개면 딱 맞고, 6개로도 단단해요.",
        "USB cable (sacrificial)": "잘라서 벗기고 J4에 물려요.",
        "USB power bank": "케이스 칸에 들어가야 해요.",
      },
      source: "BOM 파일",
      missing: "부품 목록은 BOM 파일 그대로예요:",
    },
    tools: {
      items: [
        { label: "베드 256 mm 이상인 3D 프린터", where: "§4", href: GUIDE_SECTION.print },
        { label: "본체용 흰색 PLA, 노브용 검정 PLA", where: "§4", href: GUIDE_SECTION.print },
        { label: "인두, 땜납, 플럭스, 핀셋", where: "§1", href: GUIDE_SECTION.tools },
        { label: "니퍼, 십자 드라이버, 단자용 작은 일자 드라이버", where: "§1", href: GUIDE_SECTION.tools },
        { label: "출력물 반쪽을 붙일 CA 접착제", where: "§4", href: GUIDE_SECTION.print },
        { label: "이음매용 퍼티, 또는 베이킹소다와 CA (선택)", where: "§4", href: GUIDE_SECTION.print },
        { label: "쇼트 확인과 5 V 확인용 멀티미터", where: "§5 · §7", href: GUIDE_SECTION.wiring },
        { label: "엔코더 너트용 펜치나 렌치", where: "§6", href: GUIDE_SECTION.case },
      ],
      kept: "체크한 건 이 브라우저에 남아요.",
    },
    figures: [
      { value: "~2주", label: "부품 배송" },
      { value: "~10시간", label: "출력" },
      { value: "~1시간", label: "손 작업: 납땜 30분, 조립 30분" },
    ],
    caseFiles: {
      head: ["내 베드", "출력할 파일", ""],
      rows: [
        { bed: "256 mm · P1S, X1C, A1", file: "bed_256mm/encloser.stl", href: CASE_256, note: "반쪽씩 나와서 붙여요." },
        { bed: "330 mm 이상 · H2S", file: "bed_330mm/encloser.stl", href: CASE_330, note: "한 덩어리, 붙일 것 없음. DevKit 쪽 구멍은 데이터용이지 전원용이 아니에요." },
        { bed: "다른 패널", file: "bed_256mm/for_other_panels/", href: CASE_OTHER, note: "256 mm 파일 대신. 패널 고정부가 다른 구멍 배치에 맞춰져요." },
      ],
      settingsLabel: "출력 설정",
      settings: ["노즐 0.4 mm", "레이어 0.2 mm", "일반 서포트 (트리 말고)", "브림 끔", "보조 팬 ~20%"],
      links: [
        { label: "MakerWorld", href: MAKERWORLD },
        { label: "patternflow_v3.3mf", href: THREE_MF },
        { label: "케이스 파일 전체", href: CASE_DIR },
      ],
    },
    order: {
      steps: ["소켓", "J1 · J3 · J4", "C11", "엔코더"],
      video: { label: "납땜 처음부터 끝까지", href: SOLDER_VIDEO },
      skip: "v3.0 기판으로 찍었어요. USB-C 부분인 11:00–15:18은 건너뛰어요. v3.9엔 USB-C 자리가 없어요.",
    },
    terminals: {
      seen: "글씨 있는 면, 엔코더가 위. 열린 뒤판으로 들여다볼 때의 모습이에요.",
      red: "빨강",
      black: "검정",
      usb: "USB",
      j4: "전원 입력",
      j3: "패널로 출력",
    },
    checks: {
      checkShort: ["+5 V ↔ GND가 열려 있음", "DevKit은 아직 빼 둠"],
      checkPower: ["전원 끄고: J3가 열려 있음", "전원 켜고: J3에서 5 V쯤", "다시 뺌"],
      checkKnobs: ["K1 돌리고 누르기", "K2 돌리고 누르기", "K3 돌리고 누르기", "K4 돌리고 누르기"],
    },
    handoff: {
      label: "굽기 — 연주 01",
      href: "/guide/play/ko#flash-2",
      line: "새 탭에서 열려요. 마지막 단계 ‘다시 꽂고, 전원.’에서 멈추고 이 탭으로 돌아와요.",
    },
    knobMap: { screens: ["밝기", "네트워크: 와이파이와 IP 주소", "노브마다 번호", "패턴 고르기"] },
    links: {
      linksPcb: [
        { label: "PCBWay 공유 프로젝트", href: PCBWAY },
        { label: "거버 zip, v3.9", href: GERBER },
        { label: "KiCad 원본", href: KICAD },
      ],
      linksPanel: [
        { label: "LED 패널 호환성", href: PANEL_DOC },
        { label: "패널 사는 곳", href: BOM_README },
      ],
      linksWiring: [{ label: "조립 영상 06:57, 배선", href: `${ASSEMBLY_VIDEO}?t=417` }],
      linksPlay03: [{ label: "패턴 더 넣기: 연주 03", href: "/guide/play/ko#patterns" }],
      linksGpio0: [
        { label: "GPIO0 메모 · BUILD_GUIDE §5", href: GUIDE_SECTION.gpio0 },
        { label: "이슈 #16", href: ISSUE_16 },
      ],
      linksBack: [{ label: "조립 영상 09:11, 뒤판 닫기", href: `${ASSEMBLY_VIDEO}?t=551` }],
    },
  },
};

export const BUILD_COPY: Record<GuideLang, BuildCopy> = { en, ko };
