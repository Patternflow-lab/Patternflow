import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BUILD_COPY, PANEL_LISTING } from "../copy/build";
import { PAGES } from "../pages";
import { BOM_FILE, bomKey, dashed, PANEL_PART, parseBom, times } from "./bom";
import { CHECK_CARDS, LINK_CARDS, type BuildCard } from "./cards";

// The Build guide against its sources: the parts list on the page is the BOM
// file (hardware/bom/bom_v3.9.csv), every line of it has its few words in
// both languages and nothing longer, the LED panel's line carries the listing
// BUILD_GUIDE §1 recommends, every card a step names exists, the way to the
// firmware is the Play guide's own chapter, USB-C is never power, there is no
// multimeter, the LED panel goes in from the front, and the power lead goes
// through the small cable hole.

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const csv = fs.readFileSync(path.join(REPO_ROOT, BOM_FILE), "utf8");
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

  it("has a few words for every line, and only for lines that exist", () => {
    const keys = bom.map(bomKey);
    // Every line but the LED panel, whose line is `panel`: its listing, not a tip.
    const tipped = keys.filter((k) => k !== PANEL_PART);
    for (const lang of langs) {
      const words = BUILD_COPY[lang].cards.bom;
      expect(Object.keys(words.tips).sort()).toEqual([...tipped].sort());
      for (const k of Object.keys(words.more)) expect(keys, `${lang} more: ${k}`).toContain(k);
      for (const k of Object.keys(words.names ?? {})) expect(keys, `${lang} names: ${k}`).toContain(k);
    }
    // The same lines open in both languages.
    expect(Object.keys(BUILD_COPY.ko.cards.bom.more).sort()).toEqual(Object.keys(BUILD_COPY.en.cards.bom.more).sort());
  });

  it("keeps a line to a few words: the rest is behind it, or in the file", () => {
    for (const lang of langs) {
      const { tips, more } = BUILD_COPY[lang].cards.bom;
      for (const [k, tip] of Object.entries(tips)) expect(tip.length, `${lang} ${k}: ${tip}`).toBeLessThanOrEqual(48);
      for (const [k, s] of Object.entries(more)) expect(s.length, `${lang} ${k}: ${s}`).toBeLessThanOrEqual(130);
    }
    // The file's long notes are what the card leaves to the file.
    expect(Math.max(...bom.map((r) => r.notes.length))).toBeGreaterThan(200);
  });

  it("gives the LED panel the listing the build guide recommends, and the compatibility doc", () => {
    const panels = bom.filter((r) => r.part === PANEL_PART);
    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({ category: "off-board", ref: "-", qty: "1" });
    // BUILD_GUIDE §1, "Off the board": the recommended listing is this link.
    const guide = fs.readFileSync(path.join(REPO_ROOT, "BUILD_GUIDE.md"), "utf8");
    const offBoard = guide.slice(guide.indexOf("### Off the board"), guide.indexOf("### What you also need"));
    expect(offBoard).toContain("**Recommended: [");
    expect(offBoard).toContain(`](${PANEL_LISTING})`);
    // It is an affiliate link, and the card says so, as BUILD_GUIDE does.
    expect(offBoard).toMatch(/affiliate link/);
    expect(fs.existsSync(path.join(REPO_ROOT, "docs/panel-compatibility.md"))).toBe(true);
    for (const lang of langs) {
      const { panel } = BUILD_COPY[lang].cards.bom;
      expect(panel.listing.href).toBe(PANEL_LISTING);
      expect(panel.other.href).toBe("https://github.com/engmung/Patternflow/blob/main/docs/panel-compatibility.md");
      expect(panel.note).toMatch(/affiliate|제휴/);
    }
  });

  it("links the file's own list in the build guide under the card", () => {
    for (const lang of langs) {
      expect(BUILD_COPY[lang].cards.bom.guide.href).toBe("https://github.com/engmung/Patternflow/blob/main/BUILD_GUIDE.md#1-bill-of-materials-bom");
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

  it("sets sizes with a multiplication sign, and leaves other x's alone", () => {
    expect(times("HUB75, 128x64 px, P2.5, 320x160 mm")).toBe("HUB75, 128×64 px, P2.5, 320×160 mm");
    expect(times("1x22, 2.54mm pitch")).toBe("1×22, 2.54mm pitch");
    expect(times("radial D10xL13")).toBe("radial D10×L13");
    expect(times("EC11 footprint, 5-pin")).toBe("EC11 footprint, 5-pin");
    for (const r of bom) expect(times(r.spec)).not.toMatch(/\dx\d/);
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

  it("never sends a reader to the top of BUILD_GUIDE §5", () => {
    // What is under that heading is a multimeter pass this guide does not
    // have; the GPIO0 note is at the section's far end. A boot that needs RST
    // goes to issue #16, and to §10, which lists it.
    expect(JSON.stringify(BUILD_COPY)).not.toMatch(/#5-pcb-assembly/);
    for (const lang of langs) {
      expect(BUILD_COPY[lang].cards.links.linksGpio0.map((l) => l.href)).toEqual([
        "https://github.com/engmung/Patternflow/issues/16",
        "https://github.com/engmung/Patternflow/blob/main/BUILD_GUIDE.md#10-known-issues--design-notes",
      ]);
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

  it("has no multimeter: no short check, no continuity, no 5 V measurement", () => {
    for (const lang of langs) {
      for (const s of texts(BUILD_COPY[lang])) {
        expect(s, `${lang}: ${s}`).not.toMatch(
          /multimeter|\bmeter\b|continuity|\bprobes?\b|\bshort\b|\bmeasure\b|reads? open|멀티미터|테스터|도통|쇼트|단락|측정|재고|재요/i,
        );
      }
    }
    expect(CHECK_CARDS).toEqual(["checkKnobs"]);
  });

  it("goes from the wiring straight on to the firmware, with the other steps as they were", () => {
    // solder-5 (the short check) and wire-3 (the powered check) are gone.
    const steps = { gather: 4, print: 4, solder: 4, case: 5, wire: 2, firmware: 3, check: 5 };
    for (const lang of langs) {
      const chapters = BUILD_COPY[lang].chapters;
      expect(Object.fromEntries(chapters.map((c) => [c.id, c.copy.steps.length]))).toEqual(steps);
      expect(chapters.map((c) => c.id)).toEqual(Object.keys(steps));
      expect(chapters.flatMap((c) => c.copy.steps)).toHaveLength(27);
      const wire = chapters.find((c) => c.id === "wire")!.copy;
      expect(wire.steps.at(-1)?.extra).toBe("build:j3");
      // Nothing powers the board before the DevKit is in: the first power is first light.
      const firmware = chapters.find((c) => c.id === "firmware")!.copy;
      expect(firmware.steps.map((s) => s.extra ?? null)).toEqual(["build:handoff", null, "build:linksPlay03"]);
    }
    expect(BUILD_COPY.en.chapters.find((c) => c.id === "wire")?.copy.title).toBe("Wiring");
    expect(BUILD_COPY.en.chapters.find((c) => c.id === "firmware")?.copy.steps[1].title).not.toMatch(/check/i);
  });

  it("puts the LED panel in from the front, and screws it in from behind", () => {
    const step = (lang: "en" | "ko", i: number) => {
      const s = BUILD_COPY[lang].chapters.find((c) => c.id === "case")!.copy.steps[i];
      return [s.title, ...s.body].join(" ");
    };
    expect(step("en", 0)).toMatch(/from the front/);
    expect(step("en", 0)).toMatch(/HUB-75E IN/);
    expect(step("en", 0)).not.toMatch(/from (the back|behind)/);
    expect(step("en", 1)).toMatch(/from behind/);
    expect(step("ko", 0)).toMatch(/앞/);
    expect(step("ko", 0)).toMatch(/HUB-75E IN/);
    expect(step("ko", 0)).not.toMatch(/뒤에서/);
    expect(step("ko", 1)).toMatch(/뒤에서/);
  });

  it("threads the power lead through the small cable hole, before the board goes in", () => {
    // The wall between the power-bank compartment and the board bay has a
    // small cable hole right under J4. The 330 mm body has a wide opening
    // beside it as well, the USB pass-through to the DevKit; the 256 mm print
    // has only the small hole (hardware/case/README.md). The lead takes the
    // small one, whichever case it is.
    const step = (lang: "en" | "ko") => BUILD_COPY[lang].chapters.find((c) => c.id === "case")!.copy.steps[2];
    expect(step("en").title).toBe("The lead goes in before the board.");
    expect(step("en").body.join(" ")).toMatch(/through the small cable hole/);
    expect(step("en").body.join(" ")).toMatch(/Not the wide opening beside it, if your case has one/);
    expect(step("ko").body.join(" ")).toMatch(/작은 케이블 구멍/);
    expect(step("ko").body.join(" ")).toMatch(/넓은 구멍이 있는 케이스도 있는데, 거기가 아니에요/);
    for (const lang of langs) expect(step(lang).extra).toBe("build:j4");
  });

  it("never calls a side of the board its front or back", () => {
    // The printed side and the plain side: the docs' "back" means both.
    for (const lang of langs) {
      const words = JSON.stringify(BUILD_COPY[lang].chapters);
      expect(words).not.toMatch(/(front|back) (side )?of the board|board's (front|back)|기판 (앞|뒤)면/i);
    }
  });
});
