import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUILD_COPY } from "../copy/build";
import { PAGES } from "../pages";
import { BOM_FILE, bomKey, dashed, parseBom } from "./bom";
import { CHECK_CARDS, LINK_CARDS, type BuildCard } from "./cards";

// The Build guide against its sources: the parts list on the page is the BOM
// file (hardware/bom/bom_v3.9.csv), every line of it has its words in both
// languages, every card a step names exists, the way to the firmware is the
// Play guide's own chapter, and USB-C is never power.

const csv = fs.readFileSync(path.resolve(__dirname, "../../../../..", BOM_FILE), "utf8");
const bom = parseBom(csv);
const langs = ["en", "ko"] as const;

const CARDS: BuildCard[] = [
  "bomBoard",
  "bomOff",
  "tools",
  "figures",
  "caseFiles",
  "order",
  "j4",
  "j3",
  "handoff",
  "knobMap",
  ...CHECK_CARDS,
  ...LINK_CARDS,
];

describe("the Build guide's parts list", () => {
  it("reads the BOM file as it is", () => {
    expect(bom.length).toBeGreaterThan(0);
    const board = bom.filter((r) => r.category === "pcb");
    // Seven on-board lines, all through-hole (hardware/bom/README.md).
    expect(board.map((r) => r.ref)).toEqual(["U1", "U1 (sockets)", "SW1-SW4", "J1", "J3", "J4", "C11"]);
    expect(board.find((r) => r.ref === "U1")).toMatchObject({ qty: "1", mounting: "socketed" });
    expect(board.find((r) => r.ref === "U1 (sockets)")).toMatchObject({ qty: "2" });
    expect(board.find((r) => r.ref === "SW1-SW4")).toMatchObject({ qty: "4" });
    expect(board.filter((r) => r.ref !== "U1").every((r) => r.mounting === "thru-hole")).toBe(true);
    expect(bom.find((r) => r.ref === "J4")?.notes).toMatch(/THE power input/);
    // Quoted fields with commas come through whole.
    expect(bom.find((r) => r.ref === "U1")?.spec).toBe("N16R8 (16MB Flash, 8MB PSRAM), 44-pin, 25.4mm header spacing");
  });

  it("refuses a file whose columns changed", () => {
    expect(() => parseBom("category,ref,qty\npcb,U1,1\n")).toThrow(/no column/);
  });

  it("has words for every line, and only for lines that exist", () => {
    const keys = bom.map(bomKey);
    for (const lang of langs) {
      const tips = BUILD_COPY[lang].cards.bom.tips;
      expect(Object.keys(tips).sort()).toEqual([...keys].sort());
    }
  });

  it("names every part on the board in the steps", () => {
    for (const lang of langs) {
      const words = JSON.stringify(BUILD_COPY[lang].chapters);
      for (const r of bom.filter((r) => r.category === "pcb")) {
        const ref = dashed(r.ref.replace(" (sockets)", ""));
        expect(words, `${lang}: ${ref}`).toContain(ref);
      }
    }
  });

  it("sets ranges with an en dash", () => {
    expect(dashed("SW1-SW4")).toBe("SW1–SW4");
    expect(dashed("6-12")).toBe("6–12");
    expect(dashed("U1 (sockets)")).toBe("U1 (sockets)");
  });
});

