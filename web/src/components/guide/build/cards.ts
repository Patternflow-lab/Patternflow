// The cards inside the Build guide's steps (BuildCards.tsx): a step names one
// as its extra, "build:<card>" (copy.ts Extra). Their words are in
// copy/build.ts `cards`; the parts list is the BOM itself (bom.ts).

/** Cards that are a row of links: their links are copy/build.ts cards.links. */
export const LINK_CARDS = ["linksPcb", "linksWiring", "linksPlay03", "linksGpio0", "linksBack"] as const;
export type LinkCard = (typeof LINK_CARDS)[number];

/**
 * Cards that are a checklist the reader ticks: their items are copy/build.ts
 * cards.checks. One, the knobs — there is no multimeter in this guide, so no
 * short check and no 5 V check.
 */
export const CHECK_CARDS = ["checkKnobs"] as const;
export type CheckCard = (typeof CHECK_CARDS)[number];

export type BuildCard =
  /** The BOM's on-board lines: a quantity, a part, its reference and a few words each; the part number behind the line. */
  | "bomBoard"
  /** The BOM's off-board lines, the LED panel's with its recommended listing and the way to the compatibility doc. */
  | "bomOff"
  /** What else is on the bench (BUILD_GUIDE §1), ticked off. */
  | "tools"
  /** Budget, shipping, print and build time. */
  | "figures"
  /** Which case file for which printer bed, and the print settings. */
  | "caseFiles"
  /** The soldering order, the step's own part lit; the video on the first. */
  | "order"
  /** The board's bottom edge seen from the printed side, J4 (power in) lit. */
  | "j4"
  /** The same, J3 (power out to the panel) lit. */
  | "j3"
  /** Flashing is the Play guide's 01: the way there. */
  | "handoff"
  /** The four knobs as the front shows them, each with its long-press screen. */
  | "knobMap"
  | CheckCard
  | LinkCard;