describe("the Build guide's cards and links", () => {
  it("names only cards that exist", () => {
    for (const lang of langs) {
      for (const ch of BUILD_COPY[lang].chapters) {
        for (const step of ch.copy.steps) {
          if (!step.extra) continue;
          expect(step.extra.startsWith("build:"), `${lang} ${ch.id}: ${step.extra}`).toBe(true);
          expect(CARDS).toContain(step.extra.slice(6));
        }
      }
    }
  });

  it("puts the same cards on the same steps in both languages", () => {
    const extras = (lang: "en" | "ko") => BUILD_COPY[lang].chapters.map((c) => c.copy.steps.map((s) => s.extra ?? null));
    expect(extras("ko")).toEqual(extras("en"));
  });

  it("lights one part of the soldering order per step, in order", () => {
    const solder = BUILD_COPY.en.chapters.find((c) => c.id === "solder");
    const withOrder = solder?.copy.steps.map((s, i) => (s.extra === "build:order" ? i : -1)).filter((i) => i >= 0);
    expect(withOrder).toEqual([0, 1, 2, 3]);
    for (const lang of langs) expect(BUILD_COPY[lang].cards.order.steps).toHaveLength(4);
  });

  it("hands the firmware to Play's 01 Flash, at a step that exists", () => {
    const flash = PAGES.play.text("en").chapters.find((c) => c.id === "flash");
    expect(flash).toBeTruthy();
    for (const lang of langs) {
      const { href } = BUILD_COPY[lang].cards.handoff;
      const [where, anchor] = href.split("#");
      expect(where).toBe(PAGES.play.path[lang]);
      const n = Number(anchor.replace("flash-", ""));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(flash!.copy.steps.length);
      const patterns = BUILD_COPY[lang].cards.links.linksPlay03[0].href;
      expect(patterns).toBe(`${PAGES.play.path[lang]}#patterns`);
    }
  });

  it("checks the same things in both languages", () => {
    for (const card of CHECK_CARDS) expect(BUILD_COPY.ko.cards.checks[card]).toHaveLength(BUILD_COPY.en.cards.checks[card].length);
    for (const card of LINK_CARDS) {
      expect(BUILD_COPY.ko.cards.links[card].map((l) => l.href.replace("/guide/play/ko", "/guide/play"))).toEqual(
        BUILD_COPY.en.cards.links[card].map((l) => l.href),
      );
    }
    expect(BUILD_COPY.ko.cards.tools.items.map((t) => t.href)).toEqual(BUILD_COPY.en.cards.tools.items.map((t) => t.href));
  });

  it("links the known issues instead of restating them", () => {
    for (const lang of langs) {
      expect(BUILD_COPY[lang].next.links.map((l) => l.href)).toContain(
        "https://github.com/engmung/Patternflow/blob/main/BUILD_GUIDE.md#10-known-issues--design-notes",
      );
    }
  });
});

describe("the Build guide's words", () => {
  /** Every string in a language's words: a body paragraph, a warning, a card's line. */
  const texts = (v: unknown): string[] =>
    typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(texts) : [];

  it("never makes USB-C a way to power it", () => {
    for (const lang of langs) {
      // The DevKit's USB-C ports, wherever power is mentioned with them: only ever to say no.
      const both = texts(BUILD_COPY[lang]).filter((s) => /USB-C|USB ports?|USB 포트/i.test(s) && /power|전원/i.test(s));
      expect(both.length, `${lang}: the warning is there`).toBeGreaterThan(0);
      for (const s of both) expect(s, `${lang}: ${s}`).toMatch(/\bnever\b|\bnot\b|\bno USB-C\b|절대|않|없|아니/i);
    }
  });

  it("names J4 as the one power input", () => {
    expect(JSON.stringify(BUILD_COPY.en)).toMatch(/J4 is the board's only power input/);
    expect(JSON.stringify(BUILD_COPY.ko)).toMatch(/J4가 기판의 유일한 전원 입력/);
  });

  it("never offers a kit or an assembled board", () => {
    expect(JSON.stringify(BUILD_COPY)).not.toMatch(/\bkits?\b|pre-?assembled|assembled board|키트|완제품/i);
  });

  it("never calls a side of the board its front or back", () => {
    // The printed side and the plain side: the docs' "back" means both.
    for (const lang of langs) {
      const words = JSON.stringify(BUILD_COPY[lang].chapters);
      expect(words).not.toMatch(/(front|back) (side )?of the board|board's (front|back)|기판 (앞|뒤)면/i);
    }
  });
});
